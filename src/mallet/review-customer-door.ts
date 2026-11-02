import {runtimeBindings,type Bindings} from '../auth.server'
import {digest} from './auth'
import {execute,load,rows,type Row} from './model'
import {customerReview} from './ui/reviews'
import {page} from './ui/shell'

const unavailable=()=>page('Link not available','<section class="card"><p>This review link is not available. Contact your repair shop.</p></section>',undefined,404)
const customer=(id:string)=>({id:'review-link:'+id,name:'Private review link holder',role:'customer' as const})
async function feedbackForm(request:Request):Promise<URLSearchParams|null>{
 const reader=request.body?.getReader();if(!reader)return new URLSearchParams()
 const chunks:Uint8Array[]=[];let size=0
 try{
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>65536)return null;chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 }catch{return null}finally{await reader.cancel();reader.releaseLock()}
}
// Match the native customer forms: preserve a same-origin POST Origin without leaking the link to Google.
async function response(row:Row,path:string,withdrawnAt?:string){
 const result=await page('How was your repair visit?',customerReview({...row,withdrawnAt},path,!!row.response))
 result.headers.set('referrer-policy','same-origin');result.headers.set('x-robots-tag','noindex, nofollow')
 return result
}
export async function reviewResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/review\/([^/]*)(\/.*)?$/)
 if(!match)return null
 const env=runtimeBindings(original)
 if(url.origin!==env.AUTH_ORIGIN||request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()||match[2]||!/^[A-Za-z0-9_-]{43}$/.test(match[1]))return unavailable()
 if(!['GET','HEAD','POST'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD, POST'}})
 const found=await env.DB.prepare('SELECT request_id FROM mallet_review_tokens WHERE token_hash=?').bind(await digest(match[1])).first<{request_id:string}>()
 if(!found)return unavailable()
 const state=await load(env.DB),row=rows(state,'reviewRequest').find(r=>r.id===found.request_id),consent=row&&rows(state,'reviewConsent').find(r=>r.id===row.consentId),asset=row&&rows(state,'asset').find(r=>r.id===row.assetId)
 if(!row||!consent||!asset||asset.privacyErasedAt||row.expiresAt<=new Date().toISOString())return unavailable()
 if(request.method!=='POST')return response(row,url.pathname,consent.withdrawnAt)
 if(request.headers.get('origin')!==url.origin)return new Response('Same-origin form required',{status:403})
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return new Response('Form required',{status:415})
 if(Number(request.headers.get('content-length')??0)>65536)return new Response('Form too large',{status:413})
 const form=await feedbackForm(request);if(!form)return new Response('Form too large or invalid',{status:413})
 const authority={sql:'EXISTS(SELECT 1 FROM mallet_review_tokens WHERE request_id=? AND token_hash=?)',params:[row.id,await digest(match[1])]}
 try{
  if(form.get('action')==='withdraw'){
   await execute(env.DB,customer(row.id),'review.customerWithdraw',{consentId:consent.id,version:consent.version},authority)
   return response(row,url.pathname,new Date().toISOString())
  }
  if(form.get('action')!=='respond'||consent.withdrawnAt)return unavailable()
  const owner=await env.DB.prepare("SELECT id FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at,id LIMIT 1").first<{id:string}>()
  if(!owner)return unavailable()
  const grant={sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,params:[...authority.params,owner.id]}
  await execute(env.DB,customer(row.id),'review.respond',{id:row.id,version:row.version,rating:Number(form.get('rating')),feedback:form.get('feedback')??'',ownerId:owner.id},grant)
  return new Response(null,{status:303,headers:{location:url.pathname,'cache-control':'no-store','referrer-policy':'no-referrer'}})
 }catch(error:any){
  if(error.code==='VERSION'||error.code==='CONCURRENT_CHANGE')return new Response(null,{status:303,headers:{location:url.pathname,'cache-control':'no-store'}})
  if(error.status===400)return page('Check your feedback','<section class="card"><p>Choose a rating from one to five and keep private feedback within 2,000 characters.</p><a href="'+url.pathname+'">Return to your feedback</a></section>',undefined,400)
  return unavailable()
 }
}
