import {bump, choice, event, expectVersion, fail, find, integer, put, rows, text, who, type Handler, type State, type Row} from './model'
import {instant} from './workshop'

export function readings(s:State,assetId:string) {
 const all=rows(s,'reading').filter(r=>r.assetId===assetId),replaced=new Set(all.map(r=>r.corrects).filter(Boolean))
 return all.filter(r=>!replaced.has(r.id)).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)||a.at.localeCompare(b.at)||a.id.localeCompare(b.id))
}
export function serviceDue(s:State,assetId:string,now:string) {
 const active=readings(s,assetId)
 return rows(s,'serviceInterval').filter(r=>r.assetId===assetId).map((rule):Row & {latest:Row|null,distanceDue:boolean|null,timeDue:boolean}=>{
  const latest=active.filter(r=>r.unit===rule.unit).at(-1)
  return {...rule,latest:latest??null,distanceDue:latest?latest.value>=rule.dueValue:null,timeDue:now.slice(0,10)>=rule.dueDate}
 })
}
export const mileage:Handler=(c,command,p)=>{
 if(command!=='reading.record'&&command!=='serviceInterval.save')return
 const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
 if(command==='serviceInterval.save') {
  const unit=choice(p.unit??'miles',['miles','km','hours'],'units'),dueDate=text(p.dueDate,'dueDate',10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate+'T00:00:00Z'))||new Date(dueDate).toISOString().slice(0,10)!==dueDate)fail('INPUT','Use a valid due date.',null,400)
  const row=put(c.s,'serviceInterval',{assetId:job.assetId,jobId:job.id,name:text(p.name,'service name'),unit,dueValue:integer(p.dueValue,'due reading',0,100_000_000),dueDate,by:who(c),at:c.now})
  event(c,command,job.id,row.id,row);return row
 }
 const unit=choice(p.unit??'miles',['miles','km','hours'],'units'),stage=choice(p.stage,['intake','out'],'reading stage'),value=integer(p.value,'reading',0,100_000_000),observedAt=instant(p.observedAt,'observation date')
 if(observedAt>c.now)fail('INPUT','An observation cannot be in the future.',null,400)
 let corrects=null,reason=''
 if(p.corrects){const original=find(c.s,'reading',p.corrects);if(original.jobId!==job.id||original.stage!==stage||original.unit!==unit)fail('INPUT','Correct a reading from this visit, stage and unit.',null,400);if(!readings(c.s,job.assetId).some(r=>r.id===original.id))fail('READING_REPLACED','That reading already has a correction.');corrects=original.id;reason=text(p.reason,'correction reason',2000)}
 else if(readings(c.s,job.assetId).some(r=>r.jobId===job.id&&r.stage===stage&&r.unit===unit))fail('READING_EXISTS','Correct the existing visit reading with a reason.')
 const active=readings(c.s,job.assetId).filter(r=>r.id!==corrects&&r.unit===unit),regression=active.some(r=>r.observedAt<observedAt&&r.value>value||r.observedAt>observedAt&&r.value<value)
 const row=put(c.s,'reading',{assetId:job.assetId,jobId:job.id,unit,stage,value,observedAt,corrects,reason,regression,by:who(c),at:c.now})
 bump(c.s,'job',job,{readingUpdatedAt:c.now});event(c,command,job.id,row.id,row);return row
}
