import {reservedWorkFields} from './inventory'
import {invoiceBalance} from '../payments'
import {diagnosticResultsPanel} from './diagnostic-results'
import {assetDetails} from './asset-types'
import {subletPanel} from './sublet'
import {specialPartsPanel} from './special-parts'
import {promisePanel} from './promises'
import {timePanel} from './time'
import {inspectionPanel} from './inspections'
import {estimateCard,supplementForms} from './estimates'
import {jobEstimates,authorizedCap} from '../supplement-scope'
import {qualityPanel} from './quality'
import {declinedPanel} from './declined-work'
import {mileagePanel} from './mileage'
import {inspectionReportPanel} from './inspection-reports'
import {diagnosisPanel} from './diagnostics'
import {approvalLinksPanel} from './approval'
import {collaborationPanel} from './collaboration'
import {flowPanel} from './flow'
import {e,field,area,form,box,rows,badge,status,money,join,when,person,role,type Names} from './common'
import {eventNames} from './repair'
import {human,type Actor} from '../auth'
import {taxNotice,taxSummary,invoiceTotals,lineTax} from './tax'
export function jobPage(state:any,id:string,actor:Actor,names:Names,photos:any[]=[],media:any[]=[],people:any[]=[]) {
 const job=rows(state,'job').find(j=>j.id===id);if(!job)return null
 const asset=rows(state,'asset').find(a=>a.id===job.assetId),estimate=rows(state,'estimate').find(q=>q.id===job.estimateId),invoice=rows(state,'invoice').find(q=>q.jobId===id)
 const rev=estimate?.revisions?.at(-1),ir=invoice?.revisions?.at(-1),manager=human(actor)
 const lines=rev?.lines??[]
 const quotes=jobEstimates(state,job)
 let work=(job.actuals??[]).length?`<ul class="list">${job.actuals.map((w:any)=>{const source=quotes.find(q=>q.id===w.estimateId),line=source?.revisions.find((r:any)=>r.n===w.revision)?.lines.find((l:any)=>l.id===w.lineId);return `<li class="plain split"><span class="row-name">${e(line?.description)}${source?.supplementOf?` · supplement ${e(source.sequence)}`:''}</span><span class="row-meta">${join(w.quantity,w.by?.name??w.recordedBy?.name)} · revision ${e(w.revision)}</span></li>`}).join('')}</ul>`:'<p>No parts or labor recorded yet.</p>'
 if(!['completed','invoiced'].includes(job.status)&&actor.role!=='agent')for(const q of quotes) {
  const r=q.revisions.at(-1),available=r.lines.filter((l:any)=>q.authorisation?.lineIds.includes(l.id)).map((l:any)=>({l,remaining:authorizedCap(state,q,l)-job.actuals.filter((a:any)=>a.estimateId===q.id&&a.revision===r.n&&a.lineId===l.id).reduce((n:number,a:any)=>n+a.quantityMilli,0)})).filter((x:any)=>x.remaining>0)
  if(q.status==='authorised'&&available.length)work+=`${q.supplementOf?`<h3>Supplement ${e(q.sequence)}</h3>`:''}${form('work.record',`<label>Authorized item<select name="lineId">${available.map(({l,remaining}:any)=>`<option value="${e(l.id)}">${e(l.description)} (${e(remaining/1000)} remaining)</option>`).join('')}</select></label>${field('Quantity used / hours worked','quantity','number','1','required min="0.001" step="0.001"')}${field('Work note','note')}${manager?reservedWorkFields(state,id):''}`,'Record parts or labor',{jobId:id,version:job.version,estimateId:q.id,revision:r.n})}`
 }
 if(manager&&job.actuals.length&&!['completed','invoiced'].includes(job.status))work+=form('job.complete','<p>Complete when the repair is ready to hand over. Invoice preparation uses the recorded work.</p>','Complete repair',{jobId:id,version:job.version})
 let bill=invoice?`<p class="number">${e(invoice.number)}</p><ul class="list">${invoice.lines.map((l:any)=>`<li class="plain"><span class="row-name">${e(l.description)}</span><span class="row-meta">${e(l.quantity)} × ${money(l.unitCents-(l.unitDiscountCents??0))} before tax · ${money(l.totalCents)} with tax · ${lineTax(l)}${l.sourceEstimateId?` · ${l.sourceEstimateId===job.estimateId?'Original estimate':'Supplement '+e(quotes.find(q=>q.id===l.sourceEstimateId)?.sequence)} · revision ${e(l.sourceRevision)}`:''}</span></li>`).join('')}</ul>${invoiceTotals(invoice.totals)}<p class="muted">Prepared by ${e(invoice.preparedBy.name)} (${e(role(invoice.preparedBy.role))})${invoice.approval?` · Approved by ${e(invoice.approval.by.name)}`:''}</p>`:job.status==='completed'?'<p>Prepare the invoice from the recorded work.</p>':'<p>Complete the repair to prepare its invoice.</p>'
 if(manager && job.status==='completed' && !invoice) bill+=form('invoice.prepare','','Prepare invoice',{jobId:id,version:job.version})
 if(manager && invoice?.status==='draft') bill+=form('invoice.approve','<p>Approve the exact invoice prepared from recorded, authorized work.</p>','Approve invoice',{invoiceId:invoice.id,version:invoice.version,revision:ir?.n??1})
 if(manager && invoice?.status==='approved') bill+=form('invoice.export','<p>Export once for your accounting software. Subsequent downloads use the saved file.</p>','Export invoice once',{invoiceId:invoice.id,version:invoice.version})
 if(manager&&invoice){const balance=invoiceBalance(state,invoice);bill+=`<p data-invoice-balance>Credits ${money(balance.creditedCents)} · Recorded tender net of refunds and account credit ${money(balance.paidCents)} · <strong>Balance due ${money(balance.outstandingCents)}</strong></p><p class="muted">Recorded tender is an allocation, not proof of cleared funds. The original invoice subtotal and tax stay unchanged.</p>`}
 if(actor.role==='owner'&&invoice&&invoice.status!=='draft')bill+=`<p><a href="/app/invoices/${e(invoice.id)}">Issue, print and email invoice copies</a></p>`
 const exp=rows(state,'export').find(x=>x.invoiceId===invoice?.id)
 if(manager && exp) bill+=`<p><a href="/api/mallet/exports/${e(exp.id)}">Download saved invoice CSV</a></p>`
 const events=rows(state,'event').filter(v=>v.jobId===id).sort((a,b)=>a.at.localeCompare(b.at))
 const proposals=rows(state,'proposal').filter(p=>p.jobId===id&&p.status==='pending')
 const dispatch=manager&&proposals.length?box('Prepared dispatch plans',proposals.map(p=>`<p>${e(p.preparedBy.name)}: ${e(p.reason)}</p><dl><dt>Bay</dt><dd>${e(p.plan.bayId)}</dd><dt>Technician</dt><dd>${e(person(names,p.plan.technicianId))}</dd><dt>Start</dt><dd>${when(p.plan.startAt)}</dd><dt>End</dt><dd>${when(p.plan.endAt)}</dd></dl>${form('dispatch.approve','<p>Current bay and technician availability will be checked again.</p>','Approve dispatch plan',{proposalId:p.id,version:p.version})}`).join('')):''
 return {title:job.title,subtitle:`<a href="/app/assets/${e(asset?.id)}">${e(asset?.label)}</a> · ${join(asset?.identifier,asset?.customerName,job.bayId,person(names,job.technicianId))} · ${when(job.startAt,job.endAt)} ${status(job.status)}`,body:`${actor.role==='owner'?`<p><a href="/app/jobs/${e(id)}/notifications">Status & pickup notices</a> · <a href="/app/jobs/${e(id)}/storage">Storage & repair lien</a></p>`:''}${assetDetails(job.asset)}${taxNotice(state,actor)}${actor.role!=='agent'?`<p><a href="/app/jobs/${e(id)}/media">Inspection photos & video</a></p>`:''}${manager?`<p><a href="/app/jobs/${e(id)}/intake">Condition & custody receipts</a> · <a href="/app/jobs/${e(id)}/warranty">Warranty & comeback work</a> · <a href="/app/jobs/${e(id)}/blockers">Source-cited blockers</a></p>`:''}<div class="grid"><div class="col">${quotes.length?quotes.map(q=>estimateCard(state,job,asset,q,actor)).join(''):estimateCard(state,job,asset,null,actor)}${supplementForms(state,job,actor)}${manager?approvalLinksPanel(state,job,quotes):''}${box('Parts & labor',work)}${diagnosisPanel(state,job,actor,media)}${diagnosticResultsPanel(state,job,actor)}${inspectionReportPanel(state,job,actor,media)}${timePanel(state,actor,names,job)}${inspectionPanel(state,job,actor,photos)}${qualityPanel(state,job,actor)}${mileagePanel(state,job,actor)}${declinedPanel(state,job,actor,people)}</div><div class="col">${flowPanel(state,job,actor)}${actor.role!=='agent'?collaborationPanel(state,job,actor,names,people,media):''}${subletPanel(state,job,actor)}${specialPartsPanel(state,job,actor)}${promisePanel(state,job,actor,names)}${dispatch}${box('Handover invoice',bill,{pill:invoice?status(invoice.status):''})}${box('Visit history',`<ul class="list events">${events.map(v=>`<li class="plain split"><span class="row-name">${e(eventNames[v.kind]??v.kind)}${v.data?.revision?` · revision ${e(v.data.revision)}`:''}${v.data?.totals?` · ${money(v.data.totals.totalCents)}`:''}</span><span class="row-meta">${when(v.at??v.createdAt)} · ${e(v.by?.name??v.actor?.name)}</span></li>`).join('')}</ul>`)}</div></div>`}
}
