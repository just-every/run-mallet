export {buildSearchProjection,validateSearchProjection} from './search-projection.mjs'
import {HttpError,type Actor,type Authority} from '../auth'

type Match={id:string;name:string}
type Cursor={version:number;q:string;name:string;id:string}
const PAGE_SIZE=50,SCAN_SIZE=250
export const searchProjectionTables=['mallet_search_documents','mallet_search_grams','mallet_search_members']
const prepared=`INSERT INTO mallet_search_documents(kind,source_id,account_id,merged_into,terms,phone_digits,search_text,has_unicode)
 SELECT kind,source_id,account_id,merged_into,terms,phone_digits,lower((SELECT group_concat(value,char(1)) FROM json_each(terms)))||char(1)||phone_digits,length(CAST(terms AS BLOB))<>length(terms) FROM mallet_search_prepared`

/** Explicit rebuild for an existing installation. Native archives include exact projection rows. */
export async function rebuildAccountSearch(db:D1Database){
 await db.batch([
  db.prepare('DELETE FROM mallet_search_members'),db.prepare('DELETE FROM mallet_search_documents'),db.prepare(prepared),
  db.prepare(`INSERT INTO mallet_search_members(account_id,contact_id) SELECT r.id,j.value FROM mallet_records r,json_each(r.value,'$.contactIds') j WHERE r.kind='customerAccount' AND json_extract(r.value,'$.mergedInto') IS NULL`)
 ])
}
async function checked<T>(db:D1Database,actor:Actor,authority:Authority,sql:string,params:unknown[]=[],version?:number):Promise<T[]>{
 if(!['owner','admin'].includes(actor.role)||!authority?.sql||!Array.isArray(authority.params))throw new HttpError(403,'manager_required')
 const result=await db.batch([
  db.prepare(`SELECT (SELECT version FROM mallet_meta WHERE id=1) AS version,CASE WHEN (${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role=? AND status='active' AND role IN ('owner','admin')) THEN 1 ELSE 0 END AS allowed`).bind(...authority.params,actor.id,actor.role),
  db.prepare(sql).bind(...params)
 ])
 const gate=result[0].results[0] as {allowed:number;version:number}|undefined
 if(gate?.allowed!==1)throw new HttpError(403,'manager_required')
 if(version!==undefined&&gate.version!==version)throw new HttpError(409,'search_changed')
 return result[1].results as T[]
}
function decode(value:string|undefined,q:string):Cursor|null{
 if(!value)return null
 try{
  if(value.length>4096)throw Error()
  const row=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))
  if(Object.keys(row).sort().join(',')!=='id,name,q,version'||row.q!==q||!Number.isSafeInteger(row.version)||typeof row.name!=='string'||row.name.length>200||typeof row.id!=='string'||!row.id||row.id.length>200)throw Error()
  return row
 }catch{throw new HttpError(400,'invalid_search_cursor')}
}
const encode=(cursor:Cursor)=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(cursor)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const name="json_extract(a.terms,'$[0]')"
const ordered=`${name} COLLATE NOCASE,a.source_id`
const active="a.kind='customerAccount' AND a.merged_into IS NULL"
const eligible=`(p.has_cursor=0 OR ${name} COLLATE NOCASE>p.cursor_name COLLATE NOCASE OR (${name} COLLATE NOCASE=p.cursor_name COLLATE NOCASE AND a.source_id>p.cursor_id))`
const after=`(${name} COLLATE NOCASE>? OR (${name} COLLATE NOCASE=? AND a.source_id>?))`

/** Matching owners remain inside SQL; only Unicode text requiring JavaScript casefolding crosses into the Worker. */
function matchingSql(empty:boolean){
 const params='WITH params AS (SELECT ? AS q,? AS digits,? AS grams,? AS cursor_name,? AS cursor_id,? AS has_cursor)'
 if(empty)return params+",ascii_owners AS (SELECT source_id AS id FROM mallet_search_documents WHERE kind='customerAccount' AND merged_into IS NULL) "
 return params+`,candidate_documents AS (
  SELECT d.doc_id FROM mallet_search_documents d CROSS JOIN params p WHERE json_array_length(p.grams)=0 OR d.has_unicode=1
  OR d.doc_id IN (SELECT g.doc_id FROM mallet_search_grams g WHERE g.gram IN (SELECT value FROM json_each(p.grams)))
 ),document_owners AS (
  SELECT d.doc_id,d.account_id AS id FROM mallet_search_documents d WHERE d.kind='customerAccount'
  UNION ALL SELECT d.doc_id,m.account_id FROM mallet_search_documents d JOIN mallet_search_members m ON m.contact_id=d.source_id WHERE d.kind='contact'
  UNION ALL SELECT d.doc_id,a.account_id FROM mallet_search_documents d JOIN mallet_search_documents a ON a.kind='customerAccount' AND a.source_id=d.account_id WHERE d.kind='asset'
 ),ascii_owners AS (
  SELECT DISTINCT o.id FROM candidate_documents c JOIN mallet_search_documents d ON d.doc_id=c.doc_id JOIN document_owners o ON o.doc_id=d.doc_id CROSS JOIN params p
  WHERE (d.has_unicode=0 AND EXISTS(SELECT 1 FROM json_each(d.terms) t WHERE instr(lower(COALESCE(CAST(t.value AS TEXT),'null')),p.q)>0))
  OR (length(p.digits)>=3 AND d.kind='contact' AND instr(d.phone_digits,p.digits)>0)
 ),unicode_owners AS (
  SELECT DISTINCT o.id FROM document_owners o JOIN mallet_search_documents d ON d.doc_id=o.doc_id WHERE d.has_unicode=1
 ) `
}

