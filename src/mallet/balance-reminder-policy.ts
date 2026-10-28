import {fail,find,put,rows,text,who,type Context,type Row,type State} from './model'
import {instant} from './workshop'

export const BALANCE_POLICY='one-approved-balance-email-v2'
export const BALANCE_PERMISSION='I request one email about the current outstanding balance of this invoice. This does not authorize repeated reminders.'
export const BALANCE_WORDING_VERSION='balance-permission-v1'
export const BALANCE_CAPTURE_CHANNELS=['customer-email','telephone','in-person','signed-writing']
/** The customer's recorded permission and the owner's exact approval are distinct facts. */
export function balancePermission(c:Context,p:any,checked:any){
 if(p.consentPurpose!=='balance-reminder'||p.consentWordingVersion!==BALANCE_WORDING_VERSION)fail('AR_CONSENT','Record permission specifically for one balance email using the current wording.')
 const consentedAt=instant(p.consentedAt,'customer permission time')
 if(consentedAt>c.now)fail('AR_CONSENT','Customer permission cannot be recorded in the future.')
 if(!BALANCE_CAPTURE_CHANNELS.includes(p.captureChannel))fail('AR_CONSENT','Record how the customer gave permission.')
 const reference=text(p.consentReference,'customer permission source reference',200)
 if(rows(c.s,'outreach').some(r=>r.kind==='balance'&&r.subjectId===checked.invoice.id&&r.permission?.reference===reference))fail('AR_CONSENT_USED','This one-email permission already approved a schedule. Record fresh permission; stopping or resolving the old schedule does not reuse it.')
 if(rows(c.s,'outreach').some(r=>r.kind==='balance'&&r.subjectId===checked.invoice.id&&['failed','uncertain'].includes(r.status)&&!rows(c.s,'balanceReminderResolution').some(x=>x.scheduleId===r.id)))fail('AR_REVIEW_REQUIRED','Record human resolution of the original handoff before approving another email. Resolution itself never authorizes it.')
 const erased=rows(c.s,'retentionReceipt').some(r=>r.action==='customer.erase'&&r.customerId===checked.accountId)
 if(erased)fail('AR_ERASURE','Balance email authority remains suppressed for this erased customer account.')
 return {purpose:'balance-reminder',channel:'email',invoiceId:checked.invoice.id,accountId:checked.accountId,accountVersion:find(c.s,'customerAccount',checked.accountId).version,contactId:checked.contact.id,contactVersion:checked.contact.version,to:checked.contact.email,wording:BALANCE_PERMISSION,wordingVersion:BALANCE_WORDING_VERSION,consentedAt,captureChannel:p.captureChannel,reference,evidence:text(p.consentEvidence,'customer email consent evidence',2000),recordedBy:who(c),recordedAt:c.now,source:'owner-recorded customer instruction; channel identity is not independently verified'}
}
/** Each approved step is immutable. No future step or standing sending authority is created. */
export function retainBalanceStep(c:Context,schedule:Row){
 const previous=rows(c.s,'balanceReminderStep').filter(r=>r.invoiceId===schedule.subjectId).sort((a,b)=>a.sequenceVersion-b.sequenceVersion).at(-1)
 const step=put(c.s,'balanceReminderStep',{invoiceId:schedule.subjectId,accountId:schedule.permission.accountId,jobId:find(c.s,'invoice',schedule.subjectId).jobId,sequenceVersion:(previous?.sequenceVersion??0)+1,previousId:previous?.id??null,scheduleId:schedule.id,approval:{by:schedule.by,at:schedule.at,invoiceVersion:schedule.invoiceVersion,assignmentId:schedule.assignmentId,termsId:schedule.termsId,contactVersion:schedule.contactVersion,to:schedule.to,content:schedule.content,dueAt:schedule.dueAt,expiresAt:schedule.expiresAt,timeZone:schedule.timeZone,allowedStart:schedule.allowedStart,allowedEnd:schedule.allowedEnd},permission:structuredClone(schedule.permission)})
 return step
}
export function balancePermissionStop(s:State,r:Row){
 if(r.policy!==BALANCE_POLICY||!r.permission)return 'Fresh attributable one-email customer permission is required'
 const p=r.permission,invoice=find(s,'invoice',r.subjectId),account=find(s,'customerAccount',p.accountId),contact=find(s,'contact',p.contactId)
 if(p.purpose!=='balance-reminder'||p.invoiceId!==invoice.id||p.to!==r.to||p.contactVersion!==contact.version||p.accountVersion!==account.version||r.erasureSuppressedAt)return 'Customer permission changed or was suppressed'
 if(rows(s,'retentionReceipt').some(x=>x.action==='customer.erase'&&x.customerId===p.accountId))return 'Customer erasure suppressed balance reminders'
 return ''
}
