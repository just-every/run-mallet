import type {Bindings} from '../../auth.server'
import {runtimeBindings} from '../../auth.server'
import {HttpError,identity,originGuard} from '../auth'
import {page} from '../ui/shell'
import {e} from '../ui/common'
import {enterprisePage} from '../ui/enterprise'
import {configuredProviders} from './config'
import {configureConnection,scimConnection} from './store'
import {resource,writeUser,patched,listUsers} from './scim'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
const json=(value:any,status=200,scim=false)=>new Response(status===204?null:JSON.stringify(value),{status,headers:{...headers,'content-type':scim?'application/scim+json':'application/json'}})
async function body(request:Request){const raw=await request.text();if(raw.length>16384)throw new HttpError(413,'body_too_large');try{const v=JSON.parse(raw);if(v&&typeof v==='object'&&!Array.isArray(v))return v}catch{}throw new HttpError(400,'invalid_json')}
async function view(env:Bindings){return {providers:configuredProviders(env).map(({id,label,preset,issuer,protocol})=>({id,label,preset,issuer,protocol})),connections:(await env.DB.prepare('SELECT provider,enabled,revision FROM mallet_enterprise_connections').all<any>()).results,users:(await env.DB.prepare('SELECT * FROM mallet_enterprise_users ORDER BY display_name').all<any>()).results}}
export async function enterpriseResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),scim=url.pathname.startsWith('/scim/'),ui=url.pathname==='/app/enterprise'||url.pathname.startsWith('/app/enterprise/'),api=url.pathname==='/api/mallet/enterprise'||url.pathname.startsWith('/api/mallet/enterprise/')
 if(!scim&&!ui&&!api)return null
 const env=runtimeBindings(original);let actor:any
 try{
  if(scim){
   if(url.origin!==env.AUTH_ORIGIN||request.headers.get('sec-fetch-site')==='cross-site')throw new HttpError(403,'invalid_origin')
   const match=url.pathname.match(/^\/scim\/v2\/(enterprise-[a-z][a-z0-9-]{0,20})\/(Users|ServiceProviderConfig)(?:\/([A-Za-z0-9-]{1,64}))?$/)
   if(!match)throw new HttpError(404,'not_found')
   const c=await scimConnection(env,request,match[1]),id=match[3]
   if(match[2]==='ServiceProviderConfig'){if(request.method!=='GET'||id)throw new HttpError(405,'method_not_allowed');return json({schemas:['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],patch:{supported:true},filter:{supported:true,maxResults:100},bulk:{supported:false},sort:{supported:false},changePassword:{supported:false},etag:{supported:false},authenticationSchemes:[{type:'oauthbearertoken',name:'Owner-approved SCIM token',description:'Dedicated connection credential',primary:true}]},200,true)}
   const user=id?await env.DB.prepare('SELECT * FROM mallet_enterprise_users WHERE id=? AND provider=?').bind(id,c.provider).first<any>():null
   if(id&&!user)throw new HttpError(404,'not_found')
   if(request.method==='GET')return json(user?resource(user):await listUsers(env.DB,c,url),200,true)
   if(request.method==='POST'&&!id)return json(await writeUser(env,c,await body(request)),201,true)
   if(['PATCH','PUT'].includes(request.method)&&user){const input=await body(request);return json(await writeUser(env,c,request.method==='PATCH'?patched(input,user):input,user),200,true)}
   if(request.method==='DELETE'&&user){await writeUser(env,c,{userName:user.email,externalId:user.external_id,active:false},user);return json(null,204,true)}
   throw new HttpError(405,'method_not_allowed')
  }
  const auth=await identity(request,env);actor=auth.actor;originGuard(request,env,auth.bearer)
  if(actor.role!=='owner'||auth.bearer)throw new HttpError(403,'owner_required')
  if(request.method==='GET'&&(url.pathname==='/app/enterprise'||url.pathname==='/api/mallet/enterprise')){const v=await view(env);return api?json(v):page('Enterprise sign-in',enterprisePage(v),actor,200,{section:null})}
  if(request.method!=='POST')throw new HttpError(405,'method_not_allowed')
  const action=url.pathname.split('/').at(-1)!,form=request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'),raw=form?await request.text():null
  if(raw&&raw.length>16384)throw new HttpError(413,'body_too_large')
  const input=form?Object.fromEntries(new URLSearchParams(raw!)):await body(request),result=await configureConnection(env,auth,action,input)
  const token='token' in result?result.token:undefined
  return api?json(result):page('Enterprise sign-in',enterprisePage({...await view(env),notice:token?'Connection credential created. Copy it now.':'Connection revoked.'},token),actor,200,{section:null})
 }catch(error:any){
  if(!(error instanceof HttpError))throw error
  if(scim)return json({schemas:['urn:ietf:params:scim:api:messages:2.0:Error'],status:String(error.status),detail:error.code},error.status,true)
  if(api)return json({error:error.code,message:error.message},error.status)
  if(error.status===401)return new Response(null,{status:303,headers:{...headers,location:'/signin?returnTo=%2Fapp%2Fenterprise'}})
  return page('Enterprise sign-in',`<section class="card"><p>${e(error.message)}</p><p><a href="/app/enterprise">Back to enterprise sign-in</a></p><p><a href="/app/security">Open security</a></p></section>`,actor,error.status,{section:null})
 }
}
