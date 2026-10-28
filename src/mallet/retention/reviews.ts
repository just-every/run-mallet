import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
import type {Sql} from '../media/types'

// Consent retains the customer at capture; a vehicle transfer must not move that
// customer's private capabilities into the new owner's erasure scope alone.
function declinedConsentIds(scope:CustomerScope,state:State){
 return new Set(rows(state,'declinedConsent').filter(r=>scope.assetIds.has(r.assetId)||scope.accountIds.has(r.customer?.accountId)).map(r=>r.id))
}

/** Withdrawal of local capabilities happens for every erasure request, including held data. */
export function revokeReviewAccess(scope:CustomerScope,state:State,at:string,by:any):{recordChanges:number;queries:Sql[]}{
 const ids=JSON.stringify([...scope.jobIds])
 const consentIds=declinedConsentIds(scope,state)
 const consents=JSON.stringify([...consentIds]),appointmentIds=JSON.stringify(rows(state,'appointment').filter(r=>consentIds.has(r.declinedConsentId)).map(r=>r.id))
 const outreachIds=JSON.stringify(rows(state,'outreach').filter(r=>r.kind==='declined'&&(scope.assetIds.has(r.assetId)||consentIds.has(r.consentId))).map(r=>r.id))
 const changed=[
  ...rows(state,'appointment').filter(r=>consentIds.has(r.declinedConsentId)&&!r.outreachSuppressedAt).map(r=>write('appointment',{...r,version:r.version+1,outreachSuppressedAt:at,outreachSuppressedBy:by})),
  ...rows(state,'declinedConsent').filter(r=>consentIds.has(r.id)&&!r.erasureSuppressedAt).map(r=>write('declinedConsent',{...r,version:r.version+1,erasureSuppressedAt:at,erasureSuppressedBy:by})),
  ...rows(state,'outreach').filter(r=>r.kind==='declined'&&(scope.assetIds.has(r.assetId)||consentIds.has(r.consentId))&&r.status==='pending').map(r=>write('outreach',{...r,version:r.version+1,status:'stopped',stoppedAt:at,stoppedBy:by,stopReason:'Customer erasure request suppresses declined-work outreach'})),
 ]
 return {recordChanges:changed.length,queries:[
  ...changed,
  {sql:"DELETE FROM mallet_outreach_authority WHERE outreach_id IN (SELECT id FROM mallet_records WHERE kind='outreach' AND json_extract(value,'$.kind')='appointment' AND json_extract(value,'$.subjectId') IN (SELECT value FROM json_each(?)))",params:[appointmentIds]},
  {sql:'DELETE FROM mallet_booking_reminder_tokens WHERE appointment_id IN (SELECT value FROM json_each(?))',params:[appointmentIds]},
  {sql:'DELETE FROM mallet_booking_tokens WHERE appointment_id IN (SELECT value FROM json_each(?))',params:[appointmentIds]},
  {sql:'DELETE FROM mallet_declined_withdrawal_tokens WHERE consent_id IN (SELECT value FROM json_each(?))',params:[consents]},
  {sql:'DELETE FROM mallet_outreach_authority WHERE outreach_id IN (SELECT value FROM json_each(?))',params:[outreachIds]},
  {sql:"DELETE FROM mallet_status_authority WHERE consent_id IN (SELECT id FROM mallet_records WHERE kind='statusConsent' AND json_extract(value,'$.jobId') IN (SELECT value FROM json_each(?)))",params:[ids]},
  {sql:'DELETE FROM mallet_review_tokens WHERE job_id IN (SELECT value FROM json_each(?))',params:[ids]},
  {sql:"DELETE FROM mallet_review_authority WHERE consent_id IN (SELECT id FROM mallet_records WHERE kind='reviewConsent' AND json_extract(value,'$.jobId') IN (SELECT value FROM json_each(?)))",params:[ids]}
 ]}
}
export function eraseReviewFeedback(state:State,scope:CustomerScope,at:string):Sql[]{
 const consentIds=declinedConsentIds(scope,state)
 return [...rows(state,'appointment').filter(r=>consentIds.has(r.declinedConsentId)&&!r.privacyErasedAt).map(r=>write('appointment',{...r,version:r.version+1,name:'Erased customer',email:'',privacyErasedAt:at})),...rows(state,'reviewRequest').filter(r=>scope.jobIds.has(r.jobId)&&r.response&&!r.response.erasedAt).map(r=>write('reviewRequest',{...r,version:r.version+1,response:{at:r.response.at,by:r.response.by,erasedAt:at}}))]
}
