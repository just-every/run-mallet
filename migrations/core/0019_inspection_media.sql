-- Private inspection media. Provenance is a snapshot, never an identity grant.
-- These product tables are included by native portability; no identity foreign keys.
CREATE TABLE mallet_media_findings (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL,
 client_id TEXT NOT NULL,
 title TEXT NOT NULL,
 captured_at TEXT NOT NULL,
 created_at TEXT NOT NULL,
 actor_json TEXT NOT NULL CHECK(json_valid(actor_json)),
 request_json TEXT NOT NULL CHECK(json_valid(request_json)),
 UNIQUE(job_id,client_id)
);
CREATE INDEX mallet_media_findings_job ON mallet_media_findings(job_id,created_at,id);
CREATE TABLE mallet_media_uploads (
 id TEXT PRIMARY KEY,
 finding_id TEXT NOT NULL REFERENCES mallet_media_findings(id),
 job_id TEXT NOT NULL,
 variant TEXT NOT NULL CHECK(variant IN ('original','shared')),
 original_id TEXT REFERENCES mallet_media_uploads(id),
 filename TEXT NOT NULL,
 mime TEXT NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
 size INTEGER NOT NULL CHECK(size>0 AND size<=33554432 AND (mime NOT LIKE 'image/%' OR size<=8388608)),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 captured_at TEXT NOT NULL,
 received_at TEXT NOT NULL,
 actor_json TEXT NOT NULL CHECK(json_valid(actor_json)),
 annotations_json TEXT CHECK(annotations_json IS NULL OR json_valid(annotations_json)),
 request_json TEXT NOT NULL CHECK(json_valid(request_json)),
 complete INTEGER NOT NULL DEFAULT 0 CHECK(complete IN (0,1)),
 completed_at TEXT,
 CHECK((variant='original' AND original_id IS NULL AND annotations_json IS NULL) OR (variant='shared' AND original_id IS NOT NULL)),
 CHECK((complete=0 AND completed_at IS NULL) OR (complete=1 AND completed_at IS NOT NULL)),
 UNIQUE(finding_id,variant,sha256)
);
CREATE INDEX mallet_media_uploads_job ON mallet_media_uploads(job_id,finding_id,received_at,id);
CREATE TABLE mallet_media_upload_clients (
 finding_id TEXT NOT NULL REFERENCES mallet_media_findings(id),
 client_id TEXT NOT NULL,
 upload_id TEXT NOT NULL REFERENCES mallet_media_uploads(id),
 PRIMARY KEY(finding_id,client_id)
);
CREATE TABLE mallet_media_chunks (
 upload_id TEXT NOT NULL REFERENCES mallet_media_uploads(id),
 ordinal INTEGER NOT NULL CHECK(ordinal>=0 AND ordinal<512),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 byte_length INTEGER NOT NULL CHECK(byte_length>0 AND byte_length<=65536),
 base64 TEXT NOT NULL CHECK(length(base64)<=87384),
 PRIMARY KEY(upload_id,ordinal)
);
