import {clearance} from './tender-clearance'
import {utcDate} from './receivables'
import {fail,find,rows,type State,type Row} from './model'
const portion=(tax:number,paid:number,total:number)=>total>0?Number((BigInt(tax)*BigInt(Math.min(total,paid))*2n+BigInt(total))/(2n*BigInt(total))):0
/** A period preview from retained receipts, with unresolved transfers excluded explicitly. */
export function filingTax(s:State,fromValue:unknown,toValue:unknown){
 const from=utcDate(fromValue),to=utcDate(toValue);if(to<from)fail('INPUT','Period end must follow period start.',null,400)
 const events:any[]=[],excluded:any[]=[],invoices=rows(s,'invoice').filter(i=>['approved','exported'].includes(i.status))
 for(const invoice of invoices){
  const jurisdiction=rows(s,'taxJurisdiction').find(r=>r.invoiceId===invoice.id)?.jurisdiction??'Unassigned - not filing ready'
  const payments=rows(s,'payment').filter(p=>p.invoiceId===invoice.id).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id))
  const recognized: {payment:Row;date:string}[]=[]
  for(const p of payments){
   if(p.creditNoteId){const basis=rows(s,'taxCreditBasis').find(r=>r.creditNoteId===p.creditNoteId&&r.at.slice(0,10)<=to);if(basis){recognized.push({payment:p,date:[p.at.slice(0,10),basis.at.slice(0,10)].sort().at(-1)!});continue}excluded.push({date:p.at.slice(0,10),invoiceId:invoice.id,paymentId:p.id,amountCents:p.amountCents,reason:'Customer-credit transfer: original cash basis requires review; no new cash recognized.'});continue}
   const clear=clearance(s,p),eligible=p.method==='cash'||p.method==='stripe'&&p.verified===true||['check','other'].includes(p.method)&&!!clear
   if(!eligible){excluded.push({date:p.at.slice(0,10),invoiceId:invoice.id,paymentId:p.id,amountCents:p.amountCents,reason:'Uncleared '+p.method+' tender.'});continue}
   // Deposit allocations recognize the invoice basis only when allocated; receipt time remains disclosed.
   const date=[p.at.slice(0,10),clear?.observedOn??''].sort().at(-1)!
   recognized.push({payment:p,date})
  }
  recognized.sort((a,b)=>a.date.localeCompare(b.date)||a.payment.at.localeCompare(b.payment.at)||a.payment.id.localeCompare(b.payment.id))
  let paid=0
  for(const {payment:p,date} of recognized){
   const taxCents=portion(invoice.totals.salesTaxCents,paid+p.amountCents,invoice.totals.totalCents)-portion(invoice.totals.salesTaxCents,paid,invoice.totals.totalCents);paid+=p.amountCents
   const source=p.depositId?find(s,'deposit',p.depositId):p,basis=p.creditNoteId?rows(s,'taxCreditBasis').find(b=>b.creditNoteId===p.creditNoteId):null
   const originalReceipts=basis?basis.allocations.map((a:any)=>{const payment=find(s,'payment',a.paymentId),receipt=payment.depositId?find(s,'deposit',payment.depositId):payment;return {sourceId:receipt.id,paymentId:payment.id,reference:receipt.reference,receiptOn:receipt.at.slice(0,10),amountCents:a.amountCents}}):[]
   events.push({kind:p.creditNoteId?'credit-application':'collection',newCash:p.creditNoteId?false:true,creditNoteId:p.creditNoteId??null,invoiceId:invoice.id,number:invoice.number,jurisdiction,date,paymentId:p.id,sourceId:source.id,basisId:basis?.id??null,originalReceipts,receiptOn:p.creditNoteId?null:source.at.slice(0,10),allocatedOn:p.at.slice(0,10),clearanceId:clearance(s,p)?.id??null,amountCents:p.amountCents,taxCents})
  }
  let reversed=0
  for(const r of rows(s,'refund').filter(r=>r.invoiceId===invoice.id).sort((a,b)=>String(a.history.find((o:any)=>o.status==='refunded')?.at??a.at).localeCompare(String(b.history.find((o:any)=>o.status==='refunded')?.at??b.at))||a.id.localeCompare(b.id))){
   if(r.redirect&&r.redirect.destination!=='manual-tender'){if(rows(s,'taxCreditBasis').some(b=>b.creditNoteId===r.creditNoteId&&b.at.slice(0,10)<=to))continue;excluded.push({date:(r.redirect?.at??r.at).slice(0,10),invoiceId:invoice.id,refundId:r.id,amountCents:r.amountCents,reason:'Redirected refund: original cash basis requires review; no automatic reversal.'});continue}
   if((r.redirect?.status??r.status)!=='refunded'||!recognized.some(p=>p.payment.id===r.paymentId)){excluded.push({date:(r.redirect?.at??r.at).slice(0,10),invoiceId:invoice.id,refundId:r.id,amountCents:r.amountCents,reason:'Refund is incomplete or original tender is excluded.'});continue}
   const outcome=r.history.find((o:any)=>o.status==='refunded'),note=find(s,'creditNote',r.creditNoteId)
   if(!outcome){excluded.push({date:(r.redirect?.at??r.at).slice(0,10),invoiceId:invoice.id,refundId:r.id,reason:'Missing completed refund date.'});continue}
   const receivedBeforeRefund=recognized.filter(p=>p.payment.at<=outcome.at&&p.date<=outcome.at.slice(0,10)).reduce((n,p)=>n+p.payment.amountCents,0)
   const reviewedCreditTax=rows(s,'taxCreditBasis').filter(b=>b.invoiceId===invoice.id&&b.at<=outcome.at).reduce((n,b)=>n+find(s,'creditNote',b.creditNoteId).totals.salesTaxCents,0)
   const taxCents=Math.min(note.totals.salesTaxCents,Math.max(0,portion(invoice.totals.salesTaxCents,receivedBeforeRefund,invoice.totals.totalCents)-reversed-reviewedCreditTax));reversed+=taxCents
   if(taxCents!==note.totals.salesTaxCents)excluded.push({date:(r.redirect?.at??r.at).slice(0,10),invoiceId:invoice.id,refundId:r.id,amountCents:r.amountCents,reason:'Refund tax exceeds recognized collection at its recorded completion time; review required.'})
   events.push({kind:'refund',invoiceId:invoice.id,number:invoice.number,jurisdiction,date:outcome.at.slice(0,10),refundId:r.id,creditNoteId:note.id,amountCents:-r.amountCents,taxCents:-taxCents})
  }
  for(const n of rows(s,'creditNote').filter(n=>n.invoiceId===invoice.id&&(n.destination==='account-credit'||rows(s,'refund').some(r=>r.creditNoteId===n.id&&r.redirect?.destination==='account-credit')))){
   const basis=rows(s,'taxCreditBasis').find(r=>r.creditNoteId===n.id&&r.at.slice(0,10)<=to)
   if(basis)events.push({kind:'credit-reversal',newCash:false,invoiceId:invoice.id,number:invoice.number,jurisdiction,date:basis.at.slice(0,10),creditNoteId:n.id,amountCents:0,taxCents:-n.totals.salesTaxCents,basisId:basis.id})
   else excluded.push({date:n.at.slice(0,10),invoiceId:invoice.id,creditNoteId:n.id,amountCents:n.totals.totalCents,reason:'Issued account credit: tax reattribution requires review.'})
  }
 }
 const periodExclusions=excluded.filter(e=>e.date<=to)
 const selected=events.filter(e=>e.date>=from&&e.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.invoiceId.localeCompare(b.invoiceId)),groups=[...new Set(selected.map(e=>e.jurisdiction))].sort().map(jurisdiction=>{const values=selected.filter(e=>e.jurisdiction===jurisdiction);return {jurisdiction,collectedTaxCents:values.filter(e=>e.kind==='collection').reduce((n,e)=>n+e.taxCents,0),refundTaxCents:Math.abs(values.filter(e=>e.kind==='refund').reduce((n,e)=>n+e.taxCents,0)),creditAdjustmentTaxCents:values.filter(e=>['credit-application','credit-reversal'].includes(e.kind)).reduce((n,e)=>n+e.taxCents,0),netTaxCents:values.reduce((n,e)=>n+e.taxCents,0)}})
 const within=(at:string)=>at?.slice(0,10)>=from&&at.slice(0,10)<=to
 const invoicedTaxCents=invoices.filter(i=>within(i.approval?.at)).reduce((n,i)=>n+i.totals.salesTaxCents,0),creditedTaxCents=rows(s,'creditNote').filter(n=>within(n.at)).reduce((sum,n)=>sum+n.totals.salesTaxCents,0)
 return {from,to,currency:'USD',invoiceBasis:{invoicedTaxCents,creditedTaxCents,netTaxCents:invoicedTaxCents-creditedTaxCents},basis:'Inclusive UTC event dates. Deposit cash is attributed when allocated to the invoice, never again as new received cash. Check and other tender require owner-recorded observed bank clearance; recognition is the later allocation or clearance date. Half-up cumulative invoice proportions allocate exact cents across receipts. Owner-reviewed original-tender credits reverse their original tax on review and recognize the destination invoice tax when applied or later reviewed; these are credit adjustments, never new cash. Nested or unattributed credit remains excluded for review. Completed owner-recorded redirected manual refunds reverse the original tax; uncertain outcomes do not. Unresolved earlier records remain visible, excluding records after the selected period end. The owner records the legal basis. Mallet gives no tax advice and files nothing. US sales-tax rules by state remain outside this preview.',groups,events:selected,excluded:periodExclusions,reviewRequired:periodExclusions.length>0||selected.some(e=>e.jurisdiction.startsWith('Unassigned'))}
}
