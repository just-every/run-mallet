/* Search projections travel with native archives because restore temporarily removes triggers. */
CREATE TABLE mallet_search_documents (
 doc_id INTEGER PRIMARY KEY,
 kind TEXT NOT NULL,
 source_id TEXT NOT NULL,
 account_id TEXT,
 merged_into TEXT,
 terms TEXT NOT NULL CHECK(json_valid(terms)),
 phone_digits TEXT NOT NULL,
 search_text TEXT NOT NULL,
 has_unicode INTEGER NOT NULL,
 UNIQUE(kind,source_id)
);
CREATE INDEX mallet_search_account ON mallet_search_documents(kind,account_id,source_id);
CREATE INDEX mallet_search_name ON mallet_search_documents(kind,json_extract(terms,'$[0]') COLLATE NOCASE,source_id);
CREATE INDEX mallet_search_unicode ON mallet_search_documents(has_unicode,doc_id);
CREATE TABLE mallet_search_grams (
 gram TEXT NOT NULL,
 doc_id INTEGER NOT NULL REFERENCES mallet_search_documents(doc_id) ON DELETE CASCADE,
 PRIMARY KEY(gram,doc_id)
) WITHOUT ROWID;
CREATE INDEX mallet_search_grams_document ON mallet_search_grams(doc_id);
CREATE TABLE mallet_search_members (
 account_id TEXT NOT NULL,
 contact_id TEXT NOT NULL,
 PRIMARY KEY(account_id,contact_id)
) WITHOUT ROWID;
CREATE INDEX mallet_search_contact ON mallet_search_members(contact_id,account_id);

CREATE VIEW mallet_search_source AS
SELECT kind,id AS source_id,
 CASE kind WHEN 'customerAccount' THEN COALESCE(json_extract(value,'$.mergedInto'),id) WHEN 'asset' THEN json_extract(value,'$.customerAccountId') END AS account_id,
 CASE WHEN kind='customerAccount' THEN json_extract(value,'$.mergedInto') END AS merged_into,
 CASE kind
 WHEN 'customerAccount' THEN json_array(json_extract(value,'$.name'))
 WHEN 'contact' THEN json_array(json_extract(value,'$.name'),json_extract(value,'$.email'),json_extract(value,'$.phone'))
 ELSE json_array(json_extract(value,'$.label'),json_extract(value,'$.identifier')) END AS terms,
 CASE WHEN kind='contact' THEN COALESCE(json_extract(value,'$.phone'),'') ELSE '' END AS phone
FROM mallet_records WHERE kind IN ('customerAccount','contact','asset');

CREATE VIEW mallet_search_prepared AS
SELECT kind,source_id,account_id,merged_into,terms,
 COALESCE((WITH RECURSIVE chars(n,c) AS (
 SELECT 1,substr(phone,1,1) WHERE length(phone)>0
 UNION ALL SELECT n+1,substr(phone,n+1,1) FROM chars WHERE n<length(phone)
 ) SELECT group_concat(c,'') FROM chars WHERE c BETWEEN '0' AND '9'),'') AS phone_digits
FROM mallet_search_source;

CREATE TRIGGER mallet_search_document_insert AFTER INSERT ON mallet_search_documents BEGIN
 INSERT OR IGNORE INTO mallet_search_grams(gram,doc_id)
 WITH RECURSIVE positions(n) AS (
 SELECT 1 WHERE length(NEW.search_text)>=3
 UNION ALL SELECT n+1 FROM positions WHERE n+3<=length(NEW.search_text)
 ) SELECT DISTINCT substr(NEW.search_text,n,3),NEW.doc_id FROM positions;
END;

CREATE TRIGGER mallet_search_insert AFTER INSERT ON mallet_records
WHEN NEW.kind IN ('customerAccount','contact','asset') BEGIN
 INSERT INTO mallet_search_documents(kind,source_id,account_id,merged_into,terms,phone_digits,search_text,has_unicode)
 SELECT kind,source_id,account_id,merged_into,terms,phone_digits,lower((SELECT group_concat(value,char(1)) FROM json_each(terms)))||char(1)||phone_digits,length(CAST(terms AS BLOB))<>length(terms)
 FROM mallet_search_prepared WHERE kind=NEW.kind AND source_id=NEW.id;
 INSERT INTO mallet_search_members(account_id,contact_id)
 SELECT NEW.id,j.value FROM json_each(NEW.value,'$.contactIds') j
 WHERE NEW.kind='customerAccount' AND json_extract(NEW.value,'$.mergedInto') IS NULL;
END;

CREATE TRIGGER mallet_search_update AFTER UPDATE ON mallet_records
WHEN OLD.kind IN ('customerAccount','contact','asset') OR NEW.kind IN ('customerAccount','contact','asset') BEGIN
 DELETE FROM mallet_search_documents WHERE kind=OLD.kind AND source_id=OLD.id;
 DELETE FROM mallet_search_members WHERE OLD.kind='customerAccount' AND account_id=OLD.id;
 INSERT INTO mallet_search_documents(kind,source_id,account_id,merged_into,terms,phone_digits,search_text,has_unicode)
 SELECT kind,source_id,account_id,merged_into,terms,phone_digits,lower((SELECT group_concat(value,char(1)) FROM json_each(terms)))||char(1)||phone_digits,length(CAST(terms AS BLOB))<>length(terms)
 FROM mallet_search_prepared WHERE kind=NEW.kind AND source_id=NEW.id;
 INSERT INTO mallet_search_members(account_id,contact_id)
 SELECT NEW.id,j.value FROM json_each(NEW.value,'$.contactIds') j
 WHERE NEW.kind='customerAccount' AND json_extract(NEW.value,'$.mergedInto') IS NULL;
END;

CREATE TRIGGER mallet_search_delete AFTER DELETE ON mallet_records
WHEN OLD.kind IN ('customerAccount','contact','asset') BEGIN
 DELETE FROM mallet_search_documents WHERE kind=OLD.kind AND source_id=OLD.id;
 DELETE FROM mallet_search_members WHERE OLD.kind='customerAccount' AND account_id=OLD.id;
END;

INSERT INTO mallet_search_documents(kind,source_id,account_id,merged_into,terms,phone_digits,search_text,has_unicode)
SELECT kind,source_id,account_id,merged_into,terms,phone_digits,lower((SELECT group_concat(value,char(1)) FROM json_each(terms)))||char(1)||phone_digits,length(CAST(terms AS BLOB))<>length(terms)
FROM mallet_search_prepared;
INSERT INTO mallet_search_members(account_id,contact_id)
SELECT r.id,j.value FROM mallet_records r,json_each(r.value,'$.contactIds') j
WHERE r.kind='customerAccount' AND json_extract(r.value,'$.mergedInto') IS NULL;
