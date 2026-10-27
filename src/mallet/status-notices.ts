import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State} from './model'
import {instant} from './workshop'
import {flowStage} from './flow'
import {allowedHour} from './outreach'
import {optedOut} from './approval-chasing'

export const STATUS_WORDING_VERSION='repair-status-email-v1'
export const STATUS_WORDING='Please email me updates about this repair, including diagnosis, a request to contact the shop about approval, parts delays, readiness and pickup. I may withdraw this permission by contacting the shop. This permission does not authorize repair work, payment or marketing.'
export const noticeKinds=['diagnosis','approval','parts','ready','pickup'] as const
export const noticeLabels:Record<string,string>={diagnosis:'Diagnosis update',approval:'Approval needed',parts:'Parts delay',ready:'Ready for pickup',pickup:'Pickup reminder'}
export const statusNoticeCommands=['statusNotice.consent','statusNotice.withdraw','statusNotice.approve','statusNotice.stop','statusNotice.resolve','statusNotice.claim','statusNotice.outcome','statusNotice.sweep']
export const internalStatusCommands=['statusNotice.claim','statusNotice.outcome','statusNotice.sweep']
const basis=(s:State,jobId:string)=>['job','estimate','diagnosis','inspectionReport','promisePlan','promise','flow'].flatMap(kind=>rows(s,kind).filter(r=>kind==='job'?r.id===jobId:r.jobId===jobId).map(r=>kind+':'+r.id+':'+r.version)).sort().join('|')
export function noticeSource(s:State,jobId:string,kind:string){
 const job=find(s,'job',jobId),asset=find(s,'asset',job.assetId),stage=flowStage(s,job)
 if(stage!==(kind==='pickup'?'ready':kind)||asset.privacyErasedAt)fail('NOTICE_STAGE','This notice requires the current matching repair stage and an unerased customer.')
 if(kind==='approval'&&!rows(s,'estimate').some(q=>q.jobId===jobId&&['approved','sent'].includes(q.status)))fail('NOTICE_APPROVAL','A person must approve the estimate before an approval-needed notice.')
 const source=rows(s,'stageEvent').filter(e=>e.jobId===jobId&&e.stage===stage).sort((a,b)=>a.sequence-b.sequence).at(-1)
 if(!source)fail('NOTICE_SOURCE','The repair needs an observed stage event.')
 return {job,asset,source}
}
export function noticeStop(s:State,r:any,now:string){
 if(r.stoppedAt)return r.stopReason
 if(now>=r.expiresAt)return 'Approval expired'
 const consent=rows(s,'statusConsent').find(c=>c.id===r.consentId)
 if(!consent||consent.version!==r.consentVersion||consent.withdrawnAt||rows(s,'statusConsent').some(c=>c.assetId===r.assetId&&c.withdrawnAt)||optedOut(s,r.to))return 'Customer permission withdrawn or changed'
 try{const {job,asset,source}=noticeSource(s,r.jobId,r.kind);if(job.version!==r.jobVersion||source.id!==r.sourceId||basis(s,r.jobId)!==r.basis||asset.version!==r.assetVersion||asset.customerEmail?.trim().toLowerCase()!==r.to)return 'Repair, stage or recipient changed'}catch{return 'Repair no longer eligible'}
 return ''
}
export const noticeDue=(r:any,now:string)=>now>=r.dueAt&&allowedHour(now,r.timeZone,r.allowedStart,r.allowedEnd)
export function noticeContent(kind:string,customerText:string){return noticeLabels[kind]+'\n\n'+customerText+'\n\nContact the shop to discuss this repair or withdraw status-email permission. This email does not authorize repair work or payment.'}
export const statusNotices:Handler=(c,command,p)=>{
 if(!statusNoticeCommands.includes(command))return
 if(!internalStatusCommands.includes(command)&&c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages status email and pickup follow-up.',null,403)
 if(command==='statusNotice.consent'){
  const job=find(c.s,'job',p.jobId),asset=find(c.s,'asset',job.assetId);expectVersion(job,p.version)
  const to=text(p.to,'customer email',254).toLowerCase()
  if(p.consent!==true||p.wordingVersion!==STATUS_WORDING_VERSION||p.channel!=='email')fail('NOTICE_CONSENT','Record affirmative email permission for the displayed repair-status wording.',null,422)
  if(asset.privacyErasedAt||to!==asset.customerEmail?.trim().toLowerCase()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))fail('NOTICE_RECIPIENT','Use the current customer email.',null,400)
  if(optedOut(c.s,to)||rows(c.s,'statusConsent').some(r=>r.assetId===asset.id&&r.withdrawnAt))fail('NOTICE_WITHDRAWN','Owner approval cannot override customer withdrawal.')
  const consentedAt=instant(p.consentedAt,'customer permission time with UTC offset')
  if(!/(Z|[+-]\d\d:\d\d)$/.test(String(p.consentedAt))||consentedAt>c.now)fail('INPUT','Record a past permission time with UTC offset.',null,400)
  const captureChannel=choice(p.captureChannel,['customer-form','customer-email','telephone','in-person'] as const,'permission capture channel')
  const row=put(c.s,'statusConsent',{jobId:job.id,assetId:asset.id,to,channel:'email',purpose:'repair-status',wording:STATUS_WORDING,wordingVersion:STATUS_WORDING_VERSION,consentedAt,consentedTime:p.consentedAt,captureChannel,sourceEvidence:text(p.sourceEvidence,'permission evidence reference',2000),by:who(c),at:c.now})
  event(c,command,job.id,row.id,{});return row
 }
 if(command==='statusNotice.withdraw'){
  const consent=find(c.s,'statusConsent',p.consentId);expectVersion(consent,p.version)
  if(consent.withdrawnAt)return consent
  const next=bump(c.s,'statusConsent',consent,{withdrawnAt:c.now,withdrawal:{by:who(c),reason:text(p.reason,'customer withdrawal evidence',2000)}})
  for(const row of rows(c.s,'statusNotice').filter(r=>r.assetId===consent.assetId&&r.status==='pending'))bump(c.s,'statusNotice',row,{status:'stopped',stoppedAt:c.now,stopReason:'Customer withdrew repair-status email permission'})
  event(c,command,consent.jobId,consent.id,{});return next
 }
 if(command==='statusNotice.approve'){
  const kind=choice(p.kind,noticeKinds,'notice type'),consent=find(c.s,'statusConsent',p.consentId);expectVersion(consent,p.version)
  const {job,asset,source}=noticeSource(c.s,consent.jobId,kind)
  if(p.jobId!==job.id||p.jobVersion!==job.version||p.sourceId!==source.id||p.confirm!==true)fail('NOTICE_CHANGED','Review this exact current repair and stage event.',null,409)
  if(consent.withdrawnAt||consent.to!==asset.customerEmail?.trim().toLowerCase()||optedOut(c.s,consent.to)||rows(c.s,'statusConsent').some(r=>r.assetId===asset.id&&r.withdrawnAt))fail('NOTICE_CONSENT','Current customer permission is required.')
  if(rows(c.s,'statusNotice').some(r=>r.sourceId===source.id&&r.kind===kind))fail('NOTICE_ONCE','This event and notice type already has a claim. Contact the customer personally; no replay send is available.')
  const dueAt=instant(p.dueAt,'send time'),expiresAt=instant(p.expiresAt,'approval expiry'),timeZone=text(p.timeZone,'recipient IANA timezone',100)
  try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Choose a valid recipient IANA timezone.',null,400)}
  const allowedStart=integer(p.allowedStart,'first allowed hour',0,23),allowedEnd=integer(p.allowedEnd,'last allowed hour',0,23)
  if(allowedStart===allowedEnd||expiresAt<=dueAt||expiresAt<=c.now||Date.parse(expiresAt)>Date.parse(c.now)+31*86400000)fail('INPUT','Use nonempty allowed hours and an expiry within 31 days.',null,400)
  const customerText=text(p.customerText,'customer-safe message',2000),templateVersion=kind+'-v1'
  if(p.templateVersion!==templateVersion)fail('NOTICE_TEMPLATE','Review the current template version.',null,409)
  const pickupDueAt=['ready','pickup'].includes(kind)?instant(p.pickupDueAt,'pickup follow-up deadline'):null
  if(pickupDueAt&&pickupDueAt<=dueAt)fail('INPUT','Pickup follow-up must be after the send time.',null,400)
  const row=put(c.s,'statusNotice',{jobId:job.id,jobVersion:job.version,basis:basis(c.s,job.id),assetId:asset.id,assetVersion:asset.version,sourceId:source.id,kind,consentId:consent.id,consentVersion:consent.version,to:consent.to,channel:'email',customerText,content:noticeContent(kind,customerText),templateVersion,dueAt,expiresAt,timeZone,allowedStart,allowedEnd,pickupDueAt,pickupPolicy:pickupDueAt?text(p.pickupPolicy,'shop pickup follow-up policy',2000):null,by:who(c),at:c.now,status:'pending'})
  event(c,command,job.id,row.id,{sourceId:source.id,templateVersion});return row
 }
 if(command==='statusNotice.sweep'){
  for(const r of rows(c.s,'statusNotice')){
   if(r.status==='pending'){const reason=noticeStop(c.s,r,c.now);if(reason)bump(c.s,'statusNotice',r,{status:'stopped',stoppedAt:c.now,stopReason:reason})}
   const live=find(c.s,'statusNotice',r.id)
   if(p.localIds?.includes(live.consentId)&&live.pickupDueAt&&c.now>=live.pickupDueAt&&!live.pickupClosed){
    const job=find(c.s,'job',live.jobId),collected=rows(c.s,'flow').some(f=>f.jobId===job.id&&f.collection)
    if(!collected&&!job.closure&&flowStage(c.s,job)==='ready'&&!rows(c.s,'statusNotice').some(n=>n.jobId===job.id&&n.uncollectedTaskId)){
     const task=put(c.s,'subtask',{kind:'pickup-followup',jobId:job.id,noticeId:r.id,title:'Contact customer about uncollected repair',assigneeId:'current-owner',dependsOn:[],createdBy:who(c),createdAt:c.now,completedAt:null,completedBy:null,policy:live.pickupPolicy})
     bump(c.s,'statusNotice',live,{uncollectedTaskId:task.id});event(c,command,job.id,r.id,{taskId:task.id,reason:'Pickup deadline elapsed'})
    }
   }
  }
  return {sweptAt:c.now}
 }
 const row=find(c.s,'statusNotice',p.id);expectVersion(row,p.version)
 if(command==='statusNotice.stop'){
  if(row.status!=='pending')fail('NOTICE_STATE','Only a pending notice can be stopped.')
  const next=bump(c.s,'statusNotice',row,{status:'stopped',stoppedAt:c.now,stopReason:text(p.reason,'stop reason',2000)});event(c,command,row.jobId,row.id,{});return next
 }
 if(command==='statusNotice.resolve'){
  if(row.resolution||!['failed','uncertain','claimed'].includes(row.status)&&!row.uncollectedTaskId)fail('NOTICE_STATE','No unresolved contact or pickup issue remains.')
  const resolution={by:who(c),at:c.now,reason:text(p.reason,'staff resolution',2000)}
  for(const task of rows(c.s,'subtask').filter(t=>[row.uncollectedTaskId,row.contactTaskId].includes(t.id)))if(!task.completedAt)bump(c.s,'subtask',task,{completedAt:c.now,completedBy:who(c)})
  const next=bump(c.s,'statusNotice',row,{resolution,pickupClosed:true});event(c,command,row.jobId,row.id,{});return next
 }
 if(command==='statusNotice.claim'){
  if(row.status!=='pending'||noticeStop(c.s,row,c.now)||!noticeDue(row,c.now))fail('NOTICE_NOT_DUE','This notice is no longer eligible.')
  return bump(c.s,'statusNotice',row,{status:'claimed',claimedAt:c.now})
 }
 if(row.status!=='claimed')fail('NOTICE_STATE','The handoff outcome was already recorded.')
 const status=choice(p.status,['accepted','development','failed','uncertain','skipped'] as const,'handoff outcome')
 let contactTaskId=row.contactTaskId
 if(['failed','uncertain'].includes(status)&&['ready','pickup'].includes(row.kind)&&!contactTaskId){const task=put(c.s,'subtask',{kind:'pickup-followup',jobId:row.jobId,noticeId:row.id,title:'Resolve failed pickup contact',assigneeId:'current-owner',dependsOn:[],createdBy:who(c),createdAt:c.now,completedAt:null,completedBy:null});contactTaskId=task.id}
 const next=bump(c.s,'statusNotice',row,{...(contactTaskId?{contactTaskId}:{}),status,provider:text(p.provider,'provider',100),providerReference:text(p.providerReference,'provider reference',1024,true),outcomeAt:c.now})
 event(c,command,row.jobId,row.id,{status});return next
}
