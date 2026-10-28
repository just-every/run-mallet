import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type Row,type State} from './model'
import {instant} from './workshop'
import {coverageStop} from './coverage-follow-up'
import {allowedHour} from './outreach'
import {optedOut} from './approval-chasing'

export const COVERAGE_WORDING_VERSION='coverage-email-v1'
export const COVERAGE_WORDING='Please send me one email about this specific warranty check or service-contract renewal review. I may privately report a repeat symptom or withdraw this permission. This does not authorize repair work, renewal, payment or further marketing.'
export const coverageMailCommands=['coverage.consent','coverage.withdraw','coverage.approve','coverage.mailClaim','coverage.mailOutcome','coverage.mailResolve','coverage.reply','coverage.customerWithdraw','coverage.caseResolve']
export const internalCoverageCommands=['coverage.sweep','coverage.mailClaim','coverage.mailOutcome','coverage.reply','coverage.customerWithdraw']
export const coverageBasis=(r:Row)=>JSON.stringify([r.jobId,r.assetId,r.kind,r.source,r.dueAt,r.ownership])
export function coverageContent(r:Row){
 return `Your ${r.kind==='warranty'?'warranty check':'service-contract renewal review'} is due on ${r.dueAt}. Recorded coverage: ${r.source.startsAt} through ${r.source.endsAt}. These are shop-recorded terms, not independently verified coverage. Contact the shop to decide any next step. No work, contract renewal or payment is authorized.\nReport a repeat symptom or withdraw permission: [private coverage link]`
}
export function coverageMailStop(s:State,n:Record<string,any>,now:string){
 const r=rows(s,'coverageReview').find(r=>r.id===n.coverageId),consent=rows(s,'coverageConsent').find(c=>c.id===n.consentId),asset=r&&rows(s,'asset').find(a=>a.id===r.assetId)
 if(!r||!['scheduled','due'].includes(r.status)||coverageStop(s,r))return 'Coverage review stopped or ownership changed'
 if(coverageBasis(r)!==n.sourceBasis)return 'Coverage source changed'
 if(!consent||consent.withdrawnAt||consent.version!==n.consentVersion||rows(s,'coverageConsent').some(c=>c.assetId===n.assetId&&c.withdrawnAt)||optedOut(s,n.to))return 'Customer permission withdrawn or changed'
 if(!asset||asset.customerEmail?.trim().toLowerCase()!==n.to)return 'Customer recipient changed'
 if(now>=n.expiresAt)return 'Approval expired'
 return ''
}
export const coverageMail:Handler=(c,command,p)=>{
 if(!coverageMailCommands.includes(command))return
 if(!internalCoverageCommands.includes(command)&&c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages coverage follow-up.',null,403)
 if(command==='coverage.consent'){
  const r=find(c.s,'coverageReview',p.id);expectVersion(r,p.version)
  if(coverageStop(c.s,r)||!['scheduled','due'].includes(r.status))fail('COVERAGE_STOPPED','Use an active review for current ownership.')
  const asset=find(c.s,'asset',r.assetId),to=text(p.to,'current recipient',254).toLowerCase()
  if(to!==asset.customerEmail?.trim().toLowerCase()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))fail('INPUT','Use the current vehicle customer email.',null,400)
  if(p.consent!==true||p.wordingVersion!==COVERAGE_WORDING_VERSION)fail('COVERAGE_CONSENT','Record affirmative customer permission for the displayed purpose.',null,422)
  if(optedOut(c.s,to)||rows(c.s,'coverageConsent').some(c=>c.assetId===r.assetId&&c.withdrawnAt))fail('COVERAGE_WITHDRAWN','Owner approval cannot override customer withdrawal.')
  const consentedAt=instant(p.consentedAt,'customer permission time')
  if(!/(Z|[+-]\d\d:\d\d)$/.test(String(p.consentedAt))||consentedAt>c.now)fail('INPUT','Record a past permission time with an explicit UTC offset.',null,400)
  const captureChannel=text(p.captureChannel,'permission channel',100)
  if(!['customer-form','customer-email','telephone','in-person'].includes(captureChannel))fail('INPUT','Choose how the customer gave permission.',null,400)
  const row=put(c.s,'coverageConsent',{coverageId:r.id,jobId:r.jobId,assetId:r.assetId,to,purpose:'coverage-review',wording:COVERAGE_WORDING,wordingVersion:COVERAGE_WORDING_VERSION,consentedAt,consentedTime:p.consentedAt,captureChannel,sourceEvidence:text(p.sourceEvidence,'customer permission source evidence',2000),by:who(c),at:c.now})
  event(c,command,r.jobId,row.id,{});return row
 }
 if(command==='coverage.withdraw'||command==='coverage.customerWithdraw'){
  const consent=find(c.s,'coverageConsent',p.consentId);expectVersion(consent,p.version)
  if(consent.withdrawnAt)return consent
  const row=bump(c.s,'coverageConsent',consent,{withdrawnAt:c.now,withdrawal:{by:who(c),at:c.now,reason:command==='coverage.customerWithdraw'?'Customer withdrew using the private coverage link':text(p.reason,'withdrawal evidence',2000)}})
  event(c,command,consent.jobId,consent.id,{});return row
 }
 if(command==='coverage.approve'){
  const consent=find(c.s,'coverageConsent',p.consentId);expectVersion(consent,p.version)
  const r=find(c.s,'coverageReview',consent.coverageId)
  if(p.confirm!==true)fail('COVERAGE_APPROVAL','Explicitly approve the exact displayed message and recipient.',null,422)
  const timeZone=text(p.timeZone,'recipient IANA timezone',100)
  try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Choose a valid IANA timezone.',null,400)}
  const dueAt=instant(p.dueAt,'scheduled email time'),expiresAt=instant(p.expiresAt,'approval expiry'),allowedStart=integer(p.allowedStart,'first allowed hour',0,23),allowedEnd=integer(p.allowedEnd,'last allowed hour',0,23)
  if(dueAt<r.dueAt||expiresAt<=dueAt||expiresAt<=c.now||Date.parse(expiresAt)-Date.parse(c.now)>31*86400000||allowedStart===allowedEnd)fail('INPUT','Schedule no earlier than the review and expire within 31 days, with a nonempty allowed window.',null,400)
  const source={coverageId:r.id,jobId:r.jobId,assetId:r.assetId,consentId:consent.id,consentVersion:consent.version,to:consent.to,sourceBasis:coverageBasis(r),dueAt,expiresAt,timeZone,allowedStart,allowedEnd,content:coverageContent(r),templateVersion:'coverage-notice-v1'}
  if(coverageMailStop(c.s,source,c.now))fail('COVERAGE_STOPPED','Current coverage and affirmative permission are required.')
  if(rows(c.s,'coverageNotice').some(n=>n.coverageId===r.id))fail('COVERAGE_ONCE','This review already has an email approval. It cannot be resent automatically or manually.')
  const row=put(c.s,'coverageNotice',{...source,status:'pending',by:who(c),at:c.now})
  event(c,command,r.jobId,row.id,{});return row
 }
 if(command==='coverage.caseResolve'){
  const row=find(c.s,'coverageCase',p.id);expectVersion(row,p.version)
  if(row.status!=='open')fail('COVERAGE_CASE','This case has already been resolved.')
  if(coverageStop(c.s,find(c.s,'coverageReview',row.coverageId)))fail('COVERAGE_STOPPED','The review is no longer eligible.')
  const next=bump(c.s,'coverageCase',row,{status:'resolved',resolution:{reason:text(p.reason,'case result and next step',2000),by:who(c),at:c.now}})
  event(c,command,row.jobId,row.id,{});return next
 }
 const n=find(c.s,'coverageNotice',p.id);expectVersion(n,p.version)
 if(command==='coverage.mailResolve'){
  if(!['claimed','failed','uncertain'].includes(n.status)||n.resolution)fail('COVERAGE_RESOLUTION','Only an unresolved failed or uncertain handoff needs recovery.')
  const row=bump(c.s,'coverageNotice',n,{resolution:{reason:text(p.reason,'human recovery evidence',2000),by:who(c),at:c.now}})
  event(c,command,n.jobId,n.id,{});return row
 }
 if(command==='coverage.mailClaim'){
  if(n.status!=='pending')fail('COVERAGE_ONCE','The email was already claimed.')
  const stop=coverageMailStop(c.s,n,c.now)
  if(stop){const row=bump(c.s,'coverageNotice',n,{status:'stopped',stopReason:stop,stoppedAt:c.now});event(c,command,n.jobId,n.id,{status:'stopped'});return row}
  if(n.dueAt>c.now||!allowedHour(c.now,n.timeZone,n.allowedStart,n.allowedEnd))fail('COVERAGE_NOT_DUE','The email is outside its scheduled recipient window.')
  const row=bump(c.s,'coverageNotice',n,{status:'claimed',claimedAt:c.now});event(c,command,n.jobId,n.id,{status:'claimed'});return row
 }
 if(command==='coverage.mailOutcome'){
  if(n.status!=='claimed')fail('COVERAGE_OUTCOME','The handoff outcome was already recorded.')
  if(!['accepted','development','failed','uncertain','stopped'].includes(p.status))fail('INPUT','Invalid handoff outcome.',null,400)
  const row=bump(c.s,'coverageNotice',n,{status:p.status,provider:text(p.provider,'provider',100),providerReference:text(p.providerReference,'provider reference',1024,true),outcomeAt:c.now,replyExpiresAt:new Date(Math.min(Date.parse(n.expiresAt),Date.parse(c.now)+7*86400000)).toISOString()})
  event(c,command,n.jobId,n.id,{status:p.status});return row
 }
 if(coverageMailStop(c.s,n,c.now)||!['accepted','development'].includes(n.status))fail('COVERAGE_UNAVAILABLE','This response link is unavailable.',null,404)
 const existing=rows(c.s,'coverageCase').find(r=>r.noticeId===n.id)
 if(existing)return existing
 const row=put(c.s,'coverageCase',{coverageId:n.coverageId,noticeId:n.id,jobId:n.jobId,assetId:n.assetId,status:'open',symptom:text(p.symptom,'reported repeat symptom',4000),source:'private-customer-link',reportedAt:c.now,by:who(c),at:c.now})
 event(c,command,n.jobId,row.id,{noticeId:n.id,originalJobId:n.jobId});return row
}
