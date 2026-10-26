CREATE TABLE IF NOT EXISTS bank_flight_travelers(id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS flight_travelers_owner ON bank_flight_travelers(owner);
CREATE TABLE IF NOT EXISTS bank_flight_searches(id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS flight_searches_owner ON bank_flight_searches(owner);
