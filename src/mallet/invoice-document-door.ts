import type {Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import type {Actor,Authority} from './auth'
import {execute,find,load,fail} from './model'
import {documentHtml} from './invoice-documents'
export async function sendInvoice(env:Bindings,actor:Actor,authority:Authority,input:any){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the owner explicitly sends an invoice.',null,403)
 const mail=operatorMail(env);if(!mail)fail('INVOICE_MAIL','Configure the shop mail sender first.')
 const claim=await execute(env.DB,actor as any,'invoice.deliveryClaim',input,authority)
 const doc=find(await load(env.DB),'invoiceDocument',claim.documentId)
 let outcome:any
 try{outcome=await mail.send({deliveryId:claim.id,from:String(env.MAIL_FROM??''),to:[claim.to],subject:'Your invoice '+doc.number,text:doc.content,html:documentHtml(doc),attachments:[{filename:doc.number+'.pdf',contentType:'application/pdf',content:Uint8Array.from(atob(doc.pdfBase64),c=>c.charCodeAt(0))}],headers:{}})}catch{outcome={status:'uncertain',provider:'mail'}}
 return execute(env.DB,actor as any,'invoice.deliveryOutcome',{deliveryId:claim.id,version:claim.version,status:outcome.status==='rejected'?'failed':outcome.status,provider:outcome.provider??'mail',providerMessageId:outcome.providerMessageId??null},authority)
}
