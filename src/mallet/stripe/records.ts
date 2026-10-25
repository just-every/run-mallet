import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type Row,type State} from '../model'
import {invoiceBalance,payments} from '../payments'
export const stripeCommands=['stripe.connect','stripe.claim','stripe.outcome','stripe.observe','stripe.settlement']
export const connection=(s:State)=>[...rows(s,'stripeConnection')].sort((a,b)=>a.sequence-b.sequence).at(-1)
export function currentConnection(s:State,ownerId:string){
 const account=connection(s)
 if(!account||account.by.id!==ownerId)fail('STRIPE_CONNECTION','The current owner must connect the merchant Stripe account first.')
 return account
}
export const stripeRecords:Handler=(c,command,p)=>{
 if(!stripeCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages Stripe collection.',null,403)
 if(command==='stripe.connect'){
  const prior=connection(c.s)
  if(prior&&prior.accountId===p.accountId&&prior.livemode===p.livemode&&prior.by.id===c.actor.id)return prior
  if(rows(c.s,'stripeCheckout').some(r=>['claiming','open','uncertain','processing'].includes(r.status)&&(r.accountId!==p.accountId||r.livemode!==p.livemode)))fail('STRIPE_OPEN','Resolve outstanding checkouts before changing the connected account.')
  const row=put(c.s,'stripeConnection',{sequence:rows(c.s,'stripeConnection').length+1,accountId:text(p.accountId,'Stripe account'),currency:'usd',livemode:p.livemode===true,by:who(c),at:c.now})
  event(c,command,null,row.id,{accountId:row.accountId,livemode:row.livemode});return row
 }
 const account=currentConnection(c.s,c.actor.id)
 if(p.connectionId!==account.id)fail('STRIPE_CONNECTION','The connected merchant account changed.')
 const invoice=find(c.s,'invoice',p.invoiceId)
 if(!['approved','exported'].includes(invoice.status))fail('PAYMENT_INVOICE','Approve the exact invoice before collecting payment.')
 if(command==='stripe.claim'){
  expectVersion(invoice,p.version)
  const operationId=text(p.operationId,'checkout operation',200),prior=rows(c.s,'stripeCheckout').find(r=>r.operationId===operationId)
  if(prior){if(prior.invoiceId!==invoice.id||prior.method!==p.method)fail('STRIPE_REPLAY','That operation already identifies a different checkout.');return {checkout:prior,claimed:false}}
  if(rows(c.s,'stripeCheckout').some(r=>r.invoiceId===invoice.id&&['claiming','open','uncertain','processing'].includes(r.status)))fail('STRIPE_OPEN','Reconcile or expire the existing checkout before starting another.')
  if(!['card','us_bank_account','card_present'].includes(p.method)||p.consent!==true)fail('INPUT','Confirm the exact amount and hosted payment method.',null,400)
  const amountCents=invoiceBalance(c.s,invoice).outstandingCents
  integer(amountCents,'invoice balance',1)
  const row=put(c.s,'stripeCheckout',{jobId:invoice.jobId,invoiceId:invoice.id,invoiceRevision:invoice.revision,invoiceTotalCents:invoice.totals.totalCents,amountCents,method:p.method,operationId,connectionId:account.id,accountId:account.accountId,livemode:account.livemode,status:'claiming',by:who(c),at:c.now})
  event(c,command,invoice.jobId,row.id,{amountCents,method:p.method});return {checkout:row,claimed:true}
 }
 const checkout=find(c.s,'stripeCheckout',p.checkoutId)
 if((checkout.accountId!==account.accountId||checkout.livemode!==account.livemode)||checkout.invoiceId!==invoice.id||checkout.invoiceRevision!==invoice.revision||checkout.invoiceTotalCents!==invoice.totals.totalCents)fail('STRIPE_SCOPE','Checkout does not match the current invoice and merchant account.')
 if(command==='stripe.outcome'){
  if(checkout.status==='paid')return checkout
  if(checkout.status!=='claiming'&&!p.expired&&!p.reconciled)return checkout
  if(checkout.paymentIntentId&&p.paymentIntentId&&checkout.paymentIntentId!==p.paymentIntentId)fail('STRIPE_SCOPE','A checkout cannot change its payment intent.')
  if(checkout.sessionId&&p.sessionId&&checkout.sessionId!==p.sessionId)fail('STRIPE_SCOPE','A checkout cannot change its provider session.')
  const status=p.expired?'expired':p.rejected?'failed':p.complete?'processing':p.sessionId||p.paymentIntentId?'open':'uncertain'
  const row=bump(c.s,'stripeCheckout',checkout,{status,...(p.paymentIntentId?{paymentIntentId:text(p.paymentIntentId,'payment intent id')}:{}),...(p.sessionId?{sessionId:text(p.sessionId,'checkout id'),expiresAt:p.expiresAt}:{}),updatedAt:c.now})
  event(c,command,invoice.jobId,row.id,{status});return row
 }
 if(command==='stripe.observe'){
  const prior=rows(c.s,'stripeEvent').find(r=>r.eventId===p.eventId&&r.accountId===account.accountId)
  if(prior)return prior
  const receipt=p.receipt,status=String(p.status)
  let payment:Row|undefined
  if(status==='succeeded')payment=payments(c,'payment.verified',{invoiceId:invoice.id,version:invoice.version,receipt})
  const row=put(c.s,'stripeEvent',{jobId:invoice.jobId,invoiceId:invoice.id,checkoutId:checkout.id,accountId:account.accountId,eventId:text(p.eventId,'provider event'),eventType:text(p.eventType,'provider event type'),paymentIntentId:p.paymentIntentId,status,paymentId:payment?.id??null,by:who(c),at:c.now})
  // The current authenticated processor read governs; an old event never downgrades captured funds.
  bump(c.s,'stripeCheckout',checkout,{status:status==='succeeded'?'paid':status==='processing'?'processing':checkout.status,paymentIntentId:p.paymentIntentId,updatedAt:c.now})
  event(c,command,invoice.jobId,row.id,{eventId:p.eventId,status});return row
 }
 const payment=find(c.s,'payment',p.paymentId)
 if(payment.invoiceId!==invoice.id||payment.receipt?.paymentIntentId!==checkout.paymentIntentId)fail('STRIPE_SCOPE','Settlement must match the allocated invoice payment.')
 const prior=rows(c.s,'stripeSettlement').find(r=>r.paymentId===payment.id&&r.balanceTransactionId===p.balanceTransactionId&&r.payoutId===p.payoutId)
 if(prior)return prior
 const grossCents=integer(p.grossCents,'gross amount',1),feeCents=integer(p.feeCents,'processor fee'),netCents=integer(p.netCents,'net amount')
 if(grossCents!==payment.amountCents||grossCents-feeCents!==netCents)fail('STRIPE_SETTLEMENT','Processor gross, fee and net do not reconcile to this invoice payment.')
 const row=put(c.s,'stripeSettlement',{jobId:invoice.jobId,invoiceId:invoice.id,paymentId:payment.id,accountId:account.accountId,balanceTransactionId:p.balanceTransactionId,chargeId:p.chargeId,grossCents,feeCents,netCents,currency:'usd',availableOn:p.availableOn,payoutId:p.payoutId??null,payoutStatus:p.payoutStatus??null,payoutAmountCents:p.payoutAmountCents??null,payoutArrivalAt:p.payoutArrivalAt??null,by:who(c),at:c.now})
 event(c,command,invoice.jobId,row.id,{grossCents,feeCents,netCents,payoutId:row.payoutId});return row
}
