import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {handoverInput} from './handover-input.mjs'
import {refuseChangedReturnRevision} from './return-revision.mjs'
export async function readyInvoice(h,{asset,reviewer,technicianId,free=false}={}){
 let {job}=await booking(h,{asset,technicianId}),q=await authorise(h,free?await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'labor',description:'Covered no-charge labor',quantity:1,unitCents:0}]}):await estimate(h,job));job=(await h.state()).records.job.find(j=>j.id===job.id)
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1})
 await h.command('job.complete',{jobId:job.id,version:job.version},{status:409})
 await qualityReady(h,job,{reviewer});job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 job=(await h.state()).records.job.find(j=>j.id===job.id);return {job,invoice}
}
export function stripeEdge(){
 const receipts=new Map(),calls=[];let fail=false,hook=null
 const edge=async request=>{const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');assert.equal(request.method,'GET');assert.equal(request.headers.get('authorization'),'Bearer synthetic-mallet-91');calls.push(url.pathname);if(hook){const f=hook;hook=null;await f()}if(fail)return new Response('Unavailable',{status:503});const id=decodeURIComponent(url.pathname.split('/').at(-1));return Response.json(receipts.get(id)??{error:'unknown'})}
 const paid=(id,invoice,amount=invoice.totals.totalCents)=>({id,status:'succeeded',currency:'usd',amount_received:amount,metadata:{mallet_invoice_id:invoice.id},livemode:true,latest_charge:{id:'synthetic-mallet-charge',paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount}})
 return {edge,receipts,calls,paid,setFailure(value){fail=value},setHook(value){hook=value}}
}
export async function returnJourney(){
 const edge=stripeEdge(),h=await installation({bindings:{STRIPE_SECRET_KEY:'synthetic-mallet-91'},outboundService:edge.edge})
 try{
  await shopSetup(h)
  const {job,invoice}=await readyInvoice(h),input=await handoverInput(h,job.id,'Authorized collector'),{overrideId,...settledInput}=input
  const member=await h.person('return-tech@example.test'),advisor=await h.person('return-advisor@example.test','admin'),key=await h.command('agent.create',{label:'No return authority'}),bearer={as:'',headers:{authorization:'Bearer '+key.token}}
  const baseline=(await h.state()).records
  await h.command('flow.collect',{...settledInput,settlementVersion:999,settlementReceipts:[{amountCents:999999}]},{status:409})
  for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403},{headers:{origin:'https://other.test'},status:403}])await h.command('flow.collect',settledInput,options)
  await h.command('return.override',{jobId:job.id,version:input.version,reason:'Not the owner'},{as:advisor.cookie,status:403})
  await h.command('payment.verified',{invoiceId:invoice.id,version:invoice.version,receipt:{amountCents:999999}},{status:404})
  await h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:'synthetic-mallet-92'},{...bearer,status:403})
  assert.deepEqual((await h.state()).records,baseline,'Denied release and forged settlement write nothing')
  const verify=id=>h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:id})
  const wrong=edge.paid('synthetic-mallet-92',invoice);wrong.metadata.mallet_invoice_id='different-invoice';edge.receipts.set(wrong.id,wrong);await h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:wrong.id},{status:409})
  edge.receipts.set(wrong.id,{...edge.paid(wrong.id,invoice),status:'processing'});await h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:wrong.id},{status:409})
  const disputed=edge.paid(wrong.id,invoice);disputed.latest_charge.disputed=true;edge.receipts.set(wrong.id,disputed);await h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:wrong.id},{status:409})
  edge.receipts.set(wrong.id,{...edge.paid(wrong.id,invoice),livemode:false});await h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:wrong.id},{status:409});assert.equal((await h.state()).records.payment?.length??0,0,'Production refuses disputed and test-mode receipts without allocations')
  edge.setFailure(true);await h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:wrong.id},{status:502});edge.setFailure(false)
  const half=Math.floor(invoice.totals.totalCents/2),a=edge.paid('synthetic-mallet-93',invoice,half),b=edge.paid('synthetic-mallet-94',invoice,invoice.totals.totalCents-half);edge.receipts.set(a.id,a);edge.receipts.set(b.id,b)
  const first=await verify(a.id);assert.equal(first.receipt.livemode,true);assert.deepEqual(await verify(a.id),first);await h.command('flow.collect',settledInput,{status:409})
  await verify(b.id);const paidState=(await h.state()).records.payment;assert.equal(paidState.reduce((n,p)=>n+p.amountCents,0),invoice.totals.totalCents)
  a.latest_charge.disputed=true;await h.command('flow.collect',settledInput,{status:409});a.latest_charge.disputed=false
  a.livemode=false;await h.command('flow.collect',settledInput,{status:409});a.livemode=true
  a.latest_charge.refunded=true;await h.command('flow.collect',settledInput,{status:409});a.latest_charge.refunded=false
  await h.command('flow.collect',{...settledInput,delegateId:''},{status:409})
  await h.command('return.revokeDelegate',{jobId:job.id,version:input.version,delegateId:input.delegateId,delegateVersion:1,reason:'Customer withdraws authority'})
  await h.command('flow.collect',settledInput,{status:409})
  const delegate=await h.command('return.delegate',{jobId:job.id,version:input.version,customerName:job.asset.customerName,delegateName:input.collectorName,evidence:'Customer expressly re-authorized this collector',consent:true});settledInput.delegateId=delegate.id
  await h.command('flow.collect',{...settledInput,comparisonId:'unknown'},{status:404});await h.command('flow.collect',{...settledInput,readingId:'unknown'},{status:409})
  const comparison=(await h.state()).records.intakeComparison.find(r=>r.id===settledInput.comparisonId),newComparison=await h.command('intake.compare',{jobId:job.id,version:input.version,intakeId:comparison.intakeId,returned:comparison.returned.map(r=>({itemId:r.id,quantity:r.returnedQuantity})),signedBy:input.collectorName,consent:true});settledInput.version=(await h.state()).records.job.find(j=>j.id===job.id).version;await h.command('flow.collect',settledInput,{status:409});settledInput.comparisonId=newComparison.id
  const secret=await h.command('intake.secretStore',{jobId:job.id,purpose:'Final unlock check',secret:'synthetic-mallet-95',expiresAt:new Date(Date.now()+600000).toISOString(),consent:true})
  // Current provider evidence is read under the command's still-current session and state fence.
  const revocable=await h.person('revocable-return-advisor@example.test','admin');edge.setHook(async()=>{await h.api('/auth/operator/status',{operatorId:revocable.id,status:'inactive'})});await h.command('flow.collect',settledInput,{as:revocable.cookie,status:409});assert.equal((await h.state()).records.handover?.length??0,0,'Revoked authority cannot finish a collection after provider fetch')
  const flow=await h.command('flow.collect',settledInput,{as:advisor.cookie}),final=await h.state(),receipt=final.records.handover.find(r=>r.id===flow.collection.handoverId)
  assert.equal(receipt.collectorName,input.collectorName);assert.equal(receipt.delegate.id,delegate.id);assert.equal(receipt.settlement.verifiedCents,invoice.totals.totalCents);assert.equal(receipt.settlement.override,null);assert.equal(receipt.comparison.returned[0].returnedQuantity,1);assert.equal(receipt.mileage.value,65000);assert.equal(receipt.identityVerifiedByMallet,false);assert.ok(receipt.warrantyAdvice.includes('paper receipt'));assert.equal(receipt.quality.reviewer.safetyDecision,'safe')
  await h.command('intake.secretReveal',{jobId:job.id,secretId:secret.id,reason:'After release'},{status:404});await h.command('intake.secretStore',{jobId:job.id,purpose:'Too late',secret:'synthetic-mallet-96',expiresAt:new Date(Date.now()+600000).toISOString(),consent:true},{status:409})
  await h.command('flow.collect',settledInput,{status:409});assert.equal((await h.state()).records.handover.length,1)
  const page=await h.request('/app/handovers/'+receipt.id+'/print');assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');assert.ok((await page.text()).includes(receipt.warrantyAdvice));await h.request('/app/handovers/'+receipt.id+'/print',{as:''}).then(r=>assert.equal(r.status,303));assert.equal((await h.request('/app/handovers/'+receipt.id+'/print',bearer)).status,403)
  const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'handover-recovery@example.test'}})
  try{await restore(fresh,backup);const restored=await fresh.state();for(const kind of ['handover','returnDelegate','returnOverride','payment'])assert.deepEqual(restored.records[kind],(await h.state()).records[kind]);assert.ok(!JSON.stringify(backup).includes('synthetic-mallet-91'));assert.ok(!JSON.stringify(backup).includes('synthetic-mallet-95'));await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
  // The separate owner exception is itself retained and never marks an invoice paid.
  const {customersFixture}=await import('./customers-journey.mjs'),cf=await customersFixture(h),account=await h.command('customer.save',cf.input);let otherAsset=await h.command('asset.create',{customerName:'Second Customer',customerEmail:'second@example.test',label:'Second vehicle',identifier:'synthetic-mallet-97'});otherAsset=await h.command('customer.linkAsset',{assetId:otherAsset.id,version:otherAsset.version,customerId:account.id,customerVersion:account.version,reason:'Owner reviewed private payer details'});const second=await readyInvoice(h,{asset:otherAsset}),unpaid=await handoverInput(h,second.job.id,'Second Customer');assert.ok(second.invoice.billing)
  const pendingArchive=await archive(h),destination=await installation({bindings:{OWNER_EMAIL:'pending-handover-recovery@example.test'}})
  try{await restore(destination,pendingArchive);await destination.command('flow.collect',unpaid,{status:409});assert.equal((await destination.state()).records.handover.length,1,'An archived owner exception grants no fresh-installation authority')}finally{await destination.close()}
  const overridden=await h.command('flow.collect',unpaid),r=(await h.state()).records.handover.find(r=>r.id===overridden.collection.handoverId);assert.equal(r.invoice.billing,undefined);assert.ok(!(await h.state({as:advisor.cookie})).records.handover.some(r=>r.invoice.billing));assert.equal(r.settlement.verifiedCents,0);assert.equal(r.settlement.override.id,unpaid.overrideId);assert.match(r.settlement.label,/not verified/);assert.match(r.settlement.label,/possessory lien/)
  for(const [n,method]of ['cash','check','other'].entries()){
   const asset=await h.command('asset.create',{customerName:'Tender customer '+method,label:'Tender pickup',identifier:'synthetic-mallet-'+(103+n)}),manual=await readyInvoice(h,{asset}),pickup=await handoverInput(h,manual.job.id,asset.customerName);delete pickup.overrideId
   const allocation={jobId:manual.job.id,invoiceId:manual.invoice.id,version:manual.invoice.version,invoiceRevision:manual.invoice.revision,method,amountCents:manual.invoice.totals.totalCents,reference:'synthetic-mallet-'+(106+n),evidence:'Staff counted '+method+' tender for this exact invoice'}
   await h.command('payment.record',{...allocation,invoiceRevision:manual.invoice.revision+1},{as:advisor.cookie,status:409})
   const payment=await h.command('payment.record',allocation,{as:advisor.cookie});assert.equal(payment.invoiceRevision,manual.invoice.revision);assert.equal(payment.verified,false)
   if(method==='cash')await refuseChangedReturnRevision(h,manual.invoice,pickup)
   // Export changes record version, not price revision; that cannot invalidate exact-revision tender.
   await h.command('invoice.export',{invoiceId:manual.invoice.id,version:manual.invoice.version});pickup.version=(await h.state()).records.job.find(j=>j.id===manual.job.id).version
   const beforeCalls=edge.calls.length;edge.setFailure(true);const collected=await h.command('flow.collect',pickup,{as:advisor.cookie});edge.setFailure(false);assert.equal(edge.calls.length,beforeCalls,'Full manual tender needs no processor observation')
   const saved=(await h.state()).records.handover.find(r=>r.id===collected.collection.handoverId);assert.equal(saved.settlement.override,null);assert.equal(saved.settlement.verifiedCents,0);assert.equal(saved.settlement.tender.recordedCents,manual.invoice.totals.totalCents);assert.match(saved.settlement.label,/Tender recorded by staff; Mallet did not verify funds/);assert.equal(saved.settlement.label.includes('not cleared'),method==='check')
   const printable=await (await h.request('/app/handovers/'+saved.id+'/print')).text();assert.ok(printable.includes('Staff-recorded tender for invoice revision'));assert.ok(printable.includes(saved.settlement.label))
  }
  const freeAsset=await h.command('asset.create',{customerName:'Warranty Customer',customerEmail:'free@example.test',label:'No-charge rework vehicle',identifier:'synthetic-mallet-100'}),free=await readyInvoice(h,{asset:freeAsset,free:true}),freeInput=await handoverInput(h,free.job.id,'Warranty Customer');delete freeInput.overrideId
  const freeFlow=await h.command('flow.collect',freeInput),freeReceipt=(await h.state()).records.handover.find(r=>r.id===freeFlow.collection.handoverId);assert.equal(freeReceipt.invoice.totals.totalCents,0);assert.equal(freeReceipt.settlement.receipts.length,0);assert.match(freeReceipt.settlement.label,/No payment due/);assert.doesNotMatch(freeReceipt.settlement.label,/Stripe confirmed/)

 }finally{await h.close()}
}
