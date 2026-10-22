-- GOV-005: provider secrets saved, rotated and revoked inside Mallet. Sealed values, never archived.
CREATE TABLE mallet_connector_secrets (
 connector TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('active','revoked')), version INTEGER NOT NULL,
 sealed TEXT, fingerprint TEXT, declaration_version INTEGER NOT NULL, changed_by TEXT NOT NULL, changed_at INTEGER NOT NULL,
 PRIMARY KEY(connector,name)
);
