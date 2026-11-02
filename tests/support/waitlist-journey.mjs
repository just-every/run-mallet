import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {bookingPost,bookingService,holdFields,slotId} from './booking-journey.mjs'

const offerSubject='Your requested cancellation appointment offer'
const requestFields=(service,n,overrides={})=>({serviceId:service.id,name:`synthetic-mallet-waitlist-${n}`,email:`synthetic-mallet-waitlist-${n}@example.test`,earliestAt:service.windows[0].startAt,latestAt:service.windows[0].endAt,consent:true,evidence:'Customer called and explicitly requested this service and cancellation offer email.',...overrides})
const offerPath=message=>new URL(message.text.match(/https?:\/\/[^\s<>]+\/book\/[A-Za-z0-9_-]{43}/)?.[0]??assert.fail('Offer includes a private booking management link')).pathname
async function reservation(h,service,overrides={}){
 const response=await bookingPost(h,'/book',{...holdFields(service),...overrides});assert.equal(response.status,303,await response.text())
 const path=response.headers.get('location'),row=(await h.state()).records.appointment.find(a=>a.status==='held'&&a.email===(overrides.email??holdFields(service).email).toLowerCase())
 return {row,path}
}

export async function waitlistCancellationJourney(h){
 await shopSetup(h)
 const service=await bookingService(h),before=await h.state(),original=await reservation(h,service)
 assert.equal((await bookingPost(h,original.path,{action:'confirm',version:original.row.version})).status,200)
 const canceled=(await h.state()).records.appointment.find(a=>a.id===original.row.id)
 await h.command('waitlist.add',requestFields(service,0,{consent:false}),{status:422})
 const mismatch=await h.command('waitlist.add',requestFields(service,1,{earliestAt:new Date(Date.parse(service.windows[0].startAt)+3600000).toISOString()}))
 const first=await h.command('waitlist.add',requestFields(service,2)),second=await h.command('waitlist.add',requestFields(service,3))
 assert.ok(mismatch.sequence<first.sequence&&first.sequence<second.sequence,'Queue order is allocated by the server')
 const member=await h.person('synthetic-mallet-waitlist-staff@example.test')
 await h.command('waitlist.add',requestFields(service,4),{as:member.cookie,status:403})
 await h.command('waitlist.offerClaim',{offerId:first.id,version:1},{status:404})
 const attempts=await Promise.all([bookingPost(h,original.path,{action:'cancel',version:canceled.version}),bookingPost(h,original.path,{action:'cancel',version:canceled.version})])
 assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409])
 let state=await h.state()
 assert.equal(state.records.waitlistOffer.length,1,'Competing cancellations create one atomic reservation')
 const offer=state.records.waitlistOffer[0],offered=state.records.appointment.find(a=>a.id===offer.appointmentId)
 assert.equal(offer.entryId,first.id,'Earliest matching request receives the released interval')
 assert.equal(offered.status,'held');assert.equal(offered.startAt,canceled.startAt);assert.equal(offered.endAt,canceled.endAt)
 assert.equal(Date.parse(offered.expiresAt)-Date.parse(offered.createdAt),service.holdSeconds*1000)
 assert.equal(state.records.bookingWaitlist.find(x=>x.id===second.id).status,'waiting')
 assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,0,'Cancellation alone never sends an unreviewed offer')
 await h.command('waitlist.sendOffer',{offerId:offer.id,version:offer.version})
 await h.command('waitlist.sendOffer',{offerId:offer.id,version:offer.version},{status:409})
 const messages=h.messages.filter(m=>m.subject===offerSubject);assert.equal(messages.length,1)
 const path=offerPath(messages[0]);assert.ok(messages[0].html.includes('href="'+h.origin+path+'"'))
 assert.equal((await bookingPost(h,'/book',{...holdFields(service),email:'synthetic-mallet-waitlist-race@example.test'})).status,409,'Offer occupies ordinary bay and technician capacity')
 const privateResponse=await h.request(path,{as:''});assert.equal(privateResponse.status,200)
 const privateText=await privateResponse.text();assert.ok(privateText.includes(offered.id));assert.ok(!privateText.includes(second.email))
 assert.equal((await bookingPost(h,path,{action:'confirm',version:offered.version})).status,200,'Recipient confirms through the existing private customer boundary')
 state=await h.state();assert.equal(state.records.appointment.find(a=>a.id===offered.id).status,'confirmed')
 assert.equal((await bookingPost(h,original.path,{action:'cancel',version:canceled.version})).status,409)
 assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,1,'Replayed cancellation does not send again')
 const confirmed=state.records.appointment.find(a=>a.id===offered.id);assert.equal((await bookingPost(h,path,{action:'cancel',version:confirmed.version})).status,200,'Canceling an offered appointment also offers its released capacity')
 state=await h.state();assert.equal(state.records.waitlistOffer.length,2);assert.ok(state.records.waitlistOffer.some(o=>o.entryId===second.id));assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,1);const nextOffer=state.records.waitlistOffer.find(o=>o.entryId===second.id);await h.command('waitlist.sendOffer',{offerId:nextOffer.id,version:nextOffer.version});state=await h.state();assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,2)
 const restricted=await h.state({as:member.cookie});assert.equal(restricted.records.bookingWaitlist?.length??0,0);assert.equal(restricted.records.waitlistOffer?.length??0,0)
 assert.ok(!restricted.records.event.some(x=>x.kind.startsWith('waitlist.')))
 const agent=await h.command('agent.create',{label:'synthetic-mallet-waitlist-agent'})
 const agentState=await h.state({as:'',headers:{authorization:'Bearer '+agent.token}})
 assert.equal(agentState.records.bookingWaitlist?.length??0,0);assert.equal(agentState.records.waitlistOffer?.length??0,0)
 for(const kind of ['job','estimate','approval','payment'])assert.equal(state.records[kind]?.length??0,before.records[kind]?.length??0,'Offering and confirming gives no repair or payment authority')
 const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-waitlist-restore@example.test'}})
 try{
  await restore(fresh,backup);const restored=await fresh.state()
  for(const kind of ['bookingWaitlist','waitlistOffer'])assert.deepEqual(restored.records[kind],state.records[kind],'Queue and offer history are portable')
  assert.ok(backup[0].excludedTables.includes('mallet_booking_tokens'));assert.ok(!JSON.stringify(backup).includes(path.slice(6)))
  assert.equal((await fresh.mf.dispatchFetch(fresh.origin+path)).status,404,'Archived data does not restore private management authority')
 }finally{await fresh.close()}
}

