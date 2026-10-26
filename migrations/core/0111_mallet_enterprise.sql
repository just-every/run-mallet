-- Local identity authority is excluded from product archives.
CREATE TABLE mallet_enterprise_connections (
 provider TEXT PRIMARY KEY, issuer TEXT NOT NULL, client_id TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), revision INTEGER NOT NULL,
 token_hash TEXT, owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL,
 role TEXT NOT NULL CHECK(role='technician'), location TEXT NOT NULL CHECK(location='shop'),
 reason TEXT NOT NULL, approved_at INTEGER NOT NULL
);
CREATE TABLE mallet_enterprise_users (
 id TEXT PRIMARY KEY REFERENCES oa_operators(id), provider TEXT NOT NULL REFERENCES mallet_enterprise_connections(provider),
 external_id TEXT NOT NULL, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 active INTEGER NOT NULL CHECK(active IN (0,1)), revision INTEGER NOT NULL,
 role TEXT NOT NULL CHECK(role='technician'), location TEXT NOT NULL CHECK(location='shop'),
 UNIQUE(provider,external_id)
);
CREATE TRIGGER mallet_enterprise_disable AFTER UPDATE OF active ON mallet_enterprise_users WHEN NEW.active=0 BEGIN
 UPDATE oa_operators SET status='inactive' WHERE id=NEW.id;
 UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('subsec')*1000 AS INTEGER)) WHERE operator_id=NEW.id;
 UPDATE oa_credentials SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('subsec')*1000 AS INTEGER)) WHERE operator_id=NEW.id;
 UPDATE mallet_agent_keys SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('subsec')*1000 AS INTEGER)) WHERE created_by=NEW.id;
 UPDATE mallet_staff_grants SET revoked_at=COALESCE(revoked_at,CAST(unixepoch('subsec')*1000 AS INTEGER)) WHERE operator_id=NEW.id;
END;
