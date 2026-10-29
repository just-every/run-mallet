import {assetType} from './asset-types'
import {invoiceBalance} from './payments'
import {bump,choice,event,expectVersion,fail,find,integer,object,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'

export const storageCommands=['storage.rule','storage.open','storage.review','storage.notice','storage.accrue','storage.payment','storage.dispose'] as const
const DAY=86400000
const instant=(value:unknown,label:string)=>{const raw=text(value,label,40);if(!/(Z|[+-]\d\d:\d\d)$/.test(raw)||!Number.isFinite(Date.parse(raw)))fail('INPUT',label+' needs a timezone.',null,400);return new Date(raw).toISOString()}
const past=(value:unknown,label:string,now:string)=>{const at=instant(value,label);if(at>now)fail('STORAGE_TIME',label+' cannot be in the future.');return at}
const evidence=(p:any)=>({reviewer:text(p.reviewer,'legal reviewer',200),reference:text(p.legalReference,'recorded legal review reference',2000)})
export const storageCase=(s:State,jobId:string)=>rows(s,'storageCase').find(r=>r.jobId===jobId)
export function storageBalance(s:State,r:Row,at:string){
 if(r.closed)return structuredClone(r.closed.balance)
 const end=r.closed?.at??at,days=Math.max(0,Math.floor((Date.parse(end)-Date.parse(r.startsAt))/DAY))
 const accruedCents=Math.min(r.rule.storageCapCents,days*r.dailyCents),paidCents=r.payments.reduce((n:number,p:any)=>n+p.amountCents,0)
 const storageDueCents=Math.max(0,accruedCents-paidCents),invoice=find(s,'invoice',r.invoiceId),repairDueCents=r.rule.repairLien?invoiceBalance(s,invoice).outstandingCents:0
 return {days,accruedCents,paidCents,storageDueCents,repairDueCents,lienCents:storageDueCents+repairDueCents,asOf:end}
}
export function storageDeadlines(r:Row){
 const noticeDueAt=new Date(Date.parse(r.uncollectedAt)+r.rule.noticeWithinDays*DAY).toISOString()
 const delivered=r.recipients.map((recipient:any)=>r.notices.find((n:any)=>n.recipientId===recipient.id))
 const allNotified=delivered.every(Boolean),earliestDisposalAt=new Date(Math.max(Date.parse(r.uncollectedAt)+r.rule.disposalAfterDays*DAY,...delivered.filter(Boolean).map((n:any)=>Date.parse(n.deliveredAt)+r.rule.waitDays*DAY))).toISOString()
 return {noticeDueAt,allNotified,earliestDisposalAt,noticesOnTime:allNotified&&delivered.every((n:any)=>n.sentAt<=noticeDueAt)}
}
function current(c:Context,r:Row){
 if(r.closed)fail('STORAGE_CLOSED','This custody case is closed; its history stays unchanged.')
 if(r.authorityOwner!==c.actor.id)fail('STORAGE_REVIEW','A destination owner must review physical custody, sources and the legal steps before any new action.')
 if(r.rule.effectiveFrom>c.now||r.rule.effectiveUntil<=c.now)fail('STORAGE_RULE_EXPIRED','Record a current legal review and rule version before continuing.')
}
export const storageLiens:Handler=(c,command,p)=>{
 if(!(storageCommands as readonly string[]).includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records storage, notices and legal disposition.',null,403)
 if(command==='storage.rule'){
  const state=choice(p.state,['CA','TX'],'shop state'),kind=choice(p.assetKind,['vehicle','device'],'property type'),effectiveFrom=instant(p.effectiveFrom,'effective from'),effectiveUntil=instant(p.effectiveUntil,'review expires')
  if(effectiveUntil<=effectiveFrom)fail('INPUT','Rule review expiry must follow its effective date.',null,400)
  const sources=Object.fromEntries(['storage','notice','lien','disposal'].map(key=>{
   const source=text(p[key+'Source'],key+' source URL',2000);let url:URL;try{url=new URL(source)}catch{fail('INPUT','Use an HTTPS source URL.',null,400)}
   const statuteParameters=new Set(['lawCode','sectionNum','division','title','part','chapter','article'])
   const publicStatuteQuery=url!.hostname==='leginfo.legislature.ca.gov'&&['/faces/codes_displaySection.xhtml','/faces/codes_displayText.xhtml'].includes(url!.pathname)&&[...url!.searchParams].every(([key,value])=>statuteParameters.has(key)&&value.length<=40&&/^[A-Za-z0-9. -]*$/.test(value))
   if(url!.protocol!=='https:'||url!.username||url!.password||url!.hash||url!.search&&!publicStatuteQuery)fail('INPUT','Use a public HTTPS source without credentials; only public California statute parameters are accepted in source queries.',null,400)
   return [key,{url:source,rule:text(p[key+'Rule'],key+' rule and source section',4000)}]
  }))
  const row=put(c.s,'storageRule',{state,assetKind:kind,label:text(p.label,'rule version label',200),effectiveFrom,effectiveUntil,sources,legalReview:evidence(p),noticeMethod:text(p.noticeMethod,'statutory notice method',200),startDelayHours:integer(p.startDelayHours,'storage delay hours',0,87600),noticeWithinDays:integer(p.noticeWithinDays,'notice deadline days',1,3650),waitDays:integer(p.waitDays,'wait after delivery days',1,3650),disposalAfterDays:integer(p.disposalAfterDays,'minimum custody days',1,3650),storageCapCents:integer(p.storageCapCents,'storage lien cap cents',0),repairLien:p.repairLien===true,by:who(c),at:c.now})
  event(c,command,null,row.id,{});return row
 }
 const job=find(c.s,'job',p.jobId)
 if(command==='storage.open'){
  if(storageCase(c.s,job.id)||rows(c.s,'flow').some(f=>f.jobId===job.id&&f.collection))fail('STORAGE_STATE','Use one uncollected custody case per repair; collected property cannot start storage.')
  const invoice=find(c.s,'invoice',job.invoiceId),rule=find(c.s,'storageRule',p.ruleId)
  if(!['approved','exported'].includes(invoice.status)||!['completed','invoiced'].includes(job.status))fail('STORAGE_STATE','Complete and approve the repair invoice first.')
  if(rule.by.id!==c.actor.id||rule.effectiveFrom>c.now||rule.effectiveUntil<=c.now)fail('STORAGE_REVIEW','Select a current rule reviewed by this owner.')
  if(rule.assetKind!==assetType(job.asset))fail('STORAGE_PROPERTY','Use a rule for this property type.')
  if(p.confirm!==true)fail('STORAGE_CONSENT','Explicitly confirm physical custody, applicable state rules and completed recipient search.')
  const uncollectedAt=past(p.uncollectedAt,'uncollected trigger time',c.now)
  if(uncollectedAt<(job.completedAt??job.endAt))fail('STORAGE_TIME','The storage trigger cannot precede repair completion.');
  if(uncollectedAt<rule.effectiveFrom)fail('STORAGE_TIME','The trigger precedes this rule version.')
  if(!Array.isArray(p.recipients)||p.recipients.length<1||p.recipients.length>50)fail('INPUT','Record every required recipient.',null,400)
  const recipients=p.recipients.map((value:any)=>{const r=object(value,'recipient');return ({id:crypto.randomUUID(),role:choice(r.role,['owner','lienholder','other'],'recipient role'),name:text(r.name,'recipient name',200),address:text(r.address,'notice address',1000)})})
  if(!recipients.some((r:any)=>r.role==='owner'))fail('STORAGE_RECIPIENT','Record the registered or property owner.')
  const row=put(c.s,'storageCase',{jobId:job.id,invoiceId:invoice.id,rule:structuredClone(rule),ruleId:rule.id,uncollectedAt,startsAt:new Date(Date.parse(uncollectedAt)+rule.startDelayHours*3600000).toISOString(),dailyCents:integer(p.dailyCents,'agreed daily USD cents',1,10000000),triggerEvidence:text(p.triggerEvidence,'storage trigger and agreed rate evidence',2000),recipientSearch:text(p.recipientSearch,'title and lienholder search evidence, including any no-lien result',2000),recipients,notices:[],accruals:[],payments:[],reviews:[{ruleId:rule.id,...evidence(p),by:who(c),at:c.now}],authorityOwner:c.actor.id,closed:null,by:who(c),at:c.now})
  event(c,command,job.id,row.id,{});return row
 }
 const r=find(c.s,'storageCase',p.caseId);if(r.jobId!==job.id)fail('STORAGE_REPAIR','This storage case belongs to another repair.');expectVersion(r,p.version)
 if(command==='storage.review'){
  if(r.closed)fail('STORAGE_CLOSED','Closed custody history cannot be reopened.')
  const rule=find(c.s,'storageRule',p.ruleId)
  // Restored rules and case history remain evidence only. Reaffirm the unchanged
  // rule values in a new owner-authored version before resuming custody.
  const same=['state','assetKind','startDelayHours','noticeWithinDays','waitDays','disposalAfterDays','storageCapCents','repairLien','noticeMethod','sources'].every(k=>JSON.stringify(rule[k])===JSON.stringify(r.rule[k]))
  if(p.confirm!==true||!same||rule.by.id!==c.actor.id||rule.effectiveFrom>c.now||rule.effectiveUntil<=c.now)fail('STORAGE_REVIEW','Confirm custody with a current owner-reviewed version of the same rules; changed legal requirements need separate review outside this workflow.')
  const next=bump(c.s,'storageCase',r,{rule:structuredClone(rule),ruleId:rule.id,authorityOwner:c.actor.id,reviews:[...r.reviews,{ruleId:rule.id,...evidence(p),by:who(c),at:c.now}]});event(c,command,job.id,r.id,{});return next
 }
 current(c,r)
 let changes:any
 if(command==='storage.notice'){
  const recipient=r.recipients.find((x:any)=>x.id===p.recipientId);if(!recipient)fail('STORAGE_RECIPIENT','Choose a required recipient on this case.')
  if(r.notices.some((x:any)=>x.recipientId===recipient.id))fail('STORAGE_NOTICE','Retain the original notice; duplicate evidence cannot reset its clock.')
  const sentAt=past(p.sentAt,'notice sent time',c.now),deliveredAt=past(p.deliveredAt,'delivery evidence time',c.now)
  if(sentAt<r.uncollectedAt||deliveredAt<sentAt)fail('STORAGE_TIME','Notice and delivery must follow the custody trigger in order.')
  if(p.method!==r.rule.noticeMethod)fail('STORAGE_METHOD','Use the notice method in this exact reviewed rule version.');
  changes={notices:[...r.notices,{ruleId:r.ruleId,recipientId:recipient.id,recipient:structuredClone(recipient),method:text(p.method,'statutory notice method',200),content:text(p.content,'exact notice content or immutable copy reference',4000),deliveryEvidence:text(p.deliveryEvidence,'delivery evidence reference',2000),sentAt,deliveredAt,by:who(c),at:c.now}]}
 }else if(command==='storage.accrue'){
  const throughAt=past(p.throughAt,'accrue through',c.now)
  if(throughAt<r.startsAt||r.accruals.some((a:any)=>a.asOf>=throughAt))fail('STORAGE_TIME','Accrue forward from the storage start; retain earlier statements.')
  changes={accruals:[...r.accruals,{...storageBalance(c.s,r,throughAt),ruleId:r.ruleId,by:who(c),at:c.now}]}
 }else if(command==='storage.payment'){
  const amountCents=integer(p.amountCents,'storage tender cents',1),balance=storageBalance(c.s,r,c.now),reference=text(p.reference,'unique storage tender reference',200)
  if(amountCents>balance.storageDueCents||rows(c.s,'storageCase').some(x=>x.payments.some((v:any)=>v.reference===reference)))fail('STORAGE_PAYMENT','Refuse overpayment or repeated storage tender reference.')
  changes={payments:[...r.payments,{amountCents,reference,evidence:text(p.evidence,'staff-recorded storage tender evidence',2000),label:'Storage tender recorded by staff; Mallet did not verify funds.',by:who(c),at:c.now}]}
 }else{
  const deadlines=storageDeadlines(r)
  if(!deadlines.allNotified||!deadlines.noticesOnTime||c.now<deadlines.earliestDisposalAt)fail('STORAGE_EARLY','Every required recipient needs delivery evidence and the full waiting period before disposal.')
  if(p.confirm!==true)fail('STORAGE_CONSENT','The owner must explicitly confirm all statutory steps are complete.')
  const review={ruleId:r.ruleId,...evidence(p),steps:text(p.completedSteps,'completed statutory steps and no unresolved objection or stay evidence',4000),by:who(c),at:c.now}
  changes={closed:{kind:'disposal',at:c.now,by:who(c),review,evidence:text(p.evidence,'physical disposal or lien sale record',2000),balance:storageBalance(c.s,r,c.now)}}
 }
 const next=bump(c.s,'storageCase',r,changes);event(c,command,job.id,r.id,changes);return next
}
export function storageRelease(c:Context,job:Row,p:any){
 const r=storageCase(c.s,job.id);if(!r)return null
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner releases property with a storage case.',null,403)
 current(c,r)
 const balance=storageBalance(c.s,r,c.now)
 if(balance.storageDueCents&&c.actor.role!=='owner')fail('FORBIDDEN','Only the owner may release with unpaid storage.',null,403)
 if(balance.lienCents&&(c.actor.role!=='owner'||p.lienWaiverCents!==balance.lienCents))fail('STORAGE_WAIVER','The owner must explicitly record the exact remaining lien waived on release.')
 const waivedCents=balance.lienCents,waiverReason=waivedCents?text(p.lienWaiverReason,'lien waiver reason',2000):''
 const closed={kind:'release',ruleId:r.ruleId,at:c.now,by:who(c),balance,waivedCents,waiverReason,label:'Release ends storage accrual. Recorded lien amounts are tracking calculations, not legal advice.'}
 bump(c.s,'storageCase',r,{closed});event(c,'storage.release',job.id,r.id,closed);return structuredClone(closed)
}