export async function waitlistExpiryJourney(h){
 await shopSetup(h);const service=await bookingService(h,{holdSeconds:1}),original=await reservation(h,service)
 const first=await h.command('waitlist.add',requestFields(service,10)),second=await h.command('waitlist.add',requestFields(service,11))
 assert.equal((await bookingPost(h,original.path,{action:'cancel',version:original.row.version})).status,200)
 let state=await h.state();assert.equal(state.records.waitlistOffer[0].entryId,first.id);await h.command('waitlist.sendOffer',{offerId:state.records.waitlistOffer[0].id,version:state.records.waitlistOffer[0].version})
 const oldPath=offerPath(h.messages.find(m=>m.subject===offerSubject)),old=state.records.appointment.find(a=>a.id===state.records.waitlistOffer[0].appointmentId)
 await new Promise(resolve=>setTimeout(resolve,1150))
 assert.equal((await bookingPost(h,oldPath,{action:'confirm',version:old.version})).status,409)
 state=await h.state();assert.equal(state.records.waitlistOffer.length,1);assert.equal(state.records.bookingWaitlist.find(x=>x.id===second.id).status,'waiting')
 assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,1,'Expiry sends no automatic next offer')
 const canceled=state.records.appointment.find(a=>a.id===original.row.id)
 await h.command('waitlist.advance',{appointmentId:canceled.id,version:canceled.version})
 state=await h.state();assert.equal(state.records.waitlistOffer.length,2);assert.ok(state.records.waitlistOffer.some(x=>x.entryId===second.id))
 assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,1,'Advancement reserves but does not automatically send');const nextOffer=state.records.waitlistOffer.find(x=>x.entryId===second.id);await h.command('waitlist.sendOffer',{offerId:nextOffer.id,version:nextOffer.version});assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,2,'Staff explicitly emails the next eligible offer')
 await h.command('waitlist.advance',{appointmentId:canceled.id,version:canceled.version},{status:409})
}

