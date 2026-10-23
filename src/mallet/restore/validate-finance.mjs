import { createHash } from 'node:crypto'
import { canonicalJson } from '@runeditrun/rer/modules/portability'
import { insist, whole, same, actor, parsed, priced, sumLines, approved } from './finance-values.mjs'
import { validateTender } from './validate-tender.mjs'

/** Money uses the retained tax/rate/decision snapshots, never current settings.
 * Exact integer arithmetic mirrors money.ts; no archive rows are rewritten. */
export async function validateFinance({db,table}){
 const records=table('mallet_records');if(!records)return
 const get=async(kind,id)=>{
  const row=await db.prepare(`SELECT value FROM ${records} WHERE kind=? AND id=?`).bind(kind,id).first()
  insist(row,'reference_'+kind);return parsed(row.value)
 }
 async function* each(kind,field,id){
  let after=''
  for(;;){const row=await db.prepare(`SELECT id,value FROM ${records} WHERE kind=? AND id>?${field?` AND json_extract(value,'$.${field}')=?`:''} ORDER BY id LIMIT 1`).bind(kind,after,...(field?[id]:[])).first();if(!row)break;after=row.id;yield parsed(row.value)}
 }
 const revision=(estimate,n)=>{const rev=estimate.revisions.find(r=>r.n===n);insist(rev,'revision');return rev}
 const context={db,records,get,each,revision}
 const capacity=async(estimate,rev,line)=>{
  const row=await db.prepare(`SELECT COALESCE(SUM(json_extract(candidate.value,'$.replaces.quantityMilli')),0) AS replaced FROM ${records} other,json_each(other.value,'$.revisions[#-1].lines') candidate WHERE other.kind='estimate' AND other.id<>? AND json_extract(other.value,'$.jobId')=? AND json_extract(other.value,'$.authorisation.revision')=json_extract(other.value,'$.revisions[#-1].n') AND EXISTS(SELECT 1 FROM json_each(other.value,'$.authorisation.lineIds') chosen WHERE chosen.value=json_extract(candidate.value,'$.id')) AND json_extract(candidate.value,'$.replaces.estimateId')=? AND json_extract(candidate.value,'$.replaces.revision')=? AND json_extract(candidate.value,'$.replaces.lineId')=?`).bind(estimate.id,estimate.jobId,estimate.id,rev.n,line.id).first()
  insist(whole(row.replaced),'replacement_quantity');return line.quantityMilli-row.replaced
 }
 const approvalRow=async(kind,subject,revision,by)=>{
  const found=await db.prepare(`SELECT 1 FROM ${records} WHERE kind='approval' AND json_extract(value,'$.subjectKind')=? AND json_extract(value,'$.subjectId')=? AND json_extract(value,'$.revision')=? AND json_extract(value,'$.subjectVersion')<=? AND json_extract(value,'$.approvedBy.id')=? AND json_extract(value,'$.approvedBy.role')=? AND json_extract(value,'$.decision')='approved' LIMIT 1`).bind(kind,subject.id,revision,subject.version,by.id,by.role).first()
  insist(found,'approval_record')
 }
 for await(const estimate of each('estimate')){
  for(const [i,rev]of estimate.revisions.entries()){
   insist(rev.n===i+1&&rev.lines.length<=100,'revision_sequence');priced(rev.lines,rev.totals)
   insist(new Set(rev.lines.map(l=>l.id)).size===rev.lines.length,'duplicate_line')
   if(rev.approval){approved(rev);await approvalRow('estimate',estimate,rev.n,rev.approval.by)}
  }
  const owningJob=await get('job',estimate.jobId)
  insist(estimate.supplementOf?estimate.supplementOf===owningJob.estimateId:estimate.id===owningJob.estimateId,'estimate_root')
  const consent=estimate.authorisation
  if(consent){
   const rev=revision(estimate,consent.revision);approved(rev)
   insist(Array.isArray(consent.lineIds)&&new Set(consent.lineIds).size===consent.lineIds.length,'consent_lines')
   const selected=rev.lines.filter(l=>consent.lineIds.includes(l.id))
   insist(selected.length===consent.lineIds.length&&same(sumLines(selected),consent.totals),'consent_totals')
   for(const line of selected){
    const used=owningJob.actuals.filter(a=>a.estimateId===estimate.id&&a.revision===rev.n&&a.lineId===line.id).reduce((n,a)=>n+a.quantityMilli,0)
    const reserved=await db.prepare(`SELECT COALESCE(SUM(json_extract(scope.value,'$.charge.quantityMilli')),0) AS amount FROM ${records} r,json_each(r.value,'$.scopes') scope WHERE r.kind='sublet' AND json_extract(r.value,'$.jobId')=? AND json_extract(scope.value,'$.estimateId')=? AND json_extract(scope.value,'$.revision')=? AND json_extract(scope.value,'$.lineId')=?`).bind(estimate.jobId,estimate.id,rev.n,line.id).first()
    insist(whole(used)&&whole(reserved.amount)&&Math.max(used,reserved.amount)<=await capacity(estimate,rev,line),'replacement_cap')
   }
   insist(estimate.sent.some(s=>s.revision===rev.n),'decision_shared')
   insist(['signed','email reply','phone','in person','other','signed link'].includes(consent.method),'decision_method')
   insist(typeof consent.customerName==='string'&&consent.customerName.trim()&&typeof consent.evidence==='string'&&consent.evidence.trim()&&actor(consent.recordedBy,['owner','admin','customer']),'consent_evidence')
  }
  for(const rev of estimate.revisions)for(const line of rev.lines)if(line.replaces){
   const ref=line.replaces,source=await get('estimate',ref.estimateId),target=revision(source,ref.revision),old=target.lines.find(l=>l.id===ref.lineId)
   insist(source.id!==estimate.id&&source.jobId===estimate.jobId&&old&&source.authorisation?.revision===target.n&&source.authorisation.lineIds.includes(old.id)&&old.kind===line.kind&&whole(ref.quantityMilli,1)&&ref.quantityMilli===line.quantityMilli,'replacement_scope')
  }
  if(estimate.supplementOf){const root=await get('estimate',estimate.supplementOf);insist(root.jobId===estimate.jobId&&!root.supplementOf&&whole(estimate.sequence,1),'supplement_root')}
 }
 for await(const job of each('job')){
  const actuals=job.actuals,ids=new Set()
  for(const actual of actuals){
   insist(typeof actual.id==='string'&&!ids.has(actual.id)&&whole(actual.quantityMilli,1)&&actual.quantity===actual.quantityMilli/1000,'actual_quantity');ids.add(actual.id)
   const estimate=await get('estimate',actual.estimateId),rev=revision(estimate,actual.revision),line=rev.lines.find(l=>l.id===actual.lineId)
   insist(line&&estimate.jobId===job.id&&(estimate.id===job.estimateId||estimate.supplementOf===job.estimateId)&&estimate.authorisation?.revision===rev.n&&estimate.authorisation.lineIds.includes(line.id),'actual_decision')
   approved(rev)

  }
 }
 for await(const invoice of each('invoice')){
  priced(invoice.lines,invoice.totals)
  const job=await get('job',invoice.jobId),root=await get('estimate',invoice.estimateId)
  insist(root.jobId===job.id&&root.id===job.estimateId&&whole(invoice.revision,1),'invoice_root')
  const original=revision(root,invoice.estimateRevision)
  insist(same(invoice.estimateApproval,original.approval)&&same(invoice.customerAuthorisation,root.authorisation),'invoice_root_decision')
  insist(Array.isArray(invoice.actuals)&&same(invoice.actuals,job.actuals),'invoice_actuals')
  const tuples=new Set()
  for(const line of invoice.lines){
   const estimate=await get('estimate',line.sourceEstimateId??invoice.estimateId),rev=revision(estimate,line.sourceRevision??invoice.estimateRevision),source=rev.lines.find(l=>l.id===line.id)
   insist(source&&estimate.jobId===job.id&&estimate.authorisation?.revision===rev.n&&estimate.authorisation.lineIds.includes(line.id),'invoice_line_source')
   const tuple=JSON.stringify([estimate.id,rev.n,line.id]);insist(!tuples.has(tuple),'invoice_duplicate_line');tuples.add(tuple)
   const keep=value=>Object.fromEntries(Object.entries(value).filter(([key])=>!['quantity','quantityMilli','subtotalCents','salesTaxCents','totalCents','sourceEstimateId','sourceRevision'].includes(key)))
   insist(same(keep(line),keep(source)),'invoice_frozen_price')
   const quantity=invoice.actuals.filter(a=>a.estimateId===estimate.id&&a.revision===rev.n&&a.lineId===line.id).reduce((n,a)=>n+a.quantityMilli,0)
   insist(quantity===line.quantityMilli,'invoice_actual_quantity')
  }
  insist(invoice.actuals.every(a=>tuples.has(JSON.stringify([a.estimateId,a.revision,a.lineId]))),'invoice_unbilled_actual')
  if(invoice.sources!==undefined){
   insist(Array.isArray(invoice.sources)&&new Set(invoice.sources.map(s=>s.estimateId)).size===invoice.sources.length,'invoice_sources')
   for(const snapshot of invoice.sources){const estimate=await get('estimate',snapshot.estimateId),rev=revision(estimate,snapshot.revision);insist(estimate.jobId===job.id&&same(snapshot.approval,rev.approval)&&same(snapshot.customerAuthorisation,estimate.authorisation),'invoice_source_decision')}
   insist(invoice.lines.every(l=>invoice.sources.some(s=>s.estimateId===(l.sourceEstimateId??invoice.estimateId)&&s.revision===(l.sourceRevision??invoice.estimateRevision))),'invoice_missing_source')
  }
  if(invoice.approval){insist(actor(invoice.approval.by,['owner','admin'])&&invoice.approval.revision===invoice.revision&&same(invoice.approval.totals,invoice.totals),'invoice_approval');await approvalRow('invoice',invoice,invoice.revision,invoice.approval.by)}
 }
 for await(const exported of each('export')){
  const invoice=await get('invoice',exported.invoiceId)
  insist(invoice.exportId===exported.id&&invoice.revision===exported.invoiceRevision&&same(invoice.lines,exported.lines)&&same(invoice.totals,exported.totals),'export_snapshot')
 }
 for await(const link of each('approvalLink'))if(link.decision){
  const {receipt,receiptSha256}=link.decision,estimate=await get('estimate',link.estimateId),rev=revision(estimate,link.revision)
  insist(receipt&&createHash('sha256').update(canonicalJson(receipt)).digest('hex')===receiptSha256,'receipt_hash')
  insist(receipt.linkId===link.id&&receipt.estimateId===estimate.id&&receipt.jobId===link.jobId&&receipt.revision===rev.n&&receipt.revisionTotalCents===rev.totals.totalCents,'receipt_scope')
  insist(Array.isArray(receipt.approved)&&Array.isArray(receipt.declined),'receipt_lines')
  const all=[...receipt.approved,...receipt.declined]
  insist(all.length===rev.lines.length&&new Set(all.map(l=>l.lineId)).size===all.length&&all.every(l=>rev.lines.some(source=>source.id===l.lineId)),'receipt_partition')
  for(const entry of all){const source=rev.lines.find(l=>l.id===entry.lineId);insist(entry.description===source.description&&entry.quantity===source.quantity&&entry.unitCents===source.unitCents-(source.unitDiscountCents??0)&&entry.salesTaxCents===source.salesTaxCents&&entry.totalCents===source.totalCents,'receipt_price')}
  insist(same(sumLines(rev.lines.filter(l=>receipt.approved.some(x=>x.lineId===l.id))),receipt.approvedTotals),'receipt_totals')
  insist(estimate.authorisation?.linkId===link.id&&same([...estimate.authorisation.lineIds].sort(),receipt.approved.map(l=>l.lineId).sort())&&same(estimate.authorisation.totals,receipt.approvedTotals),'receipt_decision')
 }
 await validateTender(context)
 return true
 for await(const doc of each('invoiceDocument')){
  const invoice=await get('invoice',doc.invoiceId)
  insist(doc.snapshot?.jobId===invoice.jobId&&doc.jobId===invoice.jobId&&doc.invoiceRevision===invoice.revision,'invoice_document_reference')
  insist(same(doc.snapshot.totals,invoice.totals),'invoice_document_totals')
  insist(createHash('sha256').update(doc.content).digest('hex')===doc.contentHash,'invoice_document_content')
  const pdf=Buffer.from(doc.pdfBase64,'base64')
  insist(pdf.toString('base64')===doc.pdfBase64&&pdf.subarray(0,8).toString()==='%PDF-1.4'&&createHash('sha256').update(pdf).digest('hex')===doc.pdfHash,'invoice_document_pdf')
  insist(whole(doc.sequence,1),'invoice_document_sequence')
  if(doc.corrects){const original=await get('invoiceDocument',doc.corrects);insist(original.invoiceId===invoice.id&&original.number===doc.correctsNumber&&original.sequence===doc.sequence-1,'invoice_document_correction')}else insist(doc.sequence===1,'invoice_document_original')
 }
 for await(const delivery of each('invoiceDelivery')){
  const doc=await get('invoiceDocument',delivery.documentId)
  insist(delivery.invoiceId===doc.invoiceId&&delivery.jobId===doc.jobId&&delivery.contentHash===doc.contentHash&&['unconfirmed','uncertain','failed','accepted','development'].includes(delivery.status),'invoice_delivery_document')
 }

}
