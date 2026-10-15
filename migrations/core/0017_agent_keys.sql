CREATE TABLE mallet_agent_keys (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
 created_by TEXT NOT NULL, creator_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL, revoked_at INTEGER, created_at INTEGER NOT NULL
);
