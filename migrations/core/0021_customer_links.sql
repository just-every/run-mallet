-- DIAG-001 customer inspection links. Only the SHA-256 of each link token is stored, and like
-- agent keys this credential table is excluded from archives: a restore keeps link history, not access.
CREATE TABLE mallet_customer_links (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, job_id TEXT NOT NULL, created_at TEXT NOT NULL
);
