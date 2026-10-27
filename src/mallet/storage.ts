import {invoiceBalance} from './payments'
import {assetType} from './asset-types'
import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type Context,type Row,type State} from './model'

// Source catalog only. Applicability, amounts and statutory steps require case-specific legal review.
export const storageSources={
 CA:{version:'2026-10-27',label:'California',sources:[{title:'Civil Code, repair and storage liens',url:'https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=3068.&lawCode=CIV'},{title:'DMV lien sale procedures',url:'https://www.dmv.ca.gov/portal/handbook/vehicle-industry-registration-procedures-manual-2/lien-sales-abandoned-abated-vehicles/'}]},
 TX:{version:'2026-10-27',label:'Texas',sources:[{title:'Property Code Chapter 70, miscellaneous liens',url:'https://statutes.capitol.texas.gov/Docs/PR/htm/PR.70.htm'}]}
} as const
const instant=(v:unknown,label:string)=>{const value=text(v,label,50);if(!/(Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))fail('INPUT',label+' needs an explicit timezone.',null,400);return new Date(value).toISOString()}
export const storageCommands=['storage.rule','storage.open','storage.notice','storage.review','storage.dispose'] as const
export const storageCase=(s:State,jobId:string)=>rows(s,'storageCase').find(r=>r.jobId===jobId)
export function storageBalance(r:Row,at:string,s?:State){
 if(r.release)return r.release.balance
 const end=r.disposal?.at??at
 const days=Math.max(0,Math.floor((Date.parse(end)-Date.parse(r.startsAt))/86400000))
 const storageCents=Math.min(r.rule.capCents,days*r.rule.dailyCents)
 const repairCents=s?Math.min(r.repairCents,invoiceBalance(s,find(s,'invoice',r.invoiceId)).outstandingCents):r.repairCents
 return {days,storageCents,repairCents,lienCents:repairCents+storageCents,label:'Reviewed ledger estimate only; not a legal determination or an invoice charge.'}
}
export const storage:Handler=(c,command,p)=>{
 if(!(storageCommands as readonly string[]).includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records storage and legal steps.',null,403)
 if(command==='storage.rule'){
  const state=choice(p.state,['CA','TX'],'state'),scope=choice(p.scope,['vehicle','device'],'property type')
  const row=put(c.s,'storageRule',{state,scope,catalog:structuredClone(storageSources[state]),dailyCents:integer(p.dailyCents,'daily cents',0,100000),capCents:integer(p.capCents,'storage cap cents',0,100000000),graceHours:integer(p.graceHours,'grace hours',0,87600),noticeDays:integer(p.noticeDays,'notice deadline days',0,3650),waitDays:integer(p.waitDays,'minimum days after delivery',1,3650),method:text(p.method,'reviewed notice method',500),basis:text(p.basis,'reviewed storage and lien basis',2000),review:text(p.review,'legal review reference and applicability',2000),by:who(c),at:c.now})
  event(c,command,null,row.id,{state,scope});return row
 }
 const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
 if(command==='storage.open'){
  if(storageCase(c.s,job.id)||rows(c.s,'flow').some(r=>r.jobId===job.id&&r.collection))fail('STORAGE_STATE','A repair has one storage case and cannot start storage after release.')
  if(!['completed','invoiced'].includes(job.status))fail('STORAGE_STATE','Complete the repair before recording uncollected property.')
  const rule=find(c.s,'storageRule',p.ruleId),scope=assetType(job.asset)
  if(rule.scope!==scope||(!['vehicle','device'].includes(scope)))fail('STORAGE_SCOPE','Use a reviewed rule for this property type.')
  const notifiedAt=instant(p.notifiedAt,'ready notification time');if(notifiedAt>c.now)fail('STORAGE_TIME','Ready notification cannot be in the future.')
  const invoice=find(c.s,'invoice',job.invoiceId),repairCents=integer(p.repairCents,'eligible unpaid repair cents',0,invoiceBalance(c.s,invoice).outstandingCents)
  const startsAt=new Date(Date.parse(notifiedAt)+rule.graceHours*3600000).toISOString(),noticeDueAt=new Date(Date.parse(startsAt)+rule.noticeDays*86400000).toISOString()
  const recipients=text(p.recipients,'all reviewed recipients, including owner and lienholders or documented no-lienholder search',4000)
  const row=put(c.s,'storageCase',{jobId:job.id,rule:structuredClone(rule),invoiceId:invoice.id,invoiceRevision:invoice.revision,repairCents,notifiedAt,notificationEvidence:text(p.evidence,'ready notification and storage consent evidence',2000),startsAt,noticeDueAt,recipients,notices:[],reviews:[],release:null,disposal:null,by:who(c),at:c.now})
  event(c,command,job.id,row.id,{});return row
 }
 const r=storageCase(c.s,job.id);if(!r)fail('NOT_FOUND','Open a reviewed storage case first.',null,404)
 expectVersion(r,p.caseVersion)
 if(r.release||r.disposal)fail('STORAGE_CLOSED','The case is closed; history is preserved.')
 if(command==='storage.notice'){
  const deliveredAt=instant(p.deliveredAt,'delivery time');if(deliveredAt>c.now||deliveredAt<r.startsAt)fail('STORAGE_TIME','Record an actual delivery at or after accrual starts.')
  const notice={deliveredAt,method:r.rule.method,recipients:r.recipients,evidence:text(p.evidence,'exact notice copy and delivery evidence for every recipient',4000),late:deliveredAt>r.noticeDueAt,eligibleAt:new Date(Date.parse(deliveredAt)+r.rule.waitDays*86400000).toISOString(),by:who(c),at:c.now}
  const next=bump(c.s,'storageCase',r,{notices:[...r.notices,notice]});event(c,command,job.id,r.id,notice);return next
 }
 if(command==='storage.review'){
  const review={evidence:text(p.evidence,'case-specific legal review of all statutory steps, recipients and disposal authority',4000),caseVersion:r.version,by:who(c),at:c.now}
  const next=bump(c.s,'storageCase',r,{reviews:[...r.reviews,review]});event(c,command,job.id,r.id,{caseVersion:r.version});return next
 }
 const notice=r.notices.at(-1),review=r.reviews.at(-1)
 if(!notice||notice.late||notice.eligibleAt>c.now||!review||review.caseVersion!==r.version-1)fail('DISPOSAL_EARLY','Disposal requires timely delivery, elapsed notice clocks and a current case-specific legal review.')
 // Until ct approves state and property applicability, no product door authorizes disposal.
 fail('LEGAL_POLICY_PENDING','Disposal remains disabled pending approved statutory applicability and complete step validation. Preserve property and history.')
}
export function releaseStorage(c:Context,job:Row,receipt:Row){
 const r=storageCase(c.s,job.id);if(!r)return null
 if(r.disposal)fail('STORAGE_CLOSED','Disposed property cannot be handed over.')
 const balance=storageBalance(r,c.now,c.s),release={at:c.now,by:who(c),handoverId:receipt.id,balance,lienWaivedCents:balance.lienCents,label:'Physical release ends storage accrual. The remaining possessory lien estimate is recorded as relinquished; legal effect and other rights require review. Storage ledger is not proof of payment.'}
 const next=bump(c.s,'storageCase',r,{release});event(c,'storage.release',job.id,r.id,release);return next.release
}
