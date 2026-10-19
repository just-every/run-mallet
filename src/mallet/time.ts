import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type Row,type State,type Actor} from './model'
import {instant,openJob} from './workshop'
export const timeCommands=['time.clockIn','time.clockOut','time.breakStart','time.breakEnd','time.start','time.pause','time.correct','time.approveCorrection'] as const
export const timeMemberCommands=timeCommands.filter(command=>command!=='time.approveCorrection')
export const timeRange=(entry:Row)=>entry.revisions.at(-1)
export function timeSeconds(entry:Row,now=new Date().toISOString()) {
 const range=timeRange(entry)
 return Math.max(0,Date.parse(range.endAt??now)-Date.parse(range.startAt))/1000
}
const owned=(s:State,id:string)=>rows(s,'timeEntry').filter(e=>e.ownerId===id)
const active=(s:State,id:string,kind:string)=>owned(s,id).find(e=>e.kind===kind&&timeRange(e).endAt===null)
function emit(c:Context,command:string,entry:Row,data:any={}){event(c,command,entry.jobId,entry.id,{ownerId:entry.ownerId,...data})}
function validate(s:State,ownerId:string,now:string) {
 const entries=owned(s,ownerId),end=(e:Row)=>timeRange(e).endAt??now
 const overlap=(a:Row,b:Row)=>timeRange(a).startAt<end(b)&&timeRange(b).startAt<end(a)
 for(const entry of entries){
  const range=timeRange(entry)
  if(range.startAt>now||end(entry)<range.startAt||end(entry)>now)fail('TIME_RANGE','Time intervals must be ordered and cannot extend into the future.')
  if(entry.kind!=='attendance') {
   const attendance=entries.find(e=>e.id===entry.attendanceId)
   if(!attendance||timeRange(attendance).startAt>range.startAt||end(attendance)<end(entry))fail('TIME_ATTENDANCE','Job time and breaks must stay inside their attendance interval.')
  }
  for(const other of entries){
   if(entry.id===other.id||!overlap(entry,other))continue
   if(entry.kind==='attendance'&&other.kind==='attendance'||entry.kind!=='attendance'&&other.kind!=='attendance')fail('TIME_OVERLAP','Attendance intervals and job/break intervals cannot overlap their peers.')
  }
 }
}
function create(c:Context,kind:string,attendance:Row|null,job:Row|null,billable=false) {
 const entry=put(c.s,'timeEntry',{ownerId:c.actor.id,owner:who(c),kind,attendanceId:attendance?.id??null,jobId:job?.id??null,billable,revisions:[{startAt:c.now,endAt:null,by:who(c),at:c.now,reason:'Live clock'}]})
 validate(c.s,c.actor.id,c.now);return entry
}
function close(c:Context,entry:Row) {
 const prior=timeRange(entry),next=bump(c.s,'timeEntry',entry,{revisions:[...entry.revisions,{...prior,endAt:c.now,by:who(c),at:c.now,reason:'Live clock stop'}]})
 validate(c.s,c.actor.id,c.now);return next
}
export const time:Handler=(c,command,p)=>{
 if(!(timeCommands as readonly string[]).includes(command))return
 if(c.actor.role==='agent')fail('FORBIDDEN','Time requires a native staff session.',null,403)
 const attendance=active(c.s,c.actor.id,'attendance'),running=active(c.s,c.actor.id,'job'),onBreak=active(c.s,c.actor.id,'break')
 if(command==='time.clockIn') {
  if(attendance)fail('TIME_STATE','You are already clocked in.')
  const row=create(c,'attendance',null,null);emit(c,command,row);return row
 }
 if(command==='time.clockOut') {
  if(!attendance)fail('TIME_STATE','Clock in before clocking out.')
  if(running||onBreak)fail('TIME_STATE','Pause the job timer and end the break before clocking out.')
  const row=close(c,attendance);emit(c,command,row);return row
 }
 if(command==='time.breakStart') {
  if(!attendance||running||onBreak)fail('TIME_STATE','Clock in and pause your job timer before starting a break.')
  const row=create(c,'break',attendance,null);emit(c,command,row);return row
 }
 if(command==='time.breakEnd') {
  if(!onBreak)fail('TIME_STATE','There is no running break to end.')
  const row=close(c,onBreak);emit(c,command,row);return row
 }
 if(command==='time.start') {
  if(!attendance||onBreak||running)fail('TIME_STATE','Clock in, end your break and pause any running job timer first.')
  const job=openJob(c,p)
  if(job.technicianId!==c.actor.id)fail('FORBIDDEN','Start timers only on your own assigned repairs.',null,403)
  const row=create(c,'job',attendance,job,choice(p.category,['billable','nonbillable','rework'],'time category')==='billable')
  // Category is retained independently from the invoiced actuals and sold hours.
  const saved=bump(c.s,'timeEntry',row,{category:p.category});emit(c,command,saved,{category:p.category});return saved
 }
 if(command==='time.pause') {
  if(!running||running.jobId!==p.jobId)fail('TIME_STATE','That repair has no running timer for you.')
  // Outgoing technicians can stop their own clock after reassignment; no new work authority is granted.
  const row=close(c,running);emit(c,command,row);return row
 }
 if(command==='time.correct') {
  const entry=find(c.s,'timeEntry',p.entryId);expectVersion(entry,p.entryVersion)
  if(entry.ownerId!==c.actor.id)fail('FORBIDDEN','Propose corrections only to your own time.',null,403)
  if(timeRange(entry).endAt===null)fail('TIME_STATE','Stop this interval before proposing a correction.')
  const startAt=instant(p.startAt,'corrected start'),endAt=instant(p.endAt,'corrected end')
  if(endAt<=startAt||endAt>c.now)fail('TIME_RANGE','Corrected time must end after it starts, no later than now.')
  const row=put(c.s,'timeCorrection',{ownerId:entry.ownerId,jobId:entry.jobId,entryId:entry.id,entryVersion:entry.version,before:structuredClone(timeRange(entry)),after:{startAt,endAt},reason:text(p.reason,'correction reason',2000),by:who(c),at:c.now,status:'pending'})
  emit(c,command,entry,{correctionId:row.id,before:row.before,after:row.after,reason:row.reason});return row
 }
 if(command==='time.approveCorrection') {
  if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or service advisor must approve time corrections.',null,403)
  const correction=find(c.s,'timeCorrection',p.correctionId);expectVersion(correction,p.correctionVersion)
  if(correction.status!=='pending')fail('TIME_STATE','This correction has already been decided.')
  const entry=find(c.s,'timeEntry',correction.entryId);expectVersion(entry,correction.entryVersion)
  const updated=bump(c.s,'timeEntry',entry,{revisions:[...entry.revisions,{...correction.after,reason:correction.reason,by:correction.by,at:correction.at,correctionId:correction.id,approvedBy:who(c),approvedAt:c.now}]})
  validate(c.s,entry.ownerId,c.now)
  const row=bump(c.s,'timeCorrection',correction,{status:'approved',approvedBy:who(c),approvedAt:c.now,appliedEntryVersion:updated.version})
  emit(c,command,entry,{correctionId:row.id,before:correction.before,after:correction.after,reason:correction.reason});return row
 }
}
export function scopedTime(s:State,actor:Actor):State {
 if(['owner','admin'].includes(actor.role))return s
 const own=(row:Row)=>actor.role==='member'&&row.ownerId===actor.id
 return {...s,records:{...s.records,timeEntry:rows(s,'timeEntry').filter(own),timeCorrection:rows(s,'timeCorrection').filter(own),event:rows(s,'event').filter(e=>!e.kind.startsWith('time.')||own(e.data))}}
}
export function timeTotals(s:State,ownerId:string,now=new Date().toISOString()) {
 const entries=owned(s,ownerId),sum=(predicate:(e:Row)=>boolean)=>entries.filter(predicate).reduce((n,e)=>n+timeSeconds(e,now),0)
 const attendanceSeconds=sum(e=>e.kind==='attendance'),breakSeconds=sum(e=>e.kind==='break'),jobSeconds=sum(e=>e.kind==='job'),nonbillableSeconds=sum(e=>e.kind==='job'&&!e.billable)
 return {attendanceSeconds,breakSeconds,netAttendanceSeconds:attendanceSeconds-breakSeconds,jobSeconds,billableSeconds:jobSeconds-nonbillableSeconds,nonbillableSeconds}
}
