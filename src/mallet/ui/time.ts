import {timeRange,timeSeconds,timeTotals} from '../time'
import {authorizedCap,jobEstimates} from '../supplement-scope'
import {area,box,e,field,form,rows,select,when,type Names,person} from './common'
import type {Actor} from '../auth'
function correctionForm(entry:any,jobId?:string) {
 const range=timeRange(entry)
 return `<details><summary>Correct this stopped interval</summary>${form('time.correct',`${field('Corrected start (ISO with timezone)','startAt','text',range.startAt,'required')}${field('Corrected end (ISO with timezone)','endAt','text',range.endAt,'required')}${area('Reason for this time correction','reason','','required maxlength="2000"')}<p>The original stays intact. Owner or service-advisor approval is required before totals change.</p>`,'Propose time correction',{entryId:entry.id,entryVersion:entry.version,...(jobId?{jobId}:{})})}</details>`
}
export function timeFormInput(data:FormData,input:any) {
 if(!String(input.command).startsWith('time.'))return input
 for(const key of ['entryVersion','correctionVersion','version'])if(data.has(key))input[key]=Number(data.get(key))
 return input
}
export function timePanel(state:any,actor:Actor,names:Names,job?:any) {
 if(actor.role==='agent')return ''
 const all=rows(state,'timeEntry'),own=all.filter(t=>t.ownerId===actor.id),attendance=own.find(t=>t.kind==='attendance'&&timeRange(t).endAt===null),onBreak=own.find(t=>t.kind==='break'&&timeRange(t).endAt===null),running=own.find(t=>t.kind==='job'&&timeRange(t).endAt===null),manager=['owner','admin'].includes(actor.role),totals=timeTotals(state,actor.id),back=job?{jobId:job.id}:{}
 let controls=attendance?`<p>Clocked in since ${when(timeRange(attendance).startAt)}${onBreak?' · On break':''}.</p>`:'<p>You are clocked out.</p>'
 controls+=!attendance?form('time.clockIn','','Clock in',back):running?`<p>Running job: <a href="/app/jobs/${e(running.jobId)}#time">${e(rows(state,'job').find(j=>j.id===running.jobId)?.title??'Repair timer')}</a>. Pause before a break or clock-out.</p>${form('time.pause','','Pause job timer',{jobId:running.jobId})}`:onBreak?form('time.breakEnd','','End break',back):form('time.breakStart','','Start break',back)+form('time.clockOut','','Clock out',back)
 const day=new Date().toISOString().slice(0,10),soldToday=rows(state,'job').filter(j=>j.technicianId===actor.id).reduce((sum,j)=>sum+jobEstimates(state,j).filter(q=>q.authorisation?.at?.startsWith(day)).reduce((n,q)=>n+q.revisions.at(-1).lines.filter((l:any)=>l.kind==='labor'&&q.authorisation.lineIds.includes(l.id)).reduce((v:number,l:any)=>v+authorizedCap(state,q,l)/1000,0),0),0)
 controls+=`<p>Customer-authorized sold labor today (UTC, by recorded decision time): ${e(soldToday)} hours.</p>`
 const jobs=job?[job]:rows(state,'job').filter(j=>j.technicianId===actor.id)
 for(const j of jobs){
  const entries=all.filter(t=>t.kind==='job'&&t.jobId===j.id),seconds=entries.reduce((sum,t)=>sum+timeSeconds(t),0),nonbillable=entries.filter(t=>!t.billable).reduce((sum,t)=>sum+timeSeconds(t),0)
  const sold=jobEstimates(state,j).reduce((sum,q)=>{const r=q.revisions.at(-1);return sum+r.lines.filter((l:any)=>l.kind==='labor'&&q.authorisation?.lineIds.includes(l.id)).reduce((n:number,l:any)=>n+authorizedCap(state,q,l)/1000,0)},0)
  controls+=`<h3>${e(j.title)}</h3><p>Elapsed job time: ${e(seconds.toFixed(3))} seconds · Nonbillable/rework: ${e(nonbillable.toFixed(3))} seconds · Customer-authorized sold labor: ${e(sold)} hours. Timers do not record billable actuals or change invoices.</p>`
  if(j.technicianId===actor.id&&attendance&&!onBreak&&!running&&['booked','working'].includes(j.status))controls+=form('time.start',select('Time category','category',[['billable','Billable work'],['nonbillable','Nonbillable work'],['rework','Rework (nonbillable)']]),own.some(t=>t.jobId===j.id)?'Resume job timer':'Start job timer',{jobId:j.id,version:j.version})
 }
 const history=own.map(entry=>{const range=timeRange(entry);return `<li class="plain"><strong>${e(entry.kind==='job'?(entry.category??'Job'):entry.kind)}</strong> · ${when(range.startAt,range.endAt)} · ${range.endAt?e(timeSeconds(entry).toFixed(3))+' seconds':'Running'}${entry.jobId?` · <a href="/app/jobs/${e(entry.jobId)}#time">Repair</a>`:''}${range.endAt?correctionForm(entry,job?.id):''}<details><summary>Retained clock and correction history</summary><ul>${entry.revisions.map((r:any)=>`<li>${when(r.startAt,r.endAt)} · ${e(r.reason)} · ${e(r.by.name)}${r.approvedBy?` · Approved ${e(r.approvedBy.name)} · ${when(r.approvedAt)}`:''}</li>`).join('')}</ul></details></li>`}).join('')
 const corrections=rows(state,'timeCorrection').filter(c=>manager||c.ownerId===actor.id).map(c=>`<li class="plain"><strong>${e(c.status)} · ${e(person(names,c.ownerId))}</strong><p>${e(c.reason)}</p><p>Before: ${when(c.before.startAt,c.before.endAt)}<br>Proposed: ${when(c.after.startAt,c.after.endAt)}</p><p>Proposed by ${e(c.by.name)} · ${when(c.at)}${c.approvedBy?` · Approved by ${e(c.approvedBy.name)} · ${when(c.approvedAt)}`:''}</p>${manager&&c.status==='pending'?form('time.approveCorrection','<p>Approve this exact interval and reason. Overlap, attendance bounds and the original version are checked again.</p>','Approve time correction',{correctionId:c.id,correctionVersion:c.version,...back}):''}</li>`).join('')
 return box('Time & attendance',`<p>One running job per person. Pause before starting a break or clocking out. Clock events use server UTC; displayed times use your browser timezone.</p>${controls}<h3>Your elapsed totals</h3><p>Attendance ${e(totals.attendanceSeconds.toFixed(3))} seconds · Breaks ${e(totals.breakSeconds.toFixed(3))} seconds · Net attendance ${e(totals.netAttendanceSeconds.toFixed(3))} seconds · Job time ${e(totals.jobSeconds.toFixed(3))} seconds · Nonbillable/rework ${e(totals.nonbillableSeconds.toFixed(3))} seconds.</p><details><summary>Your stopped intervals and retained history</summary><ul class="list">${history||'<li>No clock entries yet.</li>'}</ul></details><details><summary>Time correction decisions</summary><ul class="list">${corrections||'<li>No proposed corrections.</li>'}</ul></details>`,{id:'time'})
}
