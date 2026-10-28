import {createHash} from 'node:crypto'
import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {instant} from './workshop'

export const coverageCommands=['coverage.schedule','coverage.cancel','coverage.transfer','coverage.symptom','coverage.resolve','coverage.activate','coverage.sweep'] as const
const ownershipIdentity=(asset:Row)=>[asset.customerAccountId??null,asset.driverContactId??null,asset.customerName,asset.customerEmail]
const ownershipHash=(identity:unknown[])=>createHash('sha256').update(JSON.stringify(identity)).digest('hex')
export const coverageOwnership=(_s:State,asset:Row)=>ownershipHash(ownershipIdentity(asset))
function sameOwnership(s:State,asset:Row,fingerprint:string){
 if(coverageOwnership(s,asset)===fingerprint)return true
 // Earlier captures also hashed the account revision. Retained revisions let
 // those captures survive unrelated account edits without accepting a changed vehicle identity.
 const account=rows(s,'customerAccount').find(a=>a.id===asset.customerAccountId)
 return [account,...(account?.history??[])].some(a=>ownershipHash([...ownershipIdentity(asset),a?.version??null])===fingerprint)
}
const sameAgreement=(a:Row,b:Row)=>a.kind==='service-contract'&&b.kind==='service-contract'&&a.assetId===b.assetId&&a.source.documentReference===b.source.documentReference
export function coverageStop(s:State,r:Row){
 const asset=rows(s,'asset').find(a=>a.id===r.assetId)
 if(!asset||asset.privacyErasedAt)return 'erased'
 if(!sameOwnership(s,asset,r.ownership))return 'transferred'
 if(rows(s,'coverageReview').some(other=>other.status==='canceled'&&sameAgreement(r,other)))return 'canceled'
 return null
}
function transition(c:Context,r:Row,status:string,reason:string){
 const entry={action:status,reason,by:who(c),at:c.now}
 const next=bump(c.s,'coverageReview',r,{status,history:[...r.history,entry]})
 const task=rows(c.s,'coverageTask').find(t=>t.coverageId===r.id)
 if(task&&task.status==='open')bump(c.s,'coverageTask',task,{status:'suppressed',resolution:entry})
 event(c,'coverage.'+status,r.jobId,r.id,{status,taskId:task?.id??null})
 return next
}
export const coverageFollowUp:Handler=(c,command,p)=>{
 if(!(coverageCommands as readonly string[]).includes(command))return
 if(command==='coverage.sweep'){
  const local=new Set(Array.isArray(p.localIds)?p.localIds:[]),changed=[]
  for(const r of [...rows(c.s,'coverageReview')].filter(r=>['scheduled','due'].includes(r.status))){
   const stop=coverageStop(c.s,r)
   if(stop){changed.push(transition(c,r,stop,'Current coverage, vehicle ownership or erasure record suppresses review.'));continue}
   if(r.status!=='scheduled'||r.dueAt>c.now||!local.has(r.id))continue
   const task=put(c.s,'coverageTask',{coverageId:r.id,jobId:r.jobId,assetId:r.assetId,title:r.kind==='warranty'?'Review retained warranty coverage':'Review evidenced service-contract renewal',dueAt:r.dueAt,status:'open',scheduledBy:r.by,createdBy:who(c),createdAt:c.now,resolution:null})
   const next=bump(c.s,'coverageReview',r,{status:'due',taskId:task.id,history:[...r.history,{action:'due',taskId:task.id,by:who(c),at:c.now}]})
   event(c,command,r.jobId,r.id,{taskId:task.id});changed.push(next)
  }
  return changed
 }
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner manages private coverage reviews.',null,403)
 if(command==='coverage.schedule'){
  const job=find(c.s,'job',p.jobId),asset=find(c.s,'asset',job.assetId)
  if(asset.privacyErasedAt)fail('COVERAGE_ERASED','An erased customer cannot receive a new coverage review.')
  const kind=choice(p.kind,['warranty','service-contract'],'coverage source'),reference=text(p.reference,'unique review reference',200)
  let source:any
  if(kind==='warranty'){
   const terms=find(c.s,'warrantyTerms',p.termsId)
   if(terms.jobId!==job.id)fail('COVERAGE_SOURCE','Use warranty terms retained on this original repair.')
   source={id:terms.id,revision:terms.version,startsAt:terms.startsAt,endsAt:terms.endsAt,terms:terms.terms,mileageLimit:terms.mileageLimit,unit:terms.unit,provenance:'shop-asserted',independentlyVerified:false}
  }else{
   const startsAt=instant(p.startsAt,'contract starts'),endsAt=instant(p.endsAt,'contract ends')
   if(endsAt<startsAt)fail('INPUT','The contract ends no earlier than it starts.',null,400)
   source={startsAt,endsAt,terms:text(p.terms,'service-contract terms',4000),documentReference:text(p.documentReference,'retained contract document reference',200),evidence:text(p.evidence,'source and coverage-date evidence',2000),provenance:'owner-recorded document',independentlyVerified:false}
  }
  const dueAt=instant(p.dueAt,'review due'),consentEvidence=text(p.consentEvidence,'recorded customer review permission and source',2000)
  if(dueAt<source.startsAt||dueAt>source.endsAt)fail('COVERAGE_DATE','Choose a review instant within the retained coverage dates.')
  const basis={jobId:job.id,assetId:asset.id,kind,reference,source,dueAt,consentEvidence}
  const old=rows(c.s,'coverageReview').find(r=>r.reference===reference)
  if(old){
   if(JSON.stringify(old.basis)!==JSON.stringify(basis))fail('COVERAGE_REPLAY','This review reference already identifies different coverage or permission.')
   return old
  }
  if((asset.coverageTransfers??[]).some((t:any)=>sameOwnership(c.s,asset,t.ownership))||rows(c.s,'coverageReview').some(r=>r.assetId===asset.id&&r.status==='transferred'&&sameOwnership(c.s,asset,r.ownership)))fail('COVERAGE_TRANSFERRED','Record the new vehicle ownership before scheduling another review.')
  if(kind==='service-contract'&&rows(c.s,'coverageReview').some(r=>r.assetId===asset.id&&r.status==='canceled'&&r.source.documentReference===source.documentReference))fail('COVERAGE_CANCELED','This retained agreement was canceled; a different review reference cannot revive it.')
  expectVersion(job,p.version)
  const row=put(c.s,'coverageReview',{...basis,basis,ownership:coverageOwnership(c.s,asset),assetRevision:asset.version,status:'scheduled',taskId:null,symptoms:[],history:[{action:'scheduled',by:who(c),at:c.now}],by:who(c),at:c.now})
  event(c,command,job.id,row.id,{kind,sourceId:source.id??null,dueAt});return row
 }
 if(command==='coverage.transfer'){
  const asset=find(c.s,'asset',p.assetId);expectVersion(asset,p.version)
  const reason=text(p.reason,'recorded ownership-change evidence',2000)
  bump(c.s,'asset',asset,{coverageTransfers:[...(asset.coverageTransfers??[]),{ownership:coverageOwnership(c.s,asset),reason,by:who(c),at:c.now}]})
  const affected=rows(c.s,'coverageReview').filter(r=>r.assetId===asset.id&&['scheduled','due'].includes(r.status)).map(r=>transition(c,r,'transferred',reason))
  event(c,command,null,asset.id,{assetId:asset.id,reviewIds:affected.map(r=>r.id)})
  return affected
 }
 const r=find(c.s,'coverageReview',p.id);expectVersion(r,p.version)
 if(command==='coverage.cancel'){
  if(!['scheduled','due'].includes(r.status))fail('COVERAGE_STATE','This review has already stopped.')
  const reason=text(p.reason,'cancellation evidence',2000)
  const affected=rows(c.s,'coverageReview').filter(other=>(other.id===r.id||sameAgreement(r,other))&&['scheduled','due'].includes(other.status)).map(other=>transition(c,other,'canceled',reason))
  return affected.find(other=>other.id===r.id)
 }
 const stop=coverageStop(c.s,r)
 if(stop||!['scheduled','due'].includes(r.status))fail('COVERAGE_STOPPED','This review is stopped or its ownership or erasure record changed.')
 if(command==='coverage.activate'){
  const entry={action:'activated',reason:text(p.reason,'fresh owner review evidence',2000),by:who(c),at:c.now}
  const next=bump(c.s,'coverageReview',r,{history:[...r.history,entry]});event(c,command,r.jobId,r.id,{});return next
 }
 if(command==='coverage.symptom'){
  const reference=text(p.reference,'unique symptom reference',200),symptom={reference,text:text(p.symptom,'customer-reported repeat symptom',4000),evidence:text(p.evidence,'report source evidence',2000),reportedAt:instant(p.reportedAt,'reported time'),by:who(c),at:c.now}
  if(symptom.reportedAt>c.now)fail('INPUT','A reported symptom cannot be in the future.',null,400)
  const old=r.symptoms.find((s:any)=>s.reference===reference)
  if(old){if(['text','evidence','reportedAt'].some(k=>old[k]!==symptom[k as keyof typeof symptom]))fail('COVERAGE_REPLAY','The symptom reference already identifies another report.');return r}
  const next=bump(c.s,'coverageReview',r,{symptoms:[...r.symptoms,symptom]});event(c,command,r.jobId,r.id,{reference,originalJobId:r.jobId});return next
 }
 if(command==='coverage.resolve'){
  const task=find(c.s,'coverageTask',r.taskId)
  if(r.status!=='due'||task.status!=='open')fail('COVERAGE_STATE','Only an open due review task can be resolved.')
  const resolution={action:'resolved',reason:text(p.reason,'review result and next step',2000),by:who(c),at:c.now}
  bump(c.s,'coverageTask',task,{status:'completed',resolution})
  const next=bump(c.s,'coverageReview',r,{status:'completed',history:[...r.history,resolution]});event(c,command,r.jobId,r.id,{taskId:task.id});return next
 }
}
