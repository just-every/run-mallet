import assert from 'node:assert/strict'
import {archive,installation,restore,assetInput} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {bookingService,bookingPost,holdFields} from './booking-journey.mjs'
export async function calendarJourney(h){
 await shopSetup(h)
 const technicianId=(await h.state()).actor.id,member=await h.person('synthetic-mallet-101@example.test')
 const resource=(kind,n)=>h.command('calendar.resourceSave',{kind,name:`synthetic-mallet-${n}`,skills:['inspection'],active:true})
 const bay=await resource('bay',102),otherBay=await resource('bay',103),lift=await resource('lift',104),loaner=await resource('loaner',105)
 const qualification=await h.command('calendar.technicianSave',{technicianId,skills:['inspection'],active:true})
 await h.command('calendar.resourceSave',{kind:'bay',name:'synthetic-mallet-106',skills:[],active:true},{as:member.cookie,status:403})
 const asset=await h.command('asset.create',assetInput('synthetic-mallet-107'))
 const plan={bayId:bay.id,technicianId,liftId:lift.id,loanerId:loaner.id,requiredSkill:'inspection',startAt:'2026-10-25T09:00:00-04:00',endAt:'2026-10-25T10:00:00-04:00'}
 const book=async(overrides={},status=200)=>h.command('job.book',{assetId:asset.id,version:(await h.state()).records.asset.find(a=>a.id===asset.id).version,title:'synthetic-mallet-108',...plan,...overrides},{status})
 await book({requiredSkill:'unqualified'},409)
 const absence=await h.command('calendar.absenceSave',{resourceId:lift.id,startAt:plan.startAt,endAt:plan.endAt,reason:'synthetic-mallet-109 maintenance',active:true})
 await book({},409)
 await h.command('calendar.absenceSave',{absenceId:absence.id,version:absence.version,resourceId:lift.id,startAt:plan.startAt,endAt:plan.endAt,reason:'synthetic-mallet-110 completed',active:false})
 const techAbsence=await h.command('calendar.absenceSave',{technicianId,startAt:plan.startAt,endAt:plan.endAt,reason:'synthetic-mallet-111 leave',active:true})
 await book({},409)
 await h.command('calendar.absenceSave',{absenceId:techAbsence.id,version:techAbsence.version,technicianId,startAt:plan.startAt,endAt:plan.endAt,reason:'synthetic-mallet-112 returned',active:false})
 const job=await book()
 await h.command('calendar.technicianSave',{technicianId:member.id,skills:['inspection'],active:true})
 await book({bayId:otherBay.id,technicianId:member.id,loanerId:''},409)
 await book({bayId:otherBay.id,technicianId:member.id,liftId:''},409)
 const target={...plan,startAt:'2026-11-08T09:00:00-05:00',endAt:'2026-11-08T10:00:00-05:00',bayId:otherBay.id}
 const proposal=await h.command('dispatch.prepare',{jobId:job.id,version:job.version,...target,reason:'synthetic-mallet-113'})
 await book({...target,technicianId:member.id,liftId:'',loanerId:''})
 await h.command('dispatch.approve',{proposalId:proposal.id,version:proposal.version},{status:409})
 assert.equal((await h.state()).records.job.find(j=>j.id===job.id).bayId,bay.id)
 const occurrences=[{startAt:'2026-11-15T09:00:00-05:00',endAt:'2026-11-15T10:00:00-05:00'},{startAt:'2026-11-22T09:00:00-05:00',endAt:'2026-11-22T10:00:00-05:00'}]
 const series=await h.command('calendar.seriesCreate',{title:'synthetic-mallet-114',...plan,timeZone:'America/New_York',occurrences})
 await book(occurrences[1],409)
 await h.command('calendar.seriesCancel',{seriesId:series.id,version:series.version,reason:'synthetic-mallet-115'})
 await book(occurrences[1])
 // Explicit local time offsets preserve weekly wall time across the fall-back transition.
 const dst=[{startAt:'2027-10-31T09:00:00-04:00',endAt:'2027-10-31T10:00:00-04:00'},{startAt:'2027-11-07T09:00:00-05:00',endAt:'2027-11-07T10:00:00-05:00'}]
 const dstSeries=await h.command('calendar.seriesCreate',{title:'synthetic-mallet-116',...plan,timeZone:'America/New_York',occurrences:dst})
 assert.equal(Date.parse(dstSeries.occurrences[1].startAt)-Date.parse(dstSeries.occurrences[0].startAt),169*3600000)
 await h.command('calendar.seriesCreate',{title:'synthetic-mallet-117',...plan,timeZone:'America/New_York',occurrences:[{startAt:'2027-03-07T02:30:00-05:00',endAt:'2027-03-07T03:30:00-05:00'},{startAt:'2027-03-14T02:30:00-05:00',endAt:'2027-03-14T03:30:00-04:00'}]},{status:400})
 await h.command('calendar.technicianSave',{technicianId,version:qualification.version,skills:['inspection'],active:false})
 await book({startAt:'2027-12-01T09:00:00-05:00',endAt:'2027-12-01T10:00:00-05:00'},409)
 // Public online capacity inherits registered resources and current qualifications.
 const currentQualification=(await h.state()).records.calendarTechnician.find(t=>t.technicianId===technicianId)
 await h.command('calendar.technicianSave',{technicianId,version:currentQualification.version,skills:['inspection'],active:true})
 const service=await bookingService(h),published=await h.command('booking.publish',{...service,serviceId:service.id,version:service.version,windows:[{...service.windows[0],bayId:bay.id,liftId:lift.id,loanerId:loaner.id,requiredSkill:'inspection'}]})
 const held=await bookingPost(h,'/book',holdFields(published));assert.equal(held.status,303);const heldRow=(await h.state()).records.appointment.find(a=>a.status==='held')
 assert.equal(heldRow.liftId,lift.id);assert.equal(heldRow.loanerId,loaner.id)
 await book({...published.windows[0],bayId:otherBay.id,technicianId:member.id,loanerId:''},409)
 const unavailable=await h.command('calendar.absenceSave',{resourceId:lift.id,startAt:published.windows[0].startAt,endAt:published.windows[0].endAt,reason:'synthetic-mallet-120 maintenance after hold',active:true})
 assert.equal((await bookingPost(h,held.headers.get('location'),{action:'confirm',version:heldRow.version})).status,409,'Confirmation rechecks current resource absence')
 await h.command('calendar.absenceSave',{...unavailable,absenceId:unavailable.id,version:unavailable.version,active:false})
 assert.equal((await bookingPost(h,held.headers.get('location'),{action:'cancel',version:heldRow.version})).status,200)
 await h.api('/auth/operator/status',{operatorId:member.id,status:'inactive'})
 await book({technicianId:member.id,startAt:'2027-12-02T09:00:00-05:00',endAt:'2027-12-02T10:00:00-05:00'},409)
 const state=await h.state(),backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-118@example.test'}})
 try{
  await restore(fresh,backup);const restored=await fresh.state()
  for(const kind of ['calendarResource','calendarTechnician','calendarAbsence','calendarSeries'])assert.deepEqual(restored.records[kind],state.records[kind])
  const restoredSeries=restored.records.calendarSeries.find(r=>r.id===dstSeries.id)
  await fresh.command('calendar.seriesCancel',{seriesId:restoredSeries.id,version:restoredSeries.version,reason:'synthetic-mallet-119 fresh owner'})
 }finally{await fresh.close()}
}
