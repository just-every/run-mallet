import type { Bindings } from '../auth.server'
import { runtimeBindings } from '../auth.server'
import { createPortability, createPortabilityHandler } from '@runeditrun/rer/modules/portability'
import policy from './archive-policy.mjs'
import {identity,originGuard,human,agentKey,HttpError,type Actor} from './auth'
import {execute,load,MalletError,type State} from './model'
import {assetHistoryCsv} from './workshop'
import {catalogue} from './pier'
import {page,e,rows,money,when,type Names} from './ui/common'
import {conflictPage} from './ui/conflict'
import {workshop,assetPage} from './ui/workshop'
import {jobPage} from './ui/job'
import {taxPage,taxNotice,invoiceTotals,lineTax} from './ui/tax'
import {moveIn,importPreview,importJournal,dataPage} from './ui/data'
import * as imports from './imports/index'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
const redirect=(path:string)=>new Response(null,{status:303,headers:{...headers,location:path}})
const csv=(value:string,name:string)=>new Response(value,{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${name}.csv"`}})
async function textBody(request:Request) {
 const reader=request.body?.getReader();if(!reader)return ''
 const chunks:Uint8Array[]=[];let length=0
 try {for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>1024*1024)throw new HttpError(413,'body_too_large');chunks.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes)
}
async function body(request:Request) {
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'json_required')
 try { const input=JSON.parse(await textBody(request));if(!input||typeof input!=='object'||Array.isArray(input))throw Error();return input } catch(error) {if(error instanceof HttpError)throw error;throw new HttpError(400,'invalid_json')}
}
async function nativeForm(request:Request) {
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new HttpError(415,'form_required')
 const data=new FormData();for(const [key,value] of new URLSearchParams(await textBody(request)))data.append(key,value)
 return data
}
function visible(s:State,actor:Actor):State {
 if(actor.role!=='member')return s
 const jobs=rows(s,'job').filter(j=>j.technicianId===actor.id),ids=new Set(jobs.map(j=>j.id)),assets=new Set(jobs.map(j=>j.assetId))
 return {version:s.version,records:{job:jobs,asset:rows(s,'asset').filter(a=>assets.has(a.id)).map(a=>({...a,visits:a.visits.filter((id:string)=>ids.has(id))})),estimate:rows(s,'estimate').filter(x=>ids.has(x.jobId)),event:rows(s,'event').filter(x=>ids.has(x.jobId))}}
}
async function operators(db:D1Database) {
 const people=(await db.prepare("SELECT id,display_name AS name,role,status FROM oa_operators WHERE status IN ('active','invited') ORDER BY created_at,id").all<{id:string,name:string,role:string,status:string}>()).results
 return {list:people,names:Object.fromEntries(people.map(o=>[o.id,o.name])) as Names}
}
const bookingFields=['title','bayId','technicianId','startAt','endAt']
function formInput(data:FormData) {
 const input:any=Object.fromEntries(data)
 for(const name of ['version','revision','quantity'])if(input[name]!==undefined)input[name]=Number(input[name])
 if(data.has('lineIds') || input.command==='estimate.authorise')input.lineIds=data.getAll('lineIds')
 if(['estimate.prepare','estimate.revise'].includes(input.command))input.lines=['part','labor'].map(kind=>({kind,description:input[`${kind}Description`],quantity:Number(input[`${kind}Quantity`]),unitCents:Math.round(Number(input[`${kind}Price`])*100)}))
 if(input.command==='tax.configure'){input.ratePercent=input.ratePercent===''?null:Number(input.ratePercent);input.partsTaxable=data.has('partsTaxable');input.laborTaxable=data.has('laborTaxable')}
 if(input.channel)input.method=input.channel
 return input
}
export async function malletResponse(request:Request,original:Bindings):Promise<Response|null> {
 const url=new URL(request.url),path=url.pathname
 if(path!=='/app' && !path.startsWith('/app/') && !path.startsWith('/api/mallet/') && !path.startsWith('/api/portability/'))return null
 const env=runtimeBindings(original),isApi=path.startsWith('/api/')
 let actor:Actor|undefined,submitted:any
 try {
  const auth=await identity(request,env);actor=auth.actor;originGuard(request,env,auth.bearer)
  if(!['GET','POST','PUT','HEAD'].includes(request.method))throw new HttpError(405,'method_not_allowed')
  if(path.startsWith('/api/portability/')) {
   if(actor.role!=='owner')throw new HttpError(403,'owner_required')
   const handler=await createPortabilityHandler({db:env.DB,policy,appOrigin:env.AUTH_ORIGIN,authorize:async req=>{const current=await identity(req,env);originGuard(req,env,current.bearer);return current.actor.role==='owner'?current.actor.id:null}})
   return await handler(request)
  }
  if(path.startsWith('/api/mallet/imports/') || path.startsWith('/app/move-in/')) {
   if(!human(actor))throw new HttpError(403,'manager_required')
   const api=path.startsWith('/api/'),action=path.split('/').at(-1)
   if(action==='journal' && request.method==='GET') {
    const result=await imports.journal(env.DB,actor,url.searchParams.get('id')??'',auth.authority)
    return api?json(result):page('Import journal',importJournal(result),actor,200,'move-in')
   }
   if(request.method!=='POST')throw new HttpError(405,'post_required')
   const data=api?await body(request):Object.fromEntries(await nativeForm(request))
   if(action==='resume'){const result=await imports.resume(env.DB,actor,String(data.id),auth.authority);return api?json(result):redirect(`/app/move-in/journal?id=${encodeURIComponent(result.id)}`)}
   if(action==='undo') {const result=await imports.undo(env.DB,actor,String(data.id),auth.authority);return api?json(result):redirect(`/app/move-in/journal?id=${encodeURIComponent(result.id)}`)}
   const input=api?data:{customers:JSON.parse(String(data.customers)),assets:JSON.parse(String(data.assets)),fingerprint:data.fingerprint}
   if(action==='preview'){const result=await imports.preview(env.DB,actor,input,auth.authority);return api?json(result):page('Review move-in',importPreview(input,result),actor,200,'move-in')}
   if(action==='apply') {if(!api && data.confirm!=='yes')throw new HttpError(400,'confirmation_required');const result=await imports.apply(env.DB,actor,input,auth.authority);return api?json(result):redirect(`/app/move-in/journal?id=${encodeURIComponent(result.id)}`)}
   throw new HttpError(404,'not_found')
  }
  if((path==='/api/mallet/commands'||path==='/app/actions') && request.method==='POST') {
   const data=path==='/app/actions'?formInput(await nativeForm(request)):await body(request),command=String(data.command),input=data.input??data
   submitted={command,input}
   let result:any
   if(command.startsWith('agent.')) result=await agentKey(env.DB,actor,auth.authority,command,input)
   else if(command==='asset.erase') {
    if(actor.role!=='owner')throw new HttpError(403,'owner_required')
    if(input.confirm!=='ERASE')throw new HttpError(400,'confirmation_required')
    const checkpoint=await imports.portabilityCheckpoint(env.DB)
    result=await imports.erase(env.DB,actor,input.assetId,auth.authority,{nativeStatements:[{sql:"DELETE FROM mallet_records WHERE kind='event' AND json_extract(value,'$.assetId')=? AND json_extract(value,'$.jobId') IS NULL",params:[input.assetId]}],checkpoint})
   } else result=await execute(env.DB,actor as any,command,input,auth.authority)
   if(isApi)return json(result)
   if(command==='agent.create')return page('Agent key created',`<section class="card"><p>Copy this key once into your agent’s private environment. It will not be shown again.</p><pre>${e(result.token)}</pre><p>Expires ${when(new Date(result.expiresAt).toISOString(),undefined,'date-year')}</p><p class="card-foot"><a href="/app/data">Return to access</a></p></section>`,actor,200,'data')
   if(command==='asset.erase')return redirect('/app')
   if(command==='agent.revoke')return redirect('/app/data')
   if(command==='tax.configure')return redirect('/app/tax?saved=1')
   if(command==='asset.create')return redirect(`/app/assets/${result.id}`)
   const jobId=command==='job.book'?result.id:input.jobId??result.jobId??(command==='invoice.export'?rows(await load(env.DB),'invoice').find(i=>i.id===input.invoiceId)?.jobId:undefined)
   return redirect(jobId?`/app/jobs/${jobId}`:'/app')
  }
  if(path==='/app/backup' && request.method==='POST') {
   if(actor.role!=='owner')throw new HttpError(403,'owner_required')
   const service=await createPortability({db:env.DB,policy}),id=await service.exports.create(actor.id)
   let status=await service.exports.advance(id,{maxParts:1})
   while(status.phase!=='complete')status=await service.exports.advance(id,{expectedPart:status.completed,maxParts:1})
   return new Response(await service.exports.download(id),{headers:{...headers,'content-type':'application/x-ndjson','content-disposition':'attachment; filename="workshop.rer"'}})
  }
  if(request.method!=='GET' && request.method!=='HEAD')throw new HttpError(405,'method_not_allowed')
  const state=visible(await load(env.DB),actor)
  if(path==='/api/mallet/catalogue'){if(actor.role==='member')throw new HttpError(403,'manager_required');return json(await catalogue(env))}
  if(path==='/api/mallet/state')return json({actor,...state})
  const exportMatch=path.match(/^\/api\/mallet\/exports\/([^/]+)$/)
  if(exportMatch){if(!human(actor))throw new HttpError(403,'manager_required');const x=rows(state,'export').find(x=>x.id===exportMatch[1]);if(!x)throw new HttpError(404,'not_found');return csv(x.csv,'mallet-invoice')}
  const historyMatch=path.match(/^\/api\/mallet\/assets\/([^/]+)\/history.csv$/)
  if(historyMatch)return csv(assetHistoryCsv(state,historyMatch[1]),'mallet-service-history')
  if(path==='/app')return page('Workshop',taxNotice(state,actor)+workshop(state,actor,(await operators(env.DB)).names),actor)
  if(path==='/app/tax'){if(!human(actor))throw new HttpError(403,'manager_required');return page('Shop sales tax',taxPage(state,url.searchParams.has('saved')),actor,200,'tax')}
  if(path==='/app/move-in')return page('Move into Mallet',moveIn(actor),actor,200,'move-in')
  if(path==='/app/data'){if(!human(actor))throw new HttpError(403,'manager_required');const keys=await env.DB.prepare('SELECT id,label,expires_at,revoked_at FROM mallet_agent_keys ORDER BY created_at DESC').all();return page('Data & access',dataPage(actor,keys.results),actor,200,'data')}
  if(path==='/app/backup')throw new HttpError(405,'post_required')
  const asset=path.match(/^\/app\/assets\/([^/]+)$/),job=path.match(/^\/app\/jobs\/([^/]+)$/)
  const people=asset||job?await operators(env.DB):undefined
  const view=asset?assetPage(state,asset[1],actor,people!.names,people!.list,Object.fromEntries(bookingFields.filter(k=>url.searchParams.has(k)).map(k=>[k,url.searchParams.get(k)!.slice(0,200)]))):job?jobPage(state,job[1],actor,people!.names):null
  if(view)return page(view.title,view.body,actor)
  const print=path.match(/^\/app\/estimates\/([^/]+)\/print$/)
  if(print){const estimate=rows(state,'estimate').find(x=>x.id===print[1]);if(!estimate)throw new HttpError(404,'not_found');const rev=estimate.revisions.at(-1);return page('Repair estimate',`<section class="card print-sheet"><p class="sub">Revision ${e(rev.n)} · ${e(estimate.status==='authorised'?'authorized':estimate.status)}</p><ul class="list">${rev.lines.map((l:any)=>`<li class="plain"><span class="row-name">${e(l.description)}</span><span class="row-meta">${e(l.quantity)} × ${money(l.unitCents)} before tax · ${lineTax(l)}</span></li>`).join('')}</ul>${invoiceTotals(rev.totals)}<p>Tell the shop exactly which lines you authorize. The shop records your decision and its evidence against this revision.</p></section>`,actor)}
  throw new HttpError(404,'not_found')
 } catch(error:any) {
  const kitCode=error instanceof Error && /^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)?error.message:null
  const known=error instanceof HttpError || error instanceof MalletError || typeof error?.code==='string' || !!kitCode,status=known?(error.status??409):500,code=error.code??kitCode??'operation_failed'
  if(isApi)return json({error:code,message:known?error.message:'The operation failed.',details:error instanceof MalletError?error.details:undefined},status)
  if(status===401)return redirect('/signin?returnTo='+encodeURIComponent(path))
  const clashes=error instanceof MalletError&&error.code==='DISPATCH_CONFLICT'?error.details?.conflicts:null
  if(Array.isArray(clashes)&&submitted) {
   const {command,input}=submitted,names=(await operators(env.DB)).names
   const back=command==='job.book'?{href:`/app/assets/${encodeURIComponent(String(input.assetId))}?${new URLSearchParams(bookingFields.filter(k=>typeof input[k]==='string').map(k=>[k,input[k]]))}#book`,label:'Back to the booking form'}:{href:`/app/jobs/${encodeURIComponent(String(rows(await load(env.DB),'proposal').find(p=>p.id===input.proposalId)?.jobId))}`,label:'Back to the job'}
   return page('Booking conflict',conflictPage(clashes,names,back),actor,status)
  }
  return page('Could not complete that action',`<section class="card"><p role="alert">${e(known?error.message:'The operation failed. Check the input and try again.')}</p>${error instanceof MalletError&&error.details?`<pre>${e(JSON.stringify(error.details,null,2))}</pre>`:''}<p class="card-foot"><a href="${e(path.startsWith('/app/actions')?'/app':path)}">Return to workshop</a></p></section>`,actor,status,path.startsWith('/app/move-in')?'move-in':path==='/app/data'?'data':'workshop')
 }
}
