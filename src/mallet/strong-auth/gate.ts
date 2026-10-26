// Where a session stands with the second factor: whether this person must prove one, whether this session has,
// and whether a privileged action may run now. Deposit custody always needs an enrolled factor, including in local development.
import type {Bindings} from '../../auth.server'
import {HttpError,type Authority} from '../auth'
export type Gate={required:boolean;enrolled:boolean;proven:boolean;recovery:boolean;stepUpUntil:number;factorStepUpUntil:number;exempt:boolean}
export async function gateState(env:Bindings,session:{id:string;kind?:string},operatorId:string):Promise<Gate>{
 const row=await env.DB.prepare(`SELECT (SELECT require_all FROM mallet_auth_policy WHERE singleton=1) AS requireAll,
  EXISTS(SELECT 1 FROM mallet_factors WHERE operator_id=?1 AND revoked_at IS NULL) AS enrolled,
  (SELECT step_up_until FROM mallet_session_proofs WHERE session_id=?2 AND operator_id=?1) AS stepUp,
  (SELECT method FROM mallet_session_proofs WHERE session_id=?2 AND operator_id=?1) AS method,
  EXISTS(SELECT 1 FROM mallet_session_proofs WHERE session_id=?2 AND operator_id=?1) AS proven,
  EXISTS(SELECT 1 FROM oa_step_up_challenges WHERE token_hash='owner-signin:'||?2) AS recovery`).bind(operatorId,session.id).first<{requireAll:number|null;enrolled:number;stepUp:number|null;method:string|null;proven:number;recovery:number}>()
 const exempt=session.kind==='dev'
 const required=!exempt&&row?.requireAll===1,enrolled=row?.enrolled===1,proven=row?.proven===1&&(!(required||enrolled)||row.method!=='fresh-sign-in')
 return {required,enrolled,factorStepUpUntil:enrolled&&['totp','passkey'].includes(row?.method??'')?Number(row?.stepUp??0):0,proven:exempt||proven,recovery:row?.recovery===1,stepUpUntil:exempt?Infinity:proven?Number(row?.stepUp??0):0,exempt}
}
/** A factor is needed for this session and has not been shown yet. */
export const blocked=(gate:Gate)=>(gate.required||gate.enrolled)&&!gate.proven
/** The authority that also requires this session's own proof, so a reset or revoked session cannot finish an in-flight write. */
const acceptedProof=`(p.method<>'fresh-sign-in' OR (NOT EXISTS(SELECT 1 FROM mallet_auth_policy WHERE require_all=1) AND NOT EXISTS(SELECT 1 FROM mallet_factors f WHERE f.operator_id=p.operator_id AND f.revoked_at IS NULL)))`
export const proofAuthority=(base:Authority,sessionId:string):Authority=>({sql:`(${base.sql}) AND EXISTS(SELECT 1 FROM mallet_session_proofs p WHERE session_id=? AND ${acceptedProof})`,params:[...base.params,sessionId]})
export const stepUpAuthority=(base:Authority,sessionId:string):Authority=>({sql:`(${base.sql}) AND EXISTS(SELECT 1 FROM mallet_session_proofs p WHERE session_id=? AND step_up_until>? AND ${acceptedProof})`,params:[...base.params,sessionId,Date.now()]})
export function requireStepUp(auth:{authority:Authority;session?:{id:string};gate?:Gate;bearer:boolean},factorOnly=false){
 if(auth.bearer||!auth.session||!auth.gate)throw new HttpError(403,'step_up_required','A signed-in person must confirm with a second factor first.')
 if(factorOnly){
  if(auth.gate.factorStepUpUntil<=Date.now())throw new HttpError(403,'step_up_required','Enrol and confirm with your own second factor before a deposit action, then repeat it within five minutes.')
  const base=auth.authority
  return {sql:`(${base.sql}) AND EXISTS(SELECT 1 FROM mallet_session_proofs p WHERE session_id=? AND step_up_until>? AND method IN ('totp','passkey') AND EXISTS(SELECT 1 FROM mallet_factors f WHERE f.operator_id=p.operator_id AND f.revoked_at IS NULL))`,params:[...base.params,auth.session.id,Date.now()]}
 }
 if(auth.gate.exempt)return auth.authority
 if(auth.gate.stepUpUntil<=Date.now())throw new HttpError(403,'step_up_required',auth.gate.enrolled?'Confirm with your second factor, then repeat this action.':'Sign in again, then repeat this action within five minutes.')
 return stepUpAuthority(auth.authority,auth.session.id)
}
/** Commands that move money, release a vehicle unpaid, mint standing authority, reveal custody secrets or destroy records need a fresh proof. */
// The role each command's own rules already admit: anyone else meets that refusal, not a request to confirm.
export const STEP_UP_COMMANDS=new Map<string,'owner'|'human'>([...['decline.inapplicable','reportFilter.schedule','tax.creditBasis','ar.remind','tender.clearance','ar.terms','ar.invoice','ar.dispute','ar.promise','deposit.record','deposit.allocate','deposit.refund','stock.coreCorrect','stock.coreRefund','credit.issue','credit.apply','credit.exchange','refund.record','refund.redirect','refund.submit','refund.reconcile','asset.erase','intake.secretReveal','return.override','connector.save','connector.revoke','customer.erase','retention.run','retention.release','retention.hold','retention.policy'].map(c=>[c,'owner'] as const),['purchase.submit','human'],['purchase.cancel','human'],['purchase.rejectSubstitution','human'],['agent.create','human'],['agent.rotate','human']])
export const needsStepUp=(command:string,role:string)=>{if(command.startsWith('outreach.'))return role==='owner';const who=STEP_UP_COMMANDS.get(command);return who==='owner'?role==='owner':who==='human'?role==='owner'||role==='admin':false}
