-- Installation-local endpoint and signing authority never enters a portable archive.
CREATE TABLE mallet_webhook_authority (
 id TEXT PRIMARY KEY,
 endpoint TEXT NOT NULL,
 sealed TEXT NOT NULL,
 key_version INTEGER NOT NULL,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL
);
