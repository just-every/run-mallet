-- Local standing mail authority is excluded from archives; evidence remains product data.
CREATE TABLE mallet_report_schedules (
 filter_id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 owner_version INTEGER NOT NULL,
 email TEXT NOT NULL,
 due_at TEXT NOT NULL,
 every_days INTEGER NOT NULL,
 consent_at TEXT NOT NULL
);
