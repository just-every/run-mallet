import {coverageMailPanel} from './coverage-mail'
import {area,box,e,field,form,rows,select,when} from './common'
import {coverageStop} from '../coverage-follow-up'
const reason=()=>area('Evidence and reason','reason','','required maxlength="2000"')
export function coveragePage(s:any,job:any){
 const asset=rows(s,'asset').find(a=>a.id===job.assetId),records=rows(s,'coverageReview').filter(r=>r.jobId===job.id)
 const values={jobId:job.id,version:job.version}
 let body='<p><a href="/app/jobs/'+e(job.id)+'/warranty">Warranty and original repair</a> · '+e(job.asset.label)+'</p><p>Private owner review tasks only. Recorded dates and permission are assertions with retained sources, not independently verified coverage. Internal review tasks grant no sending authority. A separately consented, explicitly approved email can run once; nothing renews a contract, authorizes work or charges a customer.</p>'
 const common=field('Unique review reference','reference','text','','required maxlength="200"')+field('Review due (with timezone)','dueAt','text','','required')+area('Customer review permission and source','consentEvidence','','required maxlength="2000"')
 if(!asset.privacyErasedAt){
  const terms=rows(s,'warrantyTerms').filter(t=>t.jobId===job.id)
  if(terms.length)body+=box('Schedule a warranty check',form('coverage.schedule',select('Retained warranty terms','termsId',terms.map(t=>[t.id,'Terms '+t.n+' · '+t.startsAt+' to '+t.endsAt]))+common,'Schedule warranty review',{...values,kind:'warranty'}))
  body+=box('Schedule a service-contract review',form('coverage.schedule',field('Retained contract document reference','documentReference','text','','required maxlength="200"')+area('Contract terms','terms','','required maxlength="4000"')+field('Contract starts (with timezone)','startsAt','text','','required')+field('Contract ends (with timezone)','endsAt','text','','required')+area('Source and coverage-date evidence','evidence','','required maxlength="2000"')+common,'Schedule contract review',{...values,kind:'service-contract'}))
 }
 for(const r of records.sort((a,b)=>a.dueAt.localeCompare(b.dueAt))){
  const stopped=coverageStop(s,r),active=['scheduled','due'].includes(r.status)&&!stopped,task=rows(s,'coverageTask').find(t=>t.coverageId===r.id),v={jobId:job.id,id:r.id,version:r.version}
  let content='<p>'+e(r.kind)+' · '+e(r.status)+(stopped?' · Suppressed: '+e(stopped):'')+' · due '+when(r.dueAt)+'</p><p>'+e(r.source.terms)+'</p><p>Coverage '+when(r.source.startsAt)+' through '+when(r.source.endsAt)+' · '+e(r.source.provenance)+' · Not independently verified</p><p>'+e(r.source.documentReference??'Retained warranty terms '+r.source.id)+' · '+e(r.source.evidence??'Original shop warranty assertion')+'</p><p>Recorded review permission: '+e(r.consentEvidence)+'</p><p>Scheduled by '+e(r.by.name)+' · '+when(r.at)+'</p>'
  if(task)content+='<h3>Native review task · '+e(task.status)+'</h3><p>'+e(task.title)+' · Due '+when(task.dueAt)+' · Created '+when(task.createdAt)+' · '+e(task.createdBy.name)+'</p>'+(task.resolution?'<p>'+e(task.resolution.reason)+'</p>':'')
  if(active){
   if(r.kind==='service-contract')content+='<details><summary>Record a separately executed renewal</summary><p>This records signed evidence only. Mallet does not execute a provider renewal, send a message or charge the customer.</p>'+form('coverage.recordRenewal',field('Renewal document or revision reference','documentReference','text','','required maxlength="200"')+area('Renewal contract terms','terms','','required maxlength="4000"')+field('Renewed contract starts with timezone','startsAt','text','','required')+field('Renewed contract ends with timezone','endsAt','text','','required')+area('Renewed coverage-date evidence','evidence','','required maxlength="2000"')+field('New unique review reference','reference','text','','required maxlength="200"')+field('Next review due with timezone','dueAt','text','','required')+area('Fresh internal review permission and source','consentEvidence','','required maxlength="2000"')+reason()+field('Type record-evidenced-renewal to confirm','confirm','text','','required'),'Record renewal evidence',v)+'</details>'
   if(!r.localAuthority)content+=box('Review scheduling paused',form('coverage.activate',reason(),'Activate with fresh owner review',v))
   if(r.status==='due')content+=form('coverage.resolve',reason(),'Complete review task',v)
   content+='<details><summary>Record a reported repeat symptom</summary>'+form('coverage.symptom',field('Unique symptom reference','reference','text','','required maxlength="200"')+area('Customer-reported repeat symptom','symptom','','required maxlength="4000"')+field('Reported time (with timezone)','reportedAt','text','','required')+area('Report source evidence','evidence','','required maxlength="2000"'),'Link symptom to original repair',v)+'</details>'
   content+='<details><summary>Cancel this coverage review</summary>'+form('coverage.cancel',reason(),'Cancel coverage review',v)+'</details>'
  }
  content+='<h3>Linked reported issues</h3><ul>'+r.symptoms.map((x:any)=>'<li>'+e(x.text??'Erased symptom content')+' · '+e(x.evidence)+' · '+when(x.reportedAt)+' · Recorded by '+e(x.by.name)+' · <a href="/app/jobs/'+e(r.jobId)+'">Original repair</a></li>').join('')+'</ul>'
  content+='<h3>Review history</h3><ul>'+r.history.map((h:any)=>'<li>'+e(h.action)+' · '+e(h.reason)+' · '+e(h.by.name)+' · '+when(h.at)+'</li>').join('')+'</ul>'
  for(const renewal of rows(s,'coverageRenewal').filter(n=>n.coverageId===r.id))content+='<p>Renewal recorded · '+e(renewal.reason)+' · '+e(renewal.by.name)+' · '+when(renewal.at)+' · Replacement review '+e(renewal.replacementCoverageId)+'</p>'
  content+=coverageMailPanel(s,r,active)
  body+=box(r.reference,content)
 }
 if(records.some(r=>['scheduled','due'].includes(r.status)))body+=box('Vehicle ownership change',form('coverage.transfer',reason(),'Record transfer and stop reviews',{jobId:job.id,assetId:asset.id,version:asset.version}))
 return '<div class="narrow">'+body+'</div>'
}
