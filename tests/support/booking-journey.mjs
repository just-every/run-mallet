import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {archive,installation,restore,assetInput} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
export async function bookingService(h,overrides={}){
 const startAt=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T09:00:00.000Z',endAt=startAt.replace('09:','12:')
 return h.command('booking.publish',{name:'synthetic-mallet-1 inspection',location:'synthetic-mallet-2 workshop',skill:'inspection',durationMinutes:60,leadMinutes:60,holdSeconds:600,active:true,windows:[{startAt,endAt,bayId:'synthetic-mallet-3',technicianId:(await h.state()).actor.id,skills:['inspection']}],...overrides})
}
export async function bookingPost(h,path,fields){return h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)})}
export const slotId=(service,slot)=>createHash('sha256').update(JSON.stringify([service.id,slot.startAt,slot.bayId,slot.technicianId])).digest('hex')
export const holdFields=service=>({action:'hold',serviceId:service.id,...service.windows[0],slotId:slotId(service,service.windows[0]),name:'synthetic-mallet-4',email:'synthetic-mallet-4@example.test',consent:'yes'})
export async function onlineBookingJourney(h){
 await shopSetup(h);const service=await bookingService(h),input=holdFields(service),before=await h.state()
 const page=await h.request('/book',{as:''});assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors \*/);assert.ok(!(await page.text()).includes(service.windows[0].technicianId),'Staff identity not exposed')
 const member=await h.person('synthetic-mallet-5@example.test'),agent=await h.command('agent.create',{label:'synthetic-mallet-6'})
 await h.command('booking.publish',service,{as:member.cookie,status:403});await h.command('booking.hold',input,{status:404})
 assert.equal((await h.request('/app/bookings',{as:member.cookie})).status,403)
 assert.equal((await h.state({as:'',headers:{authorization:'Bearer '+agent.token}})).records.appointment?.length??0,0)
 const noConsent=await bookingPost(h,'/book',{...input,consent:'no'});assert.equal(noConsent.status,422)
 const cross=await h.mf.dispatchFetch(h.origin+'/book',{method:'POST',headers:{origin:'https://other.test','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(input)});assert.equal(cross.status,403)
 const results=await Promise.all([bookingPost(h,'/book',input),bookingPost(h,'/book',{...input,email:'synthetic-mallet-7@example.test'})]);assert.deepEqual(results.map(r=>r.status).sort(),[303,409])
 const path=results.find(r=>r.status===303).headers.get('location');let appointment=(await h.state()).records.appointment[0]
 assert.equal(appointment.status,'held');assert.equal((await h.state()).records.appointment.length,1)
 const asset=await h.command('asset.create',assetInput('synthetic-mallet-8'))
 await h.command('job.book',{assetId:asset.id,version:asset.version,title:'synthetic-mallet-9',...service.windows[0]},{status:409})
 const confirmation=await bookingPost(h,path,{action:'confirm',version:appointment.version});assert.equal(confirmation.status,200,await confirmation.text())
 appointment=(await h.state()).records.appointment[0];assert.equal(appointment.status,'confirmed');assert.equal(appointment.delivery.status,'accepted');assert.equal(h.messages.filter(m=>m.subject==='Your confirmed appointment').length,1)
 assert.ok(h.messages.at(-1).text.includes(path));assert.ok(h.messages.at(-1).text.includes(service.location));assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,409)
 const next=new Date(Date.parse(input.startAt)+3600000).toISOString()
 const moved=await bookingPost(h,path,{action:'reschedule',version:appointment.version,slotId:slotId(service,{...input,startAt:next})});assert.equal(moved.status,200,await moved.text())
 appointment=(await h.state()).records.appointment[0];assert.equal(appointment.startAt,next);assert.equal(appointment.history.length,2)
 assert.equal((await bookingPost(h,path,{action:'cancel',version:appointment.version})).status,200)
 const available=await bookingPost(h,'/book',{...input,startAt:next,slotId:slotId(service,{...input,startAt:next})});assert.equal(available.status,303,'Cancellation frees capacity')
 const state=await h.state();assert.equal(state.records.job?.length??0,before.records.job?.length??0);assert.equal(state.records.estimate?.length??0,before.records.estimate?.length??0);assert.equal(state.records.approval?.length??0,before.records.approval?.length??0)
 const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-10@example.test'}})
 try{await restore(fresh,backup);const restored=await fresh.state();assert.deepEqual(restored.records.appointment,state.records.appointment);assert.deepEqual(restored.records.bookingService,state.records.bookingService);assert.equal((await fresh.mf.dispatchFetch(fresh.origin+path)).status,404);assert.ok(backup[0].excludedTables.includes('mallet_booking_tokens'));assert.ok(!JSON.stringify(backup).includes(path.slice(6)))}finally{await fresh.close()}
}
export async function bookingAvailabilityJourney(h){
 await shopSetup(h);const service=await bookingService(h,{holdSeconds:1}),input=holdFields(service)
 const held=await bookingPost(h,'/book',input);assert.equal(held.status,303);const path=held.headers.get('location')
 await new Promise(r=>setTimeout(r,1150));assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,409)
 assert.equal((await bookingPost(h,'/book',input)).status,303,'Expired tentative hold frees capacity')
 const wrong={...input,slotId:slotId(service,{...input,startAt:input.startAt.replace('09:','08:')})};assert.equal((await bookingPost(h,'/book',wrong)).status,409,'Opening bounds enforced')
 assert.equal((await bookingPost(h,'/book',{...input,slotId:slotId(service,{...input,startAt:input.startAt.replace('09:','09:30')})})).status,409)
 const unskilled=await bookingService(h,{name:'synthetic-mallet-11',windows:[{...service.windows[0],skills:['different']} ]});assert.equal((await bookingPost(h,'/book',holdFields(unskilled))).status,409)
 const lead=await bookingService(h,{name:'synthetic-mallet-12',leadMinutes:525600});assert.equal((await bookingPost(h,'/book',holdFields(lead))).status,409)
 const closed=await bookingService(h,{name:'synthetic-mallet-13',active:false});assert.equal((await bookingPost(h,'/book',holdFields(closed))).status,409)
}
