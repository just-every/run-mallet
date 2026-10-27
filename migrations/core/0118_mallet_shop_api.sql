-- Installation-local authority and retry receipts never travel in product archives.
CREATE TABLE mallet_api_clients (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 label TEXT NOT NULL,
 scopes TEXT NOT NULL CHECK(json_valid(scopes) AND json_type(scopes)='array'),
 created_by TEXT NOT NULL,
 creator_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 revoked_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE TABLE mallet_api_requests (
 client_id TEXT NOT NULL,
 request_key TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 response TEXT NOT NULL CHECK(json_valid(response)),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(client_id,request_key)
);
