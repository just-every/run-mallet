import {runtimeBindings,type Bindings} from '../auth.server'
import {digest,type Actor,type Authority} from './auth'
import {execute,fail,load,MalletError,rows} from './model'
import {assertion} from './media/storage'
import {customerCheckInPage} from './ui/check-in'
import {page} from './ui/shell'

const privateResponse=(response:Response)=>{response.headers.set('cache-control','no-store');response.headers.set('referrer-policy','same-origin');response.headers.set('x-robots-tag','noindex, nofollow');return response}
const unavailable=async(status=404)=>privateResponse(await page('Check-in link unavailable','<section class="card"><p>Ask the shop for a new check-in link or a paper form.</p></section>',undefined,status,{heading:false}))
export async function createCheckInLink(env:Bindings,actor:Actor,authority:Authority,input:any){
 const row=await execute(env.DB,actor as any,'checkin.issue',input,authority)
 const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),guard=assertion(authority.sql,authority.params)
 await env.DB.batch([env.DB.prepare(guard.sql).bind(...guard.params!),env.DB.prepare('INSERT INTO mallet_checkin_links(request_id,token_hash) VALUES(?,?)').bind(row.id,await digest(token)),env.DB.prepare('DELETE FROM mallet_assert')])
 return {...row,url:env.AUTH_ORIGIN+'/check-in/'+token}
}
async function formBody(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))fail('INPUT','Use the check-in form.',null,415)
 const reader=request.body?.getReader();if(!reader)return new URLSearchParams()
 const parts:Uint8Array[]=[];let total=0
 try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>65536)fail('INPUT','This check-in is too large.',null,413);parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(total);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length}return new URLSearchParams(new TextDecoder().decode(bytes))
}
export async function checkInResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/check-in\/([^/]*)$/);if(!match)return null
 const env=runtimeBindings(original)
 if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()))return unavailable()
 if(!['GET','HEAD','POST'].includes(request.method))return unavailable(405)
 if(!/^[A-Za-z0-9_-]{43}$/.test(match[1]))return unavailable()
 const hash=await digest(match[1]),link=await env.DB.prepare('SELECT request_id FROM mallet_checkin_links WHERE token_hash=?').bind(hash).first<{request_id:string}>(),doc=link&&rows(await load(env.DB),'counterIntake').find(r=>r.id===link.request_id)
 if(!doc||doc.revoked||doc.expiresAt<=new Date().toISOString())return unavailable()
 if(request.method!=='POST')return privateResponse(await page(doc.receipt?'Your check-in receipt':'Check in with the shop',customerCheckInPage(doc,url.pathname)))
 if(request.headers.get('origin')!==env.AUTH_ORIGIN||request.headers.get('sec-fetch-site')==='cross-site')return unavailable(403)
 const authority={sql:"EXISTS(SELECT 1 FROM mallet_checkin_links l JOIN mallet_records r ON r.kind='counterIntake' AND r.id=l.request_id WHERE l.request_id=? AND l.token_hash=? AND json_extract(r.value,'$.revoked') IS NULL AND json_extract(r.value,'$.expiresAt')>?)",params:[doc.id,hash,new Date().toISOString()]}
 let fields:Record<string,string>={}
 try{
  const form=await formBody(request);fields=Object.fromEntries(form)
  const input={requestId:doc.id,...Object.fromEntries(['contactName','email','phone','vehicleIdentifier','requestedWork','channel','keyDrop','typedName'].map(key=>[key,form.get(key)??''])),diagnosticTotalCents:Number(form.get('diagnosticTotalCents')),diagnosticConsent:form.get('diagnosticConsent')==='yes',electronicConsent:form.get('electronicConsent')==='yes',answers:Object.fromEntries(doc.template.fields.map((f:any)=>[f.key,form.get('answer:'+f.key)??''])),acknowledgments:Object.fromEntries((doc.template.acknowledgments??[]).map((a:any)=>[a.key,form.get('acknowledgment:'+a.key)==='yes']))}
  const saved=await execute(env.DB,{id:'check-in:'+doc.id,name:'Customer check-in link',role:'customer'},'checkin.submit',input,authority)
  return privateResponse(await page('Your check-in receipt',customerCheckInPage(saved,url.pathname)))
 }catch(error){
  if(!(error instanceof MalletError))throw error
  if(error.status===404)return unavailable()
  return privateResponse(await page('Check in with the shop',customerCheckInPage(doc,url.pathname,fields,error.message),undefined,error.status))
 }
}
