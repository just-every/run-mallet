import {area,box,e,field,form,rows,when} from './common'
import {fail} from '../model'
import {LINK_DAYS,linkActive} from '../diagnostics'
import {human,type Actor} from '../auth'

const codes=(r:any)=>r.dtcs.map((d:any)=>`${d.code}${d.description?' '+d.description:''}`).join('\n')
const readings=(r:any)=>r.measurements.map((m:any)=>`${m.name} = ${m.value} ${m.unit}`).join('\n')
// Native form lines: "P0301 Cylinder 1 misfire" and "Compression cylinder 1 = 95 psi".
export function diagnosisFormInput(data:FormData,input:any) {
 if(input.command==='diagnosis.record') {
  const lines=(name:string)=>String(data.get(name)??'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  input.dtcs=lines('dtcLines').map(l=>{const [code,...rest]=l.split(/\s+/);return {code,description:rest.join(' ')}})
  input.measurements=lines('measurementLines').map(l=>{const m=l.match(/^(.+?)\s*=\s*(-?\d+(?:\.\d+)?)\s+(\S.*)$/);if(!m)fail('INPUT','Write each measurement as “name = value unit”, for example “Compression cylinder 1 = 95 psi”.',null,400);return {name:m[1],value:Number(m[2]),unit:m[3]}})
  input.attachmentIds=data.getAll('attachmentIds').map(String)
  for(const key of ['dtcLines','measurementLines'])delete input[key]
  if(data.has('diagnosisVersion'))input.diagnosisVersion=Number(data.get('diagnosisVersion'))
 }
 if(input.command==='diagnosis.share')input.share=input.share==='yes'
 if(input.command==='diagnosisLink.create')input.days=Number(input.days)
 return input
}
function fields(r:any,media:any[]) {
 const chosen=new Set((r?.attachments??[]).map((a:any)=>a.id))
 const attach=media.length?`<fieldset><legend>Attach completed media from this repair</legend>${media.map(m=>`<label><input type="checkbox" name="attachmentIds" value="${e(m.id)}"${chosen.has(m.id)?' checked':''}> ${e(m.label)}</label>`).join('')}</fieldset>`:''
 return `${area('Complaint (customer concern)','complaint',r?.complaint??'','required maxlength="2000"')}${area('Cause','cause',r?.cause??'','maxlength="2000"')}${area('Correction','correction',r?.correction??'','maxlength="2000"')}${area('Trouble codes (one per line, code first)','dtcLines',r?codes(r):'','maxlength="5000"')}${area('Measurements (one per line: name = value unit)','measurementLines',r?readings(r):'','maxlength="5000"')}${area('Test method','testMethod',r?.testMethod??'','maxlength="2000"')}${attach}${area('Staff-only note (never shown to the customer)','staffNote',r?.staffNote??'','maxlength="4000"')}${area('Customer explanation','customerExplanation',r?.customerExplanation??'','maxlength="4000"')}`
}
export function findings(r:any) {
 return `<dl><dt>Complaint</dt><dd>${e(r.complaint)}</dd>${r.cause?`<dt>Cause</dt><dd>${e(r.cause)}</dd>`:''}${r.correction?`<dt>Correction</dt><dd>${e(r.correction)}</dd>`:''}${r.dtcs.length?`<dt>Trouble codes</dt><dd>${r.dtcs.map((d:any)=>`<strong>${e(d.code)}</strong>${d.description?' '+e(d.description):''}`).join('<br>')}</dd>`:''}${r.measurements.length?`<dt>Measurements</dt><dd>${r.measurements.map((m:any)=>`${e(m.name)}: ${e(m.value)} ${e(m.unit)}`).join('<br>')}</dd>`:''}${r.testMethod?`<dt>Test method</dt><dd>${e(r.testMethod)}</dd>`:''}</dl>`
}
export function diagnosisPanel(state:any,job:any,actor:Actor,media:any[]) {
 if(actor.role==='agent')return ''
 const manager=human(actor),open=['booked','working'].includes(job.status),recorder=open&&(manager||job.technicianId===actor.id)
 const entries=rows(state,'diagnosis').filter(d=>d.jobId===job.id).map((d:any,i:number)=>{
  const r=d.revisions.at(-1),shared=d.shared?`Revision ${e(d.shared.revision)} shared with the customer by ${e(d.shared.by.name)} · ${when(d.shared.at)}`:'Not shared with the customer'
  const attachments=r.attachments.length?`<p>Attachments: ${r.attachments.map((a:any)=>`<a href="/app/jobs/${e(job.id)}/media">${e(a.filename)}</a>`).join(', ')}</p>`:''
  const share=manager?(d.shared?.revision===r.n?form('diagnosis.share','','Stop sharing with the customer',{diagnosisId:d.id,version:d.version,share:'no',jobId:job.id}):form('diagnosis.share',`<p>Shares revision ${e(r.n)}: complaint, cause, correction, codes, measurements, test method and the customer explanation. The staff-only note and attachments are never shared.</p>`,`Share revision ${r.n} with the customer`,{diagnosisId:d.id,version:d.version,revision:r.n,share:'yes',jobId:job.id})):''
  const revise=recorder?`<details><summary>Add a revision</summary>${form('diagnosis.record',fields(r,media),'Save diagnosis revision',{jobId:job.id,version:job.version,diagnosisId:d.id,diagnosisVersion:d.version})}</details>`:''
  return `<li class="plain"><h3>Diagnosis ${i+1} · revision ${e(r.n)}</h3><p>${shared}</p>${findings(r)}${attachments}<p class="private"><strong>Staff only:</strong> ${e(r.staffNote||'No staff note.')}</p><p><strong>Customer explanation:</strong> ${e(r.customerExplanation||'None yet.')}</p><details><summary>Retained revisions</summary><ul>${d.revisions.map((v:any)=>`<li>Revision ${e(v.n)} · ${e(v.by.name)} · ${when(v.at)}</li>`).join('')}</ul></details>${share}${revise}</li>`
 }).join('')
 const create=recorder?`<details><summary>Record diagnosis</summary>${form('diagnosis.record',fields(null,media),'Save diagnosis',{jobId:job.id,version:job.version})}</details>`:''
 const links=manager?`<h3>Customer inspection links</h3><p>Links are read-only and show only shared diagnosis revisions. Mallet does not send them: copy the link to the customer yourself.</p>${form('diagnosisLink.create',field(`Valid for days (${LINK_DAYS.min}–${LINK_DAYS.max})`,'days','number',LINK_DAYS.default,`required min="${LINK_DAYS.min}" max="${LINK_DAYS.max}" step="1"`),'Create customer inspection link',{jobId:job.id})}<ul class="list">${rows(state,'diagnosisLink').filter(l=>l.jobId===job.id).map(l=>{const views=rows(state,'diagnosisLinkView').filter(v=>v.linkId===l.id);return `<li class="plain"><p>Created by ${e(l.createdBy.name)} · ${when(l.createdAt)} · ${l.revokedAt?`Revoked by ${e(l.revokedBy.name)} · ${when(l.revokedAt)}`:linkActive(l,new Date().toISOString())?`Expires ${when(l.expiresAt)}`:`Expired ${when(l.expiresAt)}`} · Not sent by Mallet · ${views.length} view${views.length===1?'':'s'}${views.length?' (last '+when(views.at(-1).at)+')':''}</p>${l.revokedAt?'':form('diagnosisLink.revoke','','Revoke link',{linkId:l.id,version:l.version,jobId:job.id})}</li>`}).join('')}</ul>`:''
 return box('Diagnosis',`<ul class="list">${entries||'<li>No diagnosis recorded yet.</li>'}</ul>${create}${links}`,{id:'diagnosis'})
}
export function customerReport(job:any,asset:any,entries:any[],expiresAt:string) {
 const cards=entries.map((r:any)=>box(r.complaint.length>80?r.complaint.slice(0,77)+'…':r.complaint,`${findings(r)}${r.customerExplanation?`<p><strong>From the shop:</strong> ${e(r.customerExplanation)}</p>`:''}`)).join('')
 return `<div class="narrow">${box(`${asset?.label??'Your vehicle'} · ${job.title}`,`<p>Your repair shop shared these inspection findings for you to read. This page is read-only: viewing it does not approve or decline any work. Link expires ${when(expiresAt)}.</p>`)}${cards||box('Nothing shared yet','<p>The shop has not shared any findings on this link yet.</p>')}</div>`
}
