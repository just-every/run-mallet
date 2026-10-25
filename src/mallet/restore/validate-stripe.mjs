import {insist,whole,actor} from './finance-values.mjs'
export async function validateStripe({get,each}){
 const eventIds=new Set(),operations=new Set()
 for await(const account of each('stripeConnection'))insist(whole(account.sequence,1)&&typeof account.accountId==='string'&&account.currency==='usd'&&typeof account.livemode==='boolean'&&actor(account.by,['owner']),'stripe_connection')
 for await(const checkout of each('stripeCheckout')){
  const invoice=await get('invoice',checkout.invoiceId),account=await get('stripeConnection',checkout.connectionId)
  insist(invoice.jobId===checkout.jobId&&invoice.revision===checkout.invoiceRevision&&invoice.totals.totalCents===checkout.invoiceTotalCents&&whole(checkout.amountCents,1)&&checkout.amountCents<=invoice.totals.totalCents&&checkout.accountId===account.accountId&&checkout.livemode===account.livemode&&['card','us_bank_account','card_present'].includes(checkout.method)&&['claiming','open','uncertain','processing','paid','expired','failed'].includes(checkout.status)&&actor(checkout.by,['owner']),'stripe_checkout')
  insist(typeof checkout.operationId==='string'&&!operations.has(checkout.operationId),'stripe_operation');operations.add(checkout.operationId)
 }
 const readerOperations=new Set()
 for await(const action of each('stripeReaderAction')){
  const checkout=await get('stripeCheckout',action.checkoutId),account=await get('stripeConnection',action.connectionId),key=action.checkoutId+':'+action.kind
  insist(checkout.method==='card_present'&&checkout.invoiceId===action.invoiceId&&checkout.jobId===action.jobId&&checkout.paymentIntentId===action.paymentIntentId&&account.accountId===action.accountId&&checkout.accountId===action.accountId&&checkout.livemode===action.livemode&&['process','cancel_reader','cancel_intent'].includes(action.kind)&&['claiming','in_progress','succeeded','failed','uncertain','canceled','cleared'].includes(action.status)&&typeof action.readerId==='string'&&actor(action.by,['owner'])&&!readerOperations.has(key),'stripe_reader_action');readerOperations.add(key)
 }
 for await(const event of each('stripeEvent')){
  const checkout=await get('stripeCheckout',event.checkoutId),key=event.accountId+':'+event.eventId
  insist(checkout.invoiceId===event.invoiceId&&checkout.jobId===event.jobId&&checkout.accountId===event.accountId&&typeof event.eventId==='string'&&!eventIds.has(key)&&actor(event.by,['owner']),'stripe_event');eventIds.add(key)
  if(event.paymentId){const payment=await get('payment',event.paymentId);insist(payment.invoiceId===event.invoiceId&&payment.receipt?.paymentIntentId===event.paymentIntentId&&event.status==='succeeded','stripe_event_payment')}
 }
 for await(const settlement of each('stripeSettlement')){
  const payment=await get('payment',settlement.paymentId)
  insist(settlement.invoiceId===payment.invoiceId&&settlement.jobId===payment.jobId&&settlement.currency==='usd'&&settlement.grossCents===payment.amountCents&&whole(settlement.feeCents)&&whole(settlement.netCents)&&settlement.grossCents-settlement.feeCents===settlement.netCents&&actor(settlement.by,['owner']),'stripe_settlement')
 }
}
