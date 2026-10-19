import type {Actor} from '../auth'
import {inspectionStatus,latestInspectionRevision,type InspectionItem} from '../inspections'
import {area,badge,box,e,field,form,hidden,money,rows,select,when} from './common'

/** Adapt native controls only; the command API accepts all 100 points/lines. */
export function inspectionFormInput(data:FormData,input:any) {
 if(!['inspectionJob.save','inspectionTemplate.save','inspection.assign','inspection.record','inspection.estimate'].includes(String(input.command)))return input
 for(const key of ['version','inspectionVersion','templateVersion','templateRevision','recipeVersion'])if(data.has(key))input[key]=Number(data.get(key))
 const count=Number(data.get('inspectionControlCount'))
 const indices=Array.from({length:Number.isInteger(count)&&count>0&&count<=100?count:0},(_,n)=>n)
 if(input.command==='inspectionJob.save')input.lines=indices.map(n=>({kind:String(data.get(`lineKind${n}`)),description:String(data.get(`lineDescription${n}`)??'').trim(),quantity:Number(data.get(`lineQuantity${n}`)),unitCents:Math.round(Number(data.get(`linePrice${n}`))*100)})).filter(line=>line.description)
 if(input.command==='inspectionTemplate.save')input.items=indices.map(n=>{
  const grades=String(data.get(`pointGrades${n}`)??'').split(/\r?\n/).map(g=>g.trim()).filter(Boolean),unit=String(data.get(`pointUnit${n}`)??'').trim(),name=String(data.get(`pointMeasure${n}`)??'').trim(),mapping=String(data.get(`pointRecipe${n}`)??'').split(':')
  const id=String(data.get(`pointId${n}`)??'')
  return {...(id?{id}:{}),label:String(data.get(`pointLabel${n}`)??'').trim(),measurement:unit||name||grades.length?{name,unit,...(grades.length?{grades}:{})}:null,recipe:mapping[0]?{id:mapping[0],revision:Number(mapping[1])}:null}
 }).filter(item=>item.label)
 if(input.command==='inspection.record'&&data.has('measurementGrade'))input.measurementValue=String(data.get('measurementGrade'))
 if(input.command==='inspection.record'&&data.has('measurementValue')&&input.measurementValue!=='')input.measurementValue=Number(input.measurementValue)
 return input
}
function recipeEditor(jobId:string,recipe?:any) {
 const revision=recipe?latestInspectionRevision(recipe):null,lines=revision?.lines??[],count=Math.min(100,Math.max(4,lines.length+2))
 const controls=Array.from({length:count},(_,n)=>{
  const line=lines[n]
  return `<fieldset><legend>Service line ${n+1}</legend>${field('Description',`lineDescription${n}`,'text',line?.description??'','maxlength="500"')}${select('Line kind',`lineKind${n}`,[['part','Part'],['labor','Labor']],line?.kind??'part')}<div class="fields">${field('Quantity / labor hours',`lineQuantity${n}`,'number',line?.quantity??1,'min="0.001" step="0.001"')}${field('Unit price / hourly rate (USD before tax)',`linePrice${n}`,'number',line?line.unitCents/100:0,'min="0" step="0.01"')}</div></fieldset>`
 }).join('')
 return form('inspectionJob.save',`${field('Service recipe name','name','text',revision?.name??'','required maxlength="200"')}<p>Leave unused lines blank. Prices use the shop’s current sales tax settings when an estimate is prepared.</p>${controls}${area('Reason for this recipe revision','reason','','required maxlength="2000"')}`,recipe?'Save recipe revision':'Create service recipe',{jobId,version:recipe?.version??0,...(recipe?{id:recipe.id}:{}),inspectionControlCount:count})
}
function templateEditor(jobId:string,recipes:any[],template?:any) {
 const revision=template?latestInspectionRevision(template):null,items:InspectionItem[]=revision?.items??[],count=Math.min(100,Math.max(5,items.length+2))
 const options:[string,string][]=[['','No service recipe'],...recipes.flatMap(recipe=>recipe.revisions.map((r:any)=>[`${recipe.id}:${r.n}`,`${r.name} · revision ${r.n}`] as [string,string]))]
 const controls=Array.from({length:count},(_,n)=>{
  const item=items[n]
  return `<fieldset><legend>Inspection point ${n+1}</legend>${item?hidden(`pointId${n}`,item.id):''}${field('Point to inspect',`pointLabel${n}`,'text',item?.label??'','maxlength="200"')}<div class="fields">${field('Measurement name (optional)',`pointMeasure${n}`,'text',item?.measurement?.name??'','maxlength="100"')}${field('Exact measurement unit',`pointUnit${n}`,'text',item?.measurement?.unit??'','maxlength="40"')}</div>${area('Grade labels (optional; one per line)',`pointGrades${n}`,item?.measurement?.grades?.join('\n')??'')}<p>For a qualitative check, set a measurement name/unit such as Condition / grade, and define labels instead of physical numbers.</p>${select('Mapped service recipe revision',`pointRecipe${n}`,options,item?.recipe?`${item.recipe.id}:${item.recipe.revision}`:'')}</fieldset>`
 }).join('')
 return form('inspectionTemplate.save',`${field('Template name','name','text',revision?.name??'','required maxlength="200"')}${field('Vehicle applicability','vehicle','text',revision?.vehicle??'','required maxlength="200"')}${field('Service applicability','service','text',revision?.service??'','required maxlength="200"')}<p>Leave unused points blank. A measurement needs both its name and exact unit. Assigned checklists retain this exact revision and its mapped recipes.</p>${controls}${area('Reason for this template revision','reason','','required maxlength="2000"')}`,template?'Save template revision':'Create inspection template',{jobId,version:template?.version??0,...(template?{id:template.id}:{}),inspectionControlCount:count})
}
function configurations(state:any,jobId:string) {
 const recipes=rows(state,'inspectionJob'),templates=rows(state,'inspectionTemplate')
 return `<details><summary>Reusable service recipes</summary><p>Recipes supply real part and labor lines for a draft estimate from a yellow or red finding. Updating a recipe never changes a saved estimate.</p>${recipes.map(recipe=>{const r=latestInspectionRevision(recipe);return `<details><summary>${e(r.name)} · revision ${r.n}</summary>${recipeEditor(jobId,recipe)}<details><summary>Recipe history</summary><ul>${recipe.revisions.map((v:any)=>`<li>Revision ${v.n}: ${e(v.reason)} · ${e(v.by.name)} · ${when(v.at)}<ul>${v.lines.map((l:any)=>`<li>${e(l.kind)} · ${e(l.description)} · ${e(l.quantity)} × ${money(l.unitCents)}</li>`).join('')}</ul></li>`).join('')}</ul></details></details>`}).join('')}<details><summary>Create a service recipe</summary>${recipeEditor(jobId)}</details></details><details><summary>Versioned inspection templates</summary>${templates.map(template=>{const r=latestInspectionRevision(template);return `<details><summary>${e(r.name)} · revision ${r.n} · ${e(r.vehicle)} · ${e(r.service)}</summary>${templateEditor(jobId,recipes,template)}<details><summary>Template history</summary><ul>${template.revisions.map((v:any)=>`<li>Revision ${v.n} · ${e(v.name)} · ${e(v.vehicle)} · ${e(v.service)} · ${e(v.reason)} · ${e(v.by.name)} · ${when(v.at)}<ul>${v.items.map((i:InspectionItem)=>`<li>${e(i.label)}${i.measurement?` · ${e(i.measurement.name)} (${e(i.measurement.unit)})`:''}${i.recipe?` · ${e(i.recipe.snapshot.name)} revision ${i.recipe.revision}`:''}</li>`).join('')}</ul></li>`).join('')}</ul></details></details>`}).join('')}<details><summary>Create an inspection template</summary>${templateEditor(jobId,recipes)}</details></details>`
}
function assignedChecklist(state:any,job:any,inspection:any,actor:Actor,photos:any[]) {
 const snapshot=inspection.template.snapshot,status=inspectionStatus(inspection),open=['booked','working'].includes(job.status),technician=actor.id===job.technicianId,manager=['owner','admin'].includes(actor.role)
 const values={jobId:job.id,version:job.version,inspectionId:inspection.id,inspectionVersion:inspection.version}
 const items=status.items.map(({item,result}:any)=>{
  const measured=result?.measurement?` · ${e(result.measurement.name)}: ${e(result.measurement.value)} ${e(result.measurement.unit)}`:''
  const recorded=result?`<p>${badge(result.outcome,result.outcome==='green'?'green':result.outcome==='red'?'red':'amber')}${measured}<br>${e(result.reason)} · ${e(result.by.name)} · ${when(result.at)}</p>`:'<p>Not yet inspected.</p>'
  const capture=open&&technician?form('inspection.record',`${select('Result','outcome',[['not-inspected','Not inspected'],['green','Green'],['yellow','Yellow'],['red','Red']],result?.outcome??'not-inspected')}${item.measurement?(item.measurement.grades?select(`${item.measurement.name} (${item.measurement.unit})`,'measurementGrade',item.measurement.grades.map((g:string)=>[g,g] as [string,string])):field(`${item.measurement.name} (${item.measurement.unit})`,'measurementValue','number','','step="any"')):''}${select('Inspection photo (required for yellow/red)','photoUploadId',[['','Choose a completed photo'],...photos.map(p=>[p.id,p.label] as [string,string])])}<p><a href="/app/jobs/${e(job.id)}/media">Capture a private inspection photo</a>, then return to choose it. Original evidence stays private.</p>${area('Observed evidence / reason (required)','reason','','required maxlength="2000"')}<p>A not-inspected result remains incomplete. Recording again retains every earlier result.</p>`,'Record inspection point',{...values,itemId:item.id,...(item.measurement?{measurementUnit:item.measurement.unit}:{})}):''
  const recipe=item.recipe?rows(state,'inspectionJob').find(r=>r.id===item.recipe.id):null,currentRecipe=recipe?latestInspectionRevision(recipe):null
  const mapped=item.recipe?`<p class="muted">Mapped recipe: ${e(item.recipe.snapshot.name)} · revision ${item.recipe.revision}</p>`:''
  const quote=manager&&open&&result&&['yellow','red'].includes(result.outcome)&&currentRecipe&&(!job.estimateId||rows(state,'estimate').find(q=>q.id===job.estimateId)?.authorisation)?form('inspection.estimate',`<p>Prepare ${e(currentRecipe.name)} at recipe revision ${currentRecipe.n} prices (${currentRecipe.lines.map((l:any)=>`${e(l.quantity)} × ${money(l.unitCents)}`).join(' + ')} before the shop’s current sales tax). Review and approve the resulting draft separately.</p>${area('Estimate notes','notes')}`,'Prepare estimate from finding',{...values,itemId:item.id,resultId:result.id,recipeVersion:recipe.version}):''
  return `<li class="plain"><h3>${e(item.label)}</h3>${recorded}${result?.photo?`<p><a href="/app/jobs/${e(job.id)}/media/view/${e(result.photo.id)}">View recorded inspection photo</a></p>`:''}${mapped}${capture}${quote}</li>`
 }).join('')
 const history=inspection.results.length?`<details><summary>All recorded observations (${inspection.results.length})</summary><ul>${inspection.results.map((r:any)=>`<li>${e(r.item.label)} · ${e(r.outcome)}${r.measurement?` · ${e(r.measurement.name)}: ${e(r.measurement.value)} ${e(r.measurement.unit)}`:''} · ${e(r.reason)} · ${e(r.by.name)} · ${when(r.at)}${r.supersedes?' · Supersedes an earlier observation':''}</li>`).join('')}</ul></details>`:''
 return `<section data-inspection-id="${e(inspection.id)}" data-inspection-complete="${status.complete}"><h3>${e(snapshot.name)} · assigned template revision ${inspection.template.revision}</h3><p>${e(snapshot.vehicle)} · ${e(snapshot.service)}<br>Assigned by ${e(inspection.assignedBy.name)} · ${when(inspection.assignedAt)} · ${e(inspection.reason)}</p><p>${badge(status.complete?'Complete':'Incomplete',status.complete?'green':'amber')} ${status.inspected} of ${status.total} points inspected.</p>${status.incomplete.length?`<ul>${status.incomplete.map(({item,result}:any)=>`<li>${e(item.label)}: ${result?'Not inspected — '+e(result.reason):'No result recorded'}</li>`).join('')}</ul>`:''}<ul class="list">${items}</ul>${history}</section>`
}
export function inspectionPanel(state:any,job:any,actor:Actor,photos:any[]=[]) {
 if(actor.role==='agent')return ''
 if(actor.role==='member'&&actor.id!==job.technicianId)return ''
 const manager=['owner','admin'].includes(actor.role),templates=rows(state,'inspectionTemplate'),assignments=rows(state,'inspection').filter(i=>i.jobId===job.id),open=['booked','working'].includes(job.status)
 let body=assignments.map(i=>assignedChecklist(state,job,i,actor,photos)).join('')||'<p>No digital inspection assigned to this repair.</p>'
 if(manager&&open)body+=`<details><summary>Assign an inspection to the current technician</summary>${templates.map(template=>{const r=latestInspectionRevision(template);return form('inspection.assign',`<p>${e(r.name)} · revision ${r.n} · ${e(r.vehicle)} · ${e(r.service)}</p>${area('Assignment reason','reason','','required maxlength="2000"')}`,'Assign this checklist',{jobId:job.id,version:job.version,templateId:template.id,templateVersion:template.version,templateRevision:r.n,technicianId:job.technicianId})}).join('')||'<p>Create a template below first.</p>'}</details>`
 if(manager)body+=configurations(state,job.id)
 return box('Digital inspections',body,{id:'inspections'})
}
