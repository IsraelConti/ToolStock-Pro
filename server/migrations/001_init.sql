CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS records (
  account_id TEXT NOT NULL REFERENCES accounts(id),
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  revision BIGINT NOT NULL,
  PRIMARY KEY (account_id, collection, record_id)
);

CREATE INDEX IF NOT EXISTS records_account_revision ON records (account_id, revision);

CREATE TABLE IF NOT EXISTS account_settings (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  payload JSONB NOT NULL,
  revision BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_play (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  purchase_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS account_play_unique_receipt ON account_play (purchase_token);
