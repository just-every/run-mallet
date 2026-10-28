import {actor,insist,same,whole} from './finance-values.mjs'
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const evidence=row=>actor(row.by,['owner'])&&typeof row.evidence==='string'&&row.evidence.trim().length>0&&row.evidence.length<=2000&&Number.isFinite(Date.parse(row.at))
export async function validateReceivables({get,each}){
 const account=async id=>{const seen=new Set();while(id){insist(!seen.has(id),'ar_account_cycle');seen.add(id);const row=await get('customerAccount',id);if(!row.mergedInto)return row.id;id=row.mergedInto}return null}
 for await(const terms of each('arTerms')){
  await get('customerAccount',terms.accountId)
  insist(evidence(terms)&&whole(terms.stateVersion)&&whole(terms.accountVersion,1)&&whole(terms.days,1,365)&&whole(terms.limitCents,1,1000000000)&&typeof terms.active==='boolean'&&terms.consent===true,'ar_terms')
 }
 for await(const assigned of each('arInvoice')){
  const invoice=await get('invoice',assigned.invoiceId),terms=await get('arTerms',assigned.terms?.id)
  insist(await account(assigned.accountId)===await account(invoice.billing?.accountId),'ar_invoice_account')
  insist(evidence(assigned)&&whole(assigned.stateVersion)&&same(assigned.terms,terms)&&terms.active&&terms.accountId===assigned.accountId&&assigned.invoiceRevision===invoice.revision&&assigned.invoiceTotalCents===invoice.totals.totalCents&&whole(assigned.reviewedOutstandingCents)&&assigned.reviewedOutstandingCents<=terms.limitCents&&date(assigned.dueOn)&&assigned.dueOn===new Date(Date.parse(assigned.at.slice(0,10))+terms.days*86400000).toISOString().slice(0,10),'ar_invoice')
  if(invoice.billing?.kind==='fleet')insist(assigned.authorizerId===invoice.billing.authorizer?.id&&typeof assigned.po==='string'&&assigned.po.trim(),'ar_fleet_authorizer')
 }
 for(const kind of ['arDispute','arPromise'])for await(const row of each(kind)){
  await get('invoice',row.invoiceId);await get('customerAccount',row.accountId)
  insist(evidence(row)&&whole(row.stateVersion),'ar_instruction')
  if(kind==='arDispute')insist(['open','resolved'].includes(row.status),'ar_dispute')
  else insist(date(row.promisedOn)&&row.promisedOn>=row.at.slice(0,10)&&whole(row.amountCents,1,1000000000),'ar_promise')
 }
 for await(const basis of each('taxCreditBasis')){
  const note=await get('creditNote',basis.creditNoteId)
  insist(evidence(basis)&&basis.invoiceId===note.invoiceId&&basis.accountId===note.accountId&&typeof basis.legalBasis==='string'&&basis.legalBasis.trim()&&Array.isArray(basis.allocations)&&basis.allocations.length>0&&basis.allocations.length<=100&&new Set(basis.allocations.map(a=>a.paymentId)).size===basis.allocations.length,'tax_credit_basis')
  let redirected=false
  for await(const refund of each('refund'))if(refund.creditNoteId===note.id&&refund.redirect?.destination==='account-credit'){redirected=true;insist(basis.allocations.length===1&&basis.allocations[0].paymentId===refund.paymentId,'tax_credit_redirect_source')}
  insist((note.destination==='account-credit'||redirected)&&basis.at>=note.at,'tax_credit_destination')
  let sum=0
  for(const a of basis.allocations){
   const payment=await get('payment',a.paymentId)
   let cleared=payment.method==='cash'||payment.method==='stripe'&&payment.verified===true
   if(['check','other'].includes(payment.method))for await(const clear of each('tenderClearance'))if(clear.sourceId===(payment.depositId??payment.id)&&clear.sourceKind===(payment.depositId?'deposit':'payment')&&clear.observedOn<=basis.at.slice(0,10))cleared=true
   insist(payment.invoiceId===note.invoiceId&&cleared&&payment.at<=note.at&&whole(a.amountCents,1)&&a.amountCents<=payment.amountCents,'tax_credit_source')
   let reserved=0
   for await(const other of each('taxCreditBasis'))for(const allocation of other.allocations??[])if(allocation.paymentId===payment.id)reserved+=allocation.amountCents
   for await(const refund of each('refund'))if(refund.paymentId===payment.id){let mapped=false;for await(const mappedBasis of each('taxCreditBasis'))if(mappedBasis.creditNoteId===refund.creditNoteId)mapped=true;if(!mapped)reserved+=refund.amountCents}
   insist(whole(reserved)&&reserved<=payment.amountCents,'tax_credit_source_capacity')
   sum+=a.amountCents
  }
  insist(sum===note.totals.totalCents,'tax_credit_sum')
 }
 for await(const reminder of each('arReminder')){
  const invoice=await get('invoice',reminder.invoiceId),assignment=await get('arInvoice',reminder.assignmentId),terms=await get('arTerms',reminder.termsId)
  insist(evidence(reminder)&&reminder.invoiceRevision===invoice.revision&&assignment.invoiceId===invoice.id&&assignment.accountId===reminder.accountId&&terms.accountId===reminder.accountId&&terms.by.id===reminder.by.id&&whole(reminder.outstandingCents,1)&&date(reminder.dueOn)&&reminder.dueOn===assignment.dueOn&&typeof reminder.to==='string'&&typeof reminder.content==='string'&&typeof reminder.consentEvidence==='string'&&reminder.consentEvidence.trim()&&typeof reminder.reference==='string'&&['unconfirmed','accepted','development','failed','uncertain'].includes(reminder.status),'ar_reminder')
 }
 for await(const resolution of each('balanceReminderResolution')){
  const schedule=await get('outreach',resolution.scheduleId),invoice=await get('invoice',resolution.invoiceId),assignment=await get('arInvoice',resolution.assignmentId),terms=await get('arTerms',resolution.termsId)
  insist(evidence(resolution)&&resolution.version===1&&whole(resolution.scheduleVersion,1)&&resolution.scheduleVersion<=schedule.version&&schedule.kind==='balance'&&['failed','uncertain'].includes(schedule.status),'balance_resolution')
  insist(schedule.subjectId===invoice.id&&schedule.invoiceVersion===resolution.invoiceVersion&&resolution.invoiceVersion<=invoice.version&&resolution.invoiceRevision===invoice.revision&&schedule.assignmentId===assignment.id&&schedule.termsId===terms.id&&assignment.invoiceId===invoice.id&&assignment.accountId===resolution.accountId&&terms.accountId===resolution.accountId&&resolution.jobId===invoice.jobId,'balance_resolution_sources')
  insist(same(resolution.originalOutcome,{status:schedule.status,provider:schedule.provider,claimedAt:schedule.claimedAt,outcomeAt:schedule.outcomeAt})&&resolution.at>=schedule.at,'balance_resolution_outcome')
 }
 for await(const receipt of each('handover')){
  const release=receipt.settlement?.accountTerms
  if(!release)continue
  const assignment=await get('arInvoice',release.assignment?.id),approval=await get('arTerms',release.currentApproval?.id),invoice=await get('invoice',receipt.invoiceId)
  insist(same(release.assignment,assignment)&&same(release.currentApproval,approval)&&approval.active&&approval.accountId===assignment.accountId&&release.accountId===assignment.accountId&&assignment.invoiceId===invoice.id&&assignment.invoiceRevision===invoice.revision&&assignment.invoiceTotalCents===invoice.totals.totalCents&&release.dueOn===assignment.dueOn&&whole(release.outstandingCents)&&release.outstandingCents<=invoice.totals.totalCents&&actor(receipt.by,['owner'])&&assignment.by.id===receipt.by.id&&approval.by.id===receipt.by.id&&release.label==='Released on account terms; balance due '+assignment.dueOn&&receipt.settlement.label===release.label,'ar_handover_snapshot')
 }
 for await(const row of each('tenderClearance')){
  insist(['payment','deposit'].includes(row.sourceKind),'clearance_source_kind')
  const source=await get(row.sourceKind,row.sourceId)
  insist(evidence(row)&&['check','other'].includes(source.method)&&!source.depositId&&date(row.observedOn)&&row.observedOn>=source.at.slice(0,10)&&row.observedOn<=row.at.slice(0,10),'tender_clearance')
 }
}
