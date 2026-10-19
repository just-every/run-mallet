import {fail,rows,type Actor,type Row,type State} from '../model'
import {timeRange} from '../time'
import {authorizedCap,jobEstimates} from '../supplement-scope'
import {rateOn,utcDate} from '../pay-rates'

const HOUR=3_600_000,DAY=86_400_000
// Integer half-up division for nonnegative numbers: round(n*scale/d).
export const ratio=(n:number,d:number,scale:number)=>d>0?Math.floor((2*n*scale+d)/(2*d)):null
export type Period={from:string,to:string,startMs:number,endMs:number}
export function period(from:unknown,to:unknown,now:string):Period {
 const today=now.slice(0,10),f=utcDate(from||today,'from date'),t=utcDate(to||today,'to date')
 const startMs=Date.parse(f+'T00:00:00Z'),endMs=Date.parse(t+'T00:00:00Z')+DAY
 if(endMs<=startMs||endMs-startMs>366*DAY)fail('INPUT','Choose a from date on or before the to date, at most 366 days apart.',null,400)
 return {from:f,to:t,startMs,endMs}
}
const clipped=(entry:Row,p:Period,now:string)=>{const r=timeRange(entry);return Math.max(0,Math.min(Date.parse(r.endAt??now),p.endMs)-Math.max(Date.parse(r.startAt),p.startMs))}
const category=(entry:Row)=>entry.category??(entry.billable?'billable':'nonbillable')

/** Sold labor credited to a technician: customer-authorized labor on jobs currently assigned to them, dated by the customer decision's UTC date. */
function soldLines(s:State,technicianId:string,p:Period) {
 const lines:any[]=[]
 for(const job of rows(s,'job').filter(j=>j.technicianId===technicianId))for(const q of jobEstimates(s,job)) {
  const day=q.authorisation?.at?.slice(0,10)
  if(!day||day<p.from||day>p.to)continue
  for(const line of q.revisions.at(-1).lines)if(line.kind==='labor'&&q.authorisation.lineIds.includes(line.id))lines.push({jobId:job.id,title:job.title,estimateId:q.id,lineId:line.id,description:line.description,milliHours:authorizedCap(s,q,line),decidedAt:q.authorisation.at})
 }
 return lines
}

export function technicianRow(s:State,technicianId:string,p:Period,now:string,owner:boolean) {
 const own=rows(s,'timeEntry').filter(e=>e.ownerId===technicianId),inPeriod=own.filter(e=>clipped(e,p,now)>0)
 const sum=(test:(e:Row)=>boolean)=>inPeriod.filter(test).reduce((n,e)=>n+clipped(e,p,now),0)
 const attendanceMs=sum(e=>e.kind==='attendance'),breakMs=sum(e=>e.kind==='break'),netAttendanceMs=attendanceMs-breakMs
 const billableMs=sum(e=>e.kind==='job'&&category(e)==='billable'),nonbillableMs=sum(e=>e.kind==='job'&&category(e)==='nonbillable'),reworkMs=sum(e=>e.kind==='job'&&category(e)==='rework'),jobMs=billableMs+nonbillableMs+reworkMs
 const sold=soldLines(s,technicianId,p),soldMilliHours=sold.reduce((n,l)=>n+l.milliHours,0)
 const jobIds=new Set([...sold.map(l=>l.jobId),...inPeriod.filter(e=>e.jobId).map(e=>e.jobId)]),ids=new Set(inPeriod.map(e=>e.id))
 const row:any={technicianId,attendanceMs,breakMs,netAttendanceMs,jobMs,billableMs,nonbillableMs,reworkMs,soldMilliHours,
  // Tenths of a percent, half-up; null when the denominator is zero.
  efficiencyTenths:ratio(soldMilliHours*3600,billableMs,1000),productivityTenths:ratio(jobMs,netAttendanceMs,1000),
  intervals:inPeriod.map(e=>({id:e.id,kind:e.kind,category:e.kind==='job'?category(e):null,jobId:e.jobId,countedMs:clipped(e,p,now),running:timeRange(e).endAt===null,revisions:e.revisions})),
  corrections:rows(s,'timeCorrection').filter(c=>ids.has(c.entryId)),
  sold,
  assignments:rows(s,'event').filter(e=>jobIds.has(e.jobId)&&(e.kind==='job.book'||e.kind==='dispatch.approve')).map(e=>({jobId:e.jobId,kind:e.kind,at:e.at,by:e.actor,from:e.kind==='job.book'?null:e.data.before?.technicianId,to:e.kind==='job.book'?e.data.technicianId:e.data.after?.technicianId}))}
 if(owner) {
  // Pay cost: each attendance interval's net time (less its breaks) at the rate in effect on its UTC start date, half-up cents.
  let payCents=0,unratedMs=0
  for(const a of inPeriod.filter(e=>e.kind==='attendance')) {
   const ms=clipped(a,p,now)-inPeriod.filter(b=>b.kind==='break'&&b.attendanceId===a.id).reduce((n,b)=>n+clipped(b,p,now),0),rate=rateOn(s,technicianId,timeRange(a).startAt.slice(0,10))
   if(rate===null)unratedMs+=ms;else payCents+=ratio(ms*rate,HOUR,1)!
  }
  Object.assign(row,{payCents,unratedMs,rates:rows(s,'payRate').find(r=>r.technicianId===technicianId)??null})
 }
 return row
}

/** Owner and admin read every technician (rates owner-only); members read only their own row; agents are refused by the caller. */
export function technicianReport(s:State,actor:Actor,p:Period,now=new Date().toISOString()) {
 const ids=actor.role==='member'?[actor.id]:[...new Set([...rows(s,'timeEntry').map(e=>e.ownerId),...rows(s,'payRate').map(r=>r.technicianId),...rows(s,'job').map(j=>j.technicianId)])]
 const technicians=ids.map(id=>technicianRow(s,id,p,now,actor.role==='owner')).filter(r=>r.technicianId===actor.id||r.intervals.length||r.sold.length||r.rates)
 // A member sees assignment changes only on repairs currently assigned to them, as on their job list.
 if(actor.role==='member')for(const r of technicians)r.assignments=r.assignments.filter((a:any)=>rows(s,'job').find(j=>j.id===a.jobId)?.technicianId===actor.id)
 return {period:{from:p.from,to:p.to},generatedAt:now,technicians}
}
