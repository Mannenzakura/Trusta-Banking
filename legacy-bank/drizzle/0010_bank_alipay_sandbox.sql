CREATE TABLE IF NOT EXISTS bank_alipay_sandbox (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount=100),
 status TEXT NOT NULL CHECK(status IN ('created','pending','paid','refunding','refunded','closed')),
 refund_id TEXT,
 created INTEGER NOT NULL,
 updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bank_alipay_sandbox_owner ON bank_alipay_sandbox(owner,created);
CREATE INDEX IF NOT EXISTS bank_alipay_sandbox_created ON bank_alipay_sandbox(created);
