import type {Bindings} from '../../auth.server'
import {connectorSecret} from '../connectors/secrets'
import {fail} from '../model'

export async function stripeRequest(env:Bindings,path:string,fields?:URLSearchParams,idempotencyKey?:string){
 const key=await connectorSecret(env,'stripe','STRIPE_SECRET_KEY')
 if(!key)fail('STRIPE_CONFIGURATION','Save the merchant Stripe key in Connectors first.',null,503)
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000)
 try{
  const response=await fetch('https://api.stripe.com/v1'+path,{method:fields?'POST':'GET',headers:{authorization:'Bearer '+key,...(fields?{'content-type':'application/x-www-form-urlencoded'}:{}),...(idempotencyKey?{'idempotency-key':idempotencyKey}:{})},...(fields?{body:fields.toString()}:{}),signal:controller.signal,redirect:'manual'})
  const reader=response.body?.getReader();if(!reader)fail('STRIPE_PROVIDER','Stripe returned no response.',null,502)
  const parts:Uint8Array[]=[];let size=0
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>262144)fail('STRIPE_PROVIDER','Stripe returned an oversized response.',null,502);parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  let value:any;try{value=JSON.parse(new TextDecoder().decode(bytes))}catch{fail('STRIPE_PROVIDER','Stripe returned an invalid response.',null,502)}
  if(!response.ok)fail('STRIPE_PROVIDER','Stripe refused this request. Inspect the merchant dashboard before another attempt.',{status:response.status,code:typeof value?.error?.code==='string'?value.error.code:null},502)
  return value
 }catch(error:any){if(error?.code)throw error;fail('STRIPE_UNCERTAIN','Stripe did not confirm the result. No automatic retry will occur. Inspect the merchant dashboard.',null,502)}finally{clearTimeout(timer)}
}
export function testMode(env:Bindings){return env.AUTH_LOCAL==='true'||env.RER_DEMO==='1'}
export function hostedUrl(value:unknown){
 if(typeof value!=='string')fail('STRIPE_CHECKOUT','Stripe has not supplied an open hosted checkout.')
 const url=new URL(value)
 if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password)fail('STRIPE_CHECKOUT','Stripe returned an unexpected checkout address.')
 return value
}
export const providerId=(value:any,label:string)=>{
 if(typeof value!=='string'||!value||value.length>200||!/^[a-zA-Z0-9_-]+$/.test(value))fail('STRIPE_RECEIPT','Stripe returned an invalid '+label+'.')
 return value
}
