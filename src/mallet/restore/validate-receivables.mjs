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
 for await(const row of each('tenderClearance')){
  insist(['payment','deposit'].includes(row.sourceKind),'clearance_source_kind')
  const source=await get(row.sourceKind,row.sourceId)
  insist(evidence(row)&&['check','other'].includes(source.method)&&!source.depositId&&date(row.observedOn)&&row.observedOn>=source.at.slice(0,10)&&row.observedOn<=row.at.slice(0,10),'tender_clearance')
 }
}
