import {runtimeBindings,type Bindings} from '../../auth.server'
import {identity,originGuard, HttpError} from '../auth'
import {requireStepUp} from '../strong-auth/gate'
import {page} from '../ui/shell'
import {e} from '../ui/common'
import {jobsPage} from '../ui/jobs'
import {jobDiagnostics,readJob} from './store'
import {recoverJob} from './recovery'
import {enqueuePaymentCheck,recoverPaymentCheck} from './provider-check'
const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}
export async function jobsResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),api=url.pathname.startsWith('/api/mallet/jobs'),ui=url.pathname.startsWith('/app/background-jobs')
 if(!api&&!ui)return null
 const env=runtimeBindings(original);let actor
 try{
  const auth=await identity(request,env);actor=auth.actor;originGuard(request,env,auth.bearer)
  if(actor.role!=='owner')throw new HttpError(403,'owner_required')
  const root=api?'/api/mallet/jobs':'/app/background-jobs',action=url.pathname.slice(root.length)
  if(['GET','HEAD'].includes(request.method)&&!action){
   const diagnostics=await jobDiagnostics(env.DB)
   if(api)return Response.json(diagnostics,{headers})
   const invoices=(await env.DB.prepare("SELECT value FROM mallet_records WHERE kind='invoice' AND json_extract(value,'$.status') IN ('approved','exported') ORDER BY id DESC LIMIT 50").all<{value:string}>()).results.map(row=>JSON.parse(row.value))
   return page('Background jobs',jobsPage(diagnostics,invoices),actor,200,{section:'data'})
  }
  if(request.method!=='POST'||!['/recover','/payment-check'].includes(action))throw new HttpError(405,'method_not_allowed')
  const form=!api;let input:any
  if(form){const data=await request.formData();input=Object.fromEntries(data);input.consent=input.consent==='yes';if(input.invoiceSource){try{const source=JSON.parse(input.invoiceSource);input.invoiceId=source.id;input.version=source.version}catch{throw new HttpError(400,'invoice_required')}}}
  else{const text=await request.text();if(text.length>16384)throw new HttpError(413,'body_too_large');try{input=JSON.parse(text)}catch{throw new HttpError(400,'invalid_json')}}
  auth.authority=requireStepUp(auth)
  const result=action==='/payment-check'?await enqueuePaymentCheck(env,actor,auth.authority,input):
   (await readJob(env.DB,String(input.id))).kind==='stripe-payment-check'?await recoverPaymentCheck(env,actor,auth.authority,input):await recoverJob(env.DB,actor,auth.authority,input)
  if(api)return Response.json(result,{headers})
  return new Response(null,{status:303,headers:{...headers,location:'/app/background-jobs'}})
 }catch(error:any){
  const status=error.status??500,code=error.code??'jobs_unavailable',message=status<500?error.message:'Background jobs are unavailable.'
  if(api)return Response.json({error:code,message},{status,headers})
  if(code==='second_factor_required'||code==='step_up_required')return new Response(null,{status:303,headers:{...headers,location:'/app/security?'+(code==='step_up_required'?'stepUp=1&':'')+'returnTo=%2Fapp%2Fbackground-jobs'}})
  if(status===401)return new Response(null,{status:303,headers:{...headers,location:'/signin?returnTo=%2Fapp%2Fbackground-jobs'}})
  return page('Background jobs',`<section class="card"><p>${e(message)}</p><p><a href="/app/background-jobs">Return to background jobs</a></p></section>`,actor,status,{section:'data'})
 }
}
