CREATE TABLE IF NOT EXISTS monthly_budgets (
  month_start date PRIMARY KEY CHECK (EXTRACT(DAY FROM month_start) = 1),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
