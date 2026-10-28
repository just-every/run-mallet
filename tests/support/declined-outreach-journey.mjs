import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {declinedFixture,declinedScheduleFields,declinedConsentInput,declinedAvailabilityInput,scheduleFields,OUTREACH_CLOCK} from './outreach-journey.mjs'

/** Native permission and eligibility through commands, cron, private exports and restore. */
export async function declinedEligibilityJourney(){
 let reject=false,uncertain=false
 const h=await installation({clock:OUTREACH_CLOCK,mailService:async()=>uncertain?Response.json({error:'synthetic-mallet-854'},{status:503}):reject?Response.json({error:'synthetic-mallet-820'},{status:422}):Response.json({id:'synthetic-mallet-821'})})
 try{
  const fixture=await declinedFixture(h),{item,job,stock,bin}=fixture
  const latest=async(kind,id)=>(await h.state()).records[kind].find(r=>r.id===id)
  const decision=structuredClone(item.decision),original=structuredClone((await h.state()).records.estimate.find(q=>q.id===item.estimateId))
  await h.command('reading.record',{jobId:job.id,version:(await latest('job',job.id)).version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  const sent=()=>h.messages.filter(m=>m.subject==='Your declined-work follow-up').length
  const approve=async(overrides={})=>h.command('outreach.schedule',await declinedScheduleFields(h,fixture,overrides))
  const stopped=async(row,pattern)=>{const count=sent();await h.cron('2026-11-01T14:00:00Z');assert.equal(sent(),count,'Invalidated approval never reaches the controlled mail edge');assert.match((await latest('outreach',row.id)).stopReason,pattern);assert.equal((await latest('outreach',row.id)).status,'stopped')}
  const capture=declinedConsentInput(fixture),permission=await h.command('outreach.consent',capture),captured=(await h.state()).records.declinedConsent.length
  assert.deepEqual(await h.command('outreach.consent',capture),permission)
  assert.equal((await h.state()).records.declinedConsent.length,captured,'Replaying one customer statement cannot create a second permission')
  // A changed stock ledger invalidates even when plenty of the part remains.
  let row=await approve(),fields=await declinedScheduleFields(h,fixture)
  await h.command('stock.receive',{itemBarcode:stock.barcode,binBarcode:bin.barcode,quantity:1,expectedQuantity:1,reference:'synthetic-mallet-822',reason:'A new native receipt after approval'})
  await stopped(row,/availability sources changed/i)
  await h.command('outreach.schedule',fields,{status:409})
  // Actual unavailability refuses a new review, regardless of a boolean assertion.
  const reservation=await h.command('stock.reserve',{itemBarcode:stock.barcode,binBarcode:bin.barcode,jobId:job.id,quantity:11,reference:'synthetic-mallet-823'})
  await h.command('outreach.availability',declinedAvailabilityInput(fixture),{status:409})
  await h.command('stock.release',{reservationId:reservation.id,version:reservation.version,reason:'Release native test demand'})
  const expiring=await h.command('outreach.availability',declinedAvailabilityInput(fixture,{expiresAt:'2026-11-01T13:59:00Z'}))
  await h.command('outreach.schedule',{...fields,availabilityId:expiring.id,availabilityVersion:expiring.version},{status:409})
  row=await approve()
  let asset=await latest('asset',item.assetId)
  const oldRecipient=asset.customerEmail,newRecipient='synthetic-mallet-824'+String.fromCharCode(64)+'example.test'
  await h.command('asset.update',{...asset,assetId:asset.id,customerEmail:newRecipient})
  await stopped(row,/contact changed/i)
  await h.command('outreach.consent',declinedConsentInput(fixture),{status:400})
  asset=await latest('asset',item.assetId);await h.command('asset.update',{...asset,assetId:asset.id,customerEmail:oldRecipient})
  // The displayed price is the exact approved quote, never a later revision.
  row=await approve()
  const quote=await latest('estimate',fixture.quote.id),rev=quote.revisions.at(-1)
  let revised=await h.command('estimate.revise',{estimateId:quote.id,version:quote.version,revision:rev.n,lines:rev.lines.map(l=>({id:l.id,kind:l.kind,description:l.description,quantity:l.quantity,unitCents:l.unitCents+100}))})
  await stopped(row,/quote changed/i)
  revised=await h.command('estimate.approve',{estimateId:revised.id,version:revised.version,revision:revised.revisions.at(-1).n});fixture.quote=revised
  // A quote identifier alone cannot bind unrelated replacement work to this permission.
  let replacement=await h.command('estimate.revise',{estimateId:revised.id,version:revised.version,revision:revised.revisions.at(-1).n,lines:[{kind:'part',description:'Unrelated replacement work',quantity:2,unitCents:3100}]})
  replacement=await h.command('estimate.approve',{estimateId:replacement.id,version:replacement.version,revision:replacement.revisions.at(-1).n});fixture.quote=replacement
  await h.command('outreach.availability',declinedAvailabilityInput(fixture),{status:409})
  let rebound=await h.command('estimate.revise',{estimateId:replacement.id,version:replacement.version,revision:replacement.revisions.at(-1).n,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:3100}]})
  rebound=await h.command('estimate.approve',{estimateId:rebound.id,version:rebound.version,revision:rebound.revisions.at(-1).n});fixture.quote=rebound
  // Capacity changes invalidate the quoted native slot without inventing supplier availability.
  row=await approve()
  const absence=await h.command('calendar.absenceSave',{technicianId:(await h.state()).actor.id,startAt:'2026-11-02T09:00:00Z',endAt:'2026-11-02T10:00:00Z',reason:'Technician unavailable',active:true})
  await stopped(row,/availability unavailable/i)
  await h.command('calendar.absenceSave',{...absence,absenceId:absence.id,active:false})
  // Failed handoff is visible, cannot retry and needs human resolution before fresh approval.
  row=await approve();reject=true;const count=sent();await h.cron('2026-11-01T14:00:00Z');assert.equal(sent(),count+1)
  row=await latest('outreach',row.id);assert.equal(row.status,'failed');assert.ok(row.claimedAt&&row.outcomeAt);assert.match(row.content,/USD 66.65/)
  await h.restart();await h.cron('2026-11-01T14:15:00Z');assert.equal(sent(),count+1)
  const afterFailure=await declinedScheduleFields(h,fixture)
  await h.command('outreach.schedule',afterFailure,{status:409})
  row=await h.command('outreach.resolve',{id:row.id,version:row.version,evidence:'Owner checked the rejected handoff; no automatic retry; synthetic-mallet-825'})
  assert.equal(row.status,'failed');assert.equal(row.resolution.by.id,(await h.state()).actor.id);const resolvedId=row.id
  reject=false;const accepted=await approve();await Promise.all([h.cron('2026-11-01T14:20:00Z'),h.cron('2026-11-01T14:20:00Z')]);await h.restart();await h.cron('2026-11-01T14:25:00Z');assert.equal(sent(),count+2)
  row=await latest('outreach',accepted.id);assert.equal(row.status,'accepted');assert.equal(row.providerReference,'synthetic-mallet-821');assert.equal(h.messages.at(-1).text,row.content);assert.deepEqual(h.messages.at(-1).to,[row.to])
  const used=await latest('declinedConsent',row.consentId)
  const replayed=await h.command('outreach.consent',declinedConsentInput(fixture,{to:used.to,consentedAt:used.consentedTime,captureChannel:used.captureChannel,sourceEvidence:used.sourceEvidence}))
  assert.equal(replayed.id,used.id,'A used one-email permission stays used when its capture is replayed')
  await h.command('outreach.schedule',{...afterFailure,consentId:replayed.id,consentVersion:replayed.version},{status:409})
  assert.equal(sent(),count+2)
  // An ambiguous provider response remains visible and never resends on restart.
  const uncertainRow=await approve(),beforeUncertain=sent();uncertain=true
  await h.cron('2026-11-01T14:25:00Z');uncertain=false
  let unresolved=await latest('outreach',uncertainRow.id);assert.equal(unresolved.status,'uncertain');assert.ok(unresolved.claimedAt&&unresolved.outcomeAt)
  await h.restart();await h.cron('2026-11-01T14:26:00Z');assert.equal(sent(),beforeUncertain+1)
  await h.command('outreach.schedule',await declinedScheduleFields(h,fixture),{status:409})
  unresolved=await h.command('outreach.resolve',{id:unresolved.id,version:unresolved.version,evidence:'Owner reconciled the ambiguous handoff before considering any new email'})
  await h.command('outreach.schedule',{...await declinedScheduleFields(h,fixture),consentId:uncertainRow.consentId,consentVersion:uncertainRow.consentVersion},{status:409})
  assert.equal(unresolved.status,'uncertain','A human resolution preserves the original ambiguous outcome')
  // A revoked native technician invalidates authority even while the capacity record remains active.
  const technician=await h.person('synthetic-mallet-853'+String.fromCharCode(64)+'example.test','admin')
  await h.command('calendar.technicianSave',{technicianId:technician.id,skills:[],active:true})
  let currentJob=await latest('job',job.id)
  let plan=await h.command('dispatch.prepare',{jobId:job.id,version:currentJob.version,technicianId:technician.id,reason:'Owner selected the current native technician'})
  await h.command('dispatch.approve',{proposalId:plan.id,version:plan.version})
  const revoked=await approve(),beforeRevocation=sent()
  await h.api('/auth/operator/status',{operatorId:technician.id,status:'inactive'})
  await h.cron('2026-11-01T14:27:00Z');assert.equal(sent(),beforeRevocation)
  assert.equal((await latest('outreach',revoked.id)).status,'skipped');assert.match((await latest('outreach',revoked.id)).outcomeReason,/authority unavailable/)
  await h.command('outreach.availability',declinedAvailabilityInput(fixture),{status:409})
  currentJob=await latest('job',job.id)
  plan=await h.command('dispatch.prepare',{jobId:job.id,version:currentJob.version,technicianId:(await h.state()).actor.id,reason:'Owner reviewed replacement native capacity'})
  await h.command('dispatch.approve',{proposalId:plan.id,version:plan.version})
  const pending=await approve(),backup=await archive(h),fresh=await installation({clock:OUTREACH_CLOCK,bindings:{OWNER_EMAIL:'synthetic-mallet-826'+String.fromCharCode(64)+'example.test'}})
  try{
   await restore(fresh,backup)
   for(const kind of ['outreach','declinedConsent','declinedAvailability'])assert.deepEqual((await fresh.state()).records[kind],(await h.state()).records[kind])
   await fresh.cron('2026-11-01T14:30:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0,'Restored pending approval has no destination send authority')
   await fresh.command('outreach.availability',declinedAvailabilityInput(fixture),{status:409})
   const freshOwner=(await fresh.state()).actor.id
   await fresh.command('calendar.technicianSave',{technicianId:freshOwner,skills:[],active:true})
   const restoredJob=(await fresh.state()).records.job.find(j=>j.id===job.id)
   const plan=await fresh.command('dispatch.prepare',{jobId:job.id,version:restoredJob.version,technicianId:freshOwner,reason:'Fresh owner reviewed destination staff and capacity'})
   await fresh.command('dispatch.approve',{proposalId:plan.id,version:plan.version})
   const freshFields=await declinedScheduleFields(fresh,fixture)
   let restored=(await fresh.state()).records.outreach.find(r=>r.id===pending.id);await fresh.command('outreach.stop',{id:restored.id,version:restored.version,reason:'Owner reviewed inert restored approval'})
   await fresh.command('outreach.schedule',freshFields);await fresh.cron('2026-11-01T14:35:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your declined-work follow-up').length,1,'Fresh destination approval and current permission can authorize one email')
  }finally{await fresh.close()}
  // Customer withdrawal cannot be undone by recording another owner assertion.
  const consent=await latest('declinedConsent',pending.consentId)
  await h.command('outreach.withdraw',{consentId:consent.id,version:consent.version,evidence:'Customer withdrew declined-work email permission at the counter'})
  await stopped(await latest('outreach',pending.id),/withdrew/i)
  await h.command('outreach.consent',declinedConsentInput(fixture),{status:409})
  const events=(await h.state()).records.event.filter(e=>e.kind.startsWith('outreach.'))
  for(const action of ['outreach.consent','outreach.availability','outreach.claim','outreach.outcome','outreach.resolve','outreach.withdraw'])assert.ok(events.some(e=>e.kind===action&&e.actor.id&&e.at),action)
  const audit=await h.api('/api/mallet/audit?action=outreach.resolve');assert.ok(audit.entries.some(e=>e.changes.some(c=>c.kind==='outreach'&&c.id===resolvedId)))
  assert.deepEqual((await latest('declinedWork',item.id)).decision,decision)
  assert.deepEqual(await latest('estimate',item.estimateId),original)
 }finally{await h.close()}
}

