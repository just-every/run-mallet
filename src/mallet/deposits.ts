import {creditAccount} from './credits'
import {invoiceBalance} from './payments'
import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type Row,type State} from './model'
export const depositCommands=['deposit.record','deposit.allocate','deposit.refund']
export function depositBalance(s:State,d:Row){
 const allocatedCents=rows(s,'payment').filter(p=>p.depositId===d.id).reduce((n,p)=>n+p.amountCents,0),refundedCents=(d.refunds??[]).reduce((n:number,r:any)=>n+r.amountCents,0)
 return {receivedCents:d.amountCents,allocatedCents,refundedCents,unallocatedCents:d.amountCents-allocatedCents-refundedCents}
}
/** Deposits are recorded tender, never a claim of bank clearance or an outbound payment. */
export const deposits:Handler=(c,command,p)=>{
 if(!depositCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records, allocates or refunds deposits until delegated finance authority ships.',null,403)
 const reference=text(p.reference,'unique deposit operation reference'),evidence=text(p.evidence,'customer instruction and observed tender evidence',2000)
 if(command==='deposit.record'){
  const accountId=creditAccount(c.s,text(p.accountId,'customer account')),amountCents=integer(p.amountCents,'received USD cents',1),method=choice(p.method,['cash','check','other'],'recorded tender'),jobId=p.jobId?text(p.jobId,'repair'):null
  if(jobId){const job=find(c.s,'job',jobId),billing=rows(c.s,'customerBilling').find(b=>b.jobId===job.id);if(!['booked','working'].includes(job.status)||creditAccount(c.s,billing?.snapshot.accountId)!==accountId)fail('DEPOSIT_ACCOUNT','A pre-order deposit requires an open repair with the same explicitly recorded payer account.')}
  const request={accountId,jobId,amountCents,method,reference,evidence},prior=rows(c.s,'deposit').find(d=>d.reference===reference)
  if(prior){if(JSON.stringify(prior.request)===JSON.stringify(request))return {...prior,balance:depositBalance(c.s,prior)};fail('DEPOSIT_REPLAY','This reference already has different deposit facts.')}
  if(rows(c.s,'payment').some(r=>r.reference===reference))fail('DEPOSIT_REPLAY','This reference already records invoice tender.')
  const saved=put(c.s,'deposit',{...request,request,refunds:[],by:who(c),at:c.now,label:'Tender recorded by staff; Mallet did not verify funds'+(method==='check'?'; check not cleared':'')});event(c,command,jobId,saved.id,{amountCents});return {...saved,balance:depositBalance(c.s,saved)}
 }
 const deposit=find(c.s,'deposit',p.depositId),amountCents=integer(p.amountCents,'USD cents',1)
 if(command==='deposit.allocate'){
  const invoice=find(c.s,'invoice',p.invoiceId),prior=rows(c.s,'payment').find(r=>r.reference===reference)
  if(prior){if(prior.depositId===deposit.id&&prior.invoiceId===invoice.id&&prior.amountCents===amountCents&&prior.evidence===evidence)return prior;fail('DEPOSIT_REPLAY','This allocation reference has different instructions.')}
  expectVersion(invoice,p.version)
  if(p.confirm!=='allocate-deposit')fail('DEPOSIT_CONFIRM','Confirm the exact deposit allocation.')
  if(!['approved','exported'].includes(invoice.status)||creditAccount(c.s,invoice.billing?.accountId)!==creditAccount(c.s,deposit.accountId)||deposit.jobId&&deposit.jobId!==invoice.jobId)fail('DEPOSIT_ACCOUNT','Allocate only to an approved invoice for the same payer and any earmarked repair.')
  if(rows(c.s,'deposit').some(d=>d.reference===reference)||rows(c.s,'deposit').some(d=>d.refunds.some((r:any)=>r.reference===reference)))fail('DEPOSIT_REPLAY','This reference already records another deposit operation.')
  if(amountCents>depositBalance(c.s,deposit).unallocatedCents||amountCents>invoiceBalance(c.s,invoice).outstandingCents)fail('DEPOSIT_AMOUNT','The allocation exceeds available deposit or the destination balance.')
  const payment=put(c.s,'payment',{depositId:deposit.id,jobId:invoice.jobId,invoiceId:invoice.id,invoiceNumber:invoice.number,invoiceRevision:invoice.revision,invoiceTotalCents:invoice.totals.totalCents,amountCents,method:deposit.method,reference,evidence,verified:false,label:deposit.label,by:who(c),at:c.now});event(c,command,invoice.jobId,payment.id,{depositId:deposit.id,amountCents});return payment
 }
 const prior=rows(c.s,'deposit').flatMap(d=>d.refunds.map((r:any)=>({...r,depositId:d.id}))).find(r=>r.reference===reference)
 if(prior){if(prior.depositId===deposit.id&&prior.amountCents===amountCents&&prior.evidence===evidence)return prior;fail('DEPOSIT_REPLAY','This refund reference has different observed facts.')}
 expectVersion(deposit,p.version)
 if(p.confirm!=='record-deposit-refund')fail('DEPOSIT_CONFIRM','Confirm customer instructions and the observed original-tender refund; Mallet moves no money.')
 if(deposit.jobId&&!['canceled','lost'].includes(find(c.s,'job',deposit.jobId).status))fail('DEPOSIT_REPAIR','Cancel the earmarked repair before refunding its unused deposit.')
 if(amountCents>depositBalance(c.s,deposit).unallocatedCents)fail('DEPOSIT_AMOUNT','Refund only unallocated deposit; allocated tender follows the invoice credit and refund rules.')
 if(rows(c.s,'payment').some(r=>r.reference===reference)||rows(c.s,'deposit').some(d=>d.reference===reference))fail('DEPOSIT_REPLAY','This reference already records tender.')
 const refund={amountCents,method:deposit.method,reference,evidence,by:who(c),at:c.now,label:'Owner-recorded original-tender refund; Mallet did not move or verify money.'},saved=bump(c.s,'deposit',deposit,{refunds:[...deposit.refunds,refund]});event(c,command,deposit.jobId,deposit.id,refund);return {...saved,balance:depositBalance(c.s,saved)}
}