/** At most SCAN_SIZE owners/documents and PAGE_SIZE+1 matches are retained at a time. */
async function unicodeMatches(read:<T>(sql:string,params?:unknown[])=>Promise<T[]>,base:string,bindings:unknown[],q:string,digits:string){
 let total=0,last:Match|null=null
 const page:Match[]=[]
 for(;;){
  const batch=await read<Match&{eligible:number}>(base+`SELECT a.source_id AS id,${name} AS name,CASE WHEN ${eligible} THEN 1 ELSE 0 END AS eligible FROM mallet_search_documents a CROSS JOIN params p
   WHERE ${active} AND a.source_id IN (SELECT id FROM unicode_owners) AND a.source_id NOT IN (SELECT id FROM ascii_owners)
   ${last?'AND '+after:''} ORDER BY ${ordered} LIMIT ?`,[...bindings,...(last?[last.name,last.name,last.id]:[]),SCAN_SIZE])
  if(!batch.length)break
  const found=new Set<string>();let owner='',docId=0
  for(;;){
   const documents=await read<{owner_id:string;doc_id:number;terms:string;phone_digits:string;kind:string}>(base+`SELECT o.id AS owner_id,d.doc_id,d.terms,d.phone_digits,d.kind FROM document_owners o JOIN mallet_search_documents d ON d.doc_id=o.doc_id
    WHERE o.id IN (SELECT value FROM json_each(?)) AND d.has_unicode=1 AND (o.id,d.doc_id)>(?,?) ORDER BY o.id,d.doc_id LIMIT ?`,[...bindings,JSON.stringify(batch.map(row=>row.id)),owner,docId,SCAN_SIZE])
   if(!documents.length)break
   for(const d of documents)if((JSON.parse(d.terms) as unknown[]).some(v=>String(v).toLowerCase().includes(q))||d.kind==='contact'&&digits.length>=3&&d.phone_digits.includes(digits))found.add(d.owner_id)
   if(found.size===batch.length)break
   const end=documents.at(-1)!;owner=end.owner_id;docId=end.doc_id
  }
  total+=found.size
  for(const row of batch)if(row.eligible&&found.has(row.id)&&page.length<PAGE_SIZE+1)page.push({id:row.id,name:row.name})
  last=batch.at(-1)!
 }
 return {total,page}
}

/** Stable SQL NOCASE name/id keyset pages; exact substring, alias and phone semantics are preserved. */
export async function searchAccounts(db:D1Database,actor:Actor,authority:Authority,query='',cursor?:string){
 if(typeof query!=='string'||query.length>200||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(query))throw new HttpError(400,'invalid_search')
 const q=query.trim().toLowerCase(),digits=q.replace(/\D/g,''),previous=decode(cursor,q)
 const [state]=await checked<{version:number;native_count:number;indexed_count:number}>(db,actor,authority,`SELECT version,(SELECT COUNT(*) FROM mallet_records WHERE kind IN ('customerAccount','contact','asset')) AS native_count,(SELECT COUNT(*) FROM mallet_search_documents) AS indexed_count FROM mallet_meta WHERE id=1`)
 if(!state||state.native_count!==state.indexed_count)throw new HttpError(503,'search_reindex_required')
 if(previous&&previous.version!==state.version)throw new HttpError(409,'search_cursor_changed')
 const grams:string[]=[]
 if(/^[\x00-\x7f]+$/.test(q)&&q.length>=3)grams.push(q.slice(0,3))
 if(digits.length>=3)grams.push(digits.slice(0,3))
 const base=matchingSql(!q),bindings:unknown[]=[q,digits,JSON.stringify(grams),previous?.name??'',previous?.id??'',previous?1:0]
 const read=<T>(sql:string,params:unknown[]=[])=>checked<T>(db,actor,authority,sql,params,state.version)
 const [count]=await read<{count:number}>(base+`SELECT COUNT(*) AS count FROM mallet_search_documents a WHERE ${active} AND a.source_id IN (SELECT id FROM ascii_owners)`,bindings)
 const ascii=await read<Match>(base+`SELECT a.source_id AS id,${name} AS name FROM mallet_search_documents a CROSS JOIN params p WHERE ${active} AND a.source_id IN (SELECT id FROM ascii_owners) AND ${eligible} ORDER BY ${ordered} LIMIT ?`,[...bindings,PAGE_SIZE+1])
 const unicode=q?await unicodeMatches(read,base,bindings,q,digits):{total:0,page:[]}
 // SQL orders the bounded union too, avoiding a JavaScript approximation of SQLite collation.
 const orderedPage=await read<Match>(`SELECT a.source_id AS id,${name} AS name FROM mallet_search_documents a WHERE ${active} AND a.source_id IN (SELECT value FROM json_each(?)) ORDER BY ${ordered} LIMIT ?`,[JSON.stringify([...ascii,...unicode.page].map(row=>row.id)),PAGE_SIZE+1])
 const page=orderedPage.slice(0,PAGE_SIZE)
 const rows=await read<{id:string;value:string}>(`SELECT id,value FROM mallet_records WHERE kind='customerAccount' AND id IN (SELECT value FROM json_each(?))`,[JSON.stringify(page.map(row=>row.id))])
 await read('SELECT version FROM mallet_meta WHERE id=1')
 if(rows.length!==page.length)throw new HttpError(409,'search_changed')
 const accounts=page.map(p=>JSON.parse(rows.find(r=>r.id===p.id)!.value)),end=page.at(-1)
 return {accounts,nextCursor:orderedPage.length>PAGE_SIZE&&end?encode({q,version:state.version,name:end.name,id:end.id}):null,total:count.count+unicode.total}
}
