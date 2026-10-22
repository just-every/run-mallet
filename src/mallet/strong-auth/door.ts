// The second-factor door: /app/security for people and /api/mallet/security/* for scripts. It works before this
// session has shown its factor, and nothing here reveals shop data. Owner-only changes need a fresh proof.
import type {Bindings} from '../../auth.server'
import {runtimeBindings} from '../../auth.server'
import {identity,originGuard,HttpError,type Identity} from '../auth'
import {page} from '../ui/shell'
import {e} from '../ui/common'
import {securityPage} from '../ui/security'
import {pendingTotp,beginTotp,confirmTotp,passkeyRegisterOptions,passkeyRegister,passkeyAssertOptions,passkeyAssert,verifyTotp,verifyRecovery,removeFactor,setPolicy,resetFactors,issueRecoveryCodes,factors,recoveryRemaining,policy,audit,type Who} from './store'
import {requireStepUp} from './gate'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
async function input(request:Request){
 const type=request.headers.get('content-type')??'',text=await request.text()
 if(text.length>65536)throw new HttpError(413,'body_too_large')
 if(type.startsWith('application/json')){try{const v=JSON.parse(text);if(v&&typeof v==='object'&&!Array.isArray(v))return {form:false,value:v as any}}catch{}throw new HttpError(400,'invalid_json')}
 if(type.startsWith('application/x-www-form-urlencoded'))return {form:true,value:Object.fromEntries(new URLSearchParams(text)) as any}
 throw new HttpError(415,'json_required')
}
const localPath=(value:unknown)=>typeof value==='string'&&/^\/app(\/[A-Za-z0-9._~%\-/]*)?(\?[A-Za-z0-9._~%\-=&]*)?(#[A-Za-z0-9\-_]*)?$/.test(value)?value:'/app/security'
async function who(env:Bindings,auth:Identity):Promise<Who&{email?:string}>{
 const row=await env.DB.prepare('SELECT email FROM oa_operators WHERE id=?').bind(auth.actor.id).first<{email:string}>()
 return {id:auth.actor.id,name:auth.actor.name,role:auth.actor.role,email:row?.email}
}
const fresh=(auth:Identity)=>requireStepUp(auth)
async function status(env:Bindings,auth:Identity){
 const me=auth.actor.id,list=await factors(env.DB,me),pending=await pendingTotp(env,await who(env,auth))
 const operators=auth.actor.role==='owner'?(await env.DB.prepare("SELECT o.id,o.display_name AS name,o.role,(SELECT COUNT(*) FROM mallet_factors f WHERE f.operator_id=o.id AND f.revoked_at IS NULL) AS factors FROM oa_operators o WHERE o.status='active' ORDER BY o.created_at,o.id").all()).results:undefined
 return {actor:{id:me,name:auth.actor.name,role:auth.actor.role},policy:await policy(env.DB),factors:list,recoveryCodesRemaining:await recoveryRemaining(env.DB,me),
  session:{proven:!!auth.gate?.proven,required:!!(auth.gate?.required||auth.gate?.enrolled),stepUpUntil:auth.gate?.stepUpUntil&&auth.gate.stepUpUntil!==Infinity?auth.gate.stepUpUntil:0,deploymentRecovery:!!auth.gate?.recovery},
  pendingTotp:pending?{secret:pending.secret,uri:pending.uri}:null,operators}
}
async function act(env:Bindings,auth:Identity,action:string,body:any){
 const me=await who(env,auth),session=auth.session!,gate=auth.gate!,enrolled=gate.enrolled
 const enrolling=()=>{if(enrolled){if(!gate.proven)throw new HttpError(403,'second_factor_required','Confirm with your second factor first.');fresh(auth)}}
 switch(action){
  case 'totp/begin':enrolling();return beginTotp(env,me)
  case 'totp/confirm':enrolling();return confirmTotp(env,me,session.id,body)
  case 'passkey/register-options':enrolling();return passkeyRegisterOptions(env,me,session.id)
  case 'passkey/register':enrolling();return passkeyRegister(env,me,session.id,body)
  case 'verify/totp':if(!enrolled)throw new HttpError(409,'no_factor');return verifyTotp(env,me,session.id,body.code)
  case 'verify/recovery':if(!enrolled)throw new HttpError(409,'no_factor');return verifyRecovery(env,me,session.id,body.code)
  case 'verify/passkey-options':return passkeyAssertOptions(env,me,session.id)
  case 'verify/passkey':return passkeyAssert(env,me,session.id,body)
  case 'factors/remove':if(!gate.proven)throw new HttpError(403,'second_factor_required');fresh(auth);return removeFactor(env,me,body.id)
  case 'recovery/regenerate':if(!gate.proven)throw new HttpError(403,'second_factor_required');fresh(auth);if(!enrolled)throw new HttpError(409,'no_factor');await audit(env.DB,me.id,'recovery.regenerated',{}).run();return {recoveryCodes:await issueRecoveryCodes(env,me.id)}
  case 'policy':if(me.role!=='owner')throw new HttpError(403,'owner_required');if(!enrolled)throw new HttpError(409,'owner_factor_required','Enrol your own second factor before changing this policy.');if(!gate.proven)throw new HttpError(403,'second_factor_required');fresh(auth);return setPolicy(env,me,body.requireAll===true||body.requireAll==='yes'?true:body.requireAll===false||body.requireAll==='no'?false:body.requireAll)
  case 'reset':
   // Deployment recovery: the owner's own one-time `rer signin` link, which needs the shop's Cloudflare credentials, may start over.
   if(me.role!=='owner'||!gate.recovery)throw new HttpError(403,'recovery_required','Only an owner signed in with a deployment recovery link can reset their own second factors.')
   return resetFactors(env,me,me,session.id,'deployment-recovery')
  case 'operators/reset':{
   if(me.role!=='owner')throw new HttpError(403,'owner_required');if(!gate.proven)throw new HttpError(403,'second_factor_required');fresh(auth)
   const target=await env.DB.prepare("SELECT id,display_name AS name,role,email FROM oa_operators WHERE id=? AND status='active'").bind(String(body.operatorId??'')).first<Who>()
   if(!target||target.id===me.id)throw new HttpError(404,'not_found')
   return resetFactors(env,me,target,null,'owner-reset')
  }
 }
 throw new HttpError(404,'not_found')
}
export async function securityResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,api=path.startsWith('/api/mallet/security'),ui=path==='/app/security'||path.startsWith('/app/security/')
 if(!api&&!ui)return null
 const env=runtimeBindings(original);let auth:Identity|undefined
 try{
  auth=await identity(request,env,{pending:true});originGuard(request,env,auth.bearer)
  if(auth.bearer||!auth.session||!auth.gate)throw new HttpError(403,'human_required')
  const action=path.replace(/^\/(api\/mallet|app)\/security\/?/,'')
  if(request.method==='GET'||request.method==='HEAD'){
   if(action)throw new HttpError(404,'not_found')
   const view=await status(env,auth)
   return api?json(view):page('Security',securityPage(view,{notice:url.searchParams.get('notice')??'',returnTo:localPath(url.searchParams.get('returnTo')),stepUp:url.searchParams.has('stepUp')}),auth.actor,200,{section:null,security:true})
  }
  if(request.method!=='POST')throw new HttpError(405,'method_not_allowed')
  const {form,value}=await input(request),result=await act(env,auth,action,value)
  if(api&&!form)return json(result)
  const back=localPath(value.returnTo),codes=(result as any).recoveryCodes
  if(action.startsWith('verify/'))return new Response(null,{status:303,headers:{...headers,location:back==='/app/security'?'/app/security?notice=verified':back}})
  if(codes){const view=await status(env,auth);return page('Security',securityPage({...view,session:{...view.session,proven:true}},{notice:'recovery',codes,returnTo:back,stepUp:false}),auth.actor,200,{section:null,security:true})}
  return new Response(null,{status:303,headers:{...headers,location:'/app/security?notice='+encodeURIComponent(action.replace('/','-'))}})
 }catch(error:any){
  if(!(error instanceof HttpError))throw error
  if(api)return json({error:error.code,message:error.message},error.status)
  if(error.status===401)return new Response(null,{status:303,headers:{...headers,location:'/signin?returnTo='+encodeURIComponent(path)}})
  return page('Security',`<section class="card"><p>${e(error.message)}</p><p><a href="/app/security">Back to security</a></p></section>`,auth?.actor,error.status,{section:null})
 }
}
