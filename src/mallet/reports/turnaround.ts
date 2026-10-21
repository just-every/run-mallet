import {flowStage} from '../flow'
import {put,rows,who,type Context,type State} from '../model'
import type {Period} from './technicians'

/** Record only observed changes. Older repairs never acquire an invented stage history. */
export function retainStageChanges(c:Context,events:any[]) {
 for(const jobId of new Set(events.map(e=>e.jobId).filter(Boolean))) {
  const job=rows(c.s,'job').find(j=>j.id===jobId)
  if(!job)continue
  const prior=rows(c.s,'stageEvent').filter(e=>e.jobId===jobId).sort((a,b)=>a.sequence-b.sequence).at(-1),stage=flowStage(c.s,job)
  if(prior?.stage===stage)continue
  const sources=events.filter(e=>e.jobId===jobId)
  put(c.s,'stageEvent',{jobId,sequence:(prior?.sequence??0)+1,stage,at:c.now,by:who(c),eventIds:sources.map(e=>e.id),commands:sources.map(e=>e.kind),completeHistory:prior?.completeHistory??sources.some(e=>e.kind==='job.book')})
 }
}

/** The caller supplies the same native job visibility as the workshop state door. */
export function turnaroundReport(s:State,p:Period,now:string) {
 const repairs=rows(s,'job').filter(j=>j.createdAt>=new Date(p.startMs).toISOString()&&j.createdAt<new Date(p.endMs).toISOString()).map(job=>{
  // Rows are stored by id, not timestamp. Stable event order is retained explicitly below.
  const events=rows(s,'stageEvent').filter(e=>e.jobId===job.id).sort((a,b)=>a.sequence-b.sequence)
  const collection=rows(s,'flow').find(f=>f.jobId===job.id)?.collection,exportedAt=rows(s,'invoice').find(i=>i.jobId===job.id)?.exportedAt
  const terminal=job.closure?.at??(collection&&exportedAt?[collection.at,exportedAt].sort().at(-1):null)
  const endAt=terminal??now,endMs=Date.parse(endAt)
  const intervals=events.map((event,index)=>{
   const to=events[index+1]?.at??endAt
   return {stage:event.stage,from:event.at,to,durationMs:Math.max(0,Date.parse(to)-Date.parse(event.at)),stageEventId:event.id,eventIds:event.eventIds,commands:event.commands}
  })
  const promise=rows(s,'promise').find(r=>r.jobId===job.id)
  // Completion is judged against the promise in force then, never a later revision.
  const promiseRevision=promise?.revisions.filter((r:any)=>!job.completedAt||r.at<=job.completedAt).at(-1)
  const pickupAt=promiseRevision?.pickupAt??null,completion=job.completedAt??null
  return {jobId:job.id,title:job.title,createdAt:job.createdAt,completedAt:completion,endedAt:endAt,stage:flowStage(s,job),
   historyComplete:events[0]?.completeHistory??false,observedFrom:events[0]?.at??null,
   cycleMs:completion?Date.parse(completion)-Date.parse(job.createdAt):null,
   elapsedMs:Math.max(0,endMs-Date.parse(job.createdAt)),intervals,
   stageTotalsMs:Object.fromEntries([...new Set(intervals.map(i=>i.stage))].map(stage=>[stage,intervals.filter(i=>i.stage===stage).reduce((sum,i)=>sum+i.durationMs,0)])),
   promise:pickupAt?{pickupAt,revision:promiseRevision.n,sourceId:promise!.id,completionVarianceMs:completion?Date.parse(completion)-Date.parse(pickupAt):null,overdue:!completion&&!job.closure&&now>=pickupAt}:null}
 })
 return {period:{from:p.from,to:p.to},generatedAt:now,coverage:'Repairs booked in the inclusive UTC date range. Stage history begins when observed; incomplete history is never backfilled. Cycle time is booking to completion. Stage time continues through collection and export, or cancellation/loss. Promise variance is completion minus the promise in force at completion (negative means early). No-shows, DVI engagement, comeback rates and location comparisons are not yet available.',repairs}
}
