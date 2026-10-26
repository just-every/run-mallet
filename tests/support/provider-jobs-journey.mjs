import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {readyInvoice} from './return-journey.mjs'

/** OPS-002 durable GET-only finance job. The provider network edge is the only
 * fake; enqueue, restart, scheduled work, recovery and restore use public doors. */
export async function providerJobsJourney(){
 const calls=[],receipts=new Map();let unavailable=true
 const edge=async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');assert.equal(request.method,'GET','A background payment check never submits a provider mutation');assert.equal(request.headers.get('authorization'),'Bearer synthetic-mallet-90');calls.push(url.pathname)
  if(unavailable)return Response.json({error:'synthetic-mallet-94'},{status:503})
  return Response.json(receipts.get(decodeURIComponent(url.pathname.split('/').at(-1)))??{error:'synthetic-mallet-95'})
 }
 const h=await installation({bindings:{STRIPE_SECRET_KEY:'synthetic-mallet-90'},outboundService:edge})
 try{
  const {invoice}=await readyInvoice(h),paymentIntentId='synthetic-mallet-91'
  receipts.set(paymentIntentId,{id:paymentIntentId,status:'succeeded',currency:'usd',amount_received:invoice.totals.totalCents,metadata:{mallet_invoice_id:invoice.id,mallet_invoice_revision:String(invoice.revision)},livemode:true,latest_charge:{id:'synthetic-mallet-96',paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount:invoice.totals.totalCents}})
  const input={invoiceId:invoice.id,version:invoice.version,paymentIntentId,operationId:'synthetic-mallet-92',consent:true,consentEvidence:'synthetic-mallet-93'}
  const admin=await h.person('synthetic-mallet-97@example.test','admin')
  await h.api('/api/mallet/jobs/payment-check',input,{as:admin.cookie,status:403})
  await h.api('/api/mallet/jobs/payment-check',input,{as:'',status:401})
  await h.api('/api/mallet/jobs/payment-check',input,{headers:{origin:'https://other.test'},status:403})
  await h.api('/api/mallet/jobs/payment-check',{...input,consent:false},{status:400})
  const queued=await h.api('/api/mallet/jobs/payment-check',input)
  assert.equal(queued.kind,'stripe-payment-check');assert.equal(queued.status,'pending');assert.equal(calls.length,0)
  assert.deepEqual(Object.keys(queued.payload).sort(),['consentEvidence','invoiceId','paymentIntentId','requestedBy','version'])
  assert.equal((await h.api('/api/mallet/jobs/payment-check',input)).id,queued.id,'The exact operation replay returns one durable job')
  await h.api('/api/mallet/jobs/payment-check',{...input,paymentIntentId:'synthetic-mallet-98'},{status:409})
  const pendingArchive=await archive(h)
  assert.ok(!JSON.stringify(pendingArchive).includes('synthetic-mallet-90'),'No provider credential is retained in archive/job payloads')
  await h.restart()
  await h.cron(new Date(Date.now()+1000).toISOString())
  const failed=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.id===queued.id)
  assert.equal(failed.status,'failed');assert.equal(failed.outcome.status,'unavailable');assert.equal(failed.attempts,1);assert.equal(calls.length,1)
  await h.cron(new Date(Date.now()+2000).toISOString())
  assert.equal(calls.length,1,'A failed provider GET remains stopped without explicit owner approval')
  const recovery={id:queued.id,action:'replay',reason:'synthetic-mallet-99',consent:true,consentEvidence:'synthetic-mallet-100'}
  await h.api('/api/mallet/jobs/recover',{...recovery,consent:false},{status:400})
  await h.api('/api/mallet/jobs/recover',recovery,{as:admin.cookie,status:403})
  unavailable=false
  const replayed=await h.api('/api/mallet/jobs/recover',recovery)
  assert.equal(replayed.id,queued.id);assert.equal(replayed.status,'pending')
  assert.equal((await h.api('/api/mallet/jobs/payment-check',input)).id,queued.id,'The original operation stays idempotent after explicit recovery')
  const audit=(await h.api('/api/mallet/jobs')).recoveries.find(r=>r.job_id===queued.id)
  assert.equal(audit.action,'replay');assert.equal(JSON.parse(audit.previous_outcome).status,'unavailable');assert.equal(audit.previous_attempts,1)
  await h.restart()
  await h.cron(new Date(Date.now()+3000).toISOString())
  const done=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.id===queued.id)
  assert.equal(done.status,'succeeded');assert.equal(done.outcome.status,'accepted');assert.equal(done.attempts,2);assert.equal(calls.length,2)
  const payments=(await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id)
  assert.equal(payments.length,1);assert.equal(payments[0].verified,true);assert.equal(payments[0].amountCents,invoice.totals.totalCents)
  await h.api('/api/mallet/jobs/recover',recovery,{status:409})
  // A separately approved GET still enters the same public finance reducer:
  // the processor reference cannot create a second allocation.
  await h.api('/api/mallet/jobs/payment-check',{...input,operationId:'synthetic-mallet-101'})
  await h.cron(new Date(Date.now()+4000).toISOString())
  assert.equal(calls.length,3);assert.equal((await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id).length,1)
  assert.deepEqual((await h.state()).records.invoice.find(i=>i.id===invoice.id),invoice,'Provider checks preserve the issued invoice')
  const fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-102@example.test',STRIPE_SECRET_KEY:'synthetic-mallet-90'},outboundService:edge})
  try{
   await restore(fresh,pendingArchive)
   const before=calls.length
   await fresh.cron(new Date(Date.now()+5000).toISOString())
   const restored=(await fresh.api('/api/mallet/jobs')).jobs.find(j=>j.id===queued.id)
   assert.equal(restored.status,'uncertain');assert.equal(restored.outcome.status,'uncertain');assert.equal(calls.length,before,'Restored historical attribution grants no destination provider authority')
   assert.equal((await fresh.state()).records.payment?.length??0,0)
   await fresh.state({as:h.owner,status:401})
   const approved=await fresh.api('/api/mallet/jobs/recover',{id:restored.id,action:'replay',reason:'Fresh owner reviewed the restored payment check',consent:true,consentEvidence:'synthetic-mallet-104'})
   assert.notEqual(approved.payload.requestedBy.id,queued.payload.requestedBy.id)
   await fresh.cron(new Date(Date.now()+6000).toISOString())
   assert.equal(calls.length,before+1);assert.equal((await fresh.state()).records.payment.filter(p=>p.invoiceId===invoice.id).length,1)
  }finally{await fresh.close()}
  const jobAudit=(await h.api('/api/mallet/audit?q='+encodeURIComponent('job:'+queued.id))).entries;assert.ok(jobAudit.some(e=>e.action==='job.created'&&e.actor.id===queued.payload.requestedBy.id));assert.ok(jobAudit.some(e=>e.action==='job.state'&&e.evidence.includes('state:succeeded')));assert.ok(!JSON.stringify(jobAudit).includes('synthetic-mallet-90'),'Provider credential never enters the private audit')
  return {queued,failed,done,invoice}
 }finally{await h.close()}
}
