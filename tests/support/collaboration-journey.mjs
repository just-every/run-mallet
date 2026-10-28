import assert from 'node:assert/strict'
import {archive,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'
// FLOW-004: a helper joins, dependent subtasks gate each other, a staff note mentions the advisor with media,
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
 const timer=async(o,category)=>{await h.command('time.clockIn',{},o);await h.command('time.start',{jobId:job.id,version:(await current()).version,category},o);await h.command('time.pause',{jobId:job.id},o)}
 await timer(L,'billable');await timer(S,'rework');await h.command('time.clockIn',{},O)
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
 for(const kind of ['jobNote','subtask','handoff'])assert.equal(agentView[kind],undefined,'FLOW-005 agents never receive '+kind)
 // Handoff: refused while the lead's timer runs; it takes effect only when the specialist acknowledges.
 await h.command('time.start',{jobId:job.id,version:(await current()).version,category:'billable'},L)
 await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:specialist.id,note:'Codes scanned, coil replaced'},{...L,status:409})
 await h.command('time.pause',{jobId:job.id},L)
 await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:advisor.id,note:'x'},{...L,status:400})
 let handoff=await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:specialist.id,note:'Codes scanned, coil replaced; road test and harness quote left'},L)
 await h.command('handoff.propose',{jobId:job.id,version:(await current()).version,toId:specialist.id,note:'again'},{...L,status:409})
 assert.equal((await current()).technicianId,lead.id,'FLOW-004 a proposal alone changes nothing')
 await h.command('handoff.acknowledge',{handoffId:handoff.id,version:handoff.version},{...O,status:403});await h.command('handoff.acknowledge',{handoffId:handoff.id,version:handoff.version},{...L,status:403})
 handoff=await h.command('handoff.acknowledge',{handoffId:handoff.id,version:handoff.version},S)
 const now=await current();assert.equal(now.technicianId,specialist.id);assert.deepEqual(now.helpers,[],'FLOW-004 the previous lead leaves unless kept as a helper')
 const r=handoff.receipt;assert.equal(r.from.id,lead.id);assert.equal(r.to.id,specialist.id);assert.match(r.note,/road test/);assert.deepEqual(r.openSubtasks.map(t=>t.id),[road.id])
 assert.deepEqual(Object.keys(r.time).sort(),[lead.id,specialist.id].sort(),'FLOW-004 the receipt keeps both technicians’ time');assert.ok(r.time[specialist.id].rework>=0&&r.time[lead.id].billable>=0)
 const entries=(await st()).timeEntry.filter(e=>e.jobId===job.id);assert.deepEqual([...new Set(entries.map(e=>e.ownerId))].sort(),[lead.id,specialist.id].sort(),'FLOW-005 per-person time survives the handoff')
 // The previous lead is now an unassigned technician on a restricted job.
 assert.equal((await st(L)).job.some(j=>j.id===job.id),false);await h.command('time.start',{jobId:job.id,version:now.version,category:'billable'},{...L,status:403});await h.command('note.add',{jobId:job.id,body:'late'},{...L,status:403})
 assert.equal((await st(L)).timeEntry.filter(e=>e.jobId===job.id).length,2,'FLOW-004 the previous lead keeps their own time records')
 // A declined handoff leaves the lead in place.
 let back=await h.command('handoff.propose',{jobId:job.id,version:now.version,toId:outsider.id,note:'Need a second opinion'},S)
 back=await h.command('handoff.decline',{handoffId:back.id,version:back.version,reason:'Booked on another repair'},O);assert.equal(back.status,'declined');assert.equal((await current()).technicianId,specialist.id)
 const page=await (await h.request('/app/jobs/'+job.id)).text();assert.match(page,/Handover receipt[\s\S]*Codes scanned[\s\S]*Road test/);assert.match(page,/morgan-crew[\s\S]*billable[\s\S]*rio-crew[\s\S]*rework|rio-crew[\s\S]*rework[\s\S]*morgan-crew[\s\S]*billable/)
 // OPS-001: crew, subtasks, notes, mentions and handoffs restore exactly.
 const state=await st(),backup=await archive(h),target=await installation()
 try{await restore(target,backup);const restored=(await target.state()).records;for(const kind of ['jobNote','subtask','handoff','job'])assert.deepEqual(restored[kind],state[kind],'FLOW-005 restores '+kind)}finally{await target.close()}
}
