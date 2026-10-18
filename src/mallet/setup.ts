import {firstRunResponse as baseFirstRunResponse,needsFirstRun} from '../base/setup'
import {identity,originGuard,HttpError} from './auth'
import {execute,load,MalletError} from './model'
import {e,page,rows} from './ui/common'
import {taxFields} from './ui/tax'

/** Mallet's owner setup adds shop tax without changing Base's reusable account setup. */
export async function firstRunResponse(request:Request,bindings:any,auth:any,options:any={}) {
 if(new URL(request.url).pathname!=='/setup')return baseFirstRunResponse(request,bindings,auth,options)
 const redirect=()=>new Response(null,{status:303,headers:{location:'/app','cache-control':'no-store'}})
 try {
  const {actor,authority}=await identity(request,bindings)
  originGuard(request,bindings)
  if(!['GET','HEAD','POST'].includes(request.method))throw new HttpError(405,'method_not_allowed')
  const session=await auth.getSession(request)
  if(actor.role!=='owner'||!await needsFirstRun(bindings,session))return redirect()
  if(request.method==='POST') {
   if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new HttpError(415,'form_required')
   const fields=await request.formData()
   if(fields.get('confirm')!=='yes')throw new HttpError(400,'confirmation_required')
   const rate=fields.get('ratePercent')
   await execute(bindings.DB,actor,'tax.configure',{ratePercent:typeof rate==='string'&&rate.trim()!==''?Number(rate):null,partsTaxable:fields.has('partsTaxable'),laborTaxable:fields.has('laborTaxable')},authority)
   const name=fields.get('displayName')
   if(typeof name==='string'&&name.trim()!==actor.name)await auth.changeDisplayName(request,{displayName:name})
   await bindings.DB.prepare('INSERT INTO oa_first_run (singleton, completed_by, completed_at) VALUES (1, ?, ?) ON CONFLICT(singleton) DO NOTHING').bind(actor.id,Date.now()).run()
   return redirect()
  }
  const settings=rows(await load(bindings.DB),'taxSettings')[0]
  const response=await page('Finish setup',`<section class="card"><p>Review your owner account and set your shop's sales tax before opening Mallet.</p><p>${e(session.operator.email)}</p><form method="post" action="/setup"><label>Your name<input name="displayName" required maxlength="120" autocomplete="name" value="${e(actor.name)}"></label>${taxFields(settings)}<p><label class="check"><input type="checkbox" name="confirm" value="yes" required> I confirm this owner account is ready to use.</label></p><button>Finish setup</button></form></section>`)
  return request.method==='HEAD'?new Response(null,response):response
 } catch(error) {
  if(error instanceof HttpError&&error.status===401)return new Response(null,{status:303,headers:{location:'/signin?returnTo=%2Fsetup','cache-control':'no-store'}})
  const known=error instanceof HttpError||error instanceof MalletError
  return Response.json({error:known?error.code:'setup_unavailable',message:known?error.message:'Setup is unavailable.'},{status:known?error.status:503,headers:{'cache-control':'no-store'}})
 }
}
