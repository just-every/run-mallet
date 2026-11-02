CREATE TABLE mallet_saml_transactions (
 request_id TEXT PRIMARY KEY, provider TEXT NOT NULL, binding_hash TEXT NOT NULL,
 return_to TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE mallet_saml_sessions (
 session_id TEXT PRIMARY KEY, provider TEXT NOT NULL, issuer TEXT NOT NULL,
 subject TEXT NOT NULL, connection_revision INTEGER NOT NULL, certificate_hash TEXT NOT NULL
);
ALTER TABLE mallet_enterprise_connections ADD COLUMN protocol TEXT NOT NULL DEFAULT 'oidc' CHECK(protocol IN ('oidc','saml'));
ALTER TABLE mallet_enterprise_connections ADD COLUMN certificate_hash TEXT;
