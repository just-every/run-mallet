import {recipientHash} from '../outreach-consent'
import {fail,find,rows,type State} from '../model'
import {customerScope,held,write,type CustomerScope} from './store'
import type {Sql} from '../media/types'

// Capture prior contact addresses before personal cleanup removes their history.
// Correcting the current mailbox must not strand an older reminder capability.
function recipients(s:State,scope:CustomerScope){return new Set([...scope.assets.map(a=>a.customerEmail),...rows(s,'contact').filter(c=>scope.contactIds.has(c.id)).flatMap(c=>[c.email,...(c.history??[]).map((prior:any)=>prior.email)])].filter(Boolean).map(v=>v.trim().toLowerCase()))}
function protectedRecipients(s:State){
 const emails=new Set<string>()
 for(const account of rows(s,'customerAccount').filter(a=>!a.mergedInto)){
  const scope=customerScope(s,account.id)
  if(held(s,scope,'personal').length)for(const email of recipients(s,scope))emails.add(email)
 }
 return emails
}
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
export function eraseOutreachContent(s:State,scope:CustomerScope,at:string,by:any={id:'retention',name:'Owner-authorized erasure',role:'system'}):Sql[]{
 // Match the retention planner's conservative protection for shared import custody.
 if(rows(s,'retentionHold').some(h=>!h.releasedAt&&(['import','all'].includes(h.scope)||h.scope==='personal'&&!h.customerId&&!h.jobId)))return []
 const emails=recipients(s,scope),protectedEmails=protectedRecipients(s),appointments=rows(s,'appointment').filter(a=>emails.has(a.email)&&!protectedEmails.has(a.email)),ids=new Set(appointments.map(a=>a.id)),queries:Sql[]=[]
 for(const a of appointments)queries.push(write('appointment',{...a,version:a.version+1,name:'Erased customer',email:'',sourceHash:'',privacyErasedAt:at}))
 for(const c of rows(s,'outreachConsent').filter(r=>ids.has(r.subjectId)))queries.push(write('outreachConsent',{...c,version:c.version+1,customerName:'Erased customer',step:c.step?{...c.step,instructions:'Erased personal content'}:null,to:'',sourceEvidence:'Erased personal content',withdrawnAt:c.withdrawnAt??at,withdrawal:{by,at,...c.withdrawal,reason:'Customer erasure request'},erasedAt:at}))
 for(const r of rows(s,'outreach').filter(r=>r.kind==='appointment'&&ids.has(r.subjectId)))queries.push(write('outreach',{...r,version:r.version+1,stoppedAt:r.stoppedAt??at,stoppedBy:r.stoppedBy??by,step:r.step?{...r.step,instructions:'Erased personal content'}:null,status:['draft','pending','claimed'].includes(r.status)?'stopped':r.status,to:'',instructions:'Erased personal content',content:'Erased personal content',consentEvidence:'Erased personal content',resolution:r.resolution?{...r.resolution,reason:'Erased personal content'}:undefined,stopReason:'Customer erasure request',erasedAt:at}))
 // Stop notes are mutable replicas of personal content, not the private audit's revision references.
 const outreachIds=new Set(rows(s,'outreach').filter(r=>r.kind==='appointment'&&ids.has(r.subjectId)).map(r=>r.id))
 for(const r of rows(s,'event').filter(r=>r.kind==='outreach.stop'&&outreachIds.has(r.subjectId)))queries.push(write('event',{...r,version:r.version+1,data:{...r.data,reason:'Erased personal content'},privacyErasedAt:at}))
 // Withdrawal evidence can contain personal free text; retain only its scope and attribution.
 for(const r of rows(s,'outreachSuppression').filter(r=>ids.has(r.subjectId)))queries.push(write('outreachSuppression',{...r,version:r.version+1,reason:'Customer erasure request',erasedAt:at}))
 return queries
}

/** The unused-vehicle door uses the same suppression and erasure fence. */
export function unusedAssetOutreachErasure(s:State,id:string,at:string,by:any):Sql[]{
 const a=find(s,'asset',id)
 if(a.customerAccountId)fail('CUSTOMER_ERASURE','Use the customer erasure review for a linked vehicle so current holds are respected.')
 const scope:CustomerScope={accounts:[],accountIds:new Set(),contactIds:new Set(),assets:[a],assetIds:new Set([a.id]),jobs:[],jobIds:new Set(),customerId:''}
 return [{sql:'INSERT INTO mallet_assert(ok) SELECT CASE WHEN EXISTS(SELECT 1 FROM mallet_meta WHERE id=1 AND version=?) THEN 1 ELSE 0 END',params:[s.version]},...revokeOutreachAccess(s,scope,at,by).queries,...eraseOutreachContent(s,scope,at,by)]
}
