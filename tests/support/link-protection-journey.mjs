// GOV-004: every customer-link door answers an unknown, revoked or expired link alike and reveals nothing, a client that keeps
// missing is paused per door, and a link never grants payer billing authority.
import assert from 'node:assert/strict'
import {booking,estimate} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {templateInput} from './intake-forms-journey.mjs'
import {checkInTemplate} from './check-in-journey.mjs'
import {portalPost} from './portal-journey.mjs'
import {bookingService,bookingPost,holdFields} from './booking-journey.mjs'
const GONE='2000-01-01T00:00:00.000Z',snap=async response=>[response.status,await response.text()]
export async function linkProtectionJourney(h) {
 await shopSetup(h)
 const db=await h.mf.getD1Database('DB'),{asset,job}=await booking(h),read=async(kind,id)=>(await h.state()).records[kind].find(r=>r.id===id)
 const setField=(kind,id,field,value)=>db.prepare(`UPDATE mallet_records SET value=json_set(value,'$.${field}',?) WHERE kind=? AND id=?`).bind(value,kind,id).run()
 let q=await estimate(h,job);q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
 const form=await h.command('intakeForm.publish',templateInput()),checkTemplate=await h.command('intakeForm.publish',checkInTemplate)
 const advisor=await h.person('synthetic-mallet-27-link-advisor@example.test','admin');await h.command('diagnosisLink.create',{jobId:job.id,days:8},{as:advisor.cookie,status:403});await h.command('diagnosisLink.create',{jobId:job.id,days:31});await h.command('diagnosisLink.create',{jobId:job.id,days:32},{status:400})
 let day=2
 const doors=[
  {name:'approve',make:async()=>{const l=await h.command('approvalLink.create',{estimateId:q.id,version:(await read('estimate',q.id)).version,revision:1,days:7});return {id:l.id,path:new URL(l.url).pathname}},
   revoke:async l=>h.command('approvalLink.revoke',{linkId:l.id,version:(await read('approvalLink',l.id)).version}),expire:l=>setField('approvalLink',l.id,'expiresAt',GONE)},
  {name:'inspection',make:async()=>{const l=await h.command('diagnosisLink.create',{jobId:job.id,days:7});return {id:l.id,path:new URL(l.url).pathname}},
   revoke:async l=>h.command('diagnosisLink.revoke',{linkId:l.id,version:(await read('diagnosisLink',l.id)).version}),expire:l=>setField('diagnosisLink',l.id,'expiresAt',GONE)},
  {name:'intake',make:async()=>{const l=await h.command('intakeForm.create',{jobId:job.id,version:(await h.state()).records.job.find(j=>j.id===job.id).version,templateId:form.id,templateVersion:form.version});return {id:l.id,path:new URL(l.url).pathname}},
   revoke:async l=>h.command('intakeForm.revoke',{formId:l.id,version:(await read('intakeForm',l.id)).version,reason:'Customer asked to withdraw this link'}),expire:l=>setField('intakeForm',l.id,'expiresAt',GONE)},
  {name:'check-in',make:async()=>{const l=await h.command('checkin.issue',{templateId:checkTemplate.id,templateVersion:checkTemplate.version});return {id:l.id,path:new URL(l.url).pathname}},
   revoke:async l=>h.command('checkin.revoke',{requestId:l.id,version:(await read('counterIntake',l.id)).version,reason:'Customer asked to withdraw this link'}),expire:l=>setField('counterIntake',l.id,'expiresAt',GONE)},
  {name:'book',make:async()=>{await db.prepare("UPDATE mallet_records SET value=json_set(value,'$.status','canceled') WHERE kind='appointment'").run();const startAt=new Date(Date.now()+86400000*day++).toISOString().slice(0,10)+'T09:00:00.000Z',s=await bookingService(h,{windows:[{startAt,endAt:startAt.replace('09:','12:'),bayId:'synthetic-mallet-3',technicianId:(await h.state()).actor.id,skills:['inspection']}]}),held=await bookingPost(h,'/book',holdFields(s));assert.equal(held.status,303);const path=held.headers.get('location');return {id:(await h.state()).records.appointment.find(a=>a.serviceId===s.id).id,path}},
   revoke:async l=>h.command('booking.revokeLink',{appointmentId:l.id}),expire:l=>setField('appointment',l.id,'endAt',GONE)},
 ]
 const family=path=>path.split('/')[1],garbage=name=>`/${name}/${'A'.repeat(43)}`
 // Every door: a live link works; once revoked, and again once expired, it is indistinguishable from a link that never existed.
 const customer=[asset.customerName,asset.customerEmail,asset.label,asset.identifier]
 for(const door of doors) {
  const unknown=await snap(await h.request(garbage(door.name),{as:''}));assert.equal(unknown[0],404,door.name)
  for(const how of ['revoke','expire']) {
   const link=await door.make(),live=await h.request(link.path,{as:''});assert.equal(live.status,200,door.name+' live link');assert.notEqual(live.headers.get('cache-control'),null)
   await door[how](link);const gone=await snap(await h.request(link.path,{as:''}))
   assert.deepEqual(gone,unknown,`GOV-004 ${door.name} ${how}d link looks like an unknown one`)
   for(const text of customer)assert.ok(!gone[1].includes(text),`GOV-004 ${door.name} ${how}d link reveals no customer history`)
  }
 }
 // An unusable link cannot be used to act either.
 const stale=await doors[0].make();await doors[0].expire(stale);const lateDecision=await h.mf.dispatchFetch(h.origin+stale.path,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({typedName:'Thief',consent:'yes'}).toString()});assert.equal(lateDecision.status,404);assert.equal((await h.state()).records.approvalLink.filter(l=>l.decision).length,0)
 // Misses are paced per client and per door; the live link of a paused client shows nothing, other doors keep working, then the window passes.
 await db.prepare('DELETE FROM mallet_rate').run()
 const inspection=await doors[1].make(),approval=await doors[0].make()
 for(let n=0;n<20;n++)assert.equal((await h.request(`/approve/${String(n).padStart(43,'B')}`,{as:''})).status,404)
 const paused=await h.request(approval.path,{as:''}),pausedBody=await paused.text();assert.equal(paused.status,429);assert.ok(paused.headers.get('retry-after'));for(const text of customer)assert.ok(!pausedBody.includes(text),'GOV-004 a paused client learns nothing')
 assert.equal((await h.request(inspection.path,{as:''})).status,200,'GOV-004 pausing one door leaves the others open')
 assert.equal((await portalPost(h,`/portal/confirm/${'C'.repeat(43)}`,{confirm:'yes'})).status,403,'an unknown customer sign-in link opens nothing')
 await db.prepare('DELETE FROM mallet_rate').run();assert.equal((await h.request(approval.path,{as:''})).status,200)
 // Holding a link never proves who the payer is: billing needs a customer account session.
 for(const link of [approval,inspection]){const billing=await h.request('/api/mallet/portal/billing',{as:'',headers:{referer:h.origin+link.path}});assert.equal(billing.status,403);assert.equal((await billing.json()).error,'payer_session_required')}
 assert.equal((await h.request('/api/mallet/state',{as:''})).status,401)
}
