import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler} from './model'
export const reportCommands=['inspectionReport.review','inspectionReport.claim','inspectionReport.outcome']
export const internalReportCommands=['inspectionReport.claim','inspectionReport.outcome']
export const inspectionReports:Handler=(c,command,p)=>{
 if(!reportCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only owner/admin may review and send inspection reports.',null,403)
 if(command==='inspectionReport.review'){
  const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
  if(!Array.isArray(p.entries)||p.entries.length<1||p.entries.length>30)fail('INPUT','Review 1–30 inspection findings.',null,400)
  const entries=p.entries.map((input:any)=>{
   const inspection=find(c.s,'inspection',input.inspectionId);expectVersion(inspection,input.inspectionVersion)
   if(inspection.jobId!==job.id)fail('REPORT_SCOPE','Choose inspection findings on this repair.',null,400)
   const result=inspection.results.find((r:any)=>r.id===input.resultId)
   if(!result||[...inspection.results].reverse().find((r:any)=>r.itemId===result.itemId)?.id!==result.id)fail('REPORT_STALE','Review the current inspection result.')
   const estimate=find(c.s,'estimate',input.estimateId);expectVersion(estimate,input.estimateVersion)
   const revision=integer(input.revision,'estimate revision',1),rev=estimate.revisions.find((r:any)=>r.n===revision)
   if(estimate.jobId!==job.id||!rev||rev.n!==estimate.revisions.at(-1).n||!['approved','sent','authorised','declined'].includes(estimate.status))fail('REPORT_ESTIMATE','Choose the current person-approved estimate revision.')
   if(!Array.isArray(input.lineIds)||!input.lineIds.length||new Set(input.lineIds).size!==input.lineIds.length)fail('INPUT','Choose exact proposed estimate lines.',null,400)
   const lines=input.lineIds.map((id:any)=>{const line=rev.lines.find((x:any)=>x.id===id);if(!line)fail('REPORT_LINE','Choose lines from this exact estimate revision.',null,400);return {id:line.id,kind:line.kind,description:line.description,quantity:line.quantity,unitCents:line.unitCents,totalCents:line.totalCents,salesTaxCents:line.salesTaxCents}})
   // Media snapshots are supplied only by the server resolver; raw client snapshots are discarded there.
   return {id:crypto.randomUUID(),inspectionId:inspection.id,inspectionVersion:inspection.version,resultId:result.id,label:result.item.label,urgency:result.outcome,measurement:structuredClone(result.measurement),technician:{at:result.at},explanation:text(input.explanation,'advisor-reviewed explanation',4000),media:input.media??[],proposal:{estimateId:estimate.id,revision,lines}}
  })
  const asset=find(c.s,'asset',job.assetId),row=put(c.s,'inspectionReport',{jobId:job.id,title:text(p.title,'report title'),vehicle:asset.label,repair:job.title,entries,reviewedBy:who(c),reviewedAt:c.now})
  event(c,command,job.id,row.id,{entries:entries.length});return row
 }
 if(command==='inspectionReport.claim'){
  const report=find(c.s,'inspectionReport',p.reportId),operationId=text(p.operationId,'send operation id',100)
  if(rows(c.s,'inspectionReportDelivery').some(x=>x.operationId===operationId))fail('REPORT_REPLAY','This send was already claimed. Review its retained outcome; it will not be retried automatically.')
  if(p.consent!==true)fail('REPORT_CONSENT','Confirm the recipient and explicit customer permission for this report email.',null,422)
  const to=text(p.to,'customer email',254);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))fail('INPUT','Provide a valid customer email.',null,400)
  const row=put(c.s,'inspectionReportDelivery',{jobId:report.jobId,reportId:report.id,operationId,to,consentEvidence:text(p.consentEvidence,'customer permission evidence',2000),status:'unconfirmed',claimedAt:c.now,by:who(c)})
  event(c,command,report.jobId,row.id,{reportId:report.id});return row
 }
 const row=find(c.s,'inspectionReportDelivery',p.deliveryId);expectVersion(row,p.version)
 if(row.status!=='unconfirmed')fail('REPORT_DELIVERY','This outcome was already recorded.')
 if(!['accepted','development','failed','uncertain'].includes(p.status))fail('INPUT','Unknown mail outcome.',null,400)
 const next=bump(c.s,'inspectionReportDelivery',row,{status:p.status,provider:text(p.provider,'provider',100),linkId:text(p.linkId,'inspection link'),at:c.now})
 event(c,command,row.jobId,row.id,{status:next.status});return next
}
