CREATE TABLE IF NOT EXISTS bank_glm_token_budget(id INTEGER PRIMARY KEY CHECK(id=1),reserved INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO bank_glm_token_budget(id,reserved) VALUES(1,0);
