import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {archive,installation,restore,assetInput} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
export async function bookingService(h,overrides={}){
 const startAt=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T09:00:00.000Z',endAt=startAt.replace('09:','12:')
 return h.command('booking.publish',{name:'synthetic-mallet-1 inspection',location:'synthetic-mallet-2 workshop',skill:'inspection',durationMinutes:60,leadMinutes:60,holdSeconds:600,active:true,windows:[{startAt,endAt,bayId:'synthetic-mallet-3',technicianId:(await h.state()).actor.id,skills:['inspection']}],...overrides})
}
export async function bookingPost(h,path,fields,headers={}){return h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(fields)})}
export const slotId=(service,slot)=>createHash('sha256').update(JSON.stringify([service.id,service.version,slot.startAt,slot.bayId,slot.technicianId])).digest('hex')
export const holdFields=service=>({action:'hold',serviceId:service.id,...service.windows[0],slotId:slotId(service,service.windows[0]),name:'synthetic-mallet-4',email:'synthetic-mallet-4@example.test',consent:'yes'})
export const bookingEmail=n=>['synthetic-mallet-'+n,'example.test'].join('@')
export const bookingTime=at=>new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(at))
export async function onlineBookingJourney(h){
 await shopSetup(h)
 const startAt=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T09:00:00.000Z',endAt=startAt.replace('09:','12:')
 const service=await bookingService(h,{windows:[{startAt,endAt,bayId:'synthetic-mallet-3',technicianId:(await h.state()).actor.id,skills:['inspection']}]}),input=holdFields(service),before=await h.state()
 assert.equal((await h.mf.dispatchFetch('https://other.test/book')).status,404,'The public form checks the exact configured host')
 const page=await h.request('/book',{as:''});assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors \*/);assert.ok(!(await page.text()).includes(service.windows[0].technicianId),'Staff identity not exposed')
 const member=await h.person('synthetic-mallet-5@example.test'),agent=await h.command('agent.create',{label:'synthetic-mallet-6'})
 await h.command('booking.publish',service,{as:member.cookie,status:403});await h.command('booking.hold',input,{status:404})
 assert.equal((await h.request('/app/bookings',{as:member.cookie})).status,403)
 assert.equal((await h.state({as:'',headers:{authorization:'Bearer '+agent.token}})).records.appointment?.length??0,0)
 const noConsent=await bookingPost(h,'/book',{...input,consent:'no'});assert.equal(noConsent.status,422)
 const cross=await h.mf.dispatchFetch(h.origin+'/book',{method:'POST',headers:{origin:'https://other.test','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(input)});assert.equal(cross.status,403)
 // Retain an independently booked customer while the last published slot is contested.
 const separate=await bookingService(h,{name:'synthetic-mallet-16 inspection',windows:[{...service.windows[0],startAt:startAt.replace('09:','14:'),endAt:endAt.replace('12:','15:')}]}),separateFields={...holdFields(separate),email:bookingEmail(16)}
 const separateHold=await bookingPost(h,'/book',separateFields);assert.equal(separateHold.status,303)
 assert.equal((await bookingPost(h,separateHold.headers.get('location'),{action:'confirm',version:1})).status,200)
 const unrelated=(await h.state()).records.appointment.find(a=>a.serviceId===separate.id),mailBefore=h.messages.filter(m=>m.subject==='Your confirmed appointment').length
 const occupied=[]
 for(const hour of [10,11]){
  const held=await bookingPost(h,'/book',{...input,email:bookingEmail(hour+40),slotId:slotId(service,{...input,startAt:startAt.replace('09:',hour+':')})},{'cf-connecting-ip':'192.0.2.40'})
  assert.equal(held.status,303);occupied.push(held.headers.get('location'))
 }
 const contenders=[input,{...input,name:'synthetic-mallet-7',email:bookingEmail(7)}]
 const results=await Promise.all(contenders.map(fields=>bookingPost(h,'/book',fields)));assert.deepEqual(results.map(r=>r.status).sort(),[303,409])
 const winner=results.findIndex(r=>r.status===303),loser=1-winner,path=results[winner].headers.get('location')
 const heldState=await h.state();let appointment=heldState.records.appointment.find(a=>a.email===contenders[winner].email)
 assert.equal(heldState.records.appointment.length,4,'Only the prior appointment, two prior holds and the winning hold exist')
 assert.equal(appointment.status,'held');assert.equal(heldState.records.appointment.filter(a=>a.serviceId===service.id&&a.startAt===startAt).length,1)
 assert.equal(heldState.records.appointment.filter(a=>a.email===contenders[loser].email).length,0,'The losing customer has no reservation')
 assert.deepEqual(heldState.records.appointment.find(a=>a.id===unrelated.id),unrelated)
 const fullPage=await h.request('/book?serviceId='+service.id,{as:''});assert.match(await fullPage.text(),/No times available/,'The one published bay slot is exhausted')
 const asset=await h.command('asset.create',assetInput('synthetic-mallet-8'))
 await h.command('job.book',{assetId:asset.id,version:asset.version,title:'synthetic-mallet-9',...service.windows[0]},{status:409})
 const confirmation=await bookingPost(h,path,{action:'confirm',version:appointment.version});assert.equal(confirmation.status,200,await confirmation.text())
 const confirmedState=await h.state();appointment=confirmedState.records.appointment.find(a=>a.id===appointment.id)
 assert.equal(appointment.status,'confirmed');assert.equal(appointment.delivery.status,'accepted')
 assert.deepEqual({serviceId:appointment.serviceId,name:appointment.name,email:appointment.email,bayId:appointment.bayId,technicianId:appointment.technicianId,startAt:appointment.startAt,endAt:appointment.endAt},
  {serviceId:service.id,name:contenders[winner].name,email:contenders[winner].email,bayId:'synthetic-mallet-3',technicianId:before.actor.id,startAt,endAt:startAt.replace('09:','10:')},'The public state reload identifies exactly the winning service, customer, resource and interval')
 assert.equal(appointment.service.name,service.name);assert.equal(appointment.service.location,service.location);assert.equal(appointment.service.timeZone,'America/New_York')
 assert.equal(confirmedState.records.appointment.filter(a=>a.serviceId===service.id&&a.status==='confirmed').length,1)
 assert.equal(h.messages.filter(m=>m.subject==='Your confirmed appointment').length,mailBefore+1)
 const confirmationMail=h.messages.filter(m=>m.subject==='Your confirmed appointment'&&m.to.includes(contenders[winner].email))
 assert.equal(confirmationMail.length,1);assert.deepEqual(confirmationMail[0].to,[contenders[winner].email])
 for(const value of [appointment.id,service.name,service.location,'America/New_York',bookingTime(startAt),bookingTime(startAt.replace('09:','10:')),path])assert.ok(confirmationMail[0].text.includes(value),'Confirmation matches the winning appointment: '+value)
 assert.equal(h.messages.filter(m=>m.subject==='Your confirmed appointment'&&m.to.includes(contenders[loser].email)).length,0)
 const publicConfirmation=await h.request(path,{as:''}),confirmationText=await publicConfirmation.text();assert.equal(publicConfirmation.status,200)
 for(const value of [appointment.id,service.name,service.location,'America/New_York',bookingTime(startAt),bookingTime(startAt.replace('09:','10:')),'Status: <strong>confirmed</strong>','Confirmation handed to the mail provider; delivery is not confirmed.'])assert.ok(confirmationText.includes(value),'Customer reload shows the exact confirmation and honest outcome: '+value)
 assert.deepEqual(confirmedState.records.appointment.find(a=>a.id===unrelated.id),unrelated)
 await h.command('booking.attendance',{appointmentId:appointment.id,version:appointment.version,outcome:'no-show',evidence:'Future appointments cannot be marked absent'},{status:409})
 assert.ok(h.messages.at(-1).text.includes(path));assert.ok(h.messages.at(-1).html.includes('href="'+h.origin+path+'"'),'HTML confirmation has a usable private management link');assert.ok(h.messages.at(-1).text.includes(service.location));assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,409)
 assert.equal(h.messages.filter(m=>m.subject==='Your confirmed appointment').length,mailBefore+1,'Replayed confirmation cannot hand off a second message')
 // Release a separate tentative hold to exercise the existing reschedule door.
 assert.equal((await bookingPost(h,occupied[0],{action:'cancel',version:1})).status,200)
 const next=new Date(Date.parse(input.startAt)+3600000).toISOString()
 const moved=await bookingPost(h,path,{action:'reschedule',version:appointment.version,slotId:slotId(service,{...input,startAt:next})});assert.equal(moved.status,200,await moved.text())
 appointment=(await h.state()).records.appointment.find(a=>a.id===appointment.id);assert.equal(appointment.startAt,next);assert.equal(appointment.history.length,2)
 const mailAfterMove=h.messages.filter(m=>m.subject==='Your confirmed appointment');assert.equal(mailAfterMove.length,mailBefore+2,'One new confirmation is handed off for the requested reschedule')
 assert.deepEqual(mailAfterMove.at(-1).to,[contenders[winner].email]);assert.ok(mailAfterMove.at(-1).text.includes(bookingTime(next)))
 assert.equal((await bookingPost(h,path,{action:'cancel',version:appointment.version})).status,200)
 const canceledState=await h.state(),canceled=canceledState.records.appointment.find(a=>a.id===appointment.id)
 assert.equal(canceled.status,'canceled');assert.deepEqual(canceledState.records.appointment.find(a=>a.id===unrelated.id),unrelated,'Cancellation leaves the unrelated appointment unchanged')
 const replacementFields={...input,name:'synthetic-mallet-19',email:bookingEmail(19),slotId:slotId(service,{...input,startAt:next})}
 const available=await bookingPost(h,'/book',replacementFields);assert.equal(available.status,303,'Cancellation frees the exact claimed capacity for a new customer')
 const reclaimedState=await h.state(),other=reclaimedState.records.appointment.find(a=>a.email===replacementFields.email)
 assert.deepEqual({serviceId:other.serviceId,bayId:other.bayId,technicianId:other.technicianId,startAt:other.startAt,endAt:other.endAt,status:other.status},
  {serviceId:service.id,bayId:canceled.bayId,technicianId:canceled.technicianId,startAt:canceled.startAt,endAt:canceled.endAt,status:'held'})
 assert.deepEqual(reclaimedState.records.appointment.find(a=>a.id===unrelated.id),unrelated);assert.deepEqual(reclaimedState.records.appointment.find(a=>a.id===canceled.id),canceled)
 assert.equal(h.messages.filter(m=>m.subject==='Your confirmed appointment').length,mailAfterMove.length,'Canceling and reclaiming do not repeat the old confirmation')
 const privatePage=await h.request(path+'?appointmentId='+other.id,{as:''}),privateText=await privatePage.text()
 assert.ok(privateText.includes(appointment.id));assert.ok(!privateText.includes(other.id));assert.ok(!privateText.includes(asset.identifier));assert.ok(!privateText.includes(asset.customerEmail))
 assert.equal((await bookingPost(h,path,{action:'confirm',version:other.version,appointmentId:other.id})).status,409,'A management link cannot select another appointment')
 assert.equal((await h.state()).records.appointment.find(a=>a.id===other.id).status,'held');assert.equal((await h.request('/api/mallet/state',{as:''})).status,401)
 const observed=await attendanceFixture(h),attendance={appointmentId:observed.id,version:observed.version,outcome:'no-show',evidence:'Counter and phone log reviewed; customer did not attend.'}
 await h.command('booking.attendance',attendance,{as:member.cookie,status:403})
 const marked=await h.command('booking.attendance',attendance);assert.equal(marked.attendance.outcome,'no-show')
 const unchanged=await h.state();await h.command('booking.attendance',{...attendance,version:marked.version,outcome:'arrived'},{status:400});assert.deepEqual(await h.state(),unchanged,'Attendance cannot be silently rewritten without a correction reason')
 const query='?from='+observed.startAt.slice(0,10)+'&to='+new Date(Date.parse(observed.startAt)+86400000).toISOString().slice(0,10),metrics=await h.api('/api/mallet/reports/turnaround'+query)
 assert.equal(metrics.metrics.noShows,1);assert.equal(metrics.metrics.noShowRateTenths,1000);assert.equal(metrics.appointments.find(a=>a.id===observed.id).attendance.evidence,attendance.evidence)
 const correction={...attendance,version:marked.version,outcome:'arrived',evidence:'Signed arrival log was found for this exact appointment.',reason:'The first observation missed the signed counter log.'},beforeCorrectionMail=h.messages.length
 await h.command('booking.attendance',correction,{as:member.cookie,status:403})
 await h.command('booking.attendance',correction,{as:'',headers:{authorization:'Bearer '+agent.token},status:403})
 const corrected=await h.command('booking.attendance',correction)
 assert.deepEqual(corrected.attendance,marked.attendance,'The original observation remains unchanged')
 assert.equal(corrected.attendanceCorrections.length,1);assert.equal(corrected.attendanceCorrections[0].reason,correction.reason)
 const correctedMetrics=await h.api('/api/mallet/reports/turnaround'+query),correctedAppointment=correctedMetrics.appointments.find(a=>a.id===observed.id)
 assert.equal(correctedMetrics.metrics.noShows,0);assert.equal(correctedMetrics.metrics.attendanceRecorded,1);assert.equal(correctedMetrics.metrics.noShowRateTenths,0)
 assert.deepEqual(correctedAppointment.attendanceObservations,[marked.attendance,...corrected.attendanceCorrections]);assert.equal(correctedAppointment.attendance.outcome,'arrived')
 assert.equal(h.messages.length,beforeCorrectionMail,'Recording a correction sends no mail')
 await attendanceFixture(h,member.id);const unknownMetrics=await h.api('/api/mallet/reports/turnaround'+query)
 assert.equal(unknownMetrics.metrics.appointmentsDue,2);assert.equal(unknownMetrics.metrics.attendanceRecorded,1);assert.equal(unknownMetrics.metrics.noShowRateTenths,0,'Unknown attendance stays outside the denominator')
 const state=await h.state();assert.equal(state.records.job?.length??0,before.records.job?.length??0);assert.equal(state.records.estimate?.length??0,before.records.estimate?.length??0);assert.equal(state.records.approval?.length??0,before.records.approval?.length??0)
 const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-10@example.test'}})
 try{await restore(fresh,backup);const restored=await fresh.state();assert.equal((await fresh.api('/api/mallet/reports/turnaround'+query)).metrics.noShows,0);assert.deepEqual(restored.records.appointment,state.records.appointment);assert.deepEqual(restored.records.bookingService,state.records.bookingService);assert.equal((await fresh.mf.dispatchFetch(fresh.origin+path)).status,404);assert.ok(backup[0].excludedTables.includes('mallet_booking_tokens'));assert.ok(!JSON.stringify(backup).includes(path.slice(6)))}finally{await fresh.close()}
}
export async function bookingAvailabilityJourney(h){
 await shopSetup(h);const service=await bookingService(h,{holdSeconds:1}),input=holdFields(service)
 const held=await bookingPost(h,'/book',input);assert.equal(held.status,303);const path=held.headers.get('location')
 await new Promise(r=>setTimeout(r,1150));assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,409)
 assert.equal((await bookingPost(h,'/book',input)).status,303,'Expired tentative hold frees capacity')
 const wrong={...input,slotId:slotId(service,{...input,startAt:input.startAt.replace('09:','08:')})};assert.equal((await bookingPost(h,'/book',wrong)).status,409,'Opening bounds enforced')
 await h.command('booking.publish',{...service,serviceId:service.id,version:service.version,name:'Changed service',durationMinutes:30});assert.equal((await bookingPost(h,'/book',input)).status,409,'Changing published service semantics invalidates old public slot references')
 assert.equal((await bookingPost(h,'/book',{...input,slotId:slotId(service,{...input,startAt:input.startAt.replace('09:','09:30')})})).status,409)
 const unskilled=await bookingService(h,{name:'synthetic-mallet-11',windows:[{...service.windows[0],skills:['different']} ]});assert.equal((await bookingPost(h,'/book',holdFields(unskilled))).status,409)
 const lead=await bookingService(h,{name:'synthetic-mallet-12',leadMinutes:525600});assert.equal((await bookingPost(h,'/book',holdFields(lead))).status,409)
 const closed=await bookingService(h,{name:'synthetic-mallet-13',active:false});assert.equal((await bookingPost(h,'/book',holdFields(closed))).status,409)
 const tech=await h.person('synthetic-mallet-14@example.test'),staffService=await bookingService(h,{windows:[{...service.windows[0],bayId:'synthetic-mallet-15',technicianId:tech.id}]});await h.api('/auth/operator/status',{operatorId:tech.id,status:'inactive'});assert.equal((await bookingPost(h,'/book',holdFields(staffService))).status,409,'Inactive staff cannot retain published customer capacity');const unavailable=await h.request('/book?serviceId='+staffService.id,{as:''});assert.ok(!(await unavailable.text()).includes('Hold this time'))
}

