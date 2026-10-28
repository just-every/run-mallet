import assert from 'node:assert/strict'
import {installation,archive,restore,booking,estimate,authorise} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {bookingService,bookingPost,holdFields,slotId} from './booking-journey.mjs'
export const OUTREACH_CLOCK='2026-10-28T12:00:00Z'
export const scheduleFields=(source,overrides={})=>({kind:'appointment',subjectId:source.id,version:source.version,dueAt:'2026-11-01T05:30:00Z',expiresAt:'2026-11-01T18:00:00Z',timeZone:'America/New_York',allowedStart:9,allowedEnd:18,instructions:'Bring the service record.',consent:true,consentEvidence:'Customer requested one reminder in New York daytime hours.',...overrides})
export async function appointmentFixture(h){
 await shopSetup(h)
 const service=await bookingService(h,{windows:[{startAt:'2026-11-01T19:00:00Z',endAt:'2026-11-01T22:00:00Z',bayId:'synthetic-mallet-701',technicianId:(await h.state()).actor.id,skills:['inspection']}]})
 const held=await bookingPost(h,'/book',holdFields(service));assert.equal(held.status,303)
 const path=held.headers.get('location')
 assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,200)
 return {service,path,appointment:(await h.state()).records.appointment[0]}
}
export async function appointmentOutreachJourney(){
 let rejected=false
 const h=await installation({clock:OUTREACH_CLOCK,mailService:async()=>rejected?Response.json({error:'synthetic-mallet-702'},{status:422}):Response.json({id:crypto.randomUUID()})})
 try{
  const {service,path,appointment}=await appointmentFixture(h),fields=scheduleFields(appointment)
  const member=await h.person('synthetic-mallet-703@example.test')
  await h.command('outreach.schedule',fields,{as:member.cookie,status:403})
  await h.command('outreach.schedule',{...fields,consent:false},{status:422})
  await h.command('outreach.claim',{id:'synthetic-mallet-704',version:1},{status:404})
  const first=await h.command('outreach.schedule',fields),before=h.messages.length
  for(const at of ['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2026-11-01T13:59:00Z'])await h.cron(at)
  assert.equal(h.messages.length,before,'Both repeated DST hours and quiet hours withhold mail')
  await h.restart();await Promise.all([h.cron('2026-11-01T14:00:00Z'),h.cron('2026-11-01T14:00:00Z')])
  const mail=h.messages.at(-1);assert.equal(h.messages.length,before+1,JSON.stringify((await h.state()).records.outreach));assert.equal(mail.subject,'Your appointment reminder');assert.match(mail.text,/Nov 1, 2026, 2:00 PM EST/);assert.match(mail.text,/Bring the service record/);assert.match(mail.text,/Reschedule or cancel:/)
  const reminderPath=new URL(mail.text.match(/Reschedule or cancel: (https?:[^\s]+)/)[1]).pathname
  assert.equal((await h.request(reminderPath,{as:''})).status,200,'Reminder link opens only its existing appointment')
  await h.cron('2026-11-01T14:15:00Z');assert.equal(h.messages.length,before+1)
  assert.equal((await h.state()).records.outreach.find(r=>r.id===first.id).status,'accepted')
  const second=await h.command('outreach.schedule',fields)
  const moved=await bookingPost(h,path,{action:'reschedule',version:(await h.state()).records.appointment[0].version,slotId:slotId(service,{...service.windows[0],startAt:'2026-11-01T20:00:00.000Z'})});assert.equal(moved.status,200)
  await h.cron('2026-11-01T14:20:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===second.id).status,'stopped');assert.equal(h.messages.at(-1).subject,'Your confirmed appointment')
  const current=(await h.state()).records.appointment[0],third=await h.command('outreach.schedule',scheduleFields(current));rejected=true
  await h.cron('2026-11-01T14:30:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===third.id).status,'failed')
  const calls=h.messages.length;await h.cron('2026-11-01T14:45:00Z');assert.equal(h.messages.length,calls)
  rejected=false
  const pending=await h.command('outreach.schedule',scheduleFields(current,{instructions:'Bring the service record. '.repeat(20)})),backup=await archive(h),fresh=await installation({clock:OUTREACH_CLOCK,bindings:{OWNER_EMAIL:'synthetic-mallet-705'+String.fromCharCode(64)+'example.test'}})
  try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.outreach,(await h.state()).records.outreach);await fresh.cron('2026-11-01T15:00:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0)}finally{await fresh.close()}
  assert.equal((await bookingPost(h,path,{action:'cancel',version:current.version})).status,200)
  await h.cron('2026-11-01T15:00:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===pending.id).status,'stopped')
  await h.command('booking.revokeLink',{appointmentId:appointment.id})
  assert.equal((await h.request(reminderPath,{as:''})).status,404,'Withdrawing the original management authority also withdraws reminder links')
 }finally{await h.close()}
}
export async function declinedFixture(h){
 await shopSetup(h)
 const {asset,job}=await booking(h)
 let q=await estimate(h,job);q=await authorise(h,q,[])
 let current=(await h.state()).records.job.find(j=>j.id===job.id)
 const reading=await h.command('reading.record',{jobId:job.id,version:current.version,unit:'miles',stage:'intake',value:1000,observedAt:'2026-10-01T09:00:00Z'})
 const item=await h.command('decline.record',{estimateId:q.id,version:q.version,lineId:q.revisions[0].lines[0].id,readingId:reading.id,reason:'Customer deferred brake pads',evidence:'Recorded signed decision',dueValue:1200})
 const bay=await h.command('calendar.resourceSave',{kind:'bay',name:'Native follow-up bay',skills:[],active:true})
 await h.command('calendar.technicianSave',{technicianId:(await h.state()).actor.id,skills:[],active:true})
 const stock=await h.command('stock.item',{sku:'synthetic-mallet-801',barcode:'synthetic-mallet-802',name:'Brake pads',unit:'pair'})
 const bin=await h.command('stock.bin',{code:'synthetic-mallet-803',barcode:'synthetic-mallet-804'})
 await h.command('stock.receive',{itemBarcode:stock.barcode,binBarcode:bin.barcode,quantity:10,expectedQuantity:10,reference:'synthetic-mallet-805',reason:'Native receiving evidence'})
 const later=await booking(h,{bayId:bay.id,asset:(await h.state()).records.asset.find(a=>a.id===asset.id),startAt:'2026-11-02T09:00:00Z',endAt:'2026-11-02T10:00:00Z'})
 const repriced=await h.command('decline.reprice',{declinedWorkId:item.id,itemVersion:item.version,jobId:later.job.id,version:later.job.version,unitCents:3000,reason:'Inspected brake need and current stock'})
 const quote=await h.command('estimate.approve',{estimateId:repriced.estimate.id,version:repriced.estimate.version,revision:1})
 return {item:repriced.item,quote,job:later.job,asset,stock,bin,bay}
}
let permissionCapture=0
export const declinedConsentInput=(fixture,overrides={})=>({subjectId:fixture.item.id,version:fixture.item.version,to:fixture.asset.customerEmail,purpose:'declined-work',wordingVersion:'declined-permission-v1',consent:true,consentedAt:'2026-10-01T09:00:00-04:00',captureChannel:'telephone',sourceEvidence:'Recorded customer telephone permission for this exact declined item; synthetic-mallet-806-'+(++permissionCapture),...overrides})
export const declinedAvailabilityInput=(fixture,overrides={})=>({subjectId:fixture.item.id,version:fixture.item.version,estimateId:fixture.quote.id,quoteVersion:fixture.quote.version,mappings:fixture.quote.revisions.at(-1).lines.filter(l=>l.kind==='part').map(l=>({lineId:l.id,itemId:fixture.stock.id,binId:fixture.bin.id})),expiresAt:'2026-11-01T18:00:00Z',evidence:'Inspected native receiving and booked repair sources; synthetic-mallet-807',...overrides})
export async function declinedScheduleFields(h,fixture,overrides={}){
 const consent=await h.command('outreach.consent',declinedConsentInput(fixture)),availability=await h.command('outreach.availability',declinedAvailabilityInput(fixture))
 return scheduleFields(fixture.item,{kind:'declined',estimateId:fixture.quote.id,quoteVersion:fixture.quote.version,urgency:'Review soon',approved:true,consentId:consent.id,consentVersion:consent.version,availabilityId:availability.id,availabilityVersion:availability.version,...overrides})
}
export async function declinedOutreachJourney(){
 const h=await installation({clock:OUTREACH_CLOCK})
 try{
  const fixture=await declinedFixture(h),{item,quote,job}=fixture
  const member=await h.person('synthetic-mallet-808'+String.fromCharCode(64)+'example.test')
  for(const [command,input] of [['outreach.consent',declinedConsentInput(fixture)],['outreach.availability',declinedAvailabilityInput(fixture)]])await h.command(command,input,{as:member.cookie,status:403})
  await h.command('outreach.consent',declinedConsentInput(fixture,{purpose:'appointment'}),{status:422})
  await h.command('outreach.consent',declinedConsentInput(fixture,{consent:false}),{status:422})
  await h.command('outreach.consent',declinedConsentInput(fixture,{sourceEvidence:''}),{status:400})
  await h.command('outreach.availability',declinedAvailabilityInput(fixture,{mappings:[]}),{status:409})
  await h.command('outreach.schedule',scheduleFields(item,{kind:'declined',estimateId:quote.id,quoteVersion:quote.version,approved:true,availabilityConfirmed:true,availabilityEvidence:'Owner assertion alone'}),{status:409})
  const fields=await declinedScheduleFields(h,fixture)
  await h.command('outreach.schedule',{...fields,approved:false},{status:422})
  await h.command('outreach.schedule',fields,{as:member.cookie,status:403})
  await h.command('outreach.schedule',{...fields,consentId:quote.id},{status:404})
  const first=await h.command('outreach.schedule',fields),before=h.messages.length
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,before)
  const current=(await h.state()).records.job.find(j=>j.id===job.id)
  await h.command('reading.record',{jobId:job.id,version:current.version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  await h.cron('2026-11-01T14:15:00Z');assert.equal(h.messages.length,before+1);assert.match(h.messages.at(-1).text,/USD 64.50/);assert.equal((await h.state()).records.outreach.find(r=>r.id===first.id).status,'accepted')
  const next=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture));await h.command('outreach.stop',{id:next.id,version:next.version,reason:'Customer opted out and booked by phone'});await h.cron('2026-11-01T14:30:00Z');assert.equal(h.messages.length,before+1)
  const booked=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture))
  await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===item.assetId),bayId:'synthetic-mallet-later',startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T10:00:00Z'})
  await h.cron('2026-11-01T14:35:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===booked.id).status,'stopped','A later vehicle booking suppresses pending outreach')
  const third=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture))
  let sent=await h.command('estimate.markSent',{estimateId:quote.id,version:quote.version,revision:1,method:'printed'})
  await h.command('estimate.authorise',{estimateId:sent.id,version:sent.version,revision:1,lineIds:[],customerName:'Cedar Bikes',method:'signed',evidence:'Customer declined the refreshed quote again'})
  await h.cron('2026-11-01T14:45:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===third.id).status,'stopped');assert.equal(h.messages.length,before+1)
  const reviewed=await h.command('decline.inapplicable',{declinedWorkId:item.id,version:item.version,evidence:'Owner inspected the vehicle and the finding no longer applies'});assert.equal(reviewed.inapplicable.evidence,'Owner inspected the vehicle and the finding no longer applies');assert.deepEqual(reviewed.decision,item.decision)
  await h.command('outreach.schedule',{...fields,version:reviewed.version},{status:409})
  assert.deepEqual((await h.state()).records.declinedWork.find(r=>r.id===item.id).decision,item.decision,'Original decision remains immutable')
  const backup=await archive(h),fresh=await installation({clock:OUTREACH_CLOCK,bindings:{OWNER_EMAIL:'synthetic-mallet-809'+String.fromCharCode(64)+'example.test'}})
  try{await restore(fresh,backup);for(const kind of ['outreach','declinedConsent','declinedAvailability'])assert.deepEqual((await fresh.state()).records[kind],(await h.state()).records[kind]);await fresh.cron('2026-11-01T15:00:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0)}finally{await fresh.close()}
 }finally{await h.close()}
}

export {declinedEligibilityJourney,declinedErasureJourney} from './declined-outreach-journey.mjs'
