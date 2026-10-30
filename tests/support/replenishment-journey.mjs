import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
export async function replenishmentFixture(h){
 const f=await inventoryFixture(h),{job:booked}=await booking(h),q=await authorise(h,await estimate(h,booked))
 let job=(await h.state()).records.job[0]
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:2})
 const lot=await h.command('stock.lot',{...f.scans,quantity:3,supplier:'Cedar Parts',supplierLot:'synthetic-mallet-70',serial:'',reference:'synthetic-mallet-71',unitCostCents:1000,evidence:'Synthetic supplier lot'})
 const po=await h.command('purchase.create',{reference:'synthetic-mallet-72',supplier:'Cedar Parts',shipTo:'Shelf A',expectedAt:'2026-11-01T12:00:00Z',binId:f.bin.id,lines:[{itemId:f.item.id,quantity:2,unitCents:1000}],taxCents:0,freightCents:0})
 await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Outstanding stock order'})
 await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:lot.id,quantity:2,reference:'synthetic-mallet-73',reason:'Installed pads'})
 return {...f,job,lot,policy:{itemId:f.item.id,binId:f.bin.id,minimum:4,maximum:10,demand:1,supplier:'Cedar Parts',unitCents:1000,shipTo:'Shelf A',expectedAt:'2026-11-01T12:00:00Z'}}
}
export async function replenishmentJourney(h){
 const f=await replenishmentFixture(h),member=await h.person('stock-demand@example.test')
 for(const command of ['stock.replenishment','stock.replenish'])for(const options of [{as:'',status:401},{as:member.cookie,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,f.policy,options)
 await h.command('stock.replenishment',{...f.policy,minimum:11},{status:400})
 let policy=await h.command('stock.replenishment',f.policy)
 let report=await h.api('/api/mallet/replenishment');assert.deepEqual(report.map(r=>[r.availableMilli,r.openOrderMilli,r.projectedMilli,r.suggestedMilli]),[[1000,2000,2000,8000]])
 const first=await h.command('stock.replenish'),second=await h.command('stock.replenish');assert.equal(first.placed,false);assert.deepEqual(second.drafts,first.drafts);assert.equal(first.drafts[0].lines[0].quantityMilli,8000);assert.equal(first.drafts[0].approval,null);assert.equal(first.drafts[0].totalCents,8000)
 let po=first.drafts[0]
 const reserve=await h.command('stock.reserve',{...f.scans,jobId:f.job.id,quantity:1,reference:'synthetic-mallet-74'})
 await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Stale demand'},{status:409})
 const refreshed=await h.command('stock.replenish');po=refreshed.drafts[0];assert.equal(po.lines[0].quantityMilli,9000);assert.notEqual(po.id,first.drafts[0].id)
 await h.command('purchase.approve',{purchaseId:first.drafts[0].id,version:2,reason:'Superseded draft'},{status:409})
 policy=await h.command('stock.replenishment',{...f.policy,version:policy.version,unitCents:1100})
 await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Stale price'},{status:409})
 po=(await h.command('stock.replenish')).drafts[0];assert.equal(po.totalCents,9900)
 po=await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Approve exact refreshed cart'})
 assert.equal(po.approval.totalCents,9900);assert.deepEqual(po.approval.lines,po.lines)
 assert.deepEqual((await h.command('stock.replenish')).drafts,[])
 report=await h.api('/api/mallet/replenishment');assert.equal(report[0].openOrderMilli,11000);assert.equal(report[0].suggestedMilli,0);assert.equal((await h.state()).records.purchaseOrder.filter(p=>p.approval).length,2)
 assert.equal((await h.request('/app/inventory/replenishment',{as:member.cookie})).status,403);await h.api('/api/mallet/replenishment',undefined,{as:member.cookie,status:403});assert.equal((await h.state({as:member.cookie})).records.stockReplenishment,undefined)
 const records=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'replenishment-recovery@example.test'}})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,records);assert.deepEqual(await fresh.api('/api/mallet/replenishment'),report);assert.deepEqual((await fresh.command('stock.replenish')).drafts,[])}finally{await fresh.close()}
 assert.equal(h.messages.length,1,'Only the staff invitation; no supplier order has been sent')
 // The same unlocated stock order cannot reduce demand at two locations.
 const bin=await h.command('stock.bin',{code:'Shelf B',barcode:'synthetic-mallet-75'})
 await h.command('stock.replenishment',{...f.policy,binId:bin.id,demand:0})
 const unlocated=await h.command('purchase.create',{reference:'synthetic-mallet-76',supplier:'Cedar Parts',shipTo:'Receiving',expectedAt:f.policy.expectedAt,lines:[{itemId:f.item.id,quantity:1,unitCents:1000}],taxCents:0,freightCents:0})
 await h.command('purchase.approve',{purchaseId:unlocated.id,version:unlocated.version,reason:'One unlocated stock unit'})
 report=await h.api('/api/mallet/replenishment');assert.equal(report.reduce((n,r)=>n+r.openOrderMilli,0),12000)
}

