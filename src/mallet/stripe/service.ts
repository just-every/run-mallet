import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {execute,expectVersion,fail,find,load,rows,text} from '../model'
import {currentConnection} from './records'
import {hostedUrl,providerId,stripeRequest,testMode} from './provider'

export async function connectStripe(env:Bindings,actor:Actor,authority:Authority,input:any){
 if(input.consent!==true)fail('INPUT','Confirm that this is the merchant account for this installation.',null,400)
 const account=await stripeRequest(env,'/account'),balance=await stripeRequest(env,'/balance')
 if(account.default_currency!=='usd'||account.country!=='US')fail('STRIPE_CURRENCY','This collection door requires a US merchant account settling USD.')
 if(typeof balance.livemode!=='boolean'||(!testMode(env)&&!balance.livemode))fail('STRIPE_MODE','Test-mode credentials may only connect to a local or demo installation.')
 return execute(env.DB,actor as any,'stripe.connect',{accountId:providerId(account.id,'account'),livemode:balance.livemode},authority)
}
async function accountScope(env:Bindings,actor:Actor){
 const s=await load(env.DB),account=currentConnection(s,actor.id),actual=await stripeRequest(env,'/account'),balance=await stripeRequest(env,'/balance')
 if(actual.id!==account.accountId||actual.default_currency!=='usd'||balance.livemode!==account.livemode)fail('STRIPE_CONNECTION','The Stripe credential no longer matches the connected USD merchant account.')
 return {s,account}
}
export async function createCheckout(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await accountScope(env,actor),invoice=find(s,'invoice',input.invoiceId);expectVersion(invoice,input.version)
 const claim=await execute(env.DB,actor as any,'stripe.claim',{...input,connectionId:account.id},authority)
 const checkout=claim.checkout
 if(!claim.claimed)return checkout
 const metadata={mallet_invoice_id:invoice.id,mallet_invoice_revision:String(invoice.revision),mallet_checkout_id:checkout.id}
 const fields=new URLSearchParams({mode:'payment','payment_method_types[0]':checkout.method,client_reference_id:invoice.id,'line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(checkout.amountCents),'line_items[0][price_data][product_data][name]':'Repair invoice '+invoice.number,'line_items[0][quantity]':'1',success_url:env.AUTH_ORIGIN+'/app/invoices/'+encodeURIComponent(invoice.id)+'/payment',cancel_url:env.AUTH_ORIGIN+'/app/invoices/'+encodeURIComponent(invoice.id)+'/payment',expires_at:String(Math.floor(Date.now()/1000)+2100)})
 for(const [key,value] of Object.entries(metadata)){fields.set('metadata['+key+']',value);fields.set('payment_intent_data[metadata]['+key+']',value)}
 try{
  const session=await stripeRequest(env,'/checkout/sessions',fields,'mallet-checkout-'+checkout.id)
  validateSession(session,checkout);hostedUrl(session.url)
  return await execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:invoice.id,checkoutId:checkout.id,sessionId:providerId(session.id,'checkout'),expiresAt:new Date(session.expires_at*1000).toISOString()},authority)
 }catch(error:any){
  await execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:invoice.id,checkoutId:checkout.id,rejected:error.code==='STRIPE_PROVIDER'&&error.details?.status>=400&&error.details?.status<500},authority)
  throw error
 }
}
function validateSession(session:any,checkout:any){
 if(session.client_reference_id!==checkout.invoiceId||session.metadata?.mallet_checkout_id!==checkout.id||session.metadata?.mallet_invoice_id!==checkout.invoiceId||session.metadata?.mallet_invoice_revision!==String(checkout.invoiceRevision)||session.amount_total!==checkout.amountCents||session.currency!=='usd'||session.livemode!==checkout.livemode)fail('STRIPE_SCOPE','The hosted session does not match this exact invoice and checkout.')
}
export async function openCheckout(env:Bindings,actor:Actor,id:string,authority:Authority){
 const {s}=await accountScope(env,actor),checkout=find(s,'stripeCheckout',id),account=currentConnection(s,actor.id)
 if((checkout.accountId!==account.accountId||checkout.livemode!==account.livemode)||checkout.status!=='open'||!checkout.sessionId)fail('STRIPE_CHECKOUT','This hosted checkout is not open.')
 const session=await stripeRequest(env,'/checkout/sessions/'+encodeURIComponent(checkout.sessionId));validateSession(session,checkout)
 if(session.status!=='open')fail('STRIPE_CHECKOUT','Reconcile this completed or expired checkout before continuing.')
 if(!await env.DB.prepare('SELECT 1 AS ok WHERE ('+authority.sql+')').bind(...authority.params).first())fail('FORBIDDEN','Your owner session changed while reading Stripe. Sign in again.',null,403)
 return hostedUrl(session.url)
}
export async function expireCheckout(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await accountScope(env,actor),checkout=find(s,'stripeCheckout',input.checkoutId)
 if((checkout.accountId!==account.accountId||checkout.livemode!==account.livemode)||!checkout.sessionId)fail('STRIPE_SCOPE','Choose a hosted session from this connected account.')
 const session=await stripeRequest(env,'/checkout/sessions/'+encodeURIComponent(checkout.sessionId));validateSession(session,checkout)
 if(session.status==='open'){
  const expired=await stripeRequest(env,'/checkout/sessions/'+encodeURIComponent(checkout.sessionId)+'/expire',new URLSearchParams(),'mallet-expire-'+checkout.id)
  if(expired.status!=='expired')fail('STRIPE_CHECKOUT','Stripe did not confirm expiration.')
 }else if(session.status!=='expired')fail('STRIPE_CHECKOUT','A completed checkout cannot be expired. Reconcile its payment.')
 return execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:checkout.invoiceId,checkoutId:checkout.id,expired:true},authority)
}
export async function reconcileSession(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await accountScope(env,actor),checkout=find(s,'stripeCheckout',input.checkoutId)
 if((checkout.accountId!==account.accountId||checkout.livemode!==account.livemode))fail('STRIPE_SCOPE','Choose a checkout from the connected merchant account.')
 const session=await stripeRequest(env,'/checkout/sessions/'+encodeURIComponent(text(input.sessionId,'hosted session id',200)));validateSession(session,checkout)
 if(!['open','complete','expired'].includes(session.status))fail('STRIPE_CHECKOUT','Stripe returned an unknown session state.')
 return execute(env.DB,actor as any,'stripe.outcome',{connectionId:account.id,invoiceId:checkout.invoiceId,checkoutId:checkout.id,sessionId:providerId(session.id,'checkout'),expiresAt:new Date(session.expires_at*1000).toISOString(),reconciled:true,expired:session.status==='expired',complete:session.status==='complete'},authority)
}
export async function observeEvent(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await accountScope(env,actor),eventId=text(input.eventId,'Stripe event id',200),ev=await stripeRequest(env,'/events/'+encodeURIComponent(eventId))
 if(ev.id!==eventId||ev.livemode!==account.livemode||!['payment_intent.succeeded','payment_intent.processing','payment_intent.payment_failed','checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(ev.type))fail('STRIPE_EVENT','Choose an authenticated payment or Checkout event from this merchant account.')
 const object=ev.data?.object,checkout=rows(s,'stripeCheckout').find(r=>r.id===object?.metadata?.mallet_checkout_id&&r.accountId===account.accountId&&r.livemode===account.livemode)
 if(!checkout||object.metadata?.mallet_invoice_id!==checkout.invoiceId||object.metadata?.mallet_invoice_revision!==String(checkout.invoiceRevision))fail('STRIPE_SCOPE','The event does not identify this invoice checkout.')
 const paymentIntentId=providerId(ev.type.startsWith('checkout.')?object.payment_intent:object.id,'payment intent'),pi=await stripeRequest(env,'/payment_intents/'+encodeURIComponent(paymentIntentId)+'?expand%5B%5D=latest_charge.balance_transaction')
 if(pi.id!==paymentIntentId)fail('STRIPE_SCOPE','Stripe returned a different payment intent.')
 const receipt=paymentReceipt(pi,checkout)
 return execute(env.DB,actor as any,'stripe.observe',{connectionId:account.id,invoiceId:checkout.invoiceId,checkoutId:checkout.id,eventId,eventType:ev.type,paymentIntentId,status:pi.status,receipt},authority)
}
function paymentReceipt(pi:any,checkout:any){
 if(pi.metadata?.mallet_invoice_id!==checkout.invoiceId||pi.metadata?.mallet_invoice_revision!==String(checkout.invoiceRevision)||pi.metadata?.mallet_checkout_id!==checkout.id||pi.currency!=='usd'||pi.amount!==checkout.amountCents||pi.livemode!==checkout.livemode)fail('STRIPE_SCOPE','The processor payment does not match the exact checkout and invoice.')
 if(!['succeeded','processing','requires_payment_method','canceled'].includes(pi.status))fail('STRIPE_PENDING','The payment is not yet confirmed. No allocation was recorded.')
 if(pi.status!=='succeeded')return null
 const charge=pi.latest_charge
 if(!charge||typeof charge!=='object'||charge.paid!==true||charge.captured!==true||charge.disputed!==false||charge.refunded!==false||charge.amount_refunded!==0||charge.currency!=='usd'||charge.amount!==checkout.amountCents||pi.amount_received!==checkout.amountCents)fail('STRIPE_UNSETTLED','Require captured, unrefunded and undisputed USD funds before allocating payment. Returns need owner review.')
 return {provider:'stripe',chargeId:providerId(charge.id,'charge'),invoiceRevision:checkout.invoiceRevision,disputed:false,paymentIntentId:providerId(pi.id,'payment intent'),amountCents:pi.amount_received,currency:'USD',status:'succeeded',captured:true,refunded:false,livemode:pi.livemode,observedAt:new Date().toISOString(),label:'Stripe confirmed captured funds at the recorded time; bank payout is not verified.'}
}
export async function reconcileSettlement(env:Bindings,actor:Actor,authority:Authority,input:any){
 const {s,account}=await accountScope(env,actor),checkout=find(s,'stripeCheckout',input.checkoutId)
 if((checkout.accountId!==account.accountId||checkout.livemode!==account.livemode)||!checkout.paymentIntentId)fail('STRIPE_SCOPE','Reconcile a confirmed payment from this connected merchant account.')
 const pi=await stripeRequest(env,'/payment_intents/'+encodeURIComponent(checkout.paymentIntentId)+'?expand%5B%5D=latest_charge.balance_transaction');paymentReceipt(pi,checkout)
 const payment=rows(s,'payment').find(r=>r.invoiceId===checkout.invoiceId&&r.receipt?.paymentIntentId===pi.id),charge=pi.latest_charge,bt=charge?.balance_transaction
 if(!payment||!bt||typeof bt!=='object')fail('STRIPE_SETTLEMENT_PENDING','Stripe has not supplied the charge balance transaction yet. No fees or payout were inferred.')
 if(bt.currency!=='usd'||bt.source!==charge.id||bt.type!=='charge')fail('STRIPE_SETTLEMENT','Require the USD charge balance transaction for this exact payment.')
 let payout:any=null
 if(input.payoutId){
  payout=await stripeRequest(env,'/payouts/'+encodeURIComponent(text(input.payoutId,'payout id',200)))
  if(payout.id!==input.payoutId||payout.currency!=='usd'||payout.livemode!==account.livemode||payout.automatic!==true)fail('STRIPE_PAYOUT','Require a USD automatic payout; manual payouts have no provider transaction membership.')
  let after='',found=false,more=true
  for(let page=0;page<10&&more&&!found;page++){
   const list=await stripeRequest(env,'/balance_transactions?'+new URLSearchParams({payout:payout.id,limit:'100',...(after?{starting_after:after}:{})}))
   if(!Array.isArray(list.data))fail('STRIPE_PAYOUT','Stripe returned invalid payout membership.')
   found=list.data.some((r:any)=>r.id===bt.id&&r.source===charge.id&&r.net===bt.net&&r.currency==='usd');more=list.has_more===true;after=list.data.at(-1)?.id??''
  }
  if(!found)fail('STRIPE_PAYOUT','This charge balance transaction is not proved to be a member of that payout.')
 }
 return execute(env.DB,actor as any,'stripe.settlement',{connectionId:account.id,invoiceId:checkout.invoiceId,checkoutId:checkout.id,paymentId:payment.id,balanceTransactionId:providerId(bt.id,'balance transaction'),chargeId:providerId(charge.id,'charge'),grossCents:bt.amount,feeCents:bt.fee,netCents:bt.net,availableOn:new Date(bt.available_on*1000).toISOString(),payoutId:payout?.id??null,payoutStatus:payout?.status??null,payoutAmountCents:payout?.amount??null,payoutArrivalAt:payout?new Date(payout.arrival_date*1000).toISOString():null},authority)
}
