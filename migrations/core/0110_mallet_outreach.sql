-- Installation-local approval is deliberately excluded from owner archives.
CREATE TABLE mallet_outreach_authority (
 outreach_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL
);
CREATE TABLE mallet_booking_reminder_tokens (
 token_hash TEXT PRIMARY KEY,
 appointment_id TEXT NOT NULL
);
