import assert from 'node:assert/strict'

/** Independent native demand records must not clear each other. */
export async function blockerParts(h,jobId){
 const state=()=>h.state(),job=async()=>(await state()).records.job.find(j=>j.id===jobId)
 const view=()=>h.api(`/api/mallet/repairs/${jobId}/blockers`)
 const refresh=async()=>{const v=await view();await h.command('blocker.refresh',{jobId,packetVersion:v.packet.version,basis:v.current.basis});return view()}
 const item=await h.command('stock.item',{sku:'synthetic-mallet-910',barcode:'synthetic-mallet-911',name:'Repair demand bearing',unit:'each'}),bin=await h.command('stock.bin',{code:'Receiving',barcode:'synthetic-mallet-912'})
 const poInput={reference:'synthetic-mallet-913',supplier:'Cedar Parts',shipTo:'Receiving bench',expectedAt:new Date(Date.now()-3600000).toISOString(),taxCents:0,freightCents:0,lines:[{itemId:item.id,quantity:2,unitCents:2500,jobId}]}
 let po=await h.command('purchase.create',poInput)
 assert.ok(!(await view()).current.blockers.some(b=>b.source.id===po.id),'ADV-003 a draft PO is not an ordered backorder')
 po=await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Approve two physical units for this repair'})
 let plan=(await state()).records.promisePlan.find(p=>p.jobId===jobId)
 const eta={partId:'synthetic-mallet-914',name:'Separate staff-tracked bearing',eta:new Date(Date.now()-3600000).toISOString(),sourceNote:'Supplier acknowledgment retained',reason:'Distinct source; do not merge by name'}
 plan=await h.command('promise.partETA',{jobId,version:(await job()).version,planVersion:plan.version,...eta})
 let v=await refresh()
 assert.deepEqual(v.current.blockers.map(b=>b.source.kind).sort(),['promisePlan','purchaseOrder'],'ADV-003 distinct plan and ordered-stock blockers remain separate')
 const receipt=async(quantity,reference)=>{
  await h.command('purchase.receive',{purchaseId:po.id,version:po.version,lineId:po.lines[0].id,itemBarcode:item.barcode,binBarcode:bin.barcode,quantity,reference})
  po=(await state()).records.purchaseOrder.find(p=>p.id===po.id)
 }
 await receipt(1,'synthetic-mallet-915');v=await refresh()
 assert.ok(v.current.blockers.some(b=>b.source.id===po.id),'ADV-003 partial receiving leaves ordered demand unresolved')
 assert.equal(v.current.sources.parts.filter(c=>c.kind==='purchaseReceipt').length,1)
 await receipt(1,'synthetic-mallet-916');v=await refresh()
 assert.ok(!v.current.blockers.some(b=>b.source.id===po.id));assert.ok(v.tasks.find(t=>t.source.id===po.id).resolution)
 assert.ok(v.current.blockers.some(b=>b.source.id===plan.id),'ADV-003 goods receipt never fulfills a separate staff-tracked requirement')
 plan=await h.command('promise.partETA',{jobId,version:(await job()).version,planVersion:plan.version,...eta,receivedAt:new Date(Date.now()-60000).toISOString(),sourceNote:'Physical item matched at receiving'})
 v=await refresh();assert.equal(v.current.blockers.length,0)
 po=await h.command('purchase.create',{...poInput,reference:'synthetic-mallet-917'})
 po=await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Approve replacement demand'})
 v=await refresh();assert.ok(v.current.blockers.some(b=>b.source.id===po.id))
 await h.command('purchase.shortClose',{purchaseId:po.id,version:po.version,reason:'Supplier canceled demand; this is not physical receipt'})
 v=await refresh();assert.ok(v.current.blockers.some(b=>b.source.id===po.id));assert.equal(v.tasks.find(t=>t.source.id===po.id).resolution,null,'ADV-003 short-close never fabricates physical arrival')
 assert.equal(v.current.progress.remainingHours,1);assert.equal(v.current.progress.recordedActuals,1)
}
