import {terminalPanel} from './terminal-ui'
import {settlementSummary} from './settlement-ui'
import {box,e,field,hidden,money,rows,select,when} from '../ui/common'
import {invoiceBalance} from '../payments'
import {connection} from './records'
const action=(command:string,content:string,label:string,values:Record<string,unknown>={})=>`<form method="post" action="/app/stripe">${hidden('command',command)}${Object.entries(values).map(([k,v])=>hidden(k,v)).join('')}${content}<button>${e(label)}</button></form>`
export function stripeSettings(s:any,ownerId:string){
 const account=connection(s),current=account?.by.id===ownerId
 return box('Merchant Stripe account',`<p><a href="/app/connectors">Manage private Stripe key</a></p>${current?`<p>Connected ${e(account.accountId)} · ${account.livemode?'Live':'Test'} mode · USD settlement · checked ${when(account.at)}</p>`:'<p>Connect the merchant account before creating invoice checkout.</p>'}${action('connect','<label class="check"><input type="checkbox" name="consent" value="yes" required> I confirm this merchant account belongs to this workshop.</label>','Check and connect account')}<p>Only the owner starts checkout. Customers enter card or bank details on Stripe. Mallet never stores card numbers or bank credentials.</p>`)
}
export function stripeInvoice(s:any,invoice:any,ownerId:string){
 const account=connection(s),balance=invoiceBalance(s,invoice),checkouts=rows(s,'stripeCheckout').filter(r=>r.invoiceId===invoice.id)
 let body=`<p><a href="/app/invoices/${e(invoice.id)}">Issued invoice</a> · <a href="/app/stripe">Stripe settings</a></p>`
 body+=box(invoice.number,`<p>Invoice ${money(invoice.totals.totalCents)} · Outstanding ${money(balance.outstandingCents)} USD${balance.returnedCents?' · ACH principal returned '+money(balance.returnedCents):''}</p><p>Returning from Stripe never marks an invoice paid. The owner reconciles an authenticated provider event. Resolve an open checkout before recording other tender or invoice credits.</p>`)
 if(account?.by.id===ownerId&&balance.outstandingCents>0&&!checkouts.some(r=>['claiming','open','uncertain','processing'].includes(r.status)))body+=box('Collect outstanding balance',action('checkout',select('Hosted payment method','method',[['card','Card or supported wallet'],['us_bank_account','US bank account (ACH)']])+`<label class="check"><input type="checkbox" name="consent" value="yes" required> I reviewed ${money(balance.outstandingCents)} USD for this exact invoice and will open Stripe for the customer.</label>`,'Create hosted checkout',{invoiceId:invoice.id,version:invoice.version,operationId:crypto.randomUUID()}))
 else if(account?.by.id!==ownerId)body+=box('Connect Stripe','<p><a href="/app/stripe">Connect your merchant account</a> before collecting this invoice.</p>')
 for(const checkout of checkouts.filter(r=>r.method!=='card_present')){
  let content=`<p>${money(checkout.amountCents)} USD · ${e(checkout.method==='card'?'Card or wallet':'ACH')} · ${e(checkout.status)} · ${when(checkout.at)}</p>`
  if(checkout.status==='open')content+=`<p><a class="button" href="/app/stripe/checkout/${e(checkout.id)}">Open Stripe checkout</a></p>`+action('expire','','Expire hosted checkout',{invoiceId:invoice.id,checkoutId:checkout.id})
  if(['claiming','uncertain'].includes(checkout.status))content+='<p>Stripe handoff is uncertain. Inspect the merchant dashboard; this operation will not be sent again automatically.</p>'+action('session',field('Stripe hosted session ID','sessionId','text','','required maxlength="200"'),'Inspect existing session',{invoiceId:invoice.id,checkoutId:checkout.id})
  if(checkout.status==='failed')content+='<p>Stripe refused creation. Review the merchant configuration before explicitly creating a new checkout.</p>'
  content+=action('event',field('Stripe payment event ID','eventId','text','','required maxlength="200"'),'Reconcile provider event',{invoiceId:invoice.id})
  if(checkout.method==='us_bank_account')content+=action('return',field('Stripe ACH dispute event ID','eventId','text','','required maxlength="200"'),'Reconcile ACH return',{invoiceId:invoice.id})
  for(const observation of rows(s,'stripeReturn').filter(r=>r.checkoutId===checkout.id).sort((a,b)=>b.sequence-a.sequence))content+=`<p>ACH return observation ${when(observation.at)} · ${e(observation.status)} · ${e(observation.reason)} · Returned principal ${money(observation.returnedCents)} USD. Original captured payment and invoice are retained.</p>`
  if(checkout.status==='paid')content+=action('settlement',field('Automatic payout ID (optional)','payoutId','text','','maxlength="200"'),'Reconcile fee and payout',{invoiceId:invoice.id,checkoutId:checkout.id})
  for(const receipt of rows(s,'stripeEvent').filter(r=>r.checkoutId===checkout.id))content+=`<p>Event ${e(receipt.eventId)} · ${e(receipt.status)} · checked ${when(receipt.at)}</p>`
  content+=settlementSummary(s,invoice,checkout)
  body+=box('Hosted checkout',content)
 }
 return body+terminalPanel(s,invoice,ownerId)
}
