ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_key_check;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS start_date date;

UPDATE accounts
SET account_type = CASE WHEN account_key = 'cash' THEN 'cash' ELSE 'bank' END
WHERE account_type IS NULL;

UPDATE accounts SET start_date = DATE '1900-01-01' WHERE start_date IS NULL;
ALTER TABLE accounts ALTER COLUMN account_type SET DEFAULT 'bank';
ALTER TABLE accounts ALTER COLUMN account_type SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN start_date SET DEFAULT DATE '1900-01-01';
ALTER TABLE accounts ALTER COLUMN start_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounts_account_type_check'
      AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts ADD CONSTRAINT accounts_account_type_check CHECK (account_type IN ('cash', 'bank'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_single_cash_idx ON accounts (account_type) WHERE account_type = 'cash';
