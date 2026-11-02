import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {digest,type Actor,type Authority} from './auth'
import {execute,fail,find,load,rows,type Row,type State} from './model'
import {currentReviewConsent} from './reviews'
import {e} from './ui/common'

const scheduler={id:'mallet-review-mail',name:'Review email handoff',role:'system' as const}
const secret=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
export const reviewOwnerAuthority=(actor:Actor,authority:Authority):Authority=>({sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,params:[...authority.params,actor.id]})
export async function reviewState(env:Bindings,state:State,actor:Actor):Promise<State>{
 if(actor.role!=='owner')return state
 const local=await env.DB.prepare("SELECT a.consent_id FROM mallet_review_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE o.id=? AND o.version=a.owner_version AND o.role='owner' AND o.status='active'").bind(actor.id).all<{consent_id:string}>()
 const ids=new Set(local.results.map(r=>r.consent_id))
 return {...state,records:{...state.records,reviewConsent:rows(state,'reviewConsent').map(c=>({...c,localAuthority:ids.has(c.id)}))}}
}
export async function reviewCommand(original:Bindings,actor:Actor,authority:Authority,command:string,input:any){
 const env=runtimeBindings(original)
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner handles review requests.',null,403)
 const grant=reviewOwnerAuthority(actor,authority)
 if(command==='review.consent'){
  const row=await execute(env.DB,actor as any,command,input,grant)
  await env.DB.prepare(`INSERT INTO mallet_review_authority SELECT ?,id,version FROM oa_operators WHERE id=? AND (${grant.sql})`).bind(row.id,actor.id,...grant.params).run()
  return row
 }
 if(command!=='review.send')return execute(env.DB,actor as any,command,input,grant)
 const local={sql:`(${grant.sql}) AND EXISTS(SELECT 1 FROM mallet_review_authority a JOIN oa_operators o ON o.id=a.owner_id WHERE a.consent_id=? AND o.id=? AND o.version=a.owner_version AND o.role='owner' AND o.status='active')`,params:[...grant.params,input.consentId,actor.id]}
 // The durable business claim precedes every possible provider handoff. No retry door exists.
 let row:Row=await execute(env.DB,actor as any,command,input,local)
 let status='uncertain',provider='mail',providerReference=''
 try{
  const token=secret()
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${local.sql}) THEN 1 ELSE 0 END`).bind(...local.params),
   env.DB.prepare('INSERT INTO mallet_review_tokens(request_id,token_hash,job_id) VALUES(?,?,?)').bind(row.id,await digest(token),row.jobId),
   env.DB.prepare('DELETE FROM mallet_assert')
  ])
  const state=await load(env.DB),consent=find(state,'reviewConsent',row.consentId)
  currentReviewConsent(state,consent)
  if(consent.version!==row.consentVersion||!await env.DB.prepare(`SELECT 1 AS ok WHERE (${local.sql})`).bind(...local.params).first())throw Error('Review permission changed')
  const text=row.content.replace('[private feedback link]',`${env.AUTH_ORIGIN}/review/${token}`),mail=operatorMail(env)
  if(!mail){status='failed';provider='unavailable'}
  else{
   const result=await mail.send({deliveryId:row.id,from:String(env.MAIL_FROM??''),to:[row.to],subject:'Your repair visit: review and private feedback',text,html:'<p>'+e(text).replaceAll('\n','<br>')+'</p>',headers:{}})
   status=['rejected','rate_limited','unavailable'].includes(result.status)?'failed':result.status
   if(!['accepted','development','failed','uncertain'].includes(status))status='uncertain'
   provider=result.provider??'mail';providerReference=result.providerMessageId??''
  }
 }catch{status='uncertain'}
 // A concurrent feedback submission can advance the request version during mail handoff.
 row=find(await load(env.DB),'reviewRequest',row.id)
 if(row.status==='claimed')row=await execute(env.DB,scheduler,'review.outcome',{id:row.id,version:row.version,status,provider,providerReference})
 return row
}
