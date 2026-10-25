import {clearance} from './tender-clearance'
import {event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State,type Row} from './model'
export const taxBasisCommands=['tax.creditBasis']
export function recognizedOriginalTender(s:State,p:Row){return p.method==='cash'||p.method==='stripe'&&p.verified===true||['check','other'].includes(p.method)&&!!clearance(s,p)}
/** This review attributes retained tender; it never creates cash, moves credit or files tax. */
export const taxCreditBasis:Handler=(c,command,p)=>{
 if(!taxBasisCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner reviews original cash basis.',null,403)
 const note=find(c.s,'creditNote',p.creditNoteId);expectVersion(note,p.version)
 const originalRefund=rows(c.s,'refund').find(r=>r.creditNoteId===note.id),redirect=originalRefund?.redirect
 if(note.destination!=='account-credit'&&redirect?.destination!=='account-credit')fail('TAX_BASIS','Review an issued account credit or its recorded refund redirection.')
 if(!Array.isArray(p.allocations)||!p.allocations.length||p.allocations.length>100)fail('INPUT','Identify the original tender amounts.',null,400)
 const allocations=p.allocations.map((a:any)=>({paymentId:text(a.paymentId,'original payment'),amountCents:integer(a.amountCents,'original tender USD cents',1)})).sort((a:any,b:any)=>a.paymentId.localeCompare(b.paymentId))
 if(redirect?.destination==='account-credit'&&(allocations.length!==1||allocations[0].paymentId!==originalRefund?.paymentId))fail('TAX_BASIS','A redirected refund retains its exact original tender source.')
 if(new Set(allocations.map((a:any)=>a.paymentId)).size!==allocations.length||allocations.reduce((n:number,a:any)=>n+a.amountCents,0)!==note.totals.totalCents)fail('TAX_BASIS','Original tender allocations must equal the exact issued credit, with each source listed once.')
 const legalBasis=text(p.legalBasis,'owner-reviewed jurisdiction treatment and legal basis',2000),evidence=text(p.evidence,'original receipt attribution evidence',2000),prior=rows(c.s,'taxCreditBasis').find(r=>r.creditNoteId===note.id)
 if(prior){if(JSON.stringify(prior.allocations)===JSON.stringify(allocations)&&prior.legalBasis===legalBasis&&prior.evidence===evidence)return prior;fail('TAX_BASIS_IMMUTABLE','Keep the original review; changed attribution requires a future correction workflow.')}
 for(const a of allocations){
  const payment=find(c.s,'payment',a.paymentId)
  if(payment.invoiceId!==note.invoiceId||payment.at>note.at||!recognizedOriginalTender(c.s,payment))fail('TAX_BASIS','Use an original cash receipt, captured processor receipt or owner-observed cleared check or other tender on the credited invoice; nested credit sources remain for review.')
  const reserved=rows(c.s,'taxCreditBasis').flatMap(r=>r.allocations).filter((r:any)=>r.paymentId===payment.id).reduce((n:number,r:any)=>n+r.amountCents,0)+rows(c.s,'refund').filter(r=>r.paymentId===payment.id&&r.creditNoteId!==note.id).reduce((n,r)=>n+r.amountCents,0)
  if(a.amountCents>payment.amountCents-reserved)fail('TAX_BASIS','This original tender is already attributed or reserved for a different refund.')
 }
 const invoice=find(c.s,'invoice',note.invoiceId),received=rows(c.s,'payment').filter(r=>r.invoiceId===invoice.id&&recognizedOriginalTender(c.s,r)).reduce((n,r)=>n+r.amountCents,0),total=invoice.totals.totalCents
 const collectedTax=total>0?Number((BigInt(invoice.totals.salesTaxCents)*BigInt(Math.min(total,received))*2n+BigInt(total))/(2n*BigInt(total))):0
 const priorTax=rows(c.s,'taxCreditBasis').filter(b=>b.invoiceId===invoice.id).reduce((n,b)=>n+find(c.s,'creditNote',b.creditNoteId).totals.salesTaxCents,0)+rows(c.s,'refund').filter(r=>r.invoiceId===invoice.id&&(r.redirect?.status??r.status)==='refunded'&&(!r.redirect||r.redirect.destination==='manual-tender')).reduce((n,r)=>n+find(c.s,'creditNote',r.creditNoteId).totals.salesTaxCents,0)
 if(note.totals.salesTaxCents>collectedTax-priorTax)fail('TAX_BASIS','The original invoice has insufficient recognized tax for this exact credit reversal; retain it for review.')
 const row=put(c.s,'taxCreditBasis' ,{creditNoteId:note.id,invoiceId:note.invoiceId,accountId:note.accountId,allocations,legalBasis,evidence,by:who(c),at:c.now,label:'Owner-reviewed original tender attribution; no new cash, bank verification, transfer or filing.'})
 event(c,command,note.jobId,row.id,{});return row
}
