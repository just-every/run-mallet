CREATE TABLE mallet_coverage_mail_authority (
 notice_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL
);
CREATE TABLE mallet_coverage_reply_tokens (
 notice_id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL UNIQUE,
 job_id TEXT NOT NULL
);
CREATE TABLE mallet_coverage_consent_authority (
 consent_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL
);
