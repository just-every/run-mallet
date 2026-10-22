import {runtimeBindings,type Bindings} from '../auth.server'
import {digest} from './auth'
import {execute,load,MalletError,rows} from './model'
import {operatorMail} from '../mail.server.mjs'
import {publicBooking,manageBooking} from './ui/bookings'
import {page} from './ui/shell'
const actor={id:'customer-booking',name:'Customer booking link',role:'customer' as const}
const token=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
async function view(body:string,status=200,embed=false){const response=await page('Book with Mallet',body,undefined,status);response.headers.set('cache-control','private, no-store');response.headers.set('referrer-policy','no-referrer');response.headers.set('x-robots-tag','noindex, nofollow');if(embed){response.headers.delete('x-frame-options');response.headers.set('content-security-policy',(response.headers.get('content-security-policy')??'').replace(/frame-ancestors[^;]*/g,'frame-ancestors *'))}return response}
export async function bookingResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),match=url.pathname.match(/^\/book(?:\/([A-Za-z0-9_-]+))?$/);if(!match)return null
 const env=runtimeBindings(original),manage=match[1]
 if(url.origin!==env.AUTH_ORIGIN)return view('<p>Not available.</p>',404)
 if(!['GET','HEAD','POST'].includes(request.method))return view('<p>Not available.</p>',405)
 let row:any,authority:any
 if(manage){
  if(!/^[A-Za-z0-9_-]{43}$/.test(manage))return view('<p>Not available.</p>',404)
  const hash=await digest(manage),found=await env.DB.prepare('SELECT appointment_id FROM mallet_booking_tokens WHERE token_hash=?').bind(hash).first<{appointment_id:string}>()
  row=found&&rows(await load(env.DB),'appointment').find(x=>x.id===found.appointment_id);if(!row)return view('<p>Not available.</p>',404)
  authority={sql:'EXISTS(SELECT 1 FROM mallet_booking_tokens WHERE appointment_id=? AND token_hash=?)',params:[row.id,hash]}
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
    const secret=token(),saved=await execute(env.DB,actor,'booking.hold',{...data,consent:data.consent==='yes'})
    await env.DB.prepare('INSERT INTO mallet_booking_tokens(appointment_id,token_hash) VALUES(?,?)').bind(saved.id,await digest(secret)).run()
    return new Response(null,{status:303,headers:{location:'/book/'+secret,'cache-control':'no-store','referrer-policy':'no-referrer'}})
   }
   if(!['confirm','cancel','reschedule'].includes(action))return view('<p>Unknown action.</p>',400)
   row=await execute(env.DB,actor,'booking.'+action,{...data,appointmentId:row.id,version:Number(data.version)},authority)
   if(action!=='cancel'){
    const mail=operatorMail(env);let outcome:any={status:'failed',provider:'mail'}
    try{if(mail){const text=`Your appointment is confirmed.\n${row.service.name}\n${row.service.location}\n${row.startAt} – ${row.endAt}\nReference: ${row.id}\nManage or cancel: ${env.AUTH_ORIGIN+url.pathname}\nNo repair work or payment is authorized.`;outcome=await mail.send({deliveryId:row.delivery.id,from:String(env.MAIL_FROM??''),to:[row.email],subject:'Your confirmed appointment',text,html:'<p>Your appointment is confirmed. Keep your private confirmation email to manage it.</p>',headers:{}})}}catch{outcome={status:'uncertain',provider:'mail'}}
    row=await execute(env.DB,actor,'booking.outcome',{appointmentId:row.id,version:row.version,deliveryId:row.delivery.id,status:outcome.status,provider:outcome.provider??'mail'},authority)
   }
  }
  const s=await load(env.DB);return view(manage?manageBooking(s,row,url.pathname):publicBooking(s,url.pathname,url.searchParams.get('serviceId')??''),200,!manage)
 }catch(error){if(!(error instanceof MalletError))throw error;const s=await load(env.DB);return view(manage?manageBooking(s,rows(s,'appointment').find(x=>x.id===row.id),url.pathname,error.message):publicBooking(s,url.pathname,url.searchParams.get('serviceId')??'',error.message),error.status,!manage)}
}
