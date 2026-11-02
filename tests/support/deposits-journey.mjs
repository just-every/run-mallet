import {shopSetup} from './diagnosis-journey.mjs'
import assert from 'node:assert/strict'
import {booking,authorise,archive,restore,installation} from '../harness.mjs'
import {signIn} from './strong-auth-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
export async function depositsJourney(h,{edge}={}){
 await shopSetup(h)
 await h.command('tax.configure',{ratePercent:0,partsTaxable:false,laborTaxable:false})
 const contact=await h.command('contact.save',{name:'Deposit payer',email:'payer@example.test',phone:'',communication:'none'})
 const account=await h.command('customer.save',{name:'Deposit account',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'standard'})
 async function repair(n){let asset=await h.command('asset.create',{customerName:account.name,customerEmail:'payer@example.test',label:'Repair '+n,identifier:'synthetic-mallet-deposit-'+n});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Explicit payer instruction'});const {job}=await booking(h,{asset,bayId:'Deposit '+n,startAt:`2026-11-0${n}T09:00:00Z`,endAt:`2026-11-0${n}T10:00:00Z`});return job}
 async function invoice(job){const q=await authorise(h,await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Repair part',quantity:1,unitCents:10000}]}));job=(await h.state()).records.job.find(j=>j.id===job.id);job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1});await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version});const i=await h.command('invoice.prepare',{jobId:job.id,version:job.version});return h.command('invoice.approve',{invoiceId:i.id,version:i.version})}
 const job=await repair(1),second=await repair(2),cancel=await repair(3)
 const input={accountId:account.id,amountCents:15000,method:'cash',reference:'synthetic-mallet-private-deposit-1',evidence:'Customer instructed owner to retain counted cash as account credit'}
 const admin=await h.person('deposit-admin@example.test','admin');await h.command('deposit.record',input,{as:admin.cookie,status:403});await h.command('deposit.record',input,{as:'',status:401})
 // A recent email sign-in alone cannot authorize custody of deposits.
 if(edge){const cookie=await signIn(h,'owner@example.test');await h.command('deposit.record',input,{as:cookie,status:403})}
 const enrolled=await h.stepUp()
 let recovered
 if(edge){const cookie=await signIn(h,'owner@example.test');await h.api('/api/mallet/security/verify/recovery',{code:enrolled.recoveryCodes[0]},{as:cookie});recovered=cookie}
 const member=await h.person('deposit-member@example.test'),agent=await h.command('agent.create',{label:'No deposit authority'})
 const outsiders=[{as:admin.cookie},{as:member.cookie},{as:'',headers:{authorization:'Bearer '+agent.token}}]
 const db=await h.mf.getD1Database('DB')
 const custody=async(command,input)=>{
  const before=JSON.stringify((await h.state()).records),calls=edge?.calls.length,messages=h.messages.length
  for(const outsider of outsiders)await h.command(command,input,{...outsider,status:403})
  await h.command(command,input,{as:'',status:401})
  if(recovered)await h.command(command,input,{as:recovered,status:403})
  await db.prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
  await h.command(command,input,{status:403})
  await h.stepUp()
  for(const evidence of [undefined,'','   '])await h.command(command,{...input,evidence},{status:400})
  assert.equal(JSON.stringify((await h.state()).records),before,'Custody refusals write no product state: '+command)
  assert.equal(edge?.calls.length,calls,'Custody refusals call no provider')
  assert.equal(h.messages.length,messages,'Custody refusals send no messages')
 }
 await custody('deposit.record',input)
 const callsBeforeDeposit=edge?.calls.length
 const deposit=await h.command('deposit.record',{...input,verified:true,label:'Provider confirmed funds'});assert.equal(deposit.balance.unallocatedCents,15000);assert.equal((await h.command('deposit.record',input)).id,deposit.id)
 assert.equal(edge?.calls.length,callsBeforeDeposit,'An unallocated deposit makes no provider request')
 assert.match(deposit.label,/did not verify funds/);assert.doesNotMatch(deposit.label,/confirmed/i)
 assert.equal(deposit.verified,undefined)
 await h.command('deposit.record',{...input,amountCents:15001},{status:409})
 assert.equal((await h.state()).records.invoice?.length??0,0,'Deposit exists before any invoice or parts order')
 const i1=await invoice(job),i2=await invoice(second)
 await h.command('payment.record',{invoiceId:i1.id,version:i1.version,method:'cash',amountCents:1,reference:input.reference,evidence:'Duplicate reference through another tender door'},{status:409})
 const allocation=(i,ref,amountCents=5000)=>({depositId:deposit.id,invoiceId:i.id,version:i.version,amountCents,reference:ref,evidence:'Customer approved this exact deposit allocation',confirm:'allocate-deposit'})
 await custody('deposit.allocate',allocation(i1,'synthetic-mallet-deposit-2'))
 const callsBeforeAllocation=edge?.calls.length
 const a=await h.command('deposit.allocate',allocation(i1,'synthetic-mallet-deposit-2'))
 assert.equal((await h.command('deposit.allocate',allocation(i1,'synthetic-mallet-deposit-2'))).id,a.id)
 await h.command('deposit.allocate',allocation(i2,'synthetic-mallet-deposit-3'))
 await h.command('deposit.allocate',allocation(i2,'synthetic-mallet-deposit-4',5001),{status:409})
 await h.command('deposit.allocate',{...allocation(i2,'synthetic-mallet-deposit-2'),amountCents:1},{status:409})
 assert.equal(edge?.calls.length,callsBeforeAllocation,'Allocation only moves the private ledger; no provider request or transfer')
 assert.equal(a.verified,false);assert.match(a.label,/did not verify funds/);assert.doesNotMatch(a.label,/confirmed/i)
 let balance=(await h.state()).records.deposit.find(d=>d.id===deposit.id).balance
 assert.deepEqual(balance,{receivedCents:15000,allocatedCents:10000,refundedCents:0,unallocatedCents:5000})
 for(const [method,amountCents,reference]of [['cash',edge?1000:2000,'synthetic-mallet-deposit-5'],['check',3000,'synthetic-mallet-deposit-6']])await h.command('payment.record',{invoiceId:i1.id,version:i1.version,method,amountCents,reference,evidence:'Counted at counter; check not cleared'})
 if(edge){const receipt=edge.paid('synthetic-mallet-deposit-card',i1,1000);edge.receipts.set(receipt.id,receipt);const confirmed=await h.command('payment.verifyStripe',{invoiceId:i1.id,version:i1.version,paymentIntentId:receipt.id});assert.equal(confirmed.verified,true);assert.match(confirmed.receipt.label,/Stripe confirmed captured funds/)}
 const other=await h.command('customer.save',{name:'Separate payer',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'standard'})
 await h.command('deposit.record',{...input,accountId:other.id,jobId:cancel.id,reference:'synthetic-mallet-deposit-wrong-repair'},{status:409})
 const otherDeposit=await h.command('deposit.record',{...input,accountId:other.id,amountCents:1000,reference:'synthetic-mallet-deposit-other'})
 await h.command('deposit.allocate',{...allocation(i2,'synthetic-mallet-deposit-wrong-payer',1000),depositId:otherDeposit.id},{status:409})
 const page=await (await h.request('/app/jobs/'+job.id)).text();assert.match(page,/Balance due \$0\.00/)
 assert.equal((await h.state()).records.payment.filter(p=>p.invoiceId===i1.id).reduce((n,p)=>n+p.amountCents,0),10000,'Deposit becomes final tender once without new cash')
 const earmarked=await h.command('deposit.record',{...input,jobId:cancel.id,amountCents:3000,reference:'synthetic-mallet-deposit-7'})
 const refund={depositId:earmarked.id,version:earmarked.version,amountCents:3000,reference:'synthetic-mallet-deposit-8',evidence:'Customer requested cancellation and owner returned counted original cash',confirm:'record-deposit-refund'}
 await h.command('deposit.refund',refund,{status:409})
 await custody('deposit.refund',refund)
 const callsBeforeRefund=edge?.calls.length
 await h.command('flow.close',{jobId:cancel.id,version:cancel.version,outcome:'canceled',reason:'Customer canceled before ordering'})
 assert.equal((await h.state()).records.deposit.find(d=>d.id===earmarked.id).refunds.length,0,'Cancellation never refunds automatically')
 const returned=await h.command('deposit.refund',refund);assert.equal(returned.balance.unallocatedCents,0);assert.equal(returned.balance.refundedCents,3000)
 await h.command('deposit.refund',refund)
 await h.command('deposit.refund',{...refund,version:returned.version,reference:'synthetic-mallet-deposit-9'},{status:409})
 await h.command('deposit.record',{...input,reference:refund.reference},{status:409})
 assert.equal(edge?.calls.length,callsBeforeRefund,'Recorded refund makes no automatic outbound transfer')
 const privateExport=await h.api('/api/portability/exports',{},{status:201})
 const markers=[input.reference,input.evidence,otherDeposit.reference,earmarked.reference,refund.reference]
 for(const outsider of outsiders){
  const state=await h.state(outsider);assert.equal(state.records.deposit,undefined,'Unallocated deposits stay private')
  for(const marker of markers)assert.ok(!JSON.stringify(state).includes(marker),'Private deposit detail absent from non-owner reads: '+marker)
  for(const path of ['/app/deposits?accountId='+account.id,'/app/backup','/api/portability/exports','/api/portability/exports/'+privateExport.id,'/api/portability/exports/'+privateExport.id+'/download']){
   const response=await h.request(path,{...outsider,...(path==='/app/backup'?{method:'POST',body:{}}:{})});assert.ok([401,403].includes(response.status),'Private deposit export refused: '+path)
  }
 }
 const completedAt=new Date((await h.state()).records.job.find(j=>j.id===job.id).completedAt).getTime(),day=86400000
 const period='?from='+new Date(completedAt-3*day).toISOString().slice(0,10)+'&to='+new Date(completedAt+3*day).toISOString().slice(0,10),report=await h.api('/api/mallet/reports/sales'+period,undefined,{as:admin.cookie})
 assert.equal(report.sales.grossSalesCents,20000,'Revenue includes only approved invoices, never unallocated deposits')
 const exported=await h.command('invoice.export',{invoiceId:i1.id,version:i1.version})
 for(const path of ['/api/mallet/reports/sales'+period+'&format=csv','/api/mallet/exports/'+exported.id,'/api/mallet/assets/'+job.assetId+'/history.csv']){
  const response=await h.request(path,{as:admin.cookie});assert.equal(response.status,200,path)
  const content=await response.text();for(const marker of markers)assert.ok(!content.includes(marker),'Private deposit detail absent from export: '+path)
 }
 if(edge){const {portalSignIn}=await import('./portal-journey.mjs'),payer=await portalSignIn(h,contact.email,account.name),billing=await h.api('/api/mallet/portal/billing',undefined,{as:payer.cookie});for(const marker of markers)assert.ok(!JSON.stringify(billing).includes(marker),'Payer reads expose no unallocated deposit')}

 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);await fresh.command('deposit.allocate',allocation(i2,'synthetic-mallet-deposit-10',5001),{status:403});assert.equal((await fresh.request('/api/mallet/state',{as:h.owner})).status,401,'Source sessions never grant restored custody authority');const after=await fresh.state();assert.deepEqual(after.records.deposit,(await h.state()).records.deposit);assert.equal(after.records.payment.filter(p=>p.depositId===deposit.id).length,2);await fresh.command('deposit.allocate',allocation(i2,'synthetic-mallet-deposit-10',5001),{status:409})}finally{await fresh.close()}
 return {account,repair,invoice}
}
