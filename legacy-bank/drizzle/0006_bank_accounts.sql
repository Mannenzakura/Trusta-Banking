CREATE TABLE IF NOT EXISTS bank_accounts (
 id TEXT PRIMARY KEY,
 state TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 migration_source TEXT UNIQUE,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bank_account_sessions (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES bank_accounts(id),
 expires INTEGER NOT NULL,
 unlock_until INTEGER NOT NULL DEFAULT 0,
 credential_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS bank_account_session_expiry ON bank_account_sessions(expires);
