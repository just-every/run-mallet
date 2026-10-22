-- All product policy, holds and value-free receipts live in mallet_records and
-- inherit its portability policy. Media changes also invalidate reviewed plans.
CREATE TABLE mallet_retention_clock (
 id INTEGER PRIMARY KEY CHECK(id=1),
 version INTEGER NOT NULL
);
INSERT INTO mallet_retention_clock VALUES(1,0);
CREATE TRIGGER mallet_retention_findings_insert AFTER INSERT ON mallet_media_findings BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_findings_update AFTER UPDATE ON mallet_media_findings BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_findings_delete AFTER DELETE ON mallet_media_findings BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_uploads_insert AFTER INSERT ON mallet_media_uploads BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_uploads_update AFTER UPDATE ON mallet_media_uploads BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_uploads_delete AFTER DELETE ON mallet_media_uploads BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_chunks_insert AFTER INSERT ON mallet_media_chunks BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_chunks_update AFTER UPDATE ON mallet_media_chunks BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_chunks_delete AFTER DELETE ON mallet_media_chunks BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_resolutions_insert AFTER INSERT ON mallet_media_resolutions BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_resolutions_update AFTER UPDATE ON mallet_media_resolutions BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_resolutions_delete AFTER DELETE ON mallet_media_resolutions BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
-- Fence concurrent vault stores/expiry too. The caller accounts for its own
-- ciphertext removals after destroying external keys; other changes abort.
CREATE TRIGGER mallet_retention_secrets_insert AFTER INSERT ON mallet_intake_secrets BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_secrets_update AFTER UPDATE ON mallet_intake_secrets BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_secrets_delete AFTER DELETE ON mallet_intake_secrets BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_clients_insert AFTER INSERT ON mallet_media_upload_clients BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_clients_update AFTER UPDATE ON mallet_media_upload_clients BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
CREATE TRIGGER mallet_retention_clients_delete AFTER DELETE ON mallet_media_upload_clients BEGIN UPDATE mallet_retention_clock SET version=version+1 WHERE id=1; END;
