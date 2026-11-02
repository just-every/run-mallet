/** Fixture/archive authoring helper. Uses the same ASCII fold and code-point grams as SQLite. */
export function buildSearchProjection(records,firstDocId=1){
 const documents=[],grams=[],members=[]
 for(const record of records){
  if(!['customerAccount','contact','asset'].includes(record.kind))continue
  const row=typeof record.value==='string'?JSON.parse(record.value):record.value
  const values=record.kind==='customerAccount'?[row.name]:record.kind==='contact'?[row.name,row.email,row.phone]:[row.label,row.identifier]
  const terms=JSON.stringify(values),phone_digits=record.kind==='contact'?String(row.phone??'').replace(/[^0-9]/g,''):''
  const search_text=values.filter(v=>v!==null&&v!==undefined).join('\x01').replace(/[A-Z]/g,c=>c.toLowerCase())+'\x01'+phone_digits
  const doc_id=firstDocId+documents.length
  documents.push({doc_id,kind:record.kind,source_id:record.id,account_id:record.kind==='customerAccount'?row.mergedInto??record.id:record.kind==='asset'?row.customerAccountId??null:null,merged_into:record.kind==='customerAccount'?row.mergedInto??null:null,terms,phone_digits,search_text,has_unicode:/[^\x00-\x7f]/.test(terms)?1:0})
  const points=Array.from(search_text),seen=new Set()
  for(let i=0;i+3<=points.length;i++)seen.add(points.slice(i,i+3).join(''))
  for(const gram of seen)grams.push({gram,doc_id})
  if(record.kind==='customerAccount'&&row.mergedInto==null)for(const contact_id of row.contactIds??[])members.push({account_id:record.id,contact_id})
 }
 return {mallet_search_documents:documents,mallet_search_grams:grams,mallet_search_members:members}
}


