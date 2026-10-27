import {bump,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {timeSeconds} from './time'
// FLOW-004: a lead technician plus helpers on one repair, dependent subtasks, staff-private notes with
// mentions and media references, and a handoff the recipient must acknowledge before it takes effect.
export const collaborationCommands=['crew.add','crew.remove','subtask.create','subtask.complete','note.add','mention.acknowledge','handoff.propose','handoff.acknowledge','handoff.decline'] as const
export const collaborationMemberCommands=['subtask.create','subtask.complete','note.add','mention.acknowledge','handoff.propose','handoff.acknowledge','handoff.decline']
const manager=(c:Context)=>['owner','admin'].includes(c.actor.role)
/** The lead (booked technician) and current helpers share the repair's member access. */
export const onCrew=(job:Row,id:string)=>job.technicianId===id||(job.helpers??[]).includes(id)
const open=(c:Context,id:unknown)=>{const job=find(c.s,'job',id);if(!['booked','working'].includes(job.status))fail('JOB_STATE','This repair is already completed.');return job}
const member=(c:Context,job:Row)=>{if(!manager(c)&&!(c.actor.role==='member'&&onCrew(job,c.actor.id)))fail('FORBIDDEN','Only this repair’s crew, the owner or a service advisor may do that.',null,403)}
const lead=(c:Context,job:Row)=>{if(!manager(c)&&c.actor.id!==job.technicianId)fail('FORBIDDEN','Only the lead technician, the owner or a service advisor may do that.',null,403)}
const running=(s:State,jobId:string,ownerId:string)=>rows(s,'timeEntry').some(e=>e.kind==='job'&&e.jobId===jobId&&e.ownerId===ownerId&&e.revisions.at(-1).endAt===null)
/** Each person's recorded job time on this repair, by category, in whole seconds. */
export function crewTime(s:State,jobId:string,now:string) {
 const out:Record<string,{name:string,billable:number,nonbillable:number,rework:number}>={}
 for(const e of rows(s,'timeEntry').filter(x=>x.kind==='job'&&x.jobId===jobId)){const t=out[e.ownerId]??={name:e.owner.name,billable:0,nonbillable:0,rework:0};t[(e.category??(e.billable?'billable':'nonbillable')) as 'billable']+=timeSeconds(e,now)}
 return out
}
export const collaboration:Handler=(c,command,p)=>{
 if(!(collaborationCommands as readonly string[]).includes(command))return
 if(c.actor.role==='agent')fail('FORBIDDEN','Collaboration needs a native staff session.',null,403)
 if(command==='crew.add'||command==='crew.remove') {
  if(!manager(c))fail('FORBIDDEN','An owner or service advisor assigns helpers.',null,403)
  const job=open(c,p.jobId);expectVersion(job,p.version)
  const id=text(p.technicianId,'technician',100),helpers=job.helpers??[]
  if(command==='crew.add'){if(onCrew(job,id))fail('CREW','That technician is already on this repair.');if(!p.verifiedTechnician)fail('CREW','Choose an active technician.',null,400)}
  else if(!helpers.includes(id))fail('CREW','That technician is not a helper on this repair.')
  const row=bump(c.s,'job',job,{helpers:command==='crew.add'?[...helpers,id]:helpers.filter((h:string)=>h!==id)})
  event(c,command,job.id,job.id,{technicianId:id});return row
 }
 if(command==='subtask.create') {
  const job=open(c,p.jobId);lead(c,job)
  const assigneeId=text(p.assigneeId,'assignee',100);if(!onCrew(job,assigneeId))fail('INPUT','Assign the subtask to someone on this repair’s crew.',null,400)
  const dependsOn=[...new Set(Array.isArray(p.dependsOn)?p.dependsOn.map((d:unknown)=>text(d,'dependency',100)):[])] as string[]
  if(dependsOn.some(d=>find(c.s,'subtask',d).jobId!==job.id))fail('INPUT','Depend only on subtasks of this repair.',null,400)
  const row=put(c.s,'subtask',{jobId:job.id,title:text(p.title,'subtask',200),assigneeId,dependsOn,createdBy:who(c),createdAt:c.now,completedAt:null,completedBy:null})
  event(c,command,job.id,row.id,{title:row.title,assigneeId,dependsOn});return row
 }
 if(command==='subtask.complete') {
  const task=find(c.s,'subtask',p.subtaskId);expectVersion(task,p.version)
  if(task.kind==='pickup-followup')fail('PICKUP_RESOLUTION','Record contact resolution on the status and pickup screen.',null,403)
  if(task.kind==='review-feedback'){if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner handles private feedback.',null,403);find(c.s,'job',task.jobId)}else open(c,task.jobId)
  if(!manager(c)&&c.actor.id!==task.assigneeId)fail('FORBIDDEN','Only the assignee, the owner or a service advisor completes this subtask.',null,403)
  if(task.completedAt)fail('SUBTASK_STATE','This subtask is already complete.')
  const waiting=task.dependsOn.map((d:string)=>find(c.s,'subtask',d)).filter((d:Row)=>!d.completedAt)
  if(waiting.length)fail('SUBTASK_BLOCKED','Complete the subtasks this one depends on first.',{waiting:waiting.map((d:Row)=>d.title)})
  const row=bump(c.s,'subtask',task,{completedAt:c.now,completedBy:who(c)});event(c,command,task.jobId,task.id,{title:task.title});return row
 }
 if(command==='note.add') {
  // The HTTP door resolves mentions to active operators and media to this repair's completed uploads.
  const job=open(c,p.jobId);member(c,job)
  const mentions=Array.isArray(p.mentions)?p.mentions:[]
  if(mentions.some((m:any)=>!['owner','admin'].includes(m.role)&&!onCrew(job,m.id)))fail('INPUT','Mention only people who can already read this repair.',null,400)
  const row=put(c.s,'jobNote',{jobId:job.id,body:text(p.body,'note',2000),mentions:mentions.map((m:any)=>({id:m.id,name:m.name,acknowledgedAt:null})),attachments:p.attachments??[],by:who(c),at:c.now})
  event(c,command,job.id,row.id,{mentions:row.mentions.map((m:any)=>m.id),attachments:row.attachments.length});return row
 }
 if(command==='mention.acknowledge') {
  const note=find(c.s,'jobNote',p.noteId);expectVersion(note,p.version)
  const mine=note.mentions.find((m:any)=>m.id===c.actor.id)
  if(!mine)fail('FORBIDDEN','Only the mentioned person acknowledges a mention.',null,403)
  if(mine.acknowledgedAt)return note
  return bump(c.s,'jobNote',note,{mentions:note.mentions.map((m:any)=>m.id===c.actor.id?{...m,acknowledgedAt:c.now}:m)})
 }
 if(command==='handoff.propose') {
  const job=open(c,p.jobId);expectVersion(job,p.version);lead(c,job)
  const toId=text(p.toId,'specialist',100)
  if(!p.verifiedTechnician)fail('INPUT','Hand the repair to an active technician.',null,400)
  if(toId===job.technicianId)fail('INPUT','This technician already leads the repair.',null,400)
  if(rows(c.s,'handoff').some(h=>h.jobId===job.id&&h.status==='proposed'))fail('HANDOFF_STATE','A handoff for this repair is already waiting for acknowledgment.')
  if(running(c.s,job.id,job.technicianId))fail('TIMER_RUNNING','The lead technician must stop their timer on this repair before handing it off.')
  const row=put(c.s,'handoff',{jobId:job.id,jobTitle:job.title,jobVersion:job.version,fromId:job.technicianId,toId,toName:text(p.toName,'specialist name',200),note:text(p.note,'work-state note',2000),keepHelper:p.keepHelper===true,proposedBy:who(c),proposedAt:c.now,status:'proposed',decidedAt:null,reason:null,receipt:null})
  event(c,command,job.id,row.id,{fromId:row.fromId,toId});return row
 }
 const handoff=find(c.s,'handoff',p.handoffId);expectVersion(handoff,p.version)
 if(handoff.status!=='proposed')fail('HANDOFF_STATE','This handoff was already decided.')
 if(c.actor.id!==handoff.toId)fail('FORBIDDEN','Only the receiving technician acknowledges or declines a handoff.',null,403)
 const job=open(c,handoff.jobId)
 if(job.technicianId!==handoff.fromId)fail('HANDOFF_STALE','The repair’s lead changed after this handoff was proposed.')
 if(command==='handoff.decline') {
  const row=bump(c.s,'handoff',handoff,{status:'declined',decidedAt:c.now,reason:text(p.reason,'decline reason',500)});event(c,command,job.id,row.id,{reason:row.reason});return row
 }
 if(running(c.s,job.id,handoff.fromId))fail('TIMER_RUNNING','The previous lead has a running timer on this repair.')
 const helpers=(job.helpers??[]).filter((h:string)=>h!==handoff.toId&&(handoff.keepHelper||h!==handoff.fromId))
 const next=bump(c.s,'job',job,{technicianId:handoff.toId,helpers:handoff.keepHelper&&!helpers.includes(handoff.fromId)?[...helpers,handoff.fromId]:helpers})
 const receipt={jobId:job.id,from:{id:handoff.fromId},to:{id:handoff.toId,name:handoff.toName},note:handoff.note,proposedBy:handoff.proposedBy,proposedAt:handoff.proposedAt,acknowledgedAt:c.now,previousLeadKept:handoff.keepHelper,openSubtasks:rows(c.s,'subtask').filter(t=>t.jobId===job.id&&!t.completedAt).map(t=>({id:t.id,title:t.title,assigneeId:t.assigneeId})),time:crewTime(c.s,job.id,c.now)}
 const row=bump(c.s,'handoff',handoff,{status:'acknowledged',decidedAt:c.now,receipt})
 event(c,command,job.id,row.id,{fromId:handoff.fromId,toId:handoff.toId,jobVersion:next.version});return row
}
export function scopedCollaboration(s:State,actor:{id:string,role:string}):State {
 if(['owner','admin'].includes(actor.role))return s
 const {jobNote:_n,subtask:_t,handoff:_h,...rest}=s.records
 if(actor.role!=='member')return {...s,records:rest}
 const ids=new Set(rows(s,'job').filter(j=>onCrew(j,actor.id)).map(j=>j.id))
 return {...s,records:{...rest,jobNote:rows(s,'jobNote').filter(n=>ids.has(n.jobId)),subtask:rows(s,'subtask').filter(t=>ids.has(t.jobId)),handoff:rows(s,'handoff').filter(h=>ids.has(h.jobId)||h.toId===actor.id&&h.status==='proposed')}}
}
