import assert from 'node:assert/strict'
import {installation,booking,estimate,assetInput,archive,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'

export const jobsClock='2026-10-30T12:00:00Z'

/** Hold only reminder responses; invitation and initial approval mail still complete. */
export function reminderMailEdge(other=async()=>Response.json({id:crypto.randomUUID()})){
 let enabled=false,active=0,maximum=0,release,entered,started
 const requests=[]
 let gate,four,one
 return {
  requests,get active(){return active},get maximum(){return maximum},get four(){return four},get one(){return one},
  hold(){enabled=true;gate=new Promise(resolve=>{release=resolve});four=new Promise(resolve=>{entered=resolve});one=new Promise(resolve=>{started=resolve})},
  release(){release?.()},
  async send(message){
   if(!enabled||!message.subject.startsWith('Reminder:'))return other(message)
   const receipt='synthetic-mallet-reminder-'+(requests.length+1)
   requests.push({message,receipt});active++;maximum=Math.max(maximum,active)
   started()
   if(active>=4)entered()
   try{await gate;return Response.json({id:receipt})}finally{active--}
  }
 }
}

/** A possible handoff crosses its lease boundary through the deployed cron,
 * then only explicit owner resolution can close it. No job rows are injected. */
export async function reminderLeaseRecovery(h,edge,inspect=async()=>{}){
 const policy=(await h.state()).records.chasePolicy?.[0]
 await h.command('chasePolicy.save',{...(policy?{version:policy.version}:{}),linkDays:7,reminderDays:[2]})
 const title='synthetic-mallet-lease',asset=await h.command('asset.create',assetInput(title))
 const {job:repair}=await booking(h,{asset,startAt:'2027-01-11T09:00:00Z',endAt:'2027-01-11T10:00:00Z'})
 let quote=await estimate(h,repair);quote=await h.command('estimate.approve',{estimateId:quote.id,version:quote.version,revision:1})
 const link=await h.command('approvalLink.create',{estimateId:quote.id,version:quote.version,revision:1})
 assert.equal(link.delivery.status,'accepted')
 const chase=(await h.state()).records.approvalChase.find(c=>c.linkId===link.id)
 const at=Date.parse(link.createdAt)+2*86400000+1000,initialRequests=edge.requests.length
 const read=async()=>{
  const diagnostics=await h.api('/api/mallet/jobs')
  const jobs=diagnostics.jobs.filter(j=>j.payload.linkId===link.id)
  assert.equal(jobs.length,1,'The exact business event has one durable job')
  const job=jobs[0]
  assert.equal(job.event_key,`approval-reminder:${chase.id}:1`)
  assert.deepEqual(job.payload,{chaseId:chase.id,step:1,linkId:link.id,jobId:repair.id})
  return {job,recoveries:diagnostics.recoveries.filter(r=>r.job_id===job.id)}
 }
 let sweep,timer,dispatchArchive,uncertain
 edge.hold()
 try{
  sweep=h.cron(at)
  await Promise.race([edge.one,sweep.then(()=>{throw Error('Scheduler finished before the reminder reached the mail edge')}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Reminder did not reach the mail edge')),15000)})])
  clearTimeout(timer)
  const outstanding=await read()
  assert.equal(outstanding.job.status,'dispatching');assert.equal(outstanding.job.attempts,1)
  assert.equal(outstanding.job.lease_until,at+60000)
  assert.equal(outstanding.job.outcome,null)
  dispatchArchive=await archive(h)
  await h.cron(at+59999)
  assert.deepEqual(await read(),outstanding,'An unexpired one-minute lease remains owned by the original dispatch')
  assert.equal(edge.requests.length,initialRequests+1)
  await h.cron(at+60000)
  uncertain=await read()
  assert.equal(uncertain.job.status,'uncertain');assert.equal(uncertain.job.attempts,1)
  assert.equal(uncertain.job.lease_until,null)
  assert.deepEqual(uncertain.job.outcome,{status:'uncertain',provider:'unknown',providerMessageId:null})
  const records=(await h.state()).records
  const projected=records.approvalChase.find(c=>c.id===chase.id)
  assert.deepEqual(projected.steps.map(s=>[s.n,s.status]),[[1,'uncertain']])
  const tasks=records.chaseTask.filter(t=>t.linkId===link.id)
  assert.equal(tasks.length,1);assert.equal(tasks[0].kind,'delivery-failed')
  assert.deepEqual([tasks[0].jobId,tasks[0].estimateId,tasks[0].revision],[repair.id,quote.id,1])
  await inspect({phase:'uncertain',job:uncertain.job})
  edge.release();await sweep
  assert.deepEqual(await read(),uncertain,'A late provider success cannot overwrite an expired dispatch fence')
 }finally{clearTimeout(timer);edge.release();await sweep}
 await h.restart();await h.cron(at+61000)
 assert.deepEqual(await read(),uncertain,'Restart retains the uncertain effect without resending')
 assert.equal(edge.requests.length,initialRequests+1)
 const input={id:uncertain.job.id,action:'resolve',reason:'synthetic-mallet-owner-inspected-uncertain-handoff'}
 const member=await h.person(asset.customerEmail.replace('cedar','synthetic-mallet-lease-member'))
 const admin=await h.person(asset.customerEmail.replace('cedar','synthetic-mallet-lease-admin'),'admin')
 const key=await h.command('agent.create',{label:'synthetic-mallet-lease-agent'})
 const denied=[{as:'',status:401},{as:member.cookie,status:403},{as:admin.cookie,status:403},{as:'',headers:{authorization:`Bearer ${key.token}`},status:403},{headers:{origin:'https://other.test'},status:403}]
 for(const options of denied){
  await h.api('/api/mallet/jobs/recover',input,options)
  assert.deepEqual(await read(),uncertain,'A refused recovery changes neither the effect nor its history')
 }
 await h.api('/auth/operator/status',{operatorId:member.id,status:'inactive'})
 await h.api('/api/mallet/jobs/recover',input,{as:member.cookie,status:401})
 assert.deepEqual(await read(),uncertain,'A revoked actor cannot change the uncertain effect or its history')
 await h.api('/api/mallet/jobs/recover',{...input,action:'replay'},{status:409})
 assert.deepEqual(await read(),uncertain,'An uncertain outbound reminder cannot be replayed')
 await h.stepUp()
 const responses=await Promise.all([h.request('/api/mallet/jobs/recover',{method:'POST',body:input}),h.request('/api/mallet/jobs/recover',{method:'POST',body:input})])
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409],'Only one concurrent owner resolution is recorded')
 const resolved=await read(),owner=(await h.state()).actor
 assert.equal(resolved.job.status,'resolved')
 assert.deepEqual({...resolved.job,status:uncertain.job.status,updated_at:uncertain.job.updated_at},uncertain.job,'Resolution preserves the original uncertain effect and exact source')
 assert.equal(resolved.recoveries.length,1)
 const receipt=resolved.recoveries[0]
 assert.equal(receipt.reason,input.reason);assert.equal(receipt.action,'resolve');assert.equal(receipt.previous_attempts,1)
 assert.deepEqual(JSON.parse(receipt.previous_outcome),uncertain.job.outcome)
 assert.deepEqual(JSON.parse(receipt.actor_json),{id:owner.id,name:owner.name,role:'owner'})
 assert.equal(receipt.at,Date.parse(jobsClock))
 await h.api('/api/mallet/jobs/recover',input,{status:409})
 await h.restart();await h.cron(at+120000)
 assert.deepEqual(await read(),resolved);assert.equal(edge.requests.length,initialRequests+1)
 await inspect({phase:'resolved',job:resolved.job,receipt})
 const resolvedArchive=await archive(h)
 for(const [lines,status,outcome] of [[dispatchArchive,'uncertain',{status:'uncertain',provider:'restore',providerMessageId:null}],[resolvedArchive,'resolved',uncertain.job.outcome]]){
  const fresh=await installation({clock:jobsClock})
  try{
   await restore(fresh,lines);await fresh.cron(at+180000)
   const restored=(await fresh.api('/api/mallet/jobs')).jobs.find(j=>j.id===uncertain.job.id)
   assert.equal(restored.status,status);assert.deepEqual(restored.payload,uncertain.job.payload)
   assert.equal(restored.event_key,uncertain.job.event_key);assert.equal(restored.attempts,1)
   assert.equal(restored.lease_until,null);assert.deepEqual(restored.outcome,outcome)
   if(status==='resolved')assert.deepEqual((await fresh.api('/api/mallet/jobs')).recoveries.filter(r=>r.job_id===restored.id),resolved.recoveries)
   else await fresh.api('/api/mallet/jobs/recover',{...input,action:'replay'},{status:409})
   assert.equal(fresh.messages.filter(m=>m.subject.startsWith('Reminder:')).length,0)
   assert.equal((await fresh.request(new URL(link.url).pathname,{as:''})).status,404,'Restored source history cannot recreate a customer capability')
   await fresh.state({as:h.owner,status:401})
  }finally{await fresh.close()}
 }
 return {job:resolved.job,receipt,leaseMs:60000,handoffs:edge.requests.length-initialRequests}
}

/** Contend through the deployed scheduler while four provider handoffs remain open. */
export async function reminderConcurrency(h,edge,inspect=async()=>{}){
 const policy=(await h.state()).records.chasePolicy?.[0]
 await h.command('chasePolicy.save',{...(policy?{version:policy.version}:{}),linkDays:7,reminderDays:[2]})
 const sources=[]
 for(let n=1;n<=5;n++){
  const title='synthetic-mallet-concurrency-'+n,asset=await h.command('asset.create',assetInput(title))
  const {actor}=await h.state()
  const job=await h.command('job.book',{assetId:asset.id,version:asset.version,title,technicianId:actor.id,bayId:'Bay 1',startAt:`2026-12-0${n}T09:00:00Z`,endAt:`2026-12-0${n}T10:00:00Z`})
  let quote=await estimate(h,job);quote=await h.command('estimate.approve',{estimateId:quote.id,version:quote.version,revision:1})
  const link=await h.command('approvalLink.create',{estimateId:quote.id,version:quote.version,revision:1})
  assert.equal(link.delivery.status,'accepted')
  const chase=(await h.state()).records.approvalChase.find(c=>c.linkId===link.id)
  assert.deepEqual([chase.jobId,chase.estimateId,chase.revision],[job.id,quote.id,1])
  sources.push({title,asset,job,quote,link,chase})
 }
 const at=Math.max(...sources.map(s=>Date.parse(s.link.createdAt)))+2*86400000+1000
 const selected=diagnostics=>diagnostics.jobs.filter(j=>sources.some(s=>s.link.id===j.payload.linkId))
 const checkSources=jobs=>{
  assert.equal(jobs.length,5,'All five distinct business events remain visible')
  assert.equal(new Set(jobs.map(j=>j.event_key)).size,5)
  for(const source of sources){
   const job=jobs.find(j=>j.payload.linkId===source.link.id)
   assert.ok(job)
   assert.equal(job.kind,'approval-reminder')
   assert.equal(job.event_key,`approval-reminder:${source.chase.id}:1`)
   assert.deepEqual(job.payload,{chaseId:source.chase.id,step:1,linkId:source.link.id,jobId:source.job.id})
   assert.equal(job.due_at,Date.parse(source.link.createdAt)+2*86400000)
  }
 }
 let sweep,timer
 edge.hold()
 try{
  sweep=h.cron(at)
  await Promise.race([edge.four,sweep.then(()=>{throw Error('Scheduler finished before four reminders reached the mail edge')}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Four reminder requests did not reach the mail edge')),15000)})])
  clearTimeout(timer)
  // These invocations overlap the outstanding sweep and each other, before lease expiry.
  await Promise.all([h.cron(at+1000),h.cron(at+2000)])
  assert.equal(edge.active,4,'Four controlled responses are still outstanding')
  assert.equal(edge.maximum,4,'Overlapping schedulers share the installation-wide bound')
  assert.equal(edge.requests.length,4,'The fifth reminder has not reached the provider')
  const held=selected(await h.api('/api/mallet/jobs'));checkSources(held)
  assert.equal(held.filter(j=>j.status==='dispatching').length,4)
  assert.equal(held.filter(j=>j.status==='pending').length,1,'The fifth due event stays pending while four dispatch')
  for(const job of held){
   assert.equal(job.attempts,job.status==='pending'?0:1)
   assert.equal(job.outcome,null)
   if(job.status==='dispatching')assert.ok(job.lease_until>at+2000,'No lease has expired during the contention probe')
  }
  await inspect({phase:'backlog',jobs:held,sources})
  edge.release();await sweep
  await h.cron(at+3000)
  const done=selected(await h.api('/api/mallet/jobs'));checkSources(done)
  assert.equal(edge.active,0);assert.equal(edge.maximum,4);assert.equal(edge.requests.length,5)
  const state=(await h.state()).records
  for(const source of sources){
   const requests=edge.requests.filter(r=>r.message.subject===`Reminder: your repair estimate is waiting: ${source.title}`)
   assert.equal(requests.length,1,'One controlled mail request per distinct event')
   const {message,receipt}=requests[0],job=done.find(j=>j.payload.linkId===source.link.id)
   assert.deepEqual(message.to,[source.asset.customerEmail])
   const path=new URL(message.text.match(/https?:\/\/\S+\/approve\/[A-Za-z0-9_-]{43}/)[0]).pathname
   const response=await h.request(path,{as:''});assert.equal(response.status,200)
   const html=await response.text();assert.ok(html.includes(source.title));assert.ok(html.includes('Estimate revision 1'))
   assert.equal(job.status,'succeeded');assert.equal(job.attempts,1)
   assert.deepEqual(job.outcome,{status:'accepted',provider:'resend',providerMessageId:receipt})
   assert.equal(job.lease_until,null);assert.equal(job.lease_token,undefined)
   const chase=state.approvalChase.find(c=>c.id===source.chase.id)
   assert.deepEqual([chase.linkId,chase.jobId,chase.estimateId,chase.revision],[source.link.id,source.job.id,source.quote.id,1])
   assert.deepEqual(chase.steps.map(s=>[s.n,s.status,s.providerMessageId]),[[1,'accepted',receipt]])
  }
  await inspect({phase:'outcomes',jobs:done,sources})
  await h.restart();await h.cron(at+4000)
  assert.deepEqual(selected(await h.api('/api/mallet/jobs')),done,'Durable outcomes and source identities survive restart and scheduler replay')
  assert.equal(edge.requests.length,5,'Restart and replay do not create a sixth provider handoff')
  return {events:5,maximum:edge.maximum,pendingWhileHeld:1,handoffs:edge.requests.length}
 }finally{clearTimeout(timer);edge.release();await sweep}
}

/** Real public reminder/jobs doors; only the mail provider is faked by installation(). */
export async function jobsJourney(){
 let reject=false
 const edge=reminderMailEdge(async()=>reject?Response.json({message:'Rejected fixture recipient'},{status:422}):Response.json({id:crypto.randomUUID()}))
 const h=await installation({clock:jobsClock,mailService:edge.send})
 try{
  await shopSetup(h)
  const tech=await h.person('jobs-tech@example.test'),admin=await h.person('jobs-advisor@example.test','admin')
  const prepare=async(suffix)=>{
   const asset=await h.command('asset.create',assetInput('jobs-'+suffix))
   const {job}=await booking(h,{asset,technicianId:tech.id,startAt:`2026-11-${suffix}T09:00:00Z`,endAt:`2026-11-${suffix}T10:00:00Z`})
   let q=await estimate(h,job);q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
   const link=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:1})
   return {link,due:Date.parse(link.createdAt)+2*86400000+60000}
  }
  await h.api('/api/mallet/jobs',undefined,{as:tech.cookie,status:403})
  await h.api('/api/mallet/jobs',undefined,{as:admin.cookie,status:403})
  const first=await prepare('11')
  const pendingArchive=await archive(h)
  const fresh=await installation({bindings:{OWNER_EMAIL:'jobs-recovery@example.test'}})
  try{await restore(fresh,pendingArchive);await fresh.cron(first.due);assert.equal(fresh.messages.filter(m=>m.subject.startsWith('Reminder')).length,0,'An archive cannot recreate excluded customer-link authority');assert.equal((await fresh.api('/api/mallet/jobs')).jobs.find(j=>j.payload.linkId===first.link.id&&j.payload.step===1).outcome.status,'skipped')}finally{await fresh.close()}
  // Recreating the actual isolate with identical options retains the persisted installation.
  await h.restart()
  await h.cron(first.due)
  await h.cron(first.due+60000)
  const diagnostics=await h.api('/api/mallet/jobs'),done=diagnostics.jobs.find(j=>j.payload.linkId===first.link.id&&j.payload.step===1)
  assert.ok(done,'Due reminder is retained as a durable business job')
  assert.equal(done.status,'succeeded')
  assert.equal(h.messages.filter(m=>m.subject.startsWith('Reminder')).length,1)
  assert.equal(done.lease_token,undefined)
  const second=await prepare('12');reject=true
  await h.cron(second.due)
  const failed=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.payload.linkId===second.link.id&&j.payload.step===1)
  assert.equal(failed.status,'failed')
  reject=false
  await h.cron(second.due+60000)
  assert.equal(h.messages.filter(m=>m.subject.startsWith('Reminder')).length,2,'Failed reminder never retries automatically')
  await h.api('/api/mallet/jobs/recover',{id:failed.id,action:'replay',reason:'Try again'},{status:409})
  await h.api('/api/mallet/jobs/recover',{id:failed.id,action:'resolve',reason:'Advisor inspected provider failure; will contact customer separately'})
  const final=await h.api('/api/mallet/jobs')
  assert.equal(final.jobs.find(j=>j.id===failed.id).status,'resolved')
  assert.equal(final.recoveries.filter(r=>r.job_id===failed.id).length,1)
  await reminderConcurrency(h,edge)
  await reminderLeaseRecovery(h,edge)
 }finally{await h.close()}
}
