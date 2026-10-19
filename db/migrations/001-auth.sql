CREATE TABLE IF NOT EXISTS owner_credentials (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash char(64) NOT NULL UNIQUE CHECK (access_token_hash ~ '^[a-f0-9]{64}$'),
  access_expires_at timestamptz NOT NULL,
  refresh_token_hash char(64) NOT NULL UNIQUE CHECK (refresh_token_hash ~ '^[a-f0-9]{64}$'),
  refresh_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_access_expiry_idx ON auth_sessions (access_expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_refresh_expiry_idx ON auth_sessions (refresh_expires_at);
