import {digest,HttpError,type Identity} from './auth'
import {execute,load} from './model'
import {assistantView,currentGrant} from './assistant'
import {bookingSlots,bookingSlotId} from './bookings'
import {find} from './model'
import {operatorMail} from '../mail.server.mjs'
import type {Bindings} from '../auth.server'
export async function scopedAssistantView(env:Bindings,auth:Identity){
 const s=await load(env.DB),g=currentGrant(s,auth.actor.assistantGrantId!,new Date().toISOString())
 if(!await env.DB.prepare(`SELECT 1 WHERE (${auth.authority.sql})`).bind(...auth.authority.params).first())throw new HttpError(401,'invalid_agent_key')
 return assistantView(s,g,new Date().toISOString())
}
export async function assistantCommand(env:Bindings,auth:Identity,command:string,input:any){
 if(['assistant.claim','assistant.outcome'].includes(command))throw new HttpError(404,'unknown_command')
 if(command==='assistant.grant'){
  const row=await execute(env.DB,auth.actor,command,input,auth.authority)
  const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
  await env.DB.prepare(`INSERT INTO mallet_assistant_keys SELECT ?,?,id,version FROM oa_operators WHERE id=? AND (${auth.authority.sql})`).bind(row.id,await digest(token),auth.actor.id,...auth.authority.params).run()
  return {...row,token}
 }
 if(command==='assistant.send'){
  if(!auth.actor.assistantGrantId)throw new HttpError(403,'scoped_key_required')
  const mail=operatorMail(env);if(!mail)throw new HttpError(409,'mail_unavailable')
  const claim=await execute(env.DB,auth.actor,'assistant.claim',input,auth.authority)
  // A second current-authority read immediately precedes the provider boundary.
  if(!await env.DB.prepare(`SELECT 1 WHERE (${auth.authority.sql})`).bind(...auth.authority.params).first())throw new HttpError(403,'grant_revoked')
  let outcome:any
  try{outcome=await mail.send({deliveryId:claim.id,from:String(env.MAIL_FROM??''),to:[claim.to],subject:'Your requested tentative appointment',text:claim.content,html:'',headers:{}})}catch{outcome={status:'uncertain'}}
  return execute(env.DB,auth.actor,'assistant.outcome',{sendId:claim.id,version:claim.version,status:outcome.status==='rejected'?'failed':outcome.status,providerReference:outcome.providerMessageId??null},auth.authority)
 }
 if(command==='assistant.intake'){
  if(!auth.actor.assistantGrantId)throw new HttpError(403,'scoped_key_required')
  const s=await load(env.DB),g=currentGrant(s,auth.actor.assistantGrantId!,new Date().toISOString())
  if(g.kind!=='receptionist'||input.serviceId!==g.subjectId)throw new HttpError(403,'assistant_scope_required')
  const service=find(s,'bookingService',g.subjectId),slot=bookingSlots(s,service).find(x=>bookingSlotId(service,x)===input.slotId)
  if(!slot)throw new HttpError(409,'appointment_unavailable')
  const authority={sql:'('+auth.authority.sql+") AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",params:[...auth.authority.params,slot.technicianId]}
  return execute(env.DB,auth.actor,command,input,authority)
 }
 return execute(env.DB,auth.actor,command,input,auth.authority)
}
