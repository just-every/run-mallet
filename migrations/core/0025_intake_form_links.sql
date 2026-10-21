-- Bearer credentials never travel with signed product records.
CREATE TABLE mallet_intake_form_links (
 form_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE
);
