import {fail} from '../model'
import type {technicianReport} from './technicians'
import type {turnaroundReport} from './turnaround'

// CSV is a projection of an already authorized report, never a fresh unscoped read.
const columns=['Record','TechnicianId','JobId','SourceId','Metric','Value','Unit','At','Stage','From','To','Description','JobURL'] as const
type Entry=Partial<Record<typeof columns[number],unknown>>
const jobUrl=(id:string)=>'/app/jobs/'+encodeURIComponent(id)
function cell(value:unknown) {
 const raw=String(value??'')
 // Preserve numeric negatives; neutralize formulas in user-controlled text, including leading whitespace.
 const safe=typeof value==='string'&&(/^[\t\r\n]/.test(raw)||/^\s*[=+@-]/.test(raw))?"'"+raw:raw
 return '"'+safe.replaceAll('"','""')+'"'
}
function document(schema:string,report:{period:{from:string,to:string},generatedAt:string},entries:Entry[]) {
 const metadata:Entry[]=[{Record:'metadata',Metric:'schema',Value:schema},{Record:'metadata',Metric:'from',Value:report.period.from},{Record:'metadata',Metric:'to',Value:report.period.to},{Record:'metadata',Metric:'timeZone',Value:'UTC'},{Record:'metadata',Metric:'generatedAt',Value:report.generatedAt}]
 return [columns.map(cell).join(','),...[...metadata,...entries].map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n')+'\r\n'
}

/** Reject unsupported filters rather than silently exporting a broader dataset. */
export function reportFormat(params:URLSearchParams):'json'|'csv' {
 for(const key of params.keys())if(!['from','to','format'].includes(key)||params.getAll(key).length!==1)fail('INPUT',`Unsupported or repeated report filter: ${key}.`,null,400)
 const format=params.get('format')??'json'
 if(format!=='json'&&format!=='csv')fail('INPUT','Choose json or csv report format.',null,400)
 return format
}

export function technicianCsv(report:ReturnType<typeof technicianReport>):string {
 const entries:Entry[]=[]
 for(const tech of report.technicians) {
  const base={TechnicianId:tech.technicianId}
  // Missing owner-only properties produce no CSV rows, preserving the existing report boundary.
  for(const metric of ['attendanceMs','breakMs','netAttendanceMs','jobMs','billableMs','nonbillableMs','reworkMs','soldMilliHours','efficiencyTenths','productivityTenths','payCents','unratedMs'])if(metric in tech)entries.push({...base,Record:'summary',Metric:metric,Value:tech[metric],Unit:metric.endsWith('Ms')?'milliseconds':metric.endsWith('Cents')?'USD cents':metric==='soldMilliHours'?'thousandths of an hour':'tenths of a percent'})
  for(const interval of tech.intervals)entries.push({...base,Record:'timer',JobId:interval.jobId,JobURL:interval.jobId?jobUrl(interval.jobId):'',SourceId:interval.id,Metric:'countedMs',Value:interval.countedMs,Unit:'milliseconds',Description:[interval.kind,interval.category,interval.running?'running':'stopped'].filter(Boolean).join(' / ')})
  for(const sold of tech.sold)entries.push({...base,Record:'sold-labor',JobId:sold.jobId,JobURL:jobUrl(sold.jobId),SourceId:sold.estimateId,Metric:sold.lineId,Value:sold.milliHours,Unit:'thousandths of an hour',At:sold.decidedAt,Description:sold.description})
  for(const assignment of tech.assignments)entries.push({...base,Record:'assignment',JobId:assignment.jobId,JobURL:jobUrl(assignment.jobId),At:assignment.at,Metric:assignment.kind,Value:assignment.to,Description:assignment.from??''})
 }
 entries.unshift({Record:'definition',Metric:'coverage',Value:'Current native timers, approved corrections and authorized labor. UTC inclusive dates; null ratios are blank. No migrated-history completeness claim. Full timer revisions and corrections remain in JSON.'})
 return document('mallet-technician-csv/v1',report,entries)
}

export function turnaroundCsv(report:ReturnType<typeof turnaroundReport>):string {
 const entries:Entry[]=[{Record:'definition',Metric:'coverage',Value:report.coverage}]
 for(const repair of report.repairs) {
  const base={JobId:repair.jobId,JobURL:jobUrl(repair.jobId),Description:repair.title}
  entries.push({...base,Record:'repair',Metric:'historyComplete',Value:repair.historyComplete,At:repair.observedFrom??'',Stage:repair.stage,From:repair.createdAt,To:repair.endedAt})
  for(const metric of ['cycleMs','elapsedMs'] as const)entries.push({...base,Record:'summary',Metric:metric,Value:repair[metric],Unit:'milliseconds'})
  for(const interval of repair.intervals)entries.push({...base,Record:'stage',SourceId:interval.stageEventId,Metric:'durationMs',Value:interval.durationMs,Unit:'milliseconds',Stage:interval.stage,From:interval.from,To:interval.to})
  for(const [stage,value] of Object.entries(repair.stageTotalsMs))entries.push({...base,Record:'stage-total',Stage:stage,Metric:'durationMs',Value:value,Unit:'milliseconds'})
  if(repair.promise) {
   const promise=repair.promise
   entries.push({...base,Record:'promise',SourceId:promise.sourceId,Metric:'completionVarianceMs',Value:promise.completionVarianceMs,Unit:'milliseconds',At:promise.pickupAt}, {...base,Record:'promise',SourceId:promise.sourceId,Metric:'overdue',Value:promise.overdue,At:promise.pickupAt})
  }
 }
 return document('mallet-turnaround-csv/v1',report,entries)
}
