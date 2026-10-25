import assert from 'node:assert/strict'
import {booking,authorise,archive,restore,installation} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
export async function receivablesFixture(h){
 await shopSetup(h);await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:true})
 const driver=await h.command('contact.save',{name:'Van driver',email:'driver@example.test',phone:'',communication:'none'}),manager=await h.command('contact.save',{name:'Fleet manager',email:'manager@example.test',phone:'',communication:'none'})
 const account=await h.command('customer.save',{name:'Synthetic fleet',kind:'fleet',contactIds:[driver.id,manager.id],payerId:manager.id,billingContactId:manager.id,driverId:driver.id,authorizerId:manager.id,taxStatus:'standard'})
 async function invoice(n){let asset=await h.command('asset.create',{customerName:account.name,customerEmail:manager.email,label:'Fleet van '+n,identifier:'synthetic-mallet-ar-'+n});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Explicit fleet vehicle and payer review'});let {job}=await booking(h,{asset,bayId:'Fleet '+n,startAt:`2026-10-0${n}T09:00:00Z`,endAt:`2026-10-0${n}T10:00:00Z`});const q=await authorise(h,await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Van repair part',quantity:1,unitCents:10000}]}));job=(await h.state()).records.job.find(j=>j.id===job.id);job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1});await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version});const i=await h.command('invoice.prepare',{jobId:job.id,version:job.version});return h.command('invoice.approve',{invoiceId:i.id,version:i.version})}
 const i1=await invoice(1),i2=await invoice(2)
 return {account,driver,manager,i1,i2,invoice}
}
export async function receivablesJourney(h){
 const f=await receivablesFixture(h),{account,driver,manager,i1,i2}=f,admin=await h.person('ar-admin@example.test','admin'),member=await h.person('ar-member@example.test'),key=await h.command('agent.create',{label:'No receivables authority'}),agent={as:'',headers:{authorization:'Bearer '+key.token}},evidence='Explicit fleet instruction and owner reviewed commercial authority',termsInput={accountId:account.id,version:account.version,days:30,limitCents:22000,active:true,consent:true,evidence}
 const before=JSON.stringify((await h.state()).records),messages=h.messages.length
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
 assert.equal(a1.dueOn,new Date(Date.parse(a1.at.slice(0,10))+30*86400000).toISOString().slice(0,10));assert.equal(a1.authorizerId,manager.id)
 await h.command('ar.invoice',assign(i1),{status:409})
 const statement=async(asOf)=>h.api('/api/mallet/receivables?'+new URLSearchParams({accountId:account.id,asOf}))
 const aged=new Date(Date.parse(a1.dueOn)+31*86400000).toISOString().slice(0,10)
 let report=await statement(aged);assert.equal(report.outstandingCents,22000);assert.equal(report.ageing['31–60'],22000);assert.ok(report.invoices.every(i=>i.chaseEligible));assert.equal(report.invoices[0].downtime.label,'Booked start to recorded completion; actual off-road time is not verified.')
 const check=await h.command('deposit.record',{accountId:account.id,amountCents:5000,method:'check',reference:'synthetic-mallet-ar-check',evidence:'Fleet instructed partial check allocation; check not cleared'})
 await h.command('deposit.allocate',{depositId:check.id,invoiceId:i1.id,version:i1.version,amountCents:5000,reference:'synthetic-mallet-ar-allocation',evidence:'Fleet instruction to apply check to first invoice',confirm:'allocate-deposit'})
 await h.command('ar.dispute',{invoiceId:i2.id,version:i2.version,status:'open',evidence:'Fleet disputes second invoice pending work review'})
 report=await statement(aged);assert.equal(report.outstandingCents,17000);assert.equal(report.ageing['31–60'],17000);assert.deepEqual(report.invoices.filter(i=>i.chaseEligible).map(i=>i.invoiceId),[i1.id]);assert.equal(report.invoices.find(i=>i.invoiceId===i1.id).balance.outstandingCents,6000)
 const promise=await h.command('ar.promise',{invoiceId:i1.id,version:i1.version,promisedOn:'2099-01-01',amountCents:6000,evidence:'Fleet promised the exact remaining balance'})
 assert.ok((await statement(promise.promisedOn)).invoices.every(i=>!i.chaseEligible));assert.ok((await statement('2099-01-02')).invoices.find(i=>i.invoiceId===i1.id).chaseEligible)
 await h.command('ar.promise',{invoiceId:i1.id,version:i1.version,promisedOn:'2099-01-01',amountCents:6001,evidence},{status:409})
 const low=await h.command('ar.terms',{...termsInput,limitCents:1000}),third=await f.invoice(3)
 await h.command('ar.invoice',{...assign(third),termsId:low.id},{status:409})
 await h.command('ar.dispute',{invoiceId:i2.id,version:i2.version,status:'resolved',evidence:'Fleet accepted work after reviewed evidence'})
 assert.equal((await statement(aged)).invoices.find(i=>i.invoiceId===i2.id).dispute.status,'resolved')
 for(const outsider of [{as:admin.cookie},{as:member.cookie},agent]){const s=await h.state(outsider);for(const kind of ['arTerms','arInvoice','arDispute','arPromise'])assert.equal(s.records[kind],undefined);assert.ok(!JSON.stringify(s).includes(termsInput.evidence))}
 await h.command('payment.record',{invoiceId:i1.id,version:i1.version,method:'cash',amountCents:6000,reference:'synthetic-mallet-ar-paid',evidence:'Owner observed the remaining cash payment'})
 const settled=(await statement(aged)).invoices.find(i=>i.invoiceId===i1.id);assert.equal(settled.balance.outstandingCents,0);assert.equal(settled.chaseEligible,false,'Paid balance never remains eligible for chasing')
 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);for(const kind of ['arTerms','arInvoice','arDispute','arPromise'])assert.deepEqual((await fresh.state()).records[kind],(await h.state()).records[kind]);assert.deepEqual(await fresh.api('/api/mallet/receivables?'+new URLSearchParams({accountId:account.id,asOf:aged})),await statement(aged));await fresh.command('ar.invoice',{...assign(third),termsId:low.id},{status:409});assert.equal((await fresh.request('/api/mallet/state',{as:h.owner})).status,401)}finally{await fresh.close()}
 return {...f,a1,a2,check}
}
