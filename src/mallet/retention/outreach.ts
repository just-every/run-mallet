import {recipientHash} from '../outreach-consent'
import {rows,type State} from '../model'
import {write,type CustomerScope} from './store'
import type {Sql} from '../media/types'

function recipients(s:State,scope:CustomerScope){return new Set([...scope.assets.map(a=>a.customerEmail),...rows(s,'contact').filter(c=>scope.contactIds.has(c.id)).map(c=>c.email)].filter(Boolean).map(v=>v.trim().toLowerCase()))}
/** Every erasure request withdraws sending, even when a hold preserves content. */
export function revokeOutreachAccess(s:State,scope:CustomerScope,at:string,by:any){
 const emails=recipients(s,scope),appointments=rows(s,'appointment').filter(a=>emails.has(a.email)),ids=new Set(appointments.map(a=>a.id)),queries:Sql[]=[],records:Sql[]=[]
 for(const a of appointments){
  const id=crypto.randomUUID()
  records.push(write('outreachSuppression',{id,version:1,subjectId:a.id,recipientHash:recipientHash(a.email),by,at,reason:'Customer erasure request',policy:'appointment-erasure-v1'}))
 }
 for(const consent of rows(s,'outreachConsent').filter(r=>ids.has(r.subjectId)&&!r.withdrawnAt))records.push(write('outreachConsent',{...consent,version:consent.version+1,withdrawnAt:at,withdrawal:{by,at,reason:'Customer erasure request'}}))
 for(const r of rows(s,'outreach').filter(r=>r.kind==='appointment'&&ids.has(r.subjectId))){
  queries.push({sql:'DELETE FROM mallet_outreach_authority WHERE outreach_id=?',params:[r.id]})
  if(['draft','pending','claimed'].includes(r.status)&&!r.stoppedAt)records.push(write('outreach',{...r,version:r.version+1,stoppedAt:at,stoppedBy:by,stopReason:'Customer erasure request',status:r.status==='claimed'?'claimed':'stopped'}))
 }
 for(const a of appointments){queries.push({sql:'DELETE FROM mallet_booking_reminder_tokens WHERE appointment_id=?',params:[a.id]},{sql:'DELETE FROM mallet_booking_tokens WHERE appointment_id=?',params:[a.id]})}
 return {queries:[...queries,...records],recordCount:records.length}
}
/** Eligible personal erasure removes mutable replicas; audit keeps revision references. */
export function eraseOutreachContent(s:State,scope:CustomerScope,at:string):Sql[]{
 const emails=recipients(s,scope),appointments=rows(s,'appointment').filter(a=>emails.has(a.email)),ids=new Set(appointments.map(a=>a.id)),queries:Sql[]=[]
 for(const a of appointments)queries.push(write('appointment',{...a,version:a.version+1,name:'Erased customer',email:'',sourceHash:'',privacyErasedAt:at}))
 for(const c of rows(s,'outreachConsent').filter(r=>ids.has(r.subjectId)))queries.push(write('outreachConsent',{...c,version:c.version+1,customerName:'Erased customer',to:'',sourceEvidence:'Erased personal content',withdrawal:c.withdrawal?{...c.withdrawal,reason:'Customer erasure request'}:undefined,erasedAt:at}))
 for(const r of rows(s,'outreach').filter(r=>r.kind==='appointment'&&ids.has(r.subjectId)))queries.push(write('outreach',{...r,version:r.version+1,to:'',instructions:'Erased personal content',content:'Erased personal content',consentEvidence:'Erased personal content',resolution:r.resolution?{...r.resolution,reason:'Erased personal content'}:undefined,stopReason:r.stoppedAt?'Customer erasure request':r.stopReason,erasedAt:at}))
 // Withdrawal evidence can contain personal free text; retain only its scope and attribution.
 for(const r of rows(s,'outreachSuppression').filter(r=>ids.has(r.subjectId)))queries.push(write('outreachSuppression',{...r,version:r.version+1,reason:'Customer erasure request',erasedAt:at}))
 return queries
}