// Exercise the actual supplier transport while replacing only its network edge.
export async function replenishmentOrderingJourney(){
 const {supplierEdge}=await import('./supplier-edge.mjs'),clock='2026-10-30T12:00:00Z',edge=supplierEdge({now:Date.parse(clock)}),options={clock,bindings:{MALLET_SUPPLIER_ORIGIN:edge.origin,MALLET_SUPPLIER_KEY:edge.key},outboundService:edge.fetch},h=await installation(options)
 const posts=()=>edge.calls.filter(c=>c.method==='POST'&&c.path==='/v1/orders')
 try{
  const f=await replenishmentFixture(h);let policy=await h.command('stock.replenishment',f.policy),sequence=300
  const prepare=async(quantityMilli,totalCents)=>{
   const first=await h.command('stock.replenish'),second=await h.command('stock.replenish');assert.deepEqual(second,first);assert.equal(first.placed,false)
   let source=first.drafts[0];assert.equal(source.lines[0].quantityMilli,quantityMilli)
   // A prior unquoted approval never grants approval for a new supplier quote.
   source=await h.command('purchase.approve',{purchaseId:source.id,version:source.version,reason:'Review replenishment source before requesting exact quotes'})
   const input={itemId:f.item.id,quantity:quantityMilli/1000,replenishmentPurchaseId:source.id,replenishmentPurchaseVersion:source.version}
   const before=edge.calls.length
   await h.command('purchase.compare',{...input,quantity:quantityMilli/1000+1},{status:409});assert.equal(edge.calls.length,before)
   const comparison=await h.command('purchase.compare',input),competing=sequence===300?await h.command('purchase.compare',input):null
   assert.deepEqual(comparison.offers.map(q=>[q.supplierName,q.grade,q.quantityMilli,q.unitCents,q.taxCents,q.freightCents,q.totalCents]),[['Cedar Parts','OE-equivalent',quantityMilli,1000,100,200,totalCents],['Maple Parts','Remanufactured',quantityMilli,900,90,500,quantityMilli*9/10+590]])
   const cart={comparisonId:comparison.id,quoteId:comparison.offers[0].quoteId,reference:'synthetic-mallet-'+sequence++,shipTo:'Shelf A',binId:f.bin.id}
   await h.command('purchase.cart',{...cart,shipTo:'Another destination'},{status:409})
   let po=await h.command('purchase.cart',cart);assert.equal(po.approval,null);assert.equal(po.binId,f.bin.id);assert.equal(po.policyVersion,policy.version);assert.equal(po.replenishmentId,policy.id);assert.equal(po.replenishmentSource.purchaseId,source.id);assert.equal(po.replenishmentSource.purchaseVersion,source.version);assert.deepEqual(po.calculation,source.calculation);assert.deepEqual(po.lines.map(l=>[l.itemId,l.quantityMilli,l.unitCents,l.jobId]),[[f.item.id,quantityMilli,1000,null]])
   if(competing){const before=(await h.state()).records;await h.command('purchase.cart',{...cart,comparisonId:competing.id,reference:'synthetic-mallet-324'},{status:409});assert.deepEqual((await h.state()).records,before,'A second comparison cannot consume the same replenishment source twice')}
   const saved=(await h.state()).records.purchaseOrder.find(p=>p.id===source.id);assert.equal(saved.status,'superseded');assert.equal(saved.quotedPurchaseId,po.id);assert.deepEqual(saved.approval,source.approval)
   await h.command('purchase.submit',{purchaseId:po.id,version:po.version,confirm:'submit-exact-cart'},{status:409});assert.equal(posts().length,0)
   po=await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Approve exact quoted supplier, grade, quantity, destination, tax and freight'})
   assert.deepEqual([po.subtotalCents,po.taxCents,po.freightCents,po.totalCents],[totalCents-300,100,200,totalCents]);assert.deepEqual(po.approval.supplierQuote,po.supplierQuote);assert.deepEqual(po.approval.lines,po.lines);assert.equal(po.approval.shipTo,'Shelf A');assert.equal(po.approval.taxCents,100);assert.equal(po.approval.freightCents,200);assert.equal(po.approval.totalCents,totalCents)
   return po
  }
  const stale=async(po)=>{
   const before=(await h.state()).records
   const refusal=await h.command('purchase.submit',{purchaseId:po.id,version:po.version,confirm:'submit-exact-cart'},{status:409});assert.equal(refusal.error,'STALE_REPLENISHMENT');assert.equal(posts().length,0);assert.deepEqual((await h.state()).records,before)
  }
  let po=await prepare(8000,8300)
  const reservation=await h.command('stock.reserve',{...f.scans,jobId:f.job.id,quantity:1,reference:'synthetic-mallet-320'});await stale(po)
  po=await prepare(9000,9300)
  await h.command('stock.receive',{...f.scans,quantity:1,expectedQuantity:1,reference:'synthetic-mallet-321',reason:'Physical stock changed after exact approval'});await stale(po)
  po=await prepare(8000,8300)
  policy=await h.command('stock.replenishment',{...f.policy,version:policy.version,demand:2});await stale(po)
  po=await prepare(9000,9300)
  const extra=await h.command('purchase.create',{reference:'synthetic-mallet-322',supplier:'Cedar Parts',shipTo:'Shelf A',expectedAt:f.policy.expectedAt,binId:f.bin.id,lines:[{itemId:f.item.id,quantity:1,unitCents:1000}],taxCents:0,freightCents:0})
  await h.command('purchase.approve',{purchaseId:extra.id,version:extra.version,reason:'One additional outstanding stock order'});await stale(po)
  po=await prepare(8000,8300)
  // A release and matching new reservation keep totals equal, but change sources.
  await h.command('stock.release',{reservationId:reservation.id,version:reservation.version,reason:'Replace reservation source'})
  await h.command('stock.reserve',{...f.scans,jobId:f.job.id,quantity:1,reference:'synthetic-mallet-323'});await stale(po)
  po=await prepare(8000,8300)
  const expired=await installation({...options,clock:'2026-10-30T14:00:00Z'})
  try{
   await restore(expired,await archive(h));await expired.stepUp();const before=(await expired.state()).records
   const refusal=await expired.command('purchase.submit',{purchaseId:po.id,version:po.version,confirm:'submit-exact-cart'},{status:409});assert.equal(refusal.error,'SUPPLIER_QUOTE_STALE');assert.equal(posts().length,0);assert.deepEqual((await expired.state()).records,before,'Expired first-submission approval changes nothing after recovery')
  }finally{await expired.close()}
  await h.stepUp();const submit={purchaseId:po.id,version:po.version,confirm:'submit-exact-cart'}
  // A separately signed-in session has no fresh human confirmation.
  const unproven=await h.signInAs((await h.api('/auth/session')).operator.email)
  await h.command('purchase.submit',submit,{as:unproven,status:403});assert.equal(posts().length,0)
  await h.advanceClock('2026-10-30T12:06:00Z');const beforeConfirmation=(await h.state()).records
  const expiredProof=await h.command('purchase.submit',submit,{status:403});assert.equal(expiredProof.error,'step_up_required');assert.equal(posts().length,0);assert.deepEqual((await h.state()).records,beforeConfirmation)
  await h.stepUp()
  await h.command('purchase.submit',{...submit,confirm:'no'},{status:409});assert.equal(posts().length,0)
  let submission=await h.command('purchase.submit',submit);assert.equal(submission.status,'uncertain');assert.equal(posts().length,1);assert.equal(edge.orders.size,1)
  assert.deepEqual(posts()[0].body,{clientReference:po.id,supplierId:'synthetic-mallet-203',quoteId:'synthetic-mallet-201',currency:'USD',totalCents:8300,shipTo:'Shelf A',lines:[{sku:f.item.sku,grade:'OE-equivalent',unit:'each',quantityMilli:8000,unitCents:1000}]})
  assert.equal(submission.replenishmentSource.purchaseId,po.replenishmentSource.purchaseId);assert.equal(submission.binId,f.bin.id);assert.equal(submission.policyVersion,policy.version)
  await h.restart()
  const responses=await Promise.all([h.request('/api/mallet/commands',{method:'POST',body:{command:'purchase.submit',input:submit}}),h.request('/api/mallet/commands',{method:'POST',body:{command:'purchase.submit',input:submit}})])
  assert.equal(posts().length,1,'Concurrent replay must never repeat the supplier POST');assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>[200,409].includes(r.status)));submission=await h.command('purchase.submit',submit);assert.equal(submission.status,'acknowledged');assert.equal(posts().length,1);assert.equal(submission.orderId,'synthetic-mallet-210')
  const report=await h.api('/api/mallet/replenishment');assert.deepEqual(report.map(r=>[r.onHandMilli,r.reservedMilli,r.availableMilli,r.openOrderMilli,r.demandMilli,r.projectedMilli,r.suggestedMilli]),[[2000,1000,1000,11000,2000,10000,0]])
  assert.deepEqual((await h.command('stock.replenish')).drafts,[])
  const saved=(await h.state()).records,fresh=await installation({...options,clock:'2026-10-30T14:00:00Z'})
  try{
   await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,saved);assert.deepEqual(await fresh.api('/api/mallet/replenishment'),report)
   await fresh.state({as:h.owner,status:401});await fresh.command('purchase.submit',submit);assert.equal(posts().length,1,'An expired recovered claim remains a lookup, never a new POST')
   assert.equal((await fresh.api('/api/mallet/supplier-orders')).orders.find(p=>p.id===po.id).submission.orderId,'synthetic-mallet-210')
  }finally{await fresh.close()}
  await h.command('connector.revoke',{connector:'supplier-gateway',name:'MALLET_SUPPLIER_KEY'});const before=edge.calls.length
  await h.command('purchase.submit',submit,{status:503});assert.equal(edge.calls.length,before);assert.equal(posts().length,1)
 }finally{await h.close()}
}
