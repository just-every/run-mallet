-- Installation-local review scheduling permission; excluded from archives.
CREATE TABLE mallet_coverage_authority (
 review_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL
);
