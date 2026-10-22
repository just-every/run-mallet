-- GOV-004 strong authentication. Local credentials and proofs; never archived.
CREATE TABLE mallet_auth_policy (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), require_all INTEGER NOT NULL CHECK(require_all IN (0,1)),
 version INTEGER NOT NULL, updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE mallet_factors (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('totp','passkey')), label TEXT NOT NULL,
 secret_box TEXT, last_step INTEGER, credential_id TEXT UNIQUE, public_key TEXT, sign_count INTEGER,
 created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER
);
CREATE INDEX mallet_factors_operator ON mallet_factors(operator_id,revoked_at);
CREATE TABLE mallet_totp_pending (operator_id TEXT PRIMARY KEY, secret_box TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE mallet_recovery_codes (
 code_hash TEXT PRIMARY KEY, operator_id TEXT NOT NULL, created_at INTEGER NOT NULL, used_at INTEGER
);
CREATE INDEX mallet_recovery_codes_operator ON mallet_recovery_codes(operator_id,used_at);
-- One row per signed-in session: the second factor that opened it and the latest fresh proof.
CREATE TABLE mallet_session_proofs (
 session_id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, method TEXT NOT NULL, proven_at INTEGER NOT NULL, step_up_until INTEGER NOT NULL
);
CREATE INDEX mallet_session_proofs_operator ON mallet_session_proofs(operator_id);
CREATE TABLE mallet_auth_challenges (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, session_id TEXT NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('register','assert')),
 challenge TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE TABLE mallet_rate (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL);
-- A booking manage link can now be revoked by staff; it also lapses a day after its appointment ends.
ALTER TABLE mallet_booking_tokens ADD COLUMN revoked_at INTEGER;
