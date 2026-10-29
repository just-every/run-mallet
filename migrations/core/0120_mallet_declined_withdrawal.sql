-- Destination-local withdrawal capability; portable message history grants no access.
CREATE TABLE mallet_declined_withdrawal_tokens (
 token_hash TEXT PRIMARY KEY,
 consent_id TEXT NOT NULL,
 outreach_id TEXT NOT NULL
);
