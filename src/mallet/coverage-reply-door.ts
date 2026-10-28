import {runtimeBindings,type Bindings} from '../auth.server'
import {digest} from './auth'
import {execute,load,rows} from './model'
import {coverageMailStop} from './coverage-mail'
import {coverageMailAuthority} from './coverage-mail-door'
import {area,box,e,hidden} from './ui/common'
import {page} from './ui/shell'
const unavailable=()=>page('Link not available','<section class="card"><p>This coverage link is unavailable. Contact your repair shop.</p></section>',undefined,404)
async function boundedForm(request:Request){
 const reader=request.body?.getReader();if(!reader)return new URLSearchParams()
 const chunks:Uint8Array[]=[];let size=0
 try{
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>32768)return null;chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 }catch{return null}finally{await reader.cancel();reader.releaseLock()}
}
export async function coverageReplyResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/coverage-response\/([^/]*)(\/.*)?$/)
 if(!match)return null
 const env=runtimeBindings(original)
 if(url.origin!==env.AUTH_ORIGIN||request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()||match[2]||!/^[A-Za-z0-9_-]{43}$/.test(match[1]))return unavailable()
 if(!['GET','HEAD','POST'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD, POST'}})
 const hash=await digest(match[1]),token=await env.DB.prepare('SELECT notice_id FROM mallet_coverage_reply_tokens WHERE token_hash=?').bind(hash).first<{notice_id:string}>()
 if(!token)return unavailable()
 const s=await load(env.DB),notice=rows(s,'coverageNotice').find(n=>n.id===token.notice_id),now=new Date().toISOString()
 if(!notice||!['accepted','development'].includes(notice.status)||!notice.replyExpiresAt||notice.replyExpiresAt<=now||coverageMailStop(s,notice,now)||!await coverageMailAuthority(env,notice.id))return unavailable()
 const consent=rows(s,'coverageConsent').find(c=>c.id===notice.consentId)!,existing=rows(s,'coverageCase').find(c=>c.noticeId===notice.id)
 if(request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return new Response('Same-origin form required',{status:403})
  if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return new Response('Form required',{status:415})
  const form=await boundedForm(request);if(!form)return new Response('Form too large or invalid',{status:413})
  const actor={id:'coverage-link:'+notice.id,name:'Private coverage link holder',role:'customer' as const}
  const authority={sql:"EXISTS(SELECT 1 FROM mallet_coverage_reply_tokens t JOIN mallet_coverage_mail_authority a ON a.notice_id=t.notice_id JOIN oa_operators o ON o.id=a.owner_id WHERE t.notice_id=? AND t.token_hash=? AND o.version=a.owner_version AND o.role='owner' AND o.status='active')",params:[notice.id,hash]}
  try{
   if(form.get('action')==='withdraw')await execute(env.DB,actor,'coverage.customerWithdraw',{consentId:consent.id,version:consent.version},authority)
   else if(form.get('action')==='respond')await execute(env.DB,actor,'coverage.reply',{id:notice.id,version:notice.version,symptom:form.get('symptom')},authority)
   else return unavailable()
   return new Response(null,{status:303,headers:{location:url.pathname,'cache-control':'no-store','referrer-policy':'no-referrer'}})
  }catch(error:any){
   if(['VERSION','CONCURRENT_CHANGE'].includes(error.code))return new Response(null,{status:303,headers:{location:url.pathname,'cache-control':'no-store'}})
   if(error.status===400)return page('Check your report','<section class="card"><p>Enter a repeat symptom within 4,000 characters.</p><a href="'+e(url.pathname)+'">Return to your report</a></section>',undefined,400)
   return unavailable()
  }
 }
 const response=await page('Your coverage review','<div class="narrow">'+box('Report a repeat symptom','<p>This private link records a report for the shop owner against your original repair. It does not approve work, confirm coverage, renew a contract or authorize payment. Link possession does not verify customer identity.</p>'+(existing?'<p role="status">Your report was saved for the shop owner.</p>':'<form method="post" action="'+e(url.pathname)+'">'+hidden('action','respond')+area('Repeat symptom','symptom','','required maxlength="4000" rows="4"')+'<button>Send symptom report</button></form>')+'<form method="post" action="'+e(url.pathname)+'">'+hidden('action','withdraw')+'<button>Withdraw coverage email permission</button></form>')+'</div>')
 response.headers.set('referrer-policy','same-origin');response.headers.set('x-robots-tag','noindex, nofollow')
 return response
}
