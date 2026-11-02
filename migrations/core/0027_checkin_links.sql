-- Only hashes of per-customer invitation tokens are retained; never archived.
CREATE TABLE mallet_checkin_links (
 request_id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE
);
