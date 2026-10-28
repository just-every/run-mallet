import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {declinedFixture,declinedScheduleFields,declinedConsentInput,declinedAvailabilityInput,OUTREACH_CLOCK} from './outreach-journey.mjs'

/** Native permission and eligibility through commands, cron, private exports and restore. */
export async function declinedEligibilityJourney(){
 let reject=false
 const h=await installation({clock:OUTREACH_CLOCK,mailService:async()=>reject?Response.json({error:'synthetic-mallet-820'},{status:422}):Response.json({id:'synthetic-mallet-821'})})
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
  const hold=await h.command('retention.hold',{customerId:account.id,scope:'all',reason:'Retain authorization evidence for review',caseReference:'synthetic-mallet-828'})
  const erase=async()=>{const preview=await h.command('retention.preview',{customerId:account.id,categories:['media','personal','import']});return h.command('customer.erase',{customerId:account.id,categories:['media','personal','import'],fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requests eligible erasure',consentEvidence:'Recorded customer erasure request; synthetic-mallet-829'})}
  await erase()
  let state=await h.state();assert.equal(state.records.outreach.find(r=>r.id===pending.id).status,'stopped');assert.equal(state.records.declinedConsent.find(r=>r.id===pending.consentId).erasureSuppressedBy.id,state.actor.id)
  assert.equal(state.records.outreach.find(r=>r.id===pending.id).content,pending.content,'Held exact approval remains historical evidence')
  await h.cron('2026-11-01T14:00:00Z');assert.equal(h.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0)
  await h.command('outreach.consent',declinedConsentInput(fixture),{status:409})
  await h.command('retention.release',{holdId:hold.id,version:hold.version,consent:true,reason:'Review completed; eligible erasure may proceed'})
  const erased=await erase();assert.equal(erased.phase,'complete')
  state=await h.state();assert.equal(state.records.asset.find(a=>a.id===item.assetId).customerEmail,'')
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
