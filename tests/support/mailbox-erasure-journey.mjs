import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'
import {bookingService,holdFields,bookingPost,slotId} from './booking-journey.mjs'
import {shopSetup} from './diagnosis-journey.mjs'

const mailbox=n=>'synthetic-mallet-'+n+String.fromCharCode(64)+'example.test'
const reason='synthetic-mallet-71'
async function identity(h,n){
 const contact=await h.command('contact.save',{name:'synthetic-mallet-'+n,email:mailbox(n),phone:'',communication:'email',notes:''})
 const account=await h.command('customer.save',{name:contact.name,kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''})
 let asset=await h.command('asset.create',{customerName:contact.name,customerEmail:mailbox(n+1),label:'Honda CR-V',identifier:'synthetic-mallet-'+n})
 asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason})
 return {contact,account,asset}
}
async function correct(h,person,n){
 person.contact=await h.command('contact.save',{...person.contact,contactId:person.contact.id,email:mailbox(n)})
 person.asset=await h.command('asset.update',{...person.asset,assetId:person.asset.id,customerEmail:mailbox(n+1)})
}
async function erase(h,account,mode='erase'){
 const preview=await h.command('retention.preview',{customerId:account.id,mode})
 const receipt=await h.command(mode==='erase'?'customer.erase':'retention.run',{customerId:account.id,fingerprint:preview.fingerprint,consent:true,confirm:mode==='erase'?'ERASE':'RUN RETENTION',reason,consentEvidence:reason})
 assert.equal(receipt.phase,'complete')
 return receipt
}

