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


/** Read-only staged validation. Batches bound Worker memory; staging tables may need costly SQL scans. */
export async function validateSearchProjection(db,tables){
 const quote=(name)=>{if(!name||!/^[A-Za-z0-9_]+$/.test(name))throw Error('SEARCH_STAGE_TABLE');return '"'+name+'"'}
 const source=quote(tables.mallet_records),docs=quote(tables.mallet_search_documents),grams=quote(tables.mallet_search_grams),members=quote(tables.mallet_search_members)
 const counts=await db.prepare(`SELECT (SELECT COUNT(*) FROM ${source} WHERE kind IN ('customerAccount','contact','asset')) AS native_count,(SELECT COUNT(*) FROM ${docs}) AS indexed_count,(SELECT COUNT(DISTINCT json_array(kind,source_id)) FROM ${docs}) AS identities,(SELECT COUNT(DISTINCT doc_id) FROM ${docs}) AS document_ids,(SELECT COUNT(*) FROM ${grams} g LEFT JOIN ${docs} d ON d.doc_id=g.doc_id WHERE d.doc_id IS NULL) AS orphans`).first()
 if(!counts||counts.native_count!==counts.indexed_count||counts.identities!==counts.indexed_count||counts.document_ids!==counts.indexed_count||counts.orphans)throw Error('SEARCH_STAGE_INVENTORY')
 let after=0,expectedMembers=0,expectedGrams=0,seen=0
 for(;;){
  const batch=(await db.prepare(`SELECT * FROM ${docs} WHERE doc_id>? ORDER BY doc_id LIMIT 100`).bind(after).all()).results
  if(!batch.length)break
  const native=(await db.prepare(`SELECT r.kind,r.id,r.value FROM ${source} r JOIN json_each(?) k ON r.kind=json_extract(k.value,'$[0]') AND r.id=json_extract(k.value,'$[1]')`).bind(JSON.stringify(batch.map(d=>[d.kind,d.source_id]))).all()).results
  const actualGrams=(await db.prepare(`SELECT gram,doc_id FROM ${grams} WHERE doc_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(batch.map(d=>d.doc_id))).all()).results
  for(const d of batch){
   if(!Number.isSafeInteger(d.doc_id)||d.doc_id<=after)throw Error('SEARCH_STAGE_DOCUMENT')
   const row=native.find(r=>r.kind===d.kind&&r.id===d.source_id);if(!row)throw Error('SEARCH_STAGE_SOURCE')
   const expected=buildSearchProjection([row],d.doc_id),document=expected.mallet_search_documents[0]
   if(!document||Object.keys(document).some(key=>document[key]!==d[key]))throw Error('SEARCH_STAGE_DOCUMENT')
   const actual=new Set(actualGrams.filter(g=>g.doc_id===d.doc_id).map(g=>g.gram))
   if(actual.size!==expected.mallet_search_grams.length||expected.mallet_search_grams.some(g=>!actual.has(g.gram)))throw Error('SEARCH_STAGE_GRAMS')
   expectedGrams+=expected.mallet_search_grams.length
   expectedMembers+=expected.mallet_search_members.length
   if(d.kind==='customerAccount'){
    const actualMembers=(await db.prepare(`SELECT contact_id FROM ${members} WHERE account_id=?`).bind(d.source_id).all()).results.map(x=>x.contact_id).sort()
    if(JSON.stringify(actualMembers)!==JSON.stringify(expected.mallet_search_members.map(x=>x.contact_id).sort()))throw Error('SEARCH_STAGE_MEMBERS')
   }
  }
  seen+=batch.length;after=batch.at(-1).doc_id
 }
 const totals=await db.prepare(`SELECT (SELECT COUNT(*) FROM ${grams}) AS grams,(SELECT COUNT(*) FROM ${members}) AS members`).first()
 if(seen!==counts.native_count||!totals||totals.grams!==expectedGrams||totals.members!==expectedMembers)throw Error('SEARCH_STAGE_INVENTORY')
 return true
}
