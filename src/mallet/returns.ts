import {openTermsRelease} from './receivables'
import {assetType,requiresReturnReading} from './asset-types'
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type Context,type Row} from './model'
import {assertQualityReady} from './quality'
import {readings} from './mileage'
import {handoverTender,invoiceBalance,publicInvoiceSnapshot} from './payments'
export const returnCommands=['return.delegate','return.revokeDelegate','return.override'] as const
export const returns:Handler=(c,command,p)=>{
 if(!(returnCommands as readonly string[]).includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or service advisor records handover authority.',null,403)
 const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
 if(rows(c.s,'flow').some(f=>f.jobId===job.id&&f.collection))fail('COLLECTED','Collection is already recorded; retain its original authority.')
 if(command==='return.delegate'){
  const customerName=text(p.customerName,'customer granting authority',200)
  if(customerName.toLowerCase()!==job.asset.customerName.toLowerCase()||p.consent!==true)fail('DELEGATE_CONSENT','Record explicit authority from the customer on this repair.',null,400)
  const row=put(c.s,'returnDelegate',{jobId:job.id,customerName,delegateName:text(p.delegateName,'authorized delegate',200),evidence:text(p.evidence,'customer delegate authorization evidence',2000),consent:true,revoked:null,by:who(c),at:c.now});event(c,command,job.id,row.id,{});return row
 }
 if(command==='return.revokeDelegate'){
  const row=find(c.s,'returnDelegate',p.delegateId);expectVersion(row,p.delegateVersion)
  if(row.jobId!==job.id||row.revoked)fail('DELEGATE_STATE','Use an active delegate authorization on this repair.')
  const revoked={reason:text(p.reason,'revocation reason',2000),by:who(c),at:c.now},next=bump(c.s,'returnDelegate',row,{revoked});event(c,command,job.id,row.id,revoked);return next
 }
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner may permit release without verified settlement.',null,403)
 const invoice=find(c.s,'invoice',job.invoiceId)
 if(!['approved','exported'].includes(invoice.status))fail('INVOICE_REQUIRED','Approve this repair’s invoice before an unpaid-release exception.')
 const row=put(c.s,'returnOverride',{jobId:job.id,invoiceId:invoice.id,invoiceRevision:invoice.revision,totalCents:invoice.totals.totalCents,balance:structuredClone(invoiceBalance(c.s,invoice)),reason:text(p.reason,'explicit unpaid-release reason',2000),by:who(c),at:c.now,expiresAt:new Date(Date.parse(c.now)+86400000).toISOString(),label:'Owner permits release without processor-verified settlement. This is not payment. Release may end the shop’s possessory lien.'});event(c,command,job.id,row.id,{});return row
}
export function handover(c:Context,job:Row,invoice:Row,p:any){
 const quality=assertQualityReady(c.s,job)
 if(p.settlementVersion!==c.s.version)fail('CONCURRENT_CHANGE','Refresh and recheck the current invoice and processor evidence before collection.')
 const receipts=Array.isArray(p.settlementReceipts)?p.settlementReceipts:[],verifiedCents=receipts.reduce((n:number,r:any)=>n+r.amountCents,0),override=p.overrideId?find(c.s,'returnOverride',p.overrideId):null
 if(override&&(override.jobId!==job.id||override.invoiceId!==invoice.id||override.invoiceRevision!==invoice.revision||override.totalCents!==invoice.totals.totalCents||override.expiresAt<=c.now))fail('RETURN_OVERRIDE','Use a current owner-approved exception for this exact invoice.')
 if(p.termsAssignmentId&&c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner releases on reviewed account terms.',null,403)
 const accountTerms=p.termsAssignmentId?openTermsRelease(c.s,invoice,c.actor.id,p.termsAssignmentId):null
 const tender=handoverTender(c.s,invoice)
 if(verifiedCents+tender.recordedCents<invoice.totals.totalCents&&!override&&!accountTerms)fail('PAYMENT_UNSETTLED','Processor-confirmed captured funds or staff-recorded tender for this exact invoice revision must cover the invoice, or the owner must explicitly approve an unpaid release.')
 const collectorName=text(p.collectorName,'actual collector',200),delegate=p.delegateId?find(c.s,'returnDelegate',p.delegateId):null
 if(delegate&&(delegate.jobId!==job.id||delegate.revoked||delegate.delegateName.toLowerCase()!==collectorName.toLowerCase()))fail('DELEGATE_STATE','Use current customer-granted authority for this actual delegate.')
 if(!delegate&&collectorName.toLowerCase()!==job.asset.customerName.toLowerCase())fail('DELEGATE_REQUIRED','Record the customer’s explicit delegate authority before handing over to another person.')
 const identityEvidence=text(p.identityEvidence,'staff collector identity check evidence (do not copy identity documents)',1000),comparison=find(c.s,'intakeComparison',p.comparisonId)
 if(comparison.jobId!==job.id||comparison.signature.name.toLowerCase()!==collectorName.toLowerCase())fail('CUSTODY_CHECKLIST','The actual collector must acknowledge this visit’s custody checklist comparison.')
 const source=find(c.s,'intake',comparison.intakeId),latest=rows(c.s,'intake').filter(i=>i.jobId===job.id&&i.phase==='before').sort((a,b)=>(a.n??0)-(b.n??0)||a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).at(-1)
 const latestComparison=rows(c.s,'intakeComparison').filter(r=>r.intakeId===source.id).sort((a,b)=>(a.n??0)-(b.n??0)||a.at.localeCompare(b.at)||a.id.localeCompare(b.id)).at(-1)
 if(comparison.id!==latestComparison?.id)fail('CUSTODY_CHECKLIST','Use the latest signed comparison of this custody checklist.')
 if(source.id!==latest?.id)fail('CUSTODY_CHECKLIST','Compare the latest before-condition custody receipt.')
 const needsReading=requiresReturnReading(job.asset),mileage=needsReading?readings(c.s,job.assetId).find(r=>r.id===p.readingId):null
 if(needsReading&&(!mileage||mileage.jobId!==job.id||mileage.stage!=='out'||assetType(job.asset)==='equipment'&&mileage.unit!=='hours'))fail('RETURN_MILEAGE',assetType(job.asset)==='equipment'?'Record current hours-out on this visit before handover.':'Record current mileage-out on this visit before handover.')
 const receipt=put(c.s,'handover',{jobId:job.id,assetId:job.assetId,invoiceId:invoice.id,invoiceNumber:invoice.number,invoice:publicInvoiceSnapshot(invoice),collectorName,delegate:delegate?structuredClone(delegate):null,identityEvidence,identityVerifiedByMallet:false,comparison:structuredClone(comparison),mileage:structuredClone(mileage),quality:{technician:structuredClone(quality.technicianSignoff),reviewer:structuredClone(quality.qualitySignoff)},settlement:{verifiedCents,receipts,accountTerms,tender:structuredClone(tender),override:override?structuredClone(override):null,label:accountTerms?accountTerms.label:override?'Released under explicit owner exception; settlement is not verified. Release may end the shop’s possessory lien.':invoice.totals.totalCents===0?'No payment due on this zero-total invoice; no processor check was needed.':tender.recordedCents>0?tender.label+(verifiedCents>0?' · Stripe confirmed the remaining captured funds; bank payout is not verified.':''):'Stripe confirmed captured funds at handover; bank payout is not verified.'},warrantyAdvice:text(p.warrantyAdvice,'warranty advice and paper receipt instructions',4000),by:who(c),at:c.now,label:'Documented handover recorded by staff. Collector identity was checked by staff, not verified by Mallet.'})
 return receipt
}
