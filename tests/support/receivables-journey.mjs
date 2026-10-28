import {randomUUID} from 'node:crypto'
import {custodyInput} from './intake-journey.mjs'
import {handoverInput} from './handover-input.mjs'
import assert from 'node:assert/strict'
import {booking,authorise,archive,restore,installation} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
export const balancePermissionFields=(reference=randomUUID())=>({consentPurpose:'balance-reminder',consentWordingVersion:'balance-permission-v1',consentedAt:'2026-10-01T12:00:00Z',captureChannel:'telephone',consentReference:reference})
export async function receivablesFixture(h){
 await shopSetup(h);await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:true})
 const driver=await h.command('contact.save',{name:'Van driver',email:'driver@example.test',phone:'',communication:'none'}),manager=await h.command('contact.save',{name:'Fleet manager',email:'manager@example.test',phone:'',communication:'email'})
 let account=await h.command('customer.save',{name:'Synthetic fleet',kind:'fleet',contactIds:[driver.id,manager.id],payerId:manager.id,billingContactId:manager.id,driverId:driver.id,authorizerId:manager.id,taxStatus:'standard'})
 async function invoice(n,asset){if(!asset){asset=await h.command('asset.create',{customerName:account.name,customerEmail:manager.email,label:'Fleet van '+n,identifier:'synthetic-mallet-ar-'+n});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Explicit fleet vehicle and payer review'})}let {job}=await booking(h,{asset,bayId:'Fleet '+n,startAt:`2026-10-0${n}T09:00:00Z`,endAt:`2026-10-0${n}T10:00:00Z`});const q=await authorise(h,await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Van repair part',quantity:1,unitCents:10000}]}));job=(await h.state()).records.job.find(j=>j.id===job.id);job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1});await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version});const i=await h.command('invoice.prepare',{jobId:job.id,version:job.version});return h.command('invoice.approve',{invoiceId:i.id,version:i.version})}
 let controlAsset=await h.command('asset.create',{customerName:account.name,customerEmail:manager.email,label:'Fleet authority control',identifier:'synthetic-mallet-fleet-control'})
 controlAsset=await h.command('customer.linkAsset',{assetId:controlAsset.id,version:controlAsset.version,customerId:account.id,customerVersion:account.version,reason:'Owner reviewed fleet control vehicle'})
 const control=await booking(h,{asset:controlAsset,bayId:'Fleet control'});let quote=await h.command('estimate.prepare',{jobId:control.job.id,version:control.job.version,lines:[{kind:'labor',description:'Fleet control repair',quantity:1,unitCents:100}]})
 quote=await h.command('estimate.approve',{estimateId:quote.id,version:quote.version,revision:1});quote=await h.command('estimate.markSent',{estimateId:quote.id,version:quote.version,revision:1,method:'printed'})
 const decision={estimateId:quote.id,version:quote.version,revision:1,lineIds:quote.revisions[0].lines.map(l=>l.id),customerName:manager.name,method:'phone',evidence:'Fleet manager called with exact repair authority',authorizerId:manager.id,accountVersion:account.version,po:'synthetic-mallet-control-po',fleetEvidence:'Owner recorded exact fleet instruction'}
 const before=await h.state()
 for(const wrong of [{authorizerId:driver.id},{accountVersion:account.version+1},{po:''},{fleetEvidence:''},{evidence:''}])await h.command('estimate.authorise',{...decision,...wrong},{status:Object.values(wrong).includes('')?400:409})
 assert.deepEqual(await h.state(),before,'Driver, stale account, missing PO and missing evidence grant no repair authority')
 const admin=await h.person('fleet-control-advisor@example.test','admin');await h.command('estimate.authorise',decision,{as:admin.cookie,status:403})
 const link=await h.command('approvalLink.create',{estimateId:quote.id,version:quote.version,revision:1,days:1})
 const {decide}=await import('./approval-journey.mjs'),path=new URL(link.url).pathname
 const refused=await decide(h,path,{['line-'+quote.revisions[0].lines[0].id]:'approve',typedName:driver.name,consent:'yes'});assert.equal(refused.status,403,'A bearer link cannot bypass reviewed fleet authorizer authority')
 quote=(await h.state()).records.estimate.find(q=>q.id===quote.id)
 const authorized=await h.command('estimate.authorise',{...decision,version:quote.version});assert.equal(authorized.authorisation.fleet.authorizer.id,manager.id)
 assert.equal(authorized.authorisation.fleet.po,decision.po)
 assert.ok(!JSON.stringify((await h.state({as:admin.cookie})).records).includes('\"fleet\":'),'New private fleet decision snapshots are absent from non-owner projections')
 const currentQuote=async id=>(await h.state()).records.estimate.find(q=>q.id===id)
 const pending=async()=>{
  const job=(await h.state()).records.job.find(j=>j.id===control.job.id)
  let q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,supplement:true,reason:'synthetic-mallet-40',lines:[{kind:'labor',description:'synthetic-mallet-41',quantity:1,unitCents:100}]})
  q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1});q=await h.command('estimate.markSent',{estimateId:q.id,version:q.version,revision:1,method:'printed'})
  const link=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:1,days:1})
  return {quote:await currentQuote(q.id),path:new URL(link.url).pathname}
 }
 const assertVoided=async held=>{
  const next=await currentQuote(held.quote.id)
  assert.equal(next.status,'draft');assert.equal(next.revisions.at(-1).approval,null);assert.equal(next.revisions.at(-1).n,2)
  assert.deepEqual(next.revisions[0],held.quote.revisions[0],'The earlier approved revision remains evidence')
  assert.equal((await h.request(held.path,{as:''})).status,404,'A changed fleet relationship voids its pending bearer link')
  const before=await h.state(),mail=h.messages.length
  await h.command('estimate.authorise',{...decision,estimateId:next.id,version:next.version,revision:2,lineIds:next.revisions.at(-1).lines.map(l=>l.id),accountVersion:account.version},{status:409})
  assert.deepEqual(await h.state(),before);assert.equal(h.messages.length,mail,'A voided approval grants no authority and sends no mail')
  assert.deepEqual((await currentQuote(authorized.id)).authorisation,authorized.authorisation,'Existing authorized decisions stay unchanged')
  return next
 }
 let held=await pending(),beforeChangeMail=h.messages.length
 account=await h.command('customer.save',{...account,customerId:account.id,authorizerId:driver.id})
 assert.equal(h.messages.length,beforeChangeMail);let voided=await assertVoided(held)
 voided=await h.command('estimate.approve',{estimateId:voided.id,version:voided.version,revision:2});voided=await h.command('estimate.markSent',{estimateId:voided.id,version:voided.version,revision:2,method:'printed'})
 await h.command('estimate.authorise',{...decision,estimateId:voided.id,version:voided.version,revision:2,lineIds:voided.revisions.at(-1).lines.map(l=>l.id),authorizerId:driver.id,accountVersion:account.version},{status:409})
 account=await h.command('customer.save',{...account,customerId:account.id,authorizerId:manager.id})
 held=await pending();const revisedManager=await h.command('contact.save',{...manager,contactId:manager.id,notes:'synthetic-mallet-42'});manager.version=revisedManager.version;await assertVoided(held)
 held=await pending();const replacement=await h.command('customer.save',{name:'synthetic-mallet-43',kind:'fleet',contactIds:[driver.id,manager.id],payerId:manager.id,billingContactId:manager.id,driverId:driver.id,authorizerId:manager.id,taxStatus:'standard'})
 let vehicle=(await h.state()).records.asset.find(a=>a.id===controlAsset.id)
 vehicle=await h.command('customer.linkAsset',{assetId:vehicle.id,version:vehicle.version,customerId:replacement.id,customerVersion:replacement.version,reason:'synthetic-mallet-44'});await assertVoided(held)
 await h.command('customer.linkAsset',{assetId:vehicle.id,version:vehicle.version,customerId:account.id,customerVersion:account.version,reason:'synthetic-mallet-45'})
 const i1=await invoice(1),i2=await invoice(2)
 return {account,driver,manager,i1,i2,invoice,control}
}
export async function receivablesJourney(h){
 const f=await receivablesFixture(h),{account,driver,manager,i1,i2}=f,admin=await h.person('ar-admin@example.test','admin'),member=await h.person('ar-member@example.test'),key=await h.command('agent.create',{label:'No receivables authority'}),agent={as:'',headers:{authorization:'Bearer '+key.token}},evidence='Explicit fleet instruction and owner reviewed commercial authority',termsInput={accountId:account.id,version:account.version,days:30,limitCents:22000,active:true,consent:true,evidence}
 const before=JSON.stringify((await h.state()).records),messages=h.messages.length
 await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
 const stale=await h.request('/api/mallet/commands',{method:'POST',body:{command:'ar.terms',input:termsInput}});assert.equal(stale.status,403);assert.equal((await stale.json()).error,'step_up_required')
 await h.stepUp()
 for(const outsider of [{as:admin.cookie},{as:member.cookie},agent]){
  await h.command('ar.terms',termsInput,{...outsider,status:403})
  for(const path of ['/api/mallet/receivables?accountId='+account.id,'/app/receivables?accountId='+account.id])assert.equal((await h.request(path,outsider)).status,403)
 }
 await h.command('ar.terms',termsInput,{as:'',status:401})
 await h.command('ar.terms',{...termsInput,consent:false},{status:409})
 await h.command('ar.terms',{...termsInput,active:'yes'},{status:400})
 await h.command('ar.terms',{...termsInput,version:99},{status:409})
 assert.equal(JSON.stringify((await h.state()).records),before);assert.equal(h.messages.length,messages)
 const terms=await h.command('ar.terms',termsInput),assign=(i,more={})=>({invoiceId:i.id,version:i.version,termsId:terms.id,authorizerId:manager.id,po:'synthetic-mallet-po-'+i.number,evidence,...more})
 await h.command('ar.invoice',assign(i1,{authorizerId:driver.id}),{status:409})
 await h.command('ar.invoice',assign(i1,{po:''}),{status:400})
 const a1=await h.command('ar.invoice',assign(i1)),a2=await h.command('ar.invoice',assign(i2))
 await scheduledBalances(h,{account,manager,i1,i2})
 const document=await h.command('invoice.issue',{invoiceId:i1.id,version:i1.version,reference:'synthetic-mallet-term-invoice',warrantyTerms:'Shop terms reviewed with fleet accounts',confirm:'issue-invoice'})
 assert.equal(document.snapshot.accountTerms.assignmentId,a1.id);assert.ok(document.content.includes(a1.dueOn));assert.ok(document.content.includes(a1.po));assert.ok(document.content.includes('Van repair part'))
 const optedOut=await h.command('contact.save',{contactId:manager.id,version:manager.version,name:manager.name,email:manager.email,phone:'',communication:'none'})
 const noTermSend=h.messages.length;await h.command('invoice.send',{documentId:document.id,version:document.version,to:manager.email,consentEvidence:'Accounts request',consent:true,confirm:'email-invoice'},{status:409});assert.equal(h.messages.length,noTermSend,'Current accounts email preference is required')
 manager.version=(await h.command('contact.save',{contactId:manager.id,version:optedOut.version,name:manager.name,email:manager.email,phone:'',communication:'email'})).version
 const sent=await h.command('invoice.send',{documentId:document.id,version:document.version,to:manager.email,consentEvidence:'Accounts explicitly requested this exact term invoice',consent:true,confirm:'email-invoice'})
 assert.equal(sent.status,'accepted');assert.deepEqual(h.messages.at(-1).to,[manager.email]);assert.ok(h.messages.at(-1).text.includes(a1.dueOn));assert.ok(h.messages.at(-1).text.includes(a1.po))
 const sentMessages=h.messages.length;await h.command('invoice.send',{documentId:document.id,version:document.version,to:manager.email,consentEvidence:'Replay',consent:true,confirm:'email-invoice'},{status:409});assert.equal(h.messages.length,sentMessages)

 const termMessages=h.messages.length-messages
 const reminderInput={invoiceId:i1.id,version:i1.version,outstandingCents:11000,to:manager.email,reference:'synthetic-mallet-ar-reminder',consent:true,confirm:'send-balance-reminder',consentEvidence:'Billing contact explicitly requested this balance reminder by email',evidence}
 await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
 const reminderBefore=(await h.state()).records;await h.command('ar.remind',reminderInput,{status:403});assert.deepEqual((await h.state()).records,reminderBefore,'A reminder without fresh owner confirmation writes nothing');assert.equal(h.messages.length,messages+termMessages);await h.stepUp()
 await h.command('ar.remind',{...reminderInput,consentEvidence:''},{status:400})
 for(const input of [{...reminderInput,consent:false},{...reminderInput,outstandingCents:1},{...reminderInput,to:driver.email}])await h.command('ar.remind',input,{status:409})
 await h.command('ar.remind',reminderInput,{as:admin.cookie,status:403})
 assert.equal(h.messages.length,messages+termMessages,'No refused reminder reaches mail')
 const refusedContact=await h.command('contact.save',{contactId:manager.id,version:manager.version,name:manager.name,email:manager.email,phone:'',communication:'none'})
 await h.command('ar.remind',reminderInput,{status:409})
 await h.command('contact.save',{contactId:manager.id,version:refusedContact.version,name:manager.name,email:manager.email,phone:'',communication:'email'})
 const reminder=await h.command('ar.remind',reminderInput)
 assert.equal(reminder.status,'accepted');assert.equal(h.messages.length,messages+termMessages+1);assert.deepEqual(h.messages.at(-1).to,[manager.email]);assert.match(h.messages.at(-1).text,/USD 110.00/);assert.ok(h.messages.at(-1).text.includes(a1.dueOn));assert.doesNotMatch(h.messages.at(-1).text,/overdue/i)
 await h.command('ar.remind',reminderInput,{status:409});assert.equal(h.messages.length,messages+termMessages+1,'Replay never sends twice')
 await h.command('ar.reminderClaim',reminderInput,{status:404});await h.command('ar.reminderOutcome',{reminderId:reminder.id,status:'accepted'},{status:404})
 const statement=async(asOf)=>h.api('/api/mallet/receivables?'+new URLSearchParams({accountId:account.id,asOf}))
 const custody=async invoiceId=>(await statement('2099-01-02')).invoices.find(i=>i.invoiceId===invoiceId).recordedCustody
 assert.equal((await custody(i1.id)).status,'unknown','Booking and completion do not invent a custody endpoint')
 assert.equal((await custody(i1.id)).durationMs,null)
 let custodyJob=(await h.state()).records.job.find(j=>j.id===i2.jobId)
 const firstIntake=await h.command('intake.record',{...custodyInput(custodyJob),capturedAt:'2026-09-29T07:00:00Z',signedBy:driver.name})
 const open=await custody(i2.id)
 assert.equal(open.status,'open');assert.equal(open.from,'2026-09-29T07:00:00.000Z');assert.equal(open.to,null);assert.equal(open.durationMs,null)
 assert.deepEqual(open.intake,{id:firstIntake.id,revision:firstIntake.version,sequence:firstIntake.n,observedAt:firstIntake.capturedAt,recordedAt:firstIntake.at})
 custodyJob=(await h.state()).records.job.find(j=>j.id===i2.jobId)
 const intake=await h.command('intake.record',{...custodyInput(custodyJob),capturedAt:'2026-09-30T07:15:00Z',signedBy:driver.name})
 const ambiguous=await custody(i2.id)
 assert.equal(ambiguous.status,'unknown','Competing intakes without a selecting handover remain unknown');assert.equal(ambiguous.from,null);assert.equal(ambiguous.durationMs,null)
 const releaseInput=await handoverInput(h,i2.jobId,account.name,{intake});delete releaseInput.overrideId;releaseInput.termsAssignmentId=a2.id
 const releaseBefore=JSON.stringify((await h.state()).records)
 await h.command('flow.collect',{...releaseInput,termsAssignmentId:a1.id},{status:409})
 await h.command('flow.collect',releaseInput,{as:admin.cookie,status:403})
 assert.equal(JSON.stringify((await h.state()).records),releaseBefore,'Wrong invoice terms and non-owner release write nothing')
 await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
 const staleRelease=await h.request('/api/mallet/commands',{method:'POST',body:{command:'flow.collect',input:releaseInput}});assert.equal(staleRelease.status,403);assert.equal((await staleRelease.json()).error,'step_up_required')
 await h.stepUp()
 await h.command('ar.terms',{...termsInput,active:false})
 await h.command('flow.collect',releaseInput,{status:409})
 await h.command('ar.terms',termsInput)
 const beforeRelease=await archive(h),destination=await installation()
 try{await restore(destination,beforeRelease);const denied=await destination.command('flow.collect',releaseInput,{status:409});assert.equal(denied.error,'AR_RELEASE','Archived commercial approvals do not grant destination release authority')}finally{await destination.close()}
 const collected=await h.command('flow.collect',releaseInput),receipt=(await h.state()).records.handover.find(r=>r.id===collected.collection.handoverId)
 assert.equal(receipt.settlement.label,'Released on account terms; balance due '+a2.dueOn);assert.equal(receipt.settlement.accountTerms.assignment.id,a2.id);assert.equal(receipt.settlement.accountTerms.outstandingCents,11000);assert.equal(receipt.settlement.verifiedCents,0);assert.equal(receipt.settlement.override,null)
 assert.equal((await h.state()).records.payment?.length??0,0,'Release on terms creates no payment')
 const mailBeforeRead=h.messages.length,closed=await custody(i2.id)
 assert.equal(closed.status,'recorded');assert.equal(closed.from,'2026-09-30T07:15:00.000Z');assert.equal(closed.to,receipt.at)
 assert.equal(closed.durationMs,Date.parse(receipt.at)-Date.parse('2026-09-30T07:15:00Z'))
 assert.deepEqual(closed.intake,{id:intake.id,revision:intake.version,sequence:intake.n,observedAt:intake.capturedAt,recordedAt:intake.at})
 assert.deepEqual(closed.comparison,{id:receipt.comparison.id,revision:receipt.comparison.version,recordedAt:receipt.comparison.at})
 assert.deepEqual(closed.handover,{id:receipt.id,revision:receipt.version,recordedAt:receipt.at})
 assert.deepEqual(closed.invoice,{id:i2.id,revision:i2.revision,number:i2.number,chargeCents:11000})
 const projected=(await statement('2099-01-02')).invoices.find(i=>i.invoiceId===i2.id)
 assert.equal(projected.downtime.from,'2026-10-02T09:00:00.000Z');assert.notEqual(projected.downtime.from,closed.from);assert.notEqual(projected.downtime.to,closed.to)
 assert.match(closed.label,/not verified off-road downtime/)
 assert.equal((await custody(i1.id)).status,'unknown','Another vehicle cannot borrow this custody evidence')
 const releasedJob=(await h.state()).records.job.find(j=>j.id===i2.jobId)
 await h.command('intake.record',{...custodyInput(releasedJob),capturedAt:'2026-09-30T08:30:00Z',signedBy:driver.name})
 assert.deepEqual(await custody(i2.id),closed,'A later unpaired intake cannot replace the source frozen into the handover')
 const savedBeforeRead=await h.state()

 await h.command('flow.collect',releaseInput,{status:409})
 assert.deepEqual(await h.state(),savedBeforeRead,'Statement reads and replay do not change approvals, balances or custody');assert.equal(h.messages.length,mailBeforeRead)

 assert.equal(a1.dueOn,new Date(Date.parse(a1.at.slice(0,10))+30*86400000).toISOString().slice(0,10));assert.equal(a1.authorizerId,manager.id)
 await h.command('ar.invoice',assign(i1),{status:409})
 const aged=new Date(Date.parse(a1.dueOn)+31*86400000).toISOString().slice(0,10)
 let report=await statement(aged);assert.equal(report.outstandingCents,22000);assert.equal(report.ageing['31–60'],22000);assert.ok(report.invoices.every(i=>i.chaseEligible));assert.equal(report.invoices[0].downtime.label,'Booked start to recorded completion; actual off-road time is not verified.')
 const check=await h.command('deposit.record',{accountId:account.id,amountCents:5000,method:'check',reference:'synthetic-mallet-ar-check',evidence:'Fleet instructed partial check allocation; check not cleared'})
 await h.command('deposit.allocate',{depositId:check.id,invoiceId:i1.id,version:i1.version,amountCents:5000,reference:'synthetic-mallet-ar-allocation',evidence:'Fleet instruction to apply check to first invoice',confirm:'allocate-deposit'})
 await h.command('ar.dispute',{invoiceId:i2.id,version:i2.version,status:'open',evidence:'Fleet disputes second invoice pending work review'})
 await h.command('ar.remind',{...reminderInput,invoiceId:i2.id,version:i2.version,reference:'synthetic-mallet-disputed'},{status:409})
 report=await statement(aged);assert.equal(report.outstandingCents,17000);assert.equal(report.ageing['31–60'],17000);assert.deepEqual(report.invoices.filter(i=>i.chaseEligible).map(i=>i.invoiceId),[i1.id]);assert.equal(report.invoices.find(i=>i.invoiceId===i1.id).balance.outstandingCents,6000)
 const partialDay=new Date(Date.now()+3*86400000).toISOString().slice(0,10),partialAt=time=>partialDay+'T'+time+':00Z'
 const partialFields={...balancePermissionFields(),kind:'balance',subjectId:i1.id,version:i1.version,to:manager.email,outstandingCents:6000,consent:true,consentEvidence:'Billing contact requested one exact partial balance email',instructions:'Approved balance',timeZone:'UTC',allowedStart:9,allowedEnd:18,dueAt:partialAt('15:00'),expiresAt:partialAt('18:00')}
 const partial=await h.command('outreach.schedule',partialFields),partialBefore=h.messages.length
 await h.cron(partialAt('15:00'));assert.equal(h.messages.length,partialBefore+1);assert.match(h.messages.at(-1).text,/USD 60.00/)
 await h.command('outreach.schedule',{...partialFields,subjectId:i2.id,version:i2.version,outstandingCents:11000},{status:409})
 const promisedPending=await h.command('outreach.schedule',{...partialFields,...balancePermissionFields()})
 const promise=await h.command('ar.promise',{invoiceId:i1.id,version:i1.version,promisedOn:'2099-01-01',amountCents:6000,evidence:'Fleet promised the exact remaining balance'})
 await h.command('ar.remind',{...reminderInput,outstandingCents:6000,reference:'synthetic-mallet-promised'},{status:409})
 await h.cron(partialAt('15:15'));assert.equal((await h.state()).records.outreach.find(r=>r.id===promisedPending.id).status,'stopped','An unexpired promise suppresses scheduled email')
 assert.ok((await statement(promise.promisedOn)).invoices.every(i=>!i.chaseEligible));assert.ok((await statement('2099-01-02')).invoices.find(i=>i.invoiceId===i1.id).chaseEligible)
 await h.command('ar.promise',{invoiceId:i1.id,version:i1.version,promisedOn:'2099-01-01',amountCents:6001,evidence},{status:409})
 const low=await h.command('ar.terms',{...termsInput,limitCents:1000}),third=await f.invoice(3,(await h.state()).records.asset.find(a=>a.id===receipt.assetId))
 await h.command('ar.invoice',{...assign(third),termsId:low.id},{status:409})
 assert.equal((await custody(third.id)).status,'unknown','A later visit of the same van cannot inherit the prior handover');assert.equal((await custody(third.id)).from,null)
 assert.deepEqual(await custody(i2.id),closed,'A later visit leaves the original frozen custody pairing unchanged')
 await h.command('ar.dispute',{invoiceId:i2.id,version:i2.version,status:'resolved',evidence:'Fleet accepted work after reviewed evidence'})
 assert.equal((await statement(aged)).invoices.find(i=>i.invoiceId===i2.id).dispute.status,'resolved')
 for(const outsider of [{as:admin.cookie},{as:member.cookie},agent]){const s=await h.state(outsider);for(const kind of ['arTerms','arInvoice','arDispute','arPromise','arReminder'])assert.equal(s.records[kind],undefined);assert.ok(!JSON.stringify(s).includes(termsInput.evidence))}
 await h.command('payment.record',{invoiceId:i1.id,version:i1.version,method:'cash',amountCents:6000,reference:'synthetic-mallet-ar-paid',evidence:'Owner observed the remaining cash payment'})
 await h.command('ar.remind',{...reminderInput,outstandingCents:0,reference:'synthetic-mallet-paid'},{status:409})
 assert.equal(h.messages.filter(m=>m.subject.startsWith('Balance reminder:')).length,1,'Disputed, promised and paid balances send nothing')
 const settled=(await statement(aged)).invoices.find(i=>i.invoiceId===i1.id);assert.equal(settled.balance.outstandingCents,0);assert.equal(settled.chaseEligible,false,'Paid balance never remains eligible for chasing')
 const recoveredTerms=await h.command('ar.terms',{...termsInput,limitCents:50000})
 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);for(const kind of ['arTerms','arInvoice','arDispute','arPromise','arReminder','handover'])assert.deepEqual((await fresh.state()).records[kind],(await h.state()).records[kind]);assert.deepEqual(await fresh.api('/api/mallet/receivables?'+new URLSearchParams({accountId:account.id,asOf:aged})),await statement(aged));const refused=await fresh.command('ar.invoice',{...assign(third),termsId:recoveredTerms.id},{status:409});assert.equal(refused.error,'AR_TERMS','A solvent account still requires fresh destination-owner terms authority');assert.equal((await fresh.request('/api/mallet/state',{as:h.owner})).status,401)}finally{await fresh.close()}
 const failed=await installation({mailService:message=>{if(message.subject.startsWith('Balance reminder:'))throw Error('Synthetic mail uncertainty');return Response.json({id:'synthetic-mallet-mail'})}})
 try{
  const f2=await receivablesFixture(failed),approved=await failed.command('ar.terms',{...termsInput,accountId:f2.account.id,version:f2.account.version,limitCents:30000})
  await failed.command('ar.invoice',{invoiceId:f2.i1.id,version:f2.i1.version,termsId:approved.id,authorizerId:f2.manager.id,po:'synthetic-mallet-uncertain-po',evidence})
  const input={...reminderInput,invoiceId:f2.i1.id,version:f2.i1.version,reference:'synthetic-mallet-uncertain-reminder'},uncertain=await failed.command('ar.remind',input)
  assert.equal(uncertain.status,'uncertain');await failed.command('ar.remind',input,{status:409});assert.equal(failed.messages.filter(m=>m.subject.startsWith('Balance reminder:')).length,1,'An uncertain submission is never retried')
  const recovered=await installation();try{await restore(recovered,await archive(failed));assert.deepEqual((await recovered.state()).records.arReminder,(await failed.state()).records.arReminder);assert.equal(recovered.messages.filter(m=>m.subject.startsWith('Balance reminder:')).length,0,'Restore sends no historical reminder')}finally{await recovered.close()}
 }finally{await failed.close()}
 await balanceRecoveryJourney()
 return {...f,a1,a2,check}
}

