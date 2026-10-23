import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State,type Row} from './model'
import {instant} from './workshop'
import {credits} from './credits'
import {supplierCredits,recordSupplierCredit} from './supplier-credits'
export const coreCommands=['stock.coreOpen','stock.coreReturn','stock.coreShip','stock.coreCredit','stock.coreCorrect','stock.coreRefund']
export function coreReport(s:State,now=new Date().toISOString()):Row[]{
 return rows(s,'stockCore').map(core=>{
  const invoice=find(s,'invoice',core.invoiceId),line=invoice.lines.find((l:any)=>l.id===core.lineId),payments=rows(s,'payment').filter(r=>r.invoiceId===invoice.id),paidCents=payments.reduce((n,r)=>n+r.amountCents,0),credits=supplierCredits(s,'stockCore',core.id),supplierCreditCents=credits.reduce((n,r)=>n+r.amountCents,0),note=core.creditNoteId?find(s,'creditNote',core.creditNoteId):null
  const refunds=note?rows(s,'refund').filter(r=>r.creditNoteId===note.id):[]
  return {...core,invoiceNumber:invoice.number,depositSubtotalCents:line.subtotalCents,depositTaxCents:line.salesTaxCents,depositTotalCents:line.totalCents,depositRecorded:paidCents>=invoice.totals.totalCents,credits,supplierCreditCents,supplierExposureCents:core.expectedCreditCents-supplierCreditCents,customerCreditCents:note?.totals.totalCents??0,customerRefundCents:refunds.filter(r=>(r.redirect?.status??r.status)==='refunded').reduce((n,r)=>n+r.amountCents,0),customerDue:!core.returned&&core.customerDueAt<=new Date(Date.parse(now)+core.alertDays*864e5).toISOString(),creditExpiryAlert:supplierCreditCents<core.expectedCreditCents&&core.supplierDueAt<=new Date(Date.parse(now)+core.alertDays*864e5).toISOString()}
 })
}
export const cores:Handler=(c,command,p)=>{
 if(!coreCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only owner and admin operators manage cores.',null,403)
 if(command==='stock.coreOpen'){
  const invoice=find(c.s,'invoice',p.invoiceId);expectVersion(invoice,p.version)
  if(!['approved','exported'].includes(invoice.status))fail('CORE_INVOICE','Choose an approved immutable invoice.')
  const line=invoice.lines.find((l:any)=>l.id===p.lineId),use=find(c.s,'stockUse',p.stockUseId),lot=find(c.s,'stockLot',use.lotId)
  if(!line||line.kind!=='fee'||line.totalCents<=0||line.quantityMilli!==1000||use.jobId!==invoice.jobId)fail('CORE_SCOPE','Choose one separately customer-authorized core-deposit fee and an installed part from the same repair.')
  if(rows(c.s,'stockCore').some(r=>r.invoiceId===invoice.id&&r.lineId===line.id))fail('DUPLICATE','This core charge is already tracked.')
  const row=put(c.s,'stockCore',{jobId:invoice.jobId,invoiceId:invoice.id,lineId:line.id,stockUseId:use.id,lotId:lot.id,supplier:lot.supplier,deposit:structuredClone(line),customerDueAt:instant(p.customerDueAt,'customer core due date'),supplierDueAt:instant(p.supplierDueAt,'supplier credit expiry'),expectedCreditCents:integer(p.expectedCreditCents,'expected supplier credit cents',1,100_000_000),alertDays:integer(p.alertDays,'advance alert days',1,365),terms:text(p.terms,'configured core return rules',4000),returned:null,shipment:null,creditNoteId:null,by:who(c),at:c.now})
  event(c,command,row.jobId,row.id,{invoiceId:invoice.id,lineId:line.id});return row
 }
 if(['stock.coreCorrect','stock.coreRefund'].includes(command)&&c.actor.role!=='owner')fail('FORBIDDEN','Only the owner approves core credit notes and refund outcomes.',null,403)
 const core=find(c.s,'stockCore',p.coreId)
 if(command==='stock.coreRefund'){if(p.confirm!=='record-refund')fail('CORE_REVIEW','Explicitly confirm the observed original-tender refund outcome.');const refund=rows(c.s,'refund').find(r=>r.creditNoteId===core.creditNoteId);if(!refund)fail('CORE_STATE','Issue the core credit note first.');return credits(c,'refund.record',{...p,refundId:refund.id,version:p.refundVersion,confirm:'record-refund'})}
 if(command==='stock.coreCredit'){
  if(!core.shipment)fail('CORE_STATE','Retain the core shipment before supplier credit reconciliation.')
  return recordSupplierCredit(c,'stockCore',core,p)
 }
 if(command==='stock.coreCorrect'&&core.creditNoteId)return find(c.s,'creditNote',core.creditNoteId)
 expectVersion(core,p.version)
 const save=(change:any)=>{const next=bump(c.s,'stockCore',core,change);event(c,command,core.jobId,core.id,change);return next}
 if(command==='stock.coreReturn'){
  if(core.returned)fail('CORE_STATE','The original condition receipt is immutable.')
  return save({returned:{condition:text(p.condition,'returned core condition',2000),evidence:text(p.evidence,'customer return evidence',4000),by:who(c),at:c.now}})
 }
 if(command==='stock.coreShip'){
  if(!core.returned||core.shipment)fail('CORE_STATE','Receive the old core first and retain only one shipment.')
  return save({shipment:{carrier:text(p.carrier,'carrier'),tracking:text(p.tracking,'tracking reference'),evidence:text(p.evidence,'shipment evidence',4000),by:who(c),at:c.now}})
 }
 if(!core.returned)fail('CORE_STATE','Record the returned core condition before customer correction.')
 // Existing original-tender consent, owner approval, amount and tax fences apply.
 const invoice=find(c.s,'invoice',core.invoiceId),line=core.deposit,request={invoiceId:invoice.id,version:invoice.version,lines:[{lineId:line.id,sourceEstimateId:line.sourceEstimateId,sourceRevision:line.sourceRevision,quantity:1}],destination:'original-tender',paymentId:p.paymentId,reference:'core:'+core.id,reason:text(p.reason,'core correction reason',2000),consentEvidence:text(p.consentEvidence,'customer refund instruction',2000)}
 if(p.confirm!=='correct-core')fail('CORE_REVIEW','Explicitly approve the original core-deposit correction.')
 const review=credits(c,'credit.preview',request),note=credits(c,'credit.issue',{...request,review,confirm:'issue-credit'})
 save({creditNoteId:note.id});return note
}
