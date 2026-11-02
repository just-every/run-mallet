/* Bounded native read paths. No duplicated business state or archive rebuild is needed. */
CREATE INDEX mallet_records_job_scope ON mallet_records(json_extract(value,'$.jobId'),kind,id);
CREATE INDEX mallet_records_asset_scope ON mallet_records(kind,json_extract(value,'$.assetId'),id);
CREATE INDEX mallet_records_invoice_scope ON mallet_records(json_extract(value,'$.invoiceId'),kind,id);
CREATE INDEX mallet_records_lot_scope ON mallet_records(json_extract(value,'$.lotId'),kind,id);
CREATE INDEX mallet_records_subject_scope ON mallet_records(kind,json_extract(value,'$.subjectId'),id);
CREATE INDEX mallet_records_report_scope ON mallet_records(kind,json_extract(value,'$.reportId'),id);
CREATE INDEX mallet_records_original_job ON mallet_records(kind,json_extract(value,'$.originalJobId'),id);
CREATE INDEX mallet_records_owner_scope ON mallet_records(kind,json_extract(value,'$.ownerId'),id);
CREATE INDEX mallet_records_email_scope ON mallet_records(kind,lower(json_extract(value,'$.email')),id);
CREATE INDEX mallet_records_job_assignment ON mallet_records(kind,json_extract(value,'$.technicianId'),id);
CREATE INDEX mallet_records_job_status ON mallet_records(kind,json_extract(value,'$.status'),id);
