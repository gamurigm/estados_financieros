import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no está configurado.');

const pool = new Pool({ connectionString });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const directory = resolve('db', 'migrations');
  const migrations = (await readdir(directory))
    .filter((name) => /^\d+-[a-z0-9-]+\.sql$/i.test(name))
    .sort();
  let applied = 0;

  for (const name of migrations) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [874231901]);
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (existing.rowCount) {
        await client.query('COMMIT');
        continue;
      }

      const sql = await readFile(resolve(directory, name), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      applied += 1;
      console.log(`Aplicada: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  if (applied === 0) console.log('No hay migraciones pendientes.');
} finally {
  await pool.end();
}
