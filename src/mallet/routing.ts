import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {openJob} from './workshop'
import {currentPromisePlan} from './promises'
import {flowRecord,priorities} from './flow'

export const routingCommands=['routing.configure','routing.intake','routing.run','routing.exception','routing.acknowledge','routing.resolve','routing.sweep'] as const
export const blockerKinds=['unassigned','approval-waiting','parts-stalled','diagnostic-exception'] as const
const currentPolicy=(s:State)=>rows(s,'routingPolicy')[0]
const latest=(row:Row)=>row.revisions.at(-1)
const list=(value:unknown,label:string,max=100):any[]=>{if(!Array.isArray(value)||value.length>max)fail('INPUT',`${label} must be an array of at most ${max} entries.`,null,400);return value}
const manager=(c:Context)=>{if(!['owner','admin','system'].includes(c.actor.role))fail('FORBIDDEN','Use the existing owner or admin routing door.',null,403)}
export const routingCase=(s:State,jobId:string)=>rows(s,'routingCase').find(r=>r.jobId===jobId)
function savedCase(c:Context,row:Row,changes:any,kind:string,data:any){const next=bump(c.s,'routingCase',row,changes);event(c,kind,row.jobId,row.id,data);return next}

/** Count real UTC minutes whose shop-local wall time is open. DST repetitions count twice; gaps count zero. */
export function shopDeadline(at:string,minutes:number,calendar:any):string {
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:calendar.timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
 const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],closed=new Set(calendar.closedDates)
 let cursor=Math.ceil(Date.parse(at)/60000)*60000,left=minutes
 // The next full open minute counts; the deadline is its ending boundary. The bounded calendar is weekly.
 for(let i=0;i<370*1440;i++,cursor+=60000){
  const p=Object.fromEntries(format.formatToParts(new Date(cursor)).map(p=>[p.type,p.value])),day=`${p.year}-${p.month}-${p.day}`,minute=Number(p.hour)*60+Number(p.minute)
  if(!closed.has(day)&&calendar.weekdays.includes(days.indexOf(p.weekday))&&minute>=calendar.openMinute&&minute<calendar.closeMinute&&!--left)return new Date(cursor+60000).toISOString()
 }
 return fail('CALENDAR','No open deadline within 370 days. Review the shop calendar.')
}
function calendarInput(p:any){
 const timeZone=text(p.timeZone,'IANA time zone',100)
 try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Use a valid IANA time zone.',null,400)}
 const weekdays=[...new Set(list(p.weekdays,'open weekdays',7).map(n=>integer(n,'weekday (Sunday = 0)',0,6)))].sort()
 if(!weekdays.length)fail('INPUT','At least one weekday must be open.',null,400)
 const openMinute=integer(p.openMinute,'opening minute',0,1439),closeMinute=integer(p.closeMinute,'closing minute',1,1440)
 if(closeMinute<=openMinute)fail('INPUT','Closing must follow opening on the same local day.',null,400)
 const closedDates=[...new Set(list(p.closedDates??[],'closed dates',60).map(d=>{
  const date=text(d,'closed date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)fail('INPUT','Use valid YYYY-MM-DD closed dates.',null,400);return date
 }))].sort()
 return {timeZone,weekdays,openMinute,closeMinute,closedDates}
}
function conditions(s:State,row:Row,activeIds:Set<string>){
 const job=find(s,'job',row.jobId),result=new Map<string,{kind:string;detail:string}>()
 if(!['booked','working'].includes(job.status))return result
 if(!row.assignment||!activeIds.has(row.assignment.handler.id))result.set('unassigned',{kind:'unassigned',detail:'No active routing handler'})
 for(const q of rows(s,'estimate').filter(q=>q.jobId===job.id&&['draft','approved','sent'].includes(q.status)))result.set(`approval:${q.id}`,{kind:'approval-waiting',detail:`Estimate ${q.id} revision ${q.revisions.at(-1).n}: ${q.status}`})
 for(const p of currentPromisePlan(s,job.id)?.revisions.at(-1)?.parts??[])if(!p.receivedAt)result.set(`part:${p.partId}`,{kind:'parts-stalled',detail:`Waiting for ${p.name}; staff-reported ETA ${p.eta}`})
 for(const exception of row.exceptions.filter((e:any)=>!e.resolution))result.set(`exception:${exception.id}`,{kind:'diagnostic-exception',detail:exception.detail})
 return result
}
function run(c:Context,p:any){
 const policy=currentPolicy(c.s);if(!policy)return []
 const revision=latest(policy),active=list(p.activePeople,'active people',1000),ids=new Set<string>(active.map(o=>o.id)),changes=[]
 for(let row of rows(c.s,'routingCase')){
  const job=find(c.s,'job',row.jobId)
  if(!['booked','working'].includes(job.status)){
   for(const ticket of rows(c.s,'routingBlocker').filter(b=>b.jobId===job.id&&!b.resolution)){const resolution={at:c.now,by:who(c),reason:`Repair ${job.status}`,automatic:true};bump(c.s,'routingBlocker',ticket,{resolution});event(c,'routing.resolved',job.id,ticket.id,resolution)}
   continue
  }
  if(!row.assignment||!ids.has(row.assignment.handler.id)){
   const priority=flowRecord(c.s,job.id)?.priority??'normal'
   const rule=revision.rules.find((r:any)=>r.location===row.location&&r.repairType===row.repairType&&r.skill===row.skill&&(r.priority==='any'||r.priority===priority)&&ids.has(r.handler.id))
   if(rule){const assignment={handler:active.find(o=>o.id===rule.handler.id),ruleId:rule.id,policyVersion:policy.version,priority,at:c.now,by:who(c)};row=savedCase(c,row,{assignment,assignments:[...row.assignments,assignment]},'routing.assigned',assignment);changes.push(row)}
  }
  const wanted=conditions(c.s,row,ids),open=rows(c.s,'routingBlocker').filter(b=>b.jobId===job.id&&!b.resolution)
  for(const blocker of open)if(!wanted.has(blocker.key)){
   const resolution={at:c.now,by:who(c),reason:'Source blocker cleared',automatic:true};bump(c.s,'routingBlocker',blocker,{resolution});event(c,'routing.resolved',job.id,blocker.id,resolution)
  }
  for(const [key,value] of wanted){
   let ticket:Row=open.find(b=>b.key===key)!
   if(!ticket){
    const dueAt=shopDeadline(c.now,revision.deadlineMinutes[value.kind],revision.calendar)
    ticket=put(c.s,'routingBlocker',{jobId:job.id,caseId:row.id,key,...value,openedAt:c.now,dueAt,policyVersion:policy.version,calendar:structuredClone(revision.calendar),manager:revision.manager,escalation:null,acknowledgment:null,resolution:null})
    event(c,'routing.blocked',job.id,ticket.id,{key,...value,dueAt,manager:ticket.manager})
   }
   if(ticket.dueAt<=c.now&&!ticket.acknowledgment&&!ticket.escalation){
    // An internal durable task, not a claim of email/SMS delivery. Revoked managers are never new recipients.
    const recipient=active.find(o=>o.id===ticket.manager.id&&['owner','admin'].includes(o.role))??active.find(o=>o.role==='owner')
    if(recipient){const escalation={to:recipient,at:c.now,label:'Internal escalation task; no customer message sent'};ticket=bump(c.s,'routingBlocker',ticket,{escalation});event(c,'routing.escalated',job.id,ticket.id,escalation)}
   }
   changes.push(ticket)
  }
 }
 return changes
}
export const routing:Handler=(c,command,p)=>{
 if(!(routingCommands as readonly string[]).includes(command))return
 manager(c)
 if(command==='routing.configure'){
  const previous=currentPolicy(c.s);if(integer(p.policyVersion,'policyVersion',0)!==(previous?.version??0))fail('VERSION','Routing policy changed. Refresh before saving.')
  const people=list(p.activePeople,'active people',1000),person=(id:unknown)=>{const found=people.find(o=>o.id===id&&['owner','admin'].includes(o.role));if(!found)fail('ROUTING_PERSON','Select an active owner or admin handler/manager.');return found}
  const rules=list(p.rules,'routing rules',100).map((r,i)=>({id:text(r.id,'rule id',100),location:text(r.location,'location',100),repairType:text(r.repairType,'repair type',100),skill:text(r.skill,'required skill',100),priority:choice(r.priority,['any',...priorities],'priority'),handler:person(r.handlerId),order:i}))
  if(new Set(rules.map(r=>r.id)).size!==rules.length)fail('INPUT','Rule ids must be unique.',null,400)
  const deadlineMinutes=Object.fromEntries(blockerKinds.map(kind=>[kind,integer(p.deadlineMinutes?.[kind],`${kind} open minutes`,1,10080)]))
  const revision={rules,manager:person(p.managerId),calendar:calendarInput(p.calendar),deadlineMinutes,reason:text(p.reason,'routing policy reason',2000),at:c.now,by:who(c)}
  const saved=previous?bump(c.s,'routingPolicy',previous,{revisions:[...previous.revisions,revision]}):put(c.s,'routingPolicy',{revisions:[revision]})
  event(c,command,null,saved.id,{revision:saved.version});return saved
 }
 if(command==='routing.run'||command==='routing.sweep')return run(c,p)
 if(command==='routing.acknowledge'){
  const ticket=find(c.s,'routingBlocker',p.blockerId);expectVersion(ticket,p.version)
  if(ticket.resolution)fail('BLOCKER_RESOLVED','This blocker is already resolved.')
  if(ticket.acknowledgment)fail('ACKNOWLEDGED','The acknowledgment is already retained.')
  const acknowledgment={by:who(c),at:c.now,note:text(p.note,'acknowledgment note',2000)},saved=bump(c.s,'routingBlocker',ticket,{acknowledgment})
  event(c,command,ticket.jobId,ticket.id,acknowledgment);return saved
 }
 if(command==='routing.resolve'){
  const ticket=find(c.s,'routingBlocker',p.blockerId);expectVersion(ticket,p.version)
  if(ticket.resolution)fail('BLOCKER_RESOLVED','This blocker is already resolved.')
  const row=routingCase(c.s,ticket.jobId)!,exception=ticket.key.startsWith('exception:')&&row.exceptions.find((e:any)=>`exception:${e.id}`===ticket.key)
  if(!exception)fail('SOURCE_BLOCKED','Clear the assignment, estimate or physical-receipt source before resolving this blocker.')
  const resolution={by:who(c),at:c.now,reason:text(p.reason,'resolution evidence',2000),automatic:false}
  savedCase(c,row,{exceptions:row.exceptions.map((e:any)=>e.id===exception.id?{...e,resolution}:e)},command,resolution)
  const saved=bump(c.s,'routingBlocker',ticket,{resolution});event(c,command,ticket.jobId,ticket.id,resolution);return saved
 }
 const job=openJob(c,p),row=routingCase(c.s,job.id)
 if(command==='routing.intake'){
  if(row)fail('ROUTING_EXISTS','This repair already has retained routing intake.')
  if(!currentPolicy(c.s))fail('ROUTING_POLICY','Configure routing before submitting intake.')
  const saved=put(c.s,'routingCase',{jobId:job.id,location:text(p.location,'location',100),repairType:text(p.repairType,'repair type',100),skill:text(p.skill,'required skill',100),assignment:null,assignments:[],exceptions:[],by:who(c),at:c.now})
  event(c,command,job.id,saved.id,{location:saved.location,repairType:saved.repairType,skill:saved.skill});return saved
 }
 if(!row)fail('ROUTING_REQUIRED','Submit this repair to routing first.')
 expectVersion(row,p.caseVersion)
 const exception={id:crypto.randomUUID(),detail:text(p.detail,'diagnostic exception evidence',2000),by:who(c),at:c.now,resolution:null}
 return savedCase(c,row,{exceptions:[...row.exceptions,exception]},command,exception)
}
