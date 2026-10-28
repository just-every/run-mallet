import {event,expectVersion,fail,find,put,rows,text,who,type Handler,type State,type Row} from './model'

export const balanceRecoveryCommands=['ar.resolveBalanceReminder']
/** References describe the retained approval, not today's balance or permission to send. */
export function balanceRecoverySource(s:State,schedule:Row){
 if(schedule.kind!=='balance'||!['failed','uncertain'].includes(schedule.status))fail('AR_REVIEW','Only a failed or uncertain scheduled balance email needs this review.')
 const invoice=find(s,'invoice',schedule.subjectId),assignment=find(s,'arInvoice',schedule.assignmentId),terms=find(s,'arTerms',schedule.termsId)
 if(assignment.invoiceId!==invoice.id||assignment.invoiceRevision!==invoice.revision||terms.accountId!==assignment.accountId||schedule.invoiceVersion>invoice.version)fail('AR_REVIEW_SOURCE','Retained invoice and approval references do not agree.')
 return {scheduleId:schedule.id,scheduleVersion:schedule.version,invoiceId:invoice.id,invoiceVersion:schedule.invoiceVersion,invoiceRevision:invoice.revision,assignmentId:assignment.id,termsId:terms.id,accountId:assignment.accountId,jobId:invoice.jobId,
  originalOutcome:{status:schedule.status,provider:schedule.provider,claimedAt:schedule.claimedAt,outcomeAt:schedule.outcomeAt}}
}
export function balanceReminderReviews(s:State,accountId=''){
 return rows(s,'outreach').filter(r=>r.kind==='balance'&&['failed','uncertain'].includes(r.status)).map(r=>{
  const source=balanceRecoverySource(s,r),invoice=find(s,'invoice',source.invoiceId)
  return {...source,number:invoice.number,outstandingCents:r.review.outstandingCents,dueAt:r.dueAt,resolution:rows(s,'balanceReminderResolution').find(x=>x.scheduleId===r.id)??null}
 }).filter(r=>!accountId||r.accountId===accountId).sort((a,b)=>b.originalOutcome.outcomeAt.localeCompare(a.originalOutcome.outcomeAt)||a.scheduleId.localeCompare(b.scheduleId))
}
export const balanceReminderRecovery:Handler=(c,command,p)=>{
 if(!balanceRecoveryCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner reviews balance email failures.',null,403)
 const schedule=find(c.s,'outreach',p.id);expectVersion(schedule,p.version)
 const source=balanceRecoverySource(c.s,schedule)
 if(p.invoiceId!==source.invoiceId||p.invoiceVersion!==source.invoiceVersion||p.assignmentId!==source.assignmentId||p.termsId!==source.termsId)fail('AR_REVIEW_SOURCE','Review the exact retained invoice and approval references again.')
 if(rows(c.s,'balanceReminderResolution').some(r=>r.scheduleId===schedule.id))fail('AR_REVIEW_CLOSED','This handoff already has a human resolution. Its original outcome remains unchanged.')
 if(p.confirm!=='record-balance-review')fail('AR_REVIEW_CONFIRM','Explicitly confirm this review records no payment and grants no retry or sending authority.',null,400)
 const receipt=put(c.s,'balanceReminderResolution',{...source,evidence:text(p.evidence,'human resolution and evidence reference',2000),by:who(c),at:c.now})
 event(c,command,source.jobId,receipt.id,{scheduleId:schedule.id,scheduleVersion:schedule.version})
 return receipt
}
