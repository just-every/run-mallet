import {runtimeBindings,type Bindings} from '../auth.server'
import {identity,originGuard,HttpError} from './auth'
import {requireStepUp} from './strong-auth/gate'
import {open,seal,b64} from './strong-auth/secret-box'
import {execute,load} from './model'
import {webhookHealth} from './webhooks'
const system={id:'webhook-scheduler',name:'Webhook scheduler',role:'system' as const}
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}
function endpoint(value:unknown){
 let url:URL;try{url=new URL(String(value))}catch{throw new HttpError(400,'invalid_endpoint')}
 // Refuse literal addresses, local names and credentials; redirects never follow.
 if(url.protocol!=='https:'||url.port&&url.port!=='443'||url.username||url.password||url.hash||url.search||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)||/(^|\.)(localhost|local|internal|test|invalid|example)$/i.test(url.hostname))throw new HttpError(400,'public_https_endpoint_required')
 return url.href
}
async function keyAuthority(env:Bindings,id:string){
 return env.DB.prepare("SELECT a.* FROM mallet_webhook_authority a JOIN oa_operators o ON o.id=a.owner_id AND o.version=a.owner_version AND o.status='active' AND o.role='owner' WHERE a.id=?").bind(id).first<any>()
}
export async function webhookResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),root='/api/mallet/webhooks';if(url.pathname!==root&&!url.pathname.startsWith(root+'/'))return null
 const env=runtimeBindings(original)
 try{
  const auth=await identity(request,env);originGuard(request,env,auth.bearer)
  if(auth.actor.role!=='owner')throw new HttpError(403,'owner_required')
  const action=url.pathname.slice(root.length)
  if(request.method==='GET'&&!action){
   const health=webhookHealth(await load(env.DB));const configured=(await env.DB.prepare("SELECT a.id,a.key_version FROM mallet_webhook_authority a JOIN oa_operators o ON o.id=a.owner_id AND o.version=a.owner_version AND o.status='active' AND o.role='owner'").all<any>()).results
   return Response.json({...health,health:health.health.map(s=>({...s,hasCurrentAuthority:configured.some(a=>a.id===s.id),keyVersion:configured.find(a=>a.id===s.id)?.key_version??null}))},{headers})
  }
  if(request.method!=='POST'||!['/subscribe','/rotate','/stop','/replay','/deliver'].includes(action))throw new HttpError(405,'method_not_allowed')
  const raw=await request.text();if(raw.length>16384)throw new HttpError(413,'body_too_large')
  let p:any;try{p=JSON.parse(raw);if(!p||typeof p!=='object'||Array.isArray(p))throw Error()}catch{throw new HttpError(400,'invalid_json')}
  const authority=requireStepUp(auth)
  if(action==='/deliver'){await runWebhooks(env,Date.now());return Response.json(webhookHealth(await load(env.DB)),{headers})}
  if(action==='/stop'||action==='/replay'){
   if(action==='/replay'&&!await keyAuthority(env,String((await load(env.DB)).records.webhookDelivery?.find(d=>d.id===p.id)?.subscriptionId)))throw new HttpError(409,'fresh_endpoint_authority_required')
   const result=await execute(env.DB,auth.actor,'webhook.'+action.slice(1),p,authority)
   if(action==='/stop')await env.DB.prepare('DELETE FROM mallet_webhook_authority WHERE id=?').bind(result.id).run()
   return Response.json(result,{headers})
  }
  let id=String(p.id??''),target:string
  if(action==='/subscribe')target=endpoint(p.endpoint)
  else {const existing=await keyAuthority(env,id);if(!existing)throw new HttpError(404,'not_found');target=existing.endpoint}
  const signingKey=b64(crypto.getRandomValues(new Uint8Array(32)))
  if(action==='/subscribe')id=(await execute(env.DB,auth.actor,'webhook.subscribe',p,authority)).id
  const sealed=await seal(env,'webhook',id,new TextEncoder().encode(signingKey)),owner=await env.DB.prepare('SELECT version FROM oa_operators WHERE id=?').bind(auth.actor.id).first<{version:number}>()
  await env.DB.batch([env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params),env.DB.prepare('INSERT INTO mallet_webhook_authority(id,endpoint,sealed,key_version,owner_id,owner_version) VALUES(?,?,?,1,?,?) ON CONFLICT(id) DO UPDATE SET sealed=excluded.sealed,key_version=key_version+1,owner_id=excluded.owner_id,owner_version=excluded.owner_version').bind(id,target,sealed,auth.actor.id,owner!.version),env.DB.prepare('INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),auth.actor.id,'webhook.key'+(action==='/rotate'?'.rotated':'.created'),JSON.stringify({id}),Date.now()),env.DB.prepare('DELETE FROM mallet_assert')])
  const saved=await keyAuthority(env,id)
  return Response.json({id,signingKey,keyVersion:saved.key_version},{headers})
 }catch(error:any){const status=error.status??500;return Response.json({error:status<500?error.code??'webhook_refused':'webhooks_unavailable',message:status<500?error.message:'Webhooks unavailable.'},{status,headers})}
}
export async function runWebhooks(original:Bindings,now=Date.now()){
 const env=runtimeBindings(original),at=new Date(now).toISOString(),s=await load(env.DB),subscriptions=s.records.webhookSubscription??[]
 // A bounded batch; an interrupted handoff is uncertain and requires explicit owner recovery.
 for(const candidate of (s.records.webhookDelivery??[]).filter(d=>d.status==='pending'&&d.dueAt<=at||d.status==='claimed'&&now-Date.parse(d.claimedAt)>=60000).slice(0,20)){
  let claim:any
  try{claim=await execute(env.DB,system,'webhook.claim',{id:candidate.id,version:candidate.version},undefined,at)}catch(error:any){if(['VERSION','STATE','CONCURRENT_CHANGE'].includes(error.code))continue;throw error}
  if(claim.status!=='claimed')continue
  const authority=await keyAuthority(env,claim.subscriptionId),subscription=subscriptions.find(s=>s.id===claim.subscriptionId)
  let outcome='blocked',httpStatus:number|null=null,keyVersion:number|null=null
  if(authority&&subscription?.active){
   // Re-read stop and current key immediately before handoff. Never use archived authority.
   const live=(await load(env.DB)).records.webhookSubscription?.find(s=>s.id===claim.subscriptionId),current=await keyAuthority(env,claim.subscriptionId)
   if(live?.active&&current){
    keyVersion=current.key_version
    const secret=await open(env,'webhook',claim.subscriptionId,current.sealed),body=JSON.stringify(claim.envelope),key=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))),v=>v.toString(16).padStart(2,'0')).join('')
    try{
     const response=await fetch(current.endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json','x-mallet-signature':signature,'x-mallet-key-version':String(keyVersion),'x-mallet-event-id':claim.eventId},body})
     httpStatus=response.status;await response.body?.cancel()
     outcome=response.ok?'delivered':response.status===429||response.status>=500?'retry':'failed'
    }catch{outcome='uncertain'}
   }
  }
  await execute(env.DB,system,'webhook.outcome',{id:claim.id,version:claim.version,claimId:claim.claimId,outcome,httpStatus,keyVersion},undefined,at)
 }
}
