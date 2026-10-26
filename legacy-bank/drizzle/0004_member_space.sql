CREATE TABLE members(id TEXT PRIMARY KEY,name TEXT NOT NULL,phone TEXT NOT NULL,salt TEXT NOT NULL,code_hash TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,profile TEXT NOT NULL DEFAULT '{}',UNIQUE(name,phone));
CREATE TABLE member_sessions(hash TEXT PRIMARY KEY,member_id TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE member_posts(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE member_files(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,data TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX member_posts_date ON member_posts(created_at);
CREATE INDEX member_sessions_owner ON member_sessions(member_id);
