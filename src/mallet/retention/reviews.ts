import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
import type {Sql} from '../media/types'

/** Withdrawal of local capabilities happens for every erasure request, including held data. */
export function revokeReviewAccess(scope:CustomerScope):Sql[]{
 const ids=JSON.stringify([...scope.jobIds])
 return [
  {sql:"DELETE FROM mallet_outreach_authority WHERE outreach_id IN (SELECT id FROM mallet_records WHERE kind='outreach' AND json_extract(value,'$.kind')='declined' AND json_extract(value,'$.assetId') IN (SELECT value FROM json_each(?)))",params:[JSON.stringify([...scope.assetIds])]},
  {sql:"DELETE FROM mallet_status_authority WHERE consent_id IN (SELECT id FROM mallet_records WHERE kind='statusConsent' AND json_extract(value,'$.jobId') IN (SELECT value FROM json_each(?)))",params:[ids]},
  {sql:'DELETE FROM mallet_review_tokens WHERE job_id IN (SELECT value FROM json_each(?))',params:[ids]},
  {sql:"DELETE FROM mallet_review_authority WHERE consent_id IN (SELECT id FROM mallet_records WHERE kind='reviewConsent' AND json_extract(value,'$.jobId') IN (SELECT value FROM json_each(?)))",params:[ids]}
 ]
}
export function eraseReviewFeedback(state:State,scope:CustomerScope,at:string):Sql[]{
 return rows(state,'reviewRequest').filter(r=>scope.jobIds.has(r.jobId)&&r.response&&!r.response.erasedAt).map(r=>write('reviewRequest',{...r,version:r.version+1,response:{at:r.response.at,by:r.response.by,erasedAt:at}}))
}
