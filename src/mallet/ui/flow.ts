// FLOW-001 on the repair order: its board stage, priority, blockers, and the closure or collection people record.
import {e,field,select,form,box,badge,when} from './common'
import {boardCard,flowRecord,priorities,stages,COLLECTION_LABEL} from '../flow'
import {human,type Actor} from '../auth'

export function flowPanel(state:any,job:any,actor:Actor) {
 const c=boardCard(state,job,new Date().toISOString()),flow=flowRecord(state,job.id),manager=human(actor),open=['booked','working'].includes(job.status)
 const stage=stages.find(([id])=>id===c.stage)![1],invoice=(state.records.invoice??[]).find((i:any)=>i.jobId===job.id)
 let body=`<p><strong>Stage: ${e(stage)}</strong> · Priority: ${e(c.priority)}${c.due.kind==='promise'?` · Customer promise ${when(c.due.at,undefined,'short')}`:` · Booked until ${when(c.due.at,undefined,'short')}`}</p>`
 body+=c.blockers.length?`<h3>Blockers</h3><ul class="list">${c.blockers.map(b=>`<li class="plain">${e(b)}</li>`).join('')}</ul>`:'<p class="muted">Nothing is holding this repair.</p>'
 if(job.closure)body+=`<p>${badge(job.status==='lost'?'Lost':'Canceled')} at ${e(stages.find(([id])=>id===job.closure.stage)?.[1]??job.closure.stage)} by ${e(job.closure.by.name)} · ${when(job.closure.at,undefined,'short')}</p><p>${e(job.closure.reason)}</p>`
 if(flow?.collection)body+=`<h3>Collection</h3><p>Collected by ${e(flow.collection.collectorName)} · recorded by ${e(flow.collection.by.name)} · ${when(flow.collection.at,undefined,'short')} · invoice ${e(flow.collection.invoiceNumber)} (${e(flow.collection.invoiceStatus)})</p>${flow.collection.note?`<p>${e(flow.collection.note)}</p>`:''}<p class="muted">${e(COLLECTION_LABEL)}</p>`
 if(manager&&open)body+=`<details><summary>Change priority</summary>${form('flow.priority',select('Priority','priority',priorities.map(p=>[p,p[0].toUpperCase()+p.slice(1)] as [string,string]),c.priority)+field('Why','reason','text','','required maxlength="2000"'),'Save priority',{jobId:job.id,version:job.version,flowVersion:flow?.version??0})}</details>`
 if(manager&&open&&!job.actuals.length)body+=`<details><summary>Cancel or mark lost</summary>${form('flow.close',select('Outcome','outcome',[['canceled','Canceled visit'],['lost','Lost: customer took the work elsewhere or declined']])+field('Reason','reason','text','','required maxlength="2000"')+'<p class="muted">The repair order, its estimates and history are kept and shown under Closed. Its bay and technician time is freed.</p>','Close repair order',{jobId:job.id,version:job.version},'danger')}</details>`
 if(manager&&['completed','invoiced'].includes(job.status)&&!flow?.collection&&invoice&&['approved','exported'].includes(invoice.status))body+=form('flow.collect',field('Collected by','collectorName','text','','required maxlength="200"')+field('Note','note','text','','maxlength="2000"')+`<p class="muted">${e(COLLECTION_LABEL)}</p>`,'Record collection',{jobId:job.id,version:job.version,flowVersion:flow?.version??0})
 return box('Board',body,{id:'flow',pill:badge(stage)})
}
