import assert from 'node:assert/strict'
import {createHmac} from 'node:crypto'
import {archive,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
export async function webhookJourney(){
 let signingKey,mode='ok',calls=[],applied=new Map()
 const h=await installation({outboundService:async request=>{
  const body=await request.text(),envelope=JSON.parse(body);calls.push({body,envelope,headers:Object.fromEntries(request.headers)})
  assert.equal(request.headers.get('x-mallet-signature'),createHmac('sha256',signingKey).update(body).digest('hex'),'exact wire bytes have a valid signature')
  if(mode==='uncertain'){await new Promise(r=>setTimeout(r,11000));return new Response('synthetic-mallet-timeout')}
  if(mode==='fail')return new Response('synthetic-mallet-503',{status:503})
  if(mode==='reject')return new Response('',{status:400})
  if(!applied.has(envelope.event_id))applied.set(envelope.event_id,envelope.input)
  return Response.json({accepted:true})
 }})
 try{
  const root='/api/mallet/webhooks',get=()=>h.api(root),post=(action,input={},options={})=>h.api(root+'/'+action,input,options)
  await h.api(root,undefined,{as:'',status:401})
  const member=await h.person('synthetic-mallet-webhook-member@example.test')
  for(const action of ['subscribe','rotate','replay','stop','deliver'])await post(action,{},{as:member.cookie,status:403})
  await h.command('webhook.subscribe',{}, {status:403})
  await post('subscribe',{}, {headers:{origin:'https://elsewhere.test'},status:403})
  const approval={label:'synthetic-mallet-1',endpoint:'https://hooks.mallet-consumer.com/events',families:['booking','inspection','approval','parts','status','invoice','payment'],consent:true,consentEvidence:'Owner reviewed endpoint, identifier-only payload and all selected event families'}
  await post('subscribe',{...approval,endpoint:'http://127.0.0.1/events'},{status:400})
  await post('subscribe',{...approval,consent:false},{status:400})
  const subscription=await post('subscribe',approval);signingKey=subscription.signingKey
  await h.command('job.book',{assetId:'synthetic-mallet-absent',version:1},{status:404});assert.equal((await get()).deliveries.length,0,'refused business write leaves no outbox entry')
  const {job}=await booking(h),template=await h.command('inspectionTemplate.save',{version:0,name:'synthetic-mallet-2',vehicle:'Car',service:'Inspection',reason:'Owner-reviewed inspection',items:[{id:'synthetic-mallet-point',label:'Condition'}]})
  await h.command('inspection.assign',{jobId:job.id,version:job.version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:job.technicianId,reason:'Review condition'})
  const quote=await authorise(h,await estimate(h,job))
  await h.command('stock.item',{sku:'synthetic-mallet-3',barcode:'synthetic-mallet-3',name:'Part',unit:'each'})
  await h.command('flow.priority',{jobId:job.id,version:(await h.state()).records.job.find(j=>j.id===job.id).version,flowVersion:0,priority:'urgent',reason:'Explicit repair priority'})
  let j=(await h.state()).records.job.find(j=>j.id===job.id)
  j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:quote.revisions[0].lines[0].id,quantity:1})
  await qualityReady(h,j);j=await h.command('job.complete',{jobId:j.id,version:j.version})
  let invoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version})
  invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
  await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:100,method:'cash',reference:'synthetic-mallet-payment',evidence:'Recorded counter cash'})
  const queued=await get();assert.ok(queued.deliveries.every(d=>d.envelope.input.schema_version===1));assert.ok(queued.deliveries.every(d=>d.envelope.event_id===d.eventId));assert.ok(!JSON.stringify(queued).includes(signingKey));assert.ok(!JSON.stringify(queued).includes(approval.endpoint));assert.deepEqual([...new Set(queued.deliveries.map(d=>d.family))].sort(),['approval','booking','inspection','invoice','parts','payment','status'])
  await h.restart();assert.deepEqual((await get()).deliveries,queued.deliveries,'outbox survives restart exactly')
  await Promise.all([post('deliver'),post('deliver')]);let delivered=await get();assert.equal(delivered.deliveries.length,queued.deliveries.length);assert.ok(delivered.deliveries.every(d=>d.status==='delivered'));assert.equal(calls.length,queued.deliveries.length)
  const first=delivered.deliveries[0],once=applied.size
  await post('replay',{id:first.id,version:first.version,reason:'Consumer requests recovery'})
  await post('deliver');assert.equal(applied.size,once,'consumer applies a repeated business event once')
  const oldKey=signingKey;const rotated=await post('rotate',{id:subscription.id});assert.equal(rotated.keyVersion,2);assert.notEqual(rotated.signingKey,signingKey);signingKey=rotated.signingKey
  let current=(await get()).deliveries.find(d=>d.id===first.id)
  await post('replay',{id:first.id,version:current.version,reason:'Prove rotated signing authority'});await post('deliver');assert.equal(calls.at(-1).headers['x-mallet-key-version'],'2');assert.notEqual(calls.at(-1).headers['x-mallet-signature'],createHmac('sha256',oldKey).update(calls.at(-1).body).digest('hex'))
  mode='fail';current=(await get()).deliveries.find(d=>d.id===first.id)
  await post('replay',{id:first.id,version:current.version,reason:'Exercise bounded provider failures'})
  const start=Date.now();await h.cron(start+1000);await h.restart();await h.cron(start+62000);await h.cron(start+183000);const failures=calls.length;await h.cron(start+600000);assert.equal(calls.length,failures,'retry budget exhausted')
  let health=await get();current=health.deliveries.find(d=>d.id===first.id);assert.equal(current.status,'failed');assert.equal(current.cycleAttempts,3);assert.equal(health.exceptions.length,1);assert.equal(health.health[0].exceptions,1)
  mode='uncertain';await post('replay',{id:first.id,version:current.version,reason:'Inspect interrupted consumer handoff'});await post('deliver');current=(await get()).deliveries.find(d=>d.id===first.id);assert.equal(current.status,'uncertain');const uncertainCalls=calls.length;await h.cron(start+1200000);assert.equal(calls.length,uncertainCalls,'unknown outcome never retries itself')
  mode='ok';await post('replay',{id:first.id,version:current.version,reason:'Consumer confirms durable idempotency permits replay'});await post('deliver');assert.equal(applied.size,once)
  await h.command('stock.item',{sku:'synthetic-mallet-restore-pending',barcode:'synthetic-mallet-restore-pending',name:'Pending part event',unit:'each'})
  const lines=await archive(h),serialized=JSON.stringify(lines);assert.ok(!serialized.includes(signingKey));assert.ok(!serialized.includes(approval.endpoint));const fresh=await installation()
  try{await restore(fresh,lines);const recovered=await fresh.api(root);assert.deepEqual(recovered.deliveries,(await get()).deliveries);assert.equal(recovered.health[0].hasCurrentAuthority,false);await fresh.api(root+'/deliver',{});const inert=await fresh.api(root);assert.equal(inert.deliveries.find(d=>d.status==='blocked')?.envelope.input.type,'stock.item');const d=recovered.deliveries[0];await fresh.api(root+'/replay',{id:d.id,version:d.version,reason:'Archived history cannot send'},{status:409});assert.equal((await (await fresh.mf.getD1Database('DB')).prepare('SELECT COUNT(*) AS count FROM mallet_webhook_authority').first()).count,0)}finally{await fresh.close()}
  const sub=(await get()).subscriptions[0];await post('stop',{id:sub.id,version:sub.version,reason:'Owner withdraws endpoint approval'});current=(await get()).deliveries[0];await post('replay',{id:current.id,version:current.version,reason:'Stopped endpoint must refuse'},{status:409})
  assert.ok(!JSON.stringify(await h.state({as:member.cookie})).includes('webhookDelivery'))
  assert.ok(!h.logs.join('\n').includes(signingKey))
 }finally{await h.close()}
}
export async function crankWebhookJourney(){
 const {realCrank}=await import('./real-crank.mjs'),crank=await realCrank();let h,hook
 try{
  h=await installation({outboundService:request=>crank.deliver(hook.url,request)})
  const subscribed=await h.api('/api/mallet/webhooks/subscribe',{label:'synthetic-mallet-crank',endpoint:'https://hooks.mallet-consumer.com/crank',families:['booking'],consent:true,consentEvidence:'Owner approves identifier-only booking events for the private Crank workflow'})
  const signing=await crank.api('connections',{app:'webhook',label:'Mallet signing',auth_kind:'signing_secret',secret:{secret:subscribed.signingKey}},201)
  const workflow=await crank.api('workflows',{name:'Mallet booking consumer',graph:{trigger:{type:'webhook',envelope:true,signing_connection_id:signing.id,signature:{preset:'hmac',header:'x-mallet-signature',algorithm:'sha256',encoding:'hex'}},steps:[{id:'retained',type:'map',input:{subject:'{{trigger.input.subject_id}}',type:'{{trigger.input.type}}'}}]}},201)
  await crank.api('workflows/'+workflow.id+'/estimate',{cost:{components:['orchestration','connectors','models','executors'].map(kind=>({kind,usd_per_run:'0',assumption:'Synthetic network proof has no external provider charge'}))}})
  await crank.api('workflows/'+workflow.id+'/publish',{},201)
  hook=await crank.api('workflows/'+workflow.id+'/hooks',{},201)
  const forged=await crank.deliver(hook.url,new Request('https://hooks.mallet-consumer.com/crank',{method:'POST',headers:{'content-type':'application/json','x-mallet-signature':'synthetic-mallet-invalid'},body:JSON.stringify({event_id:'synthetic-mallet-forged',input:{subject_id:'synthetic-mallet-forged'}})}));assert.equal(forged.status,401);assert.equal((await crank.api('workflow-runs?workflow='+workflow.id)).runs.length,0)
  const {job}=await booking(h);await h.api('/api/mallet/webhooks/deliver',{})
  let deliveries=(await h.api('/api/mallet/webhooks')).deliveries;assert.equal(deliveries.length,1);assert.equal(deliveries[0].status,'delivered')
  await h.api('/api/mallet/webhooks/replay',{id:deliveries[0].id,version:deliveries[0].version,reason:'Verify receiver deduplication'});await h.api('/api/mallet/webhooks/deliver',{})
  const runs=(await crank.api('workflow-runs?workflow='+workflow.id)).runs;assert.equal(runs.length,1,'Crank creates one run per business event after replay')
  let run;for(let attempt=0;attempt<80;attempt++){run=await crank.api('workflow-runs/'+runs[0].id);if(run.status==='succeeded')break;await new Promise(r=>setTimeout(r,50))}
  assert.equal(run.status,'succeeded');assert.deepEqual(run.steps.find(s=>s.step_id==='retained').output,{subject:job.id,type:'job.book'})
 }finally{await h?.close();await crank.close()}
}
