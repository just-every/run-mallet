import {shopTime} from './promise-zone'
import {bookingSlots,bookingSlotId} from './bookings'
import {e} from './ui/common'
import {runtimeBindings,type Bindings} from '../auth.server'
import {digest,HttpError,human,type Actor,type Authority} from './auth'
import {execute,load,fail,MalletError,rows} from './model'
import {operatorMail} from '../mail.server.mjs'
import {publicBooking,manageBooking} from './ui/bookings'
import {page} from './ui/shell'
// A manage link lapses a day after its appointment ends; staff can also withdraw it sooner.
const LINK_GRACE_MS=86400000
const actor={id:'customer-booking',name:'Customer booking link',role:'customer' as const}
const token=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
async function view(body:string,status=200,embed=false){const response=await page('Book with Mallet',body,undefined,status);response.headers.set('cache-control','private, no-store');response.headers.set('referrer-policy','same-origin');response.headers.set('x-robots-tag','noindex, nofollow');if(embed){response.headers.delete('x-frame-options');response.headers.set('content-security-policy',(response.headers.get('content-security-policy')??'').replace(/frame-ancestors[^;]*/g,'frame-ancestors *'))}return response}
async function bookingState(env:Bindings){
 const s=await load(env.DB),active=new Set((await env.DB.prepare("SELECT id FROM oa_operators WHERE status='active'").all<{id:string}>()).results.map(x=>x.id))
 return {...s,records:{...s.records,bookingService:rows(s,'bookingService').map(service=>({...service,windows:service.windows.filter((w:any)=>active.has(w.technicianId))}))}}
}
async function staffGuard(env:Bindings,serviceId:string,slotId:string,exceptId?:string,authority?:any){
 const s=await bookingState(env),service=rows(s,'bookingService').find(x=>x.id===serviceId),slot=service&&bookingSlots(s,service,new Date().toISOString(),exceptId).find(x=>bookingSlotId(service,x)===slotId)
 if(!slot)fail('BOOKING_CAPACITY','That appointment is no longer available. Choose another time.')
 return {sql:(authority?'('+authority.sql+') AND ':'')+"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",params:[...(authority?.params??[]),slot.technicianId]}
}
export async function bookingResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/book(?:\/([A-Za-z0-9_-]+))?$/);if(!match)return null
 const env=runtimeBindings(original),manage=match[1]
 if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()))return view('<p>Not available.</p>',404)
 if(!['GET','HEAD','POST'].includes(request.method))return view('<p>Not available.</p>',405)
 let row:any,authority:any
 if(manage){
  if(!/^[A-Za-z0-9_-]{43}$/.test(manage))return view('<p>Not available.</p>',404)
  const hash=await digest(manage),found=await env.DB.prepare('SELECT appointment_id FROM mallet_booking_tokens WHERE revoked_at IS NULL AND (token_hash=? OR appointment_id IN (SELECT appointment_id FROM mallet_booking_reminder_tokens WHERE token_hash=?))').bind(hash,hash).first<{appointment_id:string}>()
  row=found&&rows(await load(env.DB),'appointment').find(x=>x.id===found.appointment_id);if(!row||Date.parse(row.endAt)+LINK_GRACE_MS<=Date.now())return view('<p>Not available.</p>',404)
  authority={sql:'EXISTS(SELECT 1 FROM mallet_booking_tokens WHERE appointment_id=? AND revoked_at IS NULL AND (token_hash=? OR appointment_id IN (SELECT appointment_id FROM mallet_booking_reminder_tokens WHERE token_hash=?)))',params:[row.id,hash,hash]}
 }
 try{
  if(request.method==='POST'){
   if(request.headers.get('origin')!==env.AUTH_ORIGIN||request.headers.get('sec-fetch-site')==='cross-site')return view('<p>Use the booking form directly.</p>',403)
   if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return view('<p>Use the booking form.</p>',415)
   const reader=request.body?.getReader(),parts:Uint8Array[]=[];let length=0
   if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16384)return view('<p>Form too large.</p>',413);parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
   const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}const raw=new TextDecoder().decode(bytes)
   const data=Object.fromEntries(new URLSearchParams(raw)),action=data.action
   if(!manage){
    if(action!=='hold')return view('<p>Unknown action.</p>',400)
    const guard=await staffGuard(env,data.serviceId,data.slotId),secret=token(),saved=await execute(env.DB,actor,'booking.hold',{...data,consent:data.consent==='yes',sourceHash:await digest(env.AUTH_ORIGIN+'|'+(request.headers.get('cf-connecting-ip')??'unknown'))},guard)
    await env.DB.prepare('INSERT INTO mallet_booking_tokens(appointment_id,token_hash) VALUES(?,?)').bind(saved.id,await digest(secret)).run()
    return new Response(null,{status:303,headers:{location:'/book/'+secret,'cache-control':'no-store','referrer-policy':'no-referrer'}})
   }
   if(!['confirm','cancel','reschedule'].includes(action))return view('<p>Unknown action.</p>',400)
   if(action!=='cancel'){const service=rows(await load(env.DB),'bookingService').find(x=>x.id===row.serviceId)!;authority=await staffGuard(env,service.id,action==='confirm'?bookingSlotId(service,row):data.slotId,row.id,authority)}
   const active=action==='cancel'?(await env.DB.prepare("SELECT id FROM oa_operators WHERE status='active'").all<{id:string}>()).results.map(x=>x.id):[]
   if(action==='cancel'&&active.includes(row.technicianId))authority={sql:'('+authority.sql+") AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",params:[...authority.params,row.technicianId]}
   row=await execute(env.DB,actor,'booking.'+action,{...data,appointmentId:row.id,version:Number(data.version),verifiedActiveTechnicianIds:active},authority)
   if(action!=='cancel'){
    const mail=operatorMail(env);let outcome:any={status:'failed',provider:'mail'}
    try{if(mail){const text=`Your appointment is confirmed.\n${row.service.name}\n${row.service.location}\n${shopTime(row.startAt,row.service.timeZone??'America/New_York')} – ${shopTime(row.endAt,row.service.timeZone??'America/New_York')}\nReference: ${row.id}\nManage or cancel: ${env.AUTH_ORIGIN+url.pathname}\nNo repair work or payment is authorized.`;outcome=await mail.send({deliveryId:row.delivery.id,from:String(env.MAIL_FROM??''),to:[row.email],subject:'Your confirmed appointment',text,html:'<p>'+e(text).replaceAll('\n','<br>')+'</p><p><a href="'+e(env.AUTH_ORIGIN+url.pathname)+'">Manage or cancel your appointment</a></p>',headers:{}})}}catch{outcome={status:'uncertain',provider:'mail'}}
    row=await execute(env.DB,actor,'booking.outcome',{appointmentId:row.id,version:row.version,deliveryId:row.delivery.id,status:['rejected','rate_limited'].includes(outcome.status)?'failed':outcome.status,provider:outcome.provider??'mail'},authority)
   }
  }
  const s=await bookingState(env);return view(manage?manageBooking(s,row,url.pathname):publicBooking(s,url.pathname,url.searchParams.get('serviceId')??''),200,!manage)
 }catch(error){if(!(error instanceof MalletError))throw error;const s=await bookingState(env);return view(manage?manageBooking(s,rows(s,'appointment').find(x=>x.id===row.id),url.pathname,error.message):publicBooking(s,url.pathname,url.searchParams.get('serviceId')??'',error.message),error.status,!manage)}
}

/** Staff withdraw a customer's manage link; its holder then sees the same page as for an unknown link. */
export async function revokeBookingLink(env:Bindings,who:Actor,authority:Authority,input:any){
 if(!human(who))throw new HttpError(403,'manager_required')
 const id=String(input.appointmentId??''),guard=env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) AND EXISTS(SELECT 1 FROM mallet_booking_tokens WHERE appointment_id=? AND revoked_at IS NULL) THEN 1 ELSE 0 END`).bind(...authority.params,id)
 await env.DB.batch([guard,env.DB.prepare('UPDATE mallet_booking_tokens SET revoked_at=? WHERE appointment_id=? AND revoked_at IS NULL').bind(Date.now(),id),env.DB.prepare('INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),who.id,'mallet:booking.link.revoked',JSON.stringify({appointmentId:id}),Date.now()),env.DB.prepare('DELETE FROM mallet_assert')])
 return {revoked:id}
}
