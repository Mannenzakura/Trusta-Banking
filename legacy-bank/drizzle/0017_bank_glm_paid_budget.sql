CREATE TABLE IF NOT EXISTS bank_glm_paid_budget (id INTEGER PRIMARY KEY CHECK(id=1), reserved_fen INTEGER NOT NULL DEFAULT 0 CHECK(reserved_fen BETWEEN 0 AND 100));
INSERT OR IGNORE INTO bank_glm_paid_budget(id,reserved_fen) VALUES(1,0);
