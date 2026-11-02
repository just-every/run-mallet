// GOV-004 second factors: TOTP and passkey enrolment and verification, one-time recovery codes, per-session proofs
// and the owner's policy. Credentials and proofs are local to this installation and excluded from archives.
import type {Bindings} from '../../auth.server'
import {HttpError} from '../auth'
import {b64,open,seal} from './secret-box'
import {base32,matchStep,otpauth} from './totp'
import {challengeBytes,PasskeyError,verifyAssertion,verifyRegistration} from './webauthn'
import {notifyRecovery} from './recovery-notice'
export const STEP_UP_MS=5*60*1000
const ATTEMPT_LIMIT=8,ATTEMPT_WINDOW=15*60*1000,CHALLENGE_MS=5*60*1000,PENDING_MS=15*60*1000
export type Who={id:string;name:string;email?:string;role:string}
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('')
export const audit=(db:D1Database,actorId:string,action:string,value:unknown)=>db.prepare('INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),actorId,'mallet:'+action,JSON.stringify(value),Date.now())
/** Count an attempt first; refuse the verification itself once the window's allowance is spent. */
export async function spendAttempt(db:D1Database,key:string,limit=ATTEMPT_LIMIT){
 const window=Math.floor(Date.now()/ATTEMPT_WINDOW),row=await db.prepare('INSERT INTO mallet_rate(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN mallet_rate.window=excluded.window THEN mallet_rate.count+1 ELSE 1 END RETURNING count').bind(key,window).first<{count:number}>()
 if(Number(row?.count)>limit)throw new HttpError(429,'too_many_attempts','Too many failed attempts. Wait fifteen minutes.')
}
const clearAttempts=(db:D1Database,key:string)=>db.prepare('DELETE FROM mallet_rate WHERE key=?').bind(key).run()
export async function policy(db:D1Database){const row=await db.prepare('SELECT require_all AS requireAll,version FROM mallet_auth_policy WHERE singleton=1').first<{requireAll:number;version:number}>();return {requireAll:row?.requireAll===1,version:row?.version??0}}
export async function factors(db:D1Database,operatorId:string){
 return (await db.prepare('SELECT id,kind,label,created_at AS createdAt,last_used_at AS lastUsedAt FROM mallet_factors WHERE operator_id=? AND revoked_at IS NULL ORDER BY created_at,id').bind(operatorId).all<{id:string;kind:string;label:string;createdAt:number;lastUsedAt:number|null}>()).results
}
export const recoveryRemaining=async(db:D1Database,operatorId:string)=>Number((await db.prepare('SELECT COUNT(*) AS n FROM mallet_recovery_codes WHERE operator_id=? AND used_at IS NULL').bind(operatorId).first<{n:number}>())?.n)
const live=(session:string,operator:string,now:string)=>`EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=${session} AND s.operator_id=${operator} AND s.revoked_at IS NULL AND s.expires_at>${now} AND s.operator_version=o.version AND o.status='active')`
/** Record a proof on a still-live session. Only a factor (not a recovery code) refreshes the step-up window. */
export async function prove(db:D1Database,sessionId:string,operatorId:string,method:string,stepUp:boolean){
 const now=Date.now(),until=stepUp?now+STEP_UP_MS:0
 const result=await db.prepare(`INSERT INTO mallet_session_proofs(session_id,operator_id,method,proven_at,step_up_until) SELECT ?1,?2,?4,?3,?5 WHERE ${live('?1','?2','?3')} ON CONFLICT(session_id) DO UPDATE SET method=excluded.method,proven_at=excluded.proven_at,step_up_until=MAX(mallet_session_proofs.step_up_until,excluded.step_up_until)`).bind(sessionId,operatorId,now,method,until).run()
 if(!result.meta.changes)throw new HttpError(401,'sign_in_required')
}
async function endOtherSessions(db:D1Database,operatorId:string,keep:string){
 await db.batch([db.prepare('UPDATE oa_sessions SET revoked_at=? WHERE operator_id=? AND id<>? AND revoked_at IS NULL').bind(Date.now(),operatorId,keep),db.prepare('DELETE FROM mallet_session_proofs WHERE operator_id=? AND session_id<>?').bind(operatorId,keep)])
}
const RECOVERY_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const recoveryHash=(env:Bindings,code:string)=>digest(env.SESSION_SECRET+'\0recovery\0'+code.toUpperCase().replace(/[^A-Z0-9]/g,''))
export async function issueRecoveryCodes(env:Bindings,operatorId:string){
 const codes=Array.from({length:8},()=>{const bytes=crypto.getRandomValues(new Uint8Array(10));const raw=Array.from(bytes,b=>RECOVERY_ALPHABET[b%32]).join('');return raw.slice(0,5)+'-'+raw.slice(5)})
 const now=Date.now()
 await env.DB.batch([env.DB.prepare('DELETE FROM mallet_recovery_codes WHERE operator_id=?').bind(operatorId),...(await Promise.all(codes.map(async code=>env.DB.prepare('INSERT INTO mallet_recovery_codes(code_hash,operator_id,created_at) VALUES(?,?,?)').bind(await recoveryHash(env,code),operatorId,now))))])
 return codes
}
const label=(value:unknown,fallback:string)=>{const text=String(value??'').trim().slice(0,60);return text||fallback}
// ---- TOTP
export async function beginTotp(env:Bindings,who:Who){
 const secret=crypto.getRandomValues(new Uint8Array(20)),now=Date.now()
 await env.DB.prepare('INSERT INTO mallet_totp_pending(operator_id,secret_box,expires_at) VALUES(?,?,?) ON CONFLICT(operator_id) DO UPDATE SET secret_box=excluded.secret_box,expires_at=excluded.expires_at').bind(who.id,await seal(env,'totp',who.id,secret),now+PENDING_MS).run()
 return {secret:base32(secret),uri:otpauth('Mallet',who.email??who.name,secret),expiresAt:now+PENDING_MS}
}
export async function pendingTotp(env:Bindings,who:Who){
 const row=await env.DB.prepare('SELECT secret_box AS box,expires_at AS expiresAt FROM mallet_totp_pending WHERE operator_id=?').bind(who.id).first<{box:string;expiresAt:number}>()
 if(!row||row.expiresAt<=Date.now())return null
 const secret=await open(env,'totp',who.id,row.box);return {secret:base32(secret),uri:otpauth('Mallet',who.email??who.name,secret),expiresAt:row.expiresAt}
}
export async function confirmTotp(env:Bindings,who:Who,sessionId:string,input:any){
 await spendAttempt(env.DB,'factor:'+who.id)
 const row=await env.DB.prepare('SELECT secret_box AS box,expires_at AS expiresAt FROM mallet_totp_pending WHERE operator_id=?').bind(who.id).first<{box:string;expiresAt:number}>()
 if(!row||row.expiresAt<=Date.now())throw new HttpError(409,'enrolment_expired','Start the authenticator setup again.')
 const secret=await open(env,'totp',who.id,row.box),step=await matchStep(secret,String(input.code??''),Date.now())
 if(step===null)throw new HttpError(403,'invalid_code','That code is not valid.')
 return enroll(env,who,sessionId,{id:crypto.randomUUID(),kind:'totp',label:label(input.label,'Authenticator app'),box:await seal(env,'totp',who.id,secret),step},'totp')
}
async function enroll(env:Bindings,who:Who,sessionId:string,f:{id:string;kind:string;label:string;box?:string;step?:number;credentialId?:string;publicKey?:string;count?:number},method:string){
 const first=(await factors(env.DB,who.id)).length===0,now=Date.now()
 const added=await env.DB.prepare(`INSERT INTO mallet_factors(id,operator_id,kind,label,secret_box,last_step,credential_id,public_key,sign_count,created_at) SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10 WHERE ${live('?11','?2','?10')}`).bind(f.id,who.id,f.kind,f.label,f.box??null,f.step??null,f.credentialId??null,f.publicKey??null,f.count??null,now,sessionId).run()
 if(!added.meta.changes)throw new HttpError(401,'sign_in_required')
 await env.DB.prepare('DELETE FROM mallet_totp_pending WHERE operator_id=?').bind(who.id).run()
 await prove(env.DB,sessionId,who.id,method,true)
 // The first factor ends every other session of this person, so a cookie stolen earlier stops working now.
 let recoveryCodes:string[]|undefined
 if(first){await endOtherSessions(env.DB,who.id,sessionId);recoveryCodes=await issueRecoveryCodes(env,who.id)}
 await audit(env.DB,who.id,'factor.enrolled',{factorId:f.id,kind:f.kind,first}).run()
 return {factorId:f.id,kind:f.kind,recoveryCodes}
}
// ---- passkeys
const rp=(env:Bindings)=>({origin:env.AUTH_ORIGIN,rpId:new URL(env.AUTH_ORIGIN).hostname})
async function challenge(env:Bindings,who:Who,sessionId:string,purpose:'register'|'assert'){
 const bytes=challengeBytes(),value=b64(bytes),now=Date.now(),id=crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('DELETE FROM mallet_auth_challenges WHERE expires_at<?').bind(now),env.DB.prepare('INSERT INTO mallet_auth_challenges(id,operator_id,session_id,purpose,challenge,expires_at) VALUES(?,?,?,?,?,?)').bind(id,who.id,sessionId,purpose,value,now+CHALLENGE_MS)])
 return {id,challenge:value}
}
async function consumeChallenge(env:Bindings,who:Who,sessionId:string,purpose:string,id:unknown){
 const row=await env.DB.prepare('UPDATE mallet_auth_challenges SET consumed_at=? WHERE id=? AND operator_id=? AND session_id=? AND purpose=? AND consumed_at IS NULL AND expires_at>? RETURNING challenge').bind(Date.now(),String(id??''),who.id,sessionId,purpose,Date.now()).first<{challenge:string}>()
 if(!row)throw new HttpError(400,'challenge_expired','Start the passkey step again.')
 return row.challenge
}
export async function passkeyRegisterOptions(env:Bindings,who:Who,sessionId:string){
 const {id,challenge:value}=await challenge(env,who,sessionId,'register'),existing=(await env.DB.prepare('SELECT credential_id AS id FROM mallet_factors WHERE operator_id=? AND kind=? AND revoked_at IS NULL').bind(who.id,'passkey').all<{id:string}>()).results
 return {challengeId:id,publicKey:{challenge:value,rp:{name:'Mallet',id:rp(env).rpId},user:{id:b64(new TextEncoder().encode(who.id)),name:who.email??who.name,displayName:who.name},pubKeyCredParams:[{type:'public-key',alg:-7}],timeout:60000,attestation:'none',authenticatorSelection:{residentKey:'preferred',userVerification:'required'},excludeCredentials:existing.map(x=>({type:'public-key',id:x.id}))}}
}
export async function passkeyRegister(env:Bindings,who:Who,sessionId:string,input:any){
 await spendAttempt(env.DB,'factor:'+who.id)
 const challengeValue=await consumeChallenge(env,who,sessionId,'register',input.challengeId)
 let result;try{result=await verifyRegistration(input,{challenge:challengeValue,...rp(env)})}catch(error){if(error instanceof PasskeyError)throw new HttpError(403,'invalid_passkey','That passkey could not be verified.');throw error}
 if(await env.DB.prepare('SELECT 1 AS x FROM mallet_factors WHERE credential_id=?').bind(result.credentialId).first())throw new HttpError(409,'passkey_registered','That passkey is already registered.')
 return enroll(env,who,sessionId,{id:crypto.randomUUID(),kind:'passkey',label:label(input.label,'Passkey'),credentialId:result.credentialId,publicKey:result.publicKey,count:result.signCount},'passkey')
}
export async function passkeyAssertOptions(env:Bindings,who:Who,sessionId:string){
 const list=(await env.DB.prepare('SELECT credential_id AS id FROM mallet_factors WHERE operator_id=? AND kind=? AND revoked_at IS NULL').bind(who.id,'passkey').all<{id:string}>()).results
 if(!list.length)throw new HttpError(409,'no_passkey','No passkey is registered for this person.')
 const {id,challenge:value}=await challenge(env,who,sessionId,'assert')
 return {challengeId:id,publicKey:{challenge:value,rpId:rp(env).rpId,allowCredentials:list.map(x=>({type:'public-key',id:x.id})),userVerification:'required',timeout:60000}}
}
export async function passkeyAssert(env:Bindings,who:Who,sessionId:string,input:any){
 const key='factor:'+who.id;await spendAttempt(env.DB,key)
 const challengeValue=await consumeChallenge(env,who,sessionId,'assert',input.challengeId)
 const stored=await env.DB.prepare('SELECT id,public_key AS publicKey,sign_count AS signCount FROM mallet_factors WHERE operator_id=? AND kind=? AND credential_id=? AND revoked_at IS NULL').bind(who.id,'passkey',String(input.id??'')).first<{id:string;publicKey:string;signCount:number}>()
 let count:number;try{if(!stored)throw new PasskeyError('credential');count=await verifyAssertion(input,stored,{challenge:challengeValue,...rp(env)})}catch(error){if(error instanceof PasskeyError)throw new HttpError(403,'invalid_passkey','That passkey could not be verified.');throw error}
 const moved=await env.DB.prepare('UPDATE mallet_factors SET sign_count=?1,last_used_at=?2 WHERE id=?3 AND revoked_at IS NULL AND ((?1=0 AND sign_count=0) OR ?1>sign_count)').bind(count,Date.now(),stored.id).run()
 if(!moved.meta.changes)throw new HttpError(403,'invalid_passkey','That passkey could not be verified.')
 await prove(env.DB,sessionId,who.id,'passkey',true);await clearAttempts(env.DB,key)
 return {proven:true,method:'passkey'}
}
// ---- code verification
export async function verifyTotp(env:Bindings,who:Who,sessionId:string,code:unknown){
 const key='factor:'+who.id;await spendAttempt(env.DB,key)
 const list=(await env.DB.prepare('SELECT id,secret_box AS box,last_step AS lastStep FROM mallet_factors WHERE operator_id=? AND kind=? AND revoked_at IS NULL').bind(who.id,'totp').all<{id:string;box:string;lastStep:number}>()).results
 for(const f of list){
  const step=await matchStep(await open(env,'totp',who.id,f.box),String(code??''),Date.now())
  if(step===null||step<=Number(f.lastStep))continue
  const used=await env.DB.prepare('UPDATE mallet_factors SET last_step=?,last_used_at=? WHERE id=? AND revoked_at IS NULL AND (last_step IS NULL OR last_step<?)').bind(step,Date.now(),f.id,step).run()
  if(!used.meta.changes)continue
  await prove(env.DB,sessionId,who.id,'totp',true);await clearAttempts(env.DB,key)
  return {proven:true,method:'totp'}
 }
 throw new HttpError(403,'invalid_code','That code is not valid.')
}
/** A recovery code opens this session once; it never counts as a fresh step-up proof. */
export async function verifyRecovery(env:Bindings,who:Who,sessionId:string,code:unknown){
 const key='factor:'+who.id;await spendAttempt(env.DB,key)
 const used=await env.DB.prepare('UPDATE mallet_recovery_codes SET used_at=? WHERE code_hash=? AND operator_id=? AND used_at IS NULL').bind(Date.now(),await recoveryHash(env,String(code??'')),who.id).run()
 if(!used.meta.changes)throw new HttpError(403,'invalid_code','That code is not valid.')
 await prove(env.DB,sessionId,who.id,'recovery',false);await clearAttempts(env.DB,key)
 await audit(env.DB,who.id,'recovery.used',{remaining:await recoveryRemaining(env.DB,who.id)}).run()
 await notifyRecovery(env,who,who,'single-use recovery code')
 return {proven:true,method:'recovery',recoveryRemaining:await recoveryRemaining(env.DB,who.id)}
}
// ---- management (callers have already required a fresh step-up)
export async function removeFactor(env:Bindings,who:Who,id:unknown){
 const list=await factors(env.DB,who.id),target=list.find(f=>f.id===id)
 if(!target)throw new HttpError(404,'not_found')
 if(list.length===1&&(await policy(env.DB)).requireAll)throw new HttpError(409,'last_factor','The shop requires a second factor, so the last one cannot be removed.')
 await env.DB.batch([env.DB.prepare('UPDATE mallet_factors SET revoked_at=? WHERE id=?').bind(Date.now(),target.id),...(list.length===1?[env.DB.prepare('DELETE FROM mallet_recovery_codes WHERE operator_id=?').bind(who.id)]:[]),audit(env.DB,who.id,'factor.removed',{factorId:target.id,kind:target.kind})])
 return {removed:target.id}
}
export async function setPolicy(env:Bindings,owner:Who,requireAll:unknown){
 if(typeof requireAll!=='boolean')throw new HttpError(400,'invalid_policy')
 if(requireAll&&!(await factors(env.DB,owner.id)).length)throw new HttpError(409,'owner_factor_required','Enrol your own second factor before requiring one for everyone.')
 const now=Date.now()
 await env.DB.batch([env.DB.prepare('INSERT INTO mallet_auth_policy(singleton,require_all,version,updated_by,updated_at) VALUES(1,?,1,?,?) ON CONFLICT(singleton) DO UPDATE SET require_all=excluded.require_all,version=mallet_auth_policy.version+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(requireAll?1:0,owner.id,now),audit(env.DB,owner.id,'policy.changed',{requireAll})])
 return policy(env.DB)
}
/** Remove every second factor and recovery code of a person and end their other sessions; the audit names who did it. */
export async function resetFactors(env:Bindings,by:Who,target:Who,keepSession:string|null,reason:string){
 await env.DB.batch([
  env.DB.prepare('UPDATE mallet_factors SET revoked_at=? WHERE operator_id=? AND revoked_at IS NULL').bind(Date.now(),target.id),
  env.DB.prepare('DELETE FROM mallet_recovery_codes WHERE operator_id=?').bind(target.id),env.DB.prepare('DELETE FROM mallet_totp_pending WHERE operator_id=?').bind(target.id),
  env.DB.prepare('DELETE FROM mallet_session_proofs WHERE operator_id=? AND session_id IS NOT ?').bind(target.id,keepSession),
  env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE operator_id=? AND id IS NOT ? AND revoked_at IS NULL').bind(Date.now(),target.id,keepSession),
  audit(env.DB,by.id,'factors.reset',{targetId:target.id,reason}),
 ])
 await notifyRecovery(env,by,target,reason)
 return {reset:target.id}
}
