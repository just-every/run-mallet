import {e} from './ui/common'
import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {digest,type Actor,type Authority} from './auth'
import {execute,fail,load,MalletError,rows} from './model'
import {assertion} from './media/storage'
import {customerIntakePage} from './ui/intake-forms'
import {page} from './ui/shell'
const privateResponse=(response:Response)=>{response.headers.set('cache-control','no-store');response.headers.set('referrer-policy','same-origin');response.headers.set('x-robots-tag','noindex, nofollow');return response}
const unavailable=async(status=404)=>privateResponse(await page('Intake link unavailable','<section class="card"><p>This private intake link is unavailable. Ask your shop for a new link or paper form.</p></section>',undefined,status,{heading:false}))
export async function createIntakeFormLink(env:Bindings,actor:Actor,authority:Authority,input:any){
 const row=await execute(env.DB,actor as any,'intakeForm.create',input,authority),token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),guard=assertion(authority.sql,authority.params)
 await env.DB.batch([env.DB.prepare(guard.sql).bind(...guard.params!),env.DB.prepare('INSERT INTO mallet_intake_form_links(form_id,token_hash) VALUES(?,?)').bind(row.id,await digest(token)),env.DB.prepare('DELETE FROM mallet_assert')]);return {...row,url:env.AUTH_ORIGIN+'/intake/'+token}
}
async function formBody(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))fail('INPUT','Use the intake form.',null,415)
 const reader=request.body?.getReader();if(!reader)return new URLSearchParams()
 const parts:Uint8Array[]=[];let total=0
 try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>65536)fail('INPUT','This intake draft is too large.',null,413);parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(total);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length}return new URLSearchParams(new TextDecoder().decode(bytes))
}
export async function intakeFormResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/intake\/([^/]*)$/);if(!match)return null
 const env=runtimeBindings(original)
 if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())||!['GET','HEAD','POST'].includes(request.method))return unavailable(request.method==='GET'?404:405)
 if(!/^[A-Za-z0-9_-]{43}$/.test(match[1]))return unavailable()
 const hash=await digest(match[1]),link=await env.DB.prepare('SELECT form_id FROM mallet_intake_form_links WHERE token_hash=?').bind(hash).first<{form_id:string}>(),doc=link&&rows(await load(env.DB),'intakeForm').find(f=>f.id===link.form_id)
 if(!doc||doc.revoked||doc.expiresAt<=new Date().toISOString())return unavailable()
 const actor={id:'intake-form:'+doc.id,name:'Customer intake link',role:'customer'} as any,authority={sql:"EXISTS(SELECT 1 FROM mallet_intake_form_links l JOIN mallet_records r ON r.kind='intakeForm' AND r.id=l.form_id WHERE l.form_id=? AND l.token_hash=? AND json_extract(r.value,'$.revoked') IS NULL AND json_extract(r.value,'$.expiresAt')>?)",params:[doc.id,hash,new Date().toISOString()]}
 if(request.method!=='POST'){
  if(url.searchParams.get('download')==='1'&&doc.receipt)return privateResponse(new Response(JSON.stringify(doc.receipt,null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="signed-intake.json"'}}))
  return privateResponse(await page(doc.receipt?'Signed intake copy':'Complete your intake',customerIntakePage(doc,url.pathname)))
 }
 if(request.headers.get('origin')!==env.AUTH_ORIGIN||request.headers.get('sec-fetch-site')==='cross-site')return unavailable(403)
 try{
  const form=await formBody(request),saved=await execute(env.DB,actor,'intakeForm.customerSave',{formId:doc.id,version:Number(form.get('version')),answers:Object.fromEntries(['symptom',...doc.template.fields.map((f:any)=>f.key)].map(key=>[key,form.get(key)??''])),typedName:form.get('typedName')??'',consent:form.get('consent')==='yes',sign:form.get('action')==='sign'},authority)
  let result=saved
  if(saved.status==='signed'){
   const claim=await execute(env.DB,actor,'intakeForm.copyClaim',{formId:doc.id},authority)
   if(claim){
    let outcome:any={status:'unavailable',provider:'none'};const mail=operatorMail(env)
    if(mail&&env.MAIL_FROM)try{outcome=await mail.send({deliveryId:'intake-copy:'+doc.id,from:env.MAIL_FROM,to:[doc.to],subject:'Your signed shop intake copy',text:'Your exact signed intake copy is included below as readable JSON. A paper copy is available from the shop.\n\n'+JSON.stringify(saved.receipt,null,2),html:'<p>Your exact signed intake copy follows. Ask the shop for a paper copy.</p><pre>'+e(JSON.stringify(saved.receipt,null,2))+'</pre>',headers:{}})}catch{outcome={status:'uncertain',provider:String(env.MAIL_PROVIDER??'mail')}}
    result=await execute(env.DB,actor,'intakeForm.copyOutcome',{formId:doc.id,status:outcome.status,provider:outcome.provider??String(env.MAIL_PROVIDER??'mail')},authority)
   }
  }
  return privateResponse(await page(result.receipt?'Signed intake copy':'Complete your intake',customerIntakePage(result,url.pathname),undefined,result.lastErrors.length?422:200))
 }catch(error){if(error instanceof MalletError)return error.status===404?unavailable():privateResponse(await page('Could not save intake','<section class="card"><p>The intake changed or could not be saved. Reload your link and review the saved draft.</p></section>',undefined,error.status));throw error}
}
