-- Existing custody stays intact; these counters start here without inventing
-- earlier audit history. Defaulted columns preserve additive archive recovery.
ALTER TABLE mallet_media_findings ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0);
ALTER TABLE mallet_media_uploads ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0);
