// The connector pages: /connectors publishes every declaration to anyone; /app/connectors and the API show the owner and advisors
// which credentials are in use (fingerprint only) and let the owner save, rotate or revoke them through the command door.
import type {Bindings} from '../../auth.server'
import {runtimeBindings} from '../../auth.server'
import {identity,originGuard,human,HttpError} from '../auth'
import {page} from '../ui/shell'
import {connectorsPage,publishedConnectors} from '../ui/connectors'
import {CONNECTORS} from './registry'
import {connectorStatus} from './secrets'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
export async function connectorsResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,env=runtimeBindings(original)
 if(path==='/connectors'){
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers})
  return page('Connectors',publishedConnectors(),undefined,200,{section:null})
 }
 if(path!=='/app/connectors'&&path!=='/api/mallet/connectors')return null
 try{
  const auth=await identity(request,env);originGuard(request,env,auth.bearer)
  if(!human(auth.actor))throw new HttpError(403,'manager_required')
  if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'method_not_allowed')
  const status=await connectorStatus(env)
  if(path.startsWith('/api/'))return Response.json({declarations:CONNECTORS,secrets:Object.values(status).map((s:any)=>({connector:s.connector,name:s.name,status:s.status,version:s.version,fingerprint:s.fingerprint,changedAt:s.changedAt}))},{headers})
  return page('Connectors',connectorsPage(auth.actor,status),auth.actor,200,{section:'data'})
 }catch(error:any){
  if(!(error instanceof HttpError))throw error
  if(path.startsWith('/api/'))return Response.json({error:error.code,message:error.message},{status:error.status,headers})
  if(error.status===401)return new Response(null,{status:303,headers:{...headers,location:'/signin?returnTo='+encodeURIComponent(path)}})
  if(error.code==='second_factor_required')return new Response(null,{status:303,headers:{...headers,location:'/app/security?returnTo=%2Fapp%2Fconnectors'}})
  return page('Connectors',`<section class="card"><p>${error.message}</p></section>`,undefined,error.status,{section:null})
 }
}
