// PART-006 uses the existing repair forms and advisor queue; these are internal notices, not customer messages.
import {e,field,area,form,box,money,when,rows,select} from './common'
import {human,type Actor} from '../auth'
import {jobEstimates,authorizedCap} from '../supplement-scope'
const etaFields=(part?:any)=>field('Supplier ETA (ISO with timezone)','eta','text',part?.revisions.at(-1).eta??'','required')+area('Supplier acknowledgment evidence','acknowledgment','','required maxlength="4000"')+area('Reason','reason','','required maxlength="2000"')
export function specialPartsPanel(state:any,job:any,actor:Actor){
 if(!human(actor))return ''
 const parts=rows(state,'specialPart').filter(p=>p.jobId===job.id),open=['booked','working'].includes(job.status)
 const choices=jobEstimates(state,job).filter(q=>q.revisions.at(-1).approval&&q.authorisation?.revision===q.revisions.at(-1).n).flatMap(q=>q.revisions.at(-1).lines.filter((l:any)=>l.kind==='part'&&q.authorisation.lineIds.includes(l.id)&&authorizedCap(state,q,l)>job.actuals.filter((a:any)=>a.estimateId===q.id&&a.revision===q.revisions.at(-1).n&&a.lineId===l.id).reduce((n:number,a:any)=>n+a.quantityMilli,0)&&!parts.some(p=>p.estimateId===q.id&&p.revision===q.revisions.at(-1).n&&p.lineId===l.id)).map((l:any)=>[JSON.stringify({estimateId:q.id,revision:q.revisions.at(-1).n,lineId:l.id}),`${l.description} · ${money(l.unitCents)} per unit · revision ${q.revisions.at(-1).n}`] as [string,string]))
 if(!parts.length&&(!open||!choices.length))return ''
 let content='<p>Staff-recorded supplier acknowledgments retain the evidence below; Mallet has not verified the supplier or placed an order. A passed ETA never means a part has arrived. These records link existing approved charges and add no invoice charge.</p>'
 for(const part of parts){
  const revision=part.revisions.at(-1),refs={jobId:job.id,version:job.version,specialPartId:part.id,partVersion:part.version}
  content+=`<article><h3>${e(part.charge.description)}</h3><p>${e(part.supplier)} · order ${e(part.orderReference)}<br>Approved quantity ${e(part.charge.quantity)} × ${money(part.charge.unitCents)} · ${money(part.charge.totalCents)} including frozen tax<br>Estimate <a href="/app/estimates/${e(part.estimateId)}/print">revision ${e(part.revision)}</a> · line ${e(part.lineId)}</p><p>Supplier ETA ${when(revision.eta)} · ${part.receipt?'Physical receipt confirmed':'Waiting for actual arrival'}</p>`
  content+=`<details><summary>Supplier acknowledgment history</summary><ol>${part.revisions.map((r:any)=>`<li>Revision ${e(r.n)} · ETA ${when(r.eta)} · ${e(r.reason)}<br>${e(r.acknowledgment)}<br>Recorded by ${e(r.by.name)} · ${when(r.at)}</li>`).join('')}</ol></details>`
  if(part.receipt)content+=`<p>Received ${e(part.receipt.quantityMilli/1000)} · ${when(part.receipt.receivedAt)} · ${e(part.receipt.reference)}<br>Recorded by ${e(part.receipt.by.name)} · ${when(part.receipt.at)}</p>`
  else if(open)content+=`<details><summary>Update supplier ETA</summary>${form('specialPart.delay',etaFields(part),'Record supplier delay',refs)}</details><details><summary>Record physical receipt</summary>${form('specialPart.receive',field('Physical receipt (ISO with timezone)','receivedAt','text','','required')+area('Receiving reference','receiptReference','','required maxlength="2000"')+'<p>Confirm the full linked quantity was physically received. ETA or acknowledgment alone is not receipt.</p>','Confirm physical receipt',refs)}</details>`
  content+='</article>'
 }
 if(open&&choices.length)content+=`<details><summary>Link a special-order part</summary>${form('specialPart.record',select('Approved part','source',choices)+field('Supplier','supplier','text','','required maxlength="200"')+field('Supplier order reference','orderReference','text','','required maxlength="200"')+etaFields(),'Record special part',{jobId:job.id,version:job.version})}</details>`
 return box('Special-order parts',content,{id:'special-parts'})
}
export function specialPartNotices(state:any,actor:Actor){
 if(!human(actor))return ''
 const notices=rows(state,'specialPartNotice'),parts=rows(state,'specialPart')
 if(!notices.length)return ''
 return box('Special-part notices',`<p>Internal notices for the owner and service advisors. No email or SMS was sent. Review a delay before deciding whether to revise the customer pickup promise.</p>`+notices.map(n=>{const part=parts.find(p=>p.id===n.specialPartId),job=rows(state,'job').find(j=>j.id===n.jobId),r=part?.revisions.find((r:any)=>r.n===n.revision);return `<article><h3><a href="/app/jobs/${e(n.jobId)}#special-parts">${e(job?.title)} · ${e(part?.charge.description)}</a></h3><p>${e(part?.supplier)} · order ${e(part?.orderReference)}<br>${e(n.kind==='backorder'?'Backorder recorded':n.kind==='delay'?'Supplier ETA changed':'Physical receipt recorded')} · ${when(n.at)}<br>Supplier ETA ${when(r?.eta)} · ${e(r?.acknowledgment)}</p>${n.review?`<p>Reviewed by ${e(n.review.by.name)} · ${when(n.review.at)} · ${e(n.review.reason)}</p>`:form('specialPart.review',area('Review note','reason','','required maxlength="2000"'),'Mark reviewed',{noticeId:n.id,version:n.version})}</article>`}).join(''),{id:'special-part-notices'})
}
