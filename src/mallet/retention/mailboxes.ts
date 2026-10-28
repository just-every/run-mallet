import {historicalMailboxes,ownsMailboxRecord} from '../mailbox-identity'
import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
import type {Sql} from '../media/types'

/** Freeze record IDs before profile retirement clears identity links. */
export function customerMailboxes(state:State,scope:CustomerScope){
 const emails=historicalMailboxes(state,scope.accountIds,scope.contactIds)
 // Legacy records have no captured account link: never select a shared address.
 for(const account of rows(state,'customerAccount').filter(a=>!scope.accountIds.has(a.id))){
  for(const email of historicalMailboxes(state,new Set([account.id]),new Set(account.contactIds??[])))emails.delete(email)
 }
 const own=(r:any,field='email')=>ownsMailboxRecord(r,scope.accountIds,emails,field)
 const appointments=rows(state,'appointment').filter(r=>own(r)),ids=new Set(appointments.map(a=>a.id))
 const outreach=rows(state,'outreach').filter(r=>r.kind==='appointment'?ids.has(r.subjectId):own(r,'to'))
 return {appointments,ids,waitlist:rows(state,'bookingWaitlist').filter(r=>own(r)),outreach,
  sends:rows(state,'assistantSend').filter(r=>ids.has(r.appointmentId))}
}
export type MailboxRecords=ReturnType<typeof customerMailboxes>

/** Capability withdrawal is immediate; holds still protect the retained records. */
export function revokeMailboxAccess(state:State,records:MailboxRecords):Sql[]{
 const ids=JSON.stringify([...records.ids]),outreachIds=JSON.stringify(records.outreach.map(r=>r.id))
 return [
  {sql:'DELETE FROM mallet_booking_tokens WHERE appointment_id IN (SELECT value FROM json_each(?))',params:[ids]},
  {sql:'DELETE FROM mallet_booking_reminder_tokens WHERE appointment_id IN (SELECT value FROM json_each(?))',params:[ids]},
  {sql:"DELETE FROM mallet_assistant_keys WHERE grant_id IN (SELECT id FROM mallet_records WHERE kind='assistantGrant' AND json_extract(value,'$.kind')='send' AND json_extract(value,'$.subjectId') IN (SELECT value FROM json_each(?)))",params:[ids]},
  {sql:"DELETE FROM mallet_outreach_authority WHERE outreach_id IN (SELECT value FROM json_each(?))",params:[outreachIds]}
 ]
}

/** Keep reference and scheduling history valid without mutable personal content. */
export function eraseMailboxRecords(state:State,records:MailboxRecords,at:string):Sql[]{
 const queries:Sql[]=[],ids=records.ids,marker='Erased personal content'
 const save=(kind:string,row:any,fields:any)=>queries.push(write(kind,{...row,...fields,version:row.version+1,privacyErasedAt:at}))
 for(const a of records.appointments)save('appointment',a,{
  name:'Erased customer',email:'',sourceHash:'erased',status:'canceled',canceledAt:a.canceledAt??at,
  consent:{...a.consent,text:marker},
  ...(a.attendance?{attendance:{...a.attendance,evidence:marker}}:{}),
  ...(a.attendanceCorrections?{attendanceCorrections:a.attendanceCorrections.map((v:any)=>({...v,evidence:marker,reason:marker}))}:{})
 })
 for(const r of records.waitlist)save('bookingWaitlist',r,{
  name:'Erased customer',email:'',sourceHash:'erased',status:'withdrawn',withdrawnAt:at,
  consent:{...r.consent,text:marker,evidence:marker}
 })
 for(const r of records.outreach)save('outreach',r,{
  to:'Erased customer',instructions:marker,consentEvidence:marker,status:'stopped',stoppedAt:at,stopReason:marker,
  ...(r.content?{content:marker}:{}),...(r.review?{review:{...r.review,to:'Erased customer'}}:{}),
  ...(r.availabilityEvidence?{availabilityEvidence:marker}:{}),...(r.urgency?{urgency:marker}:{})
 })
 for(const r of records.sends)save('assistantSend',r,{
  to:'Erased customer',content:marker,status:'stopped',stoppedAt:at,stopReason:marker,
  ...(r.review?{review:{...r.review,to:'Erased customer',content:marker}}:{})
 })
 for(const r of rows(state,'assistantIntake').filter(r=>ids.has(r.appointmentId)))save('assistantIntake',r,{request:marker,consentEvidence:marker})
 return queries
}
