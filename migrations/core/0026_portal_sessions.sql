-- Customer credentials are installation-local and excluded from portable archives.
CREATE TABLE mallet_portal_tokens (
 token_hash TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('link','session')),
 account_id TEXT NOT NULL,
 contact_id TEXT NOT NULL,
 account_revision INTEGER NOT NULL,
 contact_version INTEGER NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER
);
CREATE INDEX mallet_portal_tokens_contact ON mallet_portal_tokens(contact_id,created_at);
CREATE TABLE mallet_portal_requests (
 key TEXT PRIMARY KEY,
 window INTEGER NOT NULL,
 count INTEGER NOT NULL
);
