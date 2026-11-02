-- Evidence writes do not change the business revision used by exact financial reviews.
DROP TRIGGER mallet_insert;
DROP TRIGGER mallet_update;
DROP TRIGGER mallet_delete;
CREATE TRIGGER mallet_insert AFTER INSERT ON mallet_records WHEN NEW.kind<>'audit' BEGIN
 UPDATE mallet_meta SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER mallet_update AFTER UPDATE ON mallet_records WHEN NEW.kind<>'audit' OR OLD.kind<>'audit' BEGIN
 UPDATE mallet_meta SET version=version+1 WHERE id=1;
END;
CREATE TRIGGER mallet_delete AFTER DELETE ON mallet_records WHEN OLD.kind<>'audit' BEGIN
 UPDATE mallet_meta SET version=version+1 WHERE id=1;
END;
-- Preserve authentication decisions as portable evidence without copying their raw value.
CREATE TRIGGER mallet_auth_audit AFTER INSERT ON oa_auth_audit BEGIN
 INSERT INTO mallet_records(kind,id,revision,value)
 VALUES('audit','auth:'||NEW.id,1,json_object('id','auth:'||NEW.id,'version',1,
  'action','auth.'||NEW.action,'at',strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at / 1000.0,'unixepoch'),
  'actor',json_object('id',NEW.actor_id,'name',COALESCE((SELECT display_name FROM oa_operators WHERE id=NEW.actor_id),'Former operator'),'role',COALESCE((SELECT role FROM oa_operators WHERE id=NEW.actor_id),'system')),
  'policy','native-auth-v1','changes',json('[]'),'evidence',json_array('auth:'||NEW.id)));
END;
-- Each import transaction binds the real current actor, independently of the portable role principal.
CREATE TABLE mallet_import_audit_context(singleton INTEGER PRIMARY KEY CHECK(singleton=1),actor TEXT NOT NULL CHECK(json_valid(actor)));
CREATE TRIGGER mallet_import_audit AFTER INSERT ON ik_batches WHEN EXISTS(SELECT 1 FROM mallet_import_audit_context WHERE singleton=1) BEGIN
 INSERT INTO mallet_records(kind,id,revision,value)
 VALUES('audit','import:'||NEW.job_id||':'||NEW.action||':'||NEW.position,1,
 json_object('id','import:'||NEW.job_id||':'||NEW.action||':'||NEW.position,'version',1,
 'action','import.'||NEW.action,'at',strftime('%Y-%m-%dT%H:%M:%fZ','now'),
 'actor',json((SELECT actor FROM mallet_import_audit_context WHERE singleton=1)),
 'policy','reviewed-import-v1','changes',json_array(json_object('kind','importBatch','id',NEW.job_id,'beforeRevision',NEW.position,'afterRevision',NEW.end_position)),
 'evidence',json_array('import:'||NEW.job_id)));
END;
CREATE INDEX mallet_audit_time ON mallet_records(kind,json_extract(value,'$.at'),id);
