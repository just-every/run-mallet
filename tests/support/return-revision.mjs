import assert from 'node:assert/strict'
import {ArchiveVerifier,ContentVerifier,makePart} from '@runeditrun/rer/modules/portability/format'
import {archive,installation,restore} from '../harness.mjs'

// Current invoices have no revision-edit command. Restore a synthetic export in
// the documented format to prove old tender cannot open a newer price revision.
export async function refuseChangedReturnRevision(source,invoice,input){
 const records=structuredClone(await archive(source)),manifest=records[0],parts=[],content=new ContentVerifier(manifest),integrity=new ArchiveVerifier(manifest)
 let changed=false
 for(const original of records.filter(r=>r.kind==='part')){
  for(const item of original.items)if(item.kind==='row'&&item.table==='mallet_records'&&item.row.kind==='invoice'&&item.row.id===invoice.id){
   const value=JSON.parse(item.row.value);value.revision++;value.approval.revision=value.revision;item.row.value=JSON.stringify(value);changed=true
  }
  const part=await makePart(original.index,original.items);parts.push(part);integrity.add(part);for(const item of part.items)content.add(item)
 }
 assert.equal(changed,true)
 const fixture=[manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:integrity.digest()}],fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-109@example.test'}})
 try{
  await restore(fresh,fixture)
  const before=await fresh.state(),restored=before.records.invoice.find(i=>i.id===invoice.id);assert.equal(restored.revision,invoice.revision+1)
  const refused=await fresh.command('flow.collect',input,{status:409});assert.equal(refused.error,'PAYMENT_UNSETTLED');assert.deepEqual((await fresh.state()).records,before.records,'Old tender cannot release a changed invoice revision')
 }finally{await fresh.close()}
}
