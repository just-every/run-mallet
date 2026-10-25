import {insist,whole,actor} from './finance-values.mjs'
export async function validateStripe({get,each}){
 const eventIds=new Set(),operations=new Set()
 for await(const account of each('stripeConnection'))insist(typeof account.accountId==='string'&&account.currency==='usd'&&typeof account.livemode==='boolean'&&actor(account.by,['owner']),'stripe_connection')
 for await(const checkout of each('stripeCheckout')){
  const invoice=await get('invoice',checkout.invoiceId),account=await get('stripeConnection',checkout.connectionId)
  insist(invoice.jobId===checkout.jobId&&invoice.revision===checkout.invoiceRevision&&invoice.totals.totalCents===checkout.invoiceTotalCents&&whole(checkout.amountCents,1)&&checkout.amountCents<=invoice.totals.totalCents&&checkout.accountId===account.accountId&&checkout.livemode===account.livemode&&['card','us_bank_account'].includes(checkout.method)&&['claiming','open','uncertain','processing','paid','expired'].includes(checkout.status)&&actor(checkout.by,['owner']),'stripe_checkout')
  insist(typeof checkout.operationId==='string'&&!operations.has(checkout.operationId),'stripe_operation');operations.add(checkout.operationId)
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
