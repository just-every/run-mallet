import assert from 'node:assert/strict'
import {archive,booking,estimate,installation,restore,assetInput} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {decide} from './approval-journey.mjs'
const DAY=86_400_000,at=(iso,days,minutes=1)=>Date.parse(iso)+days*DAY+minutes*60_000
// EST-006: a scheduled reminder chases only the current undecided revision; replies, decisions and opt-outs stop it;
// failed sends and unanswered estimates open advisor tasks. Mail is faked only at the provider edge.
export async function chaseJourney(){
 let status=202,calls=0,interrupt=false,observed
 const h=await installation({outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.sendgrid.com');calls++;if(interrupt){observed=await request.json();throw new Error('synthetic-mallet-interrupted-approval-handoff')}return new Response(null,{status})}})
 try{
  await shopSetup(h)
  const advisor=await h.person('casey-chase@example.test','admin'),tech=await h.person('morgan-chase@example.test'),ADV={as:advisor.cookie},T={as:tech.cookie}
  const st=async()=>(await h.state()).records,chaseOf=async linkId=>(await st()).approvalChase.find(c=>c.linkId===linkId)
  const reminders=to=>h.messages.filter(m=>m.subject.startsWith('Reminder')&&JSON.stringify(m.to).includes(to))
  const quote=async(job)=>{const q=await estimate(h,job);return h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})}
  // Configure expiry and reminder steps (owner/advisor only, validated before expiry).
  await h.command('chasePolicy.save',{linkDays:10,reminderDays:[2,5]},{...T,status:403})
  await h.command('chasePolicy.save',{linkDays:5,reminderDays:[2,5]},{...ADV,status:400})
  await h.command('chasePolicy.save',{linkDays:10,reminderDays:[2,5]},{...ADV,status:400});const policy=await h.command('chasePolicy.save',{linkDays:7,reminderDays:[2,5]},ADV);assert.deepEqual([policy.linkDays,policy.reminderDays],[7,[2,5]])
  const {asset,job}=await booking(h,{technicianId:tech.id});let q=await quote(job)
  const sent=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:1},ADV),email=asset.customerEmail
  assert.equal(Date.parse(sent.expiresAt)-Date.parse(sent.createdAt),7*DAY,'EST-006 the configured expiry applies to a new link')
  let chase=await chaseOf(sent.id);assert.deepEqual(chase.steps.map(s=>[s.dueAt,s.status]),[[new Date(at(sent.createdAt,2,0)).toISOString(),'pending'],[new Date(at(sent.createdAt,5,0)).toISOString(),'pending']],'EST-006 the link snapshots its reminder schedule')
  assert.match(h.messages.findLast(m=>m.text?.includes(sent.url)).text,/Stop reminders/,'EST-006 every approval email offers a way to stop reminders')
  await h.cron(at(sent.createdAt,1));assert.equal(reminders(email).length,0,'EST-006 nothing is sent before a step is due')
  // Advance the schedule: the due reminder goes once, through a fresh token for the same link.
  await h.cron(at(sent.createdAt,2));await h.cron(at(sent.createdAt,2,30))
  let mail=reminders(email);assert.equal(mail.length,1,'EST-006 one reminder per due step, never repeated')
  const reminderUrl=mail[0].text.match(/https?:\/\/\S+\/approve\/[A-Za-z0-9_-]{43}/)[0],reminderPath=new URL(reminderUrl).pathname
  assert.notEqual(reminderUrl,sent.url);assert.equal((await h.request(reminderPath,{as:''})).status,200,'EST-006 the reminder opens the same current revision')
  chase=await chaseOf(sent.id);assert.equal(chase.steps[0].status,'accepted');assert.equal(chase.steps[1].status,'pending')
  assert.match(await (await h.request('/app/jobs/'+job.id)).text(),/Reminder 1 \(day 2\)[\s\S]*handed to the mail provider; delivery not confirmed/)
  // Supersede: revision 2 replaces the chased revision; the old link and its reminders stop.
  q=(await st()).estimate.find(x=>x.id===q.id)
  q=await h.command('estimate.revise',{estimateId:q.id,version:q.version,revision:1,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:2900},{kind:'labor',description:'Replace and tune',quantity:1.5,unitCents:12000}]})
  q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:2})
  await h.cron(at(sent.createdAt,5));assert.equal(reminders(email).length,1,'EST-006 a superseded revision is never chased');chase=await chaseOf(sent.id)
  assert.equal(chase.stopReason,'superseded');assert.equal(chase.steps[1].status,'skipped');assert.equal((await h.request(reminderPath,{as:''})).status,404)
  const replacement=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:2},ADV)
  await h.cron(at(replacement.createdAt,2));mail=reminders(email);assert.equal(mail.length,2,'EST-006 the current undecided replacement is chased')
  const replacementPath=new URL(mail[1].text.match(/https?:\/\/\S+\/approve\/[A-Za-z0-9_-]{43}/)[0]).pathname,lines=q.revisions[1].lines
  assert.match(await (await h.request(replacementPath,{as:''})).text(),/Estimate revision 2/)
  // Approve the replacement through the reminder; the decision stops the chase at once.
  assert.equal((await decide(h,replacementPath,{['line-'+lines[0].id]:'approve',['line-'+lines[1].id]:'approve',typedName:'Dana Brooks',consent:'yes'})).status,200)
  assert.equal((await st()).estimate.find(x=>x.id===q.id).authorisation.revision,2);assert.equal((await chaseOf(replacement.id)).stopReason,'decision')
  await h.cron(at(replacement.createdAt,5));assert.equal(reminders(email).length,2,'EST-006 a decided estimate is not chased')
  // A reply recorded by staff stops reminders (Mallet does not read mailboxes).
  const second=(await booking(h,{asset:(await st()).asset.find(a=>a.id===asset.id),technicianId:tech.id,startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T10:00:00Z'})).job
  let q2=await quote(second);const asked=await h.command('approvalLink.create',{estimateId:q2.id,version:q2.version,revision:1},ADV);chase=await chaseOf(asked.id)
  await h.command('approvalChase.recordReply',{chaseId:chase.id,version:chase.version,note:'Called back: will decide after payday'},{...T,status:403})
  chase=await h.command('approvalChase.recordReply',{chaseId:chase.id,version:chase.version,note:'Called back: will decide after payday'},ADV);assert.equal(chase.stopReason,'reply')
  await h.cron(at(asked.createdAt,2));assert.equal(reminders(email).length,2,'EST-006 a recorded reply stops reminders')
  assert.match(await (await h.request('/app/jobs/'+second.id)).text(),/staff recorded a customer reply[\s\S]*Mallet does not read email replies/)
  // Failed delivery opens an advisor task: a rejected first send stops the chase; a rejected reminder is not retried.
  await h.configure({MAIL_PROVIDER:'sendgrid'});status=422
  const third=(await booking(h,{asset:await h.command('asset.create',{...assetInput('3'),customerEmail:'riley@example.test'}),technicianId:tech.id,startAt:'2026-11-04T09:00:00Z',endAt:'2026-11-04T10:00:00Z'})).job
  let q3=await quote(third);const bounced=await h.command('approvalLink.create',{estimateId:q3.id,version:q3.version,revision:1},ADV)
  assert.equal(bounced.delivery.status,'rejected');assert.equal((await chaseOf(bounced.id)).stopReason,'delivery-failed')
  let tasks=(await st()).chaseTask;assert.deepEqual(tasks.map(t=>[t.linkId,t.kind]),[[bounced.id,'delivery-failed']],'EST-007 a failed send opens an advisor task')
  status=202;await h.command('approvalLink.revoke',{linkId:bounced.id,version:(await st()).approvalLink.find(l=>l.id===bounced.id).version},ADV)
  q3=(await st()).estimate.find(x=>x.id===q3.id);const resent=await h.command('approvalLink.create',{estimateId:q3.id,version:q3.version,revision:1},ADV);assert.equal(resent.delivery.status,'accepted')
  status=422;const before=calls;await h.cron(at(resent.createdAt,2));await h.cron(at(resent.createdAt,2,20))
  assert.equal(calls,before+1,'EST-006 a failed reminder is never retried automatically');chase=await chaseOf(resent.id);assert.equal(chase.steps[0].status,'rejected')
  tasks=(await st()).chaseTask.filter(t=>t.linkId===resent.id);assert.equal(tasks.length,1);assert.match(tasks[0].detail,/Reminder 1 was rejected/)
  // An estimate that expires unanswered opens an advisor task; the advisor resolves it with a note.
  status=202;await h.configure({MAIL_PROVIDER:'resend'})
  const fourth=(await booking(h,{asset:await h.command('asset.create',{...assetInput('4'),customerEmail:'jules@example.test'}),technicianId:tech.id,startAt:'2026-11-05T09:00:00Z',endAt:'2026-11-05T10:00:00Z'})).job
  let q4=await quote(fourth);const quiet=await h.command('approvalLink.create',{estimateId:q4.id,version:q4.version,revision:1,days:1},ADV)
  assert.deepEqual((await chaseOf(quiet.id)).steps,[],'EST-006 steps after expiry are never scheduled');await h.cron(at(quiet.createdAt,1))
  const unanswered=(await st()).chaseTask.find(t=>t.linkId===quiet.id);assert.equal(unanswered.kind,'unanswered');assert.equal((await chaseOf(quiet.id)).stopReason,'expired')
  const queue=await (await h.request('/app/approvals')).text();assert.match(queue,/Approval chasing[\s\S]*Advisor tasks[\s\S]*Approval email failed[\s\S]*Estimate unanswered/)
  await h.command('chaseTask.resolve',{taskId:unanswered.id,version:unanswered.version,note:'Phoned; customer will collect the bike'},{...T,status:403})
  const done=await h.command('chaseTask.resolve',{taskId:unanswered.id,version:unanswered.version,note:'Phoned; customer will collect the bike'},ADV);assert.equal(done.resolvedBy.role,'admin');assert.equal(done.note,'Phoned; customer will collect the bike')
  // Opt-out from the customer's own link stops every automatic reminder to that address; staff may lift it with a reason.
  const fifth=(await booking(h,{asset:(await st()).asset.find(a=>a.customerEmail==='jules@example.test'),technicianId:tech.id,startAt:'2026-11-06T09:00:00Z',endAt:'2026-11-06T10:00:00Z'})).job
  let q5=await quote(fifth);const chased=await h.command('approvalLink.create',{estimateId:q5.id,version:q5.version,revision:1},ADV),chasedPath=new URL(chased.url).pathname
  assert.match(await (await h.request(chasedPath,{as:''})).text(),/Stop reminders/)
  assert.equal((await decide(h,chasedPath,{action:'stop-reminders'},'https://evil.example')).status,403)
  const optOut=await decide(h,chasedPath,{action:'stop-reminders'});assert.equal(optOut.status,200);assert.match(await optOut.text(),/will not send you automatic estimate reminders/)
  assert.equal((await chaseOf(chased.id)).stopReason,'opt-out');assert.equal((await h.request(chasedPath,{as:''})).status,200,'EST-006 an opt-out never closes the open link')
  await h.cron(at(chased.createdAt,2));assert.equal(reminders('jules@example.test').length,0,'EST-006 an opted-out customer gets no reminders')
  const optRow=(await st()).chaseOptOut.find(o=>o.email==='jules@example.test');assert.equal(optRow.source,'customer link')
  await h.command('chaseOptOut.record',{email:'Riley@Example.test',note:'Asked in person for no reminder emails'},ADV);assert.equal((await chaseOf(resent.id)).stopReason,'opt-out','EST-006 a staff-recorded opt-out stops that customer’s chases')
  // Internal scheduler/customer commands are not reachable from the command door; agents see no chase records.
  for(const command of ['approvalChase.sweep','approvalChase.outcome','chaseOptOut.customer'])await h.command(command,{},{status:404})
  const key=await h.command('agent.create',{label:'Chase boundary'}),agentView=(await h.state({as:'',headers:{authorization:`Bearer ${key.token}`}})).records
  for(const kind of ['approvalChase','chaseTask','chaseOptOut'])assert.equal(agentView[kind],undefined)
  // Withdrawal stops sending, while the unanswered repair still needs an advisor after expiry.
  const beforeOptOutExpiry=h.messages.length
  await h.cron(Date.parse(chased.expiresAt)+60_000)
  const optedTask=(await st()).chaseTask.find(t=>t.linkId===chased.id)
  assert.ok(optedTask,'An opted-out current revision that expires undecided reaches an advisor')
  assert.deepEqual([optedTask.jobId,optedTask.linkId,optedTask.estimateId,optedTask.revision,optedTask.kind,optedTask.resolvedAt],[fifth.id,chased.id,q5.id,1,'unanswered',null])
  await h.cron(Date.parse(chased.expiresAt)+2*DAY)
  assert.deepEqual((await st()).chaseTask.filter(t=>t.linkId===chased.id),[optedTask],'Later scheduler runs neither duplicate nor close the unanswered task')
  assert.equal(h.messages.length,beforeOptOutExpiry,'Expiry after opt-out never authorizes another handoff')
  for(const path of ['/app/jobs/'+fifth.id,'/app/approvals'])assert.match(await (await h.request(path,ADV)).text(),/Estimate unanswered[\s\S]*expired undecided/)
  const beforeRefusal=await st(),optedResolution={taskId:optedTask.id,version:optedTask.version,note:'Customer asked for no reminders; advisor recorded an in-person follow-up'}
  await h.command('chaseTask.resolve',optedResolution,{...T,status:403})
  await h.command('chaseTask.resolve',{...optedResolution,note:''},{...ADV,status:400})
  assert.deepEqual(await st(),beforeRefusal,'A technician or a missing resolution note cannot close the opted-out task')
  const optedResolved=await h.command('chaseTask.resolve',optedResolution,ADV)
  assert.deepEqual([optedResolved.resolvedBy.id,optedResolved.resolvedBy.role,optedResolved.note],[advisor.id,'admin',optedResolution.note])
  assert.ok(optedResolved.resolvedAt)
  await h.command('chaseTask.resolve',{...optedResolution,note:'A replay must not replace the original resolution'},{...ADV,status:409})
  await h.cron(Date.parse(chased.expiresAt)+3*DAY)
  assert.deepEqual((await st()).chaseTask.filter(t=>t.linkId===chased.id),[optedResolved],'The first authorized resolution remains exact after replay')
  assert.equal(h.messages.length,beforeOptOutExpiry)
  assert.deepEqual((await st()).chaseOptOut.find(o=>o.id===optRow.id),optRow,'Expiry and task resolution preserve the customer withdrawal')
  await h.command('chaseOptOut.lift',{optOutId:optRow.id,version:optRow.version,reason:'Customer asked by phone to resume reminders'},ADV)
  // An interrupted first handoff is distinct from a provider rejection, and never becomes a resend.
  const interruptedJob=(await booking(h,{asset:await h.command('asset.create',{...assetInput('synthetic-mallet-uncertain'),customerEmail:['synthetic-mallet-uncertain','example.test'].join('@')}),technicianId:tech.id,startAt:'2026-11-07T09:00:00Z',endAt:'2026-11-07T10:00:00Z'})).job
  const interruptedQuote=await quote(interruptedJob)
  await h.configure({MAIL_PROVIDER:'sendgrid'});interrupt=true;const beforeInterrupted=calls
  const uncertain=await h.command('approvalLink.create',{estimateId:interruptedQuote.id,version:interruptedQuote.version,revision:1},ADV)
  interrupt=false
  assert.equal(calls,beforeInterrupted+1,'The native approval command reaches the controlled mail edge once before interruption')
  assert.match(JSON.stringify(observed),/\/approve\//,'The interrupted provider request contains the native approval link')
  let uncertainRecords=await st(),savedLink=uncertainRecords.approvalLink.find(l=>l.id===uncertain.id)
  assert.equal(savedLink.delivery.status,'uncertain','An interrupted first email retains uncertainty separately from rejection')
  const uncertainTasks=uncertainRecords.chaseTask.filter(t=>t.linkId===uncertain.id)
  assert.equal(uncertainTasks.length,1)
  const uncertainTask=uncertainTasks[0]
  assert.deepEqual([uncertainTask.jobId,uncertainTask.linkId,uncertainTask.estimateId,uncertainTask.revision,uncertainTask.kind],[interruptedJob.id,uncertain.id,interruptedQuote.id,1,'delivery-failed'])
  assert.match(uncertainTask.detail,/uncertain/)
  assert.equal((await chaseOf(uncertain.id)).stopReason,'delivery-failed')
  const snapshot=records=>Object.fromEntries(['chaseTask','approvalChase','approvalLink','estimate','job'].map(kind=>[kind,records[kind]]))
  await h.restart()
  assert.deepEqual(snapshot(await st()),snapshot(uncertainRecords),'Restart retains the original delivery, task and repair before scheduler replay')
  await h.cron(at(uncertain.createdAt,2));await h.cron(at(uncertain.createdAt,5))
  assert.equal(calls,beforeInterrupted+1,'Scheduler replay cannot retry the interrupted handoff')
  assert.deepEqual((await st()).chaseTask.filter(t=>t.linkId===uncertain.id),[uncertainTask],'Scheduler replay retains exactly the original uncertain task')
  assert.deepEqual((await st()).approvalLink.find(l=>l.id===uncertain.id).delivery,savedLink.delivery)
  for(const path of ['/app/jobs/'+interruptedJob.id,'/app/approvals']){
   const page=await (await h.request(path,ADV)).text()
   assert.ok(page.includes(interruptedJob.id));assert.match(page,/Approval email failed[\s\S]*uncertain/)
  }
  const resolution={taskId:uncertainTask.id,version:uncertainTask.version,note:'Advisor reviewed the interrupted handoff; called customer; no resend'}
  const boundary=snapshot(await st())
  await h.command('chaseTask.resolve',resolution,{...T,status:403})
  assert.deepEqual(snapshot(await st()),boundary,'Denied technician resolution changes no task, delivery or repair')
  await h.command('chaseTask.resolve',resolution,{as:'',headers:{authorization:'Bearer '+key.token},status:403})
  assert.deepEqual(snapshot(await st()),boundary,'Denied agent resolution changes no task, delivery or repair')
  const resolved=await h.command('chaseTask.resolve',resolution,ADV)
  assert.equal(resolved.resolvedBy.id,advisor.id);assert.equal(resolved.resolvedBy.role,'admin');assert.equal(resolved.note,resolution.note)
  await h.cron(at(uncertain.createdAt,5,30))
  uncertainRecords=await st()
  assert.deepEqual(uncertainRecords.chaseTask.filter(t=>t.linkId===uncertain.id),[resolved])
  assert.deepEqual(uncertainRecords.approvalLink.find(l=>l.id===uncertain.id).delivery,savedLink.delivery,'Human resolution preserves the original uncertainty')
  assert.equal(calls,beforeInterrupted+1,'Resolution grants no additional handoff')
  // OPS-001: policy, chases, tasks and opt-outs restore exactly; reminder tokens do not.
  const state=await st(),backup=await archive(h),target=await installation()
  try{
   const freshOwner=(await target.state()).actor
   assert.notEqual(freshOwner.id,(await h.state()).actor.id)
   await restore(target,backup);const restored=(await target.state()).records
   for(const kind of ['chasePolicy','approvalChase','chaseTask','chaseOptOut'])assert.deepEqual(restored[kind],state[kind],'EST-006 / EST-007 restores '+kind)
   assert.equal((await target.request(replacementPath,{as:''})).status,404)
   assert.equal((await target.request(new URL(uncertain.url).pathname,{as:''})).status,404,'Recovery restores no approval-link authority for an uncertain send')
   await target.cron(at(uncertain.createdAt,5,45))
   assert.deepEqual((await target.state()).records.chaseTask,restored.chaseTask,'Recovered resolution history cannot create a fresh task')
   assert.equal(target.messages.length,0,'Recovery cannot reissue the interrupted email')
   assert.equal((await target.state()).actor.id,freshOwner.id)
  }finally{await target.close()}
 }finally{await h.close()}
}
