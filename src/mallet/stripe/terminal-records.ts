import {bump,choice,event,fail,find,put,rows,text,who,type Handler} from '../model'
import {currentConnection} from './records'

export const terminalRecordCommands=['stripe.terminalClaim','stripe.terminalOutcome']
export const terminalRecords:Handler=(c,command,p)=>{
 if(!terminalRecordCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages reader collection.',null,403)
 const account=currentConnection(c.s,c.actor.id),checkout=find(c.s,'stripeCheckout',p.checkoutId),invoice=find(c.s,'invoice',checkout.invoiceId)
 if(p.connectionId!==account.id||checkout.accountId!==account.accountId||checkout.livemode!==account.livemode||checkout.method!=='card_present'||!checkout.paymentIntentId||checkout.invoiceRevision!==invoice.revision||checkout.invoiceTotalCents!==invoice.totals.totalCents)fail('STRIPE_SCOPE','The reader operation must match the current merchant account and exact invoice.')
 if(command==='stripe.terminalClaim'){
  const kind=choice(p.kind,['process','cancel_reader','cancel_intent'],'reader operation'),readerId=text(p.readerId,'reader id',200)
  const prior=rows(c.s,'stripeReaderAction').find(r=>r.checkoutId===checkout.id&&r.kind===kind)
  if(prior){if(prior.readerId!==readerId)fail('STRIPE_REPLAY','This operation already identifies a different reader.');return {action:prior,claimed:false}}
  const process=rows(c.s,'stripeReaderAction').find(r=>r.checkoutId===checkout.id&&r.kind==='process')
  if(kind==='process'){
   if(checkout.status!=='open'||rows(c.s,'stripeReaderAction').some(r=>r.checkoutId===checkout.id&&r.kind!=='process'))fail('STRIPE_TERMINAL','Only a prepared, uncanceled payment can be sent to a reader.')
   if(rows(c.s,'stripeReaderAction').some(r=>r.readerId===readerId&&r.accountId===account.accountId&&r.livemode===account.livemode&&r.kind==='process'&&['claiming','in_progress','uncertain'].includes(r.status)&&rows(c.s,'stripeCheckout').some(prior=>prior.id===r.checkoutId&&!['paid','expired','failed'].includes(prior.status))))fail('STRIPE_READER_BUSY','Reconcile or cancel the reader’s existing action first.')
  }else if(checkout.status==='paid'||process&&process.readerId!==readerId)fail('STRIPE_TERMINAL','A captured payment cannot be canceled, and cancellation must use its original reader.')
  const row=put(c.s,'stripeReaderAction',{jobId:checkout.jobId,invoiceId:invoice.id,checkoutId:checkout.id,connectionId:account.id,accountId:account.accountId,livemode:account.livemode,paymentIntentId:checkout.paymentIntentId,readerId,kind,status:'claiming',by:who(c),at:c.now})
  event(c,command,invoice.jobId,row.id,{kind,readerId});return {action:row,claimed:true}
 }
 const action=find(c.s,'stripeReaderAction',p.actionId)
 if(action.checkoutId!==checkout.id||action.accountId!==account.accountId||action.livemode!==account.livemode||action.paymentIntentId!==checkout.paymentIntentId)fail('STRIPE_SCOPE','The reader action belongs to a different collection.')
 if(action.status!=='claiming'&&!p.reconciled)return action
 const status=choice(p.status,['in_progress','succeeded','failed','uncertain','canceled','cleared'],'reader action result')
 const row=bump(c.s,'stripeReaderAction',action,{status,updatedAt:c.now})
 event(c,command,invoice.jobId,row.id,{kind:row.kind,status});return row
}
