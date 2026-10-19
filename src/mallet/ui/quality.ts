import {qualityStatus,type CheckItem} from '../quality'
import {e,area,badge,box,field,form,select,when} from './common'
import type {Actor} from '../auth'

/** Native forms use ordinary checklist controls; the HTTP adapter calls this once. */
export function qualityFormInput(data:FormData,input:any) {
 if(!String(input.command).startsWith('quality.'))return input
 input.qualityVersion=Number(input.qualityVersion)
 if(input.command==='quality.configure') {
  {
   const count=Number(data.get('qualityItemCount'))
   input.items=Array.from({length:Number.isInteger(count)&&count>=0&&count<=40?count:0},(_,n)=>{
    const label=String(data.get(`qualityLabel${n}`)??'').trim(),unit=String(data.get(`qualityUnit${n}`)??'').trim()
    return {label,stage:String(data.get(`qualityStage${n}`)),critical:data.has(`qualityCritical${n}`),required:data.has(`qualityRequired${n}`),...(unit?{measurement:{label:String(data.get(`qualityMeasure${n}`)??'Measurement').trim()||'Measurement',unit}}:{})}
   }).filter(item=>item.label)
  }
 }
 if(input.command==='quality.record'&&data.has('measurementValue')&&input.measurementValue!=='')input.measurementValue=Number(input.measurementValue)
 if(input.command==='quality.override')input.itemIds=data.getAll('itemIds')
 return input
}
const stageName={pre:'Pre-work',post:'Post-work','road-test':'Road test'}
const check=(label:string,name:string,selected:boolean)=>`<label class="check"><input type="checkbox" name="${e(name)}"${selected?' checked':''}> ${e(label)}</label>`
const attestation=(label:string)=>`${field('Relevant qualification / competence','qualification','text','','required maxlength="500"')}${area(label,'note','','required maxlength="2000"')}`
function checklistForm(job:any,q:any) {
 const items:CheckItem[]=q?.revisions.at(-1).items??[]
 const count=Math.min(40,Math.max(4,items.length+2))
 const controls=Array.from({length:count},(_,n)=>{
  const item=items[n],stage=item?.stage??(n===0?'pre':n===2?'road-test':'post')
  return `<fieldset><legend>Check ${n+1}</legend>${field('Check to perform',`qualityLabel${n}`,'text',item?.label??'','maxlength="200"')}${select('When',`qualityStage${n}`,[['pre','Pre-work'],['post','Post-work'],['road-test','Road test']],stage)}<div class="checks">${check('Required',`qualityRequired${n}`,item?.required??true)}${check('Safety critical',`qualityCritical${n}`,item?.critical??false)}</div><div class="fields">${field('Measurement to record (if needed)',`qualityMeasure${n}`,'text',item?.measurement?.label??'','maxlength="100"')}${field('Measurement units (required for road test)',`qualityUnit${n}`,'text',item?.measurement?.unit??'','maxlength="40"')}</div></fieldset>`
 }).join('')
 return form('quality.configure',`<p>Define this repair’s pre-work, post-work, and any road-test checks. Leave unused checks blank. Required and safety-critical checks must pass unless an independent qualified manager records an explicit override. A new revision requires fresh checks and signatures.</p>${controls}${area('Reason for this checklist revision','reason','','required maxlength="2000"')}`,q?'Save new checklist revision':'Define checklist',{jobId:job.id,version:job.version,qualityVersion:q?.version??0,qualityItemCount:count})
}
export function qualityPanel(state:any,job:any,actor:Actor) {
 const status=qualityStatus(state,job),q=status.record,open=['booked','working'].includes(job.status),manager=['owner','admin'].includes(actor.role),assigned=actor.role!=='agent'&&actor.id===job.technicianId
 const values={jobId:job.id,version:job.version,qualityVersion:q?.version??0}
 const checks=status.items.map(({item,result}:any)=>{
  const recorded=result?`<p>${badge(result.outcome,result.outcome==='pass'?'green':'red')} ${result.measurement?`${e(result.measurement.value)} ${e(result.measurement.unit)} · `:''}${e(result.note)}<br>${e(result.by.name)} · ${when(result.at)}</p>`:'<p>Not inspected.</p>'
  const capture=assigned&&open?form('quality.record',`${select('Inspection result','outcome',[['not-inspected','Not inspected'],['pass','Pass'],['fail','Fail']])}${item.measurement?field(`${item.measurement.label} (${item.measurement.unit})`,'measurementValue','number','','step="any"'):''}${area('Inspection evidence / reason','note','','required maxlength="2000"')}`,'Record check',{...values,itemId:item.id,...(item.measurement?{measurementUnit:item.measurement.unit}:{})}):''
  return `<li class="plain"><strong>${e(item.label)}</strong><p class="muted">${e(stageName[item.stage as keyof typeof stageName])}${item.required?' · Required':''}${item.critical?' · Safety critical':''}</p>${recorded}${capture}</li>`
 }).join('')
 let body=`<p>${!open&&!q?'Historical completion: no quality evidence was recorded; no safety clearance is inferred.':status.ready?'Current checks and both signatures clear this repair for handover.':'Quality clearance is required before this repair can be marked ready.'} Safety decisions remain with qualified people.</p>${status.blockers.length?`<ul>${status.blockers.map(b=>`<li>${e(b.reason)}</li>`).join('')}</ul>`:''}`
 if(q) {
  body+=`<p class="muted">Checklist revision ${e(status.revision.n)} · ${e(status.revision.reason)}</p><ul class="list">${checks}</ul>`
  const currentTech=status.technicianSignoff,currentQuality=status.qualitySignoff
  body+=`<p>Technician: ${currentTech?`${e(currentTech.by.name)} · ${when(currentTech.at)}`:'Current signature needed'}<br>Independent quality: ${currentQuality?`${e(currentQuality.by.name)} · ${e(currentQuality.safetyDecision)} · ${when(currentQuality.at)}`:'Current signature needed'}</p>`
  if(assigned&&open)body+=`<details><summary>Sign the technician’s checks and recorded work</summary>${form('quality.signTechnician',`<p>This signature identifies the exact current work and check results, including any failures.</p>${attestation('Technician sign-off evidence')}`,'Sign as assigned technician',values)}</details>`
  const failed=q.results.filter((r:any)=>r.outcome==='fail'),work=job.actuals??[]
  if(assigned&&open&&failed.length)body+=`<details><summary>Record corrective work for a failed check</summary>${form('quality.correct',`${select('Failed inspection','failedResultId',failed.map((r:any)=>[r.id,`${r.item.label} · revision ${r.revision} · ${r.note}`]))}${select('Actual corrective work','workId',work.map((w:any)=>[w.id,`${w.note||w.kind} · ${w.quantity} · ${w.by?.name??''}`]))}${area('What corrected the failure','reason','','required maxlength="2000"')}<p>Record the actual authorized corrective work in Parts & labor first. Then link it here and record a fresh passing inspection.</p>`,'Save correction evidence',values)}</details>`
  if(manager&&actor.id!==job.technicianId&&open) {
   body+=`<details><summary>Make the independent quality decision</summary>${form('quality.signQuality',`${select('Qualified safety decision','safetyDecision',[['unsafe','Unsafe to release'],['safe','Safe to release']])}${attestation('Independent inspection and safety decision evidence')}<p>Review the current checks, actual work, technician signature, and any override. Your signature must be independent of the assigned technician.</p>`,'Sign independent quality decision',values)}</details>`
   const gates=status.items.filter(({item,result}:any)=>(item.required||item.critical)&&result?.outcome!=='pass')
   if(gates.length)body+=`<details><summary>Authorize an exception for failed or incomplete checks</summary>${form('quality.override',`<p>Select each specific check being waived. This does not replace either required signature. The exception and reason remain in this repair’s history.</p><div class="checks">${gates.map(({item,result}:any)=>`<label class="check"><input type="checkbox" name="itemIds" value="${e(item.id)}"> ${e(item.label)} · ${e(result?.outcome??'not inspected')}</label>`).join('')}</div>${area('Reason and evidence for overriding these checks','reason','','required maxlength="2000"')}${field('Relevant qualification / competence','qualification','text','','required maxlength="500"')}${select('Qualified safety decision','safetyDecision',[['','Choose a safety decision'],['safe','Safe to release despite the selected checks']])}`,'Record reasoned override',values,'danger')}</details>`
  }
  const history=[...q.revisions.map((r:any)=>({at:r.at,html:`<strong>Checklist revision ${e(r.n)}</strong> · ${e(r.by.name)}<p>${e(r.reason)}</p><ul>${r.items.map((i:CheckItem)=>`<li>${e(stageName[i.stage])}: ${e(i.label)}${i.required?' · Required':''}${i.critical?' · Safety critical':''}${i.measurement?` · ${e(i.measurement.label)} (${e(i.measurement.unit)})`:''}</li>`).join('')}</ul>`})),...q.results.map((r:any)=>({at:r.at,html:`<strong>${e(r.item.label)}: ${e(r.outcome)}</strong> · revision ${e(r.revision)} · ${e(r.by.name)}<p>${e(r.note)}${r.measurement?` · ${e(r.measurement.value)} ${e(r.measurement.unit)}`:''}</p>`})),...q.corrections.map((x:any)=>({at:x.at,html:`<strong>Corrective work</strong> · ${e(x.by.name)}<p>${e(x.reason)}</p><p>Failed check: ${e(q.results.find((r:any)=>r.id===x.failedResultId)?.item.label)} · Work: ${e(x.work.note||x.work.kind)} · ${e(x.work.quantity)}</p>`})),...q.signoffs.map((x:any)=>({at:x.at,html:`<strong>${x.kind==='technician'?'Technician signature':'Independent quality signature'}${x.safetyDecision?`: ${e(x.safetyDecision)}`:''}</strong> · ${e(x.by.name)} · ${x.id===currentTech?.id||x.id===currentQuality?.id?'Current':'Superseded or changed checks/work'}<p>${e(x.qualification)} · ${e(x.note)}</p>`})),...q.overrides.map((x:any)=>({at:x.at,html:`<strong>Authorized override · ${status.overrides.some((o:any)=>o.id===x.id)?'Current':'Changed checks/work'}</strong> · ${e(x.by.name)}<p>${e(x.reason)}</p><p>${e(x.qualification)} · ${e(x.safetyDecision)}</p><ul>${x.checks.map(({item,result}:any)=>`<li>${e(item.label)}: ${e(result?.outcome??'not inspected')}</li>`).join('')}</ul>`}))].sort((a,b)=>a.at.localeCompare(b.at))
  body+=`<details><summary>Quality history (${history.length})</summary><ul class="list">${history.map(x=>`<li class="plain">${x.html}<p class="muted">${when(x.at)}</p></li>`).join('')}</ul></details>`
 }
 if(actor.role==='owner'&&actor.id!==job.technicianId&&open)body+=`<details><summary>Take over this repair’s technician assignment</summary>${form('quality.takeover',`<p>Use this explicit takeover when an archived or former technician cannot continue. All prior work and sign-offs retain their original actors. Current clearance becomes stale; you must inspect and sign as technician, then obtain a different person’s independent quality decision.</p>${area('Why the owner is taking over','reason','','required maxlength="2000"')}`,'Take over technician assignment',values)}</details>`
 if(manager&&open)body+=`<details${q?'':' open'}><summary>${q?'Revise this job’s checklist':'Define this job’s checklist'}</summary>${checklistForm(job,q)}</details>`
 return box('Quality & road test',body,{id:'quality',pill:badge(status.ready?'Cleared':'Needs clearance',status.ready?'green':'amber')})
}
