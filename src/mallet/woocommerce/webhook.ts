import type {Bindings} from '../../auth.server'
import {runtimeBindings} from '../../auth.server'
import {HttpError} from '../auth'
import {current,observe} from './service'
export async function wooWebhook(request:Request,original:Bindings):Promise<Response|null>{
 if(new URL(request.url).pathname!=='/api/mallet/woocommerce/events')return null
 const headers={'cache-control':'no-store'}
 try{
  if(request.method!=='POST')throw new HttpError(405,'post_required')
  const env=runtimeBindings(original),c=await current(env),reader=request.body?.getReader(),parts:Uint8Array[]=[];let size=0
  if(!reader)throw new HttpError(400,'invalid_event')
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024)throw new HttpError(413,'body_too_large');parts.push(value)}}finally{await reader.cancel()}
  const raw=new Uint8Array(size);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length}
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(c.signing),{name:'HMAC',hash:'SHA-256'},false,['verify'])
  let signature:Uint8Array<ArrayBuffer>;try{signature=Uint8Array.from(atob(request.headers.get('x-wc-webhook-signature')??''),x=>x.charCodeAt(0))}catch{throw new HttpError(401,'invalid_signature')}
  if(!await crypto.subtle.verify('HMAC',key,signature,raw))throw new HttpError(401,'invalid_signature')
  if(!['order.created','order.updated','order.restored'].includes(request.headers.get('x-wc-webhook-topic')??''))throw new HttpError(400,'unsupported_topic')
  let value:any;try{value=JSON.parse(new TextDecoder().decode(raw))}catch{throw new HttpError(400,'invalid_event')}
  if(!Number.isSafeInteger(value.id)||value.id<1)throw new HttpError(400,'invalid_order')
  return Response.json(await observe(env,c,value.id),{headers})
 }catch(error:any){return Response.json({error:error instanceof HttpError?error.code:error.code??'woo_observation_failed'},{status:error.status??409,headers})}
}
