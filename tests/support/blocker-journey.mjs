import assert from 'node:assert/strict'
import {archive,authorise,booking,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {acknowledgmentTerms,formPost,templateInput} from './intake-forms-journey.mjs'

const at=hours=>new Date(Date.now()+hours*3_600_000).toISOString()
const rows=async(h,kind)=>(await h.state()).records[kind]??[]
const jobNow=async(h,id)=>(await rows(h,'job')).find(j=>j.id===id)
const view=(h,job,options)=>h.api(`/api/mallet/repairs/${job.id}/blockers`,undefined,options)
const fences=(v,t)=>({jobId:v.job.id,packetVersion:v.packet?.version??0,basis:v.current.basis,...(t?{taskId:t.id,taskVersion:t.version}:{})})
const source=(v,group,record,revision)=>{
 const found=v.current.sources[group].find(s=>s.id===record.id&&s.version===record.version&&(revision===undefined||s.revision===revision))
 assert.ok(found,`ADV-003 exact ${group} source ${record.id} revision ${revision??'current'}`)
 assert.ok(found.kind&&found.label&&found.href.startsWith('/app/'),'ADV-003 source links use native private routes')
 return found
}
async function refused(h,command,input,options={},code){
 const response=await h.request('/api/mallet/commands',{method:'POST',body:{command,input},...options})
 assert.ok([400,401,403,404,409].includes(response.status),`ADV-003 ${command} refuses invalid authority or fences`)
 const result=await response.json();if(code)assert.equal(result.error,code)
 return result
}
async function refresh(h,job,options={}){
 const before=await view(h,job,options),saved=await h.command('blocker.refresh',fences(before),options),after=await view(h,job,options)
 assert.deepEqual(after.packet,saved,'ADV-003 refresh returns the saved packet record')
 const revision=saved.revisions.at(-1)
 for(const key of ['basis','sources','blockers','proposals','progress'])assert.deepEqual(revision[key],before.current[key],`ADV-003 saved ${key} is the exact reviewed source snapshot`)
 assert.equal(after.stale,false)
 return after
}

// Only public native commands create this data. The browser supplies the ordinary
// development invitation door because development intentionally suppresses mail.
export async function blockerFixture(h,{person=h.person}={}){
 await shopSetup(h)
 const owner=(await h.state()).actor,advisor=await person('synthetic-mallet-801@example.test','admin'),other=await person('synthetic-mallet-802@example.test','admin'),member=await person('synthetic-mallet-803@example.test')
 const repairs=[]
 for(let n=0;n<3;n++){
  const asset=await h.command('asset.create',{customerName:`synthetic-mallet-${810+n}`,customerEmail:`synthetic-mallet-${810+n}@example.test`,label:`synthetic-mallet-${820+n}`,identifier:`synthetic-mallet-${830+n}`})
  const {job}=await booking(h,{asset,technicianId:owner.id,startAt:at(2+n*3),endAt:at(4+n*3),bayId:`synthetic-mallet-${840+n}`})
  repairs.push({asset,job})
 }
 const [evidence,consent,backorder]=repairs
 const template=await h.command('inspectionTemplate.save',{version:0,name:'synthetic-mallet-850',vehicle:'All',service:'Inspection',reason:'Assigned evidence requirements',items:[{id:'point-a',label:'synthetic-mallet-851'},{id:'point-b',label:'synthetic-mallet-852'}]})
 evidence.inspection=await h.command('inspection.assign',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:owner.id,reason:'Inspect these two assigned requirements'})
 evidence.inspection=await h.command('inspection.record',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,inspectionId:evidence.inspection.id,inspectionVersion:evidence.inspection.version,itemId:'point-a',outcome:'not-inspected',reason:'Access requires the customer to supply the key'})
 evidence.unassigned=await h.command('inspectionTemplate.save',{version:0,name:'synthetic-mallet-853',vehicle:'All',service:'Unassigned',reason:'Not required on these repairs',items:[{id:'never-assigned',label:'synthetic-mallet-854'}]})
 evidence.custody=await h.command('intake.record',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,phase:'before',capturedAt:at(-1),damage:'synthetic-mallet-855',items:[{kind:'key',label:'synthetic-mallet-856',quantity:1}],lockHandling:'Customer unlocks in person',signedBy:evidence.asset.customerName,consent:true})
 const intakeTemplate=await h.command('intakeForm.publish',templateInput())
 evidence.form=await h.command('intakeForm.create',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,templateId:intakeTemplate.id,templateVersion:intakeTemplate.version})
 const diagnosisInput={complaint:'synthetic-mallet-857',cause:'Inspection pending',correction:'Obtain measured evidence',testMethod:'Visual access review',staffNote:'synthetic-mallet-858 private diagnostic note',customerExplanation:'Evidence collection is pending',dtcs:[],measurements:[]}
 evidence.diagnosis=await h.command('diagnosis.record',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,...diagnosisInput})
 evidence.diagnosis=await h.command('diagnosis.record',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,diagnosisId:evidence.diagnosis.id,diagnosisVersion:evidence.diagnosis.version,...diagnosisInput,testMethod:'Second access review; still awaiting the key'})
 const lines=[{kind:'part',description:'synthetic-mallet-860',quantity:1,unitCents:12000},{kind:'labor',description:'synthetic-mallet-861',quantity:1.5,unitCents:12000}]
 consent.quote=await h.command('estimate.prepare',{jobId:consent.job.id,version:(await jobNow(h,consent.job.id)).version,lines})
 consent.quote=await h.command('estimate.revise',{estimateId:consent.quote.id,version:consent.quote.version,revision:1,lines:lines.map(l=>({...l,unitCents:l.unitCents+1000})),notes:'Second reviewed scope needs its own customer decision'})
 backorder.quote=await authorise(h,await h.command('estimate.prepare',{jobId:backorder.job.id,version:(await jobNow(h,backorder.job.id)).version,lines}))
 backorder.part=await h.command('specialPart.record',{jobId:backorder.job.id,version:(await jobNow(h,backorder.job.id)).version,estimateId:backorder.quote.id,revision:1,lineId:backorder.quote.revisions[0].lines[0].id,supplier:'synthetic-mallet-862',orderReference:'synthetic-mallet-863',acknowledgment:'Supplier confirmed the order; no physical shipment received',eta:at(-2),reason:'Authorized charge requires a special-order part'})
 await h.command('work.record',{jobId:backorder.job.id,version:(await jobNow(h,backorder.job.id)).version,estimateId:backorder.quote.id,revision:1,lineId:backorder.quote.revisions[0].lines[1].id,quantity:.5,note:'Actual diagnostic labor completed'})
 backorder.promise=await h.command('promise.set',{jobId:backorder.job.id,version:(await jobNow(h,backorder.job.id)).version,pickupAt:at(16),reason:'Customer pickup recorded separately from the booking'})
 backorder.plan=(await rows(h,'promisePlan')).find(p=>p.jobId===backorder.job.id)
 const current=await jobNow(h,consent.job.id)
 consent.proposal=await h.command('dispatch.prepare',{jobId:current.id,version:current.version,technicianId:owner.id,bayId:'synthetic-mallet-864',startAt:current.startAt,endAt:current.endAt,reason:'Existing reviewed bay-change proposal'})
 return {owner,advisor,other,member,evidence,consent,backorder,repairs,diagnosisInput,view:job=>view(h,job)}
}

