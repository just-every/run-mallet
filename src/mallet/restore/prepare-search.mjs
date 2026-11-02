import { buildSearchProjection } from '../read-model/search-projection.mjs'
import { quote, refuse } from './validate-staged.mjs'
const names=['mallet_search_documents','mallet_search_grams','mallet_search_members']

/** An older native archive predates these additive, fully derived tables.
 * Only absent inventories may be derived. Never overwrite a supplied
 * projection, which is authenticated by the original archive checksums.
 * Base restores copies through row-order sidecars; derived rows need those
 * sidecars too or publication would silently omit them. */
export async function prepareSearchProjection({db,tables,manifest}){
 const supplied=names.filter(name=>manifest.tables.some(t=>t.name===name))
 if(supplied.length===names.length)return
 if(supplied.length||names.some(name=>!tables[name]))refuse('search_inventory')
 if(!tables.mallet_records)return
 const operations=names.flatMap(name=>[
  db.prepare(`DELETE FROM ${quote(tables[name])}`),
  db.prepare(`DELETE FROM ${quote(tables[name]+'_meta')}`)
 ])
 await db.batch(operations)
 const counters=Object.fromEntries(names.map(name=>[name,0]))
 let kind='',id='',docId=1
 for(;;){
  // Project only inputs, so long history/snapshots cannot inflate a batch.
  const source=await db.prepare(`SELECT kind,id,CASE kind
   WHEN 'customerAccount' THEN json_object('name',json_extract(value,'$.name'),'mergedInto',json_extract(value,'$.mergedInto'),'contactIds',json_extract(value,'$.contactIds'))
   WHEN 'contact' THEN json_object('name',json_extract(value,'$.name'),'email',json_extract(value,'$.email'),'phone',json_extract(value,'$.phone'))
   ELSE json_object('label',json_extract(value,'$.label'),'identifier',json_extract(value,'$.identifier'),'customerAccountId',json_extract(value,'$.customerAccountId')) END AS value
   FROM ${quote(tables.mallet_records)} WHERE kind IN ('asset','contact','customerAccount') AND (kind>? OR (kind=? AND id>?)) ORDER BY kind,id LIMIT 1`).bind(kind,kind,id).first()
  if(!source)break
  kind=source.kind;id=source.id
  const projection=buildSearchProjection([source],docId)
  docId+=projection.mallet_search_documents.length
  let pending=[]
  for(const name of names)for(const row of projection[name]){
   const ordinal=counters[name]++,rowid=ordinal+1,columns=Object.keys(row)
   pending.push(db.prepare(`INSERT INTO ${quote(tables[name])} (rowid,${columns.map(quote).join(',')}) VALUES (${Array(columns.length+1).fill('?').join(',')})`).bind(rowid,...columns.map(key=>row[key])))
   pending.push(db.prepare(`INSERT INTO ${quote(tables[name]+'_meta')} VALUES (?,?,NULL,NULL)`).bind(ordinal,rowid))
   if(pending.length>=40){await db.batch(pending);pending=[]}
  }
  if(pending.length)await db.batch(pending)
 }
}
