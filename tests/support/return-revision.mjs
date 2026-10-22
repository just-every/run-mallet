import assert from 'node:assert/strict'
import {ArchiveVerifier,ContentVerifier,makePart} from '@runeditrun/rer/modules/portability/format'
import {archive,installation,restore} from '../harness.mjs'

// Current invoices have no revision-edit command. Restore a synthetic export in
// the documented format to prove old tender cannot open a newer price revision.
export async function refuseChangedReturnRevision(source,invoice,input){
 const records=structuredClone(await archive(source)),manifest=records[0],parts=[],content=new ContentVerifier(manifest),integrity=new ArchiveVerifier(manifest)
 const nextRevision=invoice.revision+1,oldTender=[]
 let changed=false,approvalChanged=false
 for(const original of records.filter(r=>r.kind==='part')){
  for(const item of original.items)if(item.kind==='row'&&item.table==='mallet_records'){
   const value=JSON.parse(item.row.value)
   if(item.row.kind==='payment'&&value.invoiceId===invoice.id)oldTender.push(structuredClone(value))
   if(item.row.kind==='invoice'&&item.row.id===invoice.id){
    value.revision=nextRevision;value.approval.revision=nextRevision;changed=true
   }else if(item.row.kind==='approval'&&value.subjectKind==='invoice'&&value.subjectId===invoice.id&&value.revision===invoice.revision){
    value.revision=nextRevision;approvalChanged=true
   }else if(item.row.kind==='export'&&value.invoiceId===invoice.id){
    // The export carries the invoice price revision; its CSV's estimate
    // revision and immutable line/cent snapshots do not change here.
    value.invoiceRevision=nextRevision
   }else if(item.row.kind==='event'&&value.subjectId===invoice.id&&['invoice.prepare','invoice.approve','invoice.export'].includes(value.kind)){
    value.data.revision=nextRevision
   }else continue
   item.row.value=JSON.stringify(value)
  }
  const part=await makePart(original.index,original.items);parts.push(part);integrity.add(part);for(const item of part.items)content.add(item)
 }
 assert.equal(changed,true);assert.equal(approvalChanged,true,'The synthetic price revision retains its matching native approval')
 const fixture=[manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:integrity.digest()}],fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-109@example.test'}})
 try{
  await restore(fresh,fixture)
  const before=await fresh.state(),restored=before.records.invoice.find(i=>i.id===invoice.id);assert.equal(restored.revision,nextRevision)
  assert.deepEqual(before.records.payment.filter(p=>p.invoiceId===invoice.id),oldTender,'The newer invoice preserves its original tender revision and evidence')
  const refused=await fresh.command('flow.collect',input,{status:409});assert.equal(refused.error,'PAYMENT_UNSETTLED');assert.deepEqual((await fresh.state()).records,before.records,'Old tender cannot release a changed invoice revision')
 }finally{await fresh.close()}
}
