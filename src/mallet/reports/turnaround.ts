import {inspectionStatus} from '../inspections'
import {ratio} from './technicians'
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
export function turnaroundReport(s:State,p:Period,now:string,fullVisibility=true) {
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
  const inspections=rows(s,'inspection').filter(i=>i.jobId===job.id).map(i=>({id:i.id,complete:inspectionStatus(i).complete,inspected:inspectionStatus(i).inspected,total:inspectionStatus(i).total}))
  const reports=rows(s,'inspectionReport').filter(r=>r.jobId===job.id).map(r=>({id:r.id,views:rows(s,'diagnosisLinkView').filter(v=>v.reportId===r.id).length}))
  const comebacks=rows(s,'warranty').filter(w=>w.originalJobId===job.id).map(w=>({id:w.id,jobId:w.jobId,at:w.at}))
  return {dvi:{inspections,reports},comebacks,jobId:job.id,title:job.title,createdAt:job.createdAt,completedAt:completion,endedAt:endAt,stage:flowStage(s,job),
   historyComplete:events[0]?.completeHistory??false,observedFrom:events[0]?.at??null,
   cycleMs:completion?Date.parse(completion)-Date.parse(job.createdAt):null,
   elapsedMs:Math.max(0,endMs-Date.parse(job.createdAt)),intervals,
   stageTotalsMs:Object.fromEntries([...new Set(intervals.map(i=>i.stage))].map(stage=>[stage,intervals.filter(i=>i.stage===stage).reduce((sum,i)=>sum+i.durationMs,0)])),
   promise:pickupAt?{pickupAt,revision:promiseRevision.n,sourceId:promise!.id,completionVarianceMs:completion?Date.parse(completion)-Date.parse(pickupAt):null,overdue:!completion&&!job.closure&&now>=pickupAt}:null}
 })
 const appointments=rows(s,'appointment').filter(a=>a.status==='confirmed'&&Date.parse(a.startAt)>=p.startMs&&Date.parse(a.startAt)<p.endMs).map(a=>({id:a.id,version:a.version,startAt:a.startAt,service:a.service.name,attendance:a.attendance??null}))
 const due=appointments.filter(a=>a.startAt<=now),observed=due.filter(a=>a.attendance),noShows=observed.filter(a=>a.attendance.outcome==='no-show').length
 const inspections=repairs.flatMap(r=>r.dvi.inspections),reports=repairs.flatMap(r=>r.dvi.reports),completed=repairs.filter(r=>r.completedAt),returned=completed.filter(r=>r.comebacks.length)
 const metrics={appointmentsDue:due.length,attendanceRecorded:observed.length,noShows,noShowRateTenths:ratio(noShows,observed.length,1000),inspections:inspections.length,inspectionsComplete:inspections.filter(i=>i.complete).length,dviCompletionRateTenths:ratio(inspections.filter(i=>i.complete).length,inspections.length,1000),reviewedReports:reports.length,reportsViewed:reports.filter(r=>r.views>0).length,viewRequests:reports.reduce((n,r)=>n+r.views,0),engagementRateTenths:ratio(reports.filter(r=>r.views>0).length,reports.length,1000),completedRepairs:completed.length,repairsWithComebacks:returned.length,comebackRateTenths:ratio(returned.length,completed.length,1000)}
 return {fullVisibility,appointments,metrics,period:{from:p.from,to:p.to},generatedAt:now,coverage:'Repairs booked in the inclusive UTC date range. Stage history begins when observed; incomplete history is never backfilled. Cycle time is booking to completion. Stage time continues through collection and export, or cancellation/loss. Promise variance is completion minus the promise in force at completion (negative means early). Appointment cohort uses scheduled start in the selected UTC dates. No-shows require immutable owner observation; the rate uses only recorded attendance, with unknown attendance shown separately. DVI completion uses latest results on assigned inspection snapshots for the booked repair cohort. Engagement counts reviewed reports with at least one page request, not verified human readers; repeated requests do not increase the engaged-report count. Comeback rate is completed repairs in the booked cohort with at least one retained warranty case, including later cases, divided by completed repairs; it is not a defect or coverage determination. Rates are rounded half up to tenths of a percent; empty denominators are unavailable. Location comparison is unavailable. Members see only their existing repair scope; appointment and warranty data remain unavailable to them.',repairs}
}
