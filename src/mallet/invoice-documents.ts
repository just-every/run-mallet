import {createHash} from 'node:crypto'
import {event,expectVersion,fail,find,put,rows,text,who,type Handler,type Row,type State} from './model'
import {invoiceBalance} from './payments'
import {e,money} from './ui/common'

export const documentCommands=['invoice.issue','invoice.send','invoice.deliveryClaim','invoice.deliveryOutcome']
export const internalDocumentCommands=['invoice.deliveryClaim','invoice.deliveryOutcome']
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
const utf16=(value:string)=>'FEFF'+Array.from({length:value.length},(_,i)=>value.charCodeAt(i).toString(16).padStart(4,'0')).join('').toUpperCase()
// Standard PDF text has an exact Unicode ActualText companion for extraction.
export function invoicePdf(content:string):Uint8Array {
 const lines=content.split('\n').flatMap(line=>line.match(/.{1,86}/gu)??['']),pages=[]
 for(let i=0;i<lines.length;i+=48)pages.push(lines.slice(i,i+48))
 const objects:string[]=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
 const pageIds:number[]=[]
 for(const page of pages){
  const pageId=objects.length+1,streamId=pageId+1;pageIds.push(pageId)
  const stream='BT /F1 10 Tf 48 750 Td 14 TL\n'+page.map(line=>{
   const display=line.replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&')
   return '/Span << /ActualText <'+utf16(line+'\n')+'> >> BDC ('+display+') Tj EMC T*'
  }).join('\n')+'\nET\n'
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '+streamId+' 0 R >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream')
 }
 objects[1]='<< /Type /Pages /Count '+pageIds.length+' /Kids ['+pageIds.map(id=>id+' 0 R').join(' ')+'] >>'
 let pdf='%PDF-1.4\n',offsets=[0]
 objects.forEach((value,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+value+'\nendobj\n'})
 const offset=pdf.length;pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+offset+'\n%%EOF\n'
 return new TextEncoder().encode(pdf)
}
export function documentRecipient(s:State,invoice:Row):string {
 if(invoice.billing){
  const account=find(s,'customerAccount',invoice.billing.accountId)
  if(account.mergedInto||account.payerId!==invoice.billing.payer?.id)fail('INVOICE_PAYER','The issued billing identity changed. Review payer custody before sending.')
  if(rows(s,'arInvoice').some(r=>r.invoiceId===invoice.id)){
   if(account.billingContactId!==invoice.billing.billingContact?.id)fail('INVOICE_PAYER','Review the unchanged accounts contact before sending a term invoice.')
   const contact=find(s,'contact',account.billingContactId)
   if(contact.communication!=='email')fail('INVOICE_PAYER','Accounts must currently prefer email before a term invoice is sent.')
   return text(contact.email,'current accounts email',254)
  }
  return text(find(s,'contact',account.payerId).email,'current payer email',254)
 }
 return text(invoice.customer.customerEmail,'invoice email',254)
}
function issuedContent(d:any):string {
 const x=d.snapshot,b=x.balance
 return ['Mallet - USD invoice '+d.number,'Original invoice '+x.number+' - revision '+x.revision,'Issued '+d.at,
  ...(d.corrects?[`Corrects document ${d.correctsNumber}: ${d.reason}`]:[]),
  'Customer: '+x.customer.customerName,'Payer: '+(x.payerName||x.customer.customerName),
  'Vehicle or asset: '+x.customer.label,'Identifier: '+x.customer.identifier,'Repair: '+x.jobId,
  'Mileage and readings: '+(x.readings.map((r:any)=>r.stage+' '+r.value+' '+r.unit+' observed '+r.observedAt).join('; ')||'Not recorded'),'',
  ...x.lines.flatMap((l:any)=>[l.description+' ['+l.kind+']',l.quantity+' x '+money(l.unitCents)+' USD; unit discount '+money(l.unitDiscountCents??0)+'; subtotal '+money(l.subtotalCents),
   ...(l.exemption?['Owner-applied certificate '+l.exemption.reference+'; '+l.exemption.jurisdiction+'; scope '+l.exemption.scope+'; dates '+l.exemption.validFrom+' through '+l.exemption.expiresOn]:[]),
   ...(l.discountRule?['Discount rule '+l.discountRule.name+'; '+l.discountRule.basis+'; '+(l.discountRule.rateBps/100)+'% of remaining unit '+money(l.discountRule.unitBeforeDiscountCents)+'; added unit discount '+money(l.discountRule.addedUnitDiscountCents)]:[]),
   ...(l.suppliesFee?[(l.suppliesFee.category&&l.suppliesFee.category!=='supplies'?l.suppliesFee.category+' fee basis ':'Supplies basis ')+l.suppliesFee.basis+' '+money(l.suppliesFee.baseCents)+'; '+(l.suppliesFee.mode==='fixed'?'fixed '+money(l.suppliesFee.fixedCents):(l.suppliesFee.rateBps/100)+'%')+'; cap '+money(l.suppliesFee.capCents)+'; fee '+money(l.suppliesFee.amountCents)]:[]),
   'Sales tax '+money(l.salesTaxCents)+' ('+(l.taxable?String(l.taxRatePercent)+'%':'exempt')+'); line total '+money(l.totalCents)+' USD']),
  '', 'Subtotal '+money(x.totals.subtotalCents)+' USD','Sales tax '+money(x.totals.salesTaxCents)+' USD','Total '+money(x.totals.totalCents)+' USD',
  'Credits '+money(b.creditedCents)+'; tender net of refunds and account credit '+money(b.paidCents)+'; balance '+money(b.outstandingCents)+' USD',
  ...(x.accountTerms?['Commercial terms: net '+x.accountTerms.days+' days; balance due '+x.accountTerms.dueOn+'; PO '+(x.accountTerms.po??'not required')+'; approval '+x.accountTerms.assignmentId]:[]),
  'Recorded tender is an allocation; Mallet does not verify cleared funds.',
  ...x.payments.map((p:any)=>p.method+': '+money(p.amountCents)+' USD'+(p.method==='check'?'; check not cleared':'')),
  'Warranty terms: '+d.warrantyTerms,
  'Amounts and tax basis are frozen from authorized actual work. Financial corrections use separately issued credit notes; this copy never changes the ledger.',
  'PDF display uses the standard Latin font; Unicode text is retained in ActualText and the HTML and text copies.'
 ].join('\n')
}
export const invoiceDocuments:Handler=(c,command,p)=>{
 if(!documentCommands.includes(command)||command==='invoice.send')return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner issues or explicitly emails invoice documents.',null,403)
 if(command==='invoice.issue'){
  const invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
  if(!['approved','exported'].includes(invoice.status))fail('INVOICE_STATE','Approve the exact invoice first.')
  const reference=text(p.reference,'unique issue reference'),previous=rows(c.s,'invoiceDocument').find(d=>d.reference===reference)
  const warrantyTerms=text(p.warrantyTerms,'reviewed warranty terms',4000)
  const original=p.corrects?find(c.s,'invoiceDocument',p.corrects):null
  if(original&&original.invoiceId!==invoice.id)fail('INVOICE_CORRECTION','A correction must reference this invoice’s original document.')
  const reason=original?text(p.reason,'correction reason',2000):''
  if(previous){if(previous.invoiceId===invoice.id&&previous.warrantyTerms===warrantyTerms&&previous.corrects===(original?.id??null)&&previous.reason===reason)return previous;fail('INVOICE_REPLAY','That issue reference already identifies different content.')}
  if(p.confirm!=='issue-invoice')fail('INVOICE_CONFIRM','Explicitly confirm this exact issued document.')
  const documents=rows(c.s,'invoiceDocument').filter(d=>d.invoiceId===invoice.id).sort((a,b)=>a.sequence-b.sequence)
  if(documents.length&&!original)fail('INVOICE_CORRECTION','Retain the original and reference it for a corrected copy.')
  if(original&&original.id!==documents.at(-1)?.id)fail('INVOICE_CORRECTION','Correct the latest document to preserve the complete chain.')
  const corrected=new Set(rows(c.s,'reading').filter(r=>r.corrects).map(r=>r.corrects))
  const assigned=rows(c.s,'arInvoice').find(r=>r.invoiceId===invoice.id)
  const balance=invoiceBalance(c.s,invoice),snapshot={number:invoice.number,revision:invoice.revision,jobId:invoice.jobId,customer:structuredClone(invoice.customer),payerName:invoice.billing?.payer?.name??'',...(assigned?{accountTerms:{assignmentId:assigned.id,days:assigned.terms.days,dueOn:assigned.dueOn,po:assigned.po}}:{}),
   lines:invoice.lines.map((l:any)=>Object.fromEntries(['id','kind','description','quantity','unitCents','unitDiscountCents','subtotalCents','salesTaxCents','totalCents','taxable','taxRatePercent','taxRateMillionths','sourceEstimateId','sourceRevision','exemption','suppliesFee','discountRule'].filter(k=>l[k]!==undefined).map(k=>[k,l[k]]))),totals:structuredClone(invoice.totals),
   readings:rows(c.s,'reading').filter(r=>r.jobId===invoice.jobId&&!corrected.has(r.id)).map(r=>({stage:r.stage,unit:r.unit,value:r.value,observedAt:r.observedAt})),
   balance:{creditedCents:balance.creditedCents,paidCents:balance.paidCents,outstandingCents:balance.outstandingCents},payments:balance.payments.map(r=>({method:r.method,amountCents:r.amountCents}))}
  const data={sequence:documents.length+1,invoiceId:invoice.id,invoiceRevision:invoice.revision,jobId:invoice.jobId,number:invoice.number+'-D'+String(documents.length+1).padStart(3,'0'),reference,corrects:original?.id??null,correctsNumber:original?.number??null,reason,warrantyTerms,snapshot,by:who(c),at:c.now}
  const content=issuedContent(data),pdf=invoicePdf(content),pdfBase64=btoa(Array.from(pdf,x=>String.fromCharCode(x)).join(''))
  const row=put(c.s,'invoiceDocument',{...data,content,contentHash:hash(content),pdfBase64,pdfHash:createHash('sha256').update(pdf).digest('hex')})
  event(c,command,invoice.jobId,row.id,{number:row.number,corrects:row.corrects,contentHash:row.contentHash});return row
 }
 if(command==='invoice.deliveryClaim'){
  const doc=find(c.s,'invoiceDocument',p.documentId);expectVersion(doc,p.version)
  const assigned=rows(c.s,'arInvoice').find(r=>r.invoiceId===doc.invoiceId)
  if(assigned&&doc.snapshot.accountTerms?.assignmentId!==assigned.id)fail('INVOICE_TERMS','Issue a corrected exact copy with the current term assignment before sending.')
  if(rows(c.s,'invoiceDocument').some(d=>d.invoiceId===doc.invoiceId&&d.sequence>doc.sequence))fail('INVOICE_SUPERSEDED','Review and send the latest corrected copy.')
  if(doc.by.id!==c.actor.id)fail('INVOICE_AUTHORITY','Historical or restored issue authority cannot send. Issue a reviewed corrected copy under the current owner.')
  if(p.confirm!=='email-invoice'||p.consent!==true)fail('INVOICE_CONSENT','Explicitly confirm customer consent and email this exact copy.')
  if(rows(c.s,'invoiceDelivery').some(d=>d.documentId===doc.id))fail('INVOICE_DELIVERY','This document already has a delivery attempt. Review its outcome; no automatic retry is allowed.')
  const invoice=find(c.s,'invoice',doc.invoiceId),to=documentRecipient(c.s,invoice)
  if(p.to!==to)fail('INVOICE_PAYER','Review the exact current payer address before sending.')
  const row=put(c.s,'invoiceDelivery',{documentId:doc.id,invoiceId:invoice.id,jobId:invoice.jobId,to,contentHash:doc.contentHash,status:'unconfirmed',consentEvidence:text(p.consentEvidence,'explicit email consent evidence',2000),by:who(c),at:c.now})
  event(c,command,doc.jobId,row.id,{documentId:doc.id,status:row.status});return row
 }
 const delivery=find(c.s,'invoiceDelivery',p.deliveryId);expectVersion(delivery,p.version)
 if(delivery.status!=='unconfirmed')fail('INVOICE_DELIVERY','A recorded delivery outcome is immutable.')
 if(!['accepted','development','failed','uncertain'].includes(p.status))fail('INPUT','Unknown mail outcome.',null,400)
 const next={...delivery,version:delivery.version+1,status:p.status,provider:text(p.provider,'mail provider'),providerMessageId:p.providerMessageId??null,outcomeAt:c.now}
 rows(c.s,'invoiceDelivery')[rows(c.s,'invoiceDelivery').findIndex(x=>x.id===delivery.id)]=next
 event(c,command,delivery.jobId,delivery.id,{status:next.status});return next
}
export const documentHtml=(d:Row)=>'<article class="card print-sheet"><h2>'+e(d.number)+'</h2><pre class="invoice-copy">'+e(d.content)+'</pre><p class="invoice-hash">Content SHA-256 '+e(d.contentHash)+'</p></article>'
