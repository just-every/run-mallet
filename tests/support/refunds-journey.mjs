import assert from 'node:assert/strict'
import {installation,archive,restore,booking,authorise,assetInput} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {portalSignIn} from './portal-journey.mjs'
export async function creditAccountFixture(h,suffix='1'){
 const contact=await h.command('contact.save',{name:'Credit payer '+suffix,email:'credit-'+suffix+'@example.test',phone:'',communication:'none',notes:''})
 const account=await h.command('customer.save',{name:'Credit household '+suffix,kind:'household',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,driverId:contact.id,taxStatus:'unknown',notes:''})
 return {contact,account}
}
export async function creditInvoice(h,account,suffix='1'){
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
 let asset=await h.command('asset.create',{...assetInput('credit-'+suffix),customerName:account.name})
 asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Recorded customer instruction'})
 let {job}=await booking(h,{asset,startAt:new Date(Date.now()+Number(suffix)*7200000).toISOString(),endAt:new Date(Date.now()+Number(suffix)*7200000+3600000).toISOString(),bayId:'Credit bay '+suffix})
 const estimate=await authorise(h,await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Returned accessory',quantity:3,unitCents:101},{kind:'part',description:'Replacement accessory',quantity:1,unitCents:200}]}))
 job=(await h.state()).records.job.find(j=>j.id===job.id)
 for(const l of estimate.revisions[0].lines)job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:l.id,quantity:l.quantity})
 await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version});invoice=(await h.state()).records.invoice.find(i=>i.id===invoice.id)
 return {invoice,exported,job}
}
export const creditInput=(invoice,payment,reference,line=invoice.lines[0],quantity=1)=>({invoiceId:invoice.id,version:invoice.version,paymentId:payment?.id,destination:payment?'original-tender':'account-credit',reference,reason:'Customer returned the accessory',consentEvidence:'Customer requested original tender or retained credit as reviewed',lines:[{lineId:line.id,sourceEstimateId:line.sourceEstimateId,sourceRevision:line.sourceRevision,quantity}]})
export async function issueCredit(h,input){const review=await h.command('credit.preview',input);return h.command('credit.issue',{...input,review,confirm:'issue-credit'})}
export const cashRefundPrivateText={reason:'synthetic-mallet-301 private return narrative',consentEvidence:'synthetic-mallet-302 private payer instruction',paymentEvidence:'synthetic-mallet-303 private cash custody',outcomeEvidence:'synthetic-mallet-304 private refund observation'}
export async function refundReadSnapshot(h){
 const records=(await h.state()).records,exports=[]
 for(const saved of records.export??[]){const response=await h.request('/api/mallet/exports/'+saved.id);assert.equal(response.status,200);exports.push({id:saved.id,bytes:await response.text()})}
 return {records,exports}
}
export async function refundsJourney(){
 const h=await installation()
 try{
  const {account,contact}=await creditAccountFixture(h),original=await creditInvoice(h,account),replacement=await creditInvoice(h,account,'2'),outsider=await creditAccountFixture(h,'2'),other=await creditInvoice(h,outsider.account,'3')
  const partialTender=await h.command('payment.record',{invoiceId:other.invoice.id,version:other.invoice.version,amountCents:100,method:'cash',reference:'synthetic-mallet-130',evidence:'Partial original cash tender'})
  const partialCredit=await issueCredit(h,creditInput(other.invoice,null,'synthetic-mallet-131',other.invoice.lines[0],0.9));assert.equal(partialCredit.totals.totalCents,98)
  await h.command('credit.preview',creditInput(other.invoice,partialTender,'synthetic-mallet-132',other.invoice.lines[0],0.1),{status:409})
  const otherLogin=await portalSignIn(h,outsider.contact.email,outsider.account.name),partialView=await h.api('/api/mallet/portal/billing',undefined,{as:otherLogin.cookie})
  assert.equal(partialView.invoices[0].paidCents,2);assert.equal(partialView.invoices[0].outstandingCents,441,'Backing moved to account credit cannot also reduce the original unpaid balance')
  const invoice=original.invoice,csv=await (await h.request('/api/mallet/exports/'+original.exported.id)).text()
  assert.deepEqual(invoice.totals,{currency:'USD',subtotalCents:503,salesTaxCents:38,totalCents:541})
  const inputNoPayment=creditInput(invoice,null,'synthetic-mallet-101')
  await h.command('credit.preview',inputNoPayment,{status:409})
  const payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:541,method:'cash',reference:'synthetic-mallet-102',evidence:cashRefundPrivateText.paymentEvidence})
  const otherCash=await creditInvoice(h,outsider.account,'4'),otherPayment=await h.command('payment.record',{invoiceId:otherCash.invoice.id,version:otherCash.invoice.version,amountCents:541,method:'cash',reference:'synthetic-mallet-305',evidence:'synthetic-mallet-306 other payer cash custody'})
  const otherNote=await issueCredit(h,{...creditInput(otherCash.invoice,otherPayment,'synthetic-mallet-307',otherCash.invoice.lines[1]),reason:'synthetic-mallet-308 other payer return narrative',consentEvidence:'synthetic-mallet-309 other payer instruction'})
  assert.equal(otherNote.totals.totalCents,215)
  await h.command('tax.configure',{ratePercent:20,partsTaxable:true,laborTaxable:true})
  const input={...creditInput(invoice,payment,'synthetic-mallet-103'),reason:cashRefundPrivateText.reason,consentEvidence:cashRefundPrivateText.consentEvidence},admin=await h.person(['refund-admin','example.test'].join('@'),'admin'),member=await h.person(['refund-member','example.test'].join('@')),agent=await h.command('agent.create',{label:'No refund authority'}),bearer={as:'',headers:{authorization:'Bearer '+agent.token}}
  const before=(await h.state()).records
  for(const command of ['credit.preview','credit.issue','credit.apply','credit.exchange','refund.record','refund.redirect','refund.submit','refund.reconcile'])for(const options of [{as:'',status:401},{as:admin.cookie,status:403},{as:member.cookie,status:403},{...bearer,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,input,options)
  for(const command of ['refund.claim','refund.outcome'])await h.command(command,input,{status:404})
  assert.deepEqual((await h.state()).records,before,'Unauthorized calls have no effects')
  const review=await h.command('credit.preview',input);assert.equal(review.totals.totalCents,109);assert.equal(review.totals.salesTaxCents,8)
  assert.deepEqual((await h.state()).records,before,'A credit preview writes nothing')
  // GOV-004: even the signed-in owner needs a fresh second-factor proof to issue a refund credit; the refusal writes nothing.
  await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
  const stale=await h.request('/api/mallet/commands',{method:'POST',body:{command:'credit.issue',input:{...input,review,confirm:'issue-credit'}}});assert.equal(stale.status,403);assert.equal((await stale.json()).error,'step_up_required')
  assert.deepEqual((await h.state()).records,before,'A refund without a fresh proof writes nothing')
  await h.command('credit.issue',{...input,review},{status:409})
  await h.command('credit.issue',{...input,review:{...review,totals:{...review.totals,totalCents:1}},confirm:'issue-credit'},{status:409})
  await h.command('contact.save',{...contact,contactId:contact.id,version:contact.version,notes:'Updated review'})
  await h.command('credit.issue',{...input,review,confirm:'issue-credit'},{status:409})
  const note=await issueCredit(h,input)
  assert.deepEqual(await h.command('credit.issue',{...input,review,confirm:'issue-credit'}),note,'Exact issue replay returns the same immutable note')
  await h.command('credit.issue',{...input,reason:'Changed instructions',review,confirm:'issue-credit'},{status:409})
  const state=await h.state();let refund=state.records.refund.find(r=>r.creditNoteId===note.id)
  const payerLogin=await portalSignIn(h,contact.email,account.name)
  const privateTexts=[...Object.values(cashRefundPrivateText),'synthetic-mallet-306 other payer cash custody','synthetic-mallet-308 other payer return narrative','synthetic-mallet-309 other payer instruction']
  const checkCashPayers=async(status,refundedCents,paidCents)=>{
   const beforeRead=await refundReadSnapshot(h)
   for(const text of [cashRefundPrivateText.reason,cashRefundPrivateText.consentEvidence,cashRefundPrivateText.paymentEvidence,...(status==='unsubmitted'?[]:[cashRefundPrivateText.outcomeEvidence+' '+status])])assert.ok(JSON.stringify(beforeRead.records).includes(text),'Private evidence is populated before asserting its absence from payer reads')
   const view=await h.api('/api/mallet/portal/billing',undefined,{as:payerLogin.cookie}),bill=view.invoices.find(i=>i.id===invoice.id)
   assert.equal(view.account.id,account.id)
   assert.deepEqual(bill.refunds,[{amountCents:109,method:'cash',status}])
   assert.equal(bill.refundedCents,refundedCents);assert.equal(bill.paidCents,paidCents);assert.equal(bill.creditedCents,109);assert.equal(bill.outstandingCents,0)
   assert.ok(!view.invoices.some(i=>[other.invoice.id,otherCash.invoice.id].includes(i.id)))
   const otherView=await h.api('/api/mallet/portal/billing',undefined,{as:otherLogin.cookie})
   assert.equal(otherView.account.id,outsider.account.id)
   assert.deepEqual(otherView.invoices.find(i=>i.id===otherCash.invoice.id).refunds,[{amountCents:215,method:'cash',status:'unsubmitted'}])
   assert.ok(!otherView.invoices.some(i=>[invoice.id,replacement.invoice.id].includes(i.id)))
   for(const [responseView,hidden]of [[view,[otherCash.invoice.id,otherCash.invoice.number,otherNote.id,otherNote.number]],[otherView,[invoice.id,invoice.number,note.id,note.number]]]){
    const json=JSON.stringify(responseView)
    for(const text of [...privateTexts,...hidden])assert.ok(!json.includes(text),'Payer response excludes private narrative and other-account records: '+text)
   }
   assert.deepEqual(await refundReadSnapshot(h),beforeRead,'Payer reads preserve all business records and exact saved export bytes')
   console.log('PROBE PAY-008 cash '+status+': portal billing -> cash refund 109 cents, refunded '+refundedCents+' cents; private narratives and other account excluded; records and exports unchanged')
  }
  await checkCashPayers('unsubmitted',0,541)
  for(const [n,status]of ['failed','disputed','refunded'].entries()){
   const outcome={refundId:refund.id,version:refund.version,status,reference:'synthetic-mallet-'+(104+n),evidence:cashRefundPrivateText.outcomeEvidence+' '+status,confirm:'record-refund'}
   refund=await h.command('refund.record',outcome);assert.equal(refund.status,status);assert.deepEqual(await h.command('refund.record',outcome),refund)
   await checkCashPayers(status,status==='refunded'?109:0,status==='refunded'?432:541)
  }
  const nextPayer=await h.command('contact.save',{name:'Replacement refund payer',email:['synthetic-mallet-310','example.test'].join('@'),phone:'',communication:'none',notes:''})
  const currentAccount=(await h.state()).records.customerAccount.find(a=>a.id===account.id)
  const changed=await h.command('customer.save',{...currentAccount,customerId:account.id,version:currentAccount.version,contactIds:[...currentAccount.contactIds,nextPayer.id],payerId:nextPayer.id,billingContactId:nextPayer.id})
  const beforeRefusal=await refundReadSnapshot(h)
  for(const path of ['/api/mallet/portal/billing','/portal/billing']){
   const response=await h.request(path,{as:payerLogin.cookie});assert.equal(response.status,403)
   const body=await response.text();for(const text of [...privateTexts,invoice.id,invoice.number,note.id,note.number])assert.ok(!body.includes(text),'Former payer refusal discloses no financial records')
   assert.deepEqual(await refundReadSnapshot(h),beforeRefusal,'Former payer refusal preserves records and exports immediately')
  }
  const nextLogin=await portalSignIn(h,nextPayer.email,account.name),currentView=await h.api('/api/mallet/portal/billing',undefined,{as:nextLogin.cookie})
  assert.deepEqual(currentView.invoices.find(i=>i.id===invoice.id).refunds,[{amountCents:109,method:'cash',status:'refunded'}])
  assert.deepEqual(await refundReadSnapshot(h),beforeRefusal,'New current payer can read without financial effects')
  await h.command('customer.save',{...changed,customerId:account.id,version:changed.version,payerId:contact.id,billingContactId:contact.id})
  const beforeReplay=await refundReadSnapshot(h)
  await h.api('/api/mallet/portal/billing',undefined,{as:payerLogin.cookie,status:403})
  assert.deepEqual(await refundReadSnapshot(h),beforeReplay,'Returning the payer role never revives an old session or changes finances')
  console.log('PROBE PAY-008 payer change: native customer.save -> former payer refused immediately on billing API and page, fresh current payer served; no financial effects')
  await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-107',evidence:'Pay again',confirm:'record-refund'},{status:409})
  const credit=await issueCredit(h,creditInput(invoice,null,'synthetic-mallet-108',invoice.lines[0],2))
  assert.equal(credit.totals.totalCents,217);assert.equal(credit.totals.salesTaxCents,15,'Cumulative tax reversal keeps the split exact')
  const allocation={creditNoteId:credit.id,invoiceId:replacement.invoice.id,version:replacement.invoice.version,amountCents:100,reference:'synthetic-mallet-109',reason:'Customer applies retained credit to another RO',confirm:'apply-credit'}
  await h.command('credit.apply',{...allocation,invoiceId:other.invoice.id,version:other.invoice.version},{status:409})
  const applied=await h.command('credit.apply',allocation);assert.equal(applied.method,'customer-credit');assert.equal(applied.verified,false);assert.deepEqual(await h.command('credit.apply',allocation),applied)
  const exchange=await h.command('credit.exchange',{...allocation,amountCents:117,reference:'synthetic-mallet-110',reason:'Customer exchanges the returned accessory for the separately authorized replacement'})
  assert.equal(exchange.exchange,true)
  await h.command('credit.apply',{...allocation,amountCents:1,reference:'synthetic-mallet-111'},{status:409})
  await h.command('credit.preview',creditInput(invoice,payment,'synthetic-mallet-112'),{status:409})
  const lastA=creditInput(invoice,payment,'synthetic-mallet-113',invoice.lines[1]),lastB={...lastA,reference:'synthetic-mallet-114'},reviewA=await h.command('credit.preview',lastA),reviewB=await h.command('credit.preview',lastB)
  const race=await Promise.all([lastA,lastB].map((input,n)=>h.request('/api/mallet/commands',{method:'POST',body:{command:'credit.issue',input:{...input,review:n?reviewB:reviewA,confirm:'issue-credit'}}})))
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409],'Competing returns cannot credit the same line twice')
  const last=await race.find(r=>r.status===200).json(),lastRefund=(await h.state()).records.refund.find(r=>r.creditNoteId===last.id)
  await h.command('refund.record',{refundId:lastRefund.id,version:lastRefund.version,status:'refunded',reference:'synthetic-mallet-115',evidence:'Original cash returned',confirm:'record-refund'})
  const login=await portalSignIn(h,contact.email,account.name),view=await h.api('/api/mallet/portal/billing',undefined,{as:login.cookie}),bill=view.invoices.find(i=>i.id===invoice.id)
  assert.equal(bill.creditedCents,541);assert.equal(bill.refundedCents,324);assert.equal(bill.outstandingCents,0);assert.equal(bill.credits.reduce((n,x)=>n+x.salesTaxCents,0),38)
  assert.equal(view.invoices.find(i=>i.id===replacement.invoice.id).paidCents,217);assert.ok(!JSON.stringify(view).includes('consentEvidence'));assert.ok(!JSON.stringify(view).includes('Customer returned the accessory'))
  assert.equal((await h.state({as:admin.cookie})).records.creditNote,undefined);assert.equal((await h.state(bearer)).records.refund,undefined)
  const final=(await h.state()).records
  assert.deepEqual(final.invoice.find(i=>i.id===invoice.id),invoice);assert.equal(await (await h.request('/api/mallet/exports/'+original.exported.id)).text(),csv)
  const fresh=await installation({bindings:{OWNER_EMAIL:'refund-recovery@example.test'}})
  try{await restore(fresh,await archive(h));const restored=(await fresh.state()).records;for(const kind of ['invoice','export','payment','creditNote','refund'])assert.deepEqual(restored[kind],final[kind]);await fresh.state({as:h.owner,status:401});await fresh.command('credit.apply',{...allocation,amountCents:1,reference:'synthetic-mallet-116'},{status:409});assert.equal(fresh.messages.length,0,'Restore sends nothing')}finally{await fresh.close()}
 }finally{await h.close()}
}
export async function stripeRefundJourney(){
 let invoice,mode='uncertain',postCount=0,revoke; const provider=[]
 const h=await installation({bindings:{STRIPE_SECRET_KEY:'synthetic-mallet-120'},outboundService:async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com')
  if(url.pathname.startsWith('/v1/payment_intents/'))return Response.json({id:'synthetic-mallet-121',metadata:{mallet_invoice_id:invoice.id},status:'succeeded',currency:'usd',amount_received:541,livemode:true,latest_charge:{paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount:541}})
  if(request.method==='POST'){
   postCount++;const form=new URLSearchParams(await request.text());assert.equal(form.get('payment_intent'),'synthetic-mallet-121');assert.equal(request.headers.get('idempotency-key'),'mallet-refund-'+form.get('metadata[mallet_refund_id]'))
   const receipt={id:'synthetic-mallet-'+(122+postCount),payment_intent:form.get('payment_intent'),amount:Number(form.get('amount')),currency:'usd',status:mode==='uncertain'?'succeeded':mode,metadata:{mallet_refund_id:form.get('metadata[mallet_refund_id]')}};provider.push(receipt)
   return mode==='uncertain'?new Response('Unconfirmed',{status:500}):Response.json(receipt)
  }
  assert.equal(request.method,'GET');if(revoke){const fn=revoke;revoke=null;await fn()}return Response.json(url.pathname==='/v1/refunds'?{data:provider,has_more:false}:provider.find(r=>url.pathname.endsWith('/'+r.id)))
 }})
 try{
  const {account,contact}=await creditAccountFixture(h),replacement=await creditInvoice(h,account,'2'),outsider=await creditAccountFixture(h,'2'),other=await creditInvoice(h,outsider.account,'3');let exported;({invoice,exported}=await creditInvoice(h,account))
  const csv=await (await h.request('/api/mallet/exports/'+exported.id)).text()
  const redirect=(r,reference='synthetic-mallet-170')=>({refundId:r.id,version:r.version,destination:'account-credit',accountId:account.id,reference,consentEvidence:'New customer instruction to recover failed Stripe refund as same-account credit',confirm:'redirect-refund'})
  const payment=await h.command('payment.verifyStripe',{invoiceId:invoice.id,version:invoice.version,paymentIntentId:'synthetic-mallet-121'})
  const taxCollection=async id=>(await h.api('/api/mallet/tax/report')).groups.flatMap(g=>g.invoices).find(i=>i.invoiceId===id)
  assert.equal((await taxCollection(invoice.id)).netCollectedTaxCents,38,'Captured Stripe receipt contributes original invoice tax once')
  const note=await issueCredit(h,creditInput(invoice,payment,'synthetic-mallet-125'))
  let refund=(await h.state()).records.refund.find(r=>r.creditNoteId===note.id)
  await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-126',evidence:'Caller flag',confirm:'record-refund'},{status:409})
  await h.command('refund.submit',{refundId:refund.id,version:refund.version},{status:409});assert.equal(postCount,0)
  const race=await Promise.all([1,2].map(()=>h.request('/api/mallet/commands',{method:'POST',body:{command:'refund.submit',input:{refundId:refund.id,version:refund.version,confirm:'send-refund'}}})))
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);refund=await race.find(r=>r.status===200).json();assert.equal(refund.status,'uncertain');assert.equal(postCount,1);assert.equal((await taxCollection(invoice.id)).netCollectedTaxCents,38,'An uncertain refund does not reverse collected tax')
  await h.command('refund.submit',{refundId:refund.id,version:refund.version,confirm:'send-refund'},{status:409});assert.equal(postCount,1)
  await h.command('refund.redirect',redirect(refund),{status:409})
  refund=await h.command('refund.reconcile',{refundId:refund.id,version:refund.version});assert.equal(refund.status,'refunded')
  assert.equal((await taxCollection(invoice.id)).netCollectedTaxCents,30,'Only confirmed completed refund reverses the exact original eight tax cents')
  for(let n=0;n<2;n++)assert.deepEqual(await h.command('refund.reconcile',{refundId:refund.id,version:refund.version}),refund,'Duplicate provider outcomes have no further financial effect')
  assert.equal(postCount,1)
  mode='failed';const second=await issueCredit(h,creditInput(invoice,payment,'synthetic-mallet-127',invoice.lines[0],2));let failed=(await h.state()).records.refund.find(r=>r.creditNoteId===second.id)
  failed=await h.command('refund.submit',{refundId:failed.id,version:failed.version,confirm:'send-refund'});assert.equal(failed.status,'failed');assert.equal(failed.amountCents,217)
  const input=redirect(failed)
  await h.command('refund.redirect',{...input,confirm:''},{status:409})
  await h.command('refund.redirect',{...input,consentEvidence:''},{status:400})
  await h.command('refund.redirect',{...input,accountId:outsider.account.id},{status:409})
  await h.command('refund.redirect',{...input,version:failed.version-1},{status:409})
  const redirected=await h.command('refund.redirect',input);assert.equal(redirected.status,'redirected');assert.equal(redirected.redirect.status,'credited');assert.equal(redirected.amountCents,217)
  assert.deepEqual(await h.command('refund.redirect',input),redirected,'Exact redirect replay returns saved outcome')
  await h.command('refund.redirect',{...input,consentEvidence:'Changed instruction'},{status:409})
  await h.command('refund.redirect',redirect(redirected,'synthetic-mallet-171'),{status:409})
  await h.command('refund.reconcile',{refundId:redirected.id,version:redirected.version},{status:409})
  await h.command('refund.submit',{refundId:redirected.id,version:redirected.version,confirm:'send-refund'},{status:409});assert.equal(postCount,2)
  const allocation={creditNoteId:second.id,invoiceId:replacement.invoice.id,version:replacement.invoice.version,amountCents:217,reference:'synthetic-mallet-172',reason:'Apply redirected credit to another repair of this account',confirm:'apply-credit'}
  await h.command('credit.apply',{...allocation,invoiceId:other.invoice.id,version:other.invoice.version},{status:409})
  const applied=await h.command('credit.apply',allocation);assert.equal(applied.amountCents,217)
  assert.match((await taxCollection(invoice.id)).reviewReasons.join(' '),/redirected refund/);assert.deepEqual((await taxCollection(replacement.invoice.id)).excludedPaymentIds,[applied.id]);assert.equal((await taxCollection(replacement.invoice.id)).netCollectedTaxCents,0,'Customer credit is disclosed, never counted as new cash')
  await h.command('credit.apply',{...allocation,reference:'synthetic-mallet-173',amountCents:1},{status:409})
  const filing=await h.api('/api/mallet/tax/filing?from=2000-01-01&to=2099-01-01')
  assert.ok(filing.excluded.some(r=>r.refundId===redirected.id&&r.amountCents===217&&r.reason.startsWith('Redirected refund')))
  assert.ok(filing.excluded.some(r=>r.paymentId===applied.id&&r.amountCents===217&&r.reason.startsWith('Customer-credit transfer')))
  assert.equal(filing.events.some(r=>r.refundId===redirected.id||r.paymentId===applied.id),false,'Unresolved redirected credit neither reverses tax nor invents cash')
  assert.equal(filing.reviewRequired,true)
  // The remaining original line first gets a pending outcome, which cannot redirect.
  mode='pending';const third=await issueCredit(h,creditInput(invoice,payment,'synthetic-mallet-174',invoice.lines[1]));let manual=(await h.state()).records.refund.find(r=>r.creditNoteId===third.id)
  manual=await h.command('refund.submit',{refundId:manual.id,version:manual.version,confirm:'send-refund'});assert.equal(manual.status,'pending')
  await h.command('refund.redirect',redirect(manual,'synthetic-mallet-175'),{status:409})
  provider.find(r=>r.metadata.mallet_refund_id===manual.id).status='canceled'
  manual=await h.command('refund.reconcile',{refundId:manual.id,version:manual.version});assert.equal(manual.status,'failed')
  const manualInput={...redirect(manual,'synthetic-mallet-175'),destination:'manual-tender',method:'check'};delete manualInput.accountId
  manual=await h.command('refund.redirect',manualInput);assert.equal(manual.redirect.status,'unsubmitted')
  const observation={refundId:manual.id,version:manual.version,status:'refunded',reference:'synthetic-mallet-176',evidence:'Owner handed the customer a replacement check for the failed Stripe refund',confirm:'record-refund'}
  manual=await h.command('refund.record',observation);assert.equal(manual.redirect.status,'refunded');assert.deepEqual(await h.command('refund.record',observation),manual)
  await h.command('refund.redirect',{...manualInput,version:manual.version,reference:'synthetic-mallet-177'},{status:409})
  await h.command('refund.record',{...observation,version:manual.version,reference:'synthetic-mallet-178'},{status:409})
  await h.command('credit.preview',creditInput(invoice,payment,'synthetic-mallet-179'),{status:409})
  const completedFiling=await h.api('/api/mallet/tax/filing?from=2000-01-01&to=2099-01-01')
  assert.equal(completedFiling.events.find(r=>r.refundId===manual.id).taxCents,-third.totals.salesTaxCents,'Completed redirected manual refund reverses exact original tax once')
  const attribution={creditNoteId:second.id,version:second.version,allocations:[{paymentId:payment.id,amountCents:217}],legalBasis:'Owner reviewed the original and replacement jurisdiction treatment',evidence:'Original captured receipt identified for the exact failed-refund credit'}
  const attributed=await h.command('tax.creditBasis',attribution);assert.equal((await h.command('tax.creditBasis',attribution)).id,attributed.id)
  const reviewedFiling=await h.api('/api/mallet/tax/filing?from=2000-01-01&to=2099-01-01')
  assert.equal(reviewedFiling.events.find(r=>r.paymentId===applied.id).newCash,false);assert.equal(reviewedFiling.events.find(r=>r.creditNoteId===second.id&&r.kind==='credit-reversal').taxCents,-second.totals.salesTaxCents);assert.equal(reviewedFiling.excluded.some(r=>r.refundId===redirected.id||r.paymentId===applied.id),false)
  const state=(await h.state()).records;assert.equal(state.refund.filter(r=>(r.redirect?.status??r.status)==='refunded').reduce((n,r)=>n+r.amountCents,0)+applied.amountCents,541,'Refunded plus credited equals, and cannot exceed, recorded tender')
  assert.deepEqual(state.invoice.find(i=>i.id===invoice.id),invoice);assert.deepEqual(state.creditNote.find(n=>n.id===second.id),second,'Redirect never alters the issued credit note');assert.equal(await (await h.request('/api/mallet/exports/'+exported.id)).text(),csv)
  const login=await portalSignIn(h,contact.email,account.name),view=await h.api('/api/mallet/portal/billing',undefined,{as:login.cookie}),bill=view.invoices.find(i=>i.id===invoice.id)
  assert.deepEqual(bill.refunds.map(r=>[r.amountCents,r.method,r.status]).sort(),[[109,'stripe','refunded'],[215,'check','refunded'],[217,'account-credit','credited']].sort())
  assert.equal(bill.paidCents,0);assert.equal(bill.outstandingCents,0);assert.equal(bill.refundedCents,324);assert.equal(view.invoices.find(i=>i.id===replacement.invoice.id).paidCents,217)
  for(const r of bill.refunds)assert.deepEqual(Object.keys(r).sort(),['amountCents','method','status'])
  for(const secret of ['consentEvidence','synthetic-mallet-170','replacement check','paymentIntentId'])assert.ok(!JSON.stringify(view).includes(secret))
  const fresh=await installation({bindings:{OWNER_EMAIL:'redirect-recovery@example.test'}})
  try{await restore(fresh,await archive(h));const restored=(await fresh.state()).records;for(const kind of ['invoice','export','payment','creditNote','refund','taxCreditBasis'])assert.deepEqual(restored[kind],state[kind]);assert.deepEqual(await fresh.command('refund.redirect',input),redirected);await fresh.command('credit.apply',{...allocation,amountCents:1,reference:'synthetic-mallet-180'},{status:409});await fresh.command('refund.redirect',redirect(redirected,'synthetic-mallet-181'),{status:409});await fresh.state({as:h.owner,status:401});assert.equal(fresh.messages.length,0)}finally{await fresh.close()}

  revoke=async()=>{assert.equal((await h.request('/auth/signout',{method:'POST',body:{}})).status,204)}
  await h.command('refund.reconcile',{refundId:refund.id,version:refund.version},{status:409})
  const db=await h.mf.getD1Database('DB'),saved=await db.prepare("SELECT value FROM mallet_records WHERE kind='refund' AND id=?").bind(refund.id).first()
  assert.deepEqual(JSON.parse(saved.value),refund,'Revoked owner cannot persist an outcome after provider fetch')
 }finally{await h.close()}
}

