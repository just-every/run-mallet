import {area,box,e,field,form,money,rows,select,when} from './common'
import {warrantyPatternPanel} from './warranty-patterns'
import {warrantyPacket} from '../warranty-patterns'
import {invoiceBalance} from '../payments'
export function warrantyFormInput(input:any){
 if(!input.command.startsWith('warranty.')&&input.command!=='payment.record')return
 for(const name of ['assetVersion','mileage','mileageLimit','creditCents'])if(input[name]!==undefined)input[name]=Number(input[name])
 if(input.amountUsd!==undefined)input.amountCents=Math.round(Number(input.amountUsd)*100)
 if(input.creditUsd!==undefined)input.creditCents=Math.round(Number(input.creditUsd)*100)
}
const note=()=>area('Evidence','evidence','','required maxlength="2000"')
export function warrantyPage(s:any,job:any,people:any[],owner=false){
 const invoice=rows(s,'invoice').find(i=>i.jobId===job.id),cases=rows(s,'warranty').filter(w=>w.jobId===job.id||w.originalJobId===job.id),asset=rows(s,'asset').find(a=>a.id===job.assetId)
 const coverageLink=owner?'<p><a href="/app/jobs/'+e(job.id)+'/coverage">Coverage review register</a></p>':''
 let body=coverageLink+`<p><a href="/app/jobs/${e(job.id)}">Back to repair</a> · ${e(job.asset.label)} · ${e(job.asset.identifier)}</p><p>Coverage and responsibility are shop decisions against saved terms. Supplier and OEM warranties are not provider-verified. Rework needs its own customer-authorized estimate; a claim record does not submit a claim, post a ledger entry or change the original repair.</p>`
 if(invoice&&['approved','exported'].includes(invoice.status)){
  const balance=invoiceBalance(s,invoice)
  body+=box('Original invoice & tender',`<p>${e(invoice.number)} · Total ${money(balance.totalCents)} · Recorded tender ${money(balance.paidCents)} · Outstanding ${money(balance.outstandingCents)}</p><p>Staff-recorded tender is not processor-verified settlement.</p>${balance.outstandingCents?form('payment.record',field('Amount (USD)','amountUsd','number',balance.outstandingCents/100,'required min="0.01" step="0.01"')+select('Tender','method',[['cash','Cash'],['check','Paper check'],['other','Other manual tender']])+field('Unique tender reference','reference','text','','required')+note(),'Record tender evidence',{invoiceId:invoice.id,version:invoice.version,jobId:job.id}):''}`)
  body+=box('Warranty terms',form('warranty.terms',field('Coverage starts (with timezone)','startsAt','text',invoice.preparedAt,'required')+field('Coverage ends (with timezone)','endsAt','text',new Date(Date.now()+365*86400000).toISOString(),'required')+field('Absolute covered mileage / hours limit','mileageLimit','number',100000,'required min="0" step="1"')+select('Coverage reading unit','unit',[['mi','Miles'],['km','Kilometers'],['hours','Hours']])+area('Exact warranty scope, exclusions and advice','terms','','required maxlength="4000"'),'Save warranty terms',{invoiceId:invoice.id,version:invoice.version,jobId:job.id}))
  for(const t of rows(s,'warrantyTerms').filter(t=>t.invoiceId===invoice.id).sort((a,b)=>b.n-a.n)){
   const installed=rows(s,'stockUse').filter(u=>u.jobId===job.id)
   body+=box(`Saved terms ${t.n}`,`<p>${e(t.terms)}</p><p>${when(t.startsAt)} through ${when(t.endsAt)} inclusive · up to ${e(t.mileageLimit)} ${e(t.unit)}</p><details><summary>Open a linked comeback</summary>${form('warranty.open',field('Returned symptom and failure evidence','failure','text','','required maxlength="4000"')+field('Failure time (with timezone)','failureAt','text',new Date().toISOString(),'required')+field('Failure mileage / hours','mileage','number',0,'required min="0" step="1"')+select('Installed part / lot','stockUseId',[['','No tracked installed part'],...installed.map(u=>{const lot=rows(s,'stockLot').find(l=>l.id===u.lotId);return [u.id,`${lot?.catalog?.name??'Installed part'} · ${lot?.supplier??''} · lot ${lot?.supplierLot??''}${lot?.serial?' · serial '+lot.serial:''} · ${u.quantityMilli/1000} installed`] as [string,string]})])+field('Rework title','title','text','Warranty comeback','required')+field('Bay','bayId','text',job.bayId,'required')+select('Technician','technicianId',people.filter(p=>p.status==='active').map(p=>[p.id,p.name] as [string,string]))+field('Rework starts (with timezone)','startAt','text',new Date(Date.now()+3600000).toISOString(),'required')+field('Rework ends (with timezone)','endAt','text',new Date(Date.now()+7200000).toISOString(),'required'),'Open rework repair',{jobId:job.id,termsId:t.id,assetId:asset.id,assetVersion:asset.version})}</details>`)
  }
 }
 for(const w of cases){
  const cost=w.costs.reduce((n:number,x:any)=>n+x.amountCents,0),credited=w.claims.flatMap((c:any)=>c.history).reduce((n:number,x:any)=>n+x.creditCents,0),rework=rows(s,'job').find(j=>j.id===w.jobId)
  const packet=warrantyPacket(s,w.id)
  let content=`<p><a href="/app/jobs/${e(w.originalJobId)}">Original ${e(w.originalInvoice.number)}</a> · <a href="/app/jobs/${e(w.jobId)}">Linked rework repair</a> · <a href="/app/jobs/${e(w.jobId)}/warranty">Rework coverage & costs</a></p><p>VIN / serial ${e(w.identifier)} · ${e(w.failure)} · ${when(w.failureAt)} · ${e(w.mileage)} ${e(w.unit)}</p><p>${e(w.terms.terms)} · ${w.withinTerms?'Within saved time and mileage bounds':'Outside saved time or mileage bounds'}</p>${w.installed?`<p>Installed lot ${e(w.lot.supplierLot)} · serial ${e(w.lot.serial||'None')} · supplier ${e(w.lot.supplier)} · original cost ${money(w.installed.costCents)}</p>`:'<p>No tracked installed part on the original repair.</p>'}<p>Rework cost ${money(cost)} · supplier credits recorded ${money(credited)} · net comeback cost ${money(cost-credited)}. Reporting records only.</p>`
  content+=warrantyPatternPanel(packet,w,job.id)
  if(!w.decision)content+=form('warranty.decide',select('Coverage decision','outcome',[['covered','Covered — separately authorized labor is no charge'],['declined','Declined']])+select('Responsibility','responsibility',[['shop','Shop'],['supplier','Supplier'],['OEM','OEM']])+area('Decision reason and evidence','reason','','required'),'Record coverage decision',{jobId:job.id,warrantyId:w.id,version:w.version})
  else content+=`<p>${e(w.decision.outcome)} · ${e(w.decision.responsibility)} responsibility · ${e(w.decision.reason)} · ${e(w.decision.by.name)} · ${when(w.decision.at)}</p>`
  if(w.decision?.outcome==='covered'){
   const sourceLine=(a:any)=>rows(s,'estimate').find(q=>q.id===a.estimateId)?.revisions.find((r:any)=>r.n===a.revision)?.lines.find((l:any)=>l.id===a.lineId)
   const available=rework.actuals.filter((a:any)=>{const line=sourceLine(a);return line&&line.unitCents-(line.unitDiscountCents??0)===0&&!w.costs.some((x:any)=>x.actualId===a.id)})
   if(available.length)content+=form('warranty.cost',select('Authorized no-charge actual','actualId',available.map((a:any)=>[a.id,`${sourceLine(a).description} · ${a.quantity} · ${sourceLine(a).kind}`] as [string,string]))+field('Actual rework cost (USD)','amountUsd','number',0,'required min="0" step="0.01"')+note(),'Record rework cost',{jobId:job.id,warrantyId:w.id,version:w.version})
   content+=`<ul>${w.costs.map((x:any)=>`<li>${e(x.kind)} · ${money(x.amountCents)} · ${e(x.evidence)}</li>`).join('')}</ul>`
   const remainingClaimCents=cost-w.claims.reduce((n:number,c:any)=>n+c.amountCents,0)
   if(w.decision.responsibility!=='shop'&&remainingClaimCents>0)content+=form('warranty.claim',field('Supplier or OEM','claimant','text','','required')+field('Unique claim reference','reference','text','','required')+field('Claim amount (USD)','amountUsd','number',remainingClaimCents/100,'required min="0.01" step="0.01"')+note(),'Approve claim record',{jobId:job.id,warrantyId:w.id,version:w.version,sourceKey:packet.sourceKey})
  }
  for(const c of w.claims)content+=`<h3>${e(c.claimant)} · ${e(c.reference)} · ${money(c.amountCents)} · ${e(c.status)}</h3><p>${e(c.label)}</p><ul>${c.history.map((x:any)=>`<li>${e(x.status)} · ${e(x.evidence)}${x.creditCents?' · '+money(x.creditCents):''} · ${when(x.at)}</li>`).join('')}</ul>${!['credited','rejected'].includes(c.status)?form('warranty.claimOutcome',select('Recorded external outcome','status',[['submitted','Submitted outside Mallet'],['accepted','Accepted by supplier/OEM'],['rejected','Rejected'],['credited','Credit received']])+field('Supplier credit (USD; only for credit received)','creditUsd','number',0,'min="0" step="0.01"')+note(),'Record external claim evidence',{jobId:job.id,warrantyId:w.id,version:w.version,claimId:c.id}):''}`
  body+=box('Warranty comeback',content)
 }
 return `<div class="narrow">${body}</div>`
}
