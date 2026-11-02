import {instant} from './workshop'
import {bump,event,expectVersion,fail,find,put,rows,text,who,type Handler,type State} from './model'
export const calendarCommands=['calendar.resourceSave','calendar.technicianSave','calendar.absenceSave','calendar.seriesCreate','calendar.seriesCancel']
const overlap=(a:any,b:any)=>a.startAt<b.endAt&&a.endAt>b.startAt
export function resourceFields(p:any):{liftId?:string;loanerId?:string;requiredSkill?:string}{return {liftId:text(p.liftId,'lift',100,true),loanerId:text(p.loanerId,'loaner',100,true),requiredSkill:text(p.requiredSkill,'required skill',100,true)}}
const skills=(value:any)=>{if(!Array.isArray(value)||value.length>20)fail('INPUT','Declare up to twenty skills.',null,400);return [...new Set(value.map(x=>text(x,'skill',100)))]}
const active=(p:any)=>{if(typeof p.active!=='boolean')fail('INPUT','Specify whether this record is active.',null,400);return p.active}
const hit=(row:any,resources:string[],title:string)=>({href:'/app/calendar',jobId:row.id,title,bayId:row.bayId,technicianId:row.technicianId,startAt:row.startAt,endAt:row.endAt,resources})
export function resourceEligibility(s:State,plan:any){
 const result:any[]=[]
 for(const [field,kind]of [['bayId','bay'],['liftId','lift'],['loanerId','loaner']]){
  if(!plan[field])continue
  const resource=rows(s,'calendarResource').find(r=>r.id===plan[field])
  if(!resource&&field==='bayId')continue // Existing repair bays remain usable until registered.
  if(!resource||resource.kind!==kind||!resource.active||plan.requiredSkill&&kind!=='loaner'&&!resource.skills.includes(plan.requiredSkill))result.push(hit(plan,[kind],`Unavailable or unqualified ${kind}`))
 }
 const tech=rows(s,'calendarTechnician').find(r=>r.technicianId===plan.technicianId)
 if(tech&&(!tech.active||plan.requiredSkill&&!tech.skills.includes(plan.requiredSkill))||plan.requiredSkill&&!tech)result.push(hit(plan,['technician'],'Unavailable or unqualified technician'))
 return result
}
export function calendarReservations(s:State,now=new Date().toISOString()){
 return [...rows(s,'job').filter(j=>!['completed','invoiced','canceled','lost'].includes(j.status)).map(j=>({...j,source:'job'})),...rows(s,'appointment').filter(a=>a.status==='confirmed'||a.status==='held'&&a.expiresAt>now).map(a=>({...a,source:'appointment'})),...rows(s,'calendarSeries').filter(r=>r.active).flatMap(r=>r.occurrences.map((o:any)=>({...r,...o,id:r.id,source:'series'})))]
}
export function capacityConflicts(s:State,plan:any,exceptId?:string,now=new Date().toISOString(),includeAppointments=true){
 const result=resourceEligibility(s,plan)
 for(const r of rows(s,'calendarAbsence').filter(r=>r.active&&overlap(r,plan))){
  const matched=r.technicianId?r.technicianId===plan.technicianId:[plan.bayId,plan.liftId,plan.loanerId].includes(r.resourceId)
  if(matched)result.push(hit(r,['absence'],r.reason))
 }
 for(const r of calendarReservations(s,now).filter(r=>r.id!==exceptId&&(includeAppointments||r.source!=='appointment')&&overlap(r,plan))){
  const resources=['bayId','technicianId','liftId','loanerId'].filter(k=>plan[k]&&plan[k]===r[k]).map(k=>k.replace('Id',''))
  // Workshop already reports job/appointment bay and technician conflicts.
  const relevant=r.source==='series'?resources:resources.filter(k=>k==='lift'||k==='loaner')
  if(relevant.length)result.push(hit(r,relevant,r.title??'Customer appointment'))
 }
 return result
}
function interval(p:any){const startAt=instant(p.startAt,'start'),endAt=instant(p.endAt,'end');if(endAt<=startAt||Date.parse(endAt)-Date.parse(startAt)>7*86400000)fail('INPUT','Choose an interval lasting at most seven days.',null,400);return {startAt,endAt}}
const local=(at:string,timeZone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(x=>[x.type,x.value]))
function wall(at:string,timeZone:string){const p=local(at,timeZone);return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`}
function weekly(p:any){
 const timeZone=text(p.timeZone,'shop timezone',100)
 try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Choose a valid IANA timezone.',null,400)}
 if(!Array.isArray(p.occurrences)||p.occurrences.length<2||p.occurrences.length>52)fail('INPUT','Supply 2–52 explicitly dated weekly occurrences.',null,400)
 const occurrences=p.occurrences.map((o:any)=>{
  const value=interval(o)
  for(const k of ['startAt','endAt'])if(wall(value[k as keyof typeof value],timeZone)!==String(o[k]).slice(0,19))fail('INPUT','Each occurrence must use the actual local date, time and UTC offset in the selected timezone.',null,400)
  return value
 })
 for(let i=1;i<occurrences.length;i++)for(const k of ['startAt','endAt']){
  const previous=wall(occurrences[i-1][k],timeZone),next=wall(occurrences[i][k],timeZone)
  if(Date.parse(next+'Z')-Date.parse(previous+'Z')!==7*86400000)fail('INPUT','Occurrences must repeat at the same local times exactly one week apart.',null,400)
 }
 return {timeZone,occurrences}
}
export const calendarCapacity:Handler=(c,command,p)=>{
 if(!calendarCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or advisor manages resource calendars.',null,403)
 const save=(kind:string,id:any,value:any)=>{const old=id?find(c.s,kind,id):null;if(old)expectVersion(old,p.version);const revision={...value,at:c.now,by:who(c)};const row=old?bump(c.s,kind,old,{...value,history:[...(old.history??[]),revision]}):put(c.s,kind,{...value,history:[revision]});event(c,command,null,row.id,{version:row.version});return row}
 if(command==='calendar.resourceSave'){
  if(!['bay','lift','loaner'].includes(p.kind))fail('INPUT','Choose bay, lift or loaner.',null,400)
  if(p.resourceId&&find(c.s,'calendarResource',p.resourceId).kind!==p.kind)fail('INPUT','A resource keeps its original kind.',null,400)
  return save('calendarResource',p.resourceId,{kind:p.kind,name:text(p.name,'resource name'),skills:skills(p.skills),active:active(p)})
 }
 if(command==='calendar.technicianSave'){
  const technicianId=text(p.technicianId,'technician',100),old=rows(c.s,'calendarTechnician').find(r=>r.technicianId===technicianId)
  return save('calendarTechnician',old?.id,{technicianId,skills:skills(p.skills),active:active(p)})
 }
 if(command==='calendar.absenceSave'){
  const technicianId=text(p.technicianId,'technician',100,true),resourceId=text(p.resourceId,'resource',100,true)
  if(Boolean(technicianId)===Boolean(resourceId))fail('INPUT','Choose exactly one technician or resource.',null,400)
  if(resourceId)find(c.s,'calendarResource',resourceId)
  return save('calendarAbsence',p.absenceId,{technicianId,resourceId,...interval(p),reason:text(p.reason,'absence reason',2000),active:active(p)})
 }
 if(command==='calendar.seriesCancel'){
  const old=find(c.s,'calendarSeries',p.seriesId);expectVersion(old,p.version)
  if(!old.active)fail('CALENDAR_STATE','This recurring reservation is already canceled.')
  return save('calendarSeries',old.id,{active:false,canceledAt:c.now,cancelReason:text(p.reason,'cancellation reason',2000)})
 }
 const plan={bayId:text(p.bayId,'bay',100),technicianId:text(p.technicianId,'technician',100),...resourceFields(p)},series=weekly(p)
 for(const occurrence of series.occurrences){
  const candidate={...plan,...occurrence},conflicts=capacityConflicts(c.s,candidate,undefined,c.now)
  for(const other of calendarReservations(c.s,c.now))if(overlap(other,candidate)&&(other.bayId===plan.bayId||other.technicianId===plan.technicianId))conflicts.push(hit(other,['reservation'],other.title??'Customer appointment'))
  if(conflicts.length)fail('DISPATCH_CONFLICT','The recurring reservation overlaps unavailable capacity.',{conflicts})
 }
 return save('calendarSeries',null,{title:text(p.title,'reservation title'),...plan,...series,active:true,createdAt:c.now})
}
