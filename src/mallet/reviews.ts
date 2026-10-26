import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State} from './model'
import {instant} from './workshop'
import {optedOut} from './approval-chasing'

export const REVIEW_WORDING_VERSION='review-email-v1'
export const REVIEW_WORDING='Please send me one email about this collected repair, inviting me to leave an optional Google review and private satisfaction feedback. Either choice is available regardless of my rating. My private feedback goes to the shop owner and is not published. This does not authorize further marketing.'
export const reviewCommands=['review.consent','review.withdraw','review.send','review.outcome','review.respond','review.customerWithdraw','review.resolve']
export const internalReviewCommands=['review.outcome','review.respond','review.customerWithdraw']
export function paidHandover(s:State,jobId:string){
 const job=find(s,'job',jobId),asset=find(s,'asset',job.assetId)
 const collection=rows(s,'flow').find(f=>f.jobId===job.id)?.collection
 const handover=rows(s,'handover').find(h=>h.jobId===job.id&&h.id===collection?.handoverId)
 const settlement=handover?.settlement,total=handover?.invoice?.totals?.totalCents
 if(!handover||!['completed','invoiced'].includes(job.status)||!total||settlement.override||settlement.accountTerms||settlement.verifiedCents+(settlement.tender?.recordedCents??0)<total)fail('REVIEW_COLLECTION','A paid documented collection is required. Unpaid exceptions, account terms and no-charge visits are ineligible.')
 if(asset.privacyErasedAt)fail('REVIEW_ERASED','This customer profile was erased.')
 return {job,asset,handover}
}
export function googleReviewUrl(value:unknown){
 const raw=text(value,'Google Business Profile review URL',2000)
 let url:URL;try{url=new URL(raw)}catch{fail('INPUT','Enter an HTTPS Google review link.',null,400)}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!['google.com','www.google.com','maps.google.com','search.google.com','g.page','maps.app.goo.gl'].includes(url.hostname))fail('INPUT','Enter an HTTPS Google review link.',null,400)
 return url.href
}
export const reviewContent=(url:string)=>`Thank you for visiting our repair shop. You may leave an optional public Google review: ${url}\nYou may also send private satisfaction feedback using the private link below. Both choices are available regardless of your rating. Private feedback is read by the shop owner and is never automatically published. Neither choice authorizes repair work, payment or further marketing.\nPrivate satisfaction page: [private feedback link]\nThis private link expires in seven days. You may also withdraw review-email permission there.`
export function currentReviewConsent(s:State,consent:any){
 const source=paidHandover(s,consent.jobId)
 if(consent.withdrawnAt||consent.to!==source.asset.customerEmail?.trim().toLowerCase()||consent.handoverId!==source.handover.id||optedOut(s,consent.to))fail('REVIEW_CONSENT','Current affirmative review permission and an unchanged recipient are required.')
 if(rows(s,'reviewConsent').some(r=>r.to===consent.to&&r.withdrawnAt))fail('REVIEW_WITHDRAWN','Review permission was withdrawn. Owner approval cannot override withdrawal.')
 return source
}
export const reviews:Handler=(c,command,p)=>{
 if(!reviewCommands.includes(command))return
 if(!internalReviewCommands.includes(command)&&c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner handles review requests and private feedback.',null,403)
 if(command==='review.consent'){
  const {job,asset,handover}=paidHandover(c.s,p.jobId)
  if(p.consent!==true||p.wordingVersion!==REVIEW_WORDING_VERSION)fail('REVIEW_CONSENT','Record the customer’s affirmative permission for the displayed review email wording.',null,422)
  const to=text(p.to,'customer email',254).toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||to!==asset.customerEmail?.trim().toLowerCase())fail('REVIEW_RECIPIENT','Use the collected customer’s current email.',null,400)
  if(optedOut(c.s,to)||rows(c.s,'reviewConsent').some(r=>r.to===to&&r.withdrawnAt))fail('REVIEW_WITHDRAWN','Customer withdrawal prevents another review request.')
  const consentedAt=instant(p.consentedAt,'customer permission time with UTC offset')
  if(!/(Z|[+-]\d\d:\d\d)$/.test(String(p.consentedAt))||consentedAt>c.now)fail('INPUT','Record a past customer permission time with an explicit UTC offset.',null,400)
  const captureChannel=text(p.captureChannel,'permission capture channel',100)
  if(!['customer-form','customer-email','telephone','in-person'].includes(captureChannel))fail('INPUT','Choose how the customer gave permission.',null,400)
  const row=put(c.s,'reviewConsent',{jobId:job.id,assetId:asset.id,handoverId:handover.id,to,purpose:'review',wording:REVIEW_WORDING,wordingVersion:REVIEW_WORDING_VERSION,consentedAt,consentedTime:p.consentedAt,captureChannel,sourceEvidence:text(p.sourceEvidence,'permission evidence reference',2000),by:who(c),at:c.now})
  event(c,command,job.id,row.id,{});return row
 }
 if(command==='review.withdraw'||command==='review.customerWithdraw'){
  const row=find(c.s,'reviewConsent',p.consentId);expectVersion(row,p.version)
  if(row.withdrawnAt)return row
  const next=bump(c.s,'reviewConsent',row,{withdrawnAt:c.now,withdrawal:{by:who(c),reason:command==='review.customerWithdraw'?'Customer withdrew through their private review link':text(p.reason,'withdrawal evidence',2000)}})
  event(c,command,row.jobId,row.id,{});return next
 }
 if(command==='review.send'){
  const consent=find(c.s,'reviewConsent',p.consentId);expectVersion(consent,p.version)
  const {job,asset,handover}=currentReviewConsent(c.s,consent)
  if(p.jobId!==job.id||p.confirm!==true)fail('REVIEW_APPROVAL','Explicitly approve this exact request and recipient.',null,422)
  if(rows(c.s,'reviewRequest').some(r=>r.handoverId===handover.id))fail('REVIEW_ONCE','A request was already claimed for this collection. It will never be sent again.')
  const reviewUrl=googleReviewUrl(p.reviewUrl)
  const row=put(c.s,'reviewRequest',{jobId:job.id,assetId:asset.id,handoverId:handover.id,consentId:consent.id,consentVersion:consent.version,to:consent.to,reviewUrl,content:reviewContent(reviewUrl),templateVersion:'review-request-v1',by:who(c),at:c.now,expiresAt:new Date(Date.parse(c.now)+7*86400000).toISOString(),status:'claimed'})
  event(c,command,job.id,row.id,{});return row
 }
 const row=find(c.s,'reviewRequest',p.id);expectVersion(row,p.version)
 if(command==='review.outcome'){
  if(row.status!=='claimed')fail('REVIEW_OUTCOME','The handoff outcome was already recorded.')
  if(!['accepted','development','failed','uncertain'].includes(p.status))fail('INPUT','Invalid handoff outcome.',null,400)
  const next=bump(c.s,'reviewRequest',row,{status:p.status,provider:text(p.provider,'provider',100),providerReference:text(p.providerReference,'provider reference',1024,true),outcomeAt:c.now})
  event(c,command,row.jobId,row.id,{status:p.status});return next
 }
 if(command==='review.resolve'){
  if(!['failed','uncertain','claimed'].includes(row.status)||row.resolution)fail('REVIEW_RESOLUTION','Only an unresolved failed or uncertain request needs resolution.')
  const next=bump(c.s,'reviewRequest',row,{resolution:{reason:text(p.reason,'staff resolution',2000),by:who(c),at:c.now}})
  event(c,command,row.jobId,row.id,{});return next
 }
 const consent=find(c.s,'reviewConsent',row.consentId)
 if(row.response)return row
 if(row.expiresAt<=c.now||consent.withdrawnAt||find(c.s,'asset',row.assetId).privacyErasedAt)fail('REVIEW_UNAVAILABLE','This response link is no longer available.',null,404)
 const rating=integer(p.rating,'satisfaction rating',1,5),feedback=text(p.feedback,'private feedback',2000,true)
 const task=put(c.s,'subtask',{kind:'review-feedback',reviewRequestId:row.id,jobId:row.jobId,title:'Review private customer feedback',assigneeId:p.ownerId,dependsOn:[],createdBy:who(c),createdAt:c.now,completedAt:null,completedBy:null})
 const taskId=task.id
 const next=bump(c.s,'reviewRequest',row,{response:{rating,feedback,at:c.now,by:who(c)},...(taskId?{taskId}:{})})
 event(c,command,row.jobId,row.id,{taskId});return next
}