async function scheduledBalances(h,{account,manager,i1,i2}){
 const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10),at=time=>day+'T'+time+':00Z'
 const fields=i=>({...balancePermissionFields(),kind:'balance',subjectId:i.id,version:i.version,to:manager.email,outstandingCents:11000,consent:true,consentEvidence:'Billing contact explicitly requested this one scheduled balance email',instructions:'Exact approved balance',timeZone:'UTC',allowedStart:9,allowedEnd:18,dueAt:at('09:00'),expiresAt:at('18:00')})
 const first=await h.command('outreach.schedule',fields(i1)),second=await h.command('outreach.schedule',fields(i2)),before=h.messages.length
 await h.cron(at('08:59'));assert.equal(h.messages.length,before)
 await h.restart();await Promise.all([h.cron(at('09:00')),h.cron(at('09:00'))])
 assert.equal(h.messages.length,before+2);for(const m of h.messages.slice(before)){assert.equal(m.subject,'Your invoice balance reminder');assert.match(m.text,/USD 110.00/);assert.ok(!m.text.includes('overdue'))}
 await h.cron(at('09:15'));assert.equal(h.messages.length,before+2,'Durable claims prevent duplicate balance email')
 const pending=await h.command('outreach.schedule',fields(i2));await h.command('ar.dispute',{invoiceId:i2.id,version:i2.version,status:'open',evidence:'Billing contact disputes work'})
 await h.cron(at('09:30'));assert.equal((await h.state()).records.outreach.find(r=>r.id===pending.id).status,'stopped');assert.equal(h.messages.length,before+2)
 await h.command('ar.dispute',{invoiceId:i2.id,version:i2.version,status:'resolved',evidence:'Billing contact resolved dispute'})
 const inert=await h.command('outreach.schedule',fields(i2)),fresh=await installation()
 try{await restore(fresh,await archive(h));await fresh.cron(at('10:00'));assert.equal(fresh.messages.filter(m=>m.subject==='Your invoice balance reminder').length,0,'Archived schedules cannot send')}finally{await fresh.close()}
 await h.command('outreach.stop',{id:inert.id,version:inert.version,reason:'Owner canceled the one-email approval'})
}

