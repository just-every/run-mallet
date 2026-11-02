import {event,fail,find,integer,put,rows,text,who,type Handler,type State} from '../model'
import {currentConnection} from './records'
import {providerId} from './provider'

export const returnRecordCommands=['stripe.returnObserve']
export const achReturnEvents=['charge.dispute.created','charge.dispute.updated','charge.dispute.closed','charge.dispute.funds_withdrawn','charge.dispute.funds_reinstated']

/** Retain principal movements independently of processor fees and net settlement. */
export function returnTransactions(value:any,disputeId:string){
 if(!Array.isArray(value))fail('STRIPE_RETURN','Stripe did not supply the current dispute balance transactions.')
 const ids=new Set<string>()
 return value.map(bt=>{
  const id=providerId(bt?.id,'return balance transaction'),source=bt.source===null?null:providerId(typeof bt.source==='object'?bt.source?.id:bt.source,'return transaction source')
  if(ids.has(id)||source!==null&&source!==disputeId||bt.currency!=='usd')fail('STRIPE_RETURN','Return transactions must be unique USD movements for this dispute.')
  ids.add(id)
  const amount=integer(bt.amount,'return principal movement',Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER),fee=integer(bt.fee,'return processor fee',Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER),net=integer(bt.net,'return net movement',Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER)
  if(!Number.isSafeInteger(amount-fee)||amount-fee!==net)fail('STRIPE_RETURN','Return principal, processor fee and net do not reconcile.')
  return {id,source,type:text(bt.type,'return transaction type',100),currency:'usd',amount,fee,net,...(bt.created!==undefined?{created:integer(bt.created,'transaction creation time',0,Number.MAX_SAFE_INTEGER)}:{}),...(bt.available_on!==undefined?{available_on:integer(bt.available_on,'transaction availability time',0,Number.MAX_SAFE_INTEGER)}:{})}
 })
}
export function returnPrincipal(transactions:ReturnType<typeof returnTransactions>,disputedCents:number,paymentCents:number){
 let sum=0
 for(const bt of transactions){sum+=bt.amount;if(!Number.isSafeInteger(sum))fail('STRIPE_RETURN','Return principal movements exceed the supported exact amount.')}
 return Math.min(disputedCents,paymentCents,Math.max(0,-sum))
}
/** An older provider event can observe newer funds; retained observation order governs. */
export function returnedPrincipal(s:State,paymentId:string){
 const payment=rows(s,'payment').find(p=>p.id===paymentId)
 if(!payment)return 0
 const latest=new Map<string,any>()
 for(const row of rows(s,'stripeReturn').filter(r=>r.paymentId===paymentId)){
  const key=row.accountId+':'+row.disputeId,prior=latest.get(key)
  if(!prior||row.sequence>prior.sequence)latest.set(key,row)
 }
 return Math.min(payment.amountCents,[...latest.values()].reduce((n,r)=>n+r.returnedCents,0))
}
export const returnRecords:Handler=(c,command,p)=>{
 if(!returnRecordCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner reconciles ACH returns.',null,403)
 const account=currentConnection(c.s,c.actor.id),checkout=find(c.s,'stripeCheckout',p.checkoutId),payment=find(c.s,'payment',p.paymentId),invoice=find(c.s,'invoice',checkout.invoiceId)
 if(p.connectionId!==account.id||checkout.accountId!==account.accountId||checkout.livemode!==account.livemode||checkout.method!=='us_bank_account'||checkout.invoiceRevision!==invoice.revision||checkout.invoiceTotalCents!==invoice.totals.totalCents||payment.invoiceId!==invoice.id||payment.invoiceRevision!==checkout.invoiceRevision||payment.invoiceTotalCents!==checkout.invoiceTotalCents||payment.amountCents!==checkout.amountCents||payment.method!=='stripe'||payment.verified!==true||payment.receipt?.provider!=='stripe'||payment.receipt.paymentIntentId!==checkout.paymentIntentId||p.paymentIntentId!==checkout.paymentIntentId||payment.receipt.livemode!==account.livemode||payment.receipt.amountCents!==payment.amountCents||payment.receipt.currency!=='USD')fail('STRIPE_SCOPE','An ACH return must identify an existing verified payment for the exact invoice and merchant account.')
 const eventId=providerId(p.eventId,'return event'),disputeId=providerId(p.disputeId,'dispute'),chargeId=providerId(p.chargeId,'returned charge')
 if(payment.receipt.chargeId&&payment.receipt.chargeId!==chargeId)fail('STRIPE_SCOPE','The return must identify the originally allocated charge.')
 if(!achReturnEvents.includes(p.eventType))fail('STRIPE_EVENT','Choose an authenticated ACH dispute event.')
 const prior=rows(c.s,'stripeReturn').find(r=>r.accountId===account.accountId&&r.eventId===eventId)
 if(prior){if(prior.disputeId!==disputeId||prior.paymentId!==payment.id)fail('STRIPE_REPLAY','This event already identifies a different return.');return prior}
 const history=rows(c.s,'stripeReturn').filter(r=>r.accountId===account.accountId&&r.disputeId===disputeId)
 if(history.some(r=>r.paymentId!==payment.id||r.chargeId!==chargeId))fail('STRIPE_SCOPE','A dispute cannot change its original payment or charge.')
 const disputedCents=integer(p.disputedCents,'disputed principal',1,Number.MAX_SAFE_INTEGER),balanceTransactions=returnTransactions(p.balanceTransactions,disputeId)
 if(rows(c.s,'stripeReturn').some(r=>r.accountId===account.accountId&&r.disputeId!==disputeId&&r.balanceTransactions.some((bt:any)=>balanceTransactions.some(current=>current.id===bt.id))))fail('STRIPE_REPLAY','A balance transaction cannot belong to different disputes.')
 const returnedCents=returnPrincipal(balanceTransactions,disputedCents,payment.amountCents),sequence=Math.max(0,...rows(c.s,'stripeReturn').map(r=>r.sequence))+1
 const row=put(c.s,'stripeReturn',{jobId:invoice.jobId,invoiceId:invoice.id,invoiceRevision:checkout.invoiceRevision,invoiceTotalCents:checkout.invoiceTotalCents,checkoutId:checkout.id,paymentId:payment.id,paymentIntentId:checkout.paymentIntentId,connectionId:account.id,accountId:account.accountId,livemode:account.livemode,eventId,eventType:p.eventType,disputeId,chargeId,currency:'usd',disputedCents,returnedCents,balanceTransactions,status:text(p.status,'current dispute status',100),reason:text(p.reason,'current dispute reason',100),sequence,by:who(c),at:c.now})
 event(c,command,invoice.jobId,row.id,{eventId,disputeId,paymentId:payment.id,returnedCents});return row
}
