import {createHash} from 'node:crypto'
import {rows,type Row,type State} from './model'
import {inspectionStatus} from './inspections'
import {jobEstimates} from './supplement-scope'
import {currentPromisePlan,promiseLabor} from './promises'
import {flowStage} from './flow'

export type Citation={kind:string;id:string;version:number;revision?:number;itemId?:string;lineId?:string;label:string;href:string}
export type RepairBlocker={key:string;kind:'evidence'|'consent'|'backorder';title:string;source:Citation;action:{label:string;href:string}}
const related=(s:State,kind:string,jobId:string)=>rows(s,kind).filter(r=>r.jobId===jobId).sort((a,b)=>a.id.localeCompare(b.id))
export function citation(kind:string,row:Row,jobId:string):Citation {
 const base='/app/jobs/'+encodeURIComponent(jobId),revision=row.revisions?.at(-1)?.n??row.n??row.revision??row.template?.revision??row.template?.n
 const href=kind==='purchaseOrder'||kind==='purchaseReceipt'?'/app/purchasing#po-'+encodeURIComponent(row.purchaseId??row.id):kind==='intakeForm'||kind==='intake'||kind==='intakeComparison'?base+'/intake':kind==='diagnosis'?base+'#diagnosis':kind==='inspection'?base+'#inspections':kind==='specialPart'?base+'#special-parts':kind.startsWith('promise')?base+'#promises':base
 return {kind,id:row.id,version:row.version,...(Number.isSafeInteger(revision)?{revision}:{}),label:kind+' · version '+row.version+(Number.isSafeInteger(revision)?' · revision '+revision:''),href}
}
const key=(kind:string,id:string,item='')=>[kind,id,item].filter(Boolean).join(':')

/** Requirements come from issued forms and assigned checklists, never inferred diagnostic quality. */
export function blockerProjection(s:State,job:Row){
 const groups:Record<string,string[]>={intake:['intake','intakeComparison','intakeForm'],diagnostics:['diagnosis','inspection'],authorization:['estimate','approvalLink'],parts:['specialPart','purchaseOrder','purchaseReceipt'],progress:['job','flow','timeEntry','subtask','handoff','jobNote','proposal','routingCase','routingBlocker'],promises:['promise','promisePlan','promiseRevision','promiseNotice']}
 const purchases=rows(s,'purchaseOrder').filter(po=>po.lines.some((l:any)=>l.jobId===job.id)).sort((a,b)=>a.id.localeCompare(b.id)),purchaseIds=new Set(purchases.map(po=>po.id))
 const sourceRows=(kind:string)=>kind==='job'?[job]:kind==='purchaseOrder'?purchases:kind==='purchaseReceipt'?rows(s,kind).filter(r=>purchaseIds.has(r.purchaseId)&&purchases.some(po=>po.id===r.purchaseId&&po.lines.some((line:any)=>line.id===r.lineId&&line.jobId===job.id))).sort((a,b)=>a.id.localeCompare(b.id)):related(s,kind,job.id)
 const sources=Object.fromEntries(Object.entries(groups).map(([group,kinds])=>[group,kinds.flatMap(kind=>sourceRows(kind).map(row=>citation(kind,row,job.id)))]))
 const blockers:RepairBlocker[]=[]
 const add=(kind:RepairBlocker['kind'],sourceKind:string,row:Row,item:string,title:string,action:string,extra:Partial<Citation>={})=>{
  const source={...citation(sourceKind,row,job.id),...extra};blockers.push({key:key(sourceKind,row.id,item),kind,title,source,action:{label:action,href:source.href}})
 }
 for(const form of sourceRows('intakeForm'))if(!form.receipt||form.status!=='signed')add('evidence','intakeForm',form,'','Issued intake acknowledgment is not signed'+(form.revoked?' (link revoked; source needs review)':''),'Review issued intake')
 for(const inspection of sourceRows('inspection'))for(const {item,result} of inspectionStatus(inspection).incomplete)add('evidence','inspection',inspection,item.id,item.label+': '+(result?'not inspected':'no observation recorded'),'Record assigned evidence',{itemId:item.id})
 for(const q of jobEstimates(s,job)){
  const rev=q.revisions.at(-1)
  if(!rev.approval||q.authorisation?.revision!==rev.n||!['authorised','declined'].includes(q.status))add('consent','estimate',q,'',!rev.approval?'Estimate revision '+rev.n+' needs person approval':q.status==='approved'?'Approved estimate needs sharing and a customer decision':'Estimate revision '+rev.n+' needs the customer’s decision','Review estimate')
 }
 for(const part of sourceRows('specialPart'))if(!part.receipt)add('backorder','specialPart',part,'',part.charge.description+': physical receipt missing; supplier ETA '+part.revisions.at(-1).eta,'Record physical receipt')
 const plan=currentPromisePlan(s,job.id)
 for(const part of plan?.revisions.at(-1)?.parts??[])if(!part.specialPartId&&!part.receivedAt)add('backorder','promisePlan',plan!,part.partId,part.name+': recorded receipt missing; staff ETA '+part.eta,'Review parts source',{itemId:part.partId})
 for(const po of purchases)if(po.approval)for(const line of po.lines.filter((l:any)=>l.jobId===job.id)){
  const received=sourceRows('purchaseReceipt').filter(r=>r.purchaseId===po.id&&r.lineId===line.id).reduce((n,r)=>n+r.quantityMilli,0)
  if(received<line.quantityMilli)add('backorder','purchaseOrder',po,line.id,line.name+': '+(line.quantityMilli-received)/1000+' ordered units lack physical receipts','Review goods receipts',{lineId:line.id})
 }
 const rank={evidence:0,consent:1,backorder:2};blockers.sort((a,b)=>rank[a.kind]-rank[b.kind]||a.key.localeCompare(b.key))
 const proposals=[...jobEstimates(s,job).filter(q=>q.status==='draft'&&['booked','working'].includes(job.status)).map(q=>({kind:'estimate',id:q.id,version:q.version,revision:q.revisions.at(-1).n,label:'Review estimate revision '+q.revisions.at(-1).n,href:'/app/jobs/'+encodeURIComponent(job.id)})),...related(s,'proposal',job.id).filter(p=>p.status==='pending'&&p.jobVersion===job.version&&['booked','working'].includes(job.status)).map(p=>({kind:'dispatch',id:p.id,version:p.version,label:'Review prepared dispatch plan',href:'/app/jobs/'+encodeURIComponent(job.id)}))]
 const promise=sourceRows('promise')[0],progress={stage:flowStage(s,job),status:job.status,recordedActuals:job.actuals.length,remainingHours:promiseLabor(s,job).remainingHours,promiseAt:promise?.revisions.at(-1)?.pickupAt??null}
 // Sorted source identities fence changes without copying private notes into a packet.
 const basis=createHash('sha256').update(JSON.stringify(sources)).digest('hex')
 return {basis,sources,blockers,proposals,progress}
}

