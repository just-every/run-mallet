import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {handoverInput} from './handover-input.mjs'
import {refuseChangedReturnRevision} from './return-revision.mjs'
export async function readyInvoice(h,{asset,reviewer,technicianId,free=false,failedQuality=false,onFailed}={}){
 let {job}=await booking(h,{asset,technicianId}),q=await authorise(h,free?await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'labor',description:'Covered no-charge labor',quantity:1,unitCents:0}]}):await estimate(h,job));job=(await h.state()).records.job.find(j=>j.id===job.id)
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1})
 await h.command('job.complete',{jobId:job.id,version:job.version},{status:409})
 if(failedQuality){
  assert.ok(reviewer,'An independent reviewer is required for the failed-quality collection journey')
  let quality
  const check=(command,more={},options={})=>h.command(command,{jobId:job.id,version:job.version,qualityVersion:quality?.version??0,...more},options)
  quality=await check('quality.configure',{reason:'Physical checks before cash collection',items:[{label:'Before-work condition',stage:'pre',required:true,critical:false},{label:'Post-work brake function',stage:'post',required:true,critical:true}]})
  const [pre,post]=quality.revisions.at(-1).items
  quality=await check('quality.record',{itemId:pre.id,outcome:'pass',note:'Condition inspected before the recorded work'})
  quality=await check('quality.record',{itemId:post.id,outcome:'fail',note:'Brake function failed the physical collection check'})
  const failed=structuredClone(quality.results.at(-1))
  const signTechnician=()=>check('quality.signTechnician',{qualification:'Qualified repair technician',note:'Personally inspected the current work and brake function'})
  const signQuality=safetyDecision=>check('quality.signQuality',{qualification:'Independent qualified shop reviewer',note:'Independent physical collection inspection',safetyDecision},{as:reviewer.cookie})
  quality=await signTechnician();quality=await signQuality('unsafe')
  const before=await h.state(),board=await h.api('/api/mallet/board'),input={jobId:job.id,version:job.version,flowVersion:before.records.flow?.find(f=>f.jobId===job.id)?.version??0,collectorName:job.asset.customerName}
  assert.equal((await h.command('job.complete',{jobId:job.id,version:job.version},{status:409})).error,'QUALITY_BLOCKED')
  assert.equal((await h.command('flow.collect',input,{status:409})).error,'NOT_READY')
  assert.deepEqual((await h.state()).records,before.records,'Failed quality and unpaid collection preserve work, quality, payment and handover history')
  assert.deepEqual(await h.api('/api/mallet/board'),board,'Refused collection leaves the failed repair on its prior board stage')
  assert.equal(before.records.invoice?.some(i=>i.jobId===job.id)??false,false)
  assert.equal(before.records.handover?.some(r=>r.jobId===job.id)??false,false)
  await onFailed?.({job,quality,failed,input})
  job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1,note:'Authorized corrective brake work after the failed check'})
  quality=await check('quality.correct',{failedResultId:failed.id,workId:job.actuals.at(-1).id,reason:'Corrected the failed brake function before any collection'})
  quality=await check('quality.record',{itemId:post.id,outcome:'pass',note:'Physical brake retest passed after the recorded correction'})
  quality=await signTechnician();quality=await signQuality('safe')
  assert.deepEqual(quality.results.find(r=>r.id===failed.id),failed,'Correction retains the original failed quality evidence')
  assert.equal(quality.corrections.at(-1).failedResultId,failed.id)
 }else await qualityReady(h,job,{reviewer})
 job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 job=(await h.state()).records.job.find(j=>j.id===job.id);return {job,invoice}
}
export function stripeEdge(){
 const receipts=new Map(),calls=[];let fail=false,hook=null
 const edge=async request=>{const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');assert.equal(request.method,'GET');assert.equal(request.headers.get('authorization'),'Bearer synthetic-mallet-91');calls.push(url.pathname);if(hook){const f=hook;hook=null;await f()}if(fail)return new Response('Unavailable',{status:503});const id=decodeURIComponent(url.pathname.split('/').at(-1));return Response.json(receipts.get(id)??{error:'unknown'})}
 const paid=(id,invoice,amount=invoice.totals.totalCents)=>({id,status:'succeeded',currency:'usd',amount_received:amount,metadata:{mallet_invoice_id:invoice.id},livemode:true,latest_charge:{id:'synthetic-mallet-charge',paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount}})
 return {edge,receipts,calls,paid,setFailure(value){fail=value},setHook(value){hook=value}}
}
export function assertRecordedAt(at,before,after){
 assert.equal(new Date(at).toISOString(),at,'The recording time is a retained UTC timestamp')
 assert.ok(at>=before&&at<=after,'The recording time belongs to the public action that created it')
}
export function assertDelegateEvidence(saved,input,recorder,before,after){
 assert.ok(saved,'Public state retains the delegate authorization')
 for(const field of ['jobId','customerName','delegateName','consent','evidence'])assert.deepEqual(saved[field],input[field],'Saved delegate '+field+' matches the entered authorization')
 assert.deepEqual(saved.by,recorder,'The authorization names its actual staff recorder')
 assert.equal(saved.revoked,null)
 assertRecordedAt(saved.at,before,after)
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
  let sales=await h.api('/api/mallet/reports/sales');assert.equal(sales.closeFunnel.collected,1);assert.equal(sales.closeFunnel.closed,0);assert.equal(sales.closeFunnel.closeRatioTenths,0)
  const currentInvoice=(await h.state()).records.invoice.find(i=>i.id===invoice.id);await h.command('invoice.export',{invoiceId:invoice.id,version:currentInvoice.version})
  sales=await h.api('/api/mallet/reports/sales');assert.equal(sales.closeFunnel.estimated,1);assert.equal(sales.closeFunnel.approved,1);assert.equal(sales.closeFunnel.completed,1);assert.equal(sales.closeFunnel.collected,1);assert.equal(sales.closeFunnel.closed,1);assert.equal(sales.closeFunnel.closeRatioTenths,1000);assert.equal(sales.closeFunnel.sources[0].jobId,job.id)
  const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'handover-recovery@example.test'}})
  try{await restore(fresh,backup);const restored=await fresh.state();for(const kind of ['handover','returnDelegate','returnOverride','payment'])assert.deepEqual(restored.records[kind],(await h.state()).records[kind]);assert.ok(!JSON.stringify(backup).includes('synthetic-mallet-91'));assert.ok(!JSON.stringify(backup).includes('synthetic-mallet-95'));await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
  // The separate owner exception is itself retained and never marks an invoice paid.
  const {customersFixture}=await import('./customers-journey.mjs'),cf=await customersFixture(h),account=await h.command('customer.save',cf.input);let otherAsset=await h.command('asset.create',{customerName:'Second Customer',customerEmail:'second@example.test',label:'Second vehicle',identifier:'synthetic-mallet-97'});otherAsset=await h.command('customer.linkAsset',{assetId:otherAsset.id,version:otherAsset.version,customerId:account.id,customerVersion:account.version,reason:'Owner reviewed private payer details'});const second=await readyInvoice(h,{asset:otherAsset}),unpaid=await handoverInput(h,second.job.id,'Second Customer');assert.ok(second.invoice.billing)
  const pendingArchive=await archive(h),destination=await installation({bindings:{OWNER_EMAIL:'pending-handover-recovery@example.test'}})
  try{await restore(destination,pendingArchive);await destination.command('flow.collect',unpaid,{status:409});assert.equal((await destination.state()).records.handover.length,1,'An archived owner exception grants no fresh-installation authority')}finally{await destination.close()}
  const overridden=await h.command('flow.collect',unpaid),r=(await h.state()).records.handover.find(r=>r.id===overridden.collection.handoverId);assert.equal(r.invoice.billing,undefined);assert.ok(!(await h.state({as:advisor.cookie})).records.handover.some(r=>r.invoice.billing));assert.equal(r.settlement.verifiedCents,0);assert.equal(r.settlement.override.id,unpaid.overrideId);assert.match(r.settlement.label,/not verified/);assert.match(r.settlement.label,/possessory lien/)
  for(const [n,method]of ['cash','check','other'].entries()){
   const asset=await h.command('asset.create',{customerName:'Tender customer '+method,label:'Tender pickup',identifier:'synthetic-mallet-'+(103+n)}),manual=await readyInvoice(h,{asset,reviewer:advisor,failedQuality:method==='cash'}),pickup=await handoverInput(h,manual.job.id,method==='cash'?'Cash-authorized collector':asset.customerName);delete pickup.overrideId
   const recorder=(await h.state({as:advisor.cookie})).actor
   let authorization,delegateBefore,delegateAfter,savedDelegate
   if(method==='cash'){
    authorization={jobId:manual.job.id,version:pickup.version,customerName:'Tender customer cash',delegateName:'Cash-authorized collector',consent:true,evidence:'Customer signed collection authority synthetic-mallet-118 for this cash repair'}
    delegateBefore=new Date().toISOString()
    const recorded=await h.command('return.delegate',authorization,{as:advisor.cookie});delegateAfter=new Date().toISOString();pickup.delegateId=recorded.id
    savedDelegate=(await h.state()).records.returnDelegate.find(d=>d.id===recorded.id)
    assertDelegateEvidence(savedDelegate,authorization,recorder,delegateBefore,delegateAfter)
    pickup.identityEvidence='Advisor checked the cash collector in person against the signed authority; no identity document copied'
   }
   const allocation={jobId:manual.job.id,invoiceId:manual.invoice.id,version:manual.invoice.version,invoiceRevision:manual.invoice.revision,method,amountCents:manual.invoice.totals.totalCents,reference:'synthetic-mallet-'+(106+n),evidence:'Staff counted '+method+' tender for this exact invoice'}
   await h.command('payment.record',{...allocation,invoiceRevision:manual.invoice.revision+1},{as:advisor.cookie,status:409})
   const payment=await h.command('payment.record',allocation,{as:advisor.cookie});assert.equal(payment.invoiceRevision,manual.invoice.revision);assert.equal(payment.verified,false)
   if(method==='cash')await refuseChangedReturnRevision(h,manual.invoice,pickup)
   // Export changes record version, not price revision; that cannot invalidate exact-revision tender.
   await h.command('invoice.export',{invoiceId:manual.invoice.id,version:manual.invoice.version});pickup.version=(await h.state()).records.job.find(j=>j.id===manual.job.id).version
   const beforeCalls=edge.calls.length,handoverBefore=new Date().toISOString();edge.setFailure(true);const collected=await h.command('flow.collect',pickup,{as:advisor.cookie});const handoverAfter=new Date().toISOString();edge.setFailure(false);assert.equal(edge.calls.length,beforeCalls,'Full manual tender needs no processor observation')
   const saved=(await h.state()).records.handover.find(r=>r.id===collected.collection.handoverId);assert.equal(saved.settlement.override,null);assert.equal(saved.settlement.verifiedCents,0);assert.equal(saved.settlement.tender.recordedCents,manual.invoice.totals.totalCents);assert.match(saved.settlement.label,/Tender recorded by staff; Mallet did not verify funds/);assert.equal(saved.settlement.label.includes('not cleared'),method==='check')
   const printable=await (await h.request('/app/handovers/'+saved.id+'/print')).text();assert.ok(printable.includes('Staff-recorded tender for invoice revision'));assert.ok(printable.includes(saved.settlement.label))
   if(method==='cash'){
    assert.equal(saved.jobId,manual.job.id);assert.equal(saved.assetId,asset.id);assert.equal(saved.invoiceId,manual.invoice.id)
    assert.equal(saved.collectorName,'Cash-authorized collector');assert.equal(saved.identityEvidence,pickup.identityEvidence);assert.equal(saved.identityVerifiedByMallet,false)
    assert.deepEqual(saved.by,recorder);assertRecordedAt(saved.at,handoverBefore,handoverAfter);assert.equal(collected.collection.at,saved.at)
    assertDelegateEvidence(saved.delegate,authorization,recorder,delegateBefore,delegateAfter);assert.deepEqual(saved.delegate,savedDelegate)
    for(const text of [authorization.customerName,authorization.delegateName,authorization.evidence,pickup.identityEvidence,recorder.name])assert.ok(printable.includes(text),'Printable cash receipt retains '+text)
    const immutable=(await h.state()).records
    await h.command('return.delegate',{...authorization,evidence:'Attempted replacement after handover'},{as:advisor.cookie,status:409})
    await h.command('return.revokeDelegate',{jobId:manual.job.id,version:pickup.version,delegateId:savedDelegate.id,delegateVersion:savedDelegate.version,reason:'Attempted post-handover revocation'},{as:advisor.cookie,status:409})
    await h.command('flow.collect',pickup,{as:advisor.cookie,status:409})
    assert.deepEqual((await h.state()).records,immutable,'Replacement, revocation and replay cannot overwrite the saved handover or authorization')
    const recovered=await installation()
    try{
     const freshOwner=(await recovered.state()).actor;await restore(recovered,await archive(h));const restored=await recovered.state()
     assert.equal(restored.actor.id,freshOwner.id);assert.notEqual(restored.actor.id,recorder.id)
     for(const kind of ['handover','returnDelegate','returnOverride','payment','flow','quality'])assert.deepEqual(restored.records[kind],immutable[kind],'Fresh-owner recovery retains exact '+kind+' evidence')
     const recoveredReceipt=restored.records.handover.find(r=>r.id===saved.id);assert.deepEqual(recoveredReceipt,saved)
     await recovered.command('flow.collect',pickup,{as:advisor.cookie,status:401});await recovered.command('flow.collect',pickup,{...bearer,status:401})
     await recovered.command('return.delegate',authorization,{status:409});await recovered.command('flow.collect',pickup,{status:409})
     assert.deepEqual((await recovered.state()).records,restored.records,'Recovered history restores neither old credentials nor permission to replace a collection')
    }finally{await recovered.close()}
   }
  }
  const freeAsset=await h.command('asset.create',{customerName:'Warranty Customer',customerEmail:'free@example.test',label:'No-charge rework vehicle',identifier:'synthetic-mallet-100'}),free=await readyInvoice(h,{asset:freeAsset,free:true}),freeInput=await handoverInput(h,free.job.id,'Warranty Customer');delete freeInput.overrideId
  const freeFlow=await h.command('flow.collect',freeInput),freeReceipt=(await h.state()).records.handover.find(r=>r.id===freeFlow.collection.handoverId);assert.equal(freeReceipt.invoice.totals.totalCents,0);assert.equal(freeReceipt.settlement.receipts.length,0);assert.match(freeReceipt.settlement.label,/No payment due/);assert.doesNotMatch(freeReceipt.settlement.label,/Stripe confirmed/)

 }finally{await h.close()}
}
