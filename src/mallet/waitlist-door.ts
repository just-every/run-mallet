import {runtimeBindings,type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {digest,type Actor,type Authority} from './auth'
import {execute,expectVersion,fail,load,MalletError,rows,type Actor as BookingActor} from './model'
import {shopTime} from './promise-zone'
import {e} from './ui/common'

/** Staff entry uses a server-derived source; submitted hashes cannot bypass reservation limits. */
export async function waitlistCommand(original:Bindings,request:Request,actor:Actor,authority:Authority,command:string,input:any){
 if(!['owner','admin'].includes(actor.role))fail('FORBIDDEN','Only the owner or service advisor manages the waitlist.',null,403)
 if(!['waitlist.add','waitlist.withdraw','waitlist.advance','waitlist.sendOffer'].includes(command))fail('COMMAND','Unknown waitlist command.',null,404)
 const env=runtimeBindings(original)
 if(command==='waitlist.sendOffer'){const offer=rows(await load(env.DB),'waitlistOffer').find(o=>o.id===input.offerId);if(!offer)fail('NOT_FOUND','That cancellation offer does not exist.',null,404);expectVersion(offer,input.version);const sent=await sendWaitlistOffers(env,actor,authority,offer.triggerAppointmentId,{id:offer.id,version:offer.version});if(!sent)fail('WAITLIST_DELIVERY','This offer expired or its send was already claimed.');return sent}
 let checked=input,guard=authority
 if(command==='waitlist.add')checked={...input,sourceHash:await digest(env.AUTH_ORIGIN+'|waitlist|'+(request.headers.get('cf-connecting-ip')??actor.id))}
 if(command==='waitlist.advance'){
  const active=(await env.DB.prepare("SELECT id FROM oa_operators WHERE status='active'").all<{id:string}>()).results.map(x=>x.id)
  checked={...input,verifiedActiveTechnicianIds:active}
  const canceled=rows(await load(env.DB),'appointment').find(x=>x.id===input.appointmentId)
  if(canceled)guard={sql:'('+authority.sql+") AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",params:[...authority.params,canceled.technicianId]}
 }
 const result=await execute(env.DB,actor,command,checked,guard)
 return result
}

/** Post-commit only. A durable claim always precedes one private token and one provider call. */
export async function sendWaitlistOffers(original:Bindings,actor:BookingActor,authority:Authority,canceledAppointmentId:string,reviewed?:{id:string,version:number}){
 const env=runtimeBindings(original),s=await load(env.DB)
 const offer=rows(s,'waitlistOffer').find(x=>x.triggerAppointmentId===canceledAppointmentId&&x.delivery.status==='pending'&&x.expiresAt>new Date().toISOString())
 if(!offer||!reviewed||offer.id!==reviewed.id||offer.version!==reviewed.version)return null
 const appointment=rows(s,'appointment').find(x=>x.id===offer.appointmentId)
 if(!appointment||appointment.status!=='held')return null
 const guard={sql:'('+authority.sql+") AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",params:[...authority.params,appointment.technicianId]}
 let claimed:any
 try{claimed=await execute(env.DB,actor,'waitlist.offerClaim',{offerId:offer.id,version:offer.version},guard)}
 catch(error){if(error instanceof MalletError&&['CONCURRENT_CHANGE','WAITLIST_DELIVERY','VERSION'].includes(error.code))return null;throw error}
 const secret=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
 const manage=env.AUTH_ORIGIN+'/book/'+secret
 let outcome:any={status:'failed',provider:'mail'}
 try{
  // This identity table is already excluded from archives. A crash at any later step never retries the claim.
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${guard.sql}) AND EXISTS(SELECT 1 FROM mallet_records WHERE kind='appointment' AND id=? AND json_extract(value,'$.status')='held' AND json_extract(value,'$.expiresAt')>?) THEN 1 ELSE 0 END`).bind(...guard.params,appointment.id,new Date().toISOString()),
   env.DB.prepare('INSERT INTO mallet_booking_tokens(appointment_id,token_hash) VALUES(?,?)').bind(appointment.id,await digest(secret)),
   env.DB.prepare('DELETE FROM mallet_assert'),
  ])
  const mail=operatorMail(env)
  if(mail){
   const text=`A cancellation time you requested is available.\n${appointment.service.name}\n${appointment.service.location}\n${shopTime(appointment.startAt,appointment.service.timeZone)} – ${shopTime(appointment.endAt,appointment.service.timeZone)}\nReserved until ${shopTime(appointment.expiresAt,appointment.service.timeZone)}.\nConfirm or cancel using your private link: ${manage}\nThis tentative reservation expires unless you confirm it. No repair work or payment is authorized.`
   outcome=await mail.send({deliveryId:claimed.delivery.id,from:String(env.MAIL_FROM??''),to:[appointment.email],subject:'Your requested cancellation appointment offer',text,html:'<p>'+e(text).replaceAll('\n','<br>')+'</p><p><a href="'+e(manage)+'">Review and confirm your tentative appointment</a></p>',headers:{}})
  }
 }catch{outcome={status:'uncertain',provider:'mail'}}
 try{return await execute(env.DB,actor,'waitlist.offerOutcome',{offerId:claimed.id,version:claimed.version,deliveryId:claimed.delivery.id,status:outcome.status==='rejected'?'failed':outcome.status,provider:outcome.provider??'mail'},authority)}
 catch(error){if(error instanceof MalletError&&['CONCURRENT_CHANGE','VERSION','WAITLIST_DELIVERY'].includes(error.code))return claimed;throw error}
}