/** A vanished source, elapsed ETA, changed stage or acknowledgment is never fulfillment. */
export function blockerClearance(s:State,job:Row,task:Row):{reason:string;source:Citation}|null {
 const source=rows(s,task.source.kind).find(r=>r.id===task.source.id)
 if(!source)return null
 const cite=citation(task.source.kind,source,job.id)
 if(task.source.kind==='inspection'){
  const item=source.template.snapshot.items.find((i:any)=>i.id===task.source.itemId),result=[...source.results].reverse().find((r:any)=>r.itemId===task.source.itemId)
  if(item&&result&&result.outcome!=='not-inspected')return {reason:'Assigned observation recorded; this is not repair or safety clearance.',source:{...cite,itemId:item.id}}
 }
 if(task.source.kind==='intakeForm'&&source.status==='signed'&&source.receipt)return {reason:'Exact issued intake acknowledgment signed; work consent remains separate.',source:cite}
 if(task.source.kind==='estimate'){
  const rev=source.revisions.at(-1)
  if(rev.approval&&source.authorisation?.revision===rev.n&&['authorised','declined'].includes(source.status))return {reason:source.status==='declined'?'Customer declined; no work authority granted.':'Exact estimate revision has a recorded customer authorization.',source:cite}
 }
 if(task.source.kind==='specialPart'&&source.receipt)return {reason:'Physical receipt recorded: '+source.receipt.reference,source:cite}
 if(task.source.kind==='promisePlan'){
  const part=source.revisions.at(-1).parts.find((p:any)=>p.partId===task.source.itemId)
  if(part?.receivedAt)return {reason:'Staff-recorded receipt on the current parts plan.',source:{...cite,itemId:part.partId}}
 }
 if(task.source.kind==='purchaseOrder'){
  const line=source.lines.find((l:any)=>l.id===task.source.lineId),received=rows(s,'purchaseReceipt').filter(r=>r.purchaseId===source.id&&r.lineId===line?.id).reduce((n,r)=>n+r.quantityMilli,0)
  if(line&&received>=line.quantityMilli)return {reason:'Goods receipts cover the full originally ordered quantity; short-close alone is insufficient.',source:{...cite,lineId:line.id}}
 }
 return null
}