/** Read-only staged validation. SQL retains populations; the Worker receives scalar flags per keyset batch. */
export async function validateSearchProjection(db,tables){
 const quote=name=>{if(!name||!/^[A-Za-z0-9_]+$/.test(name))throw Error('SEARCH_STAGE_TABLE');return '"'+name+'"'}
 const source=quote(tables.mallet_records),docs=quote(tables.mallet_search_documents),grams=quote(tables.mallet_search_grams),members=quote(tables.mallet_search_members)
 const counts=await db.prepare(`SELECT
  (SELECT COUNT(*) FROM ${source} WHERE kind IN ('customerAccount','contact','asset')) AS native_count,
  (SELECT COUNT(DISTINCT json_array(kind,id)) FROM ${source} WHERE kind IN ('customerAccount','contact','asset')) AS native_identities,
  (SELECT COUNT(*) FROM ${docs}) AS indexed_count,
  (SELECT COUNT(DISTINCT json_array(kind,source_id)) FROM ${docs}) AS identities,
  (SELECT COUNT(DISTINCT doc_id) FROM ${docs}) AS document_ids,
  EXISTS(SELECT 1 FROM ${docs} WHERE typeof(doc_id)<>'integer' OR doc_id<=0 OR doc_id>9007199254740991) AS invalid_ids,
  EXISTS(SELECT 1 FROM ${grams} g LEFT JOIN ${docs} d ON d.doc_id=g.doc_id WHERE d.doc_id IS NULL) AS orphans,
  EXISTS(SELECT 1 FROM ${grams} GROUP BY doc_id,gram HAVING COUNT(*)>1) AS duplicate_grams,
  EXISTS(SELECT 1 FROM ${members} GROUP BY account_id,contact_id HAVING COUNT(*)>1) AS duplicate_members`).first()
 if(!counts||counts.native_count!==counts.native_identities||counts.native_count!==counts.indexed_count||counts.identities!==counts.indexed_count||counts.document_ids!==counts.indexed_count||counts.invalid_ids||counts.orphans||counts.duplicate_grams||counts.duplicate_members)throw Error('SEARCH_STAGE_INVENTORY')
 const membership=await db.prepare(`WITH expected AS (
  SELECT r.id AS account_id,j.value AS contact_id FROM ${source} r,json_each(r.value,'$.contactIds') j
  WHERE r.kind='customerAccount' AND json_extract(r.value,'$.mergedInto') IS NULL
 ) SELECT (SELECT COUNT(*) FROM expected)<>(SELECT COUNT(*) FROM ${members})
 OR EXISTS(SELECT account_id,contact_id FROM expected EXCEPT SELECT account_id,contact_id FROM ${members})
 OR EXISTS(SELECT account_id,contact_id FROM ${members} EXCEPT SELECT account_id,contact_id FROM expected) AS invalid`).first()
 if(!membership||membership.invalid)throw Error('SEARCH_STAGE_MEMBERS')
 let after=0,seen=0
 for(;;){
  const result=await db.prepare(`WITH RECURSIVE batch AS (
   SELECT * FROM ${docs} WHERE doc_id>? ORDER BY doc_id LIMIT 250
  ),raw AS (
   SELECT d.doc_id,r.kind,r.id AS source_id,
    CASE r.kind WHEN 'customerAccount' THEN COALESCE(json_extract(r.value,'$.mergedInto'),r.id) WHEN 'asset' THEN json_extract(r.value,'$.customerAccountId') END AS account_id,
    CASE WHEN r.kind='customerAccount' THEN json_extract(r.value,'$.mergedInto') END AS merged_into,
    CASE r.kind WHEN 'customerAccount' THEN json_array(json_extract(r.value,'$.name'))
     WHEN 'contact' THEN json_array(json_extract(r.value,'$.name'),json_extract(r.value,'$.email'),json_extract(r.value,'$.phone'))
     ELSE json_array(json_extract(r.value,'$.label'),json_extract(r.value,'$.identifier')) END AS terms,
    CASE WHEN r.kind='contact' THEN COALESCE(json_extract(r.value,'$.phone'),'') ELSE '' END AS phone
   FROM batch d LEFT JOIN ${source} r ON r.kind=d.kind AND r.id=d.source_id
  ),prepared AS (
   SELECT *,COALESCE((WITH RECURSIVE chars(n,c) AS (
    SELECT 1,substr(phone,1,1) WHERE length(phone)>0
    UNION ALL SELECT n+1,substr(phone,n+1,1) FROM chars WHERE n<MIN(length(phone),100)
   ) SELECT group_concat(c,'') FROM chars WHERE c BETWEEN '0' AND '9'),'') AS phone_digits
   FROM raw
  ),expected AS (
   SELECT *,lower(COALESCE((SELECT group_concat(value,char(1)) FROM json_each(terms)),''))||char(1)||phone_digits AS search_text,
    length(CAST(terms AS BLOB))<>length(terms) AS has_unicode FROM prepared
  ),positions(doc_id,text,n) AS (
   SELECT doc_id,search_text,1 FROM expected WHERE length(search_text) BETWEEN 3 AND 1026
   UNION ALL SELECT doc_id,text,n+1 FROM positions WHERE n+3<=length(text)
  ),expected_grams AS (
   SELECT DISTINCT doc_id,substr(text,n,3) AS gram FROM positions
  ),actual_grams AS (
   SELECT g.doc_id,g.gram FROM ${grams} g JOIN batch b ON b.doc_id=g.doc_id
  ) SELECT (SELECT COUNT(*) FROM batch) AS count,(SELECT MAX(doc_id) FROM batch) AS last_id,
   EXISTS(SELECT 1 FROM expected WHERE kind IS NULL OR kind NOT IN ('customerAccount','contact','asset')) AS missing_source,
   EXISTS(SELECT 1 FROM batch d JOIN expected e ON e.doc_id=d.doc_id WHERE
    length(e.phone)>100 OR length(e.search_text)>1026 OR d.kind IS NOT e.kind OR d.source_id IS NOT e.source_id
    OR d.account_id IS NOT e.account_id OR d.merged_into IS NOT e.merged_into OR d.terms IS NOT e.terms
    OR d.phone_digits IS NOT e.phone_digits OR d.search_text IS NOT e.search_text OR d.has_unicode IS NOT e.has_unicode) AS invalid_document,
   EXISTS(SELECT doc_id,gram FROM expected_grams EXCEPT SELECT doc_id,gram FROM actual_grams)
    OR EXISTS(SELECT doc_id,gram FROM actual_grams EXCEPT SELECT doc_id,gram FROM expected_grams) AS invalid_grams`).bind(after).first()
  if(!result)throw Error('SEARCH_STAGE_INVENTORY')
  if(result.missing_source)throw Error('SEARCH_STAGE_SOURCE')
  if(result.invalid_document)throw Error('SEARCH_STAGE_DOCUMENT')
  if(result.invalid_grams)throw Error('SEARCH_STAGE_GRAMS')
  if(!result.count)break
  if(!Number.isSafeInteger(result.last_id)||result.last_id<=after)throw Error('SEARCH_STAGE_DOCUMENT')
  seen+=result.count;after=result.last_id
 }
 if(seen!==counts.native_count)throw Error('SEARCH_STAGE_INVENTORY')
 return true
}
