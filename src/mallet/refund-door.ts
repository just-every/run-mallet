import type {Bindings} from '../auth.server'
import type {Actor,Authority} from './auth'
import {execute,expectVersion,fail,find,load} from './model'
import {connectorSecret} from './connectors/secrets'
async function stripe(key:string,path:string,init:RequestInit={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000)
 try{
  const response=await fetch('https://api.stripe.com/v1/refunds'+path,{...init,headers:{authorization:'Bearer '+key,...init.headers},signal:controller.signal,redirect:'manual'})
  if(!response.ok)throw Error('unconfirmed')
  const reader=response.body?.getReader();if(!reader)throw Error('empty')
  let size=0;const parts:Uint8Array[]=[]
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)throw Error('oversize');parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
 }finally{clearTimeout(timer)}
}
export async function refundDoor(env:Bindings,actor:Actor,authority:Authority,command:string,p:any){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner sends or reconciles refunds.',null,403)
 const key=await connectorSecret(env,'stripe','STRIPE_SECRET_KEY')
 if(!key)fail('REFUND_CONFIGURATION','Configure the shop-owned Stripe connection privately first.',null,503)
 let s=await load(env.DB),refund=find(s,'refund',p.refundId);expectVersion(refund,p.version)
 if(refund.redirect)fail('REFUND_FINAL','A redirected refund cannot be submitted or reconciled again.')
 const payment=find(s,'payment',refund.paymentId)
 if(refund.method!=='stripe'||!payment.verified||!payment.receipt?.paymentIntentId)fail('REFUND_PROVIDER','Choose an original verified Stripe tender.')
 if(command==='refund.submit')refund=await execute(env.DB,actor,'refund.claim',p,authority)
 else if(refund.status==='unsubmitted')fail('REFUND_STATE','No approved submission exists to reconcile.')
 let status='uncertain',receipt=null
 try{
  const value=command==='refund.submit'
   ?await stripe(key,'',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','idempotency-key':'mallet-refund-'+refund.id},body:new URLSearchParams({payment_intent:payment.receipt.paymentIntentId,amount:String(refund.amountCents),'metadata[mallet_refund_id]':refund.id})})
   :refund.providerId?await stripe(key,'/'+encodeURIComponent(refund.providerId)):await stripe(key,'?'+new URLSearchParams({payment_intent:payment.receipt.paymentIntentId,limit:'100'}))
  const matches=Array.isArray(value.data)?value.data.filter((r:any)=>r.metadata?.mallet_refund_id===refund.id):[value]
  if(matches.length!==1)throw Error('unconfirmed')
  const r=matches[0]
  if(typeof r.id!=='string'||!r.id||r.id.length>200||r.payment_intent!==payment.receipt.paymentIntentId||r.metadata?.mallet_refund_id!==refund.id||r.amount!==refund.amountCents||r.currency!=='usd'||!['pending','requires_action','succeeded','failed','canceled'].includes(r.status)||refund.providerId&&r.id!==refund.providerId)throw Error('mismatched')
  status=r.status==='succeeded'?'refunded':['failed','canceled'].includes(r.status)?'failed':'pending'
  receipt={id:r.id,paymentIntentId:r.payment_intent,amountCents:r.amount,currency:'USD',status:r.status,label:'Stripe refund outcome observed; bank receipt is not verified.'}
 }catch{/* Keep ambiguity visible. Never repeat a POST or infer a failed transfer. */}
 s=await load(env.DB);refund=find(s,'refund',refund.id)
 return execute(env.DB,actor,'refund.outcome',{refundId:refund.id,version:refund.version,status,receipt},authority)
}
