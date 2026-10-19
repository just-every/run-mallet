import assert from 'node:assert/strict'
import {archive,booking,installation,restore} from '../harness.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'
export async function pricingJourney(h,{person=h.person}={}){
 const tech=await person('pricing-tech@example.test'),owner=(await h.state()).actor
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
 const asset=await h.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V EX',identifier:'OH-OIL-4471'})
 const {job}=await booking(h,{asset,technicianId:tech.id})
 const matrixInput={version:0,name:'Oil supplies matrix',kind:'part',minimumCents:750,roundingCents:25,reason:'Counter oil supplies pricing',bands:[{fromCents:0,toCents:1000,markupBps:5000},{fromCents:1000,toCents:null,markupBps:2500}]}
 await h.command('pricing.save',matrixInput,{as:tech.cookie,status:403})
 let matrix=await h.command('pricing.save',matrixInput)
 const labor=await h.command('pricing.save',{...matrixInput,name:'Shop hourly matrix',kind:'labor',minimumCents:9000,roundingCents:100,bands:[{fromCents:0,toCents:null,markupBps:10000}]})
 const inspection=await h.command('inspectionTemplate.save',{version:0,name:'Oil service completion inspection',vehicle:'Passenger vehicles',service:'Oil service',reason:'Oil service package',items:[{id:'level',label:'Oil level after service'}]})
 const recipeInput={version:0,name:'Oil service',reason:'Versioned oil package',inspectionTemplateId:inspection.id,inspectionTemplateRevision:1,lines:[{kind:'part',description:'Engine oil 5W-30',quantity:5,unitCents:0,costCents:334,matrixId:matrix.id},{kind:'part',description:'Oil filter',quantity:1,unitCents:0,costCents:1000,matrixId:matrix.id},{kind:'labor',description:'Oil and filter service',quantity:.5,unitCents:0,costCents:5500,matrixId:labor.id}]}
 let recipe=await h.command('inspectionJob.save',recipeInput)
 const template=await h.command('inspectionTemplate.save',{version:0,name:'Service intake',vehicle:'Passenger vehicles',service:'Maintenance',reason:'Document service need',items:[{id:'oil',label:'Engine oil condition',measurement:{name:'Oil condition',unit:'grade',grades:['Clean','Due']},recipe:{id:recipe.id,revision:1}}]})
 let assignment=await h.command('inspection.assign',{jobId:job.id,version:job.version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:tech.id,reason:'Review oil condition'})
 const photo=await inspectionPhoto(h,job.id,tech.cookie,'Oil condition')
 assignment=await h.command('inspection.record',{jobId:job.id,version:job.version,inspectionId:assignment.id,inspectionVersion:assignment.version,itemId:'oil',outcome:'yellow',measurementValue:'Due',measurementUnit:'grade',photoUploadId:photo.id,reason:'Measured oil condition requires service'},{as:tech.cookie})
 const input={jobId:job.id,version:job.version,inspectionId:assignment.id,inspectionVersion:assignment.version,itemId:'oil',resultId:assignment.results[0].id,recipeVersion:recipe.version,overrides:[{lineIndex:1,unitCents:1200,reason:'Owner approved matching advertised filter price'}]}
 await h.command('inspection.estimate',{...input,overrides:[{lineIndex:1,unitCents:1200,reason:''}]},{status:400})
 await h.command('inspection.estimate',input,{as:tech.cookie,status:403})
 const quote=await h.command('inspection.estimate',input),rev=quote.revisions[0],source=rev.inspectionSource
 assert.deepEqual(rev.lines.map(l=>l.unitCents),[750,1200,11000],'EST-002 cost bands, minimum and labor matrix determine actual quote')
 assert.deepEqual(source.pricing.map(p=>p.calculatedCents),[750,1250,11000])
 assert.equal(source.pricing[0].markedCents,501);assert.equal(source.pricing[0].roundedCents,525)
 assert.equal(source.pricing[1].bandIndex,1,'EST-002 lower band bound inclusive')
 assert.equal(source.pricing[1].override.by.id,owner.id);assert.equal(source.pricing[1].override.reason,input.overrides[0].reason)
 assert.equal(rev.totals.totalCents,10821);assert.equal(quote.status,'draft');assert.equal(quote.authorisation,null)
 assert.equal((await h.state()).records.inspection.find(i=>i.id===source.packageInspection.id).template.snapshot.name,'Oil service completion inspection')
 const before=structuredClone(quote)
 matrix=await h.command('pricing.save',{...matrixInput,id:matrix.id,version:matrix.version,reason:'New supplier prices',minimumCents:2000})
 recipe=await h.command('inspectionJob.save',{...recipeInput,id:recipe.id,version:recipe.version,name:'Oil service current',reason:'Package description update'})
 assert.deepEqual((await h.state()).records.estimate.find(q=>q.id===quote.id),before,'EST-002 matrix/package edits preserve original complete estimate')
 const native=(await h.state()).records.asset.find(a=>a.id===asset.id),next=(await booking(h,{asset:native,technicianId:tech.id,startAt:'2026-11-01T09:00:00Z',endAt:'2026-11-01T10:00:00Z'})).job
 const current=await h.command('recipe.prepare',{jobId:next.id,version:next.version,recipeId:recipe.id,recipeVersion:recipe.version})
 assert.deepEqual(current.revisions[0].lines.map(l=>l.unitCents),[2000,2000,11000],'EST-002 ordinary package uses current matrix rules')
 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);const restored=await fresh.state();assert.deepEqual(restored.records.pricingMatrix,(await h.state()).records.pricingMatrix);assert.deepEqual(restored.records.inspectionJob,(await h.state()).records.inspectionJob);assert.deepEqual(restored.records.inspection,(await h.state()).records.inspection);assert.deepEqual(restored.records.estimate,(await h.state()).records.estimate);assert.notEqual(restored.actor.id,owner.id,'EST-002 restore grants fresh authority only')}finally{await fresh.close()}
 return {job,quote,recipe,matrix,labor,tech}
}
