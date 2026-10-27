-- Destination-local expanded authority never travels with historical grant records.
CREATE TABLE mallet_assistant_keys (
 grant_id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL
);
