import { insist, whole, same, portion, sumLines } from './finance-values.mjs'

/** Credit portions use cumulative original-line rounding (credits.ts), not
 * freshly repriced quantities. Failed/uncertain refunds remain reserved. */
export async function validateTender({db,records,get,each}){
 const aggregate=async(kind,field,id,expression,extra='',params=[])=>{
  const row=await db.prepare(`SELECT COALESCE(SUM(${expression}),0) AS amount FROM ${records} WHERE kind=? AND json_extract(value,'$.${field}')=? ${extra}`).bind(kind,id,...params).first()
  insist(whole(row.amount),'aggregate_amount');return row.amount
 }
 for(const [kind,fields]of [['payment',"json_extract(value,'$.reference')"],['creditNote',"json_extract(value,'$.reference')"],['creditNote',"json_extract(value,'$.invoiceId'),json_extract(value,'$.stateVersion')"],['refund',"json_extract(value,'$.creditNoteId')"]]){
  const duplicate=await db.prepare(`SELECT 1 FROM ${records} WHERE kind=? GROUP BY ${fields} HAVING COUNT(*)>1 LIMIT 1`).bind(kind).first()
  insist(!duplicate,'duplicate_'+kind)
 }
 const account=async id=>{if(!id)return null;const row=await get('customerAccount',id);return row.mergedInto??row.id}
 const repeatedDepositReference=await db.prepare(`SELECT 1 FROM (SELECT json_extract(value,'$.reference') AS reference FROM ${records} WHERE kind IN ('deposit','payment') UNION ALL SELECT json_extract(entry.value,'$.reference') AS reference FROM ${records} d,json_each(d.value,'$.refunds') entry WHERE d.kind='deposit') GROUP BY reference HAVING COUNT(*)>1 LIMIT 1`).first()
 insist(!repeatedDepositReference,'duplicate_deposit_reference')
 for await(const deposit of each('deposit')){
  insist(whole(deposit.amountCents,1,1_000_000_000)&&['cash','check','other'].includes(deposit.method)&&Array.isArray(deposit.refunds)&&typeof deposit.reference==='string'&&deposit.request?.amountCents===deposit.amountCents&&deposit.request.accountId===deposit.accountId&&deposit.request.jobId===deposit.jobId&&deposit.request.method===deposit.method&&deposit.request.reference===deposit.reference&&deposit.request.evidence===deposit.evidence&&deposit.by?.role==='owner','deposit_shape')
  await account(deposit.accountId)
  if(deposit.jobId){await get('job',deposit.jobId);const billing=await db.prepare(`SELECT value FROM ${records} WHERE kind='customerBilling' AND json_extract(value,'$.jobId')=?`).bind(deposit.jobId).first();insist(billing&&await account(JSON.parse(billing.value).snapshot.accountId)===await account(deposit.accountId),'deposit_job_account')}
  const spent=await aggregate('payment','depositId',deposit.id,"json_extract(value,'$.amountCents')"),refs=new Set([deposit.reference]);let refunded=0
  for(const refund of deposit.refunds){insist(whole(refund.amountCents,1)&&refund.method===deposit.method&&typeof refund.reference==='string'&&!refs.has(refund.reference)&&typeof refund.evidence==='string'&&refund.by?.role==='owner','deposit_refund');refs.add(refund.reference);refunded+=refund.amountCents}
  insist(spent+refunded<=deposit.amountCents,'deposit_overspent')
 }
 for await(const payment of each('payment')){
  insist(whole(payment.amountCents,1,1_000_000_000)&&['cash','check','other','stripe','customer-credit'].includes(payment.method)&&typeof payment.reference==='string'&&payment.reference.length>0,'payment_shape')
  const invoice=await get('invoice',payment.invoiceId)
  insist(['approved','exported'].includes(invoice.status)&&payment.jobId===invoice.jobId&&payment.invoiceNumber===invoice.number,'payment_invoice')
  if(payment.depositId){const deposit=await get('deposit',payment.depositId);insist(payment.method===deposit.method&&payment.verified===false&&await account(deposit.accountId)===await account(invoice.billing?.accountId)&&(!deposit.jobId||deposit.jobId===invoice.jobId),'deposit_allocation')}
  if(payment.method==='customer-credit'){
   const note=await get('creditNote',payment.creditNoteId)
   const redirected=await db.prepare(`SELECT 1 FROM ${records} WHERE kind='refund' AND json_extract(value,'$.creditNoteId')=? AND json_extract(value,'$.redirect.destination')='account-credit' LIMIT 1`).bind(note.id).first()
   insist(payment.verified===false&&(note.destination==='account-credit'||redirected)&&note.accountId&&await account(note.accountId)===await account(invoice.billing?.accountId),'credit_account')
   const spent=await aggregate('payment','creditNoteId',note.id,"json_extract(value,'$.amountCents')")
   insist(spent<=note.totals.totalCents,'credit_overspent')
  }else{
   // Historical tender keeps its original invoice snapshot. The collection
   // door separately requires an exact current revision/total before release.
   insist(whole(payment.invoiceRevision,1,invoice.revision)&&whole(payment.invoiceTotalCents,1)&&payment.amountCents<=payment.invoiceTotalCents&&(payment.invoiceRevision!==invoice.revision||payment.invoiceTotalCents===invoice.totals.totalCents),'payment_snapshot')
   if(payment.method==='stripe'){
    const r=payment.receipt
    insist(payment.verified===true&&r&&r.provider==='stripe'&&r.invoiceRevision===payment.invoiceRevision&&r.amountCents===payment.amountCents&&r.currency==='USD'&&r.status==='succeeded'&&r.captured===true&&r.disputed===false&&r.refunded===false&&typeof r.livemode==='boolean'&&payment.reference==='stripe:'+r.paymentIntentId,'payment_receipt')
   }else insist(payment.verified===false,'unverified_tender')
  }
 }
 for await(const note of each('creditNote')){
  const invoice=await get('invoice',note.invoiceId)
  insist(['approved','exported'].includes(invoice.status)&&note.jobId===invoice.jobId&&whole(note.stateVersion)&&whole(note.invoiceVersion,1)&&note.invoiceVersion<=invoice.version,'credit_invoice')
  insist(Array.isArray(note.lines)&&note.lines.length>0&&note.lines.length<=100&&same(sumLines(note.lines),note.totals)&&note.totals.totalCents>0,'credit_totals')
  insist(['original-tender','account-credit'].includes(note.destination)&&note.request&&note.request.invoiceId===invoice.id&&same(note.request.lines,note.lines.map(({lineId,sourceEstimateId,sourceRevision,quantityMilli})=>({lineId,sourceEstimateId,sourceRevision,quantityMilli}))),'credit_request')
  const keys=new Set()
  for(const line of note.lines){
   const tuple=JSON.stringify([line.lineId,line.sourceEstimateId,line.sourceRevision]);insist(!keys.has(tuple)&&whole(line.quantityMilli,1)&&line.quantity===line.quantityMilli/1000,'credit_line');keys.add(tuple)
   const source=invoice.lines.find(l=>l.id===line.lineId&&l.sourceEstimateId===line.sourceEstimateId&&l.sourceRevision===line.sourceRevision)
   insist(source,'credit_source')
   const row=await db.prepare(`SELECT COALESCE(SUM(json_extract(l.value,'$.quantityMilli')),0) AS prior FROM ${records} n,json_each(n.value,'$.lines') l WHERE n.kind='creditNote' AND json_extract(n.value,'$.invoiceId')=? AND json_extract(n.value,'$.stateVersion')<? AND json_extract(l.value,'$.lineId')=? AND json_extract(l.value,'$.sourceEstimateId')=? AND json_extract(l.value,'$.sourceRevision')=?`).bind(invoice.id,note.stateVersion,line.lineId,line.sourceEstimateId,line.sourceRevision).first()
   insist(whole(row.prior)&&row.prior+line.quantityMilli<=source.quantityMilli,'credit_quantity')
   const subtotal=portion(source.subtotalCents,row.prior+line.quantityMilli,source.quantityMilli)-portion(source.subtotalCents,row.prior,source.quantityMilli)
   const tax=portion(source.salesTaxCents,row.prior+line.quantityMilli,source.quantityMilli)-portion(source.salesTaxCents,row.prior,source.quantityMilli)
   insist(line.subtotalCents===subtotal&&line.salesTaxCents===tax&&line.totalCents===subtotal+tax&&line.kind===source.kind&&line.taxable===source.taxable&&line.taxRateMillionths===source.taxRateMillionths,'credit_portion')
  }
  if(note.destination==='original-tender'){
   const payment=await get('payment',note.paymentId)
   insist(payment.invoiceId===invoice.id&&['cash','check','other','stripe'].includes(payment.method)&&note.method===payment.method,'credit_tender')
   const reserved=await aggregate('refund','paymentId',payment.id,"json_extract(value,'$.amountCents')")
   insist(reserved<=payment.amountCents,'refund_overreserved')
  }else insist(note.accountId&&await account(note.accountId)===await account(invoice.billing?.accountId)&&note.method==='account-credit','credit_owner')
 }
 for await(const refund of each('refund')){
  const note=await get('creditNote',refund.creditNoteId),payment=await get('payment',refund.paymentId)
  insist(note.destination==='original-tender'&&note.invoiceId===refund.invoiceId&&note.paymentId===payment.id&&payment.invoiceId===refund.invoiceId&&refund.method===payment.method&&refund.amountCents===note.totals.totalCents&&whole(refund.amountCents,1),'refund_source')
  insist(['unsubmitted','pending','uncertain','failed','refunded','redirected','disputed'].includes(refund.status),'refund_status')
  if(refund.redirect){
   const r=refund.redirect
   insist(refund.method==='stripe'&&refund.status==='redirected'&&['account-credit','manual-tender'].includes(r.destination),'refund_redirect')
   if(r.destination==='account-credit')insist(r.status==='credited'&&r.method==='account-credit'&&await account(r.accountId)===await account(note.accountId),'refund_redirect_account')
   else insist(['cash','check','other'].includes(r.method)&&['unsubmitted','refunded','failed','disputed'].includes(r.status),'refund_redirect_tender')
  }
 }
 for await(const invoice of each('invoice')){
  const paid=await aggregate('payment','invoiceId',invoice.id,"json_extract(value,'$.amountCents')")
  const credits=await aggregate('creditNote','invoiceId',invoice.id,"json_extract(value,'$.totals.totalCents')")
  insist(paid<=invoice.totals.totalCents&&credits<=paid,'invoice_allocation')
 }
}
