import {creditAccount} from '../credits'
import {depositBalance} from '../deposits'
import {invoiceBalance} from '../payments'
import {fail} from '../model'
import {area,box,e,field,form,money,rows,select,when} from './common'

export function depositFormInput(input:any){
 if(!input.command.startsWith('deposit.'))return
 if(!/^\d+(?:\.\d{1,2})?$/.test(String(input.amountUsd??'')))fail('INPUT','Enter a positive USD amount with at most two decimal places.',null,400)
 input.amountCents=Math.round(Number(input.amountUsd)*100)
 if(!Number.isSafeInteger(input.amountCents)||input.amountCents<1)fail('INPUT','Enter a positive USD amount in whole cents.',null,400)
 if(input.command==='deposit.record'&&input.confirm!=='record-deposit')fail('DEPOSIT_CONFIRM','Confirm the customer instruction and observed tender before recording a deposit.')
 if(input.command==='deposit.allocate'){
  let source:any;try{source=JSON.parse(input.invoiceSource)}catch{fail('INPUT','Choose an invoice from the reviewed account.',null,400)}
  if(!source||typeof source.id!=='string'||!Number.isSafeInteger(source.version))fail('INPUT','Choose a current invoice from the reviewed account.',null,400)
  input.invoiceId=source.id;input.version=source.version
 }
}
const amount=(max?:number)=>field('Amount (USD)','amountUsd','number','','required min="0.01" step="0.01"'+(max===undefined?'':` max="${max/100}"`))
const instruction=()=>field('Unique operation reference','reference','text','','required maxlength="200"')+area('Customer instruction and observed tender evidence','evidence','','required maxlength="2000"')
const confirmation=(value:string,label:string)=>`<label><input type="checkbox" name="confirm" value="${value}" required> ${e(label)}</label>`

export function depositsPage(s:any,accountId:string){
 const accounts=rows(s,'customerAccount').filter(a=>!a.mergedInto),account=accounts.find(a=>a.id===accountId)
 let body='<p><a href="/app/accounts?manage=all">Customer accounts</a></p><p>Record received cash, checks or other manual tender before ordering parts, or retain it as unallocated customer credit. Mallet does not move money or verify funds. Checks are not cleared. Card deposits and ACH are not available here.</p>'
 body+='<form method="get" action="/app/deposits">'+select('Customer account','accountId',[['','Choose an account'],...accounts.map(a=>[a.id,a.name] as [string,string])],accountId)+'<button>Review deposits</button></form>'
 if(!account)return `<div class="narrow">${body}</div>`
 const sameAccount=(id:string)=>creditAccount(s,id)===account.id
 const jobs=rows(s,'job').filter(j=>['booked','working'].includes(j.status)&&rows(s,'customerBilling').some(b=>b.jobId===j.id&&sameAccount(b.snapshot.accountId)))
 const invoices=rows(s,'invoice').filter(i=>['approved','exported'].includes(i.status)&&sameAccount(i.billing?.accountId)&&invoiceBalance(s,i).outstandingCents>0)
 body+=box('Record a deposit for '+account.name,form('deposit.record',amount()+select('Tender','method',[['cash','Cash'],['check','Paper check — not cleared'],['other','Other manual tender']])+select('Repair restriction','jobId',[['','Unallocated credit for this account'],...jobs.map(j=>[j.id,j.asset.label+' · '+j.title] as [string,string])])+instruction()+confirmation('record-deposit','I checked the customer instruction and observed the received tender.'),'Record received deposit',{accountId:account.id}))
 for(const d of rows(s,'deposit').filter(d=>sameAccount(d.accountId))){
  const balance=depositBalance(s,d),job=d.jobId?rows(s,'job').find(j=>j.id===d.jobId):null
  let content=`<p>${e(d.reference)} · ${e(d.method)} · ${when(d.at)}<br>${e(d.label)}</p><p>${job?`Restricted to <a href="/app/jobs/${e(job.id)}">${e(job.asset.label)} · ${e(job.title)}</a>`:'Unallocated account credit; may be split across this account’s approved invoices.'}</p><p>Received ${money(balance.receivedCents)} · Allocated ${money(balance.allocatedCents)} · Refunded ${money(balance.refundedCents)} · Available ${money(balance.unallocatedCents)}</p><p>${e(d.evidence)}</p>`
  const destinations=invoices.filter(i=>!d.jobId||i.jobId===d.jobId)
  if(balance.unallocatedCents>0&&destinations.length)content+=form('deposit.allocate',select('Destination invoice','invoiceSource',destinations.map(i=>[JSON.stringify({id:i.id,version:i.version}),i.number+' · '+i.customer.label+' · balance '+money(invoiceBalance(s,i).outstandingCents)] as [string,string]))+amount(balance.unallocatedCents)+instruction()+confirmation('allocate-deposit','Apply this existing deposit once to the selected invoice; no new funds received.'),'Allocate existing deposit',{depositId:d.id,accountId:account.id})
  const allocations=rows(s,'payment').filter(p=>p.depositId===d.id)
  content+='<ul>'+allocations.map(p=>`<li><a href="/app/jobs/${e(p.jobId)}">${e(p.invoiceNumber)}</a> · ${money(p.amountCents)} · ${e(p.reference)} · ${when(p.at)}</li>`).join('')+'</ul>'
  if(balance.unallocatedCents>0&&(!job||['canceled','lost'].includes(job.status)))content+=form('deposit.refund',amount(balance.unallocatedCents)+instruction()+confirmation('record-deposit-refund','The customer instructed this original-tender refund and I observed it outside Mallet.'),'Record original-tender refund',{depositId:d.id,version:d.version,accountId:account.id})
  else if(balance.unallocatedCents>0&&job)content+='<p>Cancel the restricted repair before recording an unused-deposit refund. Allocated tender follows the invoice credit and refund rules.</p>'
  content+='<ul>'+d.refunds.map((r:any)=>`<li>${money(r.amountCents)} · ${e(r.method)} · ${e(r.reference)} · ${e(r.label)} · ${e(r.evidence)} · ${when(r.at)}</li>`).join('')+'</ul>'
  body+=box('Deposit history',content,{id:'deposit-'+d.id})
 }
 return `<div class="narrow">${body}</div>`
}
