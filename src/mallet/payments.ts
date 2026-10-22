import {event,expectVersion,fail,find,integer,put,rows,text,who,choice,type Handler,type State,type Row} from './model'
export const paymentCommands=['payment.record','payment.verified'] as const
export const publicInvoiceSnapshot=(invoice:Row)=>{const {billing,...snapshot}=invoice;return structuredClone(snapshot)}
export const invoiceBalance=(s:State,i:Row)=>{
 const payments=rows(s,'payment').filter(p=>p.invoiceId===i.id),credits=rows(s,'creditNote').filter(n=>n.invoiceId===i.id),refunds=rows(s,'refund').filter(r=>r.invoiceId===i.id)
 const creditedCents=credits.reduce((n,r)=>n+r.totals.totalCents,0),refundedCents=refunds.filter(r=>r.status==='refunded').reduce((n,r)=>n+r.amountCents,0),accountCreditCents=credits.filter(n=>n.destination==='account-credit').reduce((n,r)=>n+r.totals.totalCents,0),paidCents=payments.reduce((n,p)=>n+p.amountCents,0)-refundedCents-accountCreditCents
 return {totalCents:i.totals.totalCents,creditedCents,refundedCents,adjustedTotalCents:i.totals.totalCents-creditedCents,paidCents,outstandingCents:Math.max(0,i.totals.totalCents-creditedCents-paidCents),payments}
}
export const payments:Handler=(c,command,p)=>{
 if(!(paymentCommands as readonly string[]).includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only an owner or service advisor records tender.',null,403)
 const invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
 if(!['approved','exported'].includes(invoice.status))fail('PAYMENT_INVOICE','Approve the exact invoice before allocating tender.')
 if(command==='payment.verified'){
  const receipt=p.receipt,reference='stripe:'+text(receipt.paymentIntentId,'processor payment id',200),amountCents=integer(receipt.amountCents,'captured amount',1),prior=rows(c.s,'payment').find(x=>x.reference===reference)
  if(prior){if(prior.invoiceId===invoice.id&&prior.amountCents===amountCents)return prior;fail('PAYMENT_REPLAY','This processor receipt already belongs to a different payment allocation.')}
  if(amountCents>invoiceBalance(c.s,invoice).outstandingCents)fail('PAYMENT_AMOUNT','Do not apply a processor receipt beyond the invoice balance.')
  const row=put(c.s,'payment',{jobId:invoice.jobId,invoiceId:invoice.id,invoiceNumber:invoice.number,amountCents,method:'stripe',reference,verified:true,receipt,by:who(c),at:c.now});event(c,command,invoice.jobId,row.id,{amountCents,method:'stripe'});return row
 }
 const amountCents=integer(p.amountCents,'tender amount in USD cents',1),method=choice(p.method,['cash','check','other'],'manual tender'),reference=text(p.reference,'unique tender reference',200),evidence=text(p.evidence,'staff tender evidence',2000)
 const prior=rows(c.s,'payment').find(x=>x.reference===reference)
 if(prior){if(prior.invoiceId===invoice.id&&prior.amountCents===amountCents&&prior.method===method&&prior.evidence===evidence)return prior;fail('PAYMENT_REPLAY','This tender reference already has different allocation or evidence.')}
 if(amountCents>invoiceBalance(c.s,invoice).outstandingCents)fail('PAYMENT_AMOUNT','Do not allocate more than this invoice’s outstanding balance.')
 const row=put(c.s,'payment',{jobId:invoice.jobId,invoiceId:invoice.id,invoiceNumber:invoice.number,amountCents,method,reference,evidence,verified:false,label:'Staff-recorded tender; Mallet has not verified settlement.',by:who(c),at:c.now});event(c,command,invoice.jobId,row.id,{amountCents,method});return row
}
