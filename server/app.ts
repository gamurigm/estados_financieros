import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import express from 'express';
import type { Pool } from 'pg';
import { createAuthRouter } from './auth.js';
import type { AuthStore } from './auth-store.js';
import { requireAuth } from './auth-middleware.js';

export function createApp(pool: Pool, authStore: AuthStore) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_request, response) => {
    try {
      await pool.query('SELECT 1');
      response.json({ status: 'ok' });
    } catch {
      response.status(503).json({ error: 'PostgreSQL no está disponible.' });
    }
  });

  app.use('/api/auth', createAuthRouter(authStore));
  app.use('/api', requireAuth(authStore));

  app.get('/api/state', async (_request, response, next) => {
    try {
      const [categories, movements, accounts] = await Promise.all([
        pool.query('SELECT id, name, kind, active FROM categories ORDER BY kind, name'),
        pool.query(`SELECT id, to_char(movement_date, 'YYYY-MM-DD') AS date, kind, amount, category_id AS "categoryId", account_key AS account, to_account_key AS "toAccount", note FROM movements ORDER BY movement_date, created_at`),
        pool.query(`SELECT account_key, name, account_type, opening_balance,
          to_char(start_date, 'YYYY-MM-DD') AS start_date
          FROM accounts ORDER BY CASE WHEN account_type = 'cash' THEN 0 ELSE 1 END, name`),
      ]);
      const accountRows = accounts.rows as Array<{ account_key: string; name: string; account_type: 'cash' | 'bank'; opening_balance: string | number; start_date: string }>;
      response.json({
        categories: categories.rows,
        movements: movements.rows.map((row) => ({ ...row, amount: Number(row.amount) })),
        accounts: accountRows.map((row) => ({
          id: row.account_key,
          name: row.name,
          kind: row.account_type,
          openingBalance: Number(row.opening_balance),
          startDate: row.start_date,
        })),
        opening: Object.fromEntries(accountRows.map((row) => [row.account_key, Number(row.opening_balance)])),
      });
    } catch (error) { next(error); }
  });

  app.get('/api/budgets/:month', async (request, response, next) => {
    try {
      const monthStart = normalizeBudgetMonth(request.params.month);
      if (!monthStart) return response.status(400).json({ error: 'El mes debe tener formato AAAA-MM.' });
      const { rows } = await pool.query(
        `SELECT to_char(month_start, 'YYYY-MM') AS month, amount
         FROM monthly_budgets WHERE month_start=$1::date`,
        [monthStart],
      );
      response.json(rows[0] ? { month: rows[0].month, amount: Number(rows[0].amount) } : null);
    } catch (error) { next(error); }
  });

  app.put('/api/budgets/:month', async (request, response, next) => {
    try {
      const monthStart = normalizeBudgetMonth(request.params.month);
      if (!monthStart) return response.status(400).json({ error: 'El mes debe tener formato AAAA-MM.' });
      const amount = normalizeBudgetAmount(request.body?.amount);
      if (amount === null) return response.status(400).json({ error: 'El presupuesto debe ser mayor que cero y tener hasta dos decimales.' });
      const { rows } = await pool.query(
        `INSERT INTO monthly_budgets (month_start, amount) VALUES ($1::date, $2)
         ON CONFLICT (month_start) DO UPDATE SET amount=EXCLUDED.amount, updated_at=now()
         RETURNING to_char(month_start, 'YYYY-MM') AS month, amount`,
        [monthStart, amount],
      );
      response.json({ month: rows[0].month, amount: Number(rows[0].amount) });
    } catch (error) { next(error); }
  });

  app.delete('/api/budgets/:month', async (request, response, next) => {
    try {
      const monthStart = normalizeBudgetMonth(request.params.month);
      if (!monthStart) return response.status(400).json({ error: 'El mes debe tener formato AAAA-MM.' });
      await pool.query('DELETE FROM monthly_budgets WHERE month_start=$1::date', [monthStart]);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.post('/api/movements', async (request, response, next) => {
    try {
      const row = normalizeMovement(request.body);
      await ensureAccountsExist(pool, row);
      const { rows } = await pool.query(
        `INSERT INTO movements (movement_date, kind, amount, category_id, account_key, to_account_key, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, to_char(movement_date, 'YYYY-MM-DD') AS date, kind, amount, category_id AS "categoryId", account_key AS account, to_account_key AS "toAccount", note`,
        [row.date, row.kind, row.amount, row.categoryId, row.account, row.toAccount, row.note],
      );
      response.status(201).json({ ...rows[0], amount: Number(rows[0].amount) });
    } catch (error) { next(error); }
  });

  app.put('/api/movements/:id', async (request, response, next) => {
    try {
      const row = normalizeMovement(request.body);
      await ensureAccountsExist(pool, row);
      const { rows } = await pool.query(
        `UPDATE movements SET movement_date=$1, kind=$2, amount=$3, category_id=$4, account_key=$5, to_account_key=$6, note=$7
         WHERE id=$8
         RETURNING id, to_char(movement_date, 'YYYY-MM-DD') AS date, kind, amount, category_id AS "categoryId", account_key AS account, to_account_key AS "toAccount", note`,
        [row.date, row.kind, row.amount, row.categoryId, row.account, row.toAccount, row.note, request.params.id],
      );
      if (!rows[0]) return response.status(404).json({ error: 'Movimiento no encontrado.' });
      response.json({ ...rows[0], amount: Number(rows[0].amount) });
    } catch (error) { next(error); }
  });

  app.delete('/api/movements/:id', async (request, response, next) => {
    try {
      await pool.query('DELETE FROM movements WHERE id=$1', [request.params.id]);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.put('/api/categories', async (request, response, next) => {
    const client = await pool.connect();
    try {
      if (!Array.isArray(request.body)) return response.status(400).json({ error: 'Lista de rubros inválida.' });
      await client.query('BEGIN');
      for (const category of request.body) {
        if (category.id) {
          await client.query(
            `INSERT INTO categories (id, name, kind, active) VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active`,
            [category.id, category.name, category.kind, category.active],
          );
        } else {
          await client.query('INSERT INTO categories (name, kind, active) VALUES ($1, $2, $3)', [category.name, category.kind, category.active]);
        }
      }
      await client.query('COMMIT');
      response.status(204).end();
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally { client.release(); }
  });

  app.post('/api/accounts', async (request, response, next) => {
    try {
      const name = normalizeAccountName(request.body?.name);
      const openingBalance = Number(request.body?.openingBalance);
      const startDate = request.body?.startDate == null ? null : String(request.body.startDate);
      if (!Number.isFinite(openingBalance) || (startDate !== null && !isDateString(startDate))) {
        return response.status(400).json({ error: 'Datos de cuenta inválidos.' });
      }
      const { rows } = await pool.query(
        `INSERT INTO accounts (account_key, name, opening_balance, account_type, start_date)
         VALUES ($1, $2, $3, 'bank', COALESCE($4::date, CURRENT_DATE))
         RETURNING account_key AS id, name, account_type AS kind, opening_balance AS "openingBalance",
                   to_char(start_date, 'YYYY-MM-DD') AS "startDate"`,
        [randomUUID(), name, openingBalance, startDate],
      );
      const account = rows[0];
      response.status(201).json({ ...account, openingBalance: Number(account.openingBalance) });
    } catch (error) { next(error); }
  });

  app.put('/api/accounts/:key', async (request, response, next) => {
    try {
      const key = request.params.key;
      const openingBalance = Number(request.body.openingBalance);
      const name = request.body.name == null ? null : normalizeAccountName(request.body.name);
      if (!isAccountKey(key) || !Number.isFinite(openingBalance)) return response.status(400).json({ error: 'Saldo inicial inválido.' });
      const { rowCount } = await pool.query(
        `UPDATE accounts SET opening_balance=$1,
           name=CASE WHEN account_type='bank' AND $2::text IS NOT NULL THEN $2 ELSE name END
         WHERE account_key=$3`,
        [openingBalance, name, key],
      );
      if (!rowCount) return response.status(404).json({ error: 'Cuenta no encontrada.' });
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(400).json({ error: error instanceof Error ? error.message : 'No se pudo completar la operación.' });
  });

  return app;
}

function normalizeMovement(input: Record<string, unknown>) {
  const kind = input.kind;
  const amount = Number(input.amount);
  const date = String(input.date ?? '');
  const categoryId = input.categoryId ? String(input.categoryId) : null;
  const account = input.account ? String(input.account) : null;
  const toAccount = input.toAccount ? String(input.toAccount) : null;
  const note = String(input.note ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0) throw new Error('Fecha o monto inválido.');
  if (!['income', 'expense', 'transfer'].includes(String(kind))) throw new Error('Tipo de movimiento inválido.');
  if (kind === 'income' && (!categoryId || account || !isAccountKey(toAccount))) throw new Error('Ingreso incompleto.');
  if (kind === 'expense' && (!categoryId || !isAccountKey(account) || toAccount)) throw new Error('Gasto incompleto.');
  if (kind === 'transfer' && (categoryId || !isAccountKey(account) || !isAccountKey(toAccount) || account === toAccount)) throw new Error('Transferencia inválida.');
  return { date, kind, amount, categoryId, account, toAccount, note };
}

async function ensureAccountsExist(pool: Pool, movement: ReturnType<typeof normalizeMovement>) {
  const ids = [...new Set([movement.account, movement.toAccount].filter((id): id is string => id !== null))];
  const result = await pool.query('SELECT account_key FROM accounts WHERE account_key = ANY($1::text[])', [ids]);
  if (result.rows.length !== ids.length) throw new Error('Cuenta no encontrada.');
}

function normalizeAccountName(value: unknown) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 120) throw new Error('El nombre de la cuenta debe tener entre 1 y 120 caracteres.');
  return name;
}

function isAccountKey(value: string | null): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
}

function isDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeBudgetMonth(value: unknown) {
  const month = typeof value === 'string' ? value : '';
  return /^([1-9]\d{3})-(0[1-9]|1[0-2])$/.test(month) ? `${month}-01` : null;
}

function normalizeBudgetAmount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 999_999_999_999.99
    || !/^\d{1,12}(?:\.\d{1,2})?$/.test(String(value))) {
    return null;
  }
  return value;
}
