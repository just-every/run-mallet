import {bump,choice,event,expectVersion,fail,find,integer,object,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'

export type QualityStage = 'pre' | 'post' | 'road-test'
export type CheckItem = {id:string; label:string; stage:QualityStage; critical:boolean; required:boolean; measurement?:{label:string;unit:string}}
export type ConfigureQualityInput = {jobId:string;version:number;qualityVersion:number;reason:string;items:Omit<CheckItem,'id'>[]}
export type RecordQualityInput = {jobId:string;version:number;qualityVersion:number;itemId:string;outcome:'pass'|'fail'|'not-inspected';note:string;measurementValue?:number;measurementUnit?:string}
export type CorrectQualityInput = {jobId:string;version:number;qualityVersion:number;failedResultId:string;workId:string;reason:string}
export type SignQualityInput = {jobId:string;version:number;qualityVersion:number;qualification:string;note:string;safetyDecision?:'safe'|'unsafe'}
export type OverrideQualityInput = SignQualityInput & {itemIds:string[];reason:string}
export const qualityCommands = ['quality.takeover','quality.configure','quality.record','quality.correct','quality.signTechnician','quality.signQuality','quality.override'] as const
export const qualityRecord = (s:State,jobId:string) => rows(s,'quality').find(q=>q.jobId===jobId)
export const currentChecklist = (q:Row) => q.revisions.at(-1)

// Keep the complete comparison material rather than a lossy checksum. Signatures bind
// to exactly these immutable checks and work records, including the current assignee.
export function qualityFingerprint(job:Row,q:Row):string {
 return JSON.stringify([job.id,job.technicianId,job.actuals??[],currentChecklist(q),q.results,q.corrections])
}
export function qualityStatus(s:State,job:Row) {
 const q=qualityRecord(s,job.id)
 if(!q)return {record:null,revision:null,fingerprint:'',items:[] as any[],blockers:[{itemId:null as string|null,reason:'Define this job’s pre- and post-work checklist.'}],technicianSignoff:null as any,qualitySignoff:null as any,overrides:[] as any[],ready:false}
 const revision=currentChecklist(q),fingerprint=qualityFingerprint(job,q)
 const items=revision.items.map((item:CheckItem)=>({item,result:[...q.results].reverse().find((r:any)=>r.revision===revision.n&&r.itemId===item.id)}))
 const gates=items.filter(({item,result}:any)=>(item.required||item.critical)&&result?.outcome!=='pass')
 const overrides=q.overrides.filter((o:any)=>o.fingerprint===fingerprint&&o.by.id!==job.technicianId)
 const waived=new Set(overrides.flatMap((o:any)=>o.itemIds))
 const blockers:{itemId:string|null;reason:string}[]=gates.filter(({item}:any)=>!waived.has(item.id)).map(({item,result}:any)=>({itemId:item.id,reason:`${item.label}: ${result?.outcome??'not inspected'}.`}))
 const technicianSignoff=[...q.signoffs].reverse().find((x:any)=>x.kind==='technician'&&x.fingerprint===fingerprint&&x.by.id===job.technicianId)??null
 const overrideIds=overrides.map((o:any)=>o.id).sort()
 const qualitySignoff=[...q.signoffs].reverse().find((x:any)=>x.kind==='quality'&&x.fingerprint===fingerprint&&x.technicianSignoffId===technicianSignoff?.id&&x.by.id!==technicianSignoff?.by.id&&JSON.stringify(x.overrideIds)===JSON.stringify(overrideIds))??null
 if(!technicianSignoff)blockers.push({itemId:null,reason:'The assigned technician must sign the current checks and work.'})
 if(!qualitySignoff||qualitySignoff.safetyDecision!=='safe')blockers.push({itemId:null,reason:qualitySignoff?.safetyDecision==='unsafe'?'The independent quality decision says this repair is unsafe to release.':'An independent owner or service advisor must sign the current safety decision.'})
 return {record:q,revision,fingerprint,items,blockers,technicianSignoff,qualitySignoff,overrides,ready:blockers.length===0}
}
export function assertQualityReady(s:State,job:Row) {
 const status=qualityStatus(s,job)
 if(!status.ready)fail('QUALITY_BLOCKED','Quality clearance is incomplete or has changed. Resolve the checks and obtain both current signatures before marking this repair ready.',{jobId:job.id,blockers:status.blockers})
 return status
}
function manager(c:Context) {
 if(c.actor.role!=='owner'&&c.actor.role!=='admin')fail('FORBIDDEN','An owner or service advisor must make this quality decision.',null,403)
}
function technician(c:Context,job:Row) {
 if(c.actor.role==='agent'||c.actor.id!==job.technicianId)fail('FORBIDDEN','Only this job’s currently assigned technician may record or sign its checks.',null,403)
}
function checks(value:unknown):CheckItem[] {
 if(!Array.isArray(value)||value.length<2||value.length>40)fail('INPUT','Define 2–40 checklist items.',null,400)
 const items:CheckItem[]=value.map(raw=>{
  const item=object(raw,'checklist item'),stage=choice(item.stage,['pre','post','road-test'],'check stage')
  if(typeof item.critical!=='boolean'||typeof item.required!=='boolean')fail('INPUT','Every checklist item must specify whether it is critical and required.',null,400)
  const measurement=item.measurement==null?undefined:object(item.measurement,'measurement')
  if(stage==='road-test'&&!measurement)fail('INPUT','Road-test items must name the measurement and units to record.',null,400)
  return {id:crypto.randomUUID(),label:text(item.label,'check label',200),stage,critical:item.critical,required:item.required,...(measurement?{measurement:{label:text(measurement.label,'measurement label',100),unit:text(measurement.unit,'measurement unit',40)}}:{})}
 })
 if(!items.some(i=>i.stage==='pre')||!items.some(i=>i.stage==='post'))fail('INPUT','Include both pre-work and post-work checklist items.',null,400)
 return items
}
function context(c:Context,p:any) {
 const job=find(c.s,'job',p.jobId);expectVersion(job,p.version)
 if(!['booked','working'].includes(job.status))fail('JOB_STATE','Quality records can only be added to an open repair.')
 const q=qualityRecord(c.s,job.id)
 if(q)expectVersion(q,p.qualityVersion)
 else if(integer(p.qualityVersion,'qualityVersion',0,Number.MAX_SAFE_INTEGER)!==0)fail('VERSION','This quality checklist changed. Refresh before continuing.')
 return {job,q}
}
function save(c:Context,command:string,job:Row,q:Row,changes:Record<string,any>,evidence:any) {
 const row=bump(c.s,'quality',q,changes)
 event(c,command,job.id,row.id,evidence)
 return row
}
export const quality:Handler=(c,command,p)=>{
 if(!(qualityCommands as readonly string[]).includes(command))return
 if(c.actor.role==='agent')fail('FORBIDDEN','Quality checks and safety decisions require people.',null,403)
 const {job,q}=context(c,p)
 if(command==='quality.takeover') {
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner may take over a repair after recovery.',null,403)
  const reason=text(p.reason,'takeover reason',2000),before=job.technicianId
  const row=bump(c.s,'job',job,{technicianId:c.actor.id})
  event(c,command,job.id,job.id,{beforeTechnicianId:before,afterTechnicianId:c.actor.id,reason})
  return row
 }
 if(command==='quality.configure') {
  manager(c)
  const items=checks(p.items),reason=text(p.reason,'checklist revision reason',2000)
  const revision={n:(q?currentChecklist(q).n:0)+1,items,reason,at:c.now,by:who(c)}
  if(!q){const row=put(c.s,'quality',{jobId:job.id,revisions:[revision],results:[],corrections:[],signoffs:[],overrides:[]});event(c,command,job.id,row.id,revision);return row}
  return save(c,command,job,q,{revisions:[...q.revisions,revision]},revision)
 }
 if(!q)fail('QUALITY_REQUIRED','Define this job’s checklist first.')
 const revision=currentChecklist(q),fingerprint=qualityFingerprint(job,q)
 const evidence={id:crypto.randomUUID(),at:c.now,by:who(c),revision:revision.n}
 if(command==='quality.record') {
  technician(c,job)
  const item:CheckItem|undefined=revision.items.find((i:CheckItem)=>i.id===p.itemId)
  if(!item)fail('INPUT','Choose an item on the current checklist revision.',null,400)
  const outcome=choice(p.outcome,['pass','fail','not-inspected'],'check result'),note=text(p.note,'check evidence',2000)
  const failed=[...q.results].reverse().find((r:any)=>r.revision===revision.n&&r.itemId===item.id&&r.outcome==='fail')
  if(outcome==='pass'&&failed&&!q.corrections.some((x:any)=>x.failedResultId===failed.id))fail('QUALITY_CORRECTION','Record corrective work and its reason against the failed check before recording a passing retest.')
  const supplied=p.measurementValue!==undefined&&p.measurementValue!==null&&p.measurementValue!==''
  if(item.measurement&&outcome==='pass'&&!supplied)fail('INPUT','A passing measurement check needs the observed value and units.',null,400)
  let measurement:null|{value:number;unit:string}=null
  if(supplied){if(!item.measurement||typeof p.measurementValue!=='number'||!Number.isFinite(p.measurementValue)||Math.abs(p.measurementValue)>1e12)fail('INPUT','Use a finite observed measurement for a measurement check.',null,400);const unit=text(p.measurementUnit,'measurement unit',40);if(unit!==item.measurement.unit)fail('INPUT','Use the checklist’s measurement units.',null,400);measurement={value:p.measurementValue,unit}}
  const result={...evidence,itemId:item.id,item:structuredClone(item),outcome,note,measurement,workIds:(job.actuals??[]).map((a:any)=>a.id)}
  return save(c,command,job,q,{results:[...q.results,result]},result)
 }
 if(command==='quality.correct') {
  technician(c,job)
  const failed=q.results.find((r:any)=>r.id===p.failedResultId&&r.outcome==='fail')
  if(!failed)fail('INPUT','Reference a failed inspection result from this repair.',null,400)
  const work=(job.actuals??[]).find((a:any)=>a.id===p.workId)
  if(!work||failed.workIds.includes(work.id))fail('INPUT','Reference actual corrective work recorded after the failed inspection.',null,400)
  const correction={...evidence,failedResultId:failed.id,workId:work.id,work:structuredClone(work),reason:text(p.reason,'corrective work evidence',2000)}
  return save(c,command,job,q,{corrections:[...q.corrections,correction]},correction)
 }
 if(command==='quality.signTechnician') {
  technician(c,job)
  const signoff={...evidence,kind:'technician',fingerprint,qualification:text(p.qualification,'technician qualification',500),note:text(p.note,'technician sign-off evidence',2000)}
  return save(c,command,job,q,{signoffs:[...q.signoffs,signoff]},signoff)
 }
 manager(c)
 if(c.actor.id===job.technicianId)fail('INDEPENDENT_QUALITY','A different owner or service advisor must make the independent quality decision.',null,403)
 if(command==='quality.override') {
  const status=qualityStatus(c.s,job),gates=status.items.filter(({item,result}:any)=>(item.required||item.critical)&&result?.outcome!=='pass').map(({item}:any)=>item.id)
  if(!Array.isArray(p.itemIds)||!p.itemIds.length||new Set(p.itemIds).size!==p.itemIds.length||p.itemIds.some((id:any)=>!gates.includes(id)))fail('INPUT','Explicitly select failed or incomplete required/critical checks to override.',null,400)
  if(p.safetyDecision!=='safe')fail('QUALITY_SAFETY','An override requires a qualified person’s explicit safe-to-release decision.')
  const override={...evidence,fingerprint,itemIds:[...p.itemIds],reason:text(p.reason,'override reason',2000),qualification:text(p.qualification,'decision-maker qualification',500),safetyDecision:'safe',checks:structuredClone(status.items.filter(({item}:any)=>p.itemIds.includes(item.id)))}
  return save(c,command,job,q,{overrides:[...q.overrides,override]},override)
 }
 if(command==='quality.signQuality') {
  const status=qualityStatus(c.s,job)
  if(!status.technicianSignoff)fail('QUALITY_TECHNICIAN','The assigned technician must sign these current checks and work first.')
  const safetyDecision=choice(p.safetyDecision,['safe','unsafe'],'qualified safety decision')
  if(safetyDecision==='safe'&&status.blockers.some(b=>b.itemId!==null))fail('QUALITY_BLOCKED','Resolve failed or incomplete checks, or record an explicit authorized override, before a safe-to-release sign-off.',{blockers:status.blockers})
  const signoff={...evidence,kind:'quality',fingerprint,technicianSignoffId:status.technicianSignoff.id,overrideIds:status.overrides.map((o:any)=>o.id).sort(),safetyDecision,qualification:text(p.qualification,'quality decision-maker qualification',500),note:text(p.note,'quality sign-off evidence',2000)}
  return save(c,command,job,q,{signoffs:[...q.signoffs,signoff]},signoff)
 }
}
