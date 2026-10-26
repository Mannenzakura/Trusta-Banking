CREATE TABLE IF NOT EXISTS bank_commerce_sandbox (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('voucher','goods')), amount INTEGER NOT NULL CHECK(amount>0 AND amount<=100000),
 destination TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
 created INTEGER NOT NULL, updated INTEGER NOT NULL, paid_at INTEGER, refunded_at INTEGER,
 trade_no TEXT, refund_id TEXT
);
CREATE INDEX IF NOT EXISTS bank_commerce_owner ON bank_commerce_sandbox(owner,created);
CREATE INDEX IF NOT EXISTS bank_commerce_created ON bank_commerce_sandbox(created);
