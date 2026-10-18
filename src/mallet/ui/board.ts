// The Shop Board (/app): the bays, the work an agent prepared for a person, every open repair order in its column,
// and the selected repair order beside them with the decision it waits on. Visual authority: the owner-picked
// app look (desk 17 Oct, app-1536.png).
import {e,form,money,badge,status,initials,nobr,person,rows,when,type Names} from './common'
import {icon} from './icons'
import {columns,repair,waiting,clock,hrs,eventNames,type Repair} from './repair'
import {human,type Actor} from '../auth'

const bayNumber=(bay:string)=>Number(bay.match(/\d+/)?.[0]??999)

function bays(open:Repair[],names:Names) {
 const ids=[...new Set(open.map(r=>String(r.job.bayId)))].sort((a,b)=>bayNumber(a)-bayNumber(b)||a.localeCompare(b))
 if(!ids.length)return ''
 return `<section class="bays" aria-label="Bays">${ids.map(id=>{
  const r=open.filter(x=>x.job.bayId===id&&x.job.status==='working').sort((a,b)=>b.job.startAt.localeCompare(a.job.startAt))[0]
  if(!r)return `<div class="bay"><strong>${e(id)}</strong><p class="muted">Available</p></div>`
  const sold=r.sold||r.clocked
  return `<a class="bay" href="/app?ro=${e(r.job.id)}#ro"><strong>${e(id)}</strong><span>${e(person(names,r.job.technicianId))}</span><span class="muted">${sold?`${hrs(r.sold)} sold · clocked ${clock(r.clocked)}`:'Work recorded'}</span>${sold?`<progress max="${sold}" value="${Math.min(r.clocked,sold)}">${clock(r.clocked)}</progress>`:''}</a>`
 }).join('')}</section>`
}

function advisor(state:any) {
 const w=waiting(state)
 if(!w.total)return ''
 const parts=[[w.estimates.length,'estimate'],[w.plans.length,'dispatch plan'],[w.invoices.length,'invoice draft']].filter(([n])=>n).map(([n,label])=>`${n} ${label}${n===1?'':'s'}`)
 const list=parts.length>1?`${parts.slice(0,-1).join(', ')} and ${parts.at(-1)}`:parts[0]
 return `<section class="advisor" aria-label="Prepared by an agent">${icon('spark','spark')}<p><strong>${e(w.agent)}:</strong> prepared ${e(list)}, nothing shared.</p><p class="approval"><i class="dot" aria-hidden="true"></i>${w.total} change${w.total===1?' needs':'s need'} approval</p><a class="button quiet" href="/app?ro=${e(w.jobIds[0])}#ro">Review</a></section>`
}

const card=(r:Repair,names:Names,selected:boolean)=>{const tech=person(names,r.job.technicianId);return `<a class="ro${selected?' selected':''}" href="/app?ro=${e(r.job.id)}#ro"${selected?' aria-current="true"':''}><span class="ro-head"><strong>${e(r.job.bayId)}</strong>${when(r.job.startAt,undefined,'card')}</span><span class="ro-vehicle">${nobr(r.asset?.label)}</span><span>${nobr(r.asset?.customerName)}</span><span class="ro-title" title="${e(r.job.title)}">${nobr(r.job.title)}</span><span class="tech" title="${e(tech)}"><span class="avatar" aria-hidden="true">${e(initials(tech))}</span><span class="tech-name">${e(tech)}</span></span>${badge(r.chip[0],r.chip[1])}</a>`}

const LIMIT=5
function board(open:Repair[],names:Names,selected?:string) {
 return `<section class="board" id="board" aria-label="Repair orders by stage">${columns.map(([id,label])=>{
  const list=open.filter(r=>r.column===id).sort((a,b)=>a.job.startAt.localeCompare(b.job.startAt)),shown=list.slice(0,LIMIT)
  if(selected&&!shown.some(r=>r.job.id===selected)){const pick=list.find(r=>r.job.id===selected);if(pick)shown.splice(LIMIT-1,1,pick)}
  return `<section class="column ${id}"><h2>${e(label)} <span>${list.length}</span></h2>${shown.map(r=>card(r,names,r.job.id===selected)).join('')||'<p class="column-empty">Nothing here</p>'}${list.length>shown.length?`<a class="more" href="/app/jobs">+ ${list.length-shown.length} more ${e(label.toLowerCase())}</a>`:''}</section>`
 }).join('')}</section>`
}