/** Ordinary customer erasure after two same-ID corrections, with live capabilities. */
export async function mailboxErasureJourney(h,{observe=async()=>{}}={}){
 await shopSetup(h)
 const person=await identity(h,80),day=new Date(Date.now()+86400000).toISOString().slice(0,10)
 const service=await bookingService(h,{windows:[{startAt:day+'T09:00:00.000Z',endAt:day+'T17:00:00.000Z',bayId:reason,technicianId:(await h.state()).actor.id,skills:['inspection']}]})
 const originalContactId=person.contact.id,originalAssetId=person.asset.id,paths=[]
 const reserve=async(n,confirmed=true)=>{
  const input=holdFields(service),startAt=new Date(Date.parse(input.startAt)+paths.length*3600000).toISOString()
  const response=await bookingPost(h,'/book',{...input,email:mailbox(n),slotId:slotId(service,{...input,startAt})})
  assert.equal(response.status,303,await response.text())
  const path=response.headers.get('location');paths.push(path)
  if(confirmed)assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,200)
  return (await h.state()).records.appointment.find(a=>a.startAt===startAt&&a.serviceId===service.id)
 }
 const first=await reserve(80),tentative=await reserve(81,false),unrelated=await reserve(99)
 const grant=await h.command('assistant.grant',{kind:'send',subjectId:tentative.id,label:reason,notBefore:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),spendCents:0,channel:'email',reason,confirm:true})
 const agent={as:'',headers:{authorization:'Bearer '+grant.token}}
 const send=await h.command('assistant.queue',{},agent)
 await h.command('assistant.review',{sendId:send.id,version:send.version,to:send.to,content:send.content,confirm:true})
 const now=Date.now(),hour=new Date(now).getUTCHours(),reminder=await h.command('outreach.schedule',{kind:'appointment',subjectId:first.id,version:first.version,dueAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),timeZone:'UTC',allowedStart:hour,allowedEnd:(hour+2)%24,instructions:reason,consent:true,consentEvidence:reason})
 await h.cron(now)
 const reminderMessage=h.messages.findLast(m=>m.subject==='Your appointment reminder'),reminderPath=new URL(reminderMessage.text.match(/https?:\S+\/book\/\S+/)[0]).pathname
 assert.equal((await h.request(reminderPath,{as:''})).status,200)
 const latestFirst=(await h.state()).records.appointment.find(a=>a.id===first.id)
 const pending=await h.command('outreach.schedule',{kind:'appointment',subjectId:first.id,version:latestFirst.version,dueAt:new Date(now+600000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),timeZone:'UTC',allowedStart:hour,allowedEnd:(hour+2)%24,instructions:reason,consent:true,consentEvidence:reason})
 const waitlist=await h.command('waitlist.add',{serviceId:service.id,name:person.contact.name,email:mailbox(80),earliestAt:service.windows[0].startAt,latestAt:service.windows[0].endAt,sourceHash:reason,consent:true,evidence:reason})
 await correct(h,person,82)
 await reserve(82);await reserve(83)
 await correct(h,person,84)
 await reserve(84);await reserve(85)
 assert.equal(person.contact.id,originalContactId);assert.equal(person.asset.id,originalAssetId)
 const old=await archive(h),before=await h.state(),admin=await h.person(mailbox(98),'admin')
 const preview=await h.command('retention.preview',{customerId:person.account.id})
 const input={customerId:person.account.id,fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason,consentEvidence:reason}
 const unchanged=await h.state()
 await h.command('customer.erase',input,{as:admin.cookie,status:403})
 await h.command('customer.erase',{...input,consent:false},{status:400})
 assert.deepEqual(await h.state(),unchanged,'Refused authority and consent change no records')
 for(const path of [...paths,reminderPath])assert.equal((await h.request(path,{as:''})).status,200)
 await observe('before',{paths,person})
 await erase(h,person.account)
 const state=await h.state(),unknown=await h.request('/book/'+'x'.repeat(43),{as:''}),unknownBody=await unknown.text()
 for(const path of [...paths.filter((_,i)=>i!==2),reminderPath]){
  const refused=await h.request(path,{as:''});assert.equal(refused.status,unknown.status);assert.equal(await refused.text(),unknownBody)
  assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,404,'Replay cannot restore booking authority')
 }
 assert.equal((await h.request(paths[2],{as:''})).status,200,'An unrelated customer keeps private access')
 assert.deepEqual(state.records.appointment.find(a=>a.id===unrelated.id),before.records.appointment.find(a=>a.id===unrelated.id))
 const related=state.records.appointment.filter(a=>a.serviceId===service.id&&a.id!==unrelated.id)
 assert.equal(related.length,6)
 assert.ok(related.every(a=>a.email===''&&a.name==='Erased customer'&&a.status==='canceled'))
 assert.equal(state.records.bookingWaitlist.find(r=>r.id===waitlist.id).email,'')
 for(const id of [reminder.id,pending.id]){const row=state.records.outreach.find(r=>r.id===id);assert.equal(row.status,'stopped');assert.equal(row.to,'Erased customer')}
 const erasedSend=state.records.assistantSend.find(r=>r.id===send.id)
 assert.equal(erasedSend.status,'stopped');assert.equal(erasedSend.to,'Erased customer');assert.equal(erasedSend.review.content,'Erased personal content')
 const mailCount=h.messages.length
 await h.command('assistant.send',{sendId:send.id,version:erasedSend.version},{...agent,status:401})
 await h.cron(now+900000);await h.cron(now+900000)
 assert.equal(h.messages.length,mailCount,'Erased email approvals and replay cannot send')
 await observe('after',{paths,person})
 const freshArchive=await archive(h),stale=await installation({bindings:{OWNER_EMAIL:mailbox(96)}})
 try{
  const laterJournal={sourceIdentity:freshArchive[0].sourceIdentity,epoch:freshArchive[0].epoch,journal:freshArchive[0].journal}
  assert.equal((await restore(stale,old,{laterJournal,status:400})).error,'erasure_epoch')
 }finally{await stale.close()}
 const recovered=await installation({bindings:{OWNER_EMAIL:mailbox(97)}})
 try{
  await restore(recovered,freshArchive)
  assert.deepEqual((await recovered.state()).records.appointment,state.records.appointment)
  assert.equal((await recovered.state()).records.assistantSend.find(r=>r.id===send.id).to,'Erased customer')
  for(const path of [...paths,reminderPath])assert.equal((await recovered.request(path,{as:''})).status,404)
  assert.equal((await restore(recovered,old,{status:400})).error,'erasure_epoch')
 }finally{await recovered.close()}
 // The same cleanup is reached by the existing manually approved retention door.
 const retained=await identity(h,90)
 const inputSlot=holdFields(service),startAt=new Date(Date.parse(inputSlot.startAt)+7*3600000).toISOString()
 const held=await bookingPost(h,'/book',{...inputSlot,email:mailbox(91),slotId:slotId(service,{...inputSlot,startAt})});assert.equal(held.status,303)
 await correct(h,retained,92)
 const policy=(await h.state()).records.retentionPolicy?.[0]
 await h.command('retention.policy',{version:policy?.version??0,mediaDays:null,personalDays:0,consent:true,reason})
 await erase(h,retained.account,'retention')
 assert.equal((await h.request(held.headers.get('location'),{as:''})).status,404)
 assert.equal((await h.state()).records.appointment.find(a=>a.startAt===startAt&&a.serviceId===service.id).email,'')
 assert.equal((await h.request(paths[2],{as:''})).status,200)
}