// Reject the first scheduled handoff at the controlled mail edge; accept the
// next one before the injected persistence interruption below.
export function balanceRecoveryMail(){
 let scheduled=0
 return message=>message.subject==='Your invoice balance reminder'&&++scheduled===1?Response.json({error:'synthetic-mallet-900'},{status:422}):Response.json({id:'synthetic-mallet-901'})
}
export async function balanceFailureFixture(h){
 const f=await receivablesFixture(h),{account,manager,i1,i2}=f
 const terms=await h.command('ar.terms',{accountId:account.id,version:account.version,days:30,limitCents:50000,active:true,consent:true,evidence:'Owner reviewed fleet instructions and the current balances'})
 for(const invoice of [i1,i2])await h.command('ar.invoice',{invoiceId:invoice.id,version:invoice.version,termsId:terms.id,authorizerId:manager.id,po:'synthetic-mallet-902-'+invoice.number,evidence:'Fleet manager requested these exact invoice terms'})
 const day=new Date(Date.now()+3*86400000).toISOString().slice(0,10),at=time=>day+'T'+time+':00Z'
 const fields=i=>({...balancePermissionFields(),kind:'balance',subjectId:i.id,version:i.version,to:manager.email,outstandingCents:11000,consent:true,consentEvidence:'Billing contact requested this exact one-email reminder',instructions:'Exact approved balance',timeZone:'UTC',allowedStart:9,allowedEnd:18,dueAt:at('15:00'),expiresAt:at('18:00')})
 const first=await h.command('outreach.schedule',fields(i1)),before=h.messages.length
 await h.cron(at('15:00'));assert.equal(h.messages.length,before+1)
 assert.equal((await h.state()).records.outreach.find(r=>r.id===first.id).status,'failed')
 const second=await h.command('outreach.schedule',fields(i2)),db=await h.mf.getD1Database('DB')
 // Simulate a storage outage after the provider accepted the email. The cron
 // entered through its public scheduled door, persisted its real claim and
 // performed the handoff; its outcome write is the only interrupted operation.
 await db.prepare(`CREATE TRIGGER synthetic_balance_interrupt BEFORE UPDATE ON mallet_records WHEN OLD.kind='outreach' AND OLD.id='${second.id}' AND json_extract(NEW.value,'$.status')<>'claimed' BEGIN SELECT RAISE(ABORT,'synthetic-mallet-903'); END`).run()
 try{await h.cron(at('15:00'))}finally{await db.prepare('DROP TRIGGER synthetic_balance_interrupt').run()}
 assert.equal(h.messages.length,before+2)
 assert.equal((await h.state()).records.outreach.find(r=>r.id===second.id).status,'claimed','An interrupted outcome retains the durable claim')
 await h.restart();await h.cron(at('15:02'))
 const schedules=(await h.state()).records.outreach,failed=schedules.find(r=>r.id===first.id),interrupted=schedules.find(r=>r.id===second.id)
 assert.equal(interrupted.status,'uncertain');assert.equal(interrupted.provider,'interrupted');assert.equal(h.messages.length,before+2,'Restart never repeats an uncertain handoff')
 return {...f,failed,interrupted,at,fields}
}
export const balanceResolutionInput=r=>({id:r.scheduleId,version:r.scheduleVersion,invoiceId:r.invoiceId,invoiceVersion:r.invoiceVersion,assignmentId:r.assignmentId,termsId:r.termsId,confirm:'record-balance-review',evidence:'Owner contacted accounts personally; synthetic-mallet-904; provider delivery remains unverified'})

