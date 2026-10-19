import cookieParser from 'cookie-parser';
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
        pool.query('SELECT account_key, opening_balance FROM accounts'),
      ]);
      response.json({
        categories: categories.rows,
        movements: movements.rows.map((row) => ({ ...row, amount: Number(row.amount) })),
        opening: Object.fromEntries(accounts.rows.map((row) => [row.account_key, Number(row.opening_balance)])),
      });
    } catch (error) { next(error); }
  });

  app.post('/api/movements', async (request, response, next) => {
    try {
      const row = normalizeMovement(request.body);
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

  app.put('/api/accounts/:key', async (request, response, next) => {
    try {
      const key = request.params.key;
      const openingBalance = Number(request.body.openingBalance);
      if (!['cash', 'bank'].includes(key) || !Number.isFinite(openingBalance)) return response.status(400).json({ error: 'Saldo inicial inválido.' });
      await pool.query('UPDATE accounts SET opening_balance=$1 WHERE account_key=$2', [openingBalance, key]);
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
  if (kind === 'income' && (!categoryId || account || !['cash', 'bank'].includes(toAccount ?? ''))) throw new Error('Ingreso incompleto.');
  if (kind === 'expense' && (!categoryId || !['cash', 'bank'].includes(account ?? '') || toAccount)) throw new Error('Gasto incompleto.');
  if (kind === 'transfer' && (categoryId || !['cash', 'bank'].includes(account ?? '') || !['cash', 'bank'].includes(toAccount ?? '') || account === toAccount)) throw new Error('Transferencia inválida.');
  return { date, kind, amount, categoryId, account, toAccount, note };
}
