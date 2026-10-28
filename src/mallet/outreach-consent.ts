import {appointmentReminderStep,currentReminderStep} from './appointment-reminder-policy'
import {createHash} from 'node:crypto'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type State} from './model'
import {instant} from './workshop'
import {shopTime} from './promise-zone'

export const APPOINTMENT_TEMPLATE='appointment-email-v2'
export const APPOINTMENT_LINK='[private appointment management link]'
export const APPOINTMENT_WORDING_VERSION='appointment-permission-v1'
export const appointmentWording={
 'appointment-reminder':'Please send me one email reminder, including pre-visit instructions, for this appointment. This does not permit declined-work follow-up or promotional messages.',
 'appointment-confirmation':'Please send me the confirmation of this appointment only. This does not permit later reminders or pre-visit instructions.'
}
export function appointmentHours(p:any){
 const timeZone=text(p.timeZone,'recipient IANA timezone',100),allowedStart=integer(p.allowedStart,'first allowed hour',0,23),allowedEnd=integer(p.allowedEnd,'last allowed hour',0,23)
 if(timeZone!=='UTC'&&!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(timeZone))fail('INPUT','Record an IANA timezone rather than an offset or abbreviation.',null,400)
 try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Choose a valid recipient IANA timezone.',null,400)}
 if(allowedStart===allowedEnd)fail('INPUT','Equal hours grant no reminder send window.',null,400)
 return {timeZone,allowedStart,allowedEnd}
}
export const recipientHash=(to:string)=>createHash('sha256').update('appointment-service:'+to.trim().toLowerCase()).digest('hex')
export function appointmentSource(s:State,id:unknown){
 const a=find(s,'appointment',id)
 if(a.status!=='confirmed'||a.privacyErasedAt)fail('OUTREACH_ELIGIBILITY','A current confirmed appointment with an unerased customer is required.')
 const service=find(s,'bookingService',a.serviceId)
 const contacts=rows(s,'contact').filter(c=>c.email?.trim().toLowerCase()===a.email)
 const erased=contacts.some(c=>c.privacyErasedAt)||rows(s,'asset').some(x=>x.customerEmail?.trim().toLowerCase()===a.email&&x.privacyErasedAt)
 if(erased)fail('OUTREACH_ERASED','Customer erasure prevents outreach.')
 const source={appointmentVersion:a.version,serviceVersion:service.version,contactVersions:contacts.map(c=>({id:c.id,version:c.version})).sort((a,b)=>a.id.localeCompare(b.id))}
 return {a,source}
}
export function appointmentSuppressed(s:State,to:string){return rows(s,'outreachSuppression').some(r=>r.recipientHash===recipientHash(to))}
export function currentAppointmentConsent(s:State,id:unknown,subjectId:unknown){
 const consent=find(s,'outreachConsent',id),{a,source}=appointmentSource(s,subjectId)
 if(consent.subjectId!==a.id||consent.to!==a.email||consent.channel!=='email'||consent.purpose!=='appointment-reminder'||consent.wordingVersion!==APPOINTMENT_WORDING_VERSION||consent.withdrawnAt||consent.erasedAt||appointmentSuppressed(s,a.email))fail('OUTREACH_CONSENT','Current affirmative permission for this appointment reminder is required. Owner approval cannot override withdrawal.',null,422)
 if(consent.step)currentReminderStep(s,consent.step)
 if(!consent.preference)fail('OUTREACH_CONSENT','Record the recipient timezone and allowed hours with current customer permission.',null,422)
 if(rows(s,'outreach').some(r=>r.consentId===consent.id&&r.status==='accepted'))fail('OUTREACH_CONSENT','This one-email permission was already used. Record new affirmative customer permission.',null,422)
 return {consent,a,source}
}
export function appointmentContent(a:any,instructions:string){return `${a.service.name}\n${a.service.location}\n${shopTime(a.startAt,a.service.timeZone)} · ${a.service.timeZone}\n${instructions}\nReschedule or cancel: ${APPOINTMENT_LINK}\nNo repair work or payment is authorized.`}
export function appointmentApprovalStop(s:State,r:any){
 if(rows(s,'outreach').some(other=>other.id!==r.id&&other.kind==='appointment'&&other.subjectId===r.subjectId&&['failed','uncertain'].includes(other.status)&&!other.resolution))return 'Previous appointment email requires human resolution'
 if(!r.approval||r.templateVersion!==APPOINTMENT_TEMPLATE)return 'Exact owner approval required'
 try{
  const {consent,a,source}=currentAppointmentConsent(s,r.consentId,r.subjectId)
  if(consent.preference.timeZone!==r.timeZone||consent.preference.allowedStart!==r.allowedStart||consent.preference.allowedEnd!==r.allowedEnd||consent.version!==r.consentVersion||JSON.stringify(source)!==JSON.stringify(r.source)||a.email!==r.to||appointmentContent(a,r.instructions)!==r.content)return 'Appointment, contact, consent or template revision changed'
 }catch{return 'Customer consent, withdrawal or appointment eligibility changed'}
 return ''
}
export function recordAppointmentConsent(c:Context,p:any){
 const {a}=appointmentSource(c.s,p.subjectId);expectVersion(a,p.version)
 if(p.consent!==true||p.wordingVersion!==APPOINTMENT_WORDING_VERSION||!Object.hasOwn(appointmentWording,p.purpose))fail('OUTREACH_CONSENT','Record affirmative customer permission for the displayed purpose and wording.',null,422)
 if(p.to!==a.email||appointmentSuppressed(c.s,a.email))fail('OUTREACH_WITHDRAWN','Use the current recipient. Withdrawal prevents renewed owner approval.',null,422)
 const consentedAt=instant(p.consentedAt,'customer permission time with UTC offset')
 if(!/(Z|[+-]\d\d:\d\d)$/.test(String(p.consentedAt))||consentedAt>c.now)fail('INPUT','Record a past customer permission time with an explicit UTC offset.',null,400)
 const captureChannel=text(p.captureChannel,'capture channel',100)
 if(!['customer-form','customer-email','telephone','in-person'].includes(captureChannel))fail('INPUT','Choose the source of the customer’s permission.',null,400)
 const preference=appointmentHours(p),step=appointmentReminderStep(c.s,p.stepIndex)
 const row=put(c.s,'outreachConsent',{preference,step,subjectId:a.id,customerName:a.name,to:a.email,channel:'email',purpose:p.purpose,wording:appointmentWording[p.purpose as keyof typeof appointmentWording],wordingVersion:APPOINTMENT_WORDING_VERSION,consentedAt,consentedTime:p.consentedAt,captureChannel,sourceEvidence:text(p.sourceEvidence,'permission evidence reference',2000),by:who(c),at:c.now,policy:'appointment-consent-v2'})
 event(c,'outreach.consent',null,row.id,{subjectId:a.id});return row
}
export function withdrawAppointmentOutreach(c:Context,a:any,reason:string){
 if(appointmentSuppressed(c.s,a.email))return {suppressed:true,subjectId:a.id}
 for(const consent of rows(c.s,'outreachConsent').filter(r=>r.to===a.email&&!r.withdrawnAt))bump(c.s,'outreachConsent',consent,{withdrawnAt:c.now,withdrawal:{reason,by:who(c),at:c.now}})
 const suppression=put(c.s,'outreachSuppression',{recipientHash:recipientHash(a.email),subjectId:a.id,by:who(c),at:c.now,reason,policy:'appointment-withdrawal-v1'})
 for(const r of rows(c.s,'outreach').filter(r=>r.kind==='appointment'&&r.to===a.email&&['draft','pending','claimed'].includes(r.status)&&!r.stoppedAt))bump(c.s,'outreach',r,{status:r.status==='claimed'?'claimed':'stopped',stoppedAt:c.now,stopReason:'Customer withdrew appointment email permission',stoppedBy:who(c)})
 event(c,'outreach.withdraw',null,suppression.id,{subjectId:a.id});return {suppressed:true,subjectId:a.id}
}
export function withdrawAppointmentConsent(c:Context,p:any){
 const consent=find(c.s,'outreachConsent',p.consentId);expectVersion(consent,p.version)
 if(consent.withdrawnAt)return consent
 withdrawAppointmentOutreach(c,find(c.s,'appointment',consent.subjectId),text(p.reason,'customer withdrawal evidence',2000))
 return find(c.s,'outreachConsent',consent.id)
}
