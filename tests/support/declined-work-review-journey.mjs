import assert from 'node:assert/strict'
import {archive,restore,installation} from '../harness.mjs'
import {declinedFixture} from './outreach-journey.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'
const address=n=>['synthetic-mallet-'+n,'example.test'].join('@')
export async function declinedReviewFixture(h){
 const f=await declinedFixture(h),job=()=>h.state().then(s=>s.records.job.find(j=>j.id===f.job.id))
 const reading=await h.command('reading.record',{jobId:f.job.id,version:(await job()).version,stage:'intake',unit:'miles',value:1350,observedAt:'2026-10-02T09:00:00Z'})
 const template=await h.command('inspectionTemplate.save',{version:0,name:'Declined brake review',vehicle:'Passenger vehicle',service:'Brakes',reason:'Review the later observation',items:[{id:'pads',label:'Front brake pads',measurement:{name:'Pad thickness',unit:'mm'}}]})
 let inspection=await h.command('inspection.assign',{jobId:f.job.id,version:(await job()).version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:(await job()).technicianId,reason:'Later inspection after customer declined pads'})
 const photo=await inspectionPhoto(h,f.job.id,h.owner)
 const record=async(outcome,value)=>inspection=await h.command('inspection.record',{jobId:f.job.id,version:(await job()).version,inspectionId:inspection.id,inspectionVersion:inspection.version,itemId:'pads',outcome,measurementValue:value,measurementUnit:'mm',photoUploadId:photo.id,reason:'Later measured pad evidence '+value})
 await record('red',2.5);const originalResult=inspection.results.at(-1)
 await record('yellow',3.5)
 return {...f,reading,inspection,originalResult,record,jobNow:job,findingKey:inspection.id+':pads'}
}
export async function declinedReviewJourney(){
 const h=await installation()
 try{
  const f=await declinedReviewFixture(h),itemId=f.item.id,packet=()=>h.state().then(s=>s.records.declinedReview?.find(r=>r.declinedWorkId===itemId))
  const input={jobId:f.job.id,declinedWorkId:itemId,itemVersion:f.item.version,version:0,findingKey:f.findingKey}
  const admin=await h.person(address(810),'admin'),member=await h.person(address(811)),key=await h.command('agent.create',{label:'synthetic-mallet-812'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
  const beforeDenied=(await h.state()).records
  for(const command of ['declineReview.refresh','declineReview.prepare']){
   for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,input,options)
  }
  assert.deepEqual((await h.state()).records,beforeDenied)
  let r=await h.command('declineReview.refresh',input,{as:admin.cookie}),rev=r.revisions[0]
  assert.deepEqual(rev.decision.customer,f.item.decision)
  assert.equal(rev.reading.id,f.reading.id);assert.equal(rev.threshold.distance,true)
  assert.equal(rev.inspections[0].result.id,f.inspection.results.at(-1).id)
  assert.equal(rev.inspections[0].result.measurement.value,3.5)
  assert.notEqual(rev.inspections[0].result.id,f.originalResult.id)
  assert.deepEqual(rev.eligibility,{licensedSchedule:'unknown',consent:'unknown',availability:'unknown'})
  assert.ok(rev.citations.some(c=>c.kind==='estimate'&&c.id===f.quote.id&&c.version===f.quote.version))
  const refresh=async(options={})=>h.command('declineReview.refresh',{...input,version:(await packet()).version},options)
  const prepare=async(options={})=>h.command('declineReview.prepare',{...input,version:(await packet()).version,estimateId:f.quote.id},options)
  r=await refresh();assert.equal(r.revisions.length,1,'Same capture does not duplicate history')
  const baseline=(await h.state()).records,messages=h.messages.length
  r=await prepare();assert.equal(r.offers.length,1);assert.equal(r.offers[0].line.totalCents,f.quote.revisions[0].lines[0].totalCents)
  r=await prepare();assert.equal(r.offers.length,1)
  for(const kind of ['estimate','job','asset','declinedWork','appointment'])assert.deepEqual((await h.state()).records[kind],baseline[kind],'Advisory preparation changes no '+kind)
  assert.equal(h.messages.length,messages)
  // Every material source family is changed through its ordinary command door.
  const stale=async()=>{const before=(await h.state()).records;assert.equal((await prepare({status:409})).error,'REVIEW_STALE');assert.deepEqual((await h.state()).records,before);r=await refresh()}
  await h.command('reading.record',{jobId:f.job.id,version:(await f.jobNow()).version,stage:'intake',unit:'miles',value:1150,observedAt:'2026-10-02T09:00:00Z',corrects:f.reading.id,reason:'Correct transcribed mileage from retained odometer image'})
  await stale();assert.equal(r.revisions.at(-1).threshold.distance,false);assert.notEqual(r.revisions.at(-1).reading.id,f.reading.id)
  await f.record('yellow',4);await stale();assert.equal(r.revisions.at(-1).inspections[0].result.measurement.value,4)
  const q=await h.command('estimate.revise',{estimateId:f.quote.id,version:f.quote.version,revision:1,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:3500}],notes:'Current supplier price'})
  await stale();assert.equal(r.revisions.at(-1).quotes[0].line.totalCents,q.revisions.at(-1).lines[0].totalCents)
  let a=(await h.state()).records.asset.find(a=>a.id===f.asset.id)
  a=await h.command('asset.update',{assetId:a.id,version:a.version,customerName:'Updated recorded customer',customerEmail:'',label:a.label,identifier:a.identifier})
  await stale();assert.equal(r.revisions.at(-1).ownership.assetVersion,a.version)
  const contact=await h.command('contact.save',{name:'Recorded account contact',email:'',phone:'',communication:'none'})
  let account=await h.command('customer.save',{name:'Recorded account',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'standard'})
  a=await h.command('customer.linkAsset',{assetId:a.id,version:a.version,customerId:account.id,customerVersion:account.version,reason:'Owner reviewed current account association'})
  await stale()
  account=await h.command('customer.save',{customerId:account.id,version:account.version,name:'Revised recorded account',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'standard'})
  await stale();assert.equal(r.revisions.at(-1).ownership.accountVersion,account.version)
  await h.command('calendar.absenceSave',{technicianId:(await f.jobNow()).technicianId,resourceId:'',startAt:'2026-11-02T09:00:00Z',endAt:'2026-11-02T10:00:00Z',reason:'Current recorded technician absence',active:true})
  await stale();assert.ok(r.revisions.at(-1).citations.some(c=>c.kind==='calendarAbsence'))
  assert.deepEqual(r.revisions[0],rev,'Refresh preserves the exact earlier decision and packet')
  const archiveState=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:address(813)}})
  try{
   await restore(fresh,backup)
   for(const kind of ['declinedReview','declinedWork','reading','inspection','estimate'])assert.deepEqual((await fresh.state()).records[kind],archiveState[kind],'Recover exact '+kind)
   await fresh.state({as:h.owner,status:401})
   const before=(await fresh.state()).records
   await fresh.cron('2026-11-01T14:00:00Z')
   assert.deepEqual((await fresh.state()).records.declinedReview,before.declinedReview)
   assert.equal(fresh.messages.length,0,'Recovered advisory history never sends')
  }finally{await fresh.close()}
  await f.record('green',9);await refresh()
  assert.equal((await prepare({status:409})).error,'REVIEW_SUPPRESSED')
  await f.record('yellow',3);await refresh()
  // Exact later authorized work is completed, then cannot be offered again.
  const approved=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:2})
  const sent=await h.command('estimate.markSent',{estimateId:q.id,version:approved.version,revision:2,method:'printed'})
  const decided=await h.command('estimate.authorise',{estimateId:q.id,version:sent.version,revision:2,lineIds:[q.revisions[1].lines[0].id],customerName:'Recorded customer',method:'signed',evidence:'Fresh decision on current repriced work'})
  await h.command('work.record',{jobId:f.job.id,version:(await f.jobNow()).version,estimateId:decided.id,revision:2,lineId:q.revisions[1].lines[0].id,quantity:2})
  r=await refresh();assert.equal(r.revisions.at(-1).suppressed,'Work already completed');await prepare({status:409})
  const currentItem=(await h.state()).records.declinedWork.find(d=>d.id===itemId)
  await h.command('decline.inapplicable',{declinedWorkId:itemId,version:currentItem.version,evidence:'Owner recorded no further applicable work'})
  r=await h.command('declineReview.refresh',{...input,itemVersion:currentItem.version+1,version:(await packet()).version})
  assert.equal(r.revisions.at(-1).suppressed,'Finding no longer applies')
  await h.command('agent.revoke',{id:key.id});await h.command('declineReview.refresh',input,{...agent,status:401})
  assert.equal((await h.state({as:member.cookie})).records.declinedReview,undefined)
  await h.api('/auth/operator/status',{operatorId:admin.id,status:'inactive'})
  await h.command('declineReview.refresh',input,{as:admin.cookie,status:401})
  const preview=await h.command('retention.preview',{customerId:account.id,categories:['personal','import']})
  await h.command('customer.erase',{customerId:account.id,categories:['personal','import'],fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Verified customer request',consentEvidence:'synthetic-mallet-814 customer erasure request'})
  const erased=await packet();assert.deepEqual(erased.revisions,[]);assert.deepEqual(erased.offers,[])
  await h.command('declineReview.refresh',{...input,version:erased.version},{status:409})
  const recovered=await installation()
  try{await restore(recovered,await archive(h));assert.deepEqual((await recovered.state()).records.declinedReview.find(r=>r.id===erased.id),erased);await recovered.command('declineReview.refresh',input,{status:409})}finally{await recovered.close()}
  assert.deepEqual((await h.state()).records.declinedWork.find(d=>d.id===itemId).decision,f.item.decision)
 }finally{await h.close()}
}
