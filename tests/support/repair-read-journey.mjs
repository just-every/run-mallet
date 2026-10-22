import assert from 'node:assert/strict'
import {archive,assetInput,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'

/** Public single-RO read with real decisions, inspection custody, history and fresh-owner restore. */
export async function repairReadJourney(){
 const h=await installation()
 try{
  await shopSetup(h)
  const tech=await h.person('repair-read-tech@example.test'),helper=await h.person('repair-read-helper@example.test'),other=await h.person('repair-read-other@example.test')
  const asset=await h.command('asset.create',{...assetInput('READ-ROOT'),customerName:'Read journey customer',label:'Read journey vehicle'})
  const prior=(await booking(h,{asset,technicianId:tech.id,startAt:'2026-10-18T09:00:00Z',endAt:'2026-10-18T10:00:00Z'})).job
  const priorDraft=await estimate(h,prior),priorDecision=await authorise(h,priorDraft,[priorDraft.revisions[0].lines[1].id])
  const oldReading=await h.command('reading.record',{jobId:prior.id,version:(await h.state()).records.job.find(row=>row.id===prior.id).version,value:50000,unit:'miles',stage:'intake',observedAt:'2026-10-18T09:00:00Z'})
  const declined=await h.command('decline.record',{estimateId:priorDecision.id,version:priorDecision.version,lineId:priorDecision.revisions[0].lines[0].id,readingId:oldReading.id,disposition:'deferred',reason:'Customer will return for pads',evidence:'Recorded paper decision',dueValue:55000})
  const refreshedAsset=(await h.state()).records.asset.find(row=>row.id===asset.id)
  const root=(await booking(h,{asset:refreshedAsset,technicianId:tech.id,startAt:'2026-10-19T09:00:00Z',endAt:'2026-10-19T11:00:00Z'})).job
  const current=async()=>(await h.state()).records.job.find(row=>row.id===root.id)
  await h.command('crew.add',{jobId:root.id,version:(await current()).version,technicianId:helper.id})
  const reading=await h.command('reading.record',{jobId:root.id,version:(await current()).version,value:51000,unit:'miles',stage:'intake',observedAt:'2026-10-19T09:00:00Z'})
  const template=await h.command('inspectionTemplate.save',{version:0,name:'Read journey brake inspection',vehicle:'Passenger vehicle',service:'Brake repair',reason:'Shop inspection standard',items:[{id:'pads',label:'Front pad thickness',measurement:{name:'Pad thickness',unit:'mm'}}]})
  let inspection=await h.command('inspection.assign',{jobId:root.id,version:(await current()).version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:tech.id,reason:'Measure the returned vehicle'})
  const photo=await inspectionPhoto(h,root.id,tech.cookie,'Read journey front pad')
  inspection=await h.command('inspection.record',{jobId:root.id,version:(await current()).version,inspectionId:inspection.id,inspectionVersion:inspection.version,itemId:'pads',outcome:'yellow',measurementValue:4,measurementUnit:'mm',photoUploadId:photo.id,reason:'Measured pad wear and retained original photo'},{as:tech.cookie})
  const decision=await authorise(h,await estimate(h,await current()))
  await h.command('work.record',{jobId:root.id,version:(await current()).version,estimateId:decision.id,revision:1,lineId:decision.revisions[0].lines[0].id,quantity:1,note:'Authorized replacement started'},{as:tech.cookie})
  const secretAsset=await h.command('asset.create',{...assetInput('READ-PRIVATE'),customerName:'Unrelated secluded customer',customerEmail:'secluded@example.test',label:'Unrelated private vehicle'})
  const unrelated=(await booking(h,{asset:secretAsset,technicianId:other.id,bayId:'Private bay',startAt:'2026-10-19T09:00:00Z',endAt:'2026-10-19T10:00:00Z'})).job
  await estimate(h,unrelated)
  const path='/api/mallet/repairs/'+root.id
  const assertCore=body=>{
   assert.ok(body.records,'Native single-RO response contains its State graph')
   assert.deepEqual(body.records.estimate.find(row=>row.id===decision.id),decision)
   assert.deepEqual(body.records.inspection.find(row=>row.id===inspection.id),inspection)
   assert.deepEqual(body.records.reading.find(row=>row.id===reading.id),reading)
   const job=body.records.job.find(row=>row.id===root.id)
   assert.equal(job.actuals.length,1);assert.equal(job.actuals[0].estimateId,decision.id)
   assert.deepEqual(body.records.estimate.find(row=>row.id===decision.id).authorisation,decision.authorisation)
   assert.equal(body.records.inspection[0].results[0].photo.sha256,photo.sha256)
   const raw=JSON.stringify(body)
   for(const forbidden of [unrelated.id,secretAsset.id,'Unrelated secluded customer','secluded@example.test','Unrelated private vehicle'])assert.ok(!raw.includes(forbidden),'Unrelated customer/RO is excluded: '+forbidden)
  }
  await h.api(path,undefined,{as:'',status:401})
  await h.api(path,undefined,{as:other.cookie,status:404})
  const ownerView=await h.api(path);assertCore(ownerView)
  assert.deepEqual(ownerView.records.reading.find(row=>row.id===oldReading.id),oldReading)
  assert.deepEqual(ownerView.records.declinedWork.find(row=>row.id===declined.id),declined)
  assert.deepEqual(ownerView.records.estimate.find(row=>row.id===priorDecision.id),priorDecision)
  assert.ok(ownerView.records.asset.find(row=>row.id===asset.id).visits.includes(prior.id))
  assertCore(await h.api(path,undefined,{as:tech.cookie}))
  assertCore(await h.api(path,undefined,{as:helper.cookie}))
  // Reading a graph neither records a new decision nor changes work/history.
  const again=await h.api(path);assert.deepEqual(again.records,ownerView.records)
  const target=await installation()
  try{
   await restore(target,await archive(h))
   const restored=await target.api(path);assertCore(restored)
   assert.deepEqual(restored.records,ownerView.records)
   assert.notEqual((await target.state()).actor.id,(await h.state()).actor.id,'Restore uses fresh native owner authority')
   await target.api(path,undefined,{as:tech.cookie,status:401})
   await target.api(path,undefined,{as:h.owner,status:401})
  }finally{await target.close()}
 }finally{await h.close()}
}
