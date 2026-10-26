import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {execute,fail,load,rows} from '../model'
import {currentConnection} from './records'
import {providerId,stripeRequest,testMode} from './provider'
import {achReturnEvents,returnTransactions} from './return-ledger'

const objectId=(value:any,label:string)=>providerId(typeof value==='object'?value?.id:value,label)
export async function observeAchReturn(env:Bindings,actor:Actor,authority:Authority,input:any){
 if(actor.role!=='owner'||actor.staff)fail('FORBIDDEN','Only the current owner reconciles ACH returns.',null,403)
 const s=await load(env.DB),account=currentConnection(s,actor.id)
 const actual=await stripeRequest(env,'/account'),balance=await stripeRequest(env,'/balance')
 if(actual.id!==account.accountId||actual.default_currency!=='usd'||actual.country!=='US'||typeof balance.livemode!=='boolean'||balance.livemode!==account.livemode||(!testMode(env)&&!balance.livemode))fail('STRIPE_CONNECTION','The Stripe credential must match the connected US merchant account and payment mode.')
 const eventId=providerId(input.eventId,'return event'),ev=await stripeRequest(env,'/events/'+encodeURIComponent(eventId))
 if(ev.id!==eventId||ev.livemode!==account.livemode||!achReturnEvents.includes(ev.type))fail('STRIPE_EVENT','Choose an authenticated ACH dispute event from this merchant account.')
 const disputeId=objectId(ev.data?.object,'dispute'),dispute=await stripeRequest(env,'/disputes/'+encodeURIComponent(disputeId))
 if(dispute.id!==disputeId||dispute.currency!=='usd'||dispute.livemode!==account.livemode)fail('STRIPE_SCOPE','The current dispute must match this merchant account and USD payment mode.')
 const chargeId=objectId(dispute.charge,'returned charge'),charge=await stripeRequest(env,'/charges/'+encodeURIComponent(chargeId))
 const paymentIntentId=objectId(charge.payment_intent,'returned payment intent'),pi=await stripeRequest(env,'/payment_intents/'+encodeURIComponent(paymentIntentId))
 if(dispute.payment_intent!==null&&dispute.payment_intent!==undefined&&objectId(dispute.payment_intent,'disputed payment intent')!==paymentIntentId)fail('STRIPE_SCOPE','The dispute and charge identify different payment intents.')
 if(charge.id!==chargeId||objectId(charge.payment_intent,'charge payment intent')!==paymentIntentId||pi.id!==paymentIntentId||objectId(pi.latest_charge,'latest charge')!==chargeId||charge.currency!=='usd'||pi.currency!=='usd'||charge.livemode!==account.livemode||pi.livemode!==account.livemode||charge.payment_method_details?.type!=='us_bank_account')fail('STRIPE_SCOPE','Only the exact ACH charge and payment intent can reopen an allocated invoice payment.')
 const checkout=rows(s,'stripeCheckout').find(r=>r.id===pi.metadata?.mallet_checkout_id&&r.accountId===account.accountId&&r.livemode===account.livemode)
 if(!checkout||checkout.method!=='us_bank_account'||checkout.paymentIntentId!==paymentIntentId||pi.metadata?.mallet_invoice_id!==checkout.invoiceId||pi.metadata?.mallet_invoice_revision!==String(checkout.invoiceRevision)||pi.amount!==checkout.amountCents||charge.amount!==checkout.amountCents)fail('STRIPE_SCOPE','The returned payment must match this exact invoice checkout.')
 const payment=rows(s,'payment').find(p=>p.method==='stripe'&&p.verified===true&&p.invoiceId===checkout.invoiceId&&p.receipt?.paymentIntentId===paymentIntentId)
 if(!payment)fail('STRIPE_RETURN','Reconcile the original captured payment before observing its ACH return. A dispute cannot allocate funds.')
 if(!Array.isArray(dispute.balance_transactions))fail('STRIPE_RETURN','Stripe did not supply the current dispute balance transactions.')
 const transactions=[]
 for(const value of dispute.balance_transactions){
  if(typeof value==='string'){
   const id=providerId(value,'return balance transaction'),bt=await stripeRequest(env,'/balance_transactions/'+encodeURIComponent(id))
   if(bt.id!==id)fail('STRIPE_SCOPE','Stripe returned a different return balance transaction.')
   transactions.push(bt)
  }else transactions.push(value)
 }
 const balanceTransactions=returnTransactions(transactions,disputeId)
 return execute(env.DB,actor as any,'stripe.returnObserve',{connectionId:account.id,checkoutId:checkout.id,paymentId:payment.id,paymentIntentId,eventId,eventType:ev.type,disputeId,chargeId,disputedCents:dispute.amount,status:dispute.status,reason:dispute.reason,balanceTransactions},authority)
}
export const returnHandlers={'return':observeAchReturn}
