import assert from 'node:assert/strict'
import {installation,archive,restore,booking,estimate,authorise} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {bookingService,bookingPost,holdFields,slotId} from './booking-journey.mjs'
export const scheduleFields=(source,overrides={})=>({kind:'appointment',subjectId:source.id,version:source.version,dueAt:'2026-11-01T05:30:00Z',expiresAt:'2026-11-01T18:00:00Z',timeZone:'America/New_York',allowedStart:9,allowedEnd:18,instructions:'Bring the service record.',consent:true,consentEvidence:'Customer requested one reminder in New York daytime hours.',...overrides})
export async function appointmentFixture(h){
 await shopSetup(h)
 const service=await bookingService(h,{windows:[{startAt:'2026-11-01T19:00:00Z',endAt:'2026-11-01T22:00:00Z',bayId:'synthetic-mallet-701',technicianId:(await h.state()).actor.id,skills:['inspection']}]})
 const held=await bookingPost(h,'/book',holdFields(service));assert.equal(held.status,303)
 const path=held.headers.get('location')
 assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,200)
 return {service,path,appointment:(await h.state()).records.appointment[0]}
}
export const outreachInstallation=(options={})=>installation({...options,entry:'tests/outreach-worker.ts',bindings:{TEST_NOW:'2026-10-28T12:00:00Z',...options.bindings}})
export const appointmentConsentFields=(a,overrides={})=>({subjectId:a.id,version:a.version,to:a.email,purpose:'appointment-reminder',wordingVersion:'appointment-permission-v1',consent:true,timeZone:'America/New_York',allowedStart:9,allowedEnd:18,consentedAt:'2026-10-28T07:00:00-04:00',captureChannel:'telephone',sourceEvidence:'synthetic-mallet-710 customer telephone permission for one reminder and pre-visit instructions',...overrides})
export async function prepareAppointment(h,a,overrides={},consent){
 consent??=await h.command('outreach.consent',appointmentConsentFields(a,Object.fromEntries(['timeZone','allowedStart','allowedEnd'].filter(key=>key in overrides).map(key=>[key,overrides[key]]))))
 return h.command('outreach.prepare',{...scheduleFields(a),consentId:consent.id,consentVersion:consent.version,...overrides})
}
export async function approveAppointment(h,a,overrides={},consent){
 const prepared=await prepareAppointment(h,a,overrides,consent)
 return h.command('outreach.approve',{id:prepared.id,version:prepared.version,confirm:true})
}
export async function appointmentOutreachJourney(){
 let rejected=false
 const h=await outreachInstallation({mailService:async()=>rejected?Response.json({error:'synthetic-mallet-702'},{status:422}):Response.json({id:crypto.randomUUID()})})
 try{
  const {service,path,appointment}=await appointmentFixture(h),fields=scheduleFields(appointment)
  const member=await h.person(['synthetic-mallet-703','example.test'].join('@'))
  await h.command('outreach.schedule',fields,{as:member.cookie,status:403})
  await h.command('outreach.schedule',{...fields,consent:false},{status:422})
  await h.command('outreach.claim',{id:'synthetic-mallet-704',version:1},{status:404})
  await h.command('outreach.schedule',fields,{status:422})
  const wrong=await h.command('outreach.consent',appointmentConsentFields(appointment,{purpose:'appointment-confirmation'})),unchanged=await h.state()
  await h.command('outreach.prepare',{...fields,consentId:wrong.id,consentVersion:wrong.version},{status:422});assert.deepEqual(await h.state(),unchanged,'Confirmation permission cannot authorize later reminders')
  for(const invalid of [{sourceEvidence:''},{consentedAt:'2026-10-28T07:00:00'},{to:['synthetic-mallet-711','example.test'].join('@')}])await h.command('outreach.consent',appointmentConsentFields(appointment,invalid),{status:invalid.to?422:400})
  const consent=await h.command('outreach.consent',appointmentConsentFields(appointment))
  assert.equal(consent.channel,'email');assert.equal(consent.purpose,'appointment-reminder');assert.equal(consent.customerName,appointment.name);assert.equal(consent.to,appointment.email);assert.equal(consent.consentedTime,'2026-10-28T07:00:00-04:00');assert.equal(consent.captureChannel,'telephone');assert.ok(consent.wording.includes('pre-visit'));assert.equal(consent.by.id,(await h.state()).actor.id)
  const draft=await prepareAppointment(h,appointment,{},consent),beforeApproval=await h.state()
  await h.command('outreach.approve',{id:draft.id,version:draft.version,confirm:false},{status:422});assert.deepEqual(await h.state(),beforeApproval)
  const first=await h.command('outreach.approve',{id:draft.id,version:draft.version,confirm:true}),before=h.messages.length
  assert.deepEqual(first.source,{appointmentVersion:appointment.version,serviceVersion:service.version,contactVersions:[]});assert.equal(first.approval.preparedVersion,draft.version);assert.ok(first.content.includes('[private appointment management link]'));assert.equal(first.consentId,consent.id)
  for(const at of ['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z','2026-11-01T13:59:00Z'])await h.cron(at)
  assert.equal(h.messages.length,before,'Both repeated DST hours and quiet hours withhold mail')
  await h.restart();await Promise.all([h.cron('2026-11-01T14:00:00Z'),h.cron('2026-11-01T14:00:00Z')])
  const mail=h.messages.at(-1);assert.equal(h.messages.length,before+1,JSON.stringify((await h.state()).records.outreach));assert.equal(mail.subject,'Your appointment reminder');assert.match(mail.text,/Nov 1, 2026, 2:00 PM EST/);assert.match(mail.text,/Bring the service record/);assert.match(mail.text,/Reschedule or cancel:/)
  const reminderPath=new URL(mail.text.match(/Reschedule or cancel: (https?:[^\s]+)/)[1]).pathname
  assert.equal((await h.request(reminderPath,{as:''})).status,200,'Reminder link opens only its existing appointment')
  await h.cron('2026-11-01T14:15:00Z');assert.equal(h.messages.length,before+1)
  assert.equal((await h.state()).records.outreach.find(r=>r.id===first.id).status,'accepted')
  const second=await approveAppointment(h,appointment)
  const moved=await bookingPost(h,path,{action:'reschedule',version:(await h.state()).records.appointment[0].version,slotId:slotId(service,{...service.windows[0],startAt:'2026-11-01T20:00:00.000Z'})});assert.equal(moved.status,200)
  await h.cron('2026-11-01T14:20:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===second.id).status,'stopped');assert.equal(h.messages.at(-1).subject,'Your confirmed appointment')
  const current=(await h.state()).records.appointment[0],third=await approveAppointment(h,current);rejected=true
  await h.cron('2026-11-01T14:30:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===third.id).status,'failed')
  const calls=h.messages.length;await h.cron('2026-11-01T14:45:00Z');assert.equal(h.messages.length,calls)
  const retryConsent=await h.command('outreach.consent',appointmentConsentFields(current))
  await h.command('outreach.prepare',{...scheduleFields(current),consentId:retryConsent.id,consentVersion:retryConsent.version},{status:409})
  const failed=(await h.state()).records.outreach.find(r=>r.id===third.id)
  const resolved=await h.command('outreach.resolve',{id:failed.id,version:failed.version,reason:'synthetic-mallet-712 owner reviewed rejected handoff; customer still requests the email'})
  assert.equal(resolved.status,'failed');assert.equal(resolved.resolution.by.id,(await h.state()).actor.id);assert.equal(resolved.provider,'resend');assert.ok(resolved.outcomeAt)
  rejected=false
  const pending=await approveAppointment(h,current,{instructions:'Bring the service record. '.repeat(20)},retryConsent),backup=await archive(h),fresh=await outreachInstallation({bindings:{OWNER_EMAIL:['synthetic-mallet-705','example.test'].join('@')}})
  try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.outreach,(await h.state()).records.outreach);await fresh.cron('2026-11-01T15:00:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0)
   const restored=(await fresh.state()).records.outreach.find(r=>r.id===pending.id);assert.equal(restored.status,'skipped','Archived approval has no installation authority')
   // History survives, but destination approval and a newly issued management capability are both required.
   const db=await fresh.mf.getD1Database('DB');assert.equal((await db.prepare('SELECT count(*) AS n FROM mallet_outreach_authority').first()).n,0)
   const review=await prepareAppointment(fresh,current),approved=await fresh.command('outreach.approve',{id:review.id,version:review.version,confirm:true});assert.equal(approved.status,'pending')
   await fresh.cron('2026-11-01T15:15:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0,'Fresh send approval cannot resurrect an archived booking capability')}finally{await fresh.close()}
  assert.equal((await bookingPost(h,path,{action:'cancel',version:current.version})).status,200)
  await h.cron('2026-11-01T15:00:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===pending.id).status,'stopped')
  await h.command('booking.revokeLink',{appointmentId:appointment.id})
  assert.equal((await h.request(reminderPath,{as:''})).status,404,'Withdrawing the original management authority also withdraws reminder links')
 }finally{await h.close()}
 await appointmentRecoveryJourney()
 await appointmentErasureJourney()
 await appointmentAuthorityJourney()
 await appointmentCustomerPreferenceJourney()
 await appointmentStandaloneErasureJourney()
 await appointmentChangedApprovalJourney()
 await appointmentSeriesJourney()
}
export async function declinedFixture(h){
 await shopSetup(h)
 const {asset,job}=await booking(h)
 let q=await estimate(h,job);q=await authorise(h,q,[])
 let current=(await h.state()).records.job.find(j=>j.id===job.id)
 const reading=await h.command('reading.record',{jobId:job.id,version:current.version,unit:'miles',stage:'intake',value:1000,observedAt:'2026-10-01T09:00:00Z'})
 const item=await h.command('decline.record',{estimateId:q.id,version:q.version,lineId:q.revisions[0].lines[0].id,readingId:reading.id,reason:'Customer deferred brake pads',evidence:'Recorded signed decision',dueValue:1200})
 const later=await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),startAt:'2026-11-02T09:00:00Z',endAt:'2026-11-02T10:00:00Z'})
 const repriced=await h.command('decline.reprice',{declinedWorkId:item.id,itemVersion:item.version,jobId:later.job.id,version:later.job.version,unitCents:3000,reason:'Inspected brake need and current stock'})
 const quote=await h.command('estimate.approve',{estimateId:repriced.estimate.id,version:repriced.estimate.version,revision:1})
 return {item:repriced.item,quote,job:later.job,asset}
}
export async function declinedOutreachJourney(){
 const h=await installation()
 try{
  const {item,quote,job}=await declinedFixture(h),fields=scheduleFields(item,{kind:'declined',estimateId:quote.id,quoteVersion:quote.version,urgency:'Review soon',availabilityConfirmed:true,availabilityEvidence:'Owner checked current stock and exact quote'})
  await h.command('outreach.schedule',{...fields,availabilityConfirmed:false},{status:422})
  const first=await h.command('outreach.schedule',fields),before=h.messages.length
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,before)
  const current=(await h.state()).records.job.find(j=>j.id===job.id)
  await h.command('reading.record',{jobId:job.id,version:current.version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  await h.cron('2026-11-01T14:15:00Z');assert.equal(h.messages.length,before+1);assert.match(h.messages.at(-1).text,/USD 64.50/);assert.equal((await h.state()).records.outreach.find(r=>r.id===first.id).status,'accepted')
  const next=await h.command('outreach.schedule',fields);await h.command('outreach.stop',{id:next.id,version:next.version,reason:'Customer opted out and booked by phone'});await h.cron('2026-11-01T14:30:00Z');assert.equal(h.messages.length,before+1)
  const booked=await h.command('outreach.schedule',fields)
  await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===item.assetId),bayId:'synthetic-mallet-later',startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T10:00:00Z'})
  await h.cron('2026-11-01T14:35:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===booked.id).status,'stopped','A later vehicle booking suppresses pending outreach')
  const third=await h.command('outreach.schedule',fields)
  let sent=await h.command('estimate.markSent',{estimateId:quote.id,version:quote.version,revision:1,method:'printed'})
  await h.command('estimate.authorise',{estimateId:sent.id,version:sent.version,revision:1,lineIds:[],customerName:'Cedar Bikes',method:'signed',evidence:'Customer declined the refreshed quote again'})
  await h.cron('2026-11-01T14:45:00Z');assert.equal((await h.state()).records.outreach.find(r=>r.id===third.id).status,'stopped');assert.equal(h.messages.length,before+1)
  const reviewed=await h.command('decline.inapplicable',{declinedWorkId:item.id,version:item.version,evidence:'Owner inspected the vehicle and the finding no longer applies'});assert.equal(reviewed.inapplicable.evidence,'Owner inspected the vehicle and the finding no longer applies');assert.deepEqual(reviewed.decision,item.decision)
  await h.command('outreach.schedule',{...fields,version:reviewed.version},{status:409})
  assert.deepEqual((await h.state()).records.declinedWork[0].decision,item.decision,'Original decision remains immutable')
 }finally{await h.close()}
}

async function appointmentRecoveryJourney(){
 const h=await outreachInstallation()
 try{
  const {appointment}=await appointmentFixture(h)
  const contact=await h.command('contact.save',{name:'synthetic-mallet-720',email:appointment.email,phone:'',communication:'email'})
  let draft=await prepareAppointment(h,appointment)
  await h.command('contact.save',{...contact,contactId:contact.id,notes:'Customer corrected their contact details'})
  await h.command('outreach.approve',{id:draft.id,version:draft.version,confirm:true},{status:409})
  await h.command('outreach.stop',{id:draft.id,version:draft.version,reason:'Prepare again after the contact correction'})
  draft=await prepareAppointment(h,appointment)
  await h.command('outreach.approve',{id:draft.id,version:draft.version+1,confirm:true},{status:409})
  const approved=await h.command('outreach.approve',{id:draft.id,version:draft.version,confirm:true})
  const db=await h.mf.getD1Database('DB'),before=h.messages.length
  // Fault only the outcome write, after the public cron has durably claimed and handed off.
  await db.exec("CREATE TRIGGER synthetic_outreach_crash BEFORE UPDATE ON mallet_records WHEN OLD.kind='outreach' AND json_extract(OLD.value,'$.status')='claimed' BEGIN SELECT RAISE(FAIL,'synthetic-mallet-interrupted-outcome'); END")
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,before+1)
  assert.equal((await h.state()).records.outreach.find(r=>r.id===approved.id).status,'claimed')
  await db.exec('DROP TRIGGER synthetic_outreach_crash');await h.restart();await h.cron('2026-11-01T14:02:00Z')
  let uncertain=(await h.state()).records.outreach.find(r=>r.id===approved.id)
  assert.equal(uncertain.status,'uncertain');assert.equal(uncertain.provider,'interrupted')
  await h.cron('2026-11-01T14:05:00Z');assert.equal(h.messages.length,before+1,'Interrupted claims never resend automatically')
  const permission=await h.command('outreach.consent',appointmentConsentFields(appointment))
  await h.command('outreach.prepare',{...scheduleFields(appointment),consentId:permission.id,consentVersion:permission.version},{status:409})
  uncertain=await h.command('outreach.resolve',{id:uncertain.id,version:uncertain.version,reason:'synthetic-mallet-721 owner inspected provider history and contacted the customer before any new approval'})
  assert.equal(uncertain.resolution.by.role,'owner');assert.ok(uncertain.resolution.at)
  const next=await approveAppointment(h,appointment,{},permission)
  await h.cron('2026-11-01T14:10:00Z');assert.equal(h.messages.length,before+2);assert.ok((await h.state()).records.outreach.find(r=>r.id===next.id).providerReference)
  const delayed=await approveAppointment(h,appointment,{allowedStart:9,allowedEnd:10})
  await h.configure({TEST_NOW:'2026-11-01T15:00:00Z'});await h.cron('2026-11-01T14:30:00Z');await h.configure({TEST_NOW:'2026-10-28T12:00:00Z'})
  assert.equal(h.messages.length,before+2,'Delayed execution cannot send at the exclusive last hour');assert.equal((await h.state()).records.outreach.find(r=>r.id===delayed.id).status,'skipped')
  const overnight=await approveAppointment(h,appointment,{dueAt:'2026-11-01T04:00:00Z',allowedStart:22,allowedEnd:2})
  await h.cron('2026-11-01T05:30:00Z');await h.cron('2026-11-01T06:30:00Z');assert.equal(h.messages.length,before+3,'An overnight window permits only one handoff across both DST hours');assert.equal((await h.state()).records.outreach.find(r=>r.id===overnight.id).status,'accepted')
  const pending=await approveAppointment(h,appointment),consent=(await h.state()).records.outreachConsent.find(c=>c.id===pending.consentId)
  const withdrawn=await h.command('outreach.withdraw',{consentId:consent.id,version:consent.version,reason:'synthetic-mallet-722 customer withdrew by telephone'})
  assert.equal(withdrawn.withdrawal.by.id,(await h.state()).actor.id)
  await h.cron('2026-11-01T14:20:00Z');assert.equal(h.messages.length,before+3);assert.equal((await h.state()).records.outreach.find(r=>r.id===pending.id).status,'stopped')
  await h.command('outreach.consent',appointmentConsentFields(appointment),{status:422})
  await h.command('outreach.prepare',{...scheduleFields(appointment),consentId:consent.id,consentVersion:withdrawn.version},{status:422})
  const audit=await h.api('/api/mallet/audit?action=outreach.resolve');assert.ok(audit.entries.some(e=>e.changes.some(c=>c.id===uncertain.id)&&e.actor.id===uncertain.resolution.by.id),'Resolution is attributable through the private audit door')
  const backup=await archive(h),fresh=await outreachInstallation()
  try{await restore(fresh,backup);await fresh.command('outreach.consent',appointmentConsentFields(appointment),{status:422});await fresh.cron('2026-11-01T14:30:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0)}finally{await fresh.close()}
 }finally{await h.close()}
}

async function appointmentErasureJourney(){
 const h=await outreachInstallation()
 try{
  const {appointment}=await appointmentFixture(h)
  const asset=await h.command('asset.create',{customerName:appointment.name,customerEmail:appointment.email,label:'synthetic-mallet-730 vehicle',identifier:'synthetic-mallet-730'})
  const contact=await h.command('contact.save',{name:appointment.name,email:appointment.email,phone:'',communication:'email'})
  const account=await h.command('customer.save',{name:appointment.name,kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown'})
  await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Customer identified their appointment vehicle'})
  const scheduled=await approveAppointment(h,appointment),old=await archive(h),before=h.messages.length
  const hold=await h.command('retention.hold',{customerId:account.id,scope:'personal',reason:'synthetic-mallet-732 documented custody review',caseReference:'synthetic-mallet-732'})
  const heldPreview=await h.command('retention.preview',{customerId:account.id,mode:'erase'})
  await h.command('customer.erase',{customerId:account.id,fingerprint:heldPreview.fingerprint,confirm:'ERASE',consent:true,reason:'Verified customer erasure request with a scoped hold',consentEvidence:'synthetic-mallet-731'})
  const held=(await h.state()).records.outreach.find(r=>r.id===scheduled.id);assert.equal(held.status,'stopped');assert.equal(held.content,scheduled.content,'A scoped hold preserves content but never pending send authority')
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,before)
  await h.command('retention.release',{holdId:hold.id,version:hold.version,consent:true,reason:'synthetic-mallet-733 documented continuing basis review complete'})
  const preview=await h.command('retention.preview',{customerId:account.id,mode:'erase'})
  await h.command('customer.erase',{customerId:account.id,fingerprint:preview.fingerprint,confirm:'ERASE',consent:true,reason:'Customer requests eligible personal erasure',consentEvidence:'synthetic-mallet-731 verified request'})
  const state=await h.state(),r=state.records.outreach.find(r=>r.id===scheduled.id),a=state.records.appointment.find(a=>a.id===appointment.id)
  assert.equal(r.status,'stopped');assert.ok(r.erasedAt);assert.equal(r.to,'');assert.equal(r.content,'Erased personal content');assert.equal(a.email,'');assert.ok(a.privacyErasedAt)
  assert.equal(state.records.outreachConsent.find(c=>c.id===scheduled.consentId).to,'');assert.ok(state.records.outreachSuppression.length)
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,before,'Erasure stops pending outreach')
  await h.command('outreach.consent',appointmentConsentFields(a),{status:409})
  const later=await archive(h),fresh=await outreachInstallation(),stale=await outreachInstallation()
  try{
   await restore(stale,old,{status:400,laterJournal:{sourceIdentity:later[0].sourceIdentity,epoch:later[0].epoch,journal:later[0].journal}})
   await restore(fresh,later);assert.deepEqual((await fresh.state()).records.outreach,state.records.outreach);await fresh.cron('2026-11-01T14:00:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0)
  }finally{await fresh.close();await stale.close()}
 }finally{await h.close()}
}

async function appointmentAuthorityJourney(){
 const h=await outreachInstallation()
 try{
  const {appointment}=await appointmentFixture(h)
  const consent=await h.command('outreach.consent',appointmentConsentFields(appointment)),fields={...scheduleFields(appointment),consentId:consent.id,consentVersion:consent.version}
  for(const invalid of [{timeZone:'Unknown'},{allowedStart:9,allowedEnd:9},{expiresAt:'2026-11-01T05:00:00Z'},{expiresAt:'2026-12-01T18:00:00Z'}])await h.command('outreach.prepare',{...fields,...invalid},{status:400})
  const unchangedHours=await h.state();await h.command('outreach.prepare',{...fields,allowedStart:10},{status:422});assert.deepEqual(await h.state(),unchangedHours,'An owner cannot widen or change the customer recorded hours through approval')
  const draft=await h.command('outreach.prepare',fields),admin=await h.person(['synthetic-mallet-750','example.test'].join('@'),'admin')
  for(const [command,input]of [['outreach.consent',appointmentConsentFields(appointment)],['outreach.approve',{id:draft.id,version:draft.version,confirm:true}],['outreach.withdraw',{consentId:consent.id,version:consent.version,reason:'Not the owner'}],['outreach.resolve',{id:draft.id,version:draft.version,reason:'Not the owner'}]]){
   const before=await h.state();await h.command(command,input,{as:admin.cookie,status:403});assert.deepEqual(await h.state(),before,'Non-owner outreach commands change nothing')
  }
  assert.equal((await h.state({as:admin.cookie})).records.outreachConsent,undefined);assert.equal((await h.state({as:admin.cookie})).records.outreach,undefined)
  await h.command('outreach.approve',{id:draft.id,version:draft.version,confirm:true})
  const db=await h.mf.getD1Database('DB'),before=h.messages.length
  // Revoke the issuer exactly as management-token preparation completes, before final handoff.
  await db.exec("CREATE TRIGGER synthetic_revoke_outreach AFTER INSERT ON mallet_booking_reminder_tokens BEGIN UPDATE oa_operators SET version=version+1 WHERE role='owner'; END")
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,before,'A revoked owner cannot authorize handoff even after the durable claim')
  await db.exec('DROP TRIGGER synthetic_revoke_outreach')
  assert.equal((await h.request('/api/mallet/state')).status,401,'Revoked native authority cannot inspect private records')
  const stored=await db.prepare("SELECT value FROM mallet_records WHERE kind='outreach' AND id=?").bind(draft.id).first();assert.equal(JSON.parse(stored.value).status,'skipped')
 }finally{await h.close()}
 const spring=await outreachInstallation({bindings:{TEST_NOW:'2026-03-08T05:00:00Z'}})
 try{
  const {appointment}=await appointmentFixture(spring),permission=await spring.command('outreach.consent',appointmentConsentFields(appointment,{consentedAt:'2026-03-08T00:00:00-05:00',allowedStart:2,allowedEnd:3}))
  const row=await approveAppointment(spring,appointment,{dueAt:'2026-03-08T06:00:00Z',expiresAt:'2026-03-08T10:00:00Z',allowedStart:2,allowedEnd:3},permission),before=spring.messages.length
  for(const at of ['2026-03-08T06:59:00Z','2026-03-08T07:00:00Z','2026-03-08T07:30:00Z'])await spring.cron(at)
  assert.equal(spring.messages.length,before,'The missing spring-forward hour never grants a made-up send window')
  await spring.cron('2026-03-08T10:00:00Z');assert.equal((await spring.state()).records.outreach.find(r=>r.id===row.id).status,'stopped');assert.equal(spring.messages.length,before,'Expired approval never sends')
 }finally{await spring.close()}
}


async function appointmentCustomerPreferenceJourney(){
 const h=await outreachInstallation()
 try{
  const {appointment:a,path,service}=await appointmentFixture(h),before=await h.state()
  const choice={action:'reminder-consent',version:a.version,wordingVersion:'appointment-permission-v1',consent:'yes',timeZone:'America/New_York',allowedStart:9,allowedEnd:18}
  assert.equal((await bookingPost(h,path,{...choice,consent:'no'})).status,422)
  assert.deepEqual(await h.state(),before,'A missing affirmative customer choice changes nothing')
  assert.equal((await bookingPost(h,path,choice,{origin:'https://other.test'})).status,403)
  assert.equal((await bookingPost(h,'/book/'+ 'x'.repeat(43),choice)).status,404)
  await h.command('outreach.customerConsent',{subjectId:a.id,...choice},{status:403})
  assert.equal((await bookingPost(h,path,choice)).status,200)
  const permission=(await h.state()).records.outreachConsent[0]
  assert.equal(permission.by.role,'customer');assert.equal(permission.captureChannel,'customer-form');assert.equal(permission.consentedAt,permission.at)
  assert.equal(permission.sourceEvidence,'Private appointment form '+a.id);assert.equal(permission.to,a.email)
  const otherInput={...holdFields(service),email:['synthetic-mallet-760','example.test'].join('@'),name:'synthetic-mallet-760',slotId:slotId(service,{...service.windows[0],startAt:'2026-11-01T20:00:00.000Z'})}
  const otherHold=await bookingPost(h,'/book',otherInput);assert.equal(otherHold.status,303)
  const otherPath=otherHold.headers.get('location');assert.equal((await bookingPost(h,otherPath,{action:'confirm',version:1})).status,200)
  const other=(await h.state()).records.appointment.find(x=>x.id!==a.id)
  const own=await approveAppointment(h,a,{},permission),otherReminder=await approveAppointment(h,other),calls=h.messages.length
  assert.equal((await bookingPost(h,path,{action:'reminder-withdraw',version:a.version,subjectId:other.id})).status,200)
  let state=await h.state();assert.equal(state.records.outreach.find(r=>r.id===own.id).status,'stopped');assert.equal(state.records.outreach.find(r=>r.id===otherReminder.id).status,'pending')
  assert.equal(state.records.outreachConsent.find(c=>c.id===permission.id).withdrawal.by.role,'customer')
  const withdrawnState=await h.state()
  assert.equal((await bookingPost(h,path,choice)).status,422);assert.deepEqual(await h.state(),withdrawnState,'A replayed capture cannot restore withdrawn authority')
  await h.command('outreach.consent',appointmentConsentFields(a),{status:422})
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,calls+1);assert.deepEqual(h.messages.at(-1).to,[other.email])
  assert.equal((await h.state()).records.appointment.find(x=>x.id===a.id).status,'confirmed','Withdrawal does not cancel or move the appointment')
  const backup=await archive(h),fresh=await outreachInstallation()
  try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.outreachConsent,(await h.state()).records.outreachConsent);assert.equal((await bookingPost(fresh,path,choice)).status,404);await fresh.cron('2026-11-01T14:30:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0)}finally{await fresh.close()}
  await h.command('booking.revokeLink',{appointmentId:a.id});assert.equal((await bookingPost(h,path,{action:'reminder-withdraw',version:a.version})).status,404)
 }finally{await h.close()}
}

async function appointmentStandaloneErasureJourney(){
 const h=await outreachInstallation()
 try{
  const {appointment:a,path}=await appointmentFixture(h)
  const asset=await h.command('asset.create',{customerName:a.name,customerEmail:a.email,label:'synthetic-mallet-761',identifier:'synthetic-mallet-761'})
  const scheduled=await approveAppointment(h,a),old=await archive(h),calls=h.messages.length
  await h.command('asset.erase',{assetId:asset.id,confirm:'ERASE'})
  const state=await h.state(),record=state.records.outreach.find(r=>r.id===scheduled.id)
  assert.equal(record.status,'stopped');assert.equal(record.to,'');assert.equal(record.content,'Erased personal content');assert.ok(record.erasedAt)
  assert.equal(state.records.outreachConsent.find(c=>c.id===scheduled.consentId).to,'')
  assert.ok(state.records.outreachConsent.find(c=>c.id===scheduled.consentId).withdrawnAt)
  assert.equal(state.records.appointment.find(x=>x.id===a.id).email,'')
  assert.equal((await h.request(path,{as:''})).status,404);await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,calls)
  const latest=await archive(h),fresh=await outreachInstallation(),stale=await outreachInstallation()
  try{
   await restore(stale,old,{status:400,laterJournal:{sourceIdentity:latest[0].sourceIdentity,epoch:latest[0].epoch,journal:latest[0].journal}})
   await restore(fresh,latest);assert.deepEqual((await fresh.state()).records.outreach,state.records.outreach)
   await fresh.command('outreach.consent',appointmentConsentFields(state.records.appointment[0]),{status:409});await fresh.cron('2026-11-01T14:00:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0)
  }finally{await fresh.close();await stale.close()}
 }finally{await h.close()}
}

async function appointmentChangedApprovalJourney(){
 const h=await outreachInstallation()
 try{
  const {appointment:a,service}=await appointmentFixture(h),contact=await h.command('contact.save',{name:a.name,email:a.email,communication:'email'})
  const approved=await approveAppointment(h,a),calls=h.messages.length
  await h.command('contact.save',{...contact,contactId:contact.id,phone:'2125550100'})
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.length,calls);assert.equal((await h.state()).records.outreach.find(r=>r.id===approved.id).status,'stopped')
  const next=await approveAppointment(h,a)
  await h.command('booking.publish',{...service,serviceId:service.id,name:'synthetic-mallet-762 revised service'})
  await h.cron('2026-11-01T14:15:00Z');assert.equal(h.messages.length,calls);assert.equal((await h.state()).records.outreach.find(r=>r.id===next.id).status,'stopped','A source revision after approval prevents handoff')
 }finally{await h.close()}
}


export async function appointmentSeriesJourney(){
 const h=await outreachInstallation()
 try{
  const {appointment:a,path}=await appointmentFixture(h),steps=[{minutesBefore:180,instructions:'Bring the service record.'},{minutesBefore:60,instructions:'Check in at the front desk.'}]
  let config=await h.command('outreach.configure',{version:0,enabled:true,steps})
  const customerChoice={action:'reminder-consent',version:a.version,wordingVersion:'appointment-permission-v1',consent:'yes',timeZone:'America/New_York',allowedStart:9,allowedEnd:18}
  for(const stepIndex of [0,1])assert.equal((await bookingPost(h,path,{...customerChoice,stepIndex})).status,200)
  const consents=(await h.state()).records.outreachConsent
  assert.deepEqual(consents.map(c=>c.step.index).sort(),[0,1]);assert.ok(consents.every(c=>c.by.role==='customer'&&c.step.policyVersion===config.version))
  const scheduled=[]
  for(const c of consents.sort((a,b)=>a.step.index-b.step.index)){
   const dueAt=new Date(Date.parse(a.startAt)-c.step.minutesBefore*60000).toISOString()
   const fields={dueAt,expiresAt:'2026-11-01T18:59:00Z',instructions:c.step.instructions}
   if(!c.step.index){
    const unchanged=await h.state()
    await h.command('outreach.prepare',{...scheduleFields(a),...fields,instructions:'Different instructions',consentId:c.id,consentVersion:c.version},{status:422})
    assert.deepEqual(await h.state(),unchanged)
   }
   scheduled.push(await approveAppointment(h,a,fields,c))
  }
  const calls=h.messages.length
  await h.cron('2026-11-01T15:59:00Z');assert.equal(h.messages.length,calls)
  await h.cron('2026-11-01T16:00:00Z');assert.equal(h.messages.length,calls+1);assert.match(h.messages.at(-1).text,/Bring the service record/)
  await h.restart();await h.cron('2026-11-01T16:15:00Z');assert.equal(h.messages.length,calls+1)
  await h.cron('2026-11-01T18:00:00Z');assert.equal(h.messages.length,calls+2);assert.match(h.messages.at(-1).text,/Check in at the front desk/)
  await h.cron('2026-11-01T18:15:00Z');assert.equal(h.messages.length,calls+2)
  const pending=await approveAppointment(h,a,{dueAt:'2026-11-01T18:00:00Z',expiresAt:'2026-11-01T18:59:00Z',instructions:steps[1].instructions},await h.command('outreach.consent',appointmentConsentFields(a,{stepIndex:1})))
  const baseline=await h.state()
  await h.command('outreach.configure',{version:config.version,enabled:true,steps:[steps[0],steps[0]]},{status:400});assert.deepEqual(await h.state(),baseline)
  config=await h.command('outreach.configure',{version:config.version,enabled:false,steps});assert.equal(config.history.length,1)
  await h.cron('2026-11-01T18:30:00Z');assert.equal(h.messages.length,calls+2);assert.equal((await h.state()).records.outreach.find(r=>r.id===pending.id).status,'stopped')
  const backup=await archive(h),fresh=await outreachInstallation()
  try{
   await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.appointmentReminderPolicy,[config])
   assert.deepEqual((await fresh.state()).records.outreach,(await h.state()).records.outreach)
   await fresh.cron('2026-11-01T18:45:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your appointment reminder').length,0)
  }finally{await fresh.close()}
 }finally{await h.close()}
}
