import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {execute,expectVersion,fail,find,load,rows} from '../model'
import {currentConnection} from './records'
import {providerId,stripeRequest,testMode} from './provider'

async function scope(env:Bindings,actor:Actor){
 if(actor.role!=='owner')fail('FORBIDDEN','Only the current owner can collect reader payments.',null,403)
 const s=await load(env.DB),account=currentConnection(s,actor.id),actual=await stripeRequest(env,'/account'),balance=await stripeRequest(env,'/balance')
 if(actual.id!==account.accountId||actual.country!=='US'||actual.default_currency!=='usd'||balance.livemode!==account.livemode||!testMode(env)&&!account.livemode)fail('STRIPE_CONNECTION','The Stripe credential must match the connected US merchant account and USD mode.')
 return {s,account}
}
function validateIntent(pi:any,checkout:any){
 if((checkout.paymentIntentId&&pi.id!==checkout.paymentIntentId)||pi.metadata?.mallet_checkout_id!==checkout.id||pi.metadata?.mallet_invoice_id!==checkout.invoiceId||pi.metadata?.mallet_invoice_revision!==String(checkout.invoiceRevision)||pi.amount!==checkout.amountCents||pi.currency!=='usd'||pi.livemode!==checkout.livemode||pi.capture_method!=='automatic'||!Array.isArray(pi.payment_method_types)||!pi.payment_method_types.includes('card_present'))fail('STRIPE_SCOPE','The reader payment does not match this exact invoice, amount and merchant mode.')
 providerId(pi.id,'payment intent')
}
function checkoutScope(s:any,account:any,id:any){
 const checkout=find(s,'stripeCheckout',id),invoice=find(s,'invoice',checkout.invoiceId)
 if(checkout.method!=='card_present'||checkout.accountId!==account.accountId||checkout.livemode!==account.livemode||checkout.invoiceRevision!==invoice.revision||checkout.invoiceTotalCents!==invoice.totals.totalCents)fail('STRIPE_SCOPE','Choose a reader payment for this current merchant account and invoice.')
 return checkout
}
// Official server-driven smart readers; simulated readers are accepted only in test mode.
function validateReader(reader:any,id:string,account:any){
 const devices=['bbpos_wisepos_e','stripe_s700','stripe_s710'],simulated=['simulated_wisepos_e','simulated_stripe_s700','simulated_stripe_s710']
 if(reader.id!==id||reader.object!=='terminal.reader'||reader.livemode!==account.livemode||!devices.includes(reader.device_type)&&!(account.livemode===false&&simulated.includes(reader.device_type)))fail('STRIPE_READER','Choose a WisePOS E, S700 or S710 reader registered to this merchant account and mode.')
}
function readerStatus(reader:any,checkout:any){
 const action=reader.action
 if(!action)return 'cleared'
 if(action.type!=='process_payment_intent'||action.process_payment_intent?.payment_intent!==checkout.paymentIntentId)return 'cleared'
 if(!['in_progress','succeeded','failed'].includes(action.status))fail('STRIPE_READER','Stripe returned an unknown reader action state.')
 return action.status as string
}
async function outcome(env:Bindings,actor:Actor,authority:Authority,account:any,checkout:any,action:any,status:string,reconciled=false){
 return execute(env.DB,actor as any,'stripe.terminalOutcome',{connectionId:account.id,checkoutId:checkout.id,actionId:action.id,status,reconciled},authority)
}
export async function prepareTerminal(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await scope(env,actor),invoice=find(s,'invoice',input.invoiceId);expectVersion(invoice,input.version)
 const claim=await execute(env.DB,actor as any,'stripe.claim',{...input,method:'card_present',connectionId:account.id},authority),checkout=claim.checkout
 if(!claim.claimed)return checkout
 const fields=new URLSearchParams({amount:String(checkout.amountCents),currency:'usd','payment_method_types[0]':'card_present',capture_method:'automatic','metadata[mallet_invoice_id]':invoice.id,'metadata[mallet_invoice_revision]':String(invoice.revision),'metadata[mallet_checkout_id]':checkout.id})
 try{
  const pi=await stripeRequest(env,'/payment_intents',fields,'mallet-terminal-'+checkout.id);validateIntent(pi,checkout)
  if(pi.status!=='requires_payment_method')fail('STRIPE_TERMINAL','Stripe did not return an unstarted reader payment.')
  return await execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:invoice.id,checkoutId:checkout.id,paymentIntentId:pi.id},authority)
 }catch(error:any){
  await execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:invoice.id,checkoutId:checkout.id,rejected:error.code==='STRIPE_PROVIDER'&&error.details?.status>=400&&error.details?.status<500},authority)
  throw error
 }
}
export async function sendTerminal(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await scope(env,actor),checkout=checkoutScope(s,account,input.checkoutId),readerId=providerId(input.readerId,'reader')
 const prior=rows(s,'stripeReaderAction').find(r=>r.checkoutId===checkout.id&&r.kind==='process')
 if(prior){if(prior.readerId!==readerId)fail('STRIPE_REPLAY','This payment already identifies a different reader.');return prior}
 if(!checkout.paymentIntentId||checkout.status!=='open')fail('STRIPE_TERMINAL','Prepare and reconcile the payment before sending it to a reader.')
 const pi=await stripeRequest(env,'/payment_intents/'+encodeURIComponent(checkout.paymentIntentId));validateIntent(pi,checkout)
 if(pi.status!=='requires_payment_method')fail('STRIPE_TERMINAL','Inspect the existing provider payment before starting another reader action.')
 const reader=await stripeRequest(env,'/terminal/readers/'+encodeURIComponent(readerId));validateReader(reader,readerId,account)
 if(reader.action?.status==='in_progress')fail('STRIPE_READER_BUSY','The reader already has an action in progress.')
 const claim=await execute(env.DB,actor as any,'stripe.terminalClaim',{connectionId:account.id,checkoutId:checkout.id,readerId,kind:'process'},authority)
 if(!claim.claimed)return claim.action
 try{
  const result=await stripeRequest(env,'/terminal/readers/'+encodeURIComponent(readerId)+'/process_payment_intent',new URLSearchParams({payment_intent:checkout.paymentIntentId}),'mallet-reader-'+claim.action.id)
  validateReader(result,readerId,account);const status=readerStatus(result,checkout)
  if(status==='cleared')fail('STRIPE_TERMINAL','Stripe did not confirm this reader action.')
  return await outcome(env,actor,authority,account,checkout,claim.action,status)
 }catch(error){await outcome(env,actor,authority,account,checkout,claim.action,'uncertain');throw error}
}
export async function reconcileTerminal(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await scope(env,actor),checkout=checkoutScope(s,account,input.checkoutId)
 const paymentIntentId=providerId(checkout.paymentIntentId??input.paymentIntentId,'payment intent'),pi=await stripeRequest(env,'/payment_intents/'+encodeURIComponent(paymentIntentId));validateIntent(pi,checkout)
 const result=await execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:checkout.invoiceId,checkoutId:checkout.id,paymentIntentId,reconciled:true,expired:pi.status==='canceled',complete:['processing','succeeded','requires_capture'].includes(pi.status)},authority)
 for(const action of rows(s,'stripeReaderAction').filter(r=>r.checkoutId===checkout.id)){
  if(action.kind==='cancel_intent'){await outcome(env,actor,authority,account,checkout,action,pi.status==='canceled'?'canceled':'uncertain',true);continue}
  const reader=await stripeRequest(env,'/terminal/readers/'+encodeURIComponent(action.readerId));validateReader(reader,action.readerId,account)
  const status=readerStatus(reader,checkout)
  await outcome(env,actor,authority,account,checkout,action,action.kind==='cancel_reader'?(status==='cleared'?'canceled':'uncertain'):status,true)
 }
 return result
}
export async function cancelTerminal(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await scope(env,actor),checkout=checkoutScope(s,account,input.checkoutId)
 if(!checkout.paymentIntentId)fail('STRIPE_TERMINAL','Inspect the existing payment intent before canceling it.')
 const process=rows(s,'stripeReaderAction').find(r=>r.checkoutId===checkout.id&&r.kind==='process'),readerId=process?.readerId??providerId(input.readerId,'reader')
 const pi=await stripeRequest(env,'/payment_intents/'+encodeURIComponent(checkout.paymentIntentId));validateIntent(pi,checkout)
 if(pi.status==='succeeded'||checkout.status==='paid')fail('STRIPE_TERMINAL','Reconcile captured funds through the provider event. A captured payment needs the refund door.')
 if(process){
  const reader=await stripeRequest(env,'/terminal/readers/'+encodeURIComponent(readerId));validateReader(reader,readerId,account)
  const status=readerStatus(reader,checkout)
  if(status==='in_progress'){
   const claim=await execute(env.DB,actor as any,'stripe.terminalClaim',{connectionId:account.id,checkoutId:checkout.id,readerId,kind:'cancel_reader'},authority)
   if(!claim.claimed&&claim.action.status!=='canceled')fail('STRIPE_UNCERTAIN','Reader cancellation was already attempted. Inspect it; it will not be resent.')
   if(claim.claimed)try{
    const result=await stripeRequest(env,'/terminal/readers/'+encodeURIComponent(readerId)+'/cancel_action',new URLSearchParams(),'mallet-reader-cancel-'+claim.action.id);validateReader(result,readerId,account)
    if(result.action!==null)fail('STRIPE_UNCERTAIN','Stripe did not confirm that the reader action cleared.')
    await outcome(env,actor,authority,account,checkout,claim.action,'canceled')
   }catch(error){await outcome(env,actor,authority,account,checkout,claim.action,'uncertain');throw error}
  }
 }
 const claim=await execute(env.DB,actor as any,'stripe.terminalClaim',{connectionId:account.id,checkoutId:checkout.id,readerId,kind:'cancel_intent'},authority)
 if(pi.status==='canceled'){
  await outcome(env,actor,authority,account,checkout,claim.action,'canceled',true)
 }else{
  if(!claim.claimed)return claim.action
  try{
   const canceled=await stripeRequest(env,'/payment_intents/'+encodeURIComponent(checkout.paymentIntentId)+'/cancel',new URLSearchParams(),'mallet-intent-cancel-'+claim.action.id);validateIntent(canceled,checkout)
   if(canceled.status!=='canceled')fail('STRIPE_UNCERTAIN','Stripe did not confirm payment cancellation.')
   await outcome(env,actor,authority,account,checkout,claim.action,'canceled')
  }catch(error){await outcome(env,actor,authority,account,checkout,claim.action,'uncertain');throw error}
 }
 return execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:checkout.invoiceId,checkoutId:checkout.id,expired:true},authority)
}
export const terminalHandlers={'terminal-prepare':prepareTerminal,'terminal-send':sendTerminal,'terminal-reconcile':reconcileTerminal,'terminal-cancel':cancelTerminal}