async function recovery(h,f,key){
 const before=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-899@example.test'}})
 try{
  const owner=(await fresh.state()).actor
  assert.notEqual(owner.id,f.owner.id)
  await restore(fresh,backup)
  assert.deepEqual((await fresh.state()).records,before,'ADV-003 exact packet revisions, assignments, acknowledgments and unresolved tasks survive archive and restore')
  let v=await view(fresh,f.evidence.job)
  const old=await view(h,f.evidence.job)
  assert.deepEqual(v.packet,old.packet)
  for(const t of v.tasks){const prior=old.tasks.find(p=>p.id===t.id);for(const field of ['assignments','acknowledgments','resolution'])assert.deepEqual(t[field],prior[field])}
  await shopSetup(fresh)
  if(v.stale)v=await refresh(fresh,f.evidence.job)
  const task=v.tasks.find(t=>!t.resolution)
  assert.ok(task);assert.equal(task.handlerActive,false,'ADV-003 source-installation identities do not regain handler rights after restore')
  await fresh.command('blocker.assign',{...fences(v,task),handlerId:owner.id})
  v=await view(fresh,f.evidence.job)
  const reassigned=v.tasks.find(t=>t.id===task.id)
  assert.equal(reassigned.handler.id,owner.id);assert.equal(reassigned.handlerActive,true)
  assert.deepEqual(reassigned.assignments.slice(0,-1),task.assignments,'ADV-003 recovery appends a reassignment without overwriting history')
  await fresh.command('blocker.acknowledge',{...fences(v,reassigned),note:'Fresh native owner assumes follow-up'})
  for(const options of [{as:h.owner},{as:f.advisor.cookie},{as:'',headers:{authorization:'Bearer '+key.token}}]){
   await fresh.state({...options,status:401})
   const denied=await fresh.request(`/api/mallet/repairs/${f.evidence.job.id}/blockers`,options);assert.equal(denied.status,401)
   await refused(fresh,'blocker.refresh',fences(v),options)
  }
 }finally{await fresh.close()}
}

