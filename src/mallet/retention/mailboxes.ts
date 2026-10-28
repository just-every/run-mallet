import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
import type {Sql} from '../media/types'

/** Read identity history before profile retirement clears current mailboxes. */
export function customerMailboxes(state:State,scope:CustomerScope):Set<string>{
 const emails=new Set<string>(),add=(value:unknown)=>{if(typeof value==='string'&&value.trim())emails.add(value.trim().toLowerCase())}
 for(const contact of rows(state,'contact').filter(c=>scope.contactIds.has(c.id))){
  add(contact.email)
  for(const old of contact.history??[])add(old.email)
 }
 for(const asset of scope.assets)add(asset.customerEmail)
 for(const job of scope.jobs)add(job.asset?.customerEmail)
 for(const event of rows(state,'event').filter(e=>scope.assetIds.has(e.assetId)&&e.kind.startsWith('asset.'))){
  add(event.data?.customerEmail);add(event.data?.before?.customerEmail);add(event.data?.after?.customerEmail)
 }
 return emails
}
const matches=(emails:Set<string>,value:unknown)=>typeof value==='string'&&emails.has(value.trim().toLowerCase())
const appointments=(state:State,emails:Set<string>)=>rows(state,'appointment').filter(a=>matches(emails,a.email))

/** Capability withdrawal is immediate; holds still protect the retained records. */
export function revokeMailboxAccess(state:State,emails:Set<string>):Sql[]{
 const ids=JSON.stringify(appointments(state,emails).map(a=>a.id)),recipients=JSON.stringify([...emails])
 return [
  {sql:'DELETE FROM mallet_booking_tokens WHERE appointment_id IN (SELECT value FROM json_each(?))',params:[ids]},
  {sql:'DELETE FROM mallet_booking_reminder_tokens WHERE appointment_id IN (SELECT value FROM json_each(?))',params:[ids]},
  {sql:"DELETE FROM mallet_assistant_keys WHERE grant_id IN (SELECT id FROM mallet_records WHERE kind='assistantGrant' AND json_extract(value,'$.kind')='send' AND json_extract(value,'$.subjectId') IN (SELECT value FROM json_each(?)))",params:[ids]},
  {sql:"DELETE FROM mallet_outreach_authority WHERE outreach_id IN (SELECT id FROM mallet_records WHERE kind='outreach' AND lower(trim(json_extract(value,'$.to'))) IN (SELECT value FROM json_each(?)))",params:[recipients]}
 ]
}

/** Keep reference and scheduling history valid without mutable personal content. */
export function eraseMailboxRecords(state:State,emails:Set<string>,at:string):Sql[]{
 const queries:Sql[]=[],ids=new Set(appointments(state,emails).map(a=>a.id)),marker='Erased personal content'
 const save=(kind:string,row:any,fields:any)=>queries.push(write(kind,{...row,...fields,version:row.version+1,privacyErasedAt:at}))
 for(const a of appointments(state,emails))save('appointment',a,{
  name:'Erased customer',email:'',sourceHash:'erased',status:'canceled',canceledAt:a.canceledAt??at,
  consent:{...a.consent,text:marker},
  ...(a.attendance?{attendance:{...a.attendance,evidence:marker}}:{}),
  ...(a.attendanceCorrections?{attendanceCorrections:a.attendanceCorrections.map((v:any)=>({...v,evidence:marker,reason:marker}))}:{})
 })
 for(const r of rows(state,'bookingWaitlist').filter(r=>matches(emails,r.email)))save('bookingWaitlist',r,{
  name:'Erased customer',email:'',sourceHash:'erased',status:'withdrawn',withdrawnAt:at,
  consent:{...r.consent,text:marker,evidence:marker}
 })
 for(const r of rows(state,'outreach').filter(r=>matches(emails,r.to)))save('outreach',r,{
  to:'Erased customer',instructions:marker,consentEvidence:marker,status:'stopped',stoppedAt:at,stopReason:marker,
  ...(r.content?{content:marker}:{}),...(r.review?{review:{...r.review,to:'Erased customer'}}:{}),
  ...(r.availabilityEvidence?{availabilityEvidence:marker}:{}),...(r.urgency?{urgency:marker}:{})
 })
 for(const r of rows(state,'assistantSend').filter(r=>ids.has(r.appointmentId)||matches(emails,r.to)))save('assistantSend',r,{
  to:'Erased customer',content:marker,status:'stopped',stoppedAt:at,stopReason:marker,
  ...(r.review?{review:{...r.review,to:'Erased customer',content:marker}}:{})
 })
 for(const r of rows(state,'assistantIntake').filter(r=>ids.has(r.appointmentId)))save('assistantIntake',r,{request:marker,consentEvidence:marker})
 return queries
}