/** A vehicle and a reused address never transfer another person's booking history. */
export async function transferredMailboxJourney(h,{observe=async()=>{}}={}){
 await shopSetup(h)
 const a=await identity(h,110),b=await identity(h,120)
 const start=new Date(Date.now()+3*86400000).toISOString().slice(0,10)+'T09:00:00.000Z'
 const service=await bookingService(h,{windows:[{startAt:start,endAt:start.replace('09:','17:'),bayId:reason,technicianId:(await h.state()).actor.id,skills:['inspection']}]})
 const paths=[],appointments=[]
 for(const n of [110,111,120,121]){
  const input=holdFields(service),startAt=new Date(Date.parse(start)+paths.length*3600000).toISOString()
  const response=await bookingPost(h,'/book',{...input,email:mailbox(n),slotId:slotId(service,{...input,startAt})})
  assert.equal(response.status,303);const path=response.headers.get('location');paths.push(path)
  assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,200)
  appointments.push((await h.state()).records.appointment.find(r=>r.serviceId===service.id&&r.startAt===startAt))
 }
 const now=Date.now(),hour=new Date(now).getUTCHours(),reminders=[]
 for(const appointment of appointments){
  reminders.push(await h.command('outreach.schedule',{kind:'appointment',subjectId:appointment.id,version:appointment.version,dueAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),timeZone:'UTC',allowedStart:hour,allowedEnd:(hour+2)%24,instructions:reason,consent:true,consentEvidence:reason}))
 }
 await h.cron(now)
 const reminderPaths=appointments.map(a=>{const m=h.messages.findLast(m=>m.subject==='Your appointment reminder'&&m.to.includes(a.email));assert.ok(m);return new URL(m.text.match(/https?:\S+\/book\/\S+/)[0]).pathname})
 assert.equal(reminderPaths.length,4)
 const pending=[]
 for(const appointment of appointments){
  const latest=(await h.state()).records.appointment.find(r=>r.id===appointment.id)
  pending.push(await h.command('outreach.schedule',{kind:'appointment',subjectId:latest.id,version:latest.version,dueAt:new Date(now+600000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),timeZone:'UTC',allowedStart:hour,allowedEnd:(hour+2)%24,instructions:reason,consent:true,consentEvidence:reason}))
 }
 a.asset=await h.command('customer.linkAsset',{assetId:a.asset.id,version:a.asset.version,customerId:b.account.id,customerVersion:b.account.version,reason})
 a.asset=await h.command('asset.update',{...a.asset,assetId:a.asset.id,customerEmail:mailbox(122)})
 await correct(h,b,124)
 // Reusing A's address on B's contact must not turn A's existing rows into B's.
 b.contact=await h.command('contact.save',{...b.contact,contactId:b.contact.id,email:mailbox(110)})
 const before=await h.state(),aIds=new Set(appointments.slice(0,2).map(r=>r.id)),aReminderIds=new Set([...reminders.slice(0,2),...pending.slice(0,2)].map(r=>r.id))
 await observe('before',{paths,person:b})
 await erase(h,b.account)
 const after=await h.state()
 assert.deepEqual(after.records.appointment.filter(r=>aIds.has(r.id)),before.records.appointment.filter(r=>aIds.has(r.id)),'A appointments survive vehicle transfer and B erasure')
 assert.deepEqual(after.records.outreach.filter(r=>aReminderIds.has(r.id)),before.records.outreach.filter(r=>aReminderIds.has(r.id)),'A sent and pending reminders are untouched')
 for(const path of [...paths.slice(0,2),...reminderPaths.slice(0,2)])assert.equal((await h.request(path,{as:''})).status,200,'A keeps booking and reminder access')
 const unknown=await h.request('/book/'+'x'.repeat(43),{as:''}),body=await unknown.text()
 for(const path of [...paths.slice(2),...reminderPaths.slice(2)]){
  const response=await h.request(path,{as:''});assert.equal(response.status,unknown.status);assert.equal(await response.text(),body)
  assert.equal((await bookingPost(h,path,{action:'confirm',version:1})).status,404)
 }
 for(const appointment of appointments.slice(2))assert.equal(after.records.appointment.find(r=>r.id===appointment.id).email,'','B earlier-mailbox appointment is erased')
 for(const reminder of [...reminders.slice(2),...pending.slice(2)])assert.equal(after.records.outreach.find(r=>r.id===reminder.id).to,'Erased customer','B earlier-mailbox email is erased')
 const bMailCount=h.messages.filter(m=>appointments.slice(2).some(a=>m.to.includes(a.email))).length
 const aMailCount=h.messages.filter(m=>appointments.slice(0,2).some(a=>m.to.includes(a.email))).length
 await h.cron(now+900000)
 assert.equal(h.messages.filter(m=>appointments.slice(2).some(a=>m.to.includes(a.email))).length,bMailCount,'B pending email authority stays revoked')
 assert.equal(h.messages.filter(m=>appointments.slice(0,2).some(a=>m.to.includes(a.email))).length,aMailCount+2,'A pending reminders still send normally')
 await observe('after',{paths,person:b})
}
