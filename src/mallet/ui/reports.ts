import {reportFiltersPanel} from './report-filters'
import {area,box,e,field,form,money,person,when,type Names} from './common'
import type {Actor} from '../auth'
const hours=(ms:number)=>(Math.floor((2*ms*100+3_600_000)/7_200_000)/100).toFixed(2)
const percent=(tenths:number|null)=>tenths===null?'n/a':(tenths/10).toFixed(1)+'%'
const kind=(i:any)=>i.kind==='job'?({billable:'Billable job',nonbillable:'Nonbillable job',rework:'Rework job'} as any)[i.category]:i.kind==='break'?'Break':'Attendance'
export const FORMULAS='Sold hours are customer-authorized labor hours on repairs currently assigned to the technician, dated by the UTC date of the customer decision. Actual hours are billable job-timer time. Efficiency = sold ÷ actual billable hours. Productivity (utilization) = all job-timer time (billable, nonbillable and rework) ÷ net attendance (attendance less breaks). Intervals use their latest approved revision and are clipped to the inclusive UTC date range; a running interval counts to now. Hours show half-up to two decimals and percentages half-up to one decimal.'

function rateForm(row:any,period:{from:string,to:string}) {
 const today=new Date().toISOString().slice(0,10)
 return `<details><summary>Set hourly pay rate</summary>${form('payRate.set',`${field('Hourly pay rate (USD)','rate','number','','required min="0" max="10000" step="0.01"')}${field('Effective from (UTC date)','effectiveFrom','date',today,'required')}${area('Reason for this rate','reason','','required maxlength="500"')}<p>Earlier rates stay on record. Each attendance interval uses the rate in effect on its UTC start date.</p>`,'Save pay rate',{technicianId:row.technicianId,from:period.from,to:period.to,...(row.rates?{version:row.rates.version}:{})})}</details>`
}
function drill(row:any,names:Names) {
 const intervals=row.intervals.map((i:any)=>{const r=i.revisions.at(-1);return `<li class="plain"><p><strong>${e(kind(i))}</strong> · ${when(r.startAt,r.endAt??undefined)} · counted ${hours(i.countedMs)} h${i.running?' · Running':''}${i.jobId?` · <a href="/app/jobs/${e(i.jobId)}#time">Repair</a>`:''}</p><ul>${i.revisions.map((v:any)=>`<li>${when(v.startAt,v.endAt??undefined)} · ${e(v.reason)} · ${e(v.by.name)}${v.approvedBy?` · Approved by ${e(v.approvedBy.name)}`:''}</li>`).join('')}</ul></li>`}).join('')
 const corrections=row.corrections.map((c:any)=>`<li class="plain"><strong>${e(c.status)}</strong> · ${e(c.reason)} · proposed by ${e(c.by.name)}${c.approvedBy?` · approved by ${e(c.approvedBy.name)}`:''}</li>`).join('')
 const sold=row.sold.map((l:any)=>`<li class="plain"><a href="/app/jobs/${e(l.jobId)}">${e(l.title)}</a> · ${e(l.description)} · ${e(l.milliHours/1000)} h · decided ${when(l.decidedAt)}</li>`).join('')
 const moves=row.assignments.map((a:any)=>`<li class="plain">${a.kind==='job.book'?'Booked to':`Reassigned from ${e(person(names,a.from))} to`} ${e(person(names,a.to))} · ${when(a.at)} · by ${e(a.by.name)}</li>`).join('')
 return `<details><summary>Timers, edits and assignments</summary><h4>Clock intervals</h4><ul class="list">${intervals||'<li>No clock intervals in this period.</li>'}</ul><h4>Time corrections</h4><ul class="list">${corrections||'<li>No corrections.</li>'}</ul><h4>Sold labor</h4><ul class="list">${sold||'<li>No customer-authorized labor in this period.</li>'}</ul><h4>Assignments</h4><ul class="list">${moves||'<li>No assignment records.</li>'}</ul></details>`
}
export function technicianReportPage(report:any,actor:Actor,names:Names,filters:any[]=[]) {
 const owner=actor.role==='owner',{from,to}=report.period
 const filter=`<form method="get" action="/app/reports/technicians">${field('From (UTC date)','from','date',from,'required')}${field('To (UTC date, inclusive)','to','date',to,'required')}<button>Show report</button></form>`
 const cards=report.technicians.map((r:any)=>{
  const pay=owner?`<p><strong>Pay cost:</strong> ${money(r.payCents)}${r.unratedMs?` · ${hours(r.unratedMs)} h without a pay rate`:''} · Rates: ${r.rates?r.rates.revisions.map((v:any)=>`${money(v.centsPerHour)}/h from ${e(v.effectiveFrom)} (${e(v.reason)}, ${e(v.by.name)})`).join('; '):'none set'}</p>${rateForm(r,report.period)}`:''
  return box(person(names,r.technicianId),`<dl><dt>Sold hours</dt><dd>${e((r.soldMilliHours/1000).toFixed(3))}</dd><dt>Actual billable hours</dt><dd>${hours(r.billableMs)}</dd><dt>Efficiency</dt><dd>${percent(r.efficiencyTenths)}</dd><dt>Productivity</dt><dd>${percent(r.productivityTenths)}</dd><dt>Attendance</dt><dd>${hours(r.attendanceMs)} h</dd><dt>Breaks</dt><dd>${hours(r.breakMs)} h</dd><dt>Net attendance</dt><dd>${hours(r.netAttendanceMs)} h</dd><dt>Nonbillable</dt><dd>${hours(r.nonbillableMs)} h</dd><dt>Rework</dt><dd>${hours(r.reworkMs)} h</dd></dl>${pay}${drill(r,names)}`,{id:'tech-'+r.technicianId})
 }).join('')
 const scope=owner?'You see every technician, pay rates and pay cost.':actor.role==='admin'?'You see every technician’s hours. Pay rates are visible to the owner only.':'You see only your own hours.'
 return `<div class="narrow">${box('Period',`${filter}${reportFiltersPanel('technicians',report.period,filters,owner)}<p>${e(scope)}</p><p>${e(FORMULAS)}</p>`)}${cards||box('No technicians','<p>No clock time or sold labor in this period.</p>')}</div>`
}
