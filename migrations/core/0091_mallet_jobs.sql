/* Durable business jobs contain identifiers/outcomes only, never mail bodies or credentials. */
CREATE TABLE mallet_jobs (
 id TEXT PRIMARY KEY,
 event_key TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('approval-reminder','stripe-payment-check')),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 due_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','leased','dispatching','succeeded','failed','uncertain','resolved')),
 lease_token TEXT,
 lease_until INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 dispatched_at INTEGER,
 outcome TEXT CHECK(outcome IS NULL OR json_valid(outcome)),
 projected_at INTEGER,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX mallet_jobs_due ON mallet_jobs(status,due_at,id);
CREATE INDEX mallet_jobs_leases ON mallet_jobs(status,lease_until);
CREATE TABLE mallet_job_recoveries (
 id TEXT PRIMARY KEY,
 job_id TEXT NOT NULL REFERENCES mallet_jobs(id),
 action TEXT NOT NULL CHECK(action IN ('replay','resolve')),
 actor_json TEXT NOT NULL CHECK(json_valid(actor_json)),
 reason TEXT NOT NULL,
 previous_outcome TEXT,
 previous_attempts INTEGER,
 at INTEGER NOT NULL
);
