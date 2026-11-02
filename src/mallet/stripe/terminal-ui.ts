import {settlementSummary} from './settlement-ui'
import {box,e,field,hidden,money,rows,when} from '../ui/common'
import {invoiceBalance} from '../payments'
import {connection} from './records'
const action=(command:string,content:string,label:string,values:Record<string,unknown>)=>`<form method="post" action="/app/stripe">${hidden('command',command)}${Object.entries(values).map(([k,v])=>hidden(k,v)).join('')}${content}<button>${e(label)}</button></form>`
export function terminalPanel(s:any,invoice:any,ownerId:string){
 const account=connection(s)
 if(account?.by.id!==ownerId)return ''
 const checkouts=rows(s,'stripeCheckout').filter(r=>r.invoiceId===invoice.id&&r.method==='card_present'),outstanding=invoiceBalance(s,invoice).outstandingCents
 let body=''
 if(outstanding>0&&!rows(s,'stripeCheckout').some(r=>r.invoiceId===invoice.id&&['claiming','open','uncertain','processing'].includes(r.status)))body+=action('terminal-prepare',`<label class="check"><input type="checkbox" name="consent" value="yes" required> I reviewed ${money(outstanding)} USD for this exact invoice.</label>`,'Prepare reader payment',{invoiceId:invoice.id,version:invoice.version,operationId:crypto.randomUUID()})
 for(const checkout of checkouts){
  const actions=rows(s,'stripeReaderAction').filter(r=>r.checkoutId===checkout.id),process=actions.find(r=>r.kind==='process'),values={invoiceId:invoice.id,checkoutId:checkout.id}
  body+=`<p>${money(checkout.amountCents)} USD · ${e(checkout.status)} · ${when(checkout.at)}</p>`
  if(checkout.status==='open'&&!process&&!actions.length)body+=action('terminal-send',field('Merchant reader ID','readerId','text','','required maxlength="200"'),'Send to reader',values)
  for(const record of actions)body+=`<p>${e(record.kind==='process'?'Reader collection':record.kind==='cancel_reader'?'Reader cancellation':'Payment cancellation')} · ${e(record.readerId)} · ${e(record.status)}</p>`
  if(['claiming','uncertain'].includes(checkout.status)||actions.some(r=>['claiming','uncertain'].includes(r.status)))body+='<p>The provider result is uncertain. Inspect the existing payment; this operation will not be sent again.</p>'
  body+=action('terminal-reconcile',checkout.paymentIntentId?'':field('Existing Stripe payment intent ID','paymentIntentId','text','','required maxlength="200"'),'Inspect reader payment',values)
  if(checkout.paymentIntentId&&!['paid','expired'].includes(checkout.status))body+=`<details><summary>Cancel reader payment</summary>${action('terminal-cancel',process?'':field('Merchant reader ID','readerId','text','','required maxlength="200"'),'Cancel uncaptured payment',values)}</details>`
  if(checkout.status==='paid')body+=action('settlement',field('Automatic payout ID (optional)','payoutId','text','','maxlength="200"'),'Reconcile fee and payout',values)+settlementSummary(s,invoice,checkout)
  body+=action('event',field('Stripe payment event ID','eventId','text','','required maxlength="200"'),'Reconcile provider event',{invoiceId:invoice.id})
 }
 return body?box('Card reader payment',`<p>Use the merchant’s WisePOS E, S700 or S710. The reader collects the card details. A reader acknowledgment does not mark this invoice paid; reconcile the authenticated Stripe payment event.</p>${body}`):''
}
