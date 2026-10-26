CREATE TABLE IF NOT EXISTS bank_demo_sessions (
 id TEXT PRIMARY KEY,
 state TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bank_demo_expiry ON bank_demo_sessions(expires);
