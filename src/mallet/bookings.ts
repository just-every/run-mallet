import {resourceFields} from './calendar-capacity'
import {recordAttendance} from './booking-attendance'
import {offerCanceledAppointment} from './booking-waitlist'
import {shopTimeZone} from './promise-zone'
import {createHash} from 'node:crypto'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State} from './model'
import {instant,conflicts} from './workshop'
export const bookingCommands=['booking.attendance','booking.publish','booking.hold','booking.confirm','booking.cancel','booking.reschedule','booking.outcome']
export const internalBookingCommands=['booking.hold','booking.confirm','booking.cancel','booking.reschedule','booking.outcome']
export function appointmentConflicts(s:State,plan:any,exceptId?:string,now=new Date().toISOString()){
 return rows(s,'appointment').filter(a=>a.id!==exceptId&&(a.status==='confirmed'||a.status==='held'&&a.expiresAt>now)&&a.startAt<plan.endAt&&a.endAt>plan.startAt&&(a.bayId===plan.bayId||a.technicianId===plan.technicianId||plan.liftId&&a.liftId===plan.liftId||plan.loanerId&&a.loanerId===plan.loanerId))
}
export function bookingSlots(s:State,service:any,now=new Date().toISOString(),exceptId?:string){
 if(!service.active)return []
 const result:any[]=[],duration=service.durationMinutes*60000
 for(const window of service.windows){
  if(!window.skills.includes(service.skill))continue
  for(let start=Date.parse(window.startAt);start+duration<=Date.parse(window.endAt);start+=duration){
   if(start<Date.parse(now)+service.leadMinutes*60000)continue
   const slot={startAt:new Date(start).toISOString(),endAt:new Date(start+duration).toISOString(),bayId:window.bayId,technicianId:window.technicianId,...resourceFields(window)}
   if(!conflicts(s,slot,undefined,false).length&&!appointmentConflicts(s,slot,exceptId,now).length)result.push(slot)
   if(result.length>=500)return result
  }
 }
 return result
}
export const bookingSlotId=(service:any,slot:any)=>createHash('sha256').update(JSON.stringify([service.id,service.version,slot.startAt,slot.bayId,slot.technicianId])).digest('hex')
function available(s:State,service:any,p:any,now:string,exceptId?:string){
 const slot=bookingSlots(s,service,now,exceptId).find(x=>bookingSlotId(service,x)===p.slotId)
 if(!slot)fail('BOOKING_CAPACITY','That appointment is no longer available. Choose another time.')
 return slot
}
export const bookings:Handler=(c,command,p)=>{
 if(!bookingCommands.includes(command))return
 if(command==='booking.attendance')return recordAttendance(c,p)
 if(command==='booking.publish'){
  if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or advisor publishes booking availability.',null,403)
  if(!Array.isArray(p.windows)||p.windows.length<1||p.windows.length>50)fail('INPUT','Publish 1–50 dated opening windows.',null,400)
  const durationMinutes=integer(p.durationMinutes,'service duration',5,480),leadMinutes=integer(p.leadMinutes,'lead time',0,525600),holdSeconds=integer(p.holdSeconds??600,'tentative hold seconds',1,1800)
  const windows=p.windows.map((w:any)=>{const startAt=instant(w.startAt,'opening time'),endAt=instant(w.endAt,'closing time');if(endAt<=startAt||Date.parse(endAt)-Date.parse(startAt)>86400000)fail('INPUT','Opening windows last at most one day.',null,400);if(!Array.isArray(w.skills)||w.skills.length>20)fail('INPUT','Declare bay skills.',null,400);return {startAt,endAt,bayId:text(w.bayId,'bay'),technicianId:text(w.technicianId,'technician'),...resourceFields(w),skills:w.skills.map((x:any)=>text(x,'skill',100))}})
  const value={timeZone:shopTimeZone(c.s),name:text(p.name,'service'),location:text(p.location,'location'),skill:text(p.skill,'required skill',100),durationMinutes,leadMinutes,holdSeconds,windows,active:p.active===true,by:who(c),at:c.now}
  let row;if(p.serviceId){const old=find(c.s,'bookingService',p.serviceId);expectVersion(old,p.version);row=bump(c.s,'bookingService',old,{...value,history:[...(old.history??[]),structuredClone(Object.fromEntries(Object.entries(old).filter(([key])=>key!=='history')))]})}else row=put(c.s,'bookingService',value)
  event(c,command,null,row.id,{version:row.version});return row
 }
 if(command==='booking.hold'){
  const email=text(p.email,'confirmation email',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('INPUT','Provide a valid confirmation email.',null,400)
  const sourceHash=text(p.sourceHash,'booking source',64),held=rows(c.s,'appointment').filter(a=>a.status==='held'&&a.expiresAt>c.now)
  if(held.some(a=>a.email.toLowerCase()===email))fail('BOOKING_EMAIL_LIMIT','This email already has a tentative appointment. Confirm or cancel it, or wait for its hold to expire.',null,429)
  if(held.filter(a=>a.sourceHash===sourceHash).length>=3)fail('BOOKING_SOURCE_LIMIT','Too many tentative appointments from this connection. Confirm or cancel an existing hold, or wait for it to expire.',null,429)
  const service=find(c.s,'bookingService',p.serviceId),plan=available(c.s,service,p,c.now)
  if(p.consent!==true)fail('BOOKING_CONSENT','Explicitly request this appointment and its confirmation email.',null,422)
  const row=put(c.s,'appointment',{...plan,serviceId:service.id,serviceVersion:service.version,service:{name:service.name,location:service.location,timeZone:service.timeZone,skill:service.skill,durationMinutes:service.durationMinutes},name:text(p.name,'your name'),email,sourceHash,status:'held',expiresAt:new Date(Date.parse(c.now)+service.holdSeconds*1000).toISOString(),createdAt:c.now,consent:{text:'I request this appointment and its confirmation email. This does not authorize repair work or payment.',at:c.now},history:[],delivery:null})
  event(c,command,null,row.id,{status:'held',expiresAt:row.expiresAt});return row
 }
 const row=find(c.s,'appointment',p.appointmentId);expectVersion(row,p.version)
 if(command==='booking.outcome'){
  const attempt=row.deliveries?.find((x:any)=>x.id===p.deliveryId)
  if(!attempt||attempt.status!=='unconfirmed')fail('BOOKING_DELIVERY','This delivery attempt was already recorded.')
  if(!['accepted','development','failed','uncertain'].includes(p.status))fail('INPUT','Unknown mail outcome.',null,400)
  const delivery={...attempt,status:p.status,provider:text(p.provider,'provider',100),at:c.now}
  return bump(c.s,'appointment',row,{delivery,deliveries:row.deliveries.map((x:any)=>x.id===attempt.id?delivery:x)})
 }
 if(row.attendance)fail('BOOKING_ATTENDANCE','Staff have recorded attendance; contact the shop for further changes.')
 if(row.status==='canceled')fail('BOOKING_STATE','This appointment is canceled.')
 const history=[...row.history,{status:row.status,startAt:row.startAt,endAt:row.endAt,bayId:row.bayId,technicianId:row.technicianId,at:c.now}]
 if(command==='booking.cancel'){
  const next=bump(c.s,'appointment',row,{status:'canceled',canceledAt:c.now,history});event(c,command,null,row.id,{status:'canceled'});offerCanceledAppointment(c,next,false,p.verifiedActiveTechnicianIds);return next
 }
 if(command==='booking.confirm'&&(row.status!=='held'||row.expiresAt<=c.now))fail('BOOKING_EXPIRED','This tentative appointment expired. Choose a time again.')
 if(command==='booking.reschedule'&&row.status!=='confirmed')fail('BOOKING_STATE','Confirm this appointment before rescheduling.')
 const service=find(c.s,'bookingService',row.serviceId),plan=available(c.s,service,command==='booking.confirm'?{slotId:bookingSlotId(service,row)}:p,c.now,row.id)
 if(service.version!==row.serviceVersion)fail('BOOKING_CHANGED','The service changed. Choose a time again.')
 const delivery={id:crypto.randomUUID(),status:'unconfirmed',claimedAt:c.now}
 const next=bump(c.s,'appointment',row,{...plan,status:'confirmed',confirmedAt:c.now,history,delivery,deliveries:[...(row.deliveries??[]),delivery]})
 event(c,command,null,row.id,{status:'confirmed',deliveryId:delivery.id});return next
}
