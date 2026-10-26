-- Installation-local link and send authority never travel with product archives.
CREATE TABLE mallet_review_tokens (
 request_id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 job_id TEXT NOT NULL
);
CREATE TABLE mallet_review_authority (
 consent_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL
);
