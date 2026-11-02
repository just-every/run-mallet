import {e,field,area,form,box,money,when,select} from './common'
import {human,type Actor} from '../auth'
import {jobSublets,subletBill,subletMargin,subletScopeChoices} from '../sublet'
import {qualityStatus} from '../quality'
const dollars=(label:string)=>field(label,'costUsd','number','','required min="0" max="10000000" step="0.01"')
const reason=()=>area('Reason','reason','','required maxlength="2000"')
const eta=()=>field('Supplier ETA (ISO with timezone)','eta','text','','required')+area('Supplier evidence','evidence','','required maxlength="2000"')
export function subletFormInput(data:FormData,input:any){
 if(!input.command.startsWith('sublet.'))return input
 if(input.subletVersion!==undefined)input.subletVersion=Number(input.subletVersion)
 if(input.costUsd!==undefined)input.costCents=Math.round(Number(input.costUsd)*100)
 if(input.source){let source:any;try{source=JSON.parse(input.source)}catch{throw new Error('INVALID_SUBLET_SOURCE')};input.estimateId=source.estimateId;input.revision=source.revision;input.lineId=source.lineId}
 return input
}
export function subletPanel(state:any,job:any,actor:Actor){
 if(!human(actor))return ''
 const sublets=jobSublets(state,job.id),open=['booked','working'].includes(job.status),choices=subletScopeChoices(state,job).map(x=>[JSON.stringify({estimateId:x.estimateId,revision:x.revision,lineId:x.lineId}),`${x.line.description} · ${money(x.line.subtotalCents)} before tax`] as [string,string])
 if(!open&&!sublets.length)return ''
 let content='<p>Link an approved service fee from the estimate or an incremental supplement. Its customer price and selected tax treatment stay frozen. These records track staff-reported supplier evidence; they do not send orders, pay bills or post to the books.</p>'
 for(const r of sublets){
  const refs={jobId:job.id,version:job.version,subletId:r.id,subletVersion:r.version},margin=subletMargin(r),bill=subletBill(r),last=r.custody.at(-1),sent=r.custody.some((x:any)=>x.kind==='sent'),clear=!!r.receipt&&qualityStatus(state,job).ready
  content+=`<article data-sublet="${e(r.id)}"><h3>${e(r.item)}</h3><p>${e(r.supplier)} · PO ${e(r.poReference)}</p><p><strong>${r.receipt?'Received at shop':sent?'In outside custody':'In shop custody'}</strong> · ${e(last.custodian)}<br>Supplier ETA ${when(r.etaHistory.at(-1).eta)}<br>${clear?'Current repair quality clearance recorded':r.receipt?'Repair quality sign-off required':'Receiving required before quality clearance'}</p>`
  content+=`<ul class="list"><li class="plain split"><span class="row-name">Authorized customer price before tax</span><span class="row-meta">${money(margin.customerCents)}</span></li><li class="plain split"><span class="row-name">Frozen customer sales tax</span><span class="row-meta">${money(margin.salesTaxCents)}</span></li><li class="plain split"><span class="row-name">Quoted supplier cost</span><span class="row-meta">${money(margin.quotedCostCents)}</span></li><li class="plain split"><span class="row-name">Supplier bill total cost</span><span class="row-meta">${bill?`${money(bill.costCents)} · ${e(bill.reference)}`:'Pending bill for current scope'}</span></li><li class="plain split"><span class="row-name">Sublet margin before customer sales tax</span><span class="row-meta">${margin.marginCents===null?'Pending current supplier bill':`${money(margin.marginCents)}${margin.marginPercent===null?'':` · ${e(margin.marginPercent)}%`}`}</span></li></ul><p class="muted">Margin is authorized customer price before tax less the full recorded supplier bill, in USD. It includes supplier tax/freight in that bill; it is not payment or accounting reconciliation.</p>`
  content+=`<details><summary>Approved sublet scope</summary><ol>${r.scopes.map((x:any)=>`<li>${e(x.charge.description)} · ${money(x.charge.subtotalCents)} before tax · quoted cost ${money(x.costCents)}<br><a href="/app/estimates/${e(x.estimateId)}/print">Estimate revision ${e(x.revision)}</a> · ${e(x.customerDecision.customerName)} · ${e(x.customerDecision.method)} · ${when(x.customerDecision.at)}<br>${e(x.reason)} · recorded by ${e(x.by.name)} · ${when(x.at)}</li>`).join('')}</ol></details>`
  content+=`<details><summary>Custody history</summary><ol>${r.custody.map((x:any)=>`<li>${e(x.kind==='sent'?'Outside handoff':x.kind==='received'?'Physical return received':'Shop custody')} · ${e(x.custodian)}${x.handedTo?` · handed to ${e(x.handedTo)}`:''}${x.handedBy?` · returned by ${e(x.handedBy)}`:''}<br>${when(x.observedAt??x.at)} · ${e(x.reference)}<br>Recorded by ${e(x.by.name)} · ${when(x.at)}</li>`).join('')}</ol></details>`
  content+=`<details><summary>Supplier ETA history</summary><ol>${r.etaHistory.map((x:any)=>`<li>ETA ${when(x.eta)} · ${e(x.evidence)}<br>${e(x.reason)} · ${e(x.by.name)} · ${when(x.at)}</li>`).join('')}</ol></details>`
  if(r.bills.length)content+=`<details><summary>Supplier bill history</summary><ol>${r.bills.map((x:any)=>`<li>${e(x.reference)} · ${money(x.costCents)} · ${e(x.scopeCount)} approved scope item(s)<br>${e(x.evidence)} · ${e(x.reason)}<br>${e(x.by.name)} · ${when(x.at)}</li>`).join('')}</ol></details>`
  if(open){
   if(!r.receipt){
    if(choices.length)content+=`<details><summary>Link approved added scope</summary>${form('sublet.addScope',select('Newly authorized service','source',choices)+dollars('Added quoted supplier cost (USD)')+reason()+'<p>First obtain a separate customer decision through the estimate supplement. A changed scope needs a current supplier bill and new quality clearance.</p>','Link added scope',refs)}</details>`
    if(!sent)content+=`<details><summary>Record outside handoff</summary>${form('sublet.send',field('Outside receiver','handedTo','text','','required')+field('Outside handoff time (ISO with timezone)','observedAt','text','','required')+area('Dispatch reference','reference','','required maxlength="2000"'),'Record outside handoff',refs)}</details>`
    content+=`<details><summary>Record delayed return</summary>${form('sublet.delay',eta()+reason(),'Record delayed return',refs)}</details>`
    if(sent)content+=`<details><summary>Receive outsourced work</summary>${form('sublet.receive',field('Shop custodian','custodian','text','','required')+field('Returning supplier or carrier','handedBy','text','','required')+field('Physical receipt time (ISO with timezone)','observedAt','text','','required')+area('Receiving evidence','reference','','required maxlength="2000"')+'<p>Confirm the whole approved scope and item physically returned. Then record the authorized actual work and complete the repair quality checks.</p>','Confirm sublet receipt',refs)}</details>`
   }
   if(sent)content+=`<details><summary>${bill?'Revise supplier bill':'Record supplier bill'}</summary>${form('sublet.bill',field('Supplier invoice number','billReference','text','','required')+dollars('Full supplier bill cost (USD)')+area('Supplier bill evidence','evidence','','required maxlength="2000"')+reason()+'<p>Enter the full bill for all current scope, including supplier tax and freight. Earlier bill entries are retained. No payment is recorded.</p>','Record supplier bill',refs)}</details>`
  }
  content+='</article>'
 }
 if(open&&choices.length)content+=`<details><summary>Track outsourced work</summary>${form('sublet.record',select('Authorized service','source',choices)+field('Supplier','supplier','text','','required maxlength="200"')+field('Sublet PO reference','poReference','text','','required maxlength="200"')+field('Item in custody','item','text','','required maxlength="500"')+field('Shop custodian','custodian','text','','required maxlength="200"')+dollars('Quoted supplier cost (USD)')+eta()+reason(),'Record approved sublet',{jobId:job.id,version:job.version})}</details>`
 else if(open)content+='<p>Prepare and authorize a service fee on this repair to track new outsourced work.</p>'
 return box('Sublet work',content,{id:'sublets'})
}
