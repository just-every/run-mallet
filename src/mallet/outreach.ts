import {APPOINTMENT_TEMPLATE,appointmentApprovalStop,appointmentContent,currentAppointmentConsent,recordAppointmentConsent,withdrawAppointmentConsent} from './outreach-consent'
import {optedOut} from './approval-chasing'
import {balanceReminderReview,balanceReminderContent} from './receivables'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State} from './model'
import {instant} from './workshop'
import {readings} from './mileage'
export const outreachCommands=['outreach.consent','outreach.withdraw','outreach.prepare','outreach.approve','outreach.resolve','outreach.schedule','outreach.stop','outreach.claim','outreach.outcome']
export const internalOutreachCommands=['outreach.claim','outreach.outcome']
export function allowedHour(at:string,zone:string,start:number,end:number){
 let hour:number;try{hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',hourCycle:'h23'}).format(new Date(at)))}catch{return false}
 if(start===end)return false
 return start<end?hour>=start&&hour<end:hour>=start||hour<end
}
export function outreachStop(s:State,r:any,now:string):string{
 if(r.stoppedAt)return r.stopReason
 if(now>=r.expiresAt)return 'Expired'
 if(r.kind==='appointment'){
  const approvalStop=appointmentApprovalStop(s,r);if(approvalStop)return approvalStop
  const a=rows(s,'appointment').find(a=>a.id===r.subjectId)
  if(!a||a.status!=='confirmed'||a.startAt!==r.startAt||a.email!==r.to||a.service.timeZone!==r.shopZone)return 'Appointment canceled or replaced'
  if(now>=a.startAt)return 'Appointment already started'
 }else if(r.kind==='balance'){
  if(optedOut(s,r.to))return 'Automatic reminders opted out'
  try{const review=balanceReminderReview(s,{id:r.by.id},{...r.review,version:r.invoiceVersion},now);if(review.contact.version!==r.contactVersion||review.terms.id!==r.termsId||review.item.terms?.id!==r.assignmentId||balanceReminderContent(review.invoice,review.item)!==r.content)return 'Balance changed'}catch{return 'Balance, terms, consent preference, dispute or promise changed'}
 }else{
  const item=rows(s,'declinedWork').find(i=>i.id===r.subjectId),q=rows(s,'estimate').find(q=>q.id===r.estimateId)
  if(item?.inapplicable)return 'Finding no longer applicable'
  if(item&&r.knownJobIds&&rows(s,'job').some(j=>j.assetId===item.assetId&&!r.knownJobIds.includes(j.id)))return 'Vehicle booked for a later visit'
  if(!item||item.version!==r.itemVersion||!q||q.version!==r.quoteVersion||q.status!=='approved'||q.authorisation)return 'Declined work or refreshed quote changed'
  if(item.proposals.some((p:any)=>{const quote=rows(s,'estimate').find(q=>q.id===p.estimateId);return !!quote?.authorisation}))return 'Accepted or declined again'
  const asset=rows(s,'asset').find(a=>a.id===item.assetId)
  if(!asset||asset.customerEmail!==r.to)return 'Customer contact changed'
 }
 return ''
}
export function outreachDue(s:State,r:any,now:string){
 if(r.dueAt>now||!allowedHour(now,r.timeZone,r.allowedStart,r.allowedEnd))return false
 if(r.kind==='declined'){
  const item=find(s,'declinedWork',r.subjectId),latest=readings(s,item.assetId).filter(x=>x.unit===item.unit).at(-1)
  return !!(item.dueDate&&now.slice(0,10)>=item.dueDate||item.dueValue!==null&&latest&&latest.value>=item.dueValue)
 }
 return true
}
export const outreach:Handler=(c,command,p)=>{
 if(!outreachCommands.includes(command))return
 if(!internalOutreachCommands.includes(command)&&c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages customer outreach.',null,403)
 if(command==='outreach.consent')return recordAppointmentConsent(c,p)
 if(command==='outreach.withdraw')return withdrawAppointmentConsent(c,p)
 if(command==='outreach.prepare'){
  const {consent,a,source}=currentAppointmentConsent(c.s,p.consentId,p.subjectId);expectVersion(a,p.version);expectVersion(consent,p.consentVersion)
  if(rows(c.s,'outreach').some(r=>r.kind==='appointment'&&r.subjectId===a.id&&(r.status==='claimed'||['draft','pending'].includes(r.status)&&!r.stoppedAt||['failed','uncertain'].includes(r.status)&&!r.resolution)))fail('OUTREACH_RECOVERY','Stop the active email or record a human resolution before preparing another attempt.')
  const dueAt=instant(p.dueAt,'due time'),expiresAt=instant(p.expiresAt,'expiry'),timeZone=text(p.timeZone,'recipient IANA timezone',100),allowedStart=integer(p.allowedStart,'first allowed hour',0,23),allowedEnd=integer(p.allowedEnd,'last allowed hour',0,23)
  try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Choose a valid IANA timezone.',null,400)}
  if(allowedStart===allowedEnd||expiresAt<=dueAt||expiresAt<=c.now||expiresAt>a.startAt||dueAt>=a.startAt||Date.parse(expiresAt)-Date.parse(c.now)>31*86400000)fail('INPUT','Choose a nonempty window and expiry before the appointment, within 31 elapsed days.',null,400)
  const instructions=text(p.instructions,'pre-visit instructions',2000)
  const row=put(c.s,'outreach',{kind:'appointment',subjectId:a.id,startAt:a.startAt,shopZone:a.service.timeZone,to:a.email,source,consentId:consent.id,consentVersion:consent.version,consentEvidence:consent.sourceEvidence,content:appointmentContent(a,instructions),instructions,templateVersion:APPOINTMENT_TEMPLATE,dueAt,expiresAt,timeZone,allowedStart,allowedEnd,by:who(c),at:c.now,status:'draft',policy:'one-approved-appointment-email-v2'})
  event(c,command,null,row.id,{subjectId:a.id,consentId:consent.id});return row
 }
 if(command==='outreach.approve'){
  const row=find(c.s,'outreach',p.id);expectVersion(row,p.version)
  if(row.kind!=='appointment'||row.status!=='draft'||p.confirm!==true)fail('OUTREACH_APPROVAL','Explicitly approve the exact prepared email revision.',null,422)
  const approval={by:who(c),at:c.now,preparedVersion:row.version,policy:row.policy}
  const stop=outreachStop(c.s,{...row,approval},c.now)
  if(stop)fail('OUTREACH_CHANGED',stop)
  const next=bump(c.s,'outreach',row,{approval,status:'pending'})
  event(c,command,null,row.id,{preparedVersion:row.version,consentId:row.consentId});return next
 }
 if(command==='outreach.schedule'){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner approves customer outreach.',null,403)
  if(p.kind==='appointment')fail('OUTREACH_APPROVAL','Record purpose-specific consent, prepare the exact email, then explicitly approve it.',null,422)
  if(p.consent!==true)fail('OUTREACH_CONSENT','Record explicit customer email consent.',null,422)
  const kind=p.kind;if(!['appointment','declined','balance'].includes(kind))fail('INPUT','Choose appointment or declined work.',null,400)
  const timeZone=text(p.timeZone,'recipient IANA timezone',100)
  try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Choose a valid IANA timezone.',null,400)}
  const dueAt=instant(p.dueAt,'due time'),expiresAt=instant(p.expiresAt,'expiry'),allowedStart=integer(p.allowedStart,'first allowed hour',0,23),allowedEnd=integer(p.allowedEnd,'last allowed hour',0,23)
  if(allowedStart===allowedEnd||expiresAt<=dueAt||expiresAt<=c.now||Date.parse(expiresAt)-Date.parse(c.now)>31*86400000)fail('INPUT','Choose a nonempty allowed-hours window and expiry within 31 days.',null,400)
  let source:any
  if(kind==='appointment'){
   const a=find(c.s,'appointment',p.subjectId);expectVersion(a,p.version)
   if(a.status!=='confirmed'||dueAt>=a.startAt||expiresAt>a.startAt)fail('INPUT','Reminders must expire before the confirmed appointment starts.',null,400)
   source={subjectId:a.id,startAt:a.startAt,shopZone:a.service.timeZone,to:a.email}
  }else if(kind==='balance'){
   const review={...p,invoiceId:p.subjectId,confirm:'send-balance-reminder',reference:crypto.randomUUID(),evidence:p.consentEvidence}
   if(optedOut(c.s,String(p.to)))fail('AR_SUPPRESSED','Automatic reminders are opted out.')
   const checked=balanceReminderReview(c.s,c.actor,review,c.now)
   source={subjectId:checked.invoice.id,invoiceVersion:checked.invoice.version,contactVersion:checked.contact.version,termsId:checked.terms.id,assignmentId:checked.item.terms!.id,to:checked.contact.email,content:balanceReminderContent(checked.invoice,checked.item),review:{invoiceId:checked.invoice.id,to:checked.contact.email,outstandingCents:checked.item.balance.outstandingCents,consent:true,confirm:'send-balance-reminder'},policy:'one-approved-balance-email-v1'}
  }else{
   const item=find(c.s,'declinedWork',p.subjectId);expectVersion(item,p.version)
   if(item.inapplicable)fail('OUTREACH_STOP','This finding no longer applies.')
   const q=find(c.s,'estimate',p.estimateId);expectVersion(q,p.quoteVersion)
   if(q.status!=='approved'||q.authorisation||!item.proposals.some((x:any)=>x.estimateId===q.id))fail('INPUT','Approve the exact refreshed declined-work quote first.',null,400)
   if(p.availabilityConfirmed!==true)fail('INPUT','Explicitly review current price and availability.',null,422)
   const asset=find(c.s,'asset',item.assetId)
   source={knownJobIds:rows(c.s,'job').filter(j=>j.assetId===item.assetId).map(j=>j.id),subjectId:item.id,itemVersion:item.version,estimateId:q.id,quoteVersion:q.version,to:asset.customerEmail,totalCents:q.revisions.at(-1).totals.totalCents,urgency:text(p.urgency,'urgency',200),availabilityEvidence:text(p.availabilityEvidence,'availability evidence',2000)}
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source.to??''))fail('INPUT','A current customer email is required.',null,400)
  if(rows(c.s,'outreach').some(r=>r.subjectId===source.subjectId&&['pending','claimed'].includes(r.status)&&!r.stoppedAt))fail('OUTREACH_ACTIVE','Stop the existing follow-up before scheduling another.')
  const row=put(c.s,'outreach',{...source,kind,dueAt,expiresAt,timeZone,allowedStart,allowedEnd,instructions:text(p.instructions,'pre-visit or follow-up instructions',2000),consentEvidence:text(p.consentEvidence,'customer email consent evidence',2000),by:who(c),at:c.now,status:'pending'})
  event(c,command,null,row.id,{kind,subjectId:row.subjectId});return row
 }
 const row=find(c.s,'outreach',p.id);expectVersion(row,p.version)
 if(command==='outreach.resolve'){
  if(!['failed','uncertain'].includes(row.status)||row.resolution)fail('OUTREACH_RESOLUTION','Only an unresolved failed or uncertain handoff needs resolution.')
  const next=bump(c.s,'outreach',row,{resolution:{reason:text(p.reason,'staff resolution evidence',2000),by:who(c),at:c.now}})
  event(c,command,null,row.id,{status:row.status});return next
 }
 if(command==='outreach.stop'){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner stops outreach.',null,403)
  const reason=text(p.reason,'stop reason',2000),next=bump(c.s,'outreach',row,{stoppedAt:c.now,stopReason:reason,stoppedBy:who(c),status:['draft','pending'].includes(row.status)?'stopped':row.status})
  event(c,command,null,row.id,{reason});return next
 }
 if(command==='outreach.claim'){
  if(row.status!=='pending')fail('OUTREACH_CLAIM','Already claimed.')
  const stop=outreachStop(c.s,row,c.now)
  if(stop)return bump(c.s,'outreach',row,{status:'stopped',stopReason:stop,stoppedAt:c.now})
  if(!outreachDue(c.s,row,c.now))fail('OUTREACH_NOT_DUE','Not yet eligible.')
  const next=bump(c.s,'outreach',row,{status:'claimed',claimedAt:c.now});event(c,command,null,row.id,{approvalVersion:row.approval?.preparedVersion??null});return next
 }
 if(row.status!=='claimed')fail('OUTREACH_OUTCOME','Already recorded.')
 if(!['accepted','development','failed','uncertain','skipped'].includes(p.status))fail('INPUT','Invalid delivery outcome.',null,400)
 const next=bump(c.s,'outreach',row,{status:p.status,provider:text(p.provider,'provider',100),providerReference:text(p.providerReference,'provider reference',1024,true),outcomeAt:c.now});event(c,command,null,row.id,{status:p.status});return next
}
