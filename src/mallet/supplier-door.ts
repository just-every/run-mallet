import type {Bindings} from '../auth.server'
import type {Actor,Authority} from './auth'
import {execute,expectVersion,fail,find,integer,load,text} from './model'
import {supplierSubmission,assertSupplierCart} from './supplier-orders'
import {connectorSecret} from './connectors/secrets'
const instant=(value:unknown,label:string)=>{const raw=text(value,label,80);if(!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(raw)||!Number.isFinite(Date.parse(raw)))fail('SUPPLIER_RESPONSE','Supplier times must identify an exact UTC instant.',null,502);return new Date(raw).toISOString()}
async function settings(env:Bindings){
 const key=await connectorSecret(env,'supplier-gateway','MALLET_SUPPLIER_KEY'),raw=env.MALLET_SUPPLIER_ORIGIN
 let origin:URL;try{origin=new URL(raw??'')}catch{return fail('SUPPLIER_CONFIGURATION','Configure the authorized supplier gateway HTTPS origin and private key.',null,503)}
 if(origin.origin!==raw||origin.protocol!=='https:'||origin.username||origin.password||!key)fail('SUPPLIER_CONFIGURATION','Use an authorized HTTPS gateway origin and active shop-owned key.',null,503)
 return {origin:origin.origin,key}
}
async function edge(origin:string,key:string,path:string,init:RequestInit={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000)
 try{
  const response=await fetch(origin+path,{...init,headers:{authorization:'Bearer '+key,accept:'application/json',...(init.body?{'content-type':'application/json'}:{}),...init.headers},signal:controller.signal,redirect:'manual'})
  if(!response.ok)throw Error('unconfirmed')
  const reader=response.body?.getReader();if(!reader)throw Error('unconfirmed')
  let size=0;const parts:Uint8Array[]=[]
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>131072)throw Error('unconfirmed');parts.push(value)}}finally{await reader.cancel();reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
  if(raw.includes(key))throw Error('unconfirmed')
  return JSON.parse(raw)
 }finally{clearTimeout(timer)}
}
function offers(value:any,quantityMilli:number){
 if(!Array.isArray(value?.offers)||value.offers.length<1||value.offers.length>50)fail('SUPPLIER_RESPONSE','The supplier returned no bounded comparable offers.',null,502)
 const result=value.offers.map((q:any)=>{
  if(typeof q.compatible!=='boolean'||q.currency!=='USD'||q.quantityMilli!==quantityMilli)fail('SUPPLIER_RESPONSE','Supplier quote scope, compatibility and USD currency are required.',null,502)
  const unitCents=integer(q.unitCents,'supplier unit cents',0,100_000_000),freightCents=integer(q.freightCents,'supplier freight cents',0,100_000_000),taxCents=integer(q.taxCents,'supplier tax cents',0,100_000_000)
  const totalCents=integer(Number((BigInt(quantityMilli)*BigInt(unitCents)+500n)/1000n)+freightCents+taxCents,'supplier total cents',0,1_000_000_000)
  return {quoteId:text(q.quoteId,'quote identifier'),supplierId:text(q.supplierId,'supplier identifier'),supplierName:text(q.supplierName,'supplier name'),grade:text(q.grade,'compatible part grade'),compatible:q.compatible,availableMilli:integer(q.availableMilli,'available quantity',0,1_000_000_000),unitCents,freightCents,taxCents,totalCents,quantityMilli,cutoffAt:instant(q.cutoffAt,'delivery cutoff'),etaAt:instant(q.etaAt,'delivery ETA'),expiresAt:instant(q.expiresAt,'quote expiry'),observedAt:instant(q.observedAt,'supplier observation')}
 })
 if(new Set(result.map((q:any)=>q.quoteId)).size!==result.length)fail('SUPPLIER_RESPONSE','Supplier quote identifiers must be unique.',null,502)
 return result
}
function receipt(value:any,submission:any){
 const status=value?.status
 if(!['acknowledged','substitution','cancelled','rejected'].includes(status)||value.clientReference!==submission.clientReference||value.supplierId!==submission.cart.supplierId||value.currency!=='USD')throw Error('unconfirmed')
 const orderId=text(value.orderId,'supplier order identifier'),quoteId=text(value.quoteId,'supplier quote identifier')
 if(quoteId!==submission.cart.quoteId||value.totalCents!==submission.cart.totalCents||!Array.isArray(value.lines)||value.lines.length!==submission.cart.lines.length||value.lines.some((l:any,n:number)=>['sku','grade','unit','quantityMilli','unitCents'].some(k=>l[k]!==submission.cart.lines[n][k])))throw Error('unconfirmed')
 const result:any={status,orderId,receipt:{status,orderId,clientReference:submission.clientReference,supplierId:submission.cart.supplierId,quoteId,currency:'USD',totalCents:submission.cart.totalCents,lines:structuredClone(submission.cart.lines)}}
 if(status==='substitution')result.proposal={id:text(value.proposal?.id,'substitution identifier'),sku:text(value.proposal?.sku,'proposed SKU'),grade:text(value.proposal?.grade,'proposed grade'),unitCents:integer(value.proposal?.unitCents,'proposed unit cost',0,100_000_000)}
 if(value.actionId)result.receipt.actionId=text(value.actionId,'supplier action identifier')
 if(value.reason)result.receipt.reason=text(value.reason,'supplier rejection/cancellation reason',2000)
 return result
}
export async function supplierDoor(env:Bindings,actor:Actor,authority:Authority,command:string,p:any){
 if(!['owner','admin'].includes(actor.role))fail('FORBIDDEN','Only owner and admin operators contact suppliers.',null,403)
 const config=await settings(env),s=await load(env.DB)
 if(command==='purchase.compare'){
  const item=find(s,'stockItem',p.itemId),quantityMilli=Math.round(Number(p.quantity)*1000)
  // Validate quantity through the same domain parser before making a request.
  const {amount}=await import('./inventory');amount(p.quantity)
  let value:any;try{value=await edge(config.origin,config.key,'/v1/quotes?'+new URLSearchParams({sku:item.sku,unit:item.unit,quantity_milli:String(quantityMilli)}))}catch{return fail('SUPPLIER_UNAVAILABLE','Supplier comparison is unavailable; no order was submitted.',null,503)}
  const parsed=offers(value,quantityMilli)
  if(parsed.some((q:any)=>Date.parse(q.observedAt)>Date.now()+300000))fail('SUPPLIER_RESPONSE','The supplier observation time is in the future.',null,502)
  return execute(env.DB,actor,'purchase.retainComparison',{...p,offers:parsed,origin:config.origin},authority)
 }
 const po=find(s,'purchaseOrder',p.purchaseId)
 if(po.supplierOrigin!==config.origin)fail('SUPPLIER_CONFIGURATION','The configured gateway changed; do not send an old approved cart to another destination.',null,409)
 let submission=supplierSubmission(s,po.id),send=false,action:any=null
 if(command==='purchase.submit'){
  if(!submission){assertSupplierCart(s,po,new Date().toISOString());const claimNonce=crypto.randomUUID();submission=await execute(env.DB,actor,'purchase.claimOrder',{...p,claimNonce},authority);send=submission!.claimNonce===claimNonce}
  else if(p.confirm!=='submit-exact-cart')fail('SUPPLIER_APPROVAL','Explicitly confirm this approved cart.')
 }else if(command==='purchase.cancel'||command==='purchase.rejectSubstitution'){
  if(!submission)fail('SUPPLIER_STATE','There is no submitted order to change.')
  const type=command==='purchase.cancel'?'cancel':'reject-substitution',prior=submission.actions.find((a:any)=>a.action===type&&a.proposalId===(p.proposalId??null))
  if(prior){action=prior;send=false}else{
   expectVersion(submission,p.submissionVersion)
   const claimNonce=crypto.randomUUID();submission=await execute(env.DB,actor,'purchase.claimAction',{...p,action:type,claimNonce},authority);action=submission!.actions.find((a:any)=>a.claimNonce===claimNonce);send=Boolean(action)
  }
 }else if(command!=='purchase.reconcile')fail('COMMAND','Unknown supplier operation.',null,400)
 if(!submission)fail('SUPPLIER_STATE','There is no submitted order to reconcile.')
 let outcome:any={status:'uncertain',orderId:submission.orderId,receipt:{status:'uncertain',label:'Supplier outcome unconfirmed. Reconcile by client reference; never submit a new purchase.'}}
 try{
  const currentConfig=await settings(env)
  if(currentConfig.origin!==config.origin)throw Error('unconfirmed')
  const value=send?await edge(config.origin,currentConfig.key,action?'/v1/orders/'+encodeURIComponent(submission.clientReference)+'/actions':'/v1/orders',{method:'POST',headers:{'idempotency-key':action?'mallet-supplier-action-'+action.id:'mallet-supplier-order-'+submission.clientReference},body:JSON.stringify(action?{clientReference:submission.clientReference,actionId:action.id,action:action.action,proposalId:action.proposalId}:{clientReference:submission.clientReference,...submission.cart})}):await edge(config.origin,currentConfig.key,'/v1/orders/'+encodeURIComponent(submission.clientReference))
  outcome=receipt(value,submission)
 }catch{/* Do not retain provider errors or arbitrary response fields. A claimed POST is never automatically repeated. */}
 return execute(env.DB,actor,'purchase.orderOutcome',{purchaseId:po.id,submissionVersion:submission.version,outcome},authority)
}
