import {HttpError} from './auth'
import {invoiceBalance} from './payments'
import {rows,type State} from './model'
import {box,e,field,form,money,select,when} from './ui/common'
import {period,technicianRow} from './reports/technicians'

// This report reconciles native records. A staff observation never establishes bank settlement.
export function staffFinance(state:State){
 const invoices=rows(state,'invoice').filter(i=>['approved','exported'].includes(i.status)).map(invoice=>{
  const balance=invoiceBalance(state,invoice),payments=balance.payments
  const refunds=rows(state,'refund').filter(r=>r.invoiceId===invoice.id)
  const pendingRefundCents=refunds.filter(r=>!['refunded','credited'].includes(r.redirect?.status??r.status)).reduce((n,r)=>n+r.amountCents,0)
  const recordedTenderCents=payments.reduce((n,p)=>n+p.amountCents,0)
  const unresolved=refunds.filter(r=>!['refunded','credited'].includes(r.redirect?.status??r.status)).map(r=>({id:r.id,status:r.redirect?.status??r.status,amountCents:r.amountCents}))
  return {invoiceId:invoice.id,number:invoice.number,revision:invoice.revision,totalCents:balance.totalCents,creditedCents:balance.creditedCents,adjustedTotalCents:balance.adjustedTotalCents,recordedTenderCents,refundedCents:balance.refundedCents,returnedCents:balance.returnedCents,netAppliedCents:balance.paidCents,outstandingCents:balance.outstandingCents,excessCents:Math.max(0,balance.paidCents-balance.adjustedTotalCents),pendingRefundCents,unresolved,
   payments:payments.map(p=>({id:p.id,reference:p.reference,method:p.method,amountCents:p.amountCents,verified:p.verified,label:p.label??'Processor capture recorded; bank settlement is not verified.'})),
   credits:rows(state,'creditNote').filter(n=>n.invoiceId===invoice.id).map(n=>({id:n.id,number:n.number,totalCents:n.totals.totalCents,destination:n.destination})),refunds:refunds.map(r=>({id:r.id,creditNoteId:r.creditNoteId,paymentId:r.paymentId,method:r.method,status:r.redirect?.status??r.status,amountCents:r.amountCents,history:r.history.map((h:any)=>({status:h.status,reference:h.reference,at:h.at,by:h.by,label:h.label}))}))}
 })
 const totals=Object.fromEntries(['totalCents','creditedCents','adjustedTotalCents','recordedTenderCents','refundedCents','returnedCents','netAppliedCents','outstandingCents','excessCents','pendingRefundCents'].map(key=>[key,invoices.reduce((n,i)=>n+(i as any)[key],0)]))
 return {currency:'USD',label:'Native invoice and tender reconciliation; no bank settlement is verified.',totals,invoices}
}
export function staffFinanceCsv(report:ReturnType<typeof staffFinance>){
 const cell=(value:unknown)=>{let text=String(value??'');if(/^[\t\r\n]|^\s*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}
 const data:unknown[][]=[['Record','Invoice','Source','Method or status','Original cents','Credit cents','Adjusted cents','Recorded tender cents','Refunded cents','Returned cents','Net applied cents','Outstanding cents','Excess cents','Pending refund cents'],['definition',report.label]]
 for(const i of report.invoices){
  data.push(['invoice',i.number,i.invoiceId,'',i.totalCents,i.creditedCents,i.adjustedTotalCents,i.recordedTenderCents,i.refundedCents,i.returnedCents,i.netAppliedCents,i.outstandingCents,i.excessCents,i.pendingRefundCents])
  for(const p of i.payments)data.push(['tender',i.number,p.reference,p.method,p.amountCents])
  for(const n of i.credits)data.push(['credit',i.number,n.number,n.destination,'',n.totalCents])
  for(const r of i.refunds){data.push(['refund',i.number,r.id,r.status,'','','','',r.amountCents]);for(const h of r.history)data.push(['refund-observation',i.number,h.reference,h.status,'','','','',r.amountCents])}
 }
 return data.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
export function staffFinancePage(report:ReturnType<typeof staffFinance>){
 return box('Finance reconciliation',`<p>${e(report.label)}</p><p><a href="/api/mallet/staff/finance?format=json">Download reconciliation JSON</a> · <a href="/api/mallet/staff/finance?format=csv">Download reconciliation CSV</a></p>`+report.invoices.map(i=>`<details id="finance-${e(i.invoiceId)}"><summary>${e(i.number)} · Outstanding ${money(i.outstandingCents)} · Pending refund ${money(i.pendingRefundCents)}</summary><dl><dt>Original invoice</dt><dd>${money(i.totalCents)}</dd><dt>Issued credits</dt><dd>${money(i.creditedCents)}</dd><dt>Adjusted invoice</dt><dd>${money(i.adjustedTotalCents)}</dd><dt>Recorded tender</dt><dd>${money(i.recordedTenderCents)}</dd><dt>Completed refunds</dt><dd>${money(i.refundedCents)}</dd><dt>Returned principal</dt><dd>${money(i.returnedCents)}</dd><dt>Net applied</dt><dd>${money(i.netAppliedCents)}</dd><dt>Excess pending refund or review</dt><dd>${money(i.excessCents)}</dd></dl><ul>${i.payments.map(p=>`<li>${e(p.reference)} · ${e(p.method)} · ${money(p.amountCents)}<p>${e(p.label)}</p></li>`).join('')}${i.credits.map(n=>`<li>${e(n.number)} · ${e(n.destination)} · ${money(n.totalCents)}</li>`).join('')}${i.refunds.map(r=>`<li>Refund ${money(r.amountCents)} · ${e(r.status)}<ul>${r.history.map((h:any)=>`<li>${e(h.status)} · ${e(h.reference)} · ${e(h.by?.name)} · ${when(h.at)}<p>${e(h.label)}</p></li>`).join('')}</ul></li>`).join('')}</ul></details>`).join(''))
}
export function staffRefundForms(records:Record<string,any[]>){
 const invoices=records.invoice??[],payments=records.payment??[]
 const previews=invoices.filter(i=>['approved','exported'].includes(i.status)&&payments.some(p=>p.invoiceId===i.id)).map(i=>{
  const original=payments.filter(p=>p.invoiceId===i.id&&['cash','check','other','stripe'].includes(p.method))
  return `<details><summary>Review a return on ${e(i.number)}</summary>`+form('credit.preview',select('Original invoice line','staffCreditLine',i.lines.map((l:any)=>[JSON.stringify({lineId:l.id,sourceEstimateId:l.sourceEstimateId,sourceRevision:l.sourceRevision}),l.description]))+field('Return quantity','quantity','number',1,'required min="0.001" step="0.001"')+select('Credit destination','destination',[['original-tender','Original tender'],['account-credit','Customer account credit']])+select('Original tender','paymentId',original.map(p=>[p.id,p.reference+' · '+money(p.amountCents)]))+field('Unique credit reference','reference','text','','required')+field('Return reason','reason','text','','required')+field('Customer credit instruction','consentEvidence','text','','required'),'Preview staff credit',{invoiceId:i.id,version:i.version})+'</details>'
 }).join('')
 const observations=(records.refund??[]).filter(r=>r.method!=='stripe'&&!r.redirect&&r.status!=='refunded').map(r=>`<details><summary>Record manual refund · ${money(r.amountCents)} · ${e(r.status)}</summary>`+form('refund.record',select('Observed refund outcome','status',[['refunded','Refunded'],['failed','Failed'],['disputed','Disputed']])+field('Refund observation reference','reference','text','','required')+field('Observed original-tender evidence','evidence','text','','required')+'<label class="check"><input type="checkbox" name="confirm" value="record-refund" required> I confirm this original-tender observation.</label>','Record manual refund',{refundId:r.id,version:r.version})+'</details>').join('')
 return box('Returns and manual refunds','<p>Review the exact current credit before confirming it. Manual observations move no money and do not verify funds. Provider submission and failed-refund redirection require the owner.</p>'+previews+observations)
}
export function staffCreditPreview(review:any,input:any){
 return box('Review exact staff credit',`<p>${e(review.invoiceNumber)} · Credit ${money(review.totals.totalCents)} · ${e(review.destination)} · ${e(review.method)}</p><ul>${review.lines.map((l:any)=>`<li>${e(l.description)} · ${e(l.quantity)} · ${money(l.totalCents)}</li>`).join('')}</ul><p>${e(input.reason)} · ${e(input.consentEvidence)}</p>`+form('credit.issue','<label class="check"><input type="checkbox" name="confirm" value="issue-credit" required> I approve this exact credit and original destination.</label>','Issue reviewed credit',{staffCreditRequest:JSON.stringify(input),staffCreditReview:JSON.stringify(review)})+'<p><a href="/app/staff">Cancel and return to workspace</a></p>')
}
export function staffFinanceInput(input:any){
 if(input.command==='credit.preview'&&input.staffCreditLine){let line;try{line=JSON.parse(input.staffCreditLine)}catch{throw new HttpError(400,'invalid_credit_line')};input.lines=[{...line,quantity:Number(input.quantity)}]}
 if(input.command==='credit.issue'&&input.staffCreditRequest){let request,review;try{request=JSON.parse(input.staffCreditRequest);review=JSON.parse(input.staffCreditReview)}catch{throw new HttpError(400,'invalid_credit_review')};const confirm=input.confirm;Object.assign(input,request,{command:'credit.issue',review,confirm})}
}

export function staffPayroll(state:State,params:URLSearchParams,now=new Date().toISOString()){
 const range=period(params.get('from'),params.get('to'),now)
 const ids=[...new Set([...rows(state,'timeEntry').map(t=>t.ownerId),...rows(state,'payRate').map(r=>r.technicianId)])]
 const technicians=ids.filter(id=>!rows(state,'job').some(j=>j.technicianId===id&&(j.location??j.locationId??'shop')!=='shop')).map(id=>{
  const row=technicianRow(state,id,range,now,true)
  return {technicianId:id,name:rows(state,'timeEntry').find(t=>t.ownerId===id)?.owner?.name??'Technician',attendanceMs:row.attendanceMs,breakMs:row.breakMs,netAttendanceMs:row.netAttendanceMs,payCents:row.payCents,unratedMs:row.unratedMs,
   rates:(row.rates?.revisions??[]).map((r:any)=>({centsPerHour:r.centsPerHour,effectiveFrom:r.effectiveFrom,at:r.at,by:r.by})),intervals:row.intervals.filter((i:any)=>i.kind==='attendance'||i.kind==='break').map((i:any)=>({id:i.id,kind:i.kind,countedMs:i.countedMs,running:i.running}))}
 })
 return {period:{from:range.from,to:range.to},label:'Recorded attendance and effective payroll rates; no payroll payment or filing.',technicians}
}
export function staffPayrollCsv(report:ReturnType<typeof staffPayroll>){
 const cell=(value:unknown)=>{const text=String(value??'');return '"'+(/^[\t\r\n]|^\s*[=+@-]/.test(text)?"'":'')+text.replaceAll('"','""')+'"'}
 const data:unknown[][]=[['Record','Technician','Source','Attendance ms','Break ms','Net attendance ms','Pay cents','Unrated ms','Effective from','Hourly cents'],['definition',report.label],['period',report.period.from,report.period.to]]
 for(const t of report.technicians){data.push(['technician',t.name,t.technicianId,t.attendanceMs,t.breakMs,t.netAttendanceMs,t.payCents,t.unratedMs]);for(const r of t.rates)data.push(['rate',t.name,t.technicianId,'','','','','',r.effectiveFrom,r.centsPerHour]);for(const i of t.intervals)data.push([i.kind,t.name,i.id,i.countedMs])}
 return data.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n'
}
export function staffPayrollPage(report:ReturnType<typeof staffPayroll>){
 const query=new URLSearchParams(report.period)
 return box('Payroll reconciliation',`<p>${e(report.label)} UTC dates ${e(report.period.from)} to ${e(report.period.to)}.</p><p><a href="/api/mallet/staff/payroll?${e(query)}&amp;format=json">Download payroll JSON</a> · <a href="/api/mallet/staff/payroll?${e(query)}&amp;format=csv">Download payroll CSV</a></p>`+report.technicians.map(t=>`<details><summary>${e(t.name)} · Recorded pay ${money(t.payCents)}</summary><p>Attendance ${e(t.attendanceMs/3600000)} hours · Breaks ${e(t.breakMs/3600000)} hours · Net ${e(t.netAttendanceMs/3600000)} hours · Unrated ${e(t.unratedMs/3600000)} hours</p><ul>${t.rates.map((r:any)=>`<li>${money(r.centsPerHour)} per hour from ${e(r.effectiveFrom)}</li>`).join('')}${t.intervals.map((i:any)=>`<li>${e(i.kind)} · ${e(i.countedMs/3600000)} hours${i.running?' · Still running':''}</li>`).join('')}</ul></details>`).join(''))
}
