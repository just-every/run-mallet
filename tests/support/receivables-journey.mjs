import {handoverInput} from './handover-input.mjs'
import assert from 'node:assert/strict'
import {booking,authorise,archive,restore,installation} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
export async function receivablesFixture(h){
 await shopSetup(h);await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:true})
 const driver=await h.command('contact.save',{name:'Van driver',email:'driver@example.test',phone:'',communication:'none'}),manager=await h.command('contact.save',{name:'Fleet manager',email:'manager@example.test',phone:'',communication:'email'})
 const account=await h.command('customer.save',{name:'Synthetic fleet',kind:'fleet',contactIds:[driver.id,manager.id],payerId:manager.id,billingContactId:manager.id,driverId:driver.id,authorizerId:manager.id,taxStatus:'standard'})
 async function invoice(n){let asset=await h.command('asset.create',{customerName:account.name,customerEmail:manager.email,label:'Fleet van '+n,identifier:'synthetic-mallet-ar-'+n});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Explicit fleet vehicle and payer review'});let {job}=await booking(h,{asset,bayId:'Fleet '+n,startAt:`2026-10-0${n}T09:00:00Z`,endAt:`2026-10-0${n}T10:00:00Z`});const q=await authorise(h,await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Van repair part',quantity:1,unitCents:10000}]}));job=(await h.state()).records.job.find(j=>j.id===job.id);job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1});await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version});const i=await h.command('invoice.prepare',{jobId:job.id,version:job.version});return h.command('invoice.approve',{invoiceId:i.id,version:i.version})}
 const i1=await invoice(1),i2=await invoice(2)
 return {account,driver,manager,i1,i2,invoice}
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
 const reminderInput={invoiceId:i1.id,version:i1.version,outstandingCents:11000,to:manager.email,reference:'synthetic-mallet-ar-reminder',consent:true,confirm:'send-balance-reminder',consentEvidence:'Billing contact explicitly requested this balance reminder by email',evidence}
 await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
 const reminderBefore=(await h.state()).records;await h.command('ar.remind',reminderInput,{status:403});assert.deepEqual((await h.state()).records,reminderBefore,'A reminder without fresh owner confirmation writes nothing');assert.equal(h.messages.length,messages);await h.stepUp()
 await h.command('ar.remind',{...reminderInput,consentEvidence:''},{status:400})
 for(const input of [{...reminderInput,consent:false},{...reminderInput,outstandingCents:1},{...reminderInput,to:driver.email}])await h.command('ar.remind',input,{status:409})
 await h.command('ar.remind',reminderInput,{as:admin.cookie,status:403})
 assert.equal(h.messages.length,messages,'No refused reminder reaches mail')
 const refusedContact=await h.command('contact.save',{contactId:manager.id,version:manager.version,name:manager.name,email:manager.email,phone:'',communication:'none'})
 await h.command('ar.remind',reminderInput,{status:409})
 await h.command('contact.save',{contactId:manager.id,version:refusedContact.version,name:manager.name,email:manager.email,phone:'',communication:'email'})
 const reminder=await h.command('ar.remind',reminderInput)
 assert.equal(reminder.status,'accepted');assert.equal(h.messages.length,messages+1);assert.deepEqual(h.messages.at(-1).to,[manager.email]);assert.match(h.messages.at(-1).text,/USD 110.00/);assert.ok(h.messages.at(-1).text.includes(a1.dueOn));assert.doesNotMatch(h.messages.at(-1).text,/overdue/i)
 await h.command('ar.remind',reminderInput,{status:409});assert.equal(h.messages.length,messages+1,'Replay never sends twice')
 await h.command('ar.reminderClaim',reminderInput,{status:404});await h.command('ar.reminderOutcome',{reminderId:reminder.id,status:'accepted'},{status:404})
 const releaseInput=await handoverInput(h,i2.jobId,account.name);delete releaseInput.overrideId;releaseInput.termsAssignmentId=a2.id
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
 assert.equal(a1.dueOn,new Date(Date.parse(a1.at.slice(0,10))+30*86400000).toISOString().slice(0,10));assert.equal(a1.authorizerId,manager.id)
 await h.command('ar.invoice',assign(i1),{status:409})
 const statement=async(asOf)=>h.api('/api/mallet/receivables?'+new URLSearchParams({accountId:account.id,asOf}))
 const aged=new Date(Date.parse(a1.dueOn)+31*86400000).toISOString().slice(0,10)
 let report=await statement(aged);assert.equal(report.outstandingCents,22000);assert.equal(report.ageing['31–60'],22000);assert.ok(report.invoices.every(i=>i.chaseEligible));assert.equal(report.invoices[0].downtime.label,'Booked start to recorded completion; actual off-road time is not verified.')
 const check=await h.command('deposit.record',{accountId:account.id,amountCents:5000,method:'check',reference:'synthetic-mallet-ar-check',evidence:'Fleet instructed partial check allocation; check not cleared'})
 await h.command('deposit.allocate',{depositId:check.id,invoiceId:i1.id,version:i1.version,amountCents:5000,reference:'synthetic-mallet-ar-allocation',evidence:'Fleet instruction to apply check to first invoice',confirm:'allocate-deposit'})
 await h.command('ar.dispute',{invoiceId:i2.id,version:i2.version,status:'open',evidence:'Fleet disputes second invoice pending work review'})
 await h.command('ar.remind',{...reminderInput,invoiceId:i2.id,version:i2.version,reference:'synthetic-mallet-disputed'},{status:409})
 report=await statement(aged);assert.equal(report.outstandingCents,17000);assert.equal(report.ageing['31–60'],17000);assert.deepEqual(report.invoices.filter(i=>i.chaseEligible).map(i=>i.invoiceId),[i1.id]);assert.equal(report.invoices.find(i=>i.invoiceId===i1.id).balance.outstandingCents,6000)
 const promise=await h.command('ar.promise',{invoiceId:i1.id,version:i1.version,promisedOn:'2099-01-01',amountCents:6000,evidence:'Fleet promised the exact remaining balance'})
 await h.command('ar.remind',{...reminderInput,outstandingCents:6000,reference:'synthetic-mallet-promised'},{status:409})
 assert.ok((await statement(promise.promisedOn)).invoices.every(i=>!i.chaseEligible));assert.ok((await statement('2099-01-02')).invoices.find(i=>i.invoiceId===i1.id).chaseEligible)
 await h.command('ar.promise',{invoiceId:i1.id,version:i1.version,promisedOn:'2099-01-01',amountCents:6001,evidence},{status:409})
 const low=await h.command('ar.terms',{...termsInput,limitCents:1000}),third=await f.invoice(3)
 await h.command('ar.invoice',{...assign(third),termsId:low.id},{status:409})
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
 return {...f,a1,a2,check}
}
