// Where a session stands with the second factor: whether this person must prove one, whether this session has,
// and whether a privileged action may run now. Local dev sessions (behind the dev key gate) never wait for it.
import type {Bindings} from '../../auth.server'
import {HttpError,type Authority} from '../auth'
export type Gate={required:boolean;enrolled:boolean;proven:boolean;recovery:boolean;stepUpUntil:number;exempt:boolean}
export async function gateState(env:Bindings,session:{id:string;kind?:string},operatorId:string):Promise<Gate>{
 if(session.kind==='dev')return {required:false,enrolled:false,proven:true,recovery:false,stepUpUntil:Infinity,exempt:true}
 const row=await env.DB.prepare(`SELECT (SELECT require_all FROM mallet_auth_policy WHERE singleton=1) AS requireAll,
  EXISTS(SELECT 1 FROM mallet_factors WHERE operator_id=?1 AND revoked_at IS NULL) AS enrolled,
  (SELECT step_up_until FROM mallet_session_proofs WHERE session_id=?2 AND operator_id=?1) AS stepUp,
  EXISTS(SELECT 1 FROM mallet_session_proofs WHERE session_id=?2 AND operator_id=?1) AS proven,
  EXISTS(SELECT 1 FROM oa_step_up_challenges WHERE token_hash='owner-signin:'||?2) AS recovery`).bind(operatorId,session.id).first<{requireAll:number|null;enrolled:number;stepUp:number|null;proven:number;recovery:number}>()
 return {required:row?.requireAll===1,enrolled:row?.enrolled===1,proven:row?.proven===1,recovery:row?.recovery===1,stepUpUntil:Number(row?.stepUp??0),exempt:false}
}
/** A factor is needed for this session and has not been shown yet. */
export const blocked=(gate:Gate)=>(gate.required||gate.enrolled)&&!gate.proven
/** The authority that also requires this session's own proof, so a reset or revoked session cannot finish an in-flight write. */
export const proofAuthority=(base:Authority,sessionId:string):Authority=>({sql:`(${base.sql}) AND EXISTS(SELECT 1 FROM mallet_session_proofs WHERE session_id=?)`,params:[...base.params,sessionId]})
export const stepUpAuthority=(base:Authority,sessionId:string):Authority=>({sql:`(${base.sql}) AND EXISTS(SELECT 1 FROM mallet_session_proofs WHERE session_id=? AND step_up_until>?)`,params:[...base.params,sessionId,Date.now()]})
export function requireStepUp(auth:{authority:Authority;session?:{id:string};gate?:Gate;bearer:boolean}){
 if(auth.bearer||!auth.session||!auth.gate)throw new HttpError(403,'step_up_required','A signed-in person must confirm with a second factor first.')
 if(auth.gate.exempt)return auth.authority
 if(auth.gate.stepUpUntil<=Date.now())throw new HttpError(403,'step_up_required','Confirm with your second factor, then repeat this action.')
 return stepUpAuthority(auth.authority,auth.session.id)
}
/** Commands that move money, release a vehicle unpaid, mint standing authority, reveal custody secrets or destroy records need a fresh proof. */
// The role each command's own rules already admit: anyone else meets that refusal, not a request to confirm.
export const STEP_UP_COMMANDS=new Map<string,'owner'|'human'>([...['credit.issue','credit.apply','credit.exchange','refund.record','refund.redirect','refund.submit','refund.reconcile','asset.erase','intake.secretReveal','return.override','connector.save','connector.revoke'].map(c=>[c,'owner'] as const),['agent.create','human'],['agent.rotate','human']])
export const needsStepUp=(command:string,role:string)=>{const who=STEP_UP_COMMANDS.get(command);return who==='owner'?role==='owner':who==='human'?role==='owner'||role==='admin':false}
