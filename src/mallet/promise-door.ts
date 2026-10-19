import {shopTime} from './promise-zone'
import {operatorMail} from '../mail.server.mjs'
import type {Actor,Authority} from './auth'
import {execute,MalletError} from './model'

/** One durable claim precedes one provider call. Crash/rejection/uncertainty never schedules a retry. */
export async function sendPromiseNotice(env:any,actor:Actor,authority:Authority,input:any){
 if(!['owner','admin'].includes(actor.role))throw new MalletError('FORBIDDEN','A service advisor must approve and communicate a revised promise.',403)
 const mail=operatorMail(env)
 if(!mail)throw new MalletError('MAIL_UNAVAILABLE','Configure the shop mail sender before approving and emailing a revised promise.',409)
 const notice=await execute(env.DB,actor as any,'promise.approve',input,authority)
 const text=`Your repair pickup promise has changed.\n\nOriginal pickup: ${shopTime(notice.oldPickupAt,notice.timeZone)}\nRevised pickup: ${shopTime(notice.newPickupAt,notice.timeZone)}\nReason: ${notice.reason}\n\nApproved by your service advisor. Contact the shop with any questions.`
 const html='<p>'+text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>')+'</p>'
 let outcome:any
 try{outcome=await mail.send({deliveryId:notice.id,from:env.MAIL_FROM,to:[notice.to],subject:'Your revised repair pickup promise',text,html,headers:{}})}
 catch{outcome={status:'uncertain',provider:String(env.MAIL_PROVIDER??'mail'),providerMessageId:null}}
 // If authority disappears after the send, the retained claim remains visibly unconfirmed; it is never silently resent.
 try{return await execute(env.DB,actor as any,'promise.noticeOutcome',{noticeId:notice.id,version:notice.version,status:outcome.status,provider:outcome.provider,providerMessageId:outcome.providerMessageId},authority)}
 catch(error){if(error instanceof MalletError&&error.code==='CONCURRENT_CHANGE')return notice;throw error}
}
