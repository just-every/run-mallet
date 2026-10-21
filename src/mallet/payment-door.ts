import type {Bindings} from '../auth.server'
import type {Actor,Authority} from './auth'
import {execute,expectVersion,fail,find,load,rows,text} from './model'
async function stripeReceipt(env:Bindings,id:string,invoiceId:string){
 if(!env.STRIPE_SECRET_KEY)fail('PAYMENT_CONFIGURATION','Configure the shop-owned Stripe secret privately before checking processor evidence.',null,503)
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000)
 try{
  const response=await fetch('https://api.stripe.com/v1/payment_intents/'+encodeURIComponent(id)+'?expand%5B%5D=latest_charge',{headers:{authorization:'Bearer '+env.STRIPE_SECRET_KEY},signal:controller.signal,redirect:'manual'})
  if(!response.ok)fail('PAYMENT_PROVIDER','The processor could not confirm this payment. No settlement was recorded.',null,502)
  const reader=response.body?.getReader();if(!reader)fail('PAYMENT_PROVIDER','The processor returned no receipt.',null,502)
  const parts:Uint8Array[]=[];let size=0
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)fail('PAYMENT_PROVIDER','The processor receipt exceeded the allowed size.',null,502);parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  let r:any;try{r=JSON.parse(new TextDecoder().decode(bytes))}catch{return fail('PAYMENT_PROVIDER','The processor returned an invalid receipt.',null,502)}
  const charge=r.latest_charge
  if(r.id!==id||r.metadata?.mallet_invoice_id!==invoiceId||r.status!=='succeeded'||r.currency!=='usd'||!Number.isSafeInteger(r.amount_received)||r.amount_received<=0||!charge||typeof charge!=='object'||charge.paid!==true||charge.captured!==true||charge.refunded!==false||charge.amount_refunded!==0||charge.currency!=='usd'||charge.amount!==r.amount_received||typeof r.livemode!=='boolean')fail('PAYMENT_UNSETTLED','Require a succeeded USD payment bound to this invoice, with captured, paid and unrefunded charge evidence.')
  return {provider:'stripe',paymentIntentId:id,amountCents:r.amount_received,currency:'USD',status:'succeeded',captured:true,refunded:false,livemode:r.livemode,observedAt:new Date().toISOString(),label:'Stripe confirmed captured funds at the recorded time; bank payout is not verified.'}
 }catch(error:any){if(error?.code)throw error;return fail('PAYMENT_PROVIDER','The processor check failed or timed out. No settlement was recorded.',null,502)}finally{clearTimeout(timer)}
}
export async function verifyStripePayment(env:Bindings,actor:Actor,authority:Authority,input:any){
 if(!['owner','admin'].includes(actor.role))fail('FORBIDDEN','An owner or service advisor must check processor evidence.',null,403)
 const s=await load(env.DB),invoice=find(s,'invoice',input.invoiceId);expectVersion(invoice,input.version)
 if(!['approved','exported'].includes(invoice.status))fail('PAYMENT_INVOICE','Approve the exact invoice first.')
 const receipt=await stripeReceipt(env,text(input.paymentIntentId,'processor payment id',200),invoice.id)
 return execute(env.DB,actor as any,'payment.verified',{invoiceId:invoice.id,version:invoice.version,receipt},authority)
}
/** Re-read every receipt at collection. Old exports and caller-provided screenshots or flags are never settlement. */
export async function collectionInput(env:Bindings,actor:Actor,input:any){
 if(!['owner','admin'].includes(actor.role))fail('FORBIDDEN','A native owner or service advisor records handover.',null,403)
 const s=await load(env.DB),job=find(s,'job',input.jobId),invoice=rows(s,'invoice').find(i=>i.jobId===job.id)
 const receipts=[]
 if(!input.overrideId&&invoice)for(const p of rows(s,'payment').filter(p=>p.invoiceId===invoice.id&&p.verified===true))receipts.push(await stripeReceipt(env,p.receipt.paymentIntentId,invoice.id))
 return {...input,settlementVersion:s.version,settlementReceipts:receipts}
}