function activity(state:any) {
 const events=[...rows(state,'event')].filter(v=>v.jobId).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,4)
 if(!events.length)return ''
 const job=(id:string)=>rows(state,'job').find(j=>j.id===id)
 return `<section class="activity" aria-label="Recent activity"><h2>Recent activity</h2>${events.map(v=>`<p>${icon('clock')}${when(v.at,undefined,'short')}<span><a href="/app?ro=${e(v.jobId)}#ro">${e(eventNames[v.kind]??v.kind)}</a> · ${e(job(v.jobId)?.asset?.label)} · ${e(v.actor?.name)}</span></p>`).join('')}</section>`
}

// The sales tax a total includes, at the rate frozen on its lines (the shop's rate when they were priced).
const taxRate=(lines:any[])=>{const rates=[...new Set(lines.filter(l=>l.taxable).map(l=>l.taxRatePercent))];return rates.length===1?`${e(rates[0])}% sales tax`:rates.length?'sales tax':'no sales tax'}

const line=(l:any,mark:'yes'|'no'|'',meta:string)=>`<div class="workrow">${mark?`<span class="mark ${mark}" aria-hidden="true"></span>`:'<span></span>'}<p><span>${e(l.description)}</span><small>${meta}</small></p><strong class="amount">${money(l.subtotalCents)}</strong></div>`

