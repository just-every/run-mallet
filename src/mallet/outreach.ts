import {declinedOutreachCommand,currentDeclinedConsent,declinedAvailabilityStop,declinedCustomer,DECLINED_POLICY,declinedContent} from './declined-outreach'
import {optedOut} from './approval-chasing'
import {balanceReminderReview,balanceReminderContent} from './receivables'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State} from './model'
import {instant} from './workshop'
import {readings} from './mileage'
export const outreachCommands=['outreach.schedule','outreach.stop','outreach.claim','outreach.outcome','outreach.consent','outreach.withdraw','outreach.availability','outreach.resolve']
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
  if(!asset||JSON.stringify(declinedCustomer(asset,s))!==JSON.stringify(r.customer))return 'Customer contact changed'
  try{const consent=rows(s,'declinedConsent').find(x=>x.id===r.consentId);currentDeclinedConsent(s,consent,item);if(consent?.version!==r.consentVersion)return 'Customer permission changed'}catch{return 'Customer permission missing or withdrawn'}
  const availability=declinedAvailabilityStop(s,r,now);if(availability)return availability
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
 const reviewed=declinedOutreachCommand(c,command,p);if(reviewed!==undefined)return reviewed
 if(command==='outreach.schedule'){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner approves customer outreach.',null,403)
  if((p.kind==='declined'?p.approved:p.consent)!==true)fail('OUTREACH_CONSENT','Record explicit customer email consent.',null,422)
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
   const consent=find(c.s,'declinedConsent',p.consentId);expectVersion(consent,p.consentVersion)
   if(rows(c.s,'outreach').some(r=>r.consentId===consent.id&&['accepted','development','claimed','uncertain'].includes(r.status)))fail('OUTREACH_CONSENT','That one-email permission has already been used. Record a new affirmative customer permission.')
   const asset=currentDeclinedConsent(c.s,consent,item),review=find(c.s,'declinedAvailability',p.availabilityId);expectVersion(review,p.availabilityVersion)
   if(review.subjectId!==item.id||review.estimateId!==q.id||review.quoteVersion!==q.version)fail('OUTREACH_AVAILABILITY','Review availability for this exact refreshed quote.')
   const stop=declinedAvailabilityStop(c.s,{subjectId:item.id,estimateId:q.id,availabilityId:review.id,availabilityVersion:review.version},c.now)
   if(stop||expiresAt>review.expiresAt)fail('OUTREACH_AVAILABILITY',stop||'Email authority must expire by the availability evidence expiry.')
   if(rows(c.s,'outreach').some(r=>r.kind==='declined'&&r.subjectId===item.id&&['failed','uncertain'].includes(r.status)&&!r.resolution))fail('OUTREACH_RESOLUTION','Record human resolution before a fresh approval after a failed or uncertain handoff.')
   source={knownJobIds:rows(c.s,'job').filter(j=>j.assetId===item.assetId).map(j=>j.id),subjectId:item.id,assetId:asset.id,jobId:q.jobId,customer:declinedCustomer(asset,c.s),itemVersion:item.version,estimateId:q.id,quoteVersion:q.version,quote:structuredClone(q.revisions.at(-1)),to:consent.to,totalCents:q.revisions.at(-1).totals.totalCents,urgency:text(p.urgency,'urgency',200),consentId:consent.id,consentVersion:consent.version,consentSnapshot:structuredClone(consent),availabilityId:review.id,availabilityVersion:review.version,availabilitySnapshot:structuredClone(review),consentEvidence:consent.sourceEvidence,templateVersion:'declined-follow-up-v1',policy:DECLINED_POLICY,content:declinedContent(text(p.instructions,'follow-up instructions',2000),q.revisions.at(-1).totals.totalCents)}
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source.to??''))fail('INPUT','A current customer email is required.',null,400)
  if(rows(c.s,'outreach').some(r=>r.subjectId===source.subjectId&&['pending','claimed'].includes(r.status)&&!r.stoppedAt))fail('OUTREACH_ACTIVE','Stop the existing follow-up before scheduling another.')
  const row=put(c.s,'outreach',{...source,kind,dueAt,expiresAt,timeZone,allowedStart,allowedEnd,instructions:text(p.instructions,'pre-visit or follow-up instructions',2000),consentEvidence:source.consentEvidence??text(p.consentEvidence,'customer email consent evidence',2000),by:who(c),at:c.now,status:'pending'})
  event(c,command,null,row.id,{kind,subjectId:row.subjectId});return row
 }
 const row=find(c.s,'outreach',p.id);expectVersion(row,p.version)
 if(command==='outreach.stop'){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner stops outreach.',null,403)
  if(row.kind==='declined'&&p.stopKind==='opt-out')declinedOutreachCommand(c,'outreach.withdraw',{consentId:row.consentId,version:find(c.s,'declinedConsent',row.consentId).version,evidence:p.reason})
  const reason=text(p.reason,'stop reason',2000),next=bump(c.s,'outreach',find(c.s,'outreach',row.id),{stoppedBy:who(c),stoppedAt:c.now,stopReason:reason,status:row.status==='pending'?'stopped':row.status})
  event(c,command,null,row.id,{reason});return next
 }
 if(command==='outreach.claim'){
  if(row.status!=='pending')fail('OUTREACH_CLAIM','Already claimed.')
  const stop=outreachStop(c.s,row,c.now)
  if(stop)return bump(c.s,'outreach',row,{status:'stopped',stopReason:stop,stoppedAt:c.now})
  if(!outreachDue(c.s,row,c.now))fail('OUTREACH_NOT_DUE','Not yet eligible.')
  const next=bump(c.s,'outreach',row,{status:'claimed',claimedAt:c.now});event(c,command,row.jobId??null,row.id,{});return next
 }
 if(row.status!=='claimed')fail('OUTREACH_OUTCOME','Already recorded.')
 if(!['accepted','development','failed','uncertain','skipped'].includes(p.status))fail('INPUT','Invalid delivery outcome.',null,400)
 const next=bump(c.s,'outreach',row,{status:p.status,provider:text(p.provider,'provider',100),providerReference:text(p.providerReference,'provider reference',1024,true),outcomeReason:text(p.reason,'handoff stop reason',2000,true),outcomeAt:c.now});event(c,command,row.jobId??null,row.id,{status:p.status});return next
}
