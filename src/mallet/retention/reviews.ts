import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
import type {Sql} from '../media/types'

/** Withdrawal of local capabilities happens for every erasure request, including held data. */
export function revokeReviewAccess(scope:CustomerScope,state:State,at:string,by:any):{recordChanges:number;queries:Sql[]}{
 const ids=JSON.stringify([...scope.jobIds])
 const changed=[
  ...rows(state,'declinedConsent').filter(r=>scope.assetIds.has(r.assetId)&&!r.erasureSuppressedAt).map(r=>write('declinedConsent',{...r,version:r.version+1,erasureSuppressedAt:at,erasureSuppressedBy:by})),
  ...rows(state,'outreach').filter(r=>r.kind==='declined'&&scope.assetIds.has(r.assetId)&&r.status==='pending').map(r=>write('outreach',{...r,version:r.version+1,status:'stopped',stoppedAt:at,stoppedBy:by,stopReason:'Customer erasure request suppresses declined-work outreach'})),
 ]
 return {recordChanges:changed.length,queries:[
  ...changed,
  {sql:"DELETE FROM mallet_outreach_authority WHERE outreach_id IN (SELECT id FROM mallet_records WHERE kind='outreach' AND json_extract(value,'$.kind')='declined' AND json_extract(value,'$.assetId') IN (SELECT value FROM json_each(?)))",params:[JSON.stringify([...scope.assetIds])]},
  {sql:"DELETE FROM mallet_status_authority WHERE consent_id IN (SELECT id FROM mallet_records WHERE kind='statusConsent' AND json_extract(value,'$.jobId') IN (SELECT value FROM json_each(?)))",params:[ids]},
  {sql:'DELETE FROM mallet_review_tokens WHERE job_id IN (SELECT value FROM json_each(?))',params:[ids]},
  {sql:"DELETE FROM mallet_review_authority WHERE consent_id IN (SELECT id FROM mallet_records WHERE kind='reviewConsent' AND json_extract(value,'$.jobId') IN (SELECT value FROM json_each(?)))",params:[ids]}
 ]}
}
export function eraseReviewFeedback(state:State,scope:CustomerScope,at:string):Sql[]{
 return rows(state,'reviewRequest').filter(r=>scope.jobIds.has(r.jobId)&&r.response&&!r.response.erasedAt).map(r=>write('reviewRequest',{...r,version:r.version+1,response:{at:r.response.at,by:r.response.by,erasedAt:at}}))
}
