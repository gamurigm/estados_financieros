CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  account_key text PRIMARY KEY CHECK (account_key IN ('cash', 'bank')),
  name text NOT NULL,
  opening_balance numeric(14, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income', 'expense')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income', 'expense', 'transfer')),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  account_key text REFERENCES accounts(account_key),
  to_account_key text REFERENCES accounts(account_key),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'income' AND category_id IS NOT NULL AND account_key IS NULL AND to_account_key IS NOT NULL) OR
    (kind = 'expense' AND category_id IS NOT NULL AND account_key IS NOT NULL AND to_account_key IS NULL) OR
    (kind = 'transfer' AND category_id IS NULL AND account_key IS NOT NULL AND to_account_key IS NOT NULL AND account_key <> to_account_key)
  )
);

INSERT INTO accounts (account_key, name) VALUES
  ('cash', 'Efectivo'),
  ('bank', 'Banco / débito')
ON CONFLICT (account_key) DO NOTHING;

INSERT INTO categories (name, kind) VALUES
  ('Cuota', 'income'),
  ('Clases', 'income'),
  ('Trabajos de terceros', 'income'),
  ('Pasantías / remoto', 'income'),
  ('Pasajes / transporte', 'expense'),
  ('Comida', 'expense'),
  ('Snacks', 'expense'),
  ('Vestimenta', 'expense'),
  ('Aseo personal', 'expense'),
  ('Papelería', 'expense'),
  ('Gastos varios', 'expense'),
  ('Trámites', 'expense'),
  ('Compras casa', 'expense'),
  ('Cuidado personal', 'expense'),
  ('Devolución préstamos', 'expense'),
  ('Extra', 'expense'),
  ('IA', 'expense'),
  ('Préstamos', 'expense'),
  ('Wifi', 'expense'),
  ('Equipos técnicos', 'expense'),
  ('Recarga datos', 'expense'),
  ('Vacunas U', 'expense')
ON CONFLICT (kind, name) DO NOTHING;