function detail(r:Repair,state:any,names:Names,actor:Actor,picked:boolean) {
 const {job,asset,estimate,rev}=r,manager=human(actor),auth=estimate?.authorisation
 let work=''
 if(auth){
  const yes=rev.lines.filter((l:any)=>auth.lineIds.includes(l.id)),no=rev.lines.filter((l:any)=>!auth.lineIds.includes(l.id)),at=`${when(auth.at,undefined,'short')} · ${e(auth.method)}`
  work=`<section class="worksection"><h3>Approved work</h3>${yes.map((l:any)=>line(l,'yes',`Authorized ${at}`)).join('')}${no.length?`<h3>Declined work</h3>${no.map((l:any)=>line(l,'no',`Declined ${at}`)).join('')}`:''}<p class="total">Authorized total <strong>${money(auth.totals.totalCents)}</strong> including ${taxRate(yes)}</p></section>`
 } else if(estimate) work=`<section class="worksection"><div class="section-head"><h3>Estimate, revision ${e(rev.n)}</h3>${status(estimate.status)}</div>${rev.lines.map((l:any)=>line(l,'',`${e(l.quantity)} × ${money(l.unitCents)} before tax`)).join('')}<p class="total">Total <strong>${money(rev.totals.totalCents)}</strong> including ${taxRate(rev.lines)}</p></section>`
 else work='<section class="worksection"><h3>Estimate</h3><p class="muted">No estimate prepared yet.</p></section>'
 const plan=r.plans[0]
 let decide=''
 if(plan){
  const late=plan.plan.endAt>job.endAt
  decide=`<section class="decision"><h3 class="issue">Needs a decision</h3><div class="workrow issue-row"><span class="mark issue" aria-hidden="true"></span><p><span>${e(plan.reason)}</span><small>Prepared by ${e(plan.preparedBy.name)} · ${when(plan.preparedAt,undefined,'short')}</small></p></div>${late?`<div class="risk">${icon('alert')}<p><strong>Finishes after the promised time</strong>Promised ${when(job.endAt,undefined,'short')}; the plan finishes ${when(plan.plan.endAt,undefined,'short')}.</p></div>`:''}<h3>Options</h3><div class="option chosen"><p class="option-top"><strong>Approve the plan</strong><span class="cost">${e(plan.plan.bayId)} · ${e(person(names,plan.plan.technicianId))}</span></p><p>${when(plan.plan.startAt,plan.plan.endAt)}</p></div><div class="option"><p class="option-top"><strong>Keep as is</strong><span class="cost">No change</span></p><p>${e(job.bayId)} · ${e(person(names,job.technicianId))} · ${when(job.startAt,job.endAt,'short')}</p></div>${manager?`<div class="actions">${form('dispatch.approve','',`Apply`,{proposalId:plan.id,version:plan.version})}<a class="button" href="/app?ro=none#board">Keep as is</a></div><p class="muted">Bay and technician availability is checked again when you apply.</p>`:''}</section>`
 } else if(estimate?.status==='draft'&&manager&&!['completed','invoiced'].includes(job.status)) decide=`<section class="decision"><h3>Needs a decision</h3><p class="muted">Prepared by ${e(rev.preparedBy.name)} · ${when(rev.preparedAt,undefined,'short')}. Approve this exact revision before it is shared with ${e(asset?.customerName)}.</p><div class="actions">${form('estimate.approve','','Approve estimate',{estimateId:estimate.id,version:estimate.version,revision:rev.n})}<a class="button" href="/app/jobs/${e(job.id)}">Open repair order</a></div></section>`
 const events=rows(state,'event').filter(v=>v.jobId===job.id).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,3)
 const recent=events.length?`<section class="recent"><h3>Latest on this repair order</h3>${events.map(v=>`<p>${icon('clock')}${when(v.at,undefined,'short')}<span>${e(eventNames[v.kind]??v.kind)} · ${e(v.actor?.name)}</span></p>`).join('')}</section>`:''
 const pill=r.chip[1]?badge(r.chip[0],r.chip[1]):status(job.status)
 return `<aside class="detail${picked?' picked':''}" id="ro" aria-label="Selected repair order"><div class="detail-title"><h2>${nobr(asset?.label)}</h2><a class="close" href="/app?ro=none#board" aria-label="Close">${icon('close')}</a></div><div class="detail-pill">${pill}</div><p class="owner">${e(asset?.customerName)}</p><p class="contact"><span>${icon('car')}${e(asset?.identifier)}</span>${asset?.customerEmail?`<span>${icon('mail')}${e(asset.customerEmail)}</span>`:''}</p><nav class="tabs" aria-label="Repair order"><a aria-current="page" href="/app?ro=${e(job.id)}#ro">Overview</a><a href="/app/jobs/${e(job.id)}">Repair order</a><a href="/app/assets/${e(job.assetId)}">History</a></nav><p class="job-line"><strong>${e(job.title)}</strong>${e(job.bayId)} · ${e(person(names,job.technicianId))} · ${when(job.startAt,job.endAt)}</p>${work}${decide}${recent}</aside>`
}

export function shopBoard(state:any,actor:Actor,names:Names,ro:string|null) {
 const jobs=rows(state,'job'),all=jobs.map(j=>repair(state,j)),open=all.filter(r=>r.column)
 const subtitle=`${open.length} open repair order${open.length===1?'':'s'} <span aria-hidden="true">·</span> ${open.filter(r=>r.column==='bay').length} in the bays`
 if(!open.length){
  const body=`<section class="card empty-board"><img src="/brand/mark.svg" alt="" width="64" height="64"><h2>No open repair orders</h2><p>Add a customer’s vehicle, then book its first visit. Each repair order then moves across the board from booked to ready.</p>${human(actor)?'<a class="button primary" href="/app/customers#add">New repair order</a>':''}${jobs.length?'<p><a href="/app/jobs">See finished repair orders</a></p>':''}</section>${activity(state)}`
  return {subtitle,body,aside:''}
 }
 // ?ro=none closes the panel (its ×, or Keep as is); otherwise the chosen repair order, else the first decision waiting.
 const w=waiting(state),chosen=ro==='none'?undefined:(ro&&all.find(r=>r.job.id===ro))||all.find(r=>r.job.id===w.jobIds[0])
 return {subtitle,body:`${bays(open,names)}${advisor(state)}${board(open,names,chosen?.job.id)}<div class="bottom">${activity(state)}</div>`,aside:chosen?detail(chosen,state,names,actor,!!ro):''}
}
