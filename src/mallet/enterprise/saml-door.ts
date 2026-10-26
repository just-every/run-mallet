import type {Bindings} from '../../auth.server'
import {operatorAuth,runtimeBindings,authConfig} from '../../auth.server'
import {createAdmission} from '../../modules/operator-auth/identity/index.mjs'
import type {ProviderEntry} from '../../modules/operator-auth/index.mjs'
import {digest,HttpError} from '../auth'
import {configuredSaml,type EnterpriseSaml} from './saml-config'
import {enterpriseSessionAllowed} from './session'
import {authorizationRequest,consumeAssertion,clearBindingCookie,metadata} from './saml'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
async function enabled(env:Bindings,p:EnterpriseSaml){
 const hash=await digest(p.certificate)
 return env.DB.prepare("SELECT c.* FROM mallet_enterprise_connections c JOIN oa_operators o ON o.id=c.owner_id JOIN oa_auth_settings a ON a.singleton=1 WHERE c.provider=? AND c.protocol='saml' AND c.issuer=? AND c.client_id=? AND c.certificate_hash=? AND c.enabled=1 AND o.status='active' AND o.role='owner' AND o.version=c.owner_version AND a.idp_sign_in=1").bind(p.id,p.issuer,p.audience,hash).first<any>()
}
async function start(env:Bindings,p:EnterpriseSaml,request:Request){
 if(!await enabled(env,p))throw new HttpError(403,'enterprise_provider_unavailable')
 const key=await digest('saml-start\0'+p.id+'\0'+(request.headers.get('cf-connecting-ip')??'local')),window=Math.floor(Date.now()/900000)
 const rate=await env.DB.prepare('INSERT INTO mallet_rate(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END RETURNING count').bind(key,window).first<number>('count')
 if(Number(rate)>30)throw new HttpError(429,'rate_limited')
 const text=await request.text();if(text.length>4096)throw new HttpError(413,'body_too_large')
 let input:any
 try{input=request.headers.get('content-type')?.startsWith('application/json')?JSON.parse(text):Object.fromEntries(new URLSearchParams(text))}catch{throw new HttpError(400,'invalid_input')}
 return authorizationRequest(env,p,request,input.returnTo??'/app')
}
async function callback(env:Bindings,p:EnterpriseSaml,request:Request){
 const connection=await enabled(env,p);if(!connection)throw new HttpError(403,'enterprise_provider_unavailable')
 const verified=await consumeAssertion(env,p,request),auth=await operatorAuth(env)
 const user=await env.DB.prepare("SELECT u.* FROM mallet_enterprise_users u JOIN oa_operators o ON o.id=u.id WHERE u.provider=? AND u.external_id=? AND u.active=1 AND o.role='member' AND o.status='active'").bind(p.id,verified.subject).first<any>()
 if(!user)throw new HttpError(403,'enterprise_identity_required')
 const admission=createAdmission({accounts:auth.accounts,config:authConfig(env),hooks:{afterConfirm:async({session,operator})=>{
  await env.DB.prepare("INSERT INTO mallet_saml_sessions(session_id,provider,issuer,subject,connection_revision,certificate_hash) SELECT ?,c.provider,c.issuer,u.external_id,c.revision,c.certificate_hash FROM mallet_enterprise_connections c JOIN mallet_enterprise_users u ON u.provider=c.provider JOIN oa_operators owner ON owner.id=c.owner_id JOIN oa_sessions s ON s.id=? WHERE c.provider=? AND c.enabled=1 AND c.revision=? AND c.certificate_hash=? AND owner.role='owner' AND owner.status='active' AND owner.version=c.owner_version AND u.id=? AND u.active=1 AND s.operator_id=u.id AND s.revoked_at IS NULL").bind(session.id,session.id,p.id,connection.revision,connection.certificate_hash,user.id).run()
  if(!await enterpriseSessionAllowed(env,{...session,operator}))throw new HttpError(403,'enterprise_authority_changed')
  await env.DB.prepare('INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),user.id,'mallet:enterprise.signin',JSON.stringify({provider:p.id,protocol:'saml',mappingRevision:connection.revision}),Date.now()).run()
 }}})
 const completed=await admission.admit(request,{issuer:verified.issuer,subject:verified.subject,provider:p.id,associatedEmail:user.email,emailVerified:false},{returnTo:verified.returnTo})
 const out=new Headers({...headers,location:completed.returnTo});out.append('set-cookie',completed.cookie);out.append('set-cookie',clearBindingCookie(p));return new Response(null,{status:303,headers:out})
}
export async function samlResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url);if(!url.pathname.startsWith('/auth/saml/'))return null
 const env=runtimeBindings(original);let provider:EnterpriseSaml|undefined
 try{
  const match=url.pathname.match(/^\/auth\/saml\/(enterprise-[a-z][a-z0-9-]{0,20})\/(start|acs|metadata)$/)
  provider=match?configuredSaml(env).find(p=>p.id===match[1]):undefined
  if(!match||!provider)throw new HttpError(404,'not_found')
  if(match[2]==='metadata'){if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'method_not_allowed');return new Response(request.method==='HEAD'?null:metadata(provider),{headers:{...headers,'content-type':'application/samlmetadata+xml'}})}
  return match[2]==='start'?await start(env,provider,request):await callback(env,provider,request)
 }catch(error:any){const out=new Headers({...headers,'content-type':'application/json'});if(provider)out.append('set-cookie',clearBindingCookie(provider));return new Response(JSON.stringify({error:error instanceof HttpError?error.code:'saml_sign_in_refused'}),{status:error instanceof HttpError?error.status:400,headers:out})}
}
export async function samlSignInAuth(env:Bindings,auth:Awaited<ReturnType<typeof operatorAuth>>){
 const choices:(ProviderEntry&{authorizationOrigins:string[]})[]=[]
 for(const p of configuredSaml(env))if(await enabled(env,p))choices.push({id:p.id,label:p.label,preset:p.preset,startPath:'/auth/saml/'+p.id+'/start',visible:true,linked:true,pendingRelink:false,authorizationOrigins:[new URL(p.ssoUrl).origin]})
 if(!choices.length)return auth
 return {...auth,providers:{...auth.providers!,list:async()=>[...await auth.providers!.list(),...choices]}}
}