export async function waitlistLimitsJourney(h){
 await shopSetup(h);const service=await bookingService(h),original=await reservation(h,service)
 const otherStart=new Date(Date.parse(service.windows[0].startAt)+3600000).toISOString()
 const blockedEmail='synthetic-mallet-waitlist-limited@example.test'
 await reservation(h,service,{email:blockedEmail,slotId:slotId(service,{...service.windows[0],startAt:otherStart})})
 const blocked=await h.command('waitlist.add',requestFields(service,20,{email:blockedEmail.toUpperCase()})),next=await h.command('waitlist.add',requestFields(service,21))
 assert.equal((await bookingPost(h,original.path,{action:'cancel',version:original.row.version})).status,200)
 const state=await h.state();assert.equal(state.records.waitlistOffer[0].entryId,next.id,'Email-limited request is skipped without violating FIFO among eligible requests')
 assert.equal(state.records.bookingWaitlist.find(x=>x.id===blocked.id).status,'waiting')
 assert.equal(state.records.appointment.filter(a=>a.status==='held'&&a.email===blockedEmail).length,1)
}

export async function waitlistSourceLimitJourney(h){
 await shopSetup(h)
 const startAt=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T09:00:00.000Z'
 const service=await bookingService(h,{windows:[{startAt,endAt:startAt.replace('09:','13:'),bayId:'synthetic-mallet-3',technicianId:(await h.state()).actor.id,skills:['inspection']}]})
 let last
 for(let index=0;index<4;index++){
  const start=new Date(Date.parse(startAt)+index*3600000).toISOString()
  const original=await reservation(h,service,{slotId:slotId(service,{...service.windows[0],startAt:start})})
  last=await h.command('waitlist.add',requestFields(service,40+index))
  assert.equal((await bookingPost(h,original.path,{action:'cancel',version:original.row.version})).status,200)
 }
 const state=await h.state()
 assert.equal(state.records.waitlistOffer.length,3,'Consent offers share the ordinary three-active-holds source bound')
 assert.equal(state.records.bookingWaitlist.find(x=>x.id===last.id).status,'waiting','A source-limited customer remains queued')
 assert.equal(h.messages.filter(m=>m.subject===offerSubject).length,0,'Reservations never send without explicit staff review')
}

export async function waitlistMailFailureJourney(){
 let providerStatus=422,calls=0
 const h=await installation({outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.sendgrid.com');calls++;return new Response(null,{status:providerStatus})}})
 try{
  await shopSetup(h);await h.configure({MAIL_PROVIDER:'sendgrid'})
  for(const [index,[status,expected]]of [[422,'failed'],[429,'rate_limited'],[503,'uncertain']].entries()){
   providerStatus=status
   const startAt=new Date(Date.now()+86400000).toISOString().slice(0,10)+`T${String(9+index).padStart(2,'0')}:00:00.000Z`
   const service=await bookingService(h,{windows:[{startAt,endAt:new Date(Date.parse(startAt)+3600000).toISOString(),bayId:'synthetic-mallet-3',technicianId:(await h.state()).actor.id,skills:['inspection']}]})
   const original=await reservation(h,service,{email:`synthetic-mallet-waitlist-cancel-${index}@example.test`})
   await h.command('waitlist.add',requestFields(service,30+index));const before=calls
   assert.equal((await bookingPost(h,original.path,{action:'cancel',version:original.row.version})).status,200)
   const state=await h.state(),offer=state.records.waitlistOffer.find(o=>o.triggerAppointmentId===original.row.id)
   assert.equal(offer.delivery.status,'pending');assert.equal(calls,before);await h.command('waitlist.sendOffer',{offerId:offer.id,version:offer.version});assert.equal((await h.state()).records.waitlistOffer.find(o=>o.id===offer.id).delivery.status,expected);assert.equal(calls,before+1);await h.command('waitlist.sendOffer',{offerId:offer.id,version:offer.version},{status:409})
   assert.equal(state.records.appointment.find(a=>a.id===offer.appointmentId).status,'held','Mail failure retains the bounded reservation')
   assert.equal((await bookingPost(h,original.path,{action:'cancel',version:original.row.version})).status,409)
   await h.command('waitlist.advance',{appointmentId:original.row.id,version:state.records.appointment.find(a=>a.id===original.row.id).version},{status:409})
   assert.equal(calls,before+1,'Failure, uncertainty and replays never resend an offer')
  }
 }finally{await h.close()}
}