export async function bookingFailureJourney(){
 let providerStatus=422,calls=0
 const h=await installation({outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.sendgrid.com');calls++;return new Response(null,{status:providerStatus})}})
 try{
  await shopSetup(h);const service=await bookingService(h);await h.configure({MAIL_PROVIDER:'sendgrid'})
  for(const [index,[status,expected]]of [[422,'failed'],[429,'failed'],[503,'uncertain']].entries()){
   providerStatus=status;const fields=holdFields(service),startAt=new Date(Date.parse(fields.startAt)+index*3600000).toISOString(),slot=slotId(service,{...fields,startAt})
   const held=await bookingPost(h,'/book',{...fields,slotId:slot});assert.equal(held.status,303);const path=held.headers.get('location'),before=calls
   const response=await bookingPost(h,path,{action:'confirm',version:1});assert.equal(response.status,200);assert.match(await response.text(),/email failed or is uncertain; this appointment remains confirmed/)
   const row=(await h.state()).records.appointment.find(a=>a.startAt===startAt);assert.equal(row.status,'confirmed');assert.equal(row.delivery.status,expected);assert.equal(calls,before+1)
   assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,409);assert.equal(calls,before+1,'No automatic or replayed send after a mail failure')
  }
 }finally{await h.close()}
}

export async function bookingAbuseJourney(h){
 await shopSetup(h);const service=await bookingService(h,{windows:[{startAt:new Date(Date.now()+86400000).toISOString().slice(0,10)+'T09:00:00.000Z',endAt:new Date(Date.now()+86400000).toISOString().slice(0,10)+'T17:00:00.000Z',bayId:'synthetic-mallet-3',technicianId:(await h.state()).actor.id,skills:['inspection']}]}),input=holdFields(service)
 const fields=(hour,email)=>({...input,email,slotId:slotId(service,{...input,startAt:input.startAt.replace('09:',String(hour).padStart(2,'0')+':')})})
 const source={'cf-connecting-ip':'192.0.2.1'},another={'cf-connecting-ip':'192.0.2.2'}
 const held=await bookingPost(h,'/book',fields(9,'synthetic-mallet-20@example.test'),source);assert.equal(held.status,303)
 const emailRefusal=await bookingPost(h,'/book',fields(10,'SYNTHETIC-MALLET-20@EXAMPLE.TEST'),another);assert.equal(emailRefusal.status,429);assert.match(await emailRefusal.text(),/email already has a tentative appointment/)
 for(const hour of [10,11])assert.equal((await bookingPost(h,'/book',fields(hour,`synthetic-mallet-${hour}@example.test`),source)).status,303)
 const sourceRefusal=await bookingPost(h,'/book',{...fields(12,'synthetic-mallet-21@example.test'),sourceHash:'synthetic-mallet-22'},source);assert.equal(sourceRefusal.status,429);assert.match(await sourceRefusal.text(),/Too many tentative appointments from this connection/)
 assert.equal((await h.state()).records.appointment.length,3,'Refused holds do not consume capacity')
 assert.equal((await bookingPost(h,'/book',fields(12,'synthetic-mallet-21@example.test'),another)).status,303,'Other sources and emails retain capacity')
 const first=(await h.state()).records.appointment.find(a=>a.email==='synthetic-mallet-20@example.test');assert.equal((await bookingPost(h,held.headers.get('location'),{action:'cancel',version:first.version})).status,200)
 assert.equal((await bookingPost(h,'/book',fields(9,'synthetic-mallet-20@example.test'),source)).status,303,'Cancellation releases both source and email limits')
 const third={'cf-connecting-ip':'192.0.2.3'},races=await Promise.all([bookingPost(h,'/book',fields(13,'synthetic-mallet-23@example.test'),third),bookingPost(h,'/book',fields(14,'synthetic-mallet-23@example.test'),third)])
 assert.equal(races.filter(r=>r.status===303).length,1,'Concurrent same-email holds share the transaction fence')
 assert.equal((await h.state()).records.appointment.filter(a=>a.email==='synthetic-mallet-23@example.test').length,1)
}

// Uses relative seconds, so a UTC date boundary cannot affect the attendance proof.
export async function attendanceFixture(h,technicianId){
 const startAt=new Date(Date.now()+5000).toISOString(),endAt=new Date(Date.parse(startAt)+300000).toISOString()
 const service=await bookingService(h,{durationMinutes:5,leadMinutes:0,windows:[{startAt,endAt,bayId:technicianId?'synthetic-mallet-31':'synthetic-mallet-30',technicianId:technicianId??(await h.state()).actor.id,skills:['inspection']}]})
 const held=await bookingPost(h,'/book',{...holdFields(service),email:'synthetic-mallet-30@example.test'});assert.equal(held.status,303)
 const path=held.headers.get('location'),a=(await h.state()).records.appointment.find(a=>a.serviceId===service.id)
 assert.equal((await bookingPost(h,path,{action:'confirm',version:a.version})).status,200)
 const row=(await h.state()).records.appointment.find(a=>a.serviceId===service.id)
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(startAt)-Date.now()+100)))
 return row
}
