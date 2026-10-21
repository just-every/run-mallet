import {assertSubletsReady,jobSublets} from './sublet'
import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {openJob} from './workshop'
import {jobEstimates} from './supplement-scope'
import {qualityStatus} from './quality'
import {currentPromisePlan,promiseProjection} from './promises'
import {timeRange} from './time'

// FLOW-001: the repair board. Stages are derived from each repair's own records, so a card moves only when the
// gated command behind it succeeds; the board stores only priority, closure (canceled/lost) and recorded collection.
export const flowCommands=['flow.priority','flow.close','flow.collect'] as const
export const stages=[['intake','Intake'],['diagnosis','Diagnosis'],['approval','Approval'],['parts','Parts'],['work','Work'],['quality','Quality'],['ready','Ready'],['collected','Collected'],['closed','Closed']] as const
export type Stage=typeof stages[number][0]
export const priorities=['normal','high','urgent'] as const
export const COLLECTION_LABEL='Collection recorded by staff. Mallet did not record or verify payment, keys or the collector’s identity.'
export const flowRecord=(s:State,jobId:string)=>(s.records.flow??[]).find(f=>f.jobId===jobId)
const list=(s:State,kind:string)=>s.records[kind]??[]
const manager=(c:Context)=>{if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or service advisor manages the repair board.',null,403)}

/** Precedence: closed > collected > ready > quality > approval > parts > work > diagnosis > intake. */
export function flowStage(s:State,job:Row):Stage {
 if(job.status==='canceled'||job.status==='lost')return 'closed'
 if(flowRecord(s,job.id)?.collection)return job.status==='invoiced'?'closed':'collected'
 if(job.status==='completed'||job.status==='invoiced')return 'ready'
 const quality=qualityStatus(s,job),quotes=jobEstimates(s,job)
 if(job.actuals.length&&(quality.technicianSignoff||quality.items.some((i:any)=>i.item.stage==='post'&&i.result)))return 'quality'
 const authorised=quotes.some(q=>q.status==='authorised')
 if(quotes.some(q=>['draft','approved','sent'].includes(q.status))||quotes.length&&!authorised)return 'approval'
 if(authorised)return (currentPromisePlan(s,job.id)?.revisions.at(-1)?.parts??[]).some((p:any)=>!p.receivedAt)?'parts':'work'
 if(list(s,'diagnosis').some(d=>d.jobId===job.id)||list(s,'inspection').some(i=>i.jobId===job.id))return 'diagnosis'
 return 'intake'
}

/** What holds a repair back, each from a retained record; nothing here is inferred or sent. */
export function flowBlockers(s:State,job:Row,stage:Stage,projection:any):string[] {
 const blockers:string[]=[],quotes=jobEstimates(s,job),invoice=list(s,'invoice').find(i=>i.jobId===job.id),flow=flowRecord(s,job.id)
 if(stage==='closed')return blockers
 for(const r of jobSublets(s,job.id))if(!r.receipt)blockers.push(`Outside custody: ${r.item} at ${r.supplier}; ETA ${r.etaHistory.at(-1).eta}`)
 for(const q of quotes){
  const label=q.supplementOf?`Supplement ${q.sequence}`:'Estimate'
  if(q.status==='draft')blockers.push(`${label} waiting for a person to approve`)
  if(q.status==='approved')blockers.push(`${label} approved but not shared with the customer`)
  if(q.status==='sent')blockers.push(`${label} waiting for the customer’s decision`)
 }
 if(quotes.length&&quotes.every(q=>q.status==='declined'))blockers.push('Customer declined all work')
 if(list(s,'proposal').some(p=>p.jobId===job.id&&p.status==='pending'))blockers.push('Dispatch plan waiting for a decision')
 if(['parts','work','quality','approval'].includes(stage))for(const part of currentPromisePlan(s,job.id)?.revisions.at(-1)?.parts??[])if(!part.receivedAt)blockers.push(`Waiting for ${part.name}: staff-reported ETA ${part.eta}`)
 if(stage==='quality')for(const b of qualityStatus(s,job).blockers)blockers.push(b.reason)
 if(projection.status==='overdue')blockers.push('Customer promise overdue')
 if(projection.status==='at-risk')blockers.push('Customer promise at risk')
 if(stage==='ready'){
  if(!invoice)blockers.push('Invoice not prepared')
  else if(invoice.status==='draft')blockers.push('Invoice waiting for a person to approve')
  if(!flow?.collection)blockers.push('Collection not recorded')
 }
 if(stage==='collected')blockers.push('Invoice not exported')
 return blockers
}

export type BoardFilter={technicianId?:string,stage?:string,priority?:string,due?:string,q?:string}
export function boardFilter(params:URLSearchParams):BoardFilter {
 const value=(name:string)=>params.get(name)?.trim().slice(0,200)||undefined
 return {technicianId:value('technician'),stage:value('stage'),priority:value('priority'),due:value('due'),q:value('q')}
}
const rank={urgent:0,high:1,normal:2} as Record<string,number>
export function boardCard(s:State,job:Row,now:string) {
 const stage=flowStage(s,job),flow=flowRecord(s,job.id),projection=promiseProjection(s,job,now)
 const asset=list(s,'asset').find(a=>a.id===job.assetId)??job.asset,invoice=list(s,'invoice').find(i=>i.jobId===job.id)
 return {jobId:job.id,title:job.title,stage,status:job.status,priority:flow?.priority??'normal',customer:asset?.customerName??'',customerEmail:asset?.customerEmail??'',vehicle:asset?.label??'',identifier:asset?.identifier??'',bayId:job.bayId,technicianId:job.technicianId,helpers:job.helpers??[],
  due:projection.pickupAt?{at:projection.pickupAt,kind:'promise'}:{at:job.endAt,kind:'booking'},promiseStatus:projection.status,blockers:flowBlockers(s,job,stage,projection),invoiceNumber:invoice?.number??null,
  closure:job.closure??null,collection:flow?.collection??null,closedAt:job.closure?.at??(stage==='closed'?invoice?.exportedAt??null:null)}
}
export type Card=ReturnType<typeof boardCard>
/** Cards per stage, filtered and sorted urgent-first, then by due time; closed cards newest first. */
export function repairBoard(s:State,now:string,filter:BoardFilter={}) {
 const q=filter.q?.toLowerCase()
 const cards=rows(s,'job').map(job=>boardCard(s,job,now)).filter(c=>
  (!filter.technicianId||c.technicianId===filter.technicianId||c.helpers.includes(filter.technicianId))&&
  (!filter.stage||c.stage===filter.stage)&&(!filter.priority||c.priority===filter.priority)&&(!filter.due||c.promiseStatus===filter.due)&&
  (!q||[c.customer,c.customerEmail,c.vehicle,c.identifier,c.title,c.invoiceNumber].some(v=>String(v??'').toLowerCase().includes(q))))
 return {filter,stages:stages.map(([id,label])=>({id,label,cards:cards.filter(c=>c.stage===id).sort((a,b)=>id==='closed'?String(b.closedAt??'').localeCompare(String(a.closedAt??'')):rank[a.priority]-rank[b.priority]||a.due.at.localeCompare(b.due.at)||a.jobId.localeCompare(b.jobId))}))}
}

function flowFor(c:Context,jobId:string,version:unknown){
 const flow=flowRecord(c.s,jobId)
 if(integer(version,'flowVersion',0)!==(flow?.version??0))fail('VERSION','The board record changed. Refresh before continuing.')
 return flow
}
const save=(c:Context,jobId:string,flow:Row|undefined,changes:Record<string,any>)=>flow?bump(c.s,'flow',flow,changes):put(c.s,'flow',{jobId,priority:'normal',priorityHistory:[],collection:null,...changes})

export const flow:Handler=(c,command,p)=>{
 if(!(flowCommands as readonly string[]).includes(command))return
 manager(c)
 if(command==='flow.priority'){
  const job=openJob(c,p),current=flowFor(c,job.id,p.flowVersion),priority=choice(p.priority,priorities,'priority'),reason=text(p.reason,'priority reason',2000)
  if(priority===(current?.priority??'normal'))fail('PRIORITY_UNCHANGED','This repair already has that priority.')
  const saved=save(c,job.id,current,{priority,priorityHistory:[...(current?.priorityHistory??[]),{from:current?.priority??'normal',to:priority,reason,by:who(c),at:c.now}]})
  event(c,command,job.id,saved.id,{from:current?.priority??'normal',to:priority,reason});return saved
 }
 if(command==='flow.close'){
  const job=openJob(c,p),outcome=choice(p.outcome,['canceled','lost'] as const,'outcome'),reason=text(p.reason,'reason',2000)
  if(jobSublets(c.s,job.id).length)fail('SUBLET_CUSTODY','Keep the repair open until its approved outsourced work is received, quality-cleared and billed.')
  if(job.actuals.length)fail('WORK_RECORDED','Recorded work stays on this repair: complete and invoice it instead of canceling.')
  if(list(c.s,'timeEntry').some(t=>t.kind==='job'&&t.jobId===job.id&&timeRange(t).endAt===null))fail('TIMER_RUNNING','Pause the running job timer before closing this repair.')
  const stage=flowStage(c.s,job)
  const saved=bump(c.s,'job',job,{status:outcome,closure:{outcome,reason,stage,by:who(c),at:c.now}})
  event(c,command,job.id,job.id,{outcome,reason,stage});return saved
 }
 const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
 const current=flowFor(c,job.id,p.flowVersion),invoice=list(c.s,'invoice').find(i=>i.jobId===job.id)
 if(!['completed','invoiced'].includes(job.status))fail('NOT_READY','Only a completed, quality-cleared repair can be collected.')
 if(!invoice||!['approved','exported'].includes(invoice.status))fail('INVOICE_REQUIRED','A person must approve this repair’s invoice before collection is recorded.')
 assertSubletsReady(c.s,job)
 if(current?.collection)fail('COLLECTED','Collection is already recorded for this repair.')
 const collection={collectorName:text(p.collectorName,'collector name',200),note:text(p.note,'collection note',2000,true),invoiceId:invoice.id,invoiceNumber:invoice.number,invoiceStatus:invoice.status,label:COLLECTION_LABEL,by:who(c),at:c.now}
 const saved=save(c,job.id,current,{collection});event(c,command,job.id,saved.id,{collectorName:collection.collectorName,invoiceNumber:invoice.number,invoiceStatus:invoice.status});return saved
}
/** Members see board records only for repairs they are on. */
export const scopedFlow=(s:State,ids:Set<string>)=>list(s,'flow').filter(f=>ids.has(f.jobId))
