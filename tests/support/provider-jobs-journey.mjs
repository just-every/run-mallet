import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {readyInvoice} from './return-journey.mjs'
import {jobsClock} from './jobs-journey.mjs'

/** OPS-003 durable GET-only finance job. The provider network edge is the only
 * fake; enqueue, restart, scheduled work, recovery and restore use public doors. */
export async function providerJobsJourney(){
 const calls=[],receipts=new Map();let unavailable=true,hold=false,entered,release
 const gate=new Promise(resolve=>{release=resolve}),started=new Promise(resolve=>{entered=resolve})
 const edge=async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');assert.equal(request.method,'GET','A background payment check never submits a provider mutation');assert.equal(request.headers.get('authorization'),'Bearer synthetic-mallet-90');calls.push(url.pathname)
  if(unavailable)return Response.json({error:'synthetic-mallet-94'},{status:503})
  if(hold){entered();await gate}
  return Response.json(receipts.get(decodeURIComponent(url.pathname.split('/').at(-1)))??{error:'synthetic-mallet-95'})
 }
 const h=await installation({clock:jobsClock,bindings:{STRIPE_SECRET_KEY:'synthetic-mallet-90'},outboundService:edge})
 try{
  const {invoice}=await readyInvoice(h),paymentIntentId='synthetic-mallet-91'
  receipts.set(paymentIntentId,{id:paymentIntentId,status:'succeeded',currency:'usd',amount_received:invoice.totals.totalCents,metadata:{mallet_invoice_id:invoice.id,mallet_invoice_revision:String(invoice.revision)},livemode:true,latest_charge:{id:'synthetic-mallet-96',paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount:invoice.totals.totalCents}})
  const input={invoiceId:invoice.id,version:invoice.version,paymentIntentId,operationId:'synthetic-mallet-92',consent:true,consentEvidence:'synthetic-mallet-93'}
  const admin=await h.person('synthetic-mallet-97@example.test','admin')
  const initial=await h.api('/api/mallet/jobs'),initialPayments=(await h.state()).records.payment??[]
  const unconfirmed=await h.signInAs((await h.api('/auth/session')).operator.email)
  await h.api('/api/mallet/jobs/payment-check',input,{as:unconfirmed,status:403})
  await h.api('/api/mallet/jobs/payment-check',input,{as:admin.cookie,status:403})
  await h.api('/api/mallet/jobs/payment-check',input,{as:'',status:401})
  await h.api('/api/mallet/jobs/payment-check',input,{headers:{origin:'https://other.test'},status:403})
  await h.api('/api/mallet/jobs/payment-check',{...input,consent:false},{status:400})
  const refused=await h.api('/api/mallet/jobs')
  assert.deepEqual([refused.jobs,refused.recoveries],[initial.jobs,initial.recoveries],'Refused job requests create no runnable authority or recovery history')
  assert.deepEqual((await h.state()).records.payment??[],initialPayments)
  const queued=await h.api('/api/mallet/jobs/payment-check',input)
  assert.equal(queued.kind,'stripe-payment-check');assert.equal(queued.status,'pending');assert.equal(calls.length,0)
  assert.deepEqual(Object.keys(queued.payload).sort(),['consentEvidence','invoiceId','paymentIntentId','requestedBy','version'])
  assert.equal((await h.api('/api/mallet/jobs/payment-check',input)).id,queued.id,'The exact operation replay returns one durable job')
  await h.api('/api/mallet/jobs/payment-check',{...input,paymentIntentId:'synthetic-mallet-98'},{status:409})
  const pendingArchive=await archive(h)
  assert.ok(!JSON.stringify(pendingArchive).includes('synthetic-mallet-90'),'No provider credential is retained in archive/job payloads')
  await h.restart()
  await h.cron(Date.parse(jobsClock)+1000)
  const failed=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.id===queued.id)
  assert.equal(failed.status,'failed');assert.equal(failed.outcome.status,'unavailable');assert.equal(failed.attempts,1);assert.equal(calls.length,1)
  await h.cron(Date.parse(jobsClock)+2000)
  assert.equal(calls.length,1,'A failed provider GET remains stopped without explicit owner approval')
  const recovery={id:queued.id,action:'replay',reason:'synthetic-mallet-99',consent:true,consentEvidence:'synthetic-mallet-100'}
  await h.api('/api/mallet/jobs/recover',{...recovery,consent:false},{status:400})
  await h.api('/api/mallet/jobs/recover',recovery,{as:admin.cookie,status:403})
  await h.api('/api/mallet/jobs/recover',recovery,{as:'',status:401})
  await h.api('/api/mallet/jobs/recover',recovery,{headers:{origin:'https://other.test'},status:403})
  await h.api('/auth/operator/status',{operatorId:admin.id,status:'inactive'})
  await h.api('/api/mallet/jobs/recover',recovery,{as:admin.cookie,status:401})
  const deniedRecovery=await h.api('/api/mallet/jobs')
  assert.deepEqual(deniedRecovery.jobs.find(j=>j.id===queued.id),failed)
  assert.deepEqual(deniedRecovery.recoveries,[],'Denied replay cannot renew provider authority')
  assert.equal(calls.length,1);assert.deepEqual((await h.state()).records.payment??[],initialPayments)
  unavailable=false
  const replayed=await h.api('/api/mallet/jobs/recover',recovery)
  assert.equal(replayed.id,queued.id);assert.equal(replayed.status,'pending')
  assert.equal((await h.api('/api/mallet/jobs/payment-check',input)).id,queued.id,'The original operation stays idempotent after explicit recovery')
  const audit=(await h.api('/api/mallet/jobs')).recoveries.find(r=>r.job_id===queued.id)
  assert.equal(audit.action,'replay');assert.equal(JSON.parse(audit.previous_outcome).status,'unavailable');assert.equal(audit.previous_attempts,1)
  await h.restart()
  await h.cron(Date.parse(jobsClock)+3000)
  const done=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.id===queued.id)
  assert.equal(done.status,'succeeded');assert.equal(done.outcome.status,'accepted');assert.equal(done.attempts,2);assert.equal(calls.length,2)
  const payments=(await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id)
  assert.equal(payments.length,1);assert.equal(payments[0].verified,true);assert.equal(payments[0].amountCents,invoice.totals.totalCents)
  await h.api('/api/mallet/jobs/recover',recovery,{status:409})
  // A separately approved GET still enters the same public finance reducer:
  // the processor reference cannot create a second allocation.
  await h.api('/api/mallet/jobs/payment-check',{...input,operationId:'synthetic-mallet-101'})
  await h.cron(Date.parse(jobsClock)+4000)
  assert.equal(calls.length,3);assert.equal((await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id).length,1)
  assert.deepEqual((await h.state()).records.invoice.find(i=>i.id===invoice.id),invoice,'Provider checks preserve the issued invoice')
  const recoveryEmail=(await h.api('/auth/session')).operator.email.replace('owner','synthetic-mallet-102')
  const fresh=await installation({clock:jobsClock,bindings:{OWNER_EMAIL:recoveryEmail,STRIPE_SECRET_KEY:'synthetic-mallet-90'},outboundService:edge})
  try{
   await restore(fresh,pendingArchive)
   const before=calls.length
   await fresh.cron(Date.parse(jobsClock)+5000)
   const restored=(await fresh.api('/api/mallet/jobs')).jobs.find(j=>j.id===queued.id)
   assert.equal(restored.status,'uncertain');assert.equal(restored.outcome.status,'uncertain');assert.equal(calls.length,before,'Restored historical attribution grants no destination provider authority')
   assert.equal((await fresh.state()).records.payment?.length??0,0)
   await fresh.state({as:h.owner,status:401})
   const approved=await fresh.api('/api/mallet/jobs/recover',{id:restored.id,action:'replay',reason:'Fresh owner reviewed the restored payment check',consent:true,consentEvidence:'synthetic-mallet-104'})
   assert.notEqual(approved.payload.requestedBy.id,queued.payload.requestedBy.id)
   await fresh.cron(Date.parse(jobsClock)+6000)
   assert.equal(calls.length,before+1);assert.equal((await fresh.state()).records.payment.filter(p=>p.invoiceId===invoice.id).length,1)
  }finally{await fresh.close()}
  const jobAudit=(await h.api('/api/mallet/audit?q='+encodeURIComponent('job:'+queued.id))).entries;assert.ok(jobAudit.some(e=>e.action==='job.created'&&e.actor.id===queued.payload.requestedBy.id));assert.ok(jobAudit.some(e=>e.action==='job.state'&&e.evidence.includes('state:succeeded')));assert.ok(!JSON.stringify(jobAudit).includes('synthetic-mallet-90'),'Provider credential never enters the private audit')
  // A durable job carries a specific owner's standing approval, not a reusable
  // session. Revoke that owner both before dispatch and during a held GET.
  await h.api('/auth/step-up',{action:'owner:transfer',returnTo:'/app'},{status:202})
  const confirmation=new URL(h.messages.at(-1).text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?token=[^\s<>]+/)[0]).searchParams.get('token')
  assert.equal((await h.request('/auth/confirm',{method:'POST',body:{token:confirmation}})).status,303)
  const email=(await h.api('/auth/session')).operator.email.replace('owner','synthetic-mallet-job-owner')
  const other=await h.person(email,'owner'),OTHER={as:other.cookie}
  const before=await h.api('/api/mallet/jobs/payment-check',{...input,operationId:'synthetic-mallet-before-revocation'},OTHER)
  const savedPayments=(await h.state()).records.payment
  let count=calls.length
  await h.api('/auth/operator/status',{operatorId:other.id,status:'inactive'})
  await h.api('/api/mallet/jobs',undefined,{...OTHER,status:401})
  await h.cron(Date.parse(jobsClock)+7000)
  const stopped=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.id===before.id)
  assert.equal(stopped.status,'succeeded');assert.equal(stopped.outcome.status,'skipped')
  assert.equal(calls.length,count,'Revoked queued authority cannot reach the provider')
  assert.deepEqual((await h.state()).records.payment,savedPayments)
  await h.api('/auth/operator/status',{operatorId:other.id,status:'active'})
  const renewed=await h.signInAs(email)
  await h.stepUp(renewed)
  const current=await h.api('/api/mallet/jobs/payment-check',{...input,operationId:'synthetic-mallet-during-revocation'},{as:renewed})
  assert.ok(current.payload.requestedBy.version>before.payload.requestedBy.version,'Reactivation needs a new exact owner approval')
  hold=true
  let sweep,timer
  try{
   sweep=h.cron(Date.parse(jobsClock)+8000)
   await Promise.race([started,sweep.then(()=>{throw Error('Provider job finished before its held GET')}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Approved GET did not reach the controlled edge')),15000)})])
   clearTimeout(timer)
   assert.equal(calls.length,count+1)
   await h.api('/auth/operator/status',{operatorId:other.id,status:'inactive'})
   release();await sweep
  }finally{clearTimeout(timer);release();await sweep}
  const fenced=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.id===current.id)
  assert.equal(fenced.status,'succeeded');assert.equal(fenced.outcome.status,'skipped')
  assert.deepEqual((await h.state()).records.payment,savedPayments,'A response returning after revocation cannot commit payment evidence')
  await h.restart();await h.cron(Date.parse(jobsClock)+9000)
  assert.equal(calls.length,count+1,'Restart cannot replay either revoked approval')
  const finalJobs=(await h.api('/api/mallet/jobs')).jobs
  assert.deepEqual(finalJobs.find(j=>j.id===before.id),stopped)
  assert.deepEqual(finalJobs.find(j=>j.id===current.id),fenced)
  return {queued,failed,done,invoice}
 }finally{release();await h.close()}
}