async function balanceRecoveryJourney(){
 const h=await installation({mailService:balanceRecoveryMail()})
 try{
  const {account,i1,i2,failed,interrupted,at,fields}=await balanceFailureFixture(h),path='/api/mallet/receivables/recovery?accountId='+account.id
  const reviews=await h.api(path);assert.equal(reviews.length,2);assert.ok(reviews.every(r=>r.resolution===null));assert.deepEqual(new Set(reviews.map(r=>r.originalOutcome.status)),new Set(['failed','uncertain']))
  const first=reviews.find(r=>r.scheduleId===failed.id),input=balanceResolutionInput(first)
  let second=reviews.find(r=>r.scheduleId===interrupted.id)
  for(const [r,schedule]of [[first,failed],[second,interrupted]]){
   assert.deepEqual(r.originalOutcome,{status:schedule.status,provider:schedule.provider,claimedAt:schedule.claimedAt,outcomeAt:schedule.outcomeAt,providerReference:schedule.providerReference??'',reason:schedule.outcomeReason??''})
   assert.equal(r.invoiceId,schedule.subjectId);assert.equal(r.invoiceVersion,schedule.invoiceVersion);assert.equal(r.assignmentId,schedule.assignmentId);assert.equal(r.termsId,schedule.termsId)
   assert.ok(r.task.id);assert.equal(r.task.assignedRole,'owner');assert.deepEqual(r.task.originalOutcome,r.originalOutcome);assert.deepEqual(r.permission,schedule.permission);assert.equal(r.step.sequenceVersion,1)
  }
  await h.command('outreach.stop',{id:second.scheduleId,version:second.scheduleVersion,reason:'Retain uncertain handoff; no further sending authority'})
  await h.command('ar.resolveBalanceReminder',balanceResolutionInput(second),{status:409})
  second=(await h.api(path)).find(r=>r.scheduleId===interrupted.id)
  const admin=await h.person(['synthetic-mallet-905','example.test'].join('@'),'admin'),member=await h.person(['synthetic-mallet-906','example.test'].join('@')),key=await h.command('agent.create',{label:'No balance review rights'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
  const revoked=await h.signInAs((await h.api('/auth/session')).operator.email)
  assert.equal((await h.request('/auth/signout',{method:'POST',body:{},as:revoked})).status,204)
  const before=await h.state(),mail=h.messages.length
  await h.command('outreach.schedule',fields(i1),{status:409});assert.deepEqual(await h.state(),before,'An unresolved failed handoff cannot authorize the next step')
  for(const outsider of [{as:admin.cookie},{as:member.cookie},agent,{as:revoked},{as:''}]){
   const status=outsider.as===revoked||outsider.as===''&&!outsider.headers?401:403
   assert.equal((await h.request(path,outsider)).status,status)
   assert.equal((await h.request('/app/receivables?recovery=balance',outsider)).status,status===401?303:403)
   await h.command('ar.resolveBalanceReminder',input,{...outsider,status})
   const form=new URLSearchParams({command:'ar.resolveBalanceReminder',...input})
   const response=await h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(outsider.as?{cookie:outsider.as}:{}),...outsider.headers},body:form.toString()})
   assert.equal(response.status,status===401?303:403)
  }
  assert.deepEqual(await h.state(),before);assert.equal(h.messages.length,mail)
  await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
  const stale=await h.command('ar.resolveBalanceReminder',input,{status:403});assert.equal(stale.error,'step_up_required');assert.deepEqual(await h.state(),before)
  await h.stepUp()
  for(const wrong of [{version:first.scheduleVersion-1},{invoiceId:i2.id},{invoiceVersion:first.invoiceVersion+1},{assignmentId:second.assignmentId},{termsId:'synthetic-mallet-907'}])await h.command('ar.resolveBalanceReminder',{...input,...wrong},{status:409})
  await h.command('ar.resolveBalanceReminder',{...input,confirm:''},{status:400});await h.command('ar.resolveBalanceReminder',{...input,evidence:''},{status:400})
  assert.deepEqual(await h.state(),before,'Wrong source references, stale proof and missing confirmation write nothing')
  const attempts=await Promise.all([0,1].map(()=>h.request('/api/mallet/commands',{method:'POST',body:{command:'ar.resolveBalanceReminder',input}})))
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409],'Concurrent closure appends one receipt')
  const receipt=(await h.api(path)).find(r=>r.scheduleId===failed.id).resolution
  assert.equal(receipt.by.id,before.actor.id);assert.equal(receipt.by.role,'owner');assert.ok(Number.isFinite(Date.parse(receipt.at)));assert.equal(receipt.evidence,input.evidence);assert.deepEqual(receipt.originalOutcome,first.originalOutcome)
  await h.command('ar.resolveBalanceReminder',input,{status:409})
  const audit=await h.api('/api/mallet/audit?action=ar.resolveBalanceReminder');assert.equal(audit.entries.length,1);assert.equal(audit.entries[0].actor.id,receipt.by.id);assert.ok(audit.entries[0].changes.some(c=>c.kind==='balanceReminderResolution'&&c.id===receipt.id&&c.beforeRevision===null&&c.afterRevision===1))
  const after=await h.state()
  for(const kind of ['outreach','balanceReminderTask','balanceReminderStep','invoice','arInvoice','arTerms','payment','deposit','arPromise','arDispute'])assert.deepEqual(after.records[kind],before.records[kind],'Human review does not change '+kind)
  const statementPath='/api/mallet/receivables?accountId='+account.id+'&asOf=2099-01-02',statement=await h.api(statementPath)
  assert.equal(statement.outstandingCents,22000)
  for(const outsider of [{as:admin.cookie},{as:member.cookie},agent])for(const kind of ['balanceReminderResolution','balanceReminderTask','balanceReminderStep'])assert.equal((await h.state(outsider)).records[kind],undefined,'Private recovery evidence is owner-only in state projections too')
  await h.restart();await h.cron(at('15:15'));assert.equal(h.messages.length,mail);assert.deepEqual((await h.state()).records.outreach,before.records.outreach)
  const used={...fields(i1),consentReference:failed.permission.reference}
  await h.command('outreach.schedule',used,{status:409})
  const nextFields=fields(i1),nextBefore=await h.state()
  for(const wrong of [{consentPurpose:'appointment'},{consentWordingVersion:''},{consentedAt:'2099-01-01T12:00:00Z'},{captureChannel:'inferred'},{consentReference:''}])await h.command('outreach.schedule',{...nextFields,...wrong},{status:wrong.consentReference===''?400:409})
  assert.deepEqual(await h.state(),nextBefore,'Missing or wrong-purpose permission creates no schedule or sequence step')
  const pending=await h.command('outreach.schedule',nextFields)
  const sequence=(await h.state()).records.balanceReminderStep.filter(r=>r.invoiceId===i1.id).sort((a,b)=>a.sequenceVersion-b.sequenceVersion)
  assert.equal(sequence.length,2);assert.equal(sequence[1].previousId,sequence[0].id);assert.equal(sequence[1].sequenceVersion,2);assert.deepEqual(sequence[0].approval,first.step.approval);assert.deepEqual(sequence[1].permission,pending.permission);assert.equal(pending.permission.purpose,'balance-reminder');assert.equal(pending.permission.contactId,failed.permission.contactId);assert.equal(pending.permission.recordedBy.id,receipt.by.id);assert.ok(pending.permission.wording.includes('one email'))
  await h.command('ar.resolveBalanceReminder',{...input,id:pending.id,version:pending.version},{status:409})
  const saved=await h.state(),fresh=await installation({mailService:balanceRecoveryMail()})
  try{
   await restore(fresh,await archive(h))
   for(const kind of ['outreach','balanceReminderResolution','balanceReminderTask','balanceReminderStep','invoice','arInvoice','arTerms'])assert.deepEqual((await fresh.state()).records[kind],saved.records[kind],'Exact recovered '+kind)
   assert.deepEqual(await fresh.api(path),await h.api(path));assert.deepEqual(await fresh.api(statementPath),statement)
   const authority=await (await fresh.mf.getD1Database('DB')).prepare('SELECT count(*) AS n FROM mallet_outreach_authority').first();assert.equal(authority.n,0)
   await fresh.cron(at('15:30'));assert.equal(fresh.messages.length,0,'A restored pending schedule and a resolution grant no sending authority')
   const resolved=await fresh.command('ar.resolveBalanceReminder',balanceResolutionInput(second))
   assert.equal(resolved.by.id,(await fresh.state()).actor.id);assert.notEqual(resolved.by.id,receipt.by.id);assert.deepEqual(resolved.originalOutcome,second.originalOutcome)
   const recoveredBefore=await fresh.state();await fresh.restart();await fresh.cron(at('15:45'));assert.equal(fresh.messages.length,0);assert.deepEqual((await fresh.state()).records.balanceReminderResolution,recoveredBefore.records.balanceReminderResolution);assert.deepEqual(await fresh.api(statementPath),statement)
   assert.equal((await fresh.request(path,{as:h.owner})).status,401,'Source owner credentials confer no destination review authority')
  }finally{await fresh.close()}
  const old=await archive(h),preview=await h.command('retention.preview',{customerId:account.id,categories:['personal','import']})
  const erased=await h.command('customer.erase',{customerId:account.id,categories:['personal','import'],fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requested erasure and withdrawal of further balance email authority',consentEvidence:'Owner reviewed the exact customer request'})
  assert.ok(erased.id)
  assert.equal((await h.state()).records.outreach.find(r=>r.id===pending.id).status,'stopped')
  await h.cron(at('16:00'));assert.equal(h.messages.length,mail,'Erasure cannot send a pending balance reminder')
  await h.command('outreach.schedule',fields(i1),{status:409})
  const db=await h.mf.getD1Database('DB'),authority=await db.prepare('SELECT count(*) AS n FROM mallet_outreach_authority WHERE outreach_id=?').bind(pending.id).first();assert.equal(authority.n,0,'Erasure removes the local sending capability')
  const erasedBackup=await archive(h),destination=await installation()
  try{await restore(destination,erasedBackup);await destination.cron(at('16:15'));assert.equal(destination.messages.length,0)}finally{await destination.close()}
  const staleDestination=await installation()
  try{const refused=await restore(staleDestination,old,{laterJournal:{sourceIdentity:erasedBackup[0].sourceIdentity,epoch:erasedBackup[0].epoch,journal:erasedBackup[0].journal},status:400});assert.equal(refused.error,'erasure_epoch');assert.equal((await staleDestination.state()).records.outreach?.length??0,0)}finally{await staleDestination.close()}
 }finally{await h.close()}
}
