import assert from 'node:assert/strict'
import {archive,booking,installation,restore} from '../harness.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'

export function assertFindingOrigin(quote,expected){
 assert.equal(quote.jobId,expected.jobId,'The saved estimate belongs to the inspected repair')
 const source=quote.revisions[0].inspectionSource
 assert.equal(source.inspectionId,expected.inspectionId,'The estimate cites the recorded inspection')
 assert.equal(source.inspectionVersion,expected.inspectionVersion,'The estimate freezes the finding inspection version')
 assert.equal(source.itemId,expected.itemId,'The estimate cites the inspected item')
 assert.equal(source.result.id,expected.result.id,'The estimate cites the exact recorded result')
 assert.deepEqual(source.result,expected.result,'The observed finding is retained without substitution')
 assert.deepEqual(source.template,expected.template,'The assigned inspection template is frozen')
 assert.deepEqual(source.mappedRecipe,expected.mappedRecipe,'The original mapped package revision is retained')
 assert.deepEqual(source.pricedRecipe,expected.pricedRecipe,'The separately selected current package revision is priced')
}

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
 const mappedRecipe={id:recipe.id,revision:1,snapshot:structuredClone(recipe.revisions[0])}
 const template=await h.command('inspectionTemplate.save',{version:0,name:'Service intake',vehicle:'Passenger vehicles',service:'Maintenance',reason:'Document service need',items:[{id:'oil',label:'Engine oil condition',measurement:{name:'Oil condition',unit:'grade',grades:['Clean','Due']},recipe:{id:recipe.id,revision:1}}]})
 let assignment=await h.command('inspection.assign',{jobId:job.id,version:job.version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:tech.id,reason:'Review oil condition'})
 const photo=await inspectionPhoto(h,job.id,tech.cookie,'Oil condition')
 assignment=await h.command('inspection.record',{jobId:job.id,version:job.version,inspectionId:assignment.id,inspectionVersion:assignment.version,itemId:'oil',outcome:'yellow',measurementValue:'Due',measurementUnit:'grade',photoUploadId:photo.id,reason:'Measured oil condition requires service'},{as:tech.cookie})
 // The finding keeps its original mapping while preparation uses the current package.
 recipe=await h.command('inspectionJob.save',{...recipeInput,id:recipe.id,version:recipe.version,name:'Oil service reviewed',reason:'Review package before pricing the finding'})
 const origin={jobId:job.id,inspectionId:assignment.id,inspectionVersion:assignment.version,itemId:'oil',result:structuredClone(assignment.results[0]),template:structuredClone(assignment.template),mappedRecipe,pricedRecipe:{id:recipe.id,revision:2,snapshot:structuredClone(recipe.revisions[1])}}
 const beforeRefusal=(await h.state()).records
 const input={jobId:job.id,version:job.version,inspectionId:assignment.id,inspectionVersion:assignment.version,itemId:'oil',resultId:assignment.results[0].id,recipeVersion:recipe.version,overrides:[{lineIndex:1,unitCents:1200,reason:'Owner approved matching advertised filter price'}]}
 await h.command('inspection.estimate',{...input,overrides:[{lineIndex:1,unitCents:1200,reason:''}]},{status:400})
 for(const kind of ['job','inspection','estimate','inspectionJob','pricingMatrix'])assert.deepEqual((await h.state()).records[kind],beforeRefusal[kind],'A missing override reason changes no '+kind)
 await h.command('inspection.estimate',input,{as:tech.cookie,status:403})
 for(const kind of ['job','inspection','estimate','inspectionJob','pricingMatrix'])assert.deepEqual((await h.state()).records[kind],beforeRefusal[kind],'A technician price override changes no '+kind)
 const prepared=await h.command('inspection.estimate',input)
 const quote=(await h.api('/api/mallet/repairs/'+job.id)).records.estimate.find(q=>q.id===prepared.id),rev=quote.revisions[0],source=rev.inspectionSource
 assert.deepEqual(quote,prepared,'The public repair door reloads the complete prepared estimate')
 assertFindingOrigin(quote,origin)
 assert.deepEqual(rev.lines.map(l=>l.unitCents),[750,1200,11000],'EST-002 cost bands, minimum and labor matrix determine actual quote')
 assert.deepEqual(rev.lines.map(l=>l.quantity),[5,1,.5],'Cost pricing preserves the package quantities')
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
 assertFindingOrigin((await h.api('/api/mallet/repairs/'+job.id)).records.estimate.find(q=>q.id===quote.id),origin)
 const native=(await h.state()).records.asset.find(a=>a.id===asset.id),next=(await booking(h,{asset:native,technicianId:tech.id,startAt:'2026-11-01T09:00:00Z',endAt:'2026-11-01T10:00:00Z'})).job
 const current=await h.command('recipe.prepare',{jobId:next.id,version:next.version,recipeId:recipe.id,recipeVersion:recipe.version})
 assert.deepEqual(current.revisions[0].lines.map(l=>l.unitCents),[2000,2000,11000],'EST-002 ordinary package uses current matrix rules')
 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);const restored=await fresh.state();assert.deepEqual(restored.records.pricingMatrix,(await h.state()).records.pricingMatrix);assert.deepEqual(restored.records.inspectionJob,(await h.state()).records.inspectionJob);assert.deepEqual(restored.records.inspection,(await h.state()).records.inspection);assert.deepEqual(restored.records.estimate,(await h.state()).records.estimate);assertFindingOrigin((await fresh.api('/api/mallet/repairs/'+job.id)).records.estimate.find(q=>q.id===quote.id),origin);assert.notEqual(restored.actor.id,owner.id,'EST-002 restore grants fresh authority only');await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
 return {job,quote,recipe,matrix,labor,tech,origin}
}
