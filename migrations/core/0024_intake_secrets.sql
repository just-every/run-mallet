-- Temporary unlock material never enters product archives or audit payloads.
CREATE TABLE mallet_intake_secrets (
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL, purpose TEXT NOT NULL,
 expires_at TEXT NOT NULL, cipher TEXT NOT NULL, iv TEXT NOT NULL
);
CREATE INDEX mallet_intake_secrets_expiry ON mallet_intake_secrets(expires_at);
