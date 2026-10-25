import {choice,integer,bump,event,expectVersion,fail,find,put,rows,text,who,type Handler} from '../model'
import {instant} from '../workshop'
import {period} from './technicians'
export const filterCommands=['reportFilter.save','reportFilter.archive','reportFilter.schedule','reportDelivery.claim','reportDelivery.outcome']
export const reportFilters:Handler=(c,command,p)=>{
 if(!filterCommands.includes(command))return
 if(command==='reportDelivery.claim'){
  if(c.actor.role!=='system')fail('FORBIDDEN','Only the report scheduler claims delivery.',null,403)
  const filter=find(c.s,'reportFilter',p.filterId)
  if(filter.archived||rows(c.s,'reportDelivery').some(d=>d.filterId===filter.id&&d.dueAt===p.dueAt))fail('REPORT_CLAIM','A delivery occurrence is claimed once; never retried.')
  return put(c.s,'reportDelivery',{filterId:filter.id,ownerId:filter.ownerId,dueAt:p.dueAt,to:p.to,contentHash:text(p.contentHash,'report content hash',64),consentAt:p.consentAt,status:'unconfirmed',at:c.now})
 }
 if(command==='reportDelivery.outcome'){
  if(c.actor.role!=='system')fail('FORBIDDEN','Only the report scheduler records outcomes.',null,403)
  const row=find(c.s,'reportDelivery',p.deliveryId)
  if(row.status!=='unconfirmed')fail('REPORT_OUTCOME','A handoff outcome is immutable.')
  return bump(c.s,'reportDelivery',row,{status:choice(p.status,['accepted','development','failed','uncertain'],'mail outcome'),provider:text(p.provider,'mail provider'),outcomeAt:c.now})
 }
 if(!['owner','admin','member'].includes(c.actor.role))fail('FORBIDDEN','A native staff session is required.',null,403)
 if(command==='reportFilter.schedule'){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner schedules delivery to their native email.',null,403)
  const row=find(c.s,'reportFilter',p.filterId);expectVersion(row,p.version)
  if(row.ownerId!==c.actor.id||row.archived)fail('FORBIDDEN','Use your own active saved filter.',null,403)
  if(typeof p.active!=='boolean')fail('INPUT','Declare schedule activity.',null,400)
  const everyDays=integer(p.everyDays,'delivery interval in days',1,365),nextAt=instant(p.nextAt,'next scheduled UTC time')
  if(p.active&&(p.consent!==true||!Number.isFinite(Date.parse(nextAt))||nextAt<=c.now))fail('REPORT_CONSENT','Consent to a future schedule explicitly.')
  const schedule={active:p.active,everyDays,nextAt,to:text(p.to,'native owner email',320),evidence:text(p.evidence,'explicit report email consent',2000),at:c.now,by:who(c)}
  const next=bump(c.s,'reportFilter',row,{schedule,scheduleHistory:[...(row.scheduleHistory??[]),schedule]});event(c,command,null,row.id,{});return next
 }
 if(command==='reportFilter.archive'){
  const row=find(c.s,'reportFilter',p.filterId);expectVersion(row,p.version)
  if(row.ownerId!==c.actor.id)fail('FORBIDDEN','Only the person who saved a filter can archive it.',null,403)
  const next=bump(c.s,'reportFilter',row,{archived:true});event(c,command,null,row.id,{});return next
 }
 if(!['technicians','turnaround'].includes(p.report))fail('INPUT','Choose an existing native report.',null,400)
 const selected=period(p.from,p.to,c.now),name=text(p.name,'filter name',100)
 if(rows(c.s,'reportFilter').some(r=>r.ownerId===c.actor.id&&!r.archived&&r.name===name))fail('REPORT_FILTER','Use a distinct saved filter name.')
 const row=put(c.s,'reportFilter',{ownerId:c.actor.id,name,report:p.report,from:selected.from,to:selected.to,archived:false,by:who(c),at:c.now})
 event(c,command,null,row.id,{});return row
}
