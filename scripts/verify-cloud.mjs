import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { loadCloudConfig, readEnvFile, runLocalQuery, runSshQuery, validateCloudConfig } from './backup-common.mjs';

const verificationQuery = `
WITH latest AS (
  SELECT max(movement_date) AS movement_date FROM movements
), balances AS (
  SELECT a.account_key,
         a.opening_balance + COALESCE(sum(CASE
           WHEN m.kind = 'income' AND m.to_account_key = a.account_key THEN m.amount
           WHEN m.kind = 'expense' AND m.account_key = a.account_key THEN -m.amount
           WHEN m.kind = 'transfer' AND m.to_account_key = a.account_key THEN m.amount
           WHEN m.kind = 'transfer' AND m.account_key = a.account_key THEN -m.amount
           ELSE 0
         END), 0) AS balance
  FROM accounts a
  LEFT JOIN movements m ON m.movement_date <= (SELECT movement_date FROM latest)
  GROUP BY a.account_key, a.opening_balance
)
SELECT jsonb_build_object(
  'categories', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id::text, 'name', name, 'kind', kind, 'active', active) ORDER BY kind, name, id)
    FROM categories
  ), '[]'::jsonb),
  'accounts', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('key', account_key, 'openingBalance', opening_balance::text) ORDER BY account_key)
    FROM accounts
  ), '[]'::jsonb),
  'movementCount', (SELECT count(*) FROM movements),
  'latestDate', (SELECT to_char(movement_date, 'YYYY-MM-DD') FROM latest),
  'balanceThroughLatest', COALESCE((
    SELECT jsonb_object_agg(account_key, balance::text) FROM balances
  ), '{}'::jsonb)
)::text;
`;

export function compareFinanceSnapshots(source, destination) {
  const differences = [];
  if (!isDeepStrictEqual(sortRows(source.categories, ['kind', 'name', 'id']), sortRows(destination.categories, ['kind', 'name', 'id']))) differences.push('rubros');
  if (!isDeepStrictEqual(sortRows(normalizeAccounts(source.accounts), ['key']), sortRows(normalizeAccounts(destination.accounts), ['key']))) differences.push('saldos iniciales');
  if (Number(source.movementCount) !== Number(destination.movementCount)) differences.push('cantidad de movimientos');
  if (source.latestDate !== destination.latestDate) differences.push('última fecha');
  if (!isDeepStrictEqual(normalizeBalances(source.balanceThroughLatest), normalizeBalances(destination.balanceThroughLatest))) differences.push('saldos calculados');
  return { matches: differences.length === 0, differences, latestDate: source.latestDate };
}

export async function verifyCloud(options = {}) {
  const config = validateCloudConfig(await (options.getConfig ?? loadCloudConfig)());
  const env = await (options.readLocalEnv ?? (() => readEnvFile('.env')))();
  if (!env.POSTGRES_USER || !env.POSTGRES_DB) throw new Error('Configura PostgreSQL local con npm run db:up.');
  const query = options.query ?? runLocalQuery;
  const localText = await query(['compose', 'exec', '-T', 'db', 'psql', '-X', '-A', '-t', '-q', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB], verificationQuery);
  const local = JSON.parse(localText.trim());
  const remoteText = await (options.queryRemote ?? runSshQuery)(config, verificationQuery);
  const remote = JSON.parse(remoteText.trim());
  const result = compareFinanceSnapshots(local, remote);
  if (!result.matches) throw new Error(`Verificación falló: ${result.differences.join(', ')} no coinciden.`);
  console.log(`Verificación correcta: rubros, cuentas, ${local.movementCount} movimientos y saldos hasta ${result.latestDate ?? 'sin movimientos'}.`);
  return result;
}

function normalizeAccounts(accounts) {
  return accounts.map((account) => ({ key: account.key, openingBalance: normalizeAmount(account.openingBalance) }));
}

function normalizeBalances(balances) {
  return Object.fromEntries(Object.entries(balances).map(([key, amount]) => [key, normalizeAmount(amount)]).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : String(value);
}

function sortRows(rows, keys) {
  return [...rows].sort((left, right) => {
    for (const key of keys) {
      const result = String(left[key]).localeCompare(String(right[key]));
      if (result) return result;
    }
    return 0;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyCloud();
}
