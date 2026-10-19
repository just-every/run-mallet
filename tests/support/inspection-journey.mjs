import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {inspectionPhoto} from './inspection-photo.mjs'
import {archive,booking,installation,restore} from '../harness.mjs'

export async function inspectionJourney(h) {
 const tech=await h.person('inspection-tech@example.test'),other=await h.person('inspection-other@example.test')
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
 const {job}=await booking(h,{technicianId:tech.id})
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 const currentJob=()=>h.state().then(s=>s.records.job.find(j=>j.id===job.id))
 const nativeForm=async fields=>{
  const response=await h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields).toString()})
  assert.equal(response.status,303,'DVI-001: native configuration form succeeds')
 }
 // A real reusable service recipe is configured through the ordinary form door.
 await nativeForm({command:'inspectionJob.save',version:'0',name:'Front brake service',reason:'Shop brake package',inspectionControlCount:'2',lineKind0:'part',lineDescription0:'Front pad set',lineQuantity0:'1',linePrice0:'60',lineKind1:'labor',lineDescription1:'Replace front pads',lineQuantity1:'1.5',linePrice1:'120'})
 let recipe=(await h.state()).records.inspectionJob[0]
 const originalRecipe=structuredClone(recipe.revisions[0])
 const points=[{id:'front-pads',label:'Front brake pad thickness',measurement:{name:'Pad thickness',unit:'mm'},recipe:{id:recipe.id,revision:1}},{id:'rear-pads',label:'Rear brake pad thickness',measurement:{name:'Pad thickness',unit:'mm'}},{id:'fluid',label:'Brake fluid condition',measurement:{name:'Fluid condition',unit:'grade',grades:['Clear','Cloudy','Contaminated']}}]
 const templateInput={version:0,name:'Brake inspection',vehicle:'Passenger vehicles',service:'Brake service',reason:'Standard brake multipoint inspection',items:points}
 await h.command('inspectionTemplate.save',templateInput,{as:tech.cookie,status:403})
 let template=await h.command('inspectionTemplate.save',templateInput)
 const originalTemplate=structuredClone(template.revisions[0])
 const assign={jobId:job.id,version:(await currentJob()).version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:tech.id,reason:'Inspect brakes before pricing repair'}
 await h.command('inspection.assign',{...assign,technicianId:other.id},{status:409})
 let inspection=await h.command('inspection.assign',assign)
 assert.equal(inspection.technicianId,tech.id)
 assert.deepEqual(inspection.template.snapshot,originalTemplate)
 const record=async(more,options={})=>h.command('inspection.record',{jobId:job.id,version:(await currentJob()).version,inspectionId:inspection.id,inspectionVersion:inspection.version,...more},options)
 const photo=await inspectionPhoto(h,job.id,tech.cookie),rearPhoto=await inspectionPhoto(h,job.id,tech.cookie,'Rear brake pads')
 const front={photoUploadId:photo.id,itemId:'front-pads',outcome:'red',measurementValue:2.5,measurementUnit:'mm',reason:'Measured below the shop replacement criterion'}
 const partial=await h.api('/api/mallet/media/uploads',{findingId:photo.findingId,clientId:crypto.randomUUID(),variant:'shared',originalId:photo.id,filename:'pending-share.png',mime:'image/png',size:1,sha256:'1'.repeat(64),capturedAt:photo.capturedAt},{as:tech.cookie})
 await record({...front,photoUploadId:partial.id},{as:tech.cookie,status:400})
 const another=(await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===job.assetId),technicianId:other.id,bayId:'Other inspection bay',startAt:'2026-10-22T09:00:00Z',endAt:'2026-10-22T10:00:00Z'})).job,otherPhoto=await inspectionPhoto(h,another.id,other.cookie,'Different repair photo')
 await record({...front,photoUploadId:otherPhoto.id},{as:tech.cookie,status:404})
 await record({...front,photoUploadId:otherPhoto.id},{status:400})
 await record(front,{as:other.cookie,status:404})
 await record(front,{status:403}) // An unassigned owner is not the observing technician.
 await record({...front,photoUploadId:'',photo:{id:photo.id}},{as:tech.cookie,status:400})
 await record({...front,reason:''},{as:tech.cookie,status:400})
 await record({...front,measurementValue:null},{as:tech.cookie,status:400})
 await record({...front,measurementUnit:'in'},{as:tech.cookie,status:400})
 await h.command('inspection.record',{jobId:job.id,version:job.version,inspectionId:inspection.id,inspectionVersion:inspection.version,itemId:'unconfigured-point',outcome:'green',reason:'Not on assigned snapshot'},{as:tech.cookie,status:400})
 const beforeResults=inspection.version
 inspection=await record(front,{as:tech.cookie})
 const originalFinding=structuredClone(inspection.results[0])
 await record({...front,inspectionVersion:beforeResults},{as:tech.cookie,status:409})
 inspection=await record({itemId:'rear-pads',outcome:'not-inspected',reason:'Wheel lock key unavailable'},{as:tech.cookie})
 assert.equal(inspection.results.at(-1).measurement,null,'DVI-001: explicit not-inspected needs no invented measurement')
 inspection=await record({itemId:'fluid',outcome:'green',measurementValue:'Clear',measurementUnit:'grade',reason:'Fluid condition visually inspected'},{as:tech.cookie})
 await record({itemId:'fluid',outcome:'yellow',measurementValue:'Invented',measurementUnit:'grade',photoUploadId:photo.id,reason:'Unknown grade refused'},{as:tech.cookie,status:400})
 const snapshotBeforeChange=structuredClone(inspection)
 let view=await h.request('/app/jobs/'+job.id,{as:tech.cookie})
 assert.equal(view.status,200)
 let html=await view.text()
 assert.ok(html.includes('data-inspection-id="'+inspection.id+'"')&&html.includes('data-inspection-complete="false"'),'DVI-001: explicit skipped point stays visibly incomplete')
 assert.ok(html.includes('Wheel lock key unavailable')&&html.includes('2.5'),'DVI-001: measured and uninspected evidence is visible')
 // Updating a reusable template never redefines an assignment already in use.
 template=await h.command('inspectionTemplate.save',{...templateInput,id:template.id,version:template.version,name:'Expanded brake inspection',reason:'Add rotor checks for future visits',items:[...points,{id:'rotor',label:'Rotor thickness',measurement:{name:'Rotor thickness',unit:'mm'}}]})
 await h.command('inspection.assign',assign,{status:409})
 inspection=(await h.state()).records.inspection.find(i=>i.id===inspection.id)
 assert.deepEqual(inspection,snapshotBeforeChange,'DVI-001: template update preserves exact original checklist and completion state')
 assert.deepEqual(template.revisions[0],originalTemplate)
 assert.equal((await h.state({as:tech.cookie})).records.inspection[0].id,inspection.id)
 assert.equal((await h.state({as:other.cookie})).records.inspection.length,0)
 // Current pricing is reviewed explicitly; old mapping and new priced revision both survive.
 recipe=await h.command('inspectionJob.save',{id:recipe.id,version:recipe.version,name:'Front brake service',reason:'Supplier pad cost update',lines:[{kind:'part',description:'Front pad set',quantity:1,unitCents:6500},{kind:'labor',description:'Replace front pads',quantity:1.5,unitCents:12000}]})
 const prepare={jobId:job.id,version:job.version,inspectionId:inspection.id,inspectionVersion:inspection.version,itemId:'front-pads',resultId:originalFinding.id,recipeVersion:recipe.version,notes:'Customer review required'}
 await h.command('inspection.estimate',{...prepare,recipeVersion:1},{status:409})
 await h.command('inspection.estimate',prepare,{as:tech.cookie,status:403})
 await h.command('inspection.estimate',prepare,{as:other.cookie,status:403})
 const quote=await h.command('inspection.estimate',prepare),revision=quote.revisions.at(-1),source=revision.inspectionSource
 assert.equal(quote.status,'draft');assert.equal(revision.approval,null);assert.equal(quote.authorisation,null)
 assert.deepEqual(revision.lines.map(({kind,description,quantity,unitCents})=>({kind,description,quantity,unitCents})),recipe.revisions.at(-1).lines)
 assert.equal(revision.totals.totalCents,24988,'DVI-001: recipe prepares actual USD part/labor estimate with current shop tax')
 assert.equal(source.result.photo.id,photo.id);assert.equal(source.result.photo.sha256,photo.sha256)
 assert.equal(source.inspectionId,inspection.id);assert.equal(source.itemId,'front-pads');assert.deepEqual(source.result,originalFinding)
 assert.deepEqual(source.template.snapshot,originalTemplate)
 assert.deepEqual(source.mappedRecipe.snapshot,originalRecipe);assert.equal(source.mappedRecipe.revision,1)
 assert.equal(source.pricedRecipe.revision,2);assert.deepEqual(source.pricedRecipe.snapshot,recipe.revisions[1])
 const frozenEstimate=structuredClone(quote)
 // Reinspection appends evidence and can complete the original snapshot independently.
 inspection=await record({itemId:'rear-pads',outcome:'yellow',photoUploadId:rearPhoto.id,measurementValue:4,measurementUnit:'mm',reason:'Key supplied; measured rear pads'},{as:tech.cookie})
 inspection=await record({...front,outcome:'yellow',measurementValue:4,reason:'Repeat measurement with calibrated gauge',version:(await currentJob()).version},{as:tech.cookie})
 inspection=await record({itemId:'fluid',outcome:'yellow',measurementValue:'Cloudy',measurementUnit:'grade',photoUploadId:photo.id,reason:'Owner-defined qualitative grade with photo; no invented number'},{as:tech.cookie})
 assert.equal(inspection.results.at(-1).measurement.value,'Cloudy')
 assert.deepEqual(inspection.results[0],originalFinding,'DVI-001: original finding cannot be overwritten')
 assert.equal(inspection.results.find(r=>r.itemId==='front-pads'&&r.supersedes===originalFinding.id).supersedes,originalFinding.id)
 html=await (await h.request('/app/jobs/'+job.id,{as:tech.cookie})).text()
 assert.ok(html.includes('data-inspection-complete="true"'),'DVI-001: all original points inspected despite larger new template')
 assert.deepEqual((await h.state()).records.estimate.find(q=>q.id===quote.id),frozenEstimate)
 await h.command('inspection.estimate',{...prepare,version:(await currentJob()).version,inspectionVersion:inspection.version},{status:409})
 const key=await h.command('agent.create',{label:'No native inspection authority'}),agent={as:'',headers:{authorization:'Bearer '+key.token},status:403}
 const agentState=await h.state({...agent,status:200});assert.equal(agentState.records.inspection,undefined);assert.equal(agentState.records.inspectionTemplate,undefined);assert.equal(agentState.records.inspectionJob,undefined);assert.ok(!agentState.records.event.some(e=>e.kind.startsWith('inspection')));assert.ok(agentState.records.estimate.every(q=>q.revisions.every(r=>!('inspectionSource' in r))))
 for(const command of ['inspectionJob.save','inspectionTemplate.save','inspection.assign','inspection.record','inspection.estimate'])await h.command(command,{},agent)
 await h.command('inspection.record',{...prepare,inspectionVersion:inspection.version,outcome:'red',reason:'Cross-origin attempt'},{as:tech.cookie,headers:{origin:'https://elsewhere.test'},status:403})
 const beforeRevocation=structuredClone((await h.state()).records)
 await h.api('/auth/operator/status',{operatorId:tech.id,status:'inactive'})
 await record(front,{as:tech.cookie,status:401})
 assert.deepEqual((await h.state()).records,beforeRevocation,'DVI-001: revoked observation writes nothing')
 // The same real archive/restore doors preserve all reusable and assigned revisions.
 const original=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'inspection-recovery@example.test'}})
 try {
  await restore(fresh,backup)
  const restored=(await fresh.state()).records
  for(const kind of ['inspectionJob','inspectionTemplate','inspection','estimate'])assert.deepEqual(restored[kind],original[kind],'DVI-001 / OPS-001: exact '+kind+' history restored')
  const ready=await fresh.mf.dispatchFetch(fresh.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:fresh.origin,cookie:fresh.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(ready.status,303)
  const recovered=await fresh.request('/app/jobs/'+job.id)
  assert.equal(recovered.status,200)
  assert.ok((await recovered.text()).includes('data-inspection-complete="true"'))
  const restoredPhoto=await fresh.request(photo.contentUrl);assert.equal(restoredPhoto.status,200);assert.equal(createHash('sha256').update(Buffer.from(await restoredPhoto.arrayBuffer())).digest('hex'),photo.sha256)
  await fresh.state({as:h.owner,status:401})
  await fresh.state({as:'',headers:{authorization:'Bearer '+key.token},status:401})
 } finally {await fresh.close()}
}
