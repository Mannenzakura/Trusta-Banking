CREATE INDEX IF NOT EXISTS bank_account_due ON bank_accounts(json_extract(state,'$.nextWake'));
CREATE INDEX IF NOT EXISTS bank_demo_due ON bank_demo_sessions(json_extract(state,'$.nextWake'));
