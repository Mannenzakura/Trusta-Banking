CREATE TABLE IF NOT EXISTS bank_duffel_test (id TEXT PRIMARY KEY, owner TEXT NOT NULL, offer TEXT NOT NULL, status TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL, UNIQUE(owner,offer));
CREATE INDEX IF NOT EXISTS bank_duffel_owner ON bank_duffel_test(owner,created);
