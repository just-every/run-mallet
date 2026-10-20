-- EST-006 reminder emails each carry a fresh token for the same approval link. Only SHA-256 hashes are
-- stored; like mallet_approval_links this credential table is excluded from archives.
CREATE TABLE mallet_approval_reminder_tokens (
 token_hash TEXT PRIMARY KEY, link_id TEXT NOT NULL, created_at TEXT NOT NULL
);
