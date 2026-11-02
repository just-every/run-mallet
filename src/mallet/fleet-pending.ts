import {bump,event,rows,who,type Context} from './model'
import {stopFor} from './approval-chasing'

/** Relationship changes end undecided approvals; completed customer decisions remain historical evidence. */
export function voidFleetApprovals(c:Context,assetIds:Set<string>,reason:string){
 const jobs=new Set(rows(c.s,'job').filter(j=>assetIds.has(j.assetId)).map(j=>j.id))
 for(const estimate of rows(c.s,'estimate').filter(e=>jobs.has(e.jobId)&&!e.authorisation&&['approved','sent'].includes(e.status))){
  const rev=estimate.revisions.at(-1)
  const next=bump(c.s,'estimate',estimate,{status:'draft',revisions:[...estimate.revisions,{...rev,n:rev.n+1,approval:null,fleetReview:{reason,by:who(c),at:c.now}}]})
  for(const link of rows(c.s,'approvalLink').filter(l=>l.estimateId===estimate.id&&!l.decision&&!l.revokedAt)){
   bump(c.s,'approvalLink',link,{revokedAt:c.now,revokedBy:who(c),revokeReason:reason});stopFor(c,link.id,'revoked')
  }
  event(c,'estimate.fleetAuthorityVoided',estimate.jobId,estimate.id,{reason,voidedRevision:rev.n,revision:next.revisions.at(-1).n})
 }
}

export function voidFleetAccountApprovals(c:Context,accountIds:string[],reason:string){
 voidFleetApprovals(c,new Set(rows(c.s,'asset').filter(a=>accountIds.includes(a.customerAccountId)).map(a=>a.id)),reason)
}
