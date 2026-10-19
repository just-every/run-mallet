-- EST-003 estimate approval links. Only the SHA-256 of each token is stored; like agent keys and
-- DIAG-001 links this credential table is excluded from archives (restores keep decisions, not access).
CREATE TABLE mallet_approval_links (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, estimate_id TEXT NOT NULL, created_at TEXT NOT NULL
);
