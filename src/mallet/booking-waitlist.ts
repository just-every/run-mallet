import {mailboxOwnerIds} from './mailbox-identity'
import {bookings,bookingSlots,bookingSlotId} from './bookings'
import {instant} from './workshop'
import {bump,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type Row} from './model'

export const waitlistCommands=['waitlist.add','waitlist.withdraw','waitlist.advance','waitlist.sendOffer','waitlist.offerClaim','waitlist.offerOutcome']
export const internalWaitlistCommands=['waitlist.offerClaim','waitlist.offerOutcome']
const staff=(c:Context)=>{if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or service advisor manages the waitlist.',null,403)}

/** Runs inside the cancellation transaction: the reservation and queue decision commit together. */
export function offerCanceledAppointment(c:Context,canceled:Row,advance=false,verifiedActiveTechnicianIds?:string[]):Row|null{
 if(canceled.status!=='canceled'||!verifiedActiveTechnicianIds?.includes(canceled.technicianId))return null
 const previous=rows(c.s,'waitlistOffer').filter(x=>x.triggerAppointmentId===canceled.id)
 // Expiry never advances the queue by itself. An advisor explicitly advances this cancellation.
 if(previous.length&&!advance)return null
 if(previous.some(x=>{const a=rows(c.s,'appointment').find(a=>a.id===x.appointmentId);return a?.status==='confirmed'||a?.status==='held'&&a.expiresAt>c.now}))return null
 const service=rows(c.s,'bookingService').find(x=>x.id===canceled.serviceId)
 if(!service)return null
 const plan=bookingSlots(c.s,service,c.now).find(x=>x.startAt===canceled.startAt&&x.endAt===canceled.endAt&&x.bayId===canceled.bayId&&x.technicianId===canceled.technicianId)
 if(!plan)return null
 const held=rows(c.s,'appointment').filter(a=>a.status==='held'&&a.expiresAt>c.now)
 const entry=rows(c.s,'bookingWaitlist').filter(x=>x.status==='waiting'&&x.serviceId===service.id&&x.earliestAt<=plan.startAt&&x.latestAt>=plan.endAt)
  .sort((a,b)=>a.sequence-b.sequence||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))
  .find(x=>!held.some(a=>a.email.toLowerCase()===x.email)&&held.filter(a=>a.sourceHash===x.sourceHash).length<3)
 if(!entry)return null
 // Reuse the ordinary reservation reducer, including its capacity and abuse limits.
 const appointment=bookings(c,'booking.hold',{serviceId:service.id,slotId:bookingSlotId(service,plan),name:entry.name,email:entry.email,sourceHash:entry.sourceHash,consent:true})
 const offer=put(c.s,'waitlistOffer',{entryId:entry.id,triggerAppointmentId:canceled.id,appointmentId:appointment.id,createdAt:c.now,expiresAt:appointment.expiresAt,delivery:{id:crypto.randomUUID(),status:'pending'},by:who(c)})
 bump(c.s,'appointment',appointment,{waitlistEntryId:entry.id,waitlistOfferId:offer.id,mailboxOwnerIds:entry.mailboxOwnerIds??appointment.mailboxOwnerIds})
 bump(c.s,'bookingWaitlist',entry,{status:'offered',offerId:offer.id,offeredAt:c.now})
 event(c,'waitlist.offered',null,entry.id,{offerId:offer.id,appointmentId:appointment.id,expiresAt:appointment.expiresAt})
 return offer
}

export const bookingWaitlist:Handler=(c,command,p)=>{
 if(!waitlistCommands.includes(command))return
 if(!internalWaitlistCommands.includes(command))staff(c)
 if(command==='waitlist.add'){
  const service=find(c.s,'bookingService',p.serviceId),email=text(p.email,'customer email',254).toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('INPUT','Provide a valid customer email.',null,400)
  const earliestAt=instant(p.earliestAt,'earliest appointment time'),latestAt=instant(p.latestAt,'latest appointment end')
  if(latestAt<=earliestAt||latestAt<=c.now||Date.parse(latestAt)-Date.parse(earliestAt)>366*86400000)fail('INPUT','Choose a future appointment interval no longer than one year.',null,400)
  if(p.consent!==true)fail('WAITLIST_CONSENT','Record the customer’s explicit request for a cancellation offer email.',null,422)
  if(rows(c.s,'bookingWaitlist').some(x=>x.serviceId===service.id&&x.email===email&&x.status==='waiting'))fail('WAITLIST_DUPLICATE','This customer is already waiting for this service.')
  const sequence=Math.max(0,...rows(c.s,'bookingWaitlist').map(x=>x.sequence))+1
  const row=put(c.s,'bookingWaitlist',{serviceId:service.id,name:text(p.name,'customer name'),email,mailboxOwnerIds:mailboxOwnerIds(c.s,email),earliestAt,latestAt,timeZone:service.timeZone,sourceHash:text(p.sourceHash,'request source',64),sequence,status:'waiting',createdAt:c.now,by:who(c),consent:{at:c.now,recordedBy:who(c),evidence:text(p.evidence,'customer request evidence',1000),text:'The customer requests a cancellation offer email for this service and date interval. No repair work or payment is authorized.'}})
  event(c,command,null,row.id,{serviceId:service.id,sequence});return row
 }
 if(command==='waitlist.withdraw'){
  const row=find(c.s,'bookingWaitlist',p.waitlistId);expectVersion(row,p.version)
  if(row.status!=='waiting')fail('WAITLIST_STATE','Only a waiting request can be withdrawn. Cancel an offered reservation through its booking link.')
  const next=bump(c.s,'bookingWaitlist',row,{status:'withdrawn',withdrawnAt:c.now,withdrawnBy:who(c)})
  event(c,command,null,row.id,{});return next
 }
 if(command==='waitlist.advance'){
  const canceled=find(c.s,'appointment',p.appointmentId);expectVersion(canceled,p.version)
  if(canceled.status!=='canceled')fail('WAITLIST_STATE','Select a canceled appointment to offer its released time.')
  const offer=offerCanceledAppointment(c,canceled,true,p.verifiedActiveTechnicianIds)
  if(!offer)fail('WAITLIST_UNAVAILABLE','No eligible customer or free capacity is available, or this cancellation still has a live offer.')
  return offer
 }
 const offer=find(c.s,'waitlistOffer',p.offerId);expectVersion(offer,p.version)
 if(command==='waitlist.offerClaim'){
  const appointment=find(c.s,'appointment',offer.appointmentId)
  if(offer.delivery.status!=='pending'||appointment.status!=='held'||appointment.expiresAt<=c.now)fail('WAITLIST_DELIVERY','This offer cannot be sent again.')
  const next=bump(c.s,'waitlistOffer',offer,{delivery:{...offer.delivery,status:'unconfirmed',claimedAt:c.now}})
  event(c,command,null,offer.id,{deliveryId:offer.delivery.id});return next
 }
 if(offer.delivery.status!=='unconfirmed'||p.deliveryId!==offer.delivery.id)fail('WAITLIST_DELIVERY','This delivery outcome was already recorded.')
 if(!['accepted','development','failed','uncertain','rate_limited'].includes(p.status))fail('INPUT','Unknown offer email outcome.',null,400)
 const next=bump(c.s,'waitlistOffer',offer,{delivery:{...offer.delivery,status:p.status,provider:text(p.provider,'mail provider',100),at:c.now}})
 event(c,command,null,offer.id,{status:p.status});return next
}