export async function fullRefundJourney(){
 const h=await installation()
 try{
  const {account,contact}=await creditAccountFixture(h)
  const login=await portalSignIn(h,contact.email,account.name)
  for(const [index,method]of ['cash','check','other'].entries()){
   const {invoice,exported}=await creditInvoice(h,account,String(index+1)),payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,method,amountCents:invoice.totals.totalCents,reference:'synthetic-mallet-'+(150+index),evidence:'Owner recorded original '+method})
   const input=creditInput(invoice,payment,'synthetic-mallet-'+(153+index));input.lines=invoice.lines.map(l=>({lineId:l.id,sourceEstimateId:l.sourceEstimateId,sourceRevision:l.sourceRevision,quantity:l.quantity}))
   const note=await issueCredit(h,input);assert.deepEqual(note.totals,invoice.totals)
   let refund=(await h.state()).records.refund.find(r=>r.creditNoteId===note.id)
   refund=await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-'+(156+index),evidence:'Owner confirms full original '+method+' returned',confirm:'record-refund'})
   assert.equal(refund.method,method);assert.equal(refund.amountCents,541)
   const view=await h.api('/api/mallet/portal/billing',undefined,{as:login.cookie}),bill=view.invoices.find(i=>i.id===invoice.id)
   assert.equal(bill.paidCents,0);assert.equal(bill.outstandingCents,0);assert.equal(bill.refundedCents,541);assert.equal(bill.creditedCents,541)
   const state=(await h.state()).records;assert.deepEqual(state.invoice.find(i=>i.id===invoice.id),invoice);assert.deepEqual(state.export.find(e=>e.id===exported.id),exported)
   await h.command('credit.preview',{...input,reference:'synthetic-mallet-'+(159+index)},{status:409})
  }
 }finally{await h.close()}
}
