-- Observations and original bytes stay immutable; resolution is separate evidence.
CREATE TABLE mallet_media_resolutions (
 finding_id TEXT PRIMARY KEY REFERENCES mallet_media_findings(id),
 job_id TEXT NOT NULL,
 reason TEXT NOT NULL,
 actor_json TEXT NOT NULL,
 resolved_at TEXT NOT NULL,
 request_json TEXT NOT NULL
);
CREATE INDEX mallet_media_resolutions_job ON mallet_media_resolutions(job_id);
