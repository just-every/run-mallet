import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {digest,HttpError,type Actor,type Authority} from './auth'
import {execute,load,MalletError,rows} from './model'
import {linkState} from './approval-links'
import {sharedDiagnoses} from './diagnostics'
import {approvalPage,receiptPage} from './ui/approval'
import {page} from './ui/shell'

/** Owner/admin email the link: the token is shown once to the sender and mailed; only its SHA-256 is stored. */
export async function sendApprovalLink(env:any,actor:Actor,authority:Authority,input:any) {
 const mail=operatorMail(env)
 if(!mail)throw new MalletError('MAIL_UNAVAILABLE','Configure the shop’s mail provider before emailing approval links.',409)
 const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
 const link=await execute(env.DB,actor as any,'approvalLink.create',{estimateId:input.estimateId,version:input.version,revision:input.revision,days:input.days},authority)
 await env.DB.prepare('INSERT INTO mallet_approval_links(id,token_hash,estimate_id,created_at) VALUES(?,?,?,?)').bind(link.id,await digest(token),link.estimateId,link.createdAt).run()
 const url=`${env.AUTH_ORIGIN}/approve/${token}`,state=await load(env.DB),job=rows(state,'job').find(j=>j.id===link.jobId)
 let outcome:any
 try{outcome=await mail.send({deliveryId:link.id,from:env.MAIL_FROM,to:[link.to],subject:`Review your repair estimate: ${job?.title??'repair'}`,text:`Your repair shop sent an estimate for you to approve or decline line by line.\n\n${url}\n\nThis link expires ${link.expiresAt} (UTC).`,html:`<p>Your repair shop sent an estimate for you to approve or decline line by line.</p><p><a href="${url}">Review the estimate</a></p><p>This link expires ${link.expiresAt} (UTC).</p>`,headers:{}})}
 catch{outcome={status:'uncertain',provider:String(env.MAIL_PROVIDER??'mail'),providerMessageId:null}}
 const recorded=await execute(env.DB,actor as any,'approvalLink.delivery',{linkId:link.id,version:link.version,status:outcome.status,provider:outcome.provider,providerMessageId:outcome.providerMessageId},authority)
 return {...recorded,url}
}
const unavailable=(status=404)=>page('Link not available','<section class="card"><p>This approval link is not available. Ask your repair shop for a new link.</p></section>',undefined,status,{heading:false})
// same-origin: the token never leaves in a Referer, while the form's own POST still carries its Origin.
function noStore(response:Response){response.headers.set('referrer-policy','same-origin');response.headers.set('x-robots-tag','noindex, nofollow');return response}
/** The customer's decision door: no session; a same-origin POST records one decision for the exact revision. */
export async function approvalResponse(request:Request,original:Bindings):Promise<Response|null> {
 const url=new URL(request.url),match=url.pathname.match(/^\/approve\/([^/]*)$/)
 if(!match)return null
 const env=runtimeBindings(original)
 if(url.origin!==env.AUTH_ORIGIN)return new Response('Not found',{status:404})
 if(!['GET','HEAD','POST'].includes(request.method))return unavailable(405)
 if(!/^[A-Za-z0-9_-]{43}$/.test(match[1]))return unavailable()
 const found=await env.DB.prepare('SELECT id FROM mallet_approval_links WHERE token_hash=?').bind(await digest(match[1])).first<{id:string}>()
 if(!found)return unavailable()
 const s=await load(env.DB),link=rows(s,'approvalLink').find(l=>l.id===found.id)
 if(!link)return unavailable()
 const state=linkState(s,link,new Date().toISOString()),estimate=rows(s,'estimate').find(q=>q.id===link.estimateId)!,job=rows(s,'job').find(j=>j.id===link.jobId)!,asset=rows(s,'asset').find(a=>a.id===job.assetId)
 if(request.method!=='POST') {
  if(state==='decided')return noStore(await page('Decision recorded',receiptPage(link.decision)))
  if(state!=='active')return unavailable()
  return noStore(await page('Review your estimate',approvalPage(link,estimate,job,asset,sharedDiagnoses(s,job.id))))
 }
 if(request.headers.get('origin')!==env.AUTH_ORIGIN)return unavailable(403)
 const form=new URLSearchParams(await request.text()),revision=estimate.revisions.find((r:any)=>r.n===link.revision)
 for(const line of revision.lines)if(!['approve','decline'].includes(form.get('line-'+line.id)??''))return noStore(await page('Review your estimate',approvalPage(link,estimate,job,asset,sharedDiagnoses(s,job.id),'Choose approve or decline for every line.'),undefined,400))
 const input={linkId:link.id,approvedLineIds:revision.lines.filter((l:any)=>form.get('line-'+l.id)==='approve').map((l:any)=>l.id),typedName:form.get('typedName')??'',consent:form.get('consent')==='yes'}
 try {
  const decided=await execute(env.DB,{id:'approval-link:'+link.id,name:String(input.typedName).trim().slice(0,200)||'Customer',role:'customer'} as any,'estimate.customerDecide',input)
  return noStore(await page('Decision recorded',receiptPage(decided.decision)))
 } catch(error) {
  if(error instanceof MalletError&&error.status===404)return unavailable()
  if(error instanceof MalletError&&error.status===409&&error.code==='LINK_USED')return noStore(await page('Decision already recorded','<section class="card"><p>This link already recorded a different decision. Contact your repair shop to change it.</p></section>',undefined,409))
  if(error instanceof MalletError&&error.status===400)return noStore(await page('Review your estimate',approvalPage(link,estimate,job,asset,sharedDiagnoses(s,job.id),error.message),undefined,400))
  throw error
 }
}
export function approvalReceipt(state:any,actor:Actor,linkId:string) {
 if(!['owner','admin'].includes(actor.role))throw new HttpError(403,'manager_required')
 const link=rows(state,'approvalLink').find(l=>l.id===linkId)
 if(!link?.decision)throw new HttpError(404,'not_found')
 return link.decision
}
