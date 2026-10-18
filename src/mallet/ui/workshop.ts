import {e,field,select,form,box,rows,badge,status,join,when,person,initials,type Names} from './common'
import {repair} from './repair'
import {human,type Actor} from '../auth'

// A dense table that becomes stacked rows on phones; each cell carries its column name for that layout.
const table=(head:string[],body:string[][],extra='')=>`<div class="table${extra?` ${extra}`:''}"><table><thead><tr>${head.map(h=>`<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${body.map(cells=>`<tr>${cells.map((c,i)=>`<td data-label="${e(head[i])}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
const empty=(text:string,action='')=>`<div class="empty"><img src="/brand/mark.svg" alt="" width="56" height="56"><p>${text}</p>${action}</div>`

// Every repair order: open ones by start time first, then invoiced visits, most recent first.
export function repairOrders(state:any,names:Names) {
 const jobs=rows(state,'job'),open=(j:any)=>j.status!=='invoiced'
 const ordered=[...jobs].sort((a,b)=>open(a)!==open(b)?(open(a)?-1:1):open(a)?a.startAt.localeCompare(b.startAt):b.startAt.localeCompare(a.startAt))
 if(!jobs.length)return box('Repair orders',empty('No repair orders yet. Add a customer’s vehicle, then book its first visit.','<a class="button primary" href="/app/customers#add">New repair order</a>'))
 return `<section class="card flush">${table(['Repair','Vehicle','Customer','Bay','Technician','Booked for','Status'],ordered.map(j=>{const r=repair(state,j),tech=person(names,j.technicianId);return [`<a class="strong" href="/app/jobs/${e(j.id)}">${e(j.title)}</a>`,e(r.asset?.label),e(r.asset?.customerName),e(j.bayId),`<span class="tech"><span class="avatar" aria-hidden="true">${e(initials(tech))}</span>${e(tech)}</span>`,when(j.startAt,undefined,'short'),r.column?badge(r.chip[0],r.chip[1]):status(j.status)]}),'orders')}</section>`
}

// The customer register: every vehicle, bicycle or device with its owner and visits, and the form that starts a repair order.
export function customers(state:any,actor:Actor) {
 const assets=[...rows(state,'asset')].sort((a,b)=>a.customerName.localeCompare(b.customerName)||a.label.localeCompare(b.label))
 const list=assets.length?`<section class="card flush">${table(['Customer','Vehicle or device','Plate, VIN or serial','Visits'],assets.map(a=>[`<span class="strong">${e(a.customerName)}</span><small>${e(a.customerEmail)}</small>`,`<a class="strong" href="/app/assets/${e(a.id)}">${e(a.label)}</a>`,`<span class="mono">${e(a.identifier)}</span>`,`${a.visits?.length??0}`]),'register')}</section>`:box('Customers',empty('Your register of customers’ vehicles, bicycles and devices starts here.'))
 const add=human(actor)?box('New repair order',`<p class="muted">Step 1 of 2: add the customer’s vehicle or device. You book its visit on the next screen.</p>${form('asset.create',`<div class="fields">${field('Customer name','customerName','text','','required maxlength="120"')+field('Customer email','customerEmail','email','')+field('Vehicle or device','label','text','','required placeholder="2019 Honda CR-V EX"')+field('Plate, VIN or serial','identifier','text','','required')}</div>`,'Add vehicle')}`,{id:'add'}):''
 return `<div class="grid wide-left"><div class="col">${list}</div><div class="col">${add}</div></div>`
}

// Exact-revision decisions a person made on prepared work.
export function approvals(state:any) {
 const jobs=rows(state,'job'),list=rows(state,'approval').sort((a,b)=>b.at.localeCompare(a.at))
 const label=(a:any)=>{const subject=rows(state,a.subjectKind).find(x=>x.id===a.subjectId),job=jobs.find(j=>j.id===subject?.jobId);return [a.subjectKind==='proposal'?'Dispatch plan':a.subjectKind==='invoice'?'Invoice':'Estimate',job]}
 if(!list.length)return box('Approval record',empty('Exact-revision decisions appear here when a person approves prepared work.'))
 return `<section class="card flush">${table(['Decision','Repair order','Revision','Prepared by','Approved by','When'],list.map(a=>{const [kind,job]=label(a);return [`<span class="strong">${e(kind)}</span>`,job?`<a href="/app/jobs/${e(job.id)}">${e(job.title)}</a><small>${e(job.asset?.label)}</small>`:'Repair job',e(a.revision),`${e(a.preparedBy.name)}<small>${e(a.preparedBy.role)}</small>`,e(a.approvedBy.name),when(a.at,undefined,'short')]}),'decisions')}</section>`
}

// operators: the active people a visit can be assigned to; prefill: the booking-form values to restore after a refused booking.
export function assetPage(state:any,id:string,actor:Actor,names:Names,operators:{id:string,name:string,role:string,status:string}[],prefill:Record<string,string>={}) {
 const a=rows(state,'asset').find(x=>x.id===id);if(!a)return null
 const jobs=rows(state,'job').filter(j=>j.assetId===id)
 const visits=jobs.length?`<ul class="list">${jobs.map(j=>{const r=repair(state,j);return `<li><a class="row" href="/app/jobs/${e(j.id)}"><span class="row-title"><span class="row-name">${e(j.title)}</span>${r.column?badge(r.chip[0],r.chip[1]):status(j.status)}</span><span class="row-meta">${when(j.startAt)} · ${join(j.bayId,person(names,j.technicianId))}</span></a></li>`}).join('')}</ul>`:'<p class="muted">No visits recorded.</p>'
 const erase=actor.role==='owner' && !jobs.length?box('Erase unused vehicle',`<p>This removes this unused vehicle and its imported personal data. Backups made before erasing still hold it and are refused on restore, so download a fresh backup afterwards. Vehicles with visits retain their service and financial records.</p>${form('asset.erase',field('Type ERASE to confirm','confirm','text','','required'),'Erase unused asset',{assetId:a.id},'danger')}`):''
 const chosen=prefill.technicianId??actor.id,people:[string,string][]=operators.map(o=>[o.id,`${o.name} (${o.role}${o.status==='invited'?', invited':''})`])
 if(chosen&&!operators.some(o=>o.id===chosen))people.unshift([chosen,person(names,chosen)])
 const book=human(actor)?box('Book in a visit',form('job.book',field('Repair request','title','text',prefill.title,'required')+`<div class="fields">${field('Bay','bayId','text',prefill.bayId??'Bay 1','required')}${select('Technician','technicianId',people,chosen)}${field('Start (with timezone)','startAt','text',prefill.startAt,'required placeholder="2026-10-19T09:00:00-04:00"')}${field('End (with timezone)','endAt','text',prefill.endAt,'required')}</div><p class="muted">Technicians are the shop’s people, including those invited who have not yet signed in. Use ISO times with a UTC offset, for example 2026-10-19T09:00:00-04:00 (Eastern daylight time, March to November) or -05:00 (Eastern standard time). Times are shown in this browser’s timezone, with its name. Overlapping bays or technicians are refused.</p>`,'Book visit',{assetId:a.id,version:a.version}),{id:'book'}):''
 return {title:a.label,subtitle:`${join(a.customerName,a.identifier,a.customerEmail)}`,body:`<div class="grid"><div class="col">${box('Every visit',`${visits}<p class="card-foot"><a href="/api/mallet/assets/${e(a.id)}/history.csv">Download service history CSV</a></p>`)}${erase}</div><div class="col">${book}</div></div>`}
}
