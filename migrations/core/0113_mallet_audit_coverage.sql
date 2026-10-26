-- Session creation retains an attributable login reference, never its token hash.
CREATE TRIGGER mallet_login_audit AFTER INSERT ON oa_sessions WHEN EXISTS(SELECT 1 FROM mallet_records WHERE kind<>'audit') BEGIN
 INSERT INTO mallet_records(kind,id,revision,value)
 VALUES('audit','login:'||NEW.id,1,json_object('id','login:'||NEW.id,'version',1,
 'action','auth.session.created','at',strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at / 1000.0,'unixepoch'),
 'actor',json_object('id',NEW.operator_id,'name',COALESCE((SELECT display_name FROM oa_operators WHERE id=NEW.operator_id),'Former operator'),'role',COALESCE((SELECT role FROM oa_operators WHERE id=NEW.operator_id),'former')),
 'policy','native-login-v1','changes',json('[]'),'evidence',json('[]')));
END;
-- Provider jobs retain identifiers and states. Payloads and provider replies stay private.
CREATE TRIGGER mallet_job_audit_insert AFTER INSERT ON mallet_jobs BEGIN
 INSERT INTO mallet_records(kind,id,revision,value)
 VALUES('audit','job:'||NEW.id||':0',1,json_object('id','job:'||NEW.id||':0','version',1,
 'action','job.created','at',strftime('%Y-%m-%dT%H:%M:%fZ',NEW.created_at / 1000.0,'unixepoch'),
 'actor',json_object('id',COALESCE(json_extract(NEW.payload,'$.requestedBy.id'),'mallet-scheduler'),'name',COALESCE(json_extract(NEW.payload,'$.requestedBy.name'),'Scheduled jobs'),'role',CASE WHEN json_extract(NEW.payload,'$.requestedBy.id') IS NULL THEN 'system' ELSE 'owner' END),
 'policy','job-state-v1','changes',json('[]'),'evidence',json_array('job:'||NEW.id,'state:'||NEW.status)));
END;
CREATE TRIGGER mallet_job_audit_update AFTER UPDATE ON mallet_jobs WHEN NEW.status<>OLD.status BEGIN
 INSERT OR IGNORE INTO mallet_records(kind,id,revision,value)
 SELECT 'audit','job-change:'||NEW.id||':'||NEW.updated_at||':'||NEW.status||':'||NEW.attempts,1,json_object('id','job-change:'||NEW.id||':'||NEW.updated_at||':'||NEW.status||':'||NEW.attempts,'version',1,
 'action','job.state','at',strftime('%Y-%m-%dT%H:%M:%fZ',NEW.updated_at / 1000.0,'unixepoch'),
 'actor',json_object('id','mallet-scheduler','name','Scheduled jobs','role','system'),
 'policy','job-state-v1','changes',json('[]'),'evidence',json_array('job:'||NEW.id,'previous-state:'||OLD.status,'state:'||NEW.status));
END;
