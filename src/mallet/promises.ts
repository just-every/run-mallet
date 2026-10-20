import {onCrew} from './collaboration'
import {promiseZoneSettings,shopTimeZone} from './promise-zone'
import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Actor,type Context,type Handler,type Row,type State} from './model'
import {instant,openJob} from './workshop'
import {authorizedCap,jobEstimates} from './supplement-scope'

export const promiseCommands=['promise.timeZone','promise.set','promise.partETA','promise.dependency','promise.propose','promise.approve','promise.noticeOutcome'] as const
export const promiseMemberCommands=['promise.partETA','promise.dependency'] as const
export const internalPromiseCommands=['promise.approve','promise.noticeOutcome']
const manager=(c:Context)=>{if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or service advisor must approve customer promises.',null,403)}
const assigned=(c:Context,job:Row)=>{if(!['owner','admin'].includes(c.actor.role)&&!(c.actor.role==='member'&&onCrew(job,c.actor.id)))fail('FORBIDDEN','Use your currently assigned repair.',null,403)}
export const currentPromise=(s:State,jobId:string)=>rows(s,'promise').find(r=>r.jobId===jobId)
export const currentPromisePlan=(s:State,jobId:string)=>rows(s,'promisePlan').find(r=>r.jobId===jobId)
const current=(r:Row)=>r.revisions.at(-1)
const scopeVersions=(s:State,job:Row)=>jobEstimates(s,job).map(q=>({id:q.id,version:q.version}))
function planFence(s:State,jobId:string,version:unknown){const plan=currentPromisePlan(s,jobId);if(integer(version,'planVersion',0)!==(plan?.version??0))fail('VERSION','Parts or dependencies changed. Refresh the plan before continuing.');return plan}
export function savePlan(c:Context,job:Row,plan:Row|undefined,parts:any[],dependencies:any[],reason:string){
 const revision={n:(plan?.revisions.length??0)+1,parts,dependencies,reason,at:c.now,by:who(c)}
 return plan?bump(c.s,'promisePlan',plan,{revisions:[...plan.revisions,revision]}):put(c.s,'promisePlan',{jobId:job.id,revisions:[revision]})
}
function dependencyCycle(s:State,source:string,target:string):boolean {
 const seen=new Set<string>(),visit=(id:string):boolean=>{if(id===source)return true;if(seen.has(id))return false;seen.add(id);return (currentPromisePlan(s,id)?.revisions.at(-1)?.dependencies??[]).some((d:any)=>visit(d.jobId))}
 return visit(target)
}
function dependencyVersions(s:State,jobId:string,seen=new Set<string>()):any[]{
 if(seen.has(jobId))return [];seen.add(jobId)
 return (currentPromisePlan(s,jobId)?.revisions.at(-1)?.dependencies??[]).flatMap((d:any)=>{const job=find(s,'job',d.jobId);return [{id:job.id,version:job.version,scopeVersions:scopeVersions(s,job),planVersion:currentPromisePlan(s,job.id)?.version??0},...dependencyVersions(s,job.id,seen)]})
}
/** Actuals and sold labor are exact authorized quantities, including separately decided supplements. Timers do not consume sold work. */
export function promiseLabor(s:State,job:Row){
 let soldMilli=0,performedMilli=0
 for(const q of jobEstimates(s,job)){
  const r=current(q);if(!r.approval||q.authorisation?.revision!==r.n)continue
  for(const line of r.lines)if(line.kind==='labor'&&q.authorisation.lineIds.includes(line.id)){
   soldMilli+=authorizedCap(s,q,line)
   performedMilli+=(job.actuals??[]).filter((a:any)=>a.estimateId===q.id&&a.revision===r.n&&a.lineId===line.id).reduce((n:number,a:any)=>n+a.quantityMilli,0)
  }
 }
 return {soldHours:soldMilli/1000,performedHours:performedMilli/1000,remainingHours:Math.max(0,soldMilli-performedMilli)/1000}
}
/** A transparent planning warning, never a supplier confirmation or automatic dispatch/clearance. */
export function promiseProjection(s:State,job:Row,now=new Date().toISOString(),seen=new Set<string>()):any {
 const labor=promiseLabor(s,job),promise=currentPromise(s,job.id),plan=currentPromisePlan(s,job.id),r=plan&&current(plan),parts=r?.parts??[],dependencies=r?.dependencies??[]
 const reasons:string[]=[],starts=[Date.parse(now),Date.parse(job.startAt)]
 if(seen.has(job.id))return {...labor,status:'at-risk',reasons:['Resource dependency needs review'],earliestFinishAt:job.endAt,parts,dependencies}
 const visited=new Set([...seen,job.id])
 for(const part of parts)if(!part.receivedAt){starts.push(Date.parse(part.eta));reasons.push(part.eta>now?`Waiting for ${part.name}: staff-reported ETA ${part.eta}`:`Arrival unconfirmed after staff-reported ETA: ${part.name}`)}
 for(const dependency of dependencies){
  const other=rows(s,'job').find(j=>j.id===dependency.jobId)
  if(!other){reasons.push('A resource dependency is unavailable; advisor review required');continue}
  if(!['completed','invoiced'].includes(other.status)){
   const projected=promiseProjection(s,other,now,visited)
   starts.push(Date.parse(other.endAt),Date.parse(projected.earliestFinishAt));reasons.push(`Depends on ${other.title} (${dependency.resource}): ${dependency.reason}`)
  }
 }
 const earliestFinishAt=new Date(Math.max(...starts)+labor.remainingHours*3_600_000).toISOString(),pickupAt=promise&&current(promise).pickupAt,closed=['completed','invoiced'].includes(job.status)
 if(!closed&&earliestFinishAt>job.endAt)reasons.push('Remaining work extends beyond the booked bay/technician slot; review capacity')
 const unknownDependency=dependencies.some((d:any)=>!rows(s,'job').some(j=>j.id===d.jobId))||parts.some((p:any)=>!p.receivedAt&&p.eta<=now)
 const status=closed?'closed':!pickupAt?'no-promise':now>=pickupAt?'overdue':earliestFinishAt>pickupAt||unknownDependency?'at-risk':'on-plan'
 return {...labor,status,reasons,earliestFinishAt,pickupAt,parts,dependencies}
}
export const promises:Handler=(c,command,p)=>{
 if(!(promiseCommands as readonly string[]).includes(command))return
 if(command==='promise.timeZone'){
  manager(c);const timeZone=text(p.timeZone,'shop time zone',100),reason=text(p.reason,'time zone change reason',2000),existing=promiseZoneSettings(c.s)
  if(integer(p.settingsVersion,'settingsVersion',0)!==(existing?.version??0))fail('VERSION','The shop time zone changed. Refresh before saving.')
  try{new Intl.DateTimeFormat('en-US',{timeZone}).format()}catch{fail('INPUT','Enter a valid IANA time zone, for example America/New_York.',null,400)}
  const revision={timeZone,reason,by:who(c),at:c.now},saved=existing?bump(c.s,'promiseSettings',existing,{timeZone,revisions:[...existing.revisions,revision]}):put(c.s,'promiseSettings',{timeZone,revisions:[revision]})
  event(c,command,null,saved.id,{timeZone,reason});return saved
 }
 if(command==='promise.noticeOutcome'){
  manager(c);const notice=find(c.s,'promiseNotice',p.noticeId);expectVersion(notice,p.version)
  if(notice.outcome)fail('NOTICE_RECORDED','This one claimed send already has its provider outcome.')
  const outcome={status:choice(p.status,['accepted','rejected','rate_limited','uncertain','development'] as const,'mail outcome'),provider:text(p.provider,'mail provider',100),providerMessageId:p.providerMessageId?text(p.providerMessageId,'provider message id',300):null,at:c.now}
  const saved=bump(c.s,'promiseNotice',notice,{outcome});event(c,command,notice.jobId,notice.id,outcome);return saved
 }
 if(command==='promise.approve'){
  manager(c);const proposal=find(c.s,'promiseRevision',p.proposalId);expectVersion(proposal,p.proposalVersion)
  if(proposal.status!=='proposed')fail('PROMISE_DECIDED','This revision already claimed its one customer notice. Inspect its retained outcome.')
  if(proposal.pickupAt<=c.now)fail('PROMISE_STALE','This proposed pickup time has already passed. Prepare a current promise.')
  const job=openJob(c,{jobId:proposal.jobId,version:proposal.jobVersion}),promise=find(c.s,'promise',proposal.promiseId),asset=find(c.s,'asset',job.assetId)
  if((promiseZoneSettings(c.s)?.version??0)!==proposal.zoneVersion)fail('VERSION','The shop time zone changed. Review a new promise revision before emailing.');
  if(JSON.stringify(scopeVersions(c.s,job))!==JSON.stringify(proposal.scopeVersions))fail('VERSION','Customer-authorized scope changed. Review the remaining labor before emailing.');
  expectVersion(promise,proposal.promiseVersion);expectVersion(asset,proposal.assetVersion);planFence(c.s,job.id,proposal.planVersion)
  // Resource jobs are independently versioned: dispatch, actuals, or completion must force another review.
  for(const ref of proposal.dependencyVersions){const dependency=find(c.s,'job',ref.id);expectVersion(dependency,ref.version);planFence(c.s,ref.id,ref.planVersion);if(JSON.stringify(scopeVersions(c.s,dependency))!==JSON.stringify(ref.scopeVersions))fail('VERSION','Dependent repair scope changed. Review capacity before emailing.')}
  if(asset.customerEmail!==proposal.to)fail('VERSION','The customer email changed. Prepare another revision.')
  const revision={n:promise.revisions.length+1,pickupAt:proposal.pickupAt,reason:proposal.reason,timeZone:proposal.timeZone,approvedBy:who(c),at:c.now,proposalId:proposal.id,plan:proposal.plan}
  const next=bump(c.s,'promise',promise,{revisions:[...promise.revisions,revision]})
  const notice=put(c.s,'promiseNotice',{jobId:job.id,promiseId:promise.id,revision:revision.n,proposalId:proposal.id,timeZone:proposal.timeZone,to:proposal.to,oldPickupAt:current(promise).pickupAt,newPickupAt:revision.pickupAt,reason:revision.reason,approvedBy:who(c),claimedAt:c.now,outcome:null})
  bump(c.s,'promiseRevision',proposal,{status:'approved',approvedBy:who(c),approvedAt:c.now,noticeId:notice.id,appliedPromiseVersion:next.version})
  event(c,command,job.id,promise.id,{revision:revision.n,oldPickupAt:notice.oldPickupAt,newPickupAt:notice.newPickupAt,noticeId:notice.id,reason:revision.reason});return notice
 }
 const job=openJob(c,p);assigned(c,job)
 if(command==='promise.partETA'||command==='promise.dependency'){
  const plan=planFence(c.s,job.id,p.planVersion),prior=plan&&current(plan),parts=structuredClone(prior?.parts??[]),dependencies=structuredClone(prior?.dependencies??[]),reason=text(p.reason,'plan change reason',2000)
  if(command==='promise.partETA'){
   const partId=text(p.partId,'part reference',100)
   if(partId.startsWith('special:'))fail('SPECIAL_PART_RECEIVING','Use the special-order receipt or supplier update form for this part.')
   const name=text(p.name,'required part name',200),eta=instant(p.eta,'staff-reported part ETA'),sourceNote=text(p.sourceNote,'ETA source note',2000),receivedAt=p.receivedAt?instant(p.receivedAt,'physical receipt time'):null
   if(receivedAt&&receivedAt>c.now)fail('INPUT','Physical receipt cannot be recorded in the future.',null,400)
   const part={partId,name,eta,sourceNote,receivedAt,reportedBy:who(c),at:c.now,source:'staff-reported; not supplier-confirmed'},index=parts.findIndex((r:any)=>r.partId===partId)
   if(index<0)parts.push(part);else parts[index]=part
  }else{
   const dependency=find(c.s,'job',p.dependencyJobId);assigned(c,dependency)
   if(job.id===dependency.id||dependencyCycle(c.s,job.id,dependency.id))fail('DEPENDENCY_CYCLE','A repair cannot depend on itself or create a dependency cycle.')
   const resource=choice(p.resource,['bay','technician','both'] as const,'dependent resource'),remove=p.remove===true,index=dependencies.findIndex((d:any)=>d.jobId===dependency.id)
   const item={jobId:dependency.id,resource,reason,by:who(c),at:c.now}
   if(remove){if(index<0)fail('NOT_FOUND','This resource dependency does not exist.',null,404);dependencies.splice(index,1)}else if(index<0)dependencies.push(item);else dependencies[index]=item
  }
  const saved=savePlan(c,job,plan,parts,dependencies,reason);event(c,command,job.id,saved.id,{revision:current(saved).n,reason});return saved
 }
 manager(c)
 const pickupAt=instant(p.pickupAt,'customer pickup promise'),reason=text(p.reason,'promise reason',2000),promise=currentPromise(c.s,job.id)
 if(pickupAt<=c.now)fail('INPUT','Approve a pickup promise in the future.',null,400)
 if(command==='promise.set'){
  if(promise)fail('PROMISE_EXISTS','The original promise is retained. Propose and communicate a revised promise instead.')
  const saved=put(c.s,'promise',{jobId:job.id,revisions:[{n:1,pickupAt,reason,timeZone:shopTimeZone(c.s),approvedBy:who(c),at:c.now}]});event(c,command,job.id,saved.id,{pickupAt,reason});return saved
 }
 if(!promise)fail('PROMISE_REQUIRED','Set the original customer promise first.')
 expectVersion(promise,p.promiseVersion);const plan=planFence(c.s,job.id,p.planVersion),asset=find(c.s,'asset',job.assetId),to=text(asset.customerEmail,'customer email',254)
 if(pickupAt===current(promise).pickupAt)fail('PROMISE_UNCHANGED','A revised promise must change the pickup time.')
 const saved=put(c.s,'promiseRevision',{jobId:job.id,jobVersion:job.version,scopeVersions:scopeVersions(c.s,job),timeZone:shopTimeZone(c.s),zoneVersion:promiseZoneSettings(c.s)?.version??0,promiseId:promise.id,promiseVersion:promise.version,planVersion:plan?.version??0,assetVersion:asset.version,to,pickupAt,oldPickupAt:current(promise).pickupAt,reason,plan:structuredClone(plan?current(plan):null),dependencyVersions:dependencyVersions(c.s,job.id),preparedBy:who(c),preparedAt:c.now,status:'proposed'})
 event(c,command,job.id,saved.id,{oldPickupAt:saved.oldPickupAt,pickupAt,reason});return saved
}
/** Apply before the HTTP state's existing per-role projection. Credentials never appear in these records. */
export function scopedPromises(s:State,actor:Actor):State {
 if(['owner','admin'].includes(actor.role))return s
 const records={...s.records},ids=new Set(rows(s,'job').filter(j=>actor.role==='member'&&onCrew(j,actor.id)).map(j=>j.id))
 for(const kind of ['promise','promisePlan','promiseRevision','promiseNotice']){
  if(actor.role==='agent'){delete records[kind];continue}
  records[kind]=rows(s,kind).filter(r=>ids.has(r.jobId)).map(r=>{
   const copy=structuredClone(r),redact=(rev:any)=>{if(rev?.dependencies)rev.dependencies=rev.dependencies.map((d:any)=>ids.has(d.jobId)?d:{jobId:'restricted',resource:d.resource,reason:'Advisor-managed dependency'})}
   if(copy.revisions)for(const rev of copy.revisions){redact(rev);redact(rev.plan)}
   redact(copy.plan);if(copy.dependencyVersions)copy.dependencyVersions=copy.dependencyVersions.filter((d:any)=>ids.has(d.id))
   // Customer mail and approval proposals are advisor-only; technicians see the approved pickup and operational dependencies.
   return copy
  })
 }
 if(actor.role==='member'){delete records.promiseRevision;delete records.promiseNotice;records.promiseSettings=rows(s,'promiseSettings').map(r=>({id:r.id,version:r.version,timeZone:r.timeZone}))}else delete records.promiseSettings
 records.event=rows(s,'event').filter(e=>!e.kind.startsWith('promise.')||actor.role==='member'&&ids.has(e.jobId)&&!['promise.propose','promise.approve','promise.noticeOutcome'].includes(e.kind))
 return {...s,records}
}
