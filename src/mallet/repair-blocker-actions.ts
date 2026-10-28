import {rows,type Row,type State} from './model'
import {authorizedCap,jobEstimates} from './supplement-scope'
import {qualityStatus} from './quality'
import {citation,type RepairBlocker} from './repair-blocker-sources'

/** Prepared review steps contain source fences, never invented work or sending authority. */
export function blockerNextAction(s:State,job:Row,blockers:RepairBlocker[]){
 const base='/app/jobs/'+encodeURIComponent(job.id),blocker=blockers[0]
 const step=(label:string,command:string|null,source:any,input:any={},href=source.href)=>({label,command,source,input,href})
 if(blocker){
  const source=blocker.source,row=rows(s,source.kind).find(r=>r.id===source.id)
  if(!row)return step('Review unavailable source with the handler',null,source)
  if(source.kind==='estimate'){
   const revision=row.revisions.at(-1).n,input={estimateId:row.id,version:row.version,revision}
   if(row.status==='draft')return step('Review and approve the exact estimate', 'estimate.approve',source,input)
   if(row.status==='approved')return step('Review recipient and share the approved estimate','approvalLink.create',source,input)
   return step('Obtain the exact customer decision','estimate.authorise',source,input)
  }
  if(source.kind==='inspection')return step('Record the assigned inspection observation','inspection.record',source,{jobId:job.id,version:job.version,inspectionId:row.id,inspectionVersion:row.version,itemId:source.itemId})
  if(source.kind==='specialPart')return step('Count and record the physical part receipt','specialPart.receive',source,{jobId:job.id,version:job.version,specialPartId:row.id,partVersion:row.version})
  if(source.kind==='purchaseOrder')return step('Count and record the outstanding goods','purchase.receive',source,{purchaseId:row.id,version:row.version,lineId:source.lineId})
  if(source.kind==='promisePlan')return step('Verify the outstanding part at receiving','promise.partETA',source,{jobId:job.id,version:job.version,planVersion:row.version,partId:source.itemId})
  return step('Obtain the issued intake acknowledgment',null,source)
 }
 if(!['booked','working'].includes(job.status))return null
 for(const quote of jobEstimates(s,job)){
  const rev=quote.revisions.at(-1)
  if(quote.status!=='authorised'||quote.authorisation?.revision!==rev.n)continue
  for(const line of rev.lines.filter((line:any)=>quote.authorisation.lineIds.includes(line.id))){
   const used=job.actuals.filter((a:any)=>a.estimateId===quote.id&&a.revision===rev.n&&a.lineId===line.id).reduce((n:number,a:any)=>n+a.quantityMilli,0),remaining=authorizedCap(s,quote,line)-used
   if(remaining>0)return {...step('Record remaining authorized '+(line.kind==='labor'?'labor':'parts'),'work.record',{...citation('estimate',quote,job.id),lineId:line.id},{jobId:job.id,version:job.version,estimateId:quote.id,revision:rev.n,lineId:line.id}),remainingQuantity:remaining/1000}
  }
 }
 if(!job.actuals.length)return step('Review diagnosis and prepare an estimate',null,citation('job',job,job.id))
 const quality=qualityStatus(s,job),source=citation(quality.record?'quality':'job',quality.record??job,job.id)
 if(!quality.ready){
  const command=!quality.record?'quality.configure':quality.items.some(({item,result}:any)=>(item.required||item.critical)&&result?.outcome!=='pass')?'quality.record':!quality.technicianSignoff?'quality.signTechnician':'quality.signQuality'
  return {...step('Review the current quality clearance',command,source,{jobId:job.id,version:job.version,qualityVersion:quality.record?.version??0},base+'#quality'),requirements:quality.blockers.map(b=>b.reason)}
 }
 return step('Review and explicitly complete the repair','job.complete',citation('job',job,job.id),{jobId:job.id,version:job.version})
}