export async function declinedErasureJourney(){
 const h=await installation({clock:OUTREACH_CLOCK})
 try{
  const fixture=await declinedFixture(h),{item,job}=fixture
  const contact=await h.command('contact.save',{name:fixture.asset.customerName,email:fixture.asset.customerEmail,phone:'',communication:'email',notes:''})
  const account=await h.command('customer.save',{name:fixture.asset.customerName,kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''})
  let asset=(await h.state()).records.asset.find(a=>a.id===item.assetId)
  fixture.asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Reviewed native customer relationship'})
  await h.command('reading.record',{jobId:job.id,version:(await h.state()).records.job.find(j=>j.id===job.id).version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  const pending=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture)),old=await archive(h)
  const withdrawnPath=new URL(pending.content.match(/Stop declined-work emails: (https?:[^\s]+)/)[1]).pathname
  const exported=await h.command('customer.export',{customerId:account.id})
  assert.ok(exported.records.declinedConsent.some(r=>r.id===pending.consentId));assert.equal(exported.records.outreach.find(r=>r.id===pending.id).content,pending.content)
  const member=await h.person('synthetic-mallet-827'+String.fromCharCode(64)+'example.test')
  const commands=[['outreach.schedule',await declinedScheduleFields(h,fixture)],['outreach.consent',declinedConsentInput(fixture)],['outreach.availability',declinedAvailabilityInput(fixture)],['outreach.withdraw',{consentId:pending.consentId,version:1,evidence:'Untrusted withdrawal'}],['outreach.stop',{id:pending.id,version:pending.version,reason:'Untrusted stop'}],['outreach.resolve',{id:pending.id,version:pending.version,evidence:'Untrusted resolution'}]]
  const before=structuredClone((await h.state()).records)
  for(const [command,input] of commands)await h.command(command,input,{as:member.cookie,status:403})
  assert.deepEqual((await h.state()).records,before,'Unauthorized writes change no product record')
  const privateState=await h.state({as:member.cookie});for(const kind of ['outreach','declinedConsent','declinedAvailability'])assert.equal(privateState.records[kind],undefined)
  assert.equal((await h.request('/api/mallet/audit?action=outreach.consent',{as:member.cookie})).status,403)
  await h.api('/auth/operator/status',{operatorId:member.id,status:'inactive'})
  await h.command('outreach.consent',declinedConsentInput(fixture),{as:member.cookie,status:401})
  const {bookingService,bookingPost,holdFields}=await import('./booking-journey.mjs')
  const service=await bookingService(h,{windows:[{startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T12:00:00Z',bayId:'synthetic-mallet-864',technicianId:(await h.state()).actor.id,skills:['inspection']}]})
  const invitation=new URL(pending.content.match(/Book a follow-up: (https?:[^\s]+)/)[1])
  const booked=await bookingPost(h,'/book',{...holdFields(service),email:fixture.asset.customerEmail,declinedToken:invitation.searchParams.get('declined')})
  assert.equal(booked.status,303);const bookingPath=booked.headers.get('location')
  assert.equal((await bookingPost(h,bookingPath,{action:'confirm',version:1})).status,200)
  const linkedAppointment=(await h.state()).records.appointment.find(r=>r.declinedConsentId===pending.consentId)
  const appointmentReminder=await h.command('outreach.schedule',scheduleFields(linkedAppointment))
  const linkedExport=await h.command('customer.export',{customerId:account.id})
  assert.ok(linkedExport.records.appointment.some(r=>r.declinedConsentId===pending.consentId),'The customer export follows the exact declined-item booking association')
  asset=(await h.state()).records.asset.find(r=>r.id===item.assetId)
  await h.command('asset.update',{...asset,assetId:asset.id,customerEmail:'synthetic-mallet-865'+String.fromCharCode(64)+'example.test'})
  const hold=await h.command('retention.hold',{customerId:account.id,scope:'all',reason:'Retain authorization evidence for review',caseReference:'synthetic-mallet-828'})
  const erase=async()=>{const preview=await h.command('retention.preview',{customerId:account.id,categories:['media','personal','import']});return h.command('customer.erase',{customerId:account.id,categories:['media','personal','import'],fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requests eligible erasure',consentEvidence:'Recorded customer erasure request; synthetic-mallet-829'})}
  await erase()
  assert.equal((await h.request(withdrawnPath,{as:''})).status,404,'Even a held erasure revokes the private withdrawal capability')
  assert.equal((await h.request(bookingPath,{as:''})).status,404,'The linked earlier-mailbox appointment capability is revoked by customer scope after a contact correction')
  let state=await h.state();assert.equal(state.records.outreach.find(r=>r.id===pending.id).status,'stopped');assert.equal(state.records.declinedConsent.find(r=>r.id===pending.consentId).erasureSuppressedBy.id,state.actor.id)
  assert.equal(state.records.outreach.find(r=>r.id===pending.id).content,pending.content,'Held exact approval remains historical evidence')
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0)
  assert.equal(h.messages.filter(m=>m.subject==='Your appointment reminder').length,0)
  assert.equal((await h.state()).records.outreach.find(r=>r.id===appointmentReminder.id).status,'stopped')
  await h.command('outreach.consent',declinedConsentInput(fixture),{status:409})
  await h.command('retention.release',{holdId:hold.id,version:hold.version,consent:true,reason:'Review completed; eligible erasure may proceed'})
  const erased=await erase();assert.equal(erased.phase,'complete')
  state=await h.state();assert.equal(state.records.asset.find(a=>a.id===item.assetId).customerEmail,'')
  const erasedAppointment=state.records.appointment.find(r=>r.declinedConsentId===pending.consentId)
  assert.equal(erasedAppointment.email,'');assert.equal(erasedAppointment.name,'Erased customer');assert.ok(erasedAppointment.privacyErasedAt)
  assert.deepEqual(state.records.declinedWork.find(r=>r.id===item.id).decision,item.decision)
  const backup=await archive(h),stale=await installation({clock:OUTREACH_CLOCK})
  try{const refusal=await restore(stale,old,{laterJournal:{sourceIdentity:backup[0].sourceIdentity,epoch:backup[0].epoch,journal:backup[0].journal},status:400});assert.equal(refusal.error,'erasure_epoch')}finally{await stale.close()}
  const fresh=await installation({clock:OUTREACH_CLOCK,bindings:{OWNER_EMAIL:'synthetic-mallet-830'+String.fromCharCode(64)+'example.test'}})
  try{await restore(fresh,backup)
   for(const kind of ['declinedConsent','declinedAvailability','outreach'])assert.deepEqual((await fresh.state()).records[kind],state.records[kind])
   await fresh.cron('2026-11-01T14:15:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0)
   await fresh.command('outreach.consent',declinedConsentInput(fixture),{status:409})
  }finally{await fresh.close()}
 }finally{await h.close()}
}

/** Customer confirmation and withdrawal stop outreach without changing repair decisions. */
export async function declinedCustomerJourney(){
 const h=await installation({clock:OUTREACH_CLOCK})
 try{
  const fixture=await declinedFixture(h),{item,job}=fixture
  const latest=async(kind,id)=>(await h.state()).records[kind].find(r=>r.id===id)
  await h.command('reading.record',{jobId:job.id,version:(await latest('job',job.id)).version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  const first=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture))
  const {bookingService,bookingPost,holdFields}=await import('./booking-journey.mjs')
  const service=await bookingService(h,{windows:[{startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T12:00:00Z',bayId:'synthetic-mallet-851',technicianId:(await h.state()).actor.id,skills:['inspection']}]})
  const held=await bookingPost(h,'/book',{...holdFields(service),email:fixture.asset.customerEmail})
  assert.equal(held.status,303)
  const path=held.headers.get('location')
  assert.equal((await latest('outreach',first.id)).status,'pending','A tentative hold is not a confirmed customer booking')
  assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,200)
  await h.cron('2026-11-01T14:00:00Z')
  assert.equal((await latest('outreach',first.id)).status,'stopped');assert.match((await latest('outreach',first.id)).stopReason,/confirmed a later appointment/)
  assert.equal(h.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0)
  const next=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture))
  await h.cron('2026-11-01T14:15:00Z')
  const sent=await latest('outreach',next.id),mail=h.messages.findLast(m=>m.subject==='Your declined-work follow-up')
  assert.equal(sent.status,'accepted');assert.equal(mail.text,sent.content)
  const link=new URL(mail.text.match(/Stop declined-work emails: (https?:[^\s]+)/)[1]).pathname
  const pending=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture)),snapshot=await h.state()
  await h.command('outreach.customerWithdraw',{consentId:pending.consentId,version:1},{status:404})
  const wrongOrigin=await bookingPost(h,link,{action:'withdraw'},{origin:'https://untrusted.test'})
  assert.equal(wrongOrigin.status,403);assert.deepEqual((await h.state()).records,snapshot.records)
  const view=await h.request(link,{as:''}),html=await view.text()
  assert.equal(view.status,200);assert.match(view.headers.get('cache-control'),/no-store/)
  for(const privateValue of [fixture.asset.customerEmail,fixture.asset.customerName,item.line.description,item.id])assert.ok(!html.includes(privateValue),'Withdrawal page exposes no customer or repair details')
  const backup=await archive(h),fresh=await installation({clock:OUTREACH_CLOCK})
  try{await restore(fresh,backup);assert.equal((await fresh.request(link,{as:''})).status,404,'Historical approved content cannot restore the withdrawal capability')}finally{await fresh.close()}
  assert.equal((await bookingPost(h,link,{action:'withdraw',consentId:'synthetic-mallet-852',version:999})).status,200)
  assert.equal((await latest('outreach',pending.id)).status,'stopped')
  const consent=await latest('declinedConsent',sent.consentId);assert.equal(consent.withdrawal.by.role,'customer');assert.ok(consent.withdrawnAt)
  await h.cron('2026-11-01T14:30:00Z');assert.equal(h.messages.filter(m=>m.subject==='Your declined-work follow-up').length,1)
  await h.command('outreach.consent',declinedConsentInput(fixture),{status:409})
  const withdrawn=structuredClone((await h.state()).records)
  assert.equal((await bookingPost(h,link,{action:'withdraw'})).status,200);assert.deepEqual((await h.state()).records,withdrawn,'Repeated customer withdrawal is inert')
  assert.deepEqual((await latest('declinedWork',item.id)).decision,item.decision)
 }finally{await h.close()}
}


/** Actual recipient hours, delayed cron, expiry and repeated DST hours govern handoff. */
export async function declinedClockJourney(){
 const h=await installation({clock:OUTREACH_CLOCK})
 try{
  const fixture=await declinedFixture(h),{item,job}=fixture
  await h.command('reading.record',{jobId:job.id,version:(await h.state()).records.job.find(r=>r.id===job.id).version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  const sent=()=>h.messages.filter(m=>m.subject==='Your declined-work follow-up').length
  const approve=async(overrides={},availabilityOverrides={})=>{
   const fields=await declinedScheduleFields(h,fixture,overrides)
   if(Object.keys(availabilityOverrides).length){const review=await h.command('outreach.availability',declinedAvailabilityInput(fixture,availabilityOverrides));fields.availabilityId=review.id;fields.availabilityVersion=review.version}
   return h.command('outreach.schedule',fields)
  }
  const latest=async id=>(await h.state()).records.outreach.find(r=>r.id===id)
  const emptyWindow=await declinedScheduleFields(h,fixture,{allowedStart:9,allowedEnd:9})
  await h.command('outreach.schedule',emptyWindow,{status:400})
  const delayed=await approve({dueAt:'2026-10-28T09:00:00Z',expiresAt:'2026-10-28T14:00:00Z',allowedStart:5,allowedEnd:7})
  await h.cron('2026-10-28T10:00:00Z')
  assert.equal(sent(),0,'A cron scheduled inside allowed hours cannot send when actual execution is later, outside those hours')
  assert.equal((await latest(delayed.id)).status,'pending')
  await h.cron('2026-10-28T14:00:00Z');assert.equal((await latest(delayed.id)).status,'stopped');assert.equal(sent(),0)
  const end=await approve({expiresAt:'2026-11-02T08:00:00Z'},{expiresAt:'2026-11-02T08:00:00Z'})
  await h.cron('2026-11-01T23:00:00Z');assert.equal(sent(),0,'The final allowed hour is excluded')
  await h.cron('2026-11-02T08:00:00Z');assert.equal((await latest(end.id)).status,'stopped');assert.equal(sent(),0,'Expiry is absolute, including the exact boundary')
  const repeated=await approve({allowedStart:1,allowedEnd:2,dueAt:'2026-11-01T05:00:00Z'})
  await h.cron('2026-11-01T04:59:00Z');assert.equal(sent(),0)
  await h.cron('2026-11-01T05:00:00Z');assert.equal(sent(),1,'The first allowed hour is included')
  await h.restart();await h.cron('2026-11-01T06:00:00Z');assert.equal(sent(),1,'The repeated DST hour cannot send an approved email twice')
  assert.equal((await latest(repeated.id)).status,'accepted')
  const overnight=await approve({allowedStart:22,allowedEnd:3,dueAt:'2026-11-01T23:00:00Z',expiresAt:'2026-11-02T08:00:00Z'},{expiresAt:'2026-11-02T08:00:00Z'})
  await h.cron('2026-11-01T23:00:00Z');assert.equal(sent(),1)
  await h.cron('2026-11-02T03:00:00Z');assert.equal(sent(),2,'An overnight recipient window wraps midnight at the instant-specific IANA offset')
  assert.equal((await latest(overnight.id)).status,'accepted')
 }finally{await h.close()}
}


/** An invitation binds the exact declined item while retaining ordinary booking consent. */
export async function declinedBookingJourney(){
 const h=await installation({clock:OUTREACH_CLOCK})
 try{
  const fixture=await declinedFixture(h),{item,job}=fixture
  const pending=await h.command('outreach.schedule',await declinedScheduleFields(h,fixture))
  const invitation=new URL(pending.content.match(/Book a follow-up: (https?:[^\s]+)/)[1])
  const {bookingService,bookingPost,holdFields,slotId}=await import('./booking-journey.mjs')
  const service=await bookingService(h,{windows:[{startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T12:00:00Z',bayId:'synthetic-mallet-860',technicianId:(await h.state()).actor.id,skills:['inspection']}]})
  const form=await h.request(invitation.pathname+invitation.search,{as:''});assert.equal(form.status,200)
  assert.ok((await form.text()).includes('name="declinedToken"'),'The ordinary booking form retains the private invitation association')
  const fields={...holdFields(service),email:fixture.asset.customerEmail,declinedToken:invitation.searchParams.get('declined')}
  assert.equal((await bookingPost(h,'/book',{...fields,email:'synthetic-mallet-861'+String.fromCharCode(64)+'example.test'})).status,400)
  assert.equal((await h.state()).records.appointment?.length??0,0,'A wrong recipient cannot attach a booking to the declined item')
  const held=await bookingPost(h,'/book',{...fields,declinedWorkId:'synthetic-mallet-862',declinedSource:'synthetic-mallet-863'})
  assert.equal(held.status,303)
  const path=held.headers.get('location'),appointment=(await h.state()).records.appointment[0]
  assert.equal(appointment.declinedWorkId,item.id);assert.equal(appointment.declinedConsentId,pending.consentId);assert.equal(appointment.declinedOutreachId,pending.id)
  assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,200)
  await h.command('reading.record',{jobId:job.id,version:(await h.state()).records.job.find(r=>r.id===job.id).version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  await h.cron('2026-11-01T14:00:00Z')
  assert.equal(h.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0)
  assert.match((await h.state()).records.outreach.find(r=>r.id===pending.id).stopReason,/booked this declined work/)
  await h.command('outreach.schedule',await declinedScheduleFields(h,fixture),{status:409})
  assert.deepEqual((await h.state()).records.declinedWork.find(r=>r.id===item.id).decision,item.decision)
  const withdrawalPath=new URL(pending.content.match(/Stop declined-work emails: (https?:[^\s]+)/)[1]).pathname
  assert.equal((await bookingPost(h,withdrawalPath,{action:'withdraw'})).status,200)
  let confirmed=(await h.state()).records.appointment.find(r=>r.id===appointment.id)
  assert.equal((await bookingPost(h,path,{action:'reschedule',version:confirmed.version,slotId:slotId(service,{...service.windows[0],startAt:'2026-11-03T10:00:00.000Z'})})).status,200,'Email withdrawal does not revoke the separately consented appointment management')
  confirmed=(await h.state()).records.appointment.find(r=>r.id===appointment.id)
  assert.equal(confirmed.startAt,'2026-11-03T10:00:00.000Z');assert.equal(confirmed.status,'confirmed')
  const backup=await archive(h),fresh=await installation({clock:OUTREACH_CLOCK})
  try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.appointment,(await h.state()).records.appointment);assert.equal((await fresh.request(path,{as:''})).status,404)
   const destination=await bookingService(fresh,{windows:[{startAt:'2026-11-04T09:00:00Z',endAt:'2026-11-04T12:00:00Z',bayId:'synthetic-mallet-866',technicianId:(await fresh.state()).actor.id,skills:['inspection']}]})
   const destinationFields={...holdFields(destination),email:fixture.asset.customerEmail,declinedToken:fields.declinedToken}
   assert.equal((await bookingPost(fresh,'/book',destinationFields)).status,404,'Restored invitation content grants no new source-binding capability even with valid fresh capacity')
  }finally{await fresh.close()}
 }finally{await h.close()}
}
