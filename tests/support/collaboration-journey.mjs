import assert from 'node:assert/strict'
import {archive,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'
export const collaborationClock='2026-10-30T12:00:00.000Z'
// Use the public timer and approved-correction doors, never storage writes or sleeps.
export async function correctHandoffInterval(h,entry,person,startAt,endAt){
 const proposal=await h.command('time.correct',{entryId:entry.id,entryVersion:entry.version,startAt,endAt,reason:'Paper shift record for diagnostic handoff'},{as:person.cookie})
 await h.command('time.approveCorrection',{correctionId:proposal.id,correctionVersion:proposal.version})
 return (await h.state()).records.timeEntry.find(e=>e.id===entry.id)
}
export async function recordHandoffTime(h,jobId,lead,specialist,whileRunning=async()=>{}){
 const current=async()=>(await h.state()).records.job.find(j=>j.id===jobId)
 for(const [person,intervals] of [
  [lead,[['billable','08:00','08:18'],['rework','08:20','08:27'],['nonbillable','08:30','08:35'],['billable','08:40','08:47']]],
  [specialist,[['billable','09:00','09:12'],['rework','09:15','09:39'],['nonbillable','09:40','09:49']]]
 ]){
  const as={as:person.cookie},attendance=await h.command('time.clockIn',{},as),stopped=[]
  for(const [category,start,end] of intervals){
   await h.command('time.start',{jobId,version:(await current()).version,category},as)
   if(person===lead&&start==='08:40')await whileRunning()
   const entry=await h.command('time.pause',{jobId},as)
   stopped.push({entry,start,end})
  }
  const clock=await h.command('time.clockOut',{},as)
  await correctHandoffInterval(h,clock,person,'2026-10-28T07:00:00Z',clock.revisions.at(-1).endAt)
  for(const {entry,start,end} of stopped)await correctHandoffInterval(h,entry,person,'2026-10-28T'+start+':00Z','2026-10-28T'+end+':00Z')
 }
}
// FLOW-004 / FLOW-005: a helper joins, dependent subtasks gate each other, a staff note mentions the advisor with media,
// and the lead hands the diagnostic job to a specialist who must acknowledge; each person's time is kept.
export async function collaborationJourney(h){
 await shopSetup(h)
 const advisor=await h.person('casey-crew@example.test','admin'),lead=await h.person('morgan-crew@example.test'),specialist=await h.person('rio-crew@example.test'),outsider=await h.person('sam-crew@example.test')
 const ADV={as:advisor.cookie},L={as:lead.cookie},S={as:specialist.cookie},O={as:outsider.cookie}
 const {job}=await booking(h,{technicianId:lead.id});await authorise(h,await estimate(h,job))
 const st=async(o)=>(await h.state(o)).records,current=async()=>(await st()).job.find(j=>j.id===job.id)
 // Crew: only the owner/advisor adds helpers, and only active technicians.
 await h.command('crew.add',{jobId:job.id,version:(await current()).version,technicianId:specialist.id},{...L,status:403})
 await h.command('crew.add',{jobId:job.id,version:(await current()).version,technicianId:advisor.id,verifiedTechnician:true},{...ADV,status:400})
 await h.command('crew.add',{jobId:job.id,version:(await current()).version,technicianId:specialist.id},ADV)
 assert.ok((await st(S)).job.some(j=>j.id===job.id),'FLOW-004 a helper reads the repair');assert.equal((await st(O)).job.length,0,'FLOW-004 other technicians do not')
 // Per-person time: the lead and the helper each run their own timer; an outsider cannot.
 await recordHandoffTime(h,job.id,lead,specialist,async()=>{
  await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:specialist.id,note:'Codes scanned, coil replaced'},{...L,status:409})
 })
 await h.command('time.clockIn',{},O)
 await h.command('time.start',{jobId:job.id,version:(await current()).version,category:'billable'},{...O,status:403})
 // Dependent subtasks: the dependent one is refused until its dependency is complete.
 await h.command('subtask.create',{jobId:job.id,title:'Scan codes',assigneeId:lead.id},{...S,status:403})
 await h.command('subtask.create',{jobId:job.id,title:'Ride along',assigneeId:outsider.id},{...L,status:400})
 const scan=await h.command('subtask.create',{jobId:job.id,title:'Scan codes',assigneeId:lead.id},L)
 let coil=await h.command('subtask.create',{jobId:job.id,title:'Replace ignition coil',assigneeId:specialist.id,dependsOn:[scan.id]},L)
 await h.command('subtask.complete',{subtaskId:coil.id,version:coil.version},{...S,status:409});await h.command('subtask.complete',{subtaskId:scan.id,version:scan.version},{...S,status:403})
 await h.command('subtask.complete',{subtaskId:scan.id,version:scan.version},L);coil=await h.command('subtask.complete',{subtaskId:coil.id,version:coil.version},S)
 assert.equal(coil.completedBy.id,specialist.id,'FLOW-004 the dependent subtask completes after its dependency')
 const road=await h.command('subtask.create',{jobId:job.id,title:'Road test',assigneeId:specialist.id},L)
 const harness=await h.command('subtask.create',{jobId:job.id,title:'Assess wiring harness',assigneeId:lead.id},L)
 // A staff-private note mentions the advisor and references this repair's photo.
 const photo=await inspectionPhoto(h,job.id,lead.cookie,'Misfire coil')
 await h.command('note.add',{jobId:job.id,body:'Coil 3 arcing',mentionIds:[outsider.id]},{...L,status:400})
 const note=await h.command('note.add',{jobId:job.id,body:'Coil 3 arcing; customer approval needed for the harness',mentionIds:[advisor.id],attachmentIds:[photo.id],mentions:[{id:outsider.id,name:'Forged',role:'owner'}]},L)
 assert.deepEqual(note.mentions.map(m=>[m.id,m.name,m.acknowledgedAt]),[[advisor.id,'casey-crew',null]],'FLOW-004 mentions resolve on the server, never from the client');assert.deepEqual(note.attachments.map(a=>a.id),[photo.id])
 await h.command('note.add',{jobId:job.id,body:'Not mine'},{...O,status:403});await h.command('note.add',{jobId:job.id,body:'Not mine',attachmentIds:[photo.id]},{...O,status:404})
 await h.command('mention.acknowledge',{noteId:note.id,version:note.version},{...L,status:403})
 const seen=await h.command('mention.acknowledge',{noteId:note.id,version:note.version},ADV);assert.ok(seen.mentions[0].acknowledgedAt)
 assert.equal((await st(O)).jobNote.length,0,'FLOW-004 notes stay with the crew and managers')
 const key=await h.command('agent.create',{label:'Crew boundary'}),agentView=(await h.state({as:'',headers:{authorization:`Bearer ${key.token}`}})).records
 for(const kind of ['jobNote','subtask','handoff'])assert.equal(agentView[kind],undefined,'FLOW-004 / FLOW-005 agents never receive '+kind)
 // Handoff: refused while the lead's timer runs; it takes effect only when the specialist acknowledges.
 await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:advisor.id,note:'x'},{...L,status:400})
 let handoff=await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:specialist.id,note:'Codes scanned, coil replaced; road test and harness quote left'},L)
 await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:specialist.id,note:'again'},{...L,status:409})
 const proposed=structuredClone(handoff),beforeAcknowledgment=await st()
 assert.equal((await current()).technicianId,lead.id,'FLOW-005 a proposal alone changes nothing')
 await h.command('handoff.acknowledge',{handoffId:handoff.id,version:handoff.version},{...O,status:403});await h.command('handoff.acknowledge',{handoffId:handoff.id,version:handoff.version},{...L,status:403})
 for(const kind of ['job','subtask','timeEntry','timeCorrection','handoff'])assert.deepEqual((await st())[kind],beforeAcknowledgment[kind],'FLOW-005 refused acknowledgment changes no '+kind)
 handoff=await h.command('handoff.acknowledge',{handoffId:handoff.id,version:handoff.version},S)
 const now=await current();assert.equal(now.technicianId,specialist.id);assert.deepEqual(now.helpers,[],'FLOW-005 the previous lead leaves unless kept as a helper')
 const r=handoff.receipt;assert.equal(r.jobId,job.id);assert.equal(r.from.id,lead.id);assert.equal(r.to.id,specialist.id);assert.match(r.note,/road test/)
 assert.equal(r.note,'Codes scanned, coil replaced; road test and harness quote left')
 assert.equal(r.proposedBy.id,lead.id);assert.equal(r.proposedAt,proposed.proposedAt);assert.equal(r.acknowledgedAt,collaborationClock);assert.equal(r.previousLeadKept,false)
 assert.deepEqual([...r.openSubtasks].sort((a,b)=>a.title.localeCompare(b.title)),[{id:harness.id,title:'Assess wiring harness',assigneeId:lead.id},{id:road.id,title:'Road test',assigneeId:specialist.id}])
 assert.deepEqual(Object.keys(r.time).sort(),[lead.id,specialist.id].sort(),'FLOW-005 the receipt keeps both technicians’ time')
 // Literal totals are independent of crewTime and the persisted interval revisions.
 assert.deepEqual(r.time,{
  [lead.id]:{name:'morgan-crew',billable:1500,rework:420,nonbillable:300},
  [specialist.id]:{name:'rio-crew',billable:720,rework:1440,nonbillable:540}
 },'FLOW-005 exact per-person category seconds, including both lead billable intervals')
 const entries=(await st()).timeEntry.filter(e=>e.jobId===job.id);assert.deepEqual([...new Set(entries.map(e=>e.ownerId))].sort(),[lead.id,specialist.id].sort(),'FLOW-005 per-person time survives the handoff')
 // The previous lead is now an unassigned technician on a restricted job.
 await h.command('time.clockIn',{},L)
 assert.equal((await st(L)).job.some(j=>j.id===job.id),false);await h.command('time.start',{jobId:job.id,version:now.version,category:'billable'},{...L,status:403});await h.command('note.add',{jobId:job.id,body:'late'},{...L,status:403})
 assert.equal((await st(L)).timeEntry.filter(e=>e.jobId===job.id).length,4,'FLOW-005 the previous lead keeps all four own time records')
 const beforeRemovedCompletion=await st()
 const refused=await h.command('subtask.complete',{subtaskId:harness.id,version:harness.version},{...L,status:403})
 assert.equal(refused.error,'FORBIDDEN','FLOW-005 the removed former lead receives a typed refusal even for their outstanding assignment')
 const afterRemovedCompletion=await st()
 for(const kind of ['subtask','event'])assert.equal(JSON.stringify(afterRemovedCompletion[kind]),JSON.stringify(beforeRemovedCompletion[kind]),'FLOW-005 refused former-lead completion keeps '+kind+' records byte-identical')
 // Later approved time and subtask changes cannot rewrite the acknowledged receipt.
 const frozen=structuredClone(r),rework=(await st()).timeEntry.find(e=>e.jobId===job.id&&e.ownerId===specialist.id&&e.category==='rework')
 await correctHandoffInterval(h,rework,specialist,'2026-10-28T09:15:00Z','2026-10-28T09:38:00Z')
 await h.command('subtask.complete',{subtaskId:road.id,version:road.version},S)
 assert.equal((await st()).timeEntry.find(e=>e.id===rework.id).revisions.at(-1).endAt,'2026-10-28T09:38:00.000Z')
 assert.deepEqual((await st()).handoff.find(x=>x.id===handoff.id).receipt,frozen,'FLOW-005 receipt stays immutable after time and subtask changes')
 await h.command('handoff.acknowledge',{handoffId:handoff.id,version:handoff.version},{...S,status:409})
 assert.deepEqual((await st()).handoff.find(x=>x.id===handoff.id).receipt,frozen,'FLOW-005 replay cannot rewrite a receipt')
 // A declined handoff retains the exact reason and changes no assignment, subtask or time.
 let back=await h.command('handoff.propose',{jobId:job.id,version:now.version,toId:outsider.id,note:'Need a second opinion'},S)
 const beforeDecline=await st(),reason='Booked on another repair'
 await h.command('handoff.decline',{handoffId:back.id,version:back.version,reason:''},{...O,status:400})
 back=await h.command('handoff.decline',{handoffId:back.id,version:back.version,reason},O);assert.equal(back.status,'declined');assert.equal((await current()).technicianId,specialist.id)
 const declined=await st()
 assert.equal(declined.handoff.find(x=>x.id===back.id).reason,reason,'FLOW-005 decline reason survives public state reload')
 for(const kind of ['job','subtask','timeEntry','timeCorrection'])assert.deepEqual(declined[kind],beforeDecline[kind],'FLOW-005 decline preserves '+kind)
 const page=await (await h.request('/app/jobs/'+job.id)).text();assert.match(page,/Handover receipt[\s\S]*Codes scanned[\s\S]*Road test/);assert.match(page,/morgan-crew[\s\S]*billable[\s\S]*rio-crew[\s\S]*rework|rio-crew[\s\S]*rework[\s\S]*morgan-crew[\s\S]*billable/)
 assert.ok(page.includes('Booked on another repair'),'FLOW-005 rendered history retains the exact decline reason')
 // The owner can propose the existing keep-helper option without moving the lead early.
 const support=await h.command('subtask.create',{jobId:job.id,title:'Specialist wiring support',assigneeId:specialist.id},S)
 let kept=await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:lead.id,note:'Continue the road test with specialist support',keepHelper:true})
 assert.equal((await current()).technicianId,specialist.id)
 kept=await h.command('handoff.acknowledge',{handoffId:kept.id,version:kept.version},L)
 assert.equal((await current()).technicianId,lead.id);assert.deepEqual((await current()).helpers,[specialist.id])
 assert.equal(kept.receipt.previousLeadKept,true);assert.equal(kept.receipt.proposedBy.id,(await h.state()).actor.id)
 assert.ok((await st(S)).job.some(j=>j.id===job.id),'FLOW-005 an explicitly retained former lead remains a helper')
 const completedSupport=await h.command('subtask.complete',{subtaskId:support.id,version:support.version},S)
 assert.equal(completedSupport.completedBy.id,specialist.id,'FLOW-005 a retained helper still completes their assigned subtask')
 assert.equal((await st()).subtask.find(t=>t.id===support.id).completedAt,collaborationClock,'FLOW-005 retained-helper completion is saved')
 assert.ok((await st()).event.some(e=>e.kind==='subtask.complete'&&e.subjectId===support.id),'FLOW-005 retained-helper completion records its event')
 assert.deepEqual((await st()).handoff.find(x=>x.id===handoff.id).receipt,frozen)
 await h.command('agent.revoke',{id:key.id});await h.state({as:'',headers:{authorization:`Bearer ${key.token}`},status:401})
 // OPS-001: crew, subtasks, notes, mentions, handoffs and time restore exactly.
 const state=await st(),backup=await archive(h),target=await installation()
 try{assert.notEqual((await target.state()).actor.id,(await h.state()).actor.id);await restore(target,backup);await target.state({as:lead.cookie,status:401});const restored=(await target.state()).records;for(const kind of ['jobNote','subtask','handoff','job','timeEntry','timeCorrection'])assert.deepEqual(restored[kind],state[kind],'FLOW-004 / FLOW-005 restores '+kind)}finally{await target.close()}
}
