import {onCrew} from './collaboration'
import {priceRecipe} from './pricing'
import {bump,choice,event,expectVersion,fail,find,integer,object,put,text,who,type Context,type Handler,type Row} from './model'
import {quantity} from './money'
import {estimates} from './estimates'
import {openJob} from './workshop'

export type InspectionRecipeLine = {kind:'part'|'labor';description:string;quantity:number;unitCents:number;costCents?:number;matrixId?:string}
export type InspectionItem = {id:string;label:string;measurement:null|{name:string;unit:string;grades?:string[]};recipe:null|{id:string;revision:number;snapshot:any}}
export const inspectionCommands = ['inspectionJob.save','inspectionTemplate.save','inspection.assign','inspection.record','inspection.estimate','recipe.prepare'] as const
export const inspectionMemberCommands = ['inspection.record'] as const
export const latestInspectionRevision = (row:Row) => row.revisions.at(-1)
const manager = (c:Context) => {
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or service advisor must manage inspection templates, assignments and estimates.',null,403)
}
function recipeLines(value:unknown):InspectionRecipeLine[] {
 if(!Array.isArray(value)||!value.length||value.length>100)fail('INPUT','Provide 1–100 service recipe lines.',null,400)
 return value.map(raw=>{
  const line=object(raw,'service recipe line')
  if((line.matrixId!=null)!==(line.costCents!=null))fail('INPUT','Provide both base cost and pricing matrix.',null,400)
  return {kind:choice(line.kind,['part','labor'],'line kind'),description:text(line.description,'line description',500),quantity:quantity(line.quantity)/1000,unitCents:integer(line.unitCents,'unitCents'),...(line.matrixId?{matrixId:text(line.matrixId,'matrixId'),costCents:integer(line.costCents,'costCents')}:{})}
 })
}
function templateItems(c:Context,value:unknown):InspectionItem[] {
 if(!Array.isArray(value)||!value.length||value.length>100)fail('INPUT','Provide 1–100 inspection points.',null,400)
 const items=value.map(raw=>{
  const item=object(raw,'inspection point'),measure=item.measurement==null?null:object(item.measurement,'measurement')
  let recipe:InspectionItem['recipe']=null
  if(item.recipe!=null) {
   const mapping=object(item.recipe,'service recipe mapping'),source=find(c.s,'inspectionJob',mapping.id)
   const revision=integer(mapping.revision,'recipe revision',1)
   const snapshot=source.revisions.find((r:any)=>r.n===revision)
   if(!snapshot)fail('INPUT','Choose an existing service recipe revision.',null,400)
   recipe={id:source.id,revision,snapshot:structuredClone(snapshot)}
  }
  let grades:string[]|undefined
  if(measure?.grades!==undefined){if(!Array.isArray(measure.grades)||measure.grades.length<2||measure.grades.length>20)fail('INPUT','Define 2–20 grade labels.',null,400);grades=measure.grades.map((g:unknown)=>text(g,'grade label',80));if(new Set(grades).size!==grades.length)fail('INPUT','Grade labels must be unique.',null,400)}
  return {id:item.id==null?crypto.randomUUID():text(item.id,'inspection point id',100),label:text(item.label,'inspection point',200),measurement:measure?{name:text(measure.name,'measurement name',100),unit:text(measure.unit,'measurement unit',40),...(grades?{grades}:{})}:null,recipe}
 })
 if(new Set(items.map(item=>item.id)).size!==items.length)fail('INPUT','Inspection point IDs must be unique.',null,400)
 return items
}
function saveRevision(c:Context,kind:'inspectionJob'|'inspectionTemplate',p:any,fields:Record<string,any>) {
 const row=p.id?find(c.s,kind,p.id):null
 if(row)expectVersion(row,p.version)
 else if(integer(p.version,'version',0)!==0)fail('VERSION','New reusable inspection records require version zero.')
 const revision={...fields,n:row?latestInspectionRevision(row).n+1:1,reason:text(p.reason,'revision reason',2000),at:c.now,by:who(c)}
 const saved=row?bump(c.s,kind,row,{revisions:[...row.revisions,revision]}):put(c.s,kind,{revisions:[revision],createdAt:c.now})
 event(c,kind==='inspectionJob'?'inspectionJob.save':'inspectionTemplate.save',null,saved.id,revision)
 return saved
}
export function inspectionStatus(inspection:Row) {
 const items=inspection.template.snapshot.items.map((item:InspectionItem)=>({item,result:[...inspection.results].reverse().find((r:any)=>r.itemId===item.id)??null}))
 const incomplete=items.filter(({result}:any)=>!result||result.outcome==='not-inspected')
 return {items,incomplete,complete:incomplete.length===0,inspected:items.length-incomplete.length,total:items.length}
}
function assignment(c:Context,p:any) {
 const job=openJob(c,p),inspection=find(c.s,'inspection',p.inspectionId)
 if(inspection.jobId!==job.id)fail('NOT_FOUND','That inspection does not belong to this repair.',null,404)
 expectVersion(inspection,p.inspectionVersion)
 return {job,inspection}
}
export const inspections:Handler=(c,command,p)=>{
 if(!(inspectionCommands as readonly string[]).includes(command))return
 if(c.actor.role==='agent')fail('FORBIDDEN','Inspection records require a native staff session.',null,403)
 if(command!=='inspection.record')manager(c)
 if(command==='inspectionJob.save') {
  const lines=recipeLines(p.lines);priceRecipe(c,lines)
  let inspectionTemplate=null
  if(p.inspectionTemplateId){const template=find(c.s,'inspectionTemplate',p.inspectionTemplateId),revision=integer(p.inspectionTemplateRevision,'inspection template revision',1),snapshot=template.revisions.find((r:any)=>r.n===revision);if(!snapshot)fail('INPUT','Choose an existing inspection template revision.',null,400);inspectionTemplate={id:template.id,revision,snapshot:structuredClone(snapshot)}}
  return saveRevision(c,'inspectionJob',p,{name:text(p.name,'service recipe name'),lines,inspectionTemplate})
 }
 if(command==='recipe.prepare') {
  const job=openJob(c,p),recipe=find(c.s,'inspectionJob',p.recipeId);expectVersion(recipe,p.recipeVersion)
  return preparePackage(c,p,job,recipe,null)
 }
 if(command==='inspectionTemplate.save')return saveRevision(c,'inspectionTemplate',p,{name:text(p.name,'template name'),vehicle:text(p.vehicle,'vehicle applicability',200),service:text(p.service,'service applicability',200),items:templateItems(c,p.items)})
 if(command==='inspection.assign') {
  const job=openJob(c,p),template=find(c.s,'inspectionTemplate',p.templateId)
  expectVersion(template,p.templateVersion)
  const revision=integer(p.templateRevision,'template revision',1),snapshot=template.revisions.find((r:any)=>r.n===revision)
  if(!snapshot)fail('INPUT','Choose an existing inspection template revision.',null,400)
  const technicianId=text(p.technicianId,'assigned technician')
  if(technicianId!==job.technicianId)fail('INSPECTION_ASSIGNMENT','Assign the inspection to this repair’s current technician.')
  const row=put(c.s,'inspection',{jobId:job.id,technicianId,template:{id:template.id,revision,snapshot:structuredClone(snapshot)},assignedAt:c.now,assignedBy:who(c),reason:text(p.reason,'assignment reason',2000),results:[]})
  event(c,command,job.id,row.id,{template:row.template,technicianId,reason:row.reason})
  return row
 }
 const {job,inspection}=assignment(c,p)
 const item:InspectionItem|undefined=inspection.template.snapshot.items.find((i:InspectionItem)=>i.id===p.itemId)
 if(!item)fail('INPUT','Choose a point on this assigned inspection snapshot.',null,400)
 if(command==='inspection.record') {
  if(!onCrew(job,c.actor.id))fail('FORBIDDEN','Only this repair’s current crew may record inspection results.',null,403)
  const outcome=choice(p.outcome,['green','yellow','red','not-inspected'],'inspection result'),reason=text(p.reason,'inspection result reason',2000)
  let measurement:null|{name:string;value:number|string;unit:string;grades?:string[]}=null
  const supplied=p.measurementValue!==undefined&&p.measurementValue!==null&&p.measurementValue!==''
  if(item.measurement&&outcome!=='not-inspected'&&!supplied)fail('INPUT','Record the named measurement before marking this point inspected.',null,400)
  if(supplied) {
   if(!item.measurement)fail('INPUT','This point has no configured measurement.',null,400)
   if(item.measurement.grades){if(typeof p.measurementValue!=='string'||!item.measurement.grades.includes(p.measurementValue))fail('INPUT','Choose one of the exact configured grade labels.',null,400)}
   else if(typeof p.measurementValue!=='number'||!Number.isFinite(p.measurementValue)||Math.abs(p.measurementValue)>1e12)fail('INPUT','Provide a finite measured value in the configured unit.',null,400)
   if(p.measurementUnit!==item.measurement.unit)fail('INPUT','Use the exact measurement unit from this assigned checklist.',null,400)
   measurement={...item.measurement,value:p.measurementValue}
  }
  const photo=p.photo??null
  if(['yellow','red'].includes(outcome)&&(!measurement||!photo))fail('INSPECTION_EVIDENCE','Yellow and red points require an exact measurement and a completed photo from this repair.',null,400)
  const previous=[...inspection.results].reverse().find((r:any)=>r.itemId===item.id)
  const result={id:crypto.randomUUID(),itemId:item.id,item:structuredClone(item),outcome,measurement,photo,reason,by:who(c),at:c.now,supersedes:previous?.id??null}
  const saved=bump(c.s,'inspection',inspection,{results:[...inspection.results,result]})
  event(c,command,job.id,saved.id,result)
  return saved
 }
 const result=inspection.results.find((r:any)=>r.id===p.resultId&&r.itemId===item.id)
 if(!result||!['yellow','red'].includes(result.outcome))fail('INSPECTION_FINDING','Choose a recorded yellow or red inspection finding.')
 const current=[...inspection.results].reverse().find((r:any)=>r.itemId===item.id)
 if(current.id!==result.id)fail('INSPECTION_FINDING','This finding has a newer observation. Review the current result.')
 if(!item.recipe)fail('INSPECTION_RECIPE','This inspection point has no mapped service recipe.')
 const recipe=find(c.s,'inspectionJob',item.recipe.id)
 expectVersion(recipe,p.recipeVersion)
 return preparePackage(c,p,job,recipe,{inspectionId:inspection.id,inspectionVersion:inspection.version,itemId:item.id,result:structuredClone(result),template:structuredClone(inspection.template),mappedRecipe:structuredClone(item.recipe)})
}
function preparePackage(c:Context,p:any,job:Row,recipe:Row,finding:any) {
 const priced=latestInspectionRevision(recipe),calculation=priceRecipe(c,priced.lines,p)
 const source:any={...finding,pricedRecipe:{id:recipe.id,revision:priced.n,snapshot:structuredClone(priced)},pricing:calculation.provenance,preparedAt:c.now,preparedBy:who(c)}
 const quote=estimates(c,'estimate.prepare',{jobId:job.id,version:job.version,lines:calculation.lines,notes:text(p.notes,'estimate notes',4000,true),...(job.estimateId?{supplement:true,reason:finding?`Inspection finding: ${finding.result.item.label}`:text(p.reason,'supplement reason',2000)}:{})})
 if(priced.inspectionTemplate) {
  const mapping=priced.inspectionTemplate
  const assigned=put(c.s,'inspection',{jobId:job.id,technicianId:job.technicianId,template:structuredClone(mapping),assignedAt:c.now,assignedBy:who(c),reason:`Service package: ${priced.name}`,results:[]})
  source.packageInspection={id:assigned.id,template:structuredClone(mapping)}
  event(c,'inspection.assign',job.id,assigned.id,{template:assigned.template,technicianId:job.technicianId,reason:assigned.reason})
 }
 const revisions=quote.revisions.map((revision:any,n:number)=>n===quote.revisions.length-1?{...revision,inspectionSource:source}:revision)
 const saved=bump(c.s,'estimate',quote,{revisions})
 event(c,finding?'inspection.estimate':'recipe.prepare',job.id,saved.id,{revision:latestInspectionRevision(saved).n,inspectionSource:source})
 return saved
}
