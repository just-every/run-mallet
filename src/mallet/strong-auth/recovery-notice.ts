import type {Bindings} from '../../auth.server'
import {operatorMail} from '../../mail.server.mjs'
import {audit,type Who} from './store'

/** A durable notice for each other active owner/admin, with one best-effort mail and an honest outcome. */
export async function notifyRecovery(env:Bindings,by:Who,target:Who,reason:string){
 const recipients=(await env.DB.prepare("SELECT id,email FROM oa_operators WHERE status='active' AND role IN ('owner','admin') AND id<>?").bind(target.id).all<{id:string;email:string}>()).results
 for(const recipient of recipients){
  const id=crypto.randomUUID(),notice={id,recipientId:recipient.id,targetId:target.id,targetName:target.name,byId:by.id,reason}
  await audit(env.DB,by.id,'recovery.notice',notice).run()
  let status='unavailable'
  try{const mail=operatorMail(env);if(mail){const result=await mail.send({deliveryId:id,from:String(env.MAIL_FROM??''),to:[recipient.email],subject:'Mallet account recovery notice',text:`Account recovery was used for ${target.name}. Reason: ${reason}. Open Security in Mallet to review. No customer or recovery-secret data is included.`,html:'<p>Account recovery was used. Open Security in Mallet to review.</p>',headers:{}});status=result.status}}
  catch{status='uncertain'}
  await audit(env.DB,by.id,'recovery.noticeDelivery',{id,recipientId:recipient.id,status}).run()
 }
}
