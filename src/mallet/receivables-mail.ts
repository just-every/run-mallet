import type {Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import type {Actor,Authority} from './auth'
import {execute,fail} from './model'
export async function sendBalanceReminder(env:Bindings,actor:Actor,authority:Authority,input:any){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner explicitly sends balance reminders.',null,403)
 const mail=operatorMail(env);if(!mail)fail('AR_MAIL','Configure the shop mail sender first.')
 const claim=await execute(env.DB,actor as any,'ar.reminderClaim',input,authority)
 let outcome:any
 try{outcome=await mail.send({deliveryId:claim.id,from:String(env.MAIL_FROM??''),to:[claim.to],subject:'Balance reminder: '+claim.dueOn,text:claim.content,html:'<p>'+String(claim.content).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))+'</p>',headers:{}})}catch{outcome={status:'uncertain',provider:'mail'}}
 // A claim survives crashes or revoked sessions as unconfirmed; neither recovery nor replay resends it.
 return execute(env.DB,{id:'ar-mail',name:'Balance reminder mail',role:'system'} as any,'ar.reminderOutcome',{reminderId:claim.id,version:claim.version,status:['accepted','development'].includes(outcome.status)?outcome.status:outcome.status==='uncertain'?'uncertain':'failed',provider:outcome.provider??'mail',providerMessageId:outcome.providerMessageId??null})
}
