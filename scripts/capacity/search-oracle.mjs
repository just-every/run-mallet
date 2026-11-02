// Independent business-level oracle: no SQL, projection builder or trigrams.
// Restrict the fixture to ASCII/unmerged accounts so JS binary comparison of
// folded names and IDs is exactly SQLite ORDER BY name COLLATE NOCASE,id.
function unsupported(){throw new Error('search_oracle_source_unsupported')}
function text(value){
 if(typeof value!=='string'||/[^\x20-\x7e]/.test(value))unsupported()
 return value
}
const compare=(a,b)=>a<b?-1:a>b?1:0

export function buildSearchOracle(records){
 const accounts=new Map(),contacts=new Map()
 const account=id=>{
  text(id)
  let row=accounts.get(id)
  if(!row){row={id,name:null,fields:[],phones:[],contactIds:null};accounts.set(id,row)}
  return row
 }
 for(const record of records){
  if(!['customerAccount','contact','asset'].includes(record.kind))continue
  const value=typeof record.value==='string'?JSON.parse(record.value):record.value
  if(!value||value.id!==record.id)unsupported()
  if(record.kind==='contact'){
   if(contacts.has(record.id))unsupported()
   const fields=[value.name,value.email,value.phone].map(v=>text(v).toLowerCase())
   contacts.set(record.id,{fields,phone:text(value.phone).replace(/\D/g,'')})
  }else if(record.kind==='asset'){
   const fields=[value.label,value.identifier].map(v=>text(v).toLowerCase())
   if(value.customerAccountId!=null)account(value.customerAccountId).fields.push(...fields)
  }else{
   if(value.mergedInto!=null||!Array.isArray(value.contactIds))unsupported()
   const row=account(record.id)
   if(row.name!==null)unsupported()
   row.name=text(value.name).toLowerCase();row.fields.push(row.name)
   row.contactIds=value.contactIds.map(text)
  }
 }
 for(const row of accounts.values()){
  if(row.name===null||row.contactIds===null)unsupported()
  for(const id of row.contactIds){
   const contact=contacts.get(id);if(!contact)unsupported()
   row.fields.push(...contact.fields);row.phones.push(contact.phone)
  }
  delete row.contactIds
 }
 contacts.clear()
 const ordered=[...accounts.values()].sort((a,b)=>compare(a.name,b.name)||compare(a.id,b.id))
 accounts.clear()
 return {
  accountCount:ordered.length,
  page(query){
   const q=text(query).trim().toLowerCase(),digits=q.replace(/\D/g,''),ids=[]
   let total=0
   for(const row of ordered)if(!q||row.fields.some(field=>field.includes(q))||digits.length>=3&&row.phones.some(phone=>phone.includes(digits))){
    total++;if(ids.length<50)ids.push(row.id)
   }
   return {ids,total,hasNextPage:total>50}
  }
 }
}
