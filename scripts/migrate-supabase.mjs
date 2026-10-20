import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { parse } from 'dotenv';
import { Pool } from 'pg';
import { promptConfirmation, promptSecret } from './backup-common.mjs';

const env = parse(await readFile('.env', 'utf8'));
if (!env.DATABASE_URL) throw new Error('DATABASE_URL local no está configurado en .env.');

const remoteUrl = new URL(await promptSecret('Pega la URI Session pooler de Supabase (entrada oculta): '));
if (!['postgres:', 'postgresql:'].includes(remoteUrl.protocol) || !remoteUrl.hostname.endsWith('.pooler.supabase.com')) {
  throw new Error('Usa la URI PostgreSQL Session pooler copiada desde Supabase.');
}
remoteUrl.searchParams.set('sslmode', 'require');
remoteUrl.searchParams.set('uselibpqcompat', 'true');

const local = new Pool({ connectionString: env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15_000 });
const remote = new Pool({ connectionString: remoteUrl.toString(), max: 1, connectionTimeoutMillis: 15_000 });
const source = await local.connect();
let destination;

try {
  destination = await remote.connect();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const [sourceData, sourceOwners] = await Promise.all([readFinance(source), readOwners(source)]);
  const destinationData = await readFinance(destination);
  const destinationOwners = await readOwners(destination);

  let alreadyMigrated = false;
  if (destinationData.movements.length > 0) {
    if (isDeepStrictEqual(destinationData, sourceData)) {
      console.log('Supabase ya contiene los mismos datos; no se modificó nada.');
      alreadyMigrated = true;
    } else {
      throw new Error('Supabase ya tiene movimientos distintos. Se cancela para proteger esos datos.');
    }
  }
  if (!alreadyMigrated && destinationOwners.length === 0 && sourceOwners.length !== 1) {
    throw new Error('No hay exactamente un propietario local para copiar. Crea o revisa el propietario primero.');
  }

  if (!alreadyMigrated) {
    console.log(`Origen local: ${sourceData.accounts.length} cuentas, ${sourceData.categories.length} rubros, ${sourceData.movements.length} movimientos.`);
    console.log(`Destino Supabase: ${destinationData.categories.length} rubros iniciales, 0 movimientos.`);
    const confirmation = await promptConfirmation('Esto reemplazará los rubros iniciales y saldos vacíos de Supabase. Escribe MIGRAR DATOS para continuar: ');
    if (confirmation !== 'MIGRAR DATOS') throw new Error('Migración cancelada; Supabase no fue modificado.');

    await destination.query('BEGIN');
    try {
      await destination.query('LOCK TABLE public.accounts, public.categories, public.movements, public.owner_credentials IN SHARE ROW EXCLUSIVE MODE');
      const currentData = await readFinance(destination);
      const currentOwners = await readOwners(destination);
      if (!isDeepStrictEqual(currentData, destinationData) || !isDeepStrictEqual(currentOwners, destinationOwners)) {
        throw new Error('Supabase cambió durante la confirmación. No se aplicó la migración; vuelve a revisar el destino.');
      }
      if (currentData.movements.length !== 0) throw new Error('Supabase ya recibió movimientos. No se reemplazaron.');

      await destination.query('DELETE FROM public.categories');
      await insertRows(destination, 'accounts', ['account_key', 'name', 'opening_balance'], sourceData.accounts,
        'ON CONFLICT (account_key) DO UPDATE SET name = EXCLUDED.name, opening_balance = EXCLUDED.opening_balance');
      await insertRows(destination, 'categories', ['id', 'name', 'kind', 'active', 'created_at'], sourceData.categories);
      await insertRows(destination, 'movements', ['id', 'movement_date', 'kind', 'amount', 'category_id', 'account_key', 'to_account_key', 'note', 'created_at'], sourceData.movements);

      if (currentOwners.length === 0) {
        await insertRows(destination, 'owner_credentials', ['singleton', 'username', 'password_hash', 'created_at'], sourceOwners);
      }

      const verifiedData = await readFinance(destination);
      const verifiedOwners = await readOwners(destination);
      if (!isDeepStrictEqual(verifiedData, sourceData)) throw new Error('Los datos importados no coinciden con el origen; se revierte la transacción.');
      if (verifiedOwners.length !== 1) throw new Error('No se verificó el propietario; se revierte la transacción.');

      await destination.query('COMMIT');
    } catch (error) {
      await destination.query('ROLLBACK');
      throw error;
    }

    console.log(`Migración verificada: ${sourceData.categories.length} rubros y ${sourceData.movements.length} movimientos. Los saldos iniciales y el propietario quedaron preservados.`);
    console.log('No se copiaron sesiones activas. Inicia sesión otra vez en la app con tu usuario y contraseña actuales.');
  }
} finally {
  await source.query('ROLLBACK').catch(() => undefined);
  source.release();
  destination?.release();
  await Promise.all([local.end(), remote.end()]);
}

async function readFinance(client) {
  const [accounts, categories, movements] = await Promise.all([
    client.query(`SELECT account_key, name, opening_balance::text AS opening_balance
      FROM public.accounts ORDER BY account_key`),
    client.query(`SELECT id, name, kind, active,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
      FROM public.categories ORDER BY id`),
    client.query(`SELECT id, movement_date::text AS movement_date, kind, amount::text AS amount,
        category_id, account_key, to_account_key, note,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at
      FROM public.movements ORDER BY id`),
  ]);
  return { accounts: accounts.rows, categories: categories.rows, movements: movements.rows };
}

async function readOwners(client) {
  const { rows } = await client.query(`SELECT singleton, username, password_hash, created_at
    FROM public.owner_credentials ORDER BY singleton`);
  return rows;
}

async function insertRows(client, table, columns, rows, conflict = '') {
  if (rows.length === 0) return;
  const values = [];
  const placeholders = rows.map((row, rowIndex) => `(${columns.map((column, columnIndex) => {
    values.push(row[column]);
    return `$${rowIndex * columns.length + columnIndex + 1}`;
  }).join(', ')})`);
  await client.query(`INSERT INTO public.${table} (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ${conflict}`, values);
}
