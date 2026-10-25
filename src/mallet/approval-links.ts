import {fleetApproval} from './fleet-authority'
import {createHash} from 'node:crypto'
import {bump,choice,event,expectVersion,fail,find,integer,put,text,who,type Handler,type Row} from './model'
import {totals} from './money'
import {validateReplacements} from './supplement-scope'
import {openTask,policyOf,startChase,stopFor} from './approval-chasing'
export const approvalLinkCommands=['approvalLink.create','approvalLink.delivery','approvalLink.revoke','estimate.customerDecide'] as const
// Recorded only by the server around a mail send or a customer link; never accepted from the command door.
export const internalApprovalCommands=['approvalLink.delivery','estimate.customerDecide']
export const CONSENT='I agree to sign and receive this record electronically, and that my typed name is my electronic signature for this decision. To request a paper copy of this estimate and decision, ask your repair shop by phone or in person.'
export const SIGNATURE_LABEL='Typed-name electronic signature; identity not verified beyond possession of the emailed link.'
const current=(estimate:Row)=>estimate.revisions.at(-1)
const canonical=(value:any):string=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')}}`:JSON.stringify(value)
/** A link is live only while unrevoked, unexpired, undecided and still naming the estimate's current, undecided revision and total. */
export function linkState(s:any,link:Row,now:string):'active'|'decided'|'unavailable' {
 if(link.revokedAt||Date.parse(now)>=Math.min(Date.parse(link.expiresAt),Date.parse(link.createdAt)+7*86_400_000))return 'unavailable'
 if(link.decision)return 'decided'
 const estimate=(s.records.estimate??[]).find((q:Row)=>q.id===link.estimateId),job=(s.records.job??[]).find((j:Row)=>j.id===link.jobId),rev=estimate&&current(estimate)
 if(link.revokedAt||link.expiresAt<=now||!rev||rev.n!==link.revision||rev.totals.totalCents!==link.totalCents||estimate.authorisation||!['booked','working'].includes(job?.status))return 'unavailable'
 return 'active'
}
export const approvalLinks:Handler=(c,command,p)=>{
 if(!(approvalLinkCommands as readonly string[]).includes(command))return
 if(command==='estimate.customerDecide') {
  if(c.actor.role!=='customer')fail('FORBIDDEN','Only the customer link records this decision.',null,403)
  const link=find(c.s,'approvalLink',p.linkId),approved=Array.isArray(p.approvedLineIds)?p.approvedLineIds.map((id:unknown)=>text(id,'lineId')):fail('INPUT','Choose approve or decline for every line.',null,400)
  const typedName=text(p.typedName,'full name',200)
  if(link.decision) {
   const same=link.decision.receipt.typedName===typedName&&canonical([...link.decision.receipt.approved.map((l:any)=>l.lineId)].sort())===canonical([...approved].sort())
   if(!same)fail('LINK_USED','This link already recorded a decision.',null,409)
   return link
  }
  if(linkState(c.s,link,c.now)!=='active')fail('LINK_UNAVAILABLE','This approval link is no longer available.',null,404)
  if(p.consent!==true)fail('INPUT','Agree to sign electronically before submitting.',null,400)
  const estimate=find(c.s,'estimate',link.estimateId),rev=current(estimate),job=find(c.s,'job',estimate.jobId)
  if(!rev.approval||!estimate.sent.some((s:any)=>s.revision===rev.n))fail('NOT_SENT','This estimate revision was not shared.',null,409)
  if(new Set(approved).size!==approved.length||approved.some((id:string)=>!rev.lines.some((l:Row)=>l.id===id)))fail('INPUT','Approved lines must be unique lines on this exact revision.',null,400)
  const chosen=rev.lines.filter((l:Row)=>approved.includes(l.id))
  validateReplacements(c,job,chosen,estimate.id)
  const line=(l:Row)=>({lineId:l.id,description:l.description,quantity:l.quantity,unitCents:l.unitCents-(l.unitDiscountCents??0),salesTaxCents:l.salesTaxCents,totalCents:l.totalCents})
  const receipt={linkId:link.id,estimateId:estimate.id,jobId:job.id,revision:rev.n,revisionTotalCents:rev.totals.totalCents,approved:chosen.map(line),declined:rev.lines.filter((l:Row)=>!approved.includes(l.id)).map(line),approvedTotals:totals(chosen),typedName,email:link.to,consent:CONSENT,signature:SIGNATURE_LABEL,at:c.now}
  const receiptSha256=createHash('sha256').update(canonical(receipt)).digest('hex')
  fleetApproval(c,job,{})
  const authorisation={revision:rev.n,lineIds:approved,customerName:typedName,method:'signed link',evidence:`Signed through an approval link; receipt sha256 ${receiptSha256.slice(0,16)}… (full receipt on the link)`,recordedBy:who(c),at:c.now,totals:receipt.approvedTotals,linkId:link.id,email:link.to}
  const row=bump(c.s,'estimate',estimate,{status:approved.length?'authorised':'declined',authorisation})
  event(c,command,job.id,row.id,authorisation)
  stopFor(c,link.id,'decision')
  return bump(c.s,'approvalLink',link,{decision:{receipt,receiptSha256}})
 }
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or service advisor sends approval links.',null,403)
 if(command==='approvalLink.create') {
  const estimate=find(c.s,'estimate',p.estimateId);expectVersion(estimate,p.version)
  const rev=current(estimate),job=find(c.s,'job',estimate.jobId),asset=find(c.s,'asset',job.assetId)
  if(integer(p.revision,'revision',1)!==rev.n)fail('REVISION','Use the exact current estimate revision.',{current:rev.n})
  if(!rev.approval||estimate.authorisation||!['approved','sent'].includes(estimate.status))fail('NOT_APPROVED','A person must approve this exact undecided revision before it is sent.')
  if(!['booked','working'].includes(job.status))fail('JOB_STATE','A completed repair cannot collect new decisions.')
  const to=text(asset.customerEmail,'customer email',320)
  const row=put(c.s,'approvalLink',{estimateId:estimate.id,jobId:job.id,revision:rev.n,totalCents:rev.totals.totalCents,to,createdBy:who(c),createdAt:c.now,expiresAt:new Date(Date.parse(c.now)+integer(p.days??Math.min(7,policyOf(c.s).linkDays),'link lifetime in days',1,7)*86_400_000).toISOString(),delivery:null,revokedAt:null,revokedBy:null,decision:null})
  event(c,command,job.id,row.id,{estimateId:estimate.id,revision:rev.n,expiresAt:row.expiresAt});startChase(c,row);return row
 }
 const link=find(c.s,'approvalLink',p.linkId);expectVersion(link,p.version)
 if(command==='approvalLink.delivery') {
  // The provider's answer is recorded as given: accepted means handed to the provider, never delivered.
  const status=choice(p.status,['accepted','rejected','rate_limited','uncertain','development'] as const,'delivery status'),delivery={status,provider:text(p.provider,'provider',100),providerMessageId:p.providerMessageId?text(p.providerMessageId,'provider message id',300):null,at:c.now}
  const next=bump(c.s,'approvalLink',link,{delivery})
  if(status==='accepted'||status==='development') {
   const estimate=find(c.s,'estimate',link.estimateId),share={revision:link.revision,method:'email',note:status==='accepted'?`Approval link handed to ${delivery.provider}; delivery not confirmed`:'Approval link written to the development mail outbox; not sent',recordedBy:who(c),at:c.now,deliveryConfirmed:false}
   bump(c.s,'estimate',estimate,{status:'sent',sent:[...estimate.sent,share]});event(c,'estimate.markSent',link.jobId,estimate.id,share)
  } else {
   // EST-006: a first send that failed or is uncertain is never retried by reminders; an advisor follows up.
   stopFor(c,link.id,'delivery-failed');openTask(c,link,'delivery-failed',`The approval link email was ${status==='uncertain'?'given an uncertain outcome; it was not retried':status.replace('_',' ')+' by the mail provider'}.`)
  }
  return next
 }
 if(link.revokedAt)fail('LINK_STATE','This link is already revoked.')
 const next=bump(c.s,'approvalLink',link,{revokedAt:c.now,revokedBy:who(c)});event(c,command,link.jobId,link.id,{});stopFor(c,link.id,'revoked');return next
}
