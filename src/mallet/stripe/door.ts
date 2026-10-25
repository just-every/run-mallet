import type {Bindings} from '../../auth.server'
import {runtimeBindings} from '../../auth.server'
import {identity,originGuard,HttpError} from '../auth'
import {requireStepUp} from '../strong-auth/gate'
import {find,load,MalletError} from '../model'
import {e} from '../ui/common'
import {page} from '../ui/shell'
import {connectStripe,createCheckout,expireCheckout,observeEvent,openCheckout,reconcileSession,reconcileSettlement} from './service'
import {stripeInvoice,stripeSettings} from './ui'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
async function inputBody(request:Request,api:boolean){
 if(!request.headers.get('content-type')?.startsWith(api?'application/json':'application/x-www-form-urlencoded'))throw new HttpError(415,'invalid_content_type')
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'input_required')
 const parts:Uint8Array[]=[];let length=0
 try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16384)throw new HttpError(413,'body_too_large');parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
 const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
 const text=new TextDecoder().decode(bytes)
 if(api){try{const input=JSON.parse(text);if(!input||typeof input!=='object'||Array.isArray(input))throw Error();return input}catch{throw new HttpError(400,'invalid_json')}}
 const input:any=Object.fromEntries(new URLSearchParams(text));input.consent=input.consent==='yes';if(input.version)input.version=Number(input.version);return input
}
export async function stripeResponse(request:Request,original:Bindings):Promise<Response|null>{
 const url=new URL(request.url),path=url.pathname,invoicePage=path.match(/^\/app\/invoices\/([^/]+)\/payment$/),open=path.match(/^\/app\/stripe\/checkout\/([^/]+)$/),api=path.startsWith('/api/mallet/stripe/')
 if(!api&&path!=='/app/stripe'&&!invoicePage&&!open)return null
 const env=runtimeBindings(original)
 let actor:any
 try{
  const auth=await identity(request,env);actor=auth.actor;originGuard(request,env,auth.bearer)
  if(actor.role!=='owner'||auth.bearer||actor.staff)throw new HttpError(403,'owner_required','Only the signed-in current owner can collect Stripe payments.')
  if(request.method==='GET'||request.method==='HEAD'){
   if(open)return new Response(null,{status:303,headers:{...headers,location:await openCheckout(env,actor,open[1],auth.authority)}})
   const state=await load(env.DB)
   if(api){if(path!=='/api/mallet/stripe/status')throw new HttpError(404,'not_found');return Response.json({connections:state.records.stripeConnection??[],checkouts:state.records.stripeCheckout??[],events:state.records.stripeEvent??[],settlements:state.records.stripeSettlement??[]},{headers})}
   return page(invoicePage?'Invoice payment':'Stripe settings',invoicePage?stripeInvoice(state,find(state,'invoice',invoicePage[1]),actor.id):stripeSettings(state,actor.id),actor,200,{section:invoicePage?'jobs':'data'})
  }
  if(request.method!=='POST')throw new HttpError(405,'method_not_allowed')
  const authority=requireStepUp(auth,true),input=await inputBody(request,api),command=api?path.split('/').at(-1):input.command
  const handlers:Record<string,Function>={connect:connectStripe,checkout:createCheckout,expire:expireCheckout,event:observeEvent,session:reconcileSession,settlement:reconcileSettlement},handler=handlers[String(command)]
  if(!handler)throw new HttpError(404,'not_found')
  const result=await handler(env,actor,authority,input)
  if(api)return Response.json(result,{headers})
  return new Response(null,{status:303,headers:{...headers,location:input.invoiceId?'/app/invoices/'+encodeURIComponent(input.invoiceId)+'/payment':'/app/stripe'}})
 }catch(error:any){
  if(!(error instanceof HttpError)&&!(error instanceof MalletError))throw error
  if(api)return Response.json({error:error.code,message:error.message,details:error instanceof MalletError?error.details:null},{status:error.status,headers})
  if(error.status===401)return new Response(null,{status:303,headers:{...headers,location:'/signin?returnTo='+encodeURIComponent(path)}})
  const back=error.code==='step_up_required'?'/app/security?returnTo='+encodeURIComponent(path):invoicePage?path:'/app/stripe'
  return page('Stripe payment',`<section class="card"><p role="alert">${e(error.message)}</p><p><a href="${e(back)}">${error.code==='step_up_required'?'Confirm your identity':'Return to payment'}</a></p></section>`,actor,error.status,{section:'data'})
 }
}