// ADV-003 PARTIAL: existing evidence, exact customer decisions and physical
// receiving remain the only doors that can clear their corresponding blockers.
export async function blockerJourney(h){
 const f=await blockerFixture(h),{evidence,consent,backorder,advisor,other,member}=f
 const initial=await Promise.all(f.repairs.map(r=>view(h,r.job)))
 for(const v of initial){assert.equal(v.packet,null);assert.ok(v.current.basis);assert.equal(new Set(v.current.blockers.map(b=>b.key)).size,v.current.blockers.length)}
 const [ev,cv,bv]=initial
 source(ev,'intake',evidence.custody);source(ev,'intake',evidence.form)
 source(ev,'diagnostics',evidence.diagnosis,2);source(ev,'diagnostics',evidence.inspection)
 source(cv,'authorization',consent.quote,2)
 source(bv,'parts',backorder.part,1);source(bv,'authorization',backorder.quote,1);source(bv,'promises',backorder.promise,1);source(bv,'promises',backorder.plan,backorder.plan.revisions.at(-1).n)
 source(bv,'progress',await jobNow(h,backorder.job.id))
 assert.ok(ev.current.blockers.some(b=>b.kind==='evidence'&&b.source.id===evidence.inspection.id),'ADV-003 explicit skipped and absent assigned inspection evidence blocks')
 assert.deepEqual(ev.current.blockers.filter(b=>b.source.id===evidence.inspection.id).map(b=>b.source.itemId).sort(),['point-a','point-b'],'ADV-003 each actual assigned incomplete point has its own source reference')
 assert.ok(![cv,bv].flatMap(v=>v.current.blockers).some(b=>b.kind==='evidence'),'ADV-003 repairs without assigned inspection requirements acquire no invented inspection tasks')
 assert.ok(ev.current.blockers.some(b=>b.kind==='evidence'&&b.source.id===evidence.form.id),'ADV-003 issued unsigned intake is unresolved evidence')
 assert.ok(!initial.flatMap(v=>v.current.blockers).some(b=>b.source.id===evidence.unassigned.id),'ADV-003 unassigned template requirements never become repair tasks')
 assert.ok(cv.current.blockers.some(b=>b.kind==='consent'&&b.source.id===consent.quote.id&&b.source.revision===2))
 assert.ok(bv.current.blockers.some(b=>b.kind==='backorder'&&b.source.id===backorder.part.id),'ADV-003 elapsed ETA is never physical receipt')
 assert.equal(bv.current.progress.recordedActuals,(await jobNow(h,backorder.job.id)).actuals.length);assert.equal(bv.current.progress.remainingHours,1)
 assert.ok(cv.current.proposals.some(p=>p.id===consent.quote.id&&p.version===consent.quote.version&&p.revision===2))
 assert.ok(cv.current.proposals.some(p=>p.id===consent.proposal.id&&p.version===consent.proposal.version))
 const native=await h.state(),allowed=new Set([...native.records.estimate.filter(q=>q.status==='draft'),...(native.records.proposal??[]).filter(p=>p.status==='pending')].map(r=>r.id))
 for(const p of initial.flatMap(v=>v.current.proposals))assert.ok(allowed.has(p.id),'ADV-003 packet only offers an existing native draft or pending dispatch')
 for(const b of initial.flatMap(v=>v.current.blockers)){assert.ok(b.action.label&&b.action.href.startsWith('/app/'));assert.ok(b.source.label&&b.source.version)}
 let v=await refresh(h,evidence.job)
 for(const r of [consent,backorder])await refresh(h,r.job)
 let task=v.tasks.find(t=>t.source.id===evidence.inspection.id&&!t.resolution)
 assert.ok(task)
 const beforeInvalid=(await h.state()).records
 for(const handlerId of [undefined,'synthetic-mallet-absent',member.id])await refused(h,'blocker.assign',{...fences(v,task),handlerId,activePeople:[{id:handlerId,role:'admin',status:'active'}]})
 await refused(h,'blocker.assign',{...fences(v,task),packetVersion:v.packet.version+1,handlerId:advisor.id},{},'VERSION')
 const foreignTask=(await view(h,consent.job)).tasks[0]
 await refused(h,'blocker.assign',{...fences(v,foreignTask),handlerId:advisor.id},{},'BLOCKER_SCOPE')
 await h.command('blocker.assign',{...fences(v,task),handlerId:advisor.id},{as:member.cookie,status:403})
 assert.deepEqual((await h.state()).records,beforeInvalid,'ADV-003 rejected handler candidates and wrong roles write nothing')
 await h.command('blocker.assign',{...fences(v,task),handlerId:advisor.id})
 v=await view(h,evidence.job);task=v.tasks.find(t=>t.id===task.id)
 const assigned=structuredClone(task)
 assert.equal(task.handler.id,advisor.id);assert.equal(task.handlerActive,true)
 await h.command('blocker.acknowledge',{...fences(v,task),note:'Wrong advisor cannot acknowledge this assignment'},{as:other.cookie,status:403})
 await refused(h,'blocker.acknowledge',{...fences(v,task),taskVersion:task.version-1,note:'Stale task version'},{as:advisor.cookie})
 await h.command('blocker.acknowledge',{...fences(v,task),note:'synthetic-mallet-870: waiting for measured evidence',resolved:true},{as:advisor.cookie})
 v=await view(h,evidence.job);task=v.tasks.find(t=>t.id===task.id)
 assert.equal(task.acknowledgment.by.id,advisor.id);assert.ok(task.acknowledgments.length);assert.equal(task.acknowledgmentCurrent,true);assert.equal(task.resolution,null)
 assert.deepEqual(task.assignments,assigned.assignments)
 const acknowledged=structuredClone(task),firstRevision=structuredClone(v.packet.revisions[0]),sameSources=structuredClone(v.current.blockers)
 await h.command('blocker.refresh',{...fences(v),resolved:true})
 v=await view(h,evidence.job);task=v.tasks.find(t=>t.id===task.id)
 assert.deepEqual(v.current.blockers,sameSources);assert.equal(task.resolution,null,'ADV-003 acknowledgment and caller-supplied resolved flags never clear a source requirement')
 assert.deepEqual(task.acknowledgments,acknowledged.acknowledgments)
 evidence.diagnosis=await h.command('diagnosis.record',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,diagnosisId:evidence.diagnosis.id,diagnosisVersion:evidence.diagnosis.version,...f.diagnosisInput,testMethod:'Third native diagnostic revision; access still pending'})
 const stale=await view(h,evidence.job)
 assert.equal(stale.stale,true)
 const beforeStale=(await h.state()).records
 await refused(h,'blocker.assign',{...fences(stale,task),handlerId:other.id},{},'STALE_PACKET')
 await refused(h,'blocker.acknowledge',{...fences(stale,task),note:'Cannot acknowledge stale source review'},{as:advisor.cookie},'STALE_PACKET')
 await refused(h,'blocker.refresh',fences(v),{},'STALE_PACKET')
 assert.deepEqual((await h.state()).records,beforeStale)
 v=await refresh(h,evidence.job);source(v,'diagnostics',evidence.diagnosis,3)
 assert.deepEqual(v.packet.revisions[0],firstRevision,'ADV-003 later native source revisions preserve the original reviewed packet')
 const key=await h.command('agent.create',{label:'synthetic-mallet-871'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 await recovery(h,f,key)
 // Native inactive identities cannot be supplied back as client-side candidates.
 await h.api('/auth/operator/status',{operatorId:advisor.id,status:'inactive'})
 v=await view(h,evidence.job);task=v.tasks.find(t=>t.id===task.id)
 assert.equal(task.handlerActive,false)
 const beforeInactive=(await h.state()).records
 await refused(h,'blocker.assign',{...fences(v,task),handlerId:advisor.id,activePeople:[{id:advisor.id,role:'admin',status:'active'}]})
 assert.deepEqual((await h.state()).records,beforeInactive)
 await h.command('blocker.assign',{...fences(v,task),handlerId:f.owner.id})
 // Each true observation clears only its own original assigned requirement.
 for(const itemId of ['point-a','point-b']){
  evidence.inspection=await h.command('inspection.record',{jobId:evidence.job.id,version:(await jobNow(h,evidence.job.id)).version,inspectionId:evidence.inspection.id,inspectionVersion:evidence.inspection.version,itemId,outcome:'green',reason:'Access supplied; original assigned point inspected'})
 }
 v=await refresh(h,evidence.job)
 assert.ok(!v.current.blockers.some(b=>b.source.id===evidence.inspection.id))
 assert.ok(v.tasks.filter(t=>t.source.id===evidence.inspection.id).every(t=>t.resolution),'ADV-003 real evidence resolves task history on refresh')
 assert.ok(v.current.blockers.some(b=>b.source.id===evidence.form.id),'ADV-003 completed inspection never signs the separate intake form')
 await formPost(h,evidence.form.url,{version:evidence.form.version,symptom:'synthetic-mallet-872',concern:'synthetic-mallet-873',typedName:evidence.asset.customerName,consent:'yes',action:'sign',...Object.fromEntries(acknowledgmentTerms.map(a=>['acknowledgment:'+a.key,'yes']))})
 v=await refresh(h,evidence.job)
 assert.ok(!v.current.blockers.some(b=>b.kind==='evidence'));assert.ok(v.tasks.every(t=>t.resolution))
 // Dispatch approval precedes work and uses its existing native review route.
 await h.command('dispatch.approve',{proposalId:consent.proposal.id,version:consent.proposal.version})
 let c=await refresh(h,consent.job)
 assert.ok(!c.current.proposals.some(p=>p.id===consent.proposal.id))
 const qid=consent.quote.id
 consent.quote=await h.command('estimate.approve',{estimateId:qid,version:consent.quote.version,revision:2})
 c=await refresh(h,consent.job)
 assert.ok(c.current.blockers.some(b=>b.kind==='consent'));assert.ok(!c.current.proposals.some(p=>p.id===qid))
 consent.quote=await h.command('estimate.markSent',{estimateId:qid,version:consent.quote.version,revision:2,method:'printed'})
 c=await refresh(h,consent.job);assert.ok(c.current.blockers.some(b=>b.kind==='consent'),'ADV-003 owner approval and sharing still need the customer decision')
 await h.command('estimate.authorise',{estimateId:qid,version:consent.quote.version,revision:1,lineIds:consent.quote.revisions[0].lines.map(l=>l.id),customerName:consent.asset.customerName,method:'signed',evidence:'Wrong revision cannot authorize current scope'},{status:409})
 consent.quote=await h.command('estimate.authorise',{estimateId:qid,version:consent.quote.version,revision:2,lineIds:consent.quote.revisions.at(-1).lines.map(l=>l.id),customerName:consent.asset.customerName,method:'signed',evidence:'synthetic-mallet-874: signed exact revision 2'})
 c=await refresh(h,consent.job);assert.ok(!c.current.blockers.some(b=>b.kind==='consent'));assert.ok(c.tasks.every(t=>t.resolution))
 let b=await refresh(h,backorder.job)
 backorder.part=await h.command('specialPart.delay',{jobId:backorder.job.id,version:(await jobNow(h,backorder.job.id)).version,specialPartId:backorder.part.id,partVersion:backorder.part.version,eta:at(20),acknowledgment:'synthetic-mallet-875: revised supplier ETA',reason:'Supplier changed dispatch'})
 b=await refresh(h,backorder.job);source(b,'parts',backorder.part,2)
 assert.ok(b.current.blockers.some(x=>x.kind==='backorder'))
 const beforeReceipt=await jobNow(h,backorder.job.id)
 backorder.part=await h.command('specialPart.receive',{jobId:backorder.job.id,version:beforeReceipt.version,specialPartId:backorder.part.id,partVersion:backorder.part.version,receivedAt:at(-.25),receiptReference:'synthetic-mallet-876: physical item counted at receiving'})
 b=await refresh(h,backorder.job)
 assert.ok(!b.current.blockers.some(x=>x.kind==='backorder'));assert.ok(b.tasks.every(t=>t.resolution))
 const afterReceipt=await jobNow(h,backorder.job.id)
 assert.equal(afterReceipt.status,beforeReceipt.status);assert.deepEqual(afterReceipt.actuals,beforeReceipt.actuals)
 assert.equal(b.current.progress.recordedActuals,beforeReceipt.actuals.length);assert.equal(b.current.progress.remainingHours,1,'ADV-003 received parts never infer completed labor')
 for(const r of f.repairs)assert.ok(!['completed','invoiced'].includes((await jobNow(h,r.job.id)).status))
 const securityView=await view(h,evidence.job),historic=securityView.tasks.find(t=>t.id===task.id)
 for(const options of [agent,{as:advisor.cookie},{as:''}]){
  for(const path of [`/api/mallet/repairs/${evidence.job.id}/blockers`,`/app/jobs/${evidence.job.id}/blockers`]){const denied=await h.request(path,options);assert.ok([303,401,403,404].includes(denied.status));assert.ok(!(await denied.text()).includes(f.diagnosisInput.staffNote))}
  for(const command of ['blocker.refresh','blocker.assign','blocker.acknowledge'])await refused(h,command,{...fences(securityView,historic),handlerId:f.owner.id,note:'No authority'},options)
 }
 const agentState=await h.state(agent)
 assert.equal(agentState.records.diagnosis,undefined);assert.equal(agentState.records.repairBlockerPacket,undefined);assert.equal(agentState.records.repairBlockerTask,undefined)
 for(const path of ['/api/mallet/state',`/api/mallet/repairs/${evidence.job.id}`,`/app/jobs/${evidence.job.id}`]){
  const response=await h.request(path,agent);assert.ok(!(await response.text()).includes(f.diagnosisInput.staffNote),'ADV-003 bearer cannot recover private diagnosis through an older read door')
  const revoked=await h.request(path,{as:advisor.cookie});assert.ok([303,401].includes(revoked.status));assert.ok(!(await revoked.text()).includes(f.diagnosisInput.staffNote))
 }
}
