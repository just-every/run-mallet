import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {digest,originGuard} from './auth'
import {load,rows} from './model'
import {portalCookie,portalCookieName,portalRecords,portalToken,currentPortal} from './portal-session'
import {portalSignIn,portalBilling} from './ui/portal'
import {box,e,hidden} from './ui/common'
import {page} from './ui/shell'
const privateResponse=(r:Response)=>{r.headers.set('cache-control','no-store');r.headers.set('referrer-policy','same-origin');r.headers.set('x-robots-tag','noindex, nofollow');return r}
const screen=async(title:string,body:string,status=200)=>privateResponse(await page(title,body,undefined,status))
const unavailable=()=>screen('Customer sign-in needed',box('Billing unavailable','<p>Sign in with a current link. Only the current payer can view account billing.</p><p><a href="/portal">Customer sign-in</a></p>'),403)
async function input(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return null
 const reader=request.body?.getReader();if(!reader)return new URLSearchParams()
 const parts:Uint8Array[]=[];let size=0
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096)return null;parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 try{const form=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(parts.flatMap(p=>[...p]))));if([...form.keys()].some((k,i,keys)=>keys.indexOf(k)!==i))return null;return form}catch{return null}
}
export async function portalResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname
 if(path!=='/portal'&&!path.startsWith('/portal/')&&!path.startsWith('/api/mallet/portal/'))return null
 const env=runtimeBindings(original)
 try{originGuard(request,env)}catch{return unavailable()}
 if(!['GET','HEAD','POST'].includes(request.method))return screen('Method unavailable','',405)
 if(request.method==='POST'){
  const form=await input(request);if(!form)return screen('Invalid request','',400)
  if(path==='/portal/signout'){
   await env.DB.prepare("UPDATE mallet_portal_tokens SET used_at=? WHERE token_hash=? AND kind='session'").bind(Date.now(),await digest(portalCookie(request))).run()
   return privateResponse(new Response(null,{status:303,headers:{location:'/portal','set-cookie':portalCookieName(request)+'=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(url.protocol==='https:'?'; Secure':'')}}))
  }
  if(path==='/portal/signin'){
   const email=String(form.get('email')??'').trim().toLowerCase()
   if(form.get('consent')!=='yes'||!email||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return screen('Customer sign-in',portalSignIn(),400)
   const now=Date.now(),address=await digest(env.SESSION_SECRET+'portal-email:'+email),client=await digest(env.SESSION_SECRET+'portal-client:'+(request.headers.get('cf-connecting-ip')??'local')),window=Math.floor(now/3600000)
   const limits=await env.DB.batch<{count:number}>([address,client].map(key=>env.DB.prepare('INSERT INTO mallet_portal_requests(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window=excluded.window,count=CASE WHEN mallet_portal_requests.window=excluded.window THEN mallet_portal_requests.count+1 ELSE 1 END RETURNING count').bind(key,window)))
   const accepted=()=>screen('Check your email',box('Sign-in requested','<p>If this email belongs to a customer account, a one-time sign-in email is on its way. The link expires in 15 minutes. Only the current payer can view billing.</p>'))
   if(Number(limits[0].results[0].count)>3||Number(limits[1].results[0].count)>20)return accepted()
   await env.DB.batch([env.DB.prepare('DELETE FROM mallet_portal_requests WHERE window<?').bind(window-1),env.DB.prepare('DELETE FROM mallet_portal_tokens WHERE expires_at<?').bind(now)])
   const s=await load(env.DB),contacts=rows(s,'contact').filter(c=>c.email.toLowerCase()===email),mail=operatorMail(env)
   for(const account of rows(s,'customerAccount').filter(a=>!a.mergedInto)){
    const matching=contacts.filter(c=>account.contactIds.includes(c.id));if(matching.length!==1)continue
    const contact=matching[0]
    if(!mail||!env.MAIL_FROM)continue
    const token=portalToken(),link=env.AUTH_ORIGIN+'/portal/confirm/'+token
    await env.DB.prepare("INSERT INTO mallet_portal_tokens VALUES(?,'link',?,?,?,?,?,?,NULL)").bind(await digest(token),account.id,contact.id,account.payerRevision??1,contact.version,now,now+15*60000).run()
    try{await mail.send({deliveryId:crypto.randomUUID(),from:env.MAIL_FROM,to:[email],subject:'Your Mallet customer account sign-in',text:`You requested sign-in for ${account.name}. Open the link, then confirm sign-in. It expires in 15 minutes and can be used once.\n\n${link}`,html:`<p>You requested sign-in for ${e(account.name)}.</p><p><a href="${e(link)}">Confirm customer sign-in</a></p><p>Expires in 15 minutes. If you did not request this email, ignore it.</p>`,headers:{}})}catch{await env.DB.prepare('DELETE FROM mallet_portal_tokens WHERE token_hash=?').bind(await digest(token)).run()}
   }
   return accepted()
  }
  const confirm=path.match(/^\/portal\/confirm\/([A-Za-z0-9_-]{43})$/)
  if(confirm&&form.get('confirm')==='yes'){
   const hash=await digest(confirm[1]),now=Date.now(),session=portalToken(),sessionHash=await digest(session)
   // Consume and mint in one transaction; a replay cannot create a second session.
   await env.DB.batch([
    env.DB.prepare(`INSERT INTO mallet_portal_tokens SELECT ?,'session',account_id,contact_id,account_revision,contact_version,?, ?,NULL FROM mallet_portal_tokens t WHERE token_hash=? AND kind='link' AND used_at IS NULL AND expires_at>? AND ${currentPortal}`).bind(sessionHash,now,now+86400000,hash,now),
    env.DB.prepare("UPDATE mallet_portal_tokens SET used_at=? WHERE token_hash=? AND kind='link' AND used_at IS NULL").bind(now,hash)
   ])
   if(!await env.DB.prepare("SELECT 1 FROM mallet_portal_tokens WHERE token_hash=? AND kind='session'").bind(sessionHash).first())return unavailable()
   return privateResponse(new Response(null,{status:303,headers:{location:'/portal/billing','set-cookie':`${portalCookieName(request)}=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`+(url.protocol==='https:'?'; Secure':'')}}))
  }
  return screen('Page not found','',404)
 }
 if(path==='/portal')return screen('Customer account',portalSignIn())
 const confirm=path.match(/^\/portal\/confirm\/([A-Za-z0-9_-]{43})$/)
 if(confirm)return screen('Confirm customer sign-in',box('Sign in to your account','<p>Continue only if you requested this email. Your account role is checked each time you view billing.</p><form method="post" action="'+e(path)+'">'+hidden('confirm','yes')+'<button>Confirm sign-in</button></form>'))
 if(path==='/portal/billing'||path==='/api/mallet/portal/billing'){
  const view=await portalRecords(env,request)
  if(!view||'denied' in view)return path.startsWith('/api/')?privateResponse(Response.json({error:'payer_session_required'},{status:403})):unavailable()
  return path.startsWith('/api/')?privateResponse(Response.json(view)):screen('Account billing',portalBilling(view))
 }
 return screen('Page not found','',404)
}
