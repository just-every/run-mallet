import assert from 'node:assert/strict'
import {installation,assetInput,booking,estimate,authorise,archive,restore} from '../harness.mjs'

export async function routingJourney(){
 const h=await installation();let fresh
 try{
  const owner=(await h.state()).actor,advisor=await h.person('routing-advisor@example.test','admin'),other=await h.person('routing-other@example.test','admin'),tech=await h.person('routing-tech@example.test')
  const key=await h.command('agent.create',{label:'Routing cannot be delegated'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
  // An independently calculated closed-day deadline: tomorrow is entirely closed; the following day opens at 09:00 UTC.
  const day=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10),closed=day(1),opening=day(2),calendar={timeZone:'UTC',weekdays:[0,1,2,3,4,5,6],openMinute:540,closeMinute:1020,closedDates:[day(0),closed]},deadlines={'unassigned':1,'approval-waiting':1,'parts-stalled':1,'diagnostic-exception':1}
  const rules=[{id:'brakes',location:'Detroit',repairType:'brakes',skill:'hydraulics',priority:'urgent',handlerId:advisor.id},{id:'electronics',location:'Detroit',repairType:'electronics',skill:'board-repair',priority:'any',handlerId:other.id}]
  const policyInput={policyVersion:0,calendar,deadlineMinutes:deadlines,rules,managerId:owner.id,reason:'Counter routing with a closed shop day'}
  const before=(await h.state()).version
  for(const options of [{as:tech.cookie,status:403},{...agent,status:403},{as:'',status:401},{headers:{origin:'https://other.test'},status:403}])await h.command('routing.configure',policyInput,options)
  assert.equal((await h.state()).version,before,'FLOW-003 refused routing transports write nothing')
  await h.command('routing.configure',{...policyInput,calendar:{...calendar,weekdays:[]}},{status:400})
  await h.command('routing.configure',{...policyInput,managerId:tech.id,activePeople:[{id:tech.id,role:'owner'}]},{status:409})
  const policy=await h.command('routing.configure',policyInput)
  await h.command('routing.configure',policyInput,{status:409})
  const jobs=[]
  for(let i=0;i<5;i++){
   const asset=await h.command('asset.create',assetInput('routing-'+i)),f=await booking(h,{asset,technicianId:tech.id,bayId:`routing-${i}`,startAt:`2026-10-${21+i}T09:00:00Z`,endAt:`2026-10-${21+i}T10:00:00Z`});jobs.push(f.job)
  }
  await h.command('flow.priority',{jobId:jobs[0].id,version:jobs[0].version,flowVersion:0,priority:'urgent',reason:'Loss of braking'})
  const inputs=[['Detroit','brakes','hydraulics'],['Detroit','electronics','board-repair'],['Chicago','brakes','hydraulics'],['Detroit','brakes','alignment'],['Detroit','brakes','hydraulics']]
  for(let i=0;i<jobs.length;i++){
   const [location,repairType,skill]=inputs[i]
   await h.command('routing.intake',{jobId:jobs[i].id,version:jobs[i].version,location,repairType,skill})
  }
  await h.command('routing.intake',{jobId:jobs[0].id,version:jobs[0].version,location:'Detroit',repairType:'brakes',skill:'hydraulics'},{status:409})
  const quoted=await estimate(h,jobs[0])
  await authorise(h,await estimate(h,jobs[1]))
  const partsJob=(await h.state()).records.job.find(j=>j.id===jobs[1].id)
  await h.command('promise.partETA',{jobId:partsJob.id,version:partsJob.version,planVersion:0,partId:'chip',name:'Controller chip',eta:opening+'T08:00:00Z',reason:'Required component unavailable',sourceNote:'Supplier counter report'})
  let row=(await h.state()).records.routingCase.find(r=>r.jobId===jobs[1].id)
  await h.command('routing.exception',{jobId:jobs[1].id,version:partsJob.version,caseVersion:row.version,detail:'Bench measurement conflicts with the symptom; specialist review required'})
  await h.command('routing.sweep',{}, {status:404})
  await h.command('routing.run',{})
  let state=await h.state(),cases=state.records.routingCase,tickets=state.records.routingBlocker
  assert.equal(cases.find(r=>r.jobId===jobs[0].id).assignment.handler.id,advisor.id)
  assert.equal(cases.find(r=>r.jobId===jobs[1].id).assignment.handler.id,other.id)
  for(const [person,job] of [[advisor,jobs[0]],[other,jobs[1]]])assert.equal((await h.state({as:person.cookie})).records.routingCase.find(r=>r.jobId===job.id).assignment.handler.id,person.id,'FLOW-003 the assigned human receives their case through the staff state door')
  assert.ok(cases.filter(r=>jobs.slice(2).some(j=>j.id===r.jobId)).every(r=>r.assignment===null),'FLOW-003 location, skill and priority each constrain routing')
  assert.deepEqual(jobs.slice(0,2).map(j=>cases.find(r=>r.jobId===j.id).assignments.length),[1,1],'FLOW-003 one matching handler per case')
  assert.ok(state.records.job.every(j=>j.technicianId===tech.id),'FLOW-003 case routing does not bypass technician dispatch approval')
  assert.deepEqual(new Set(tickets.map(t=>t.kind)),new Set(Object.keys(deadlines)))
  assert.ok(tickets.every(t=>t.dueAt===opening+'T09:01:00.000Z'),'FLOW-003 a closed-day deadline skips both closed dates and the overnight period')
  assert.ok(tickets.every(t=>!t.escalation&&!t.resolution&&!t.acknowledgment))
  const originalCount=tickets.length,assigned=structuredClone(cases.map(r=>r.assignments))
  await h.command('routing.run',{});state=await h.state()
  assert.equal(state.records.routingBlocker.length,originalCount);assert.deepEqual(state.records.routingCase.map(r=>r.assignments),assigned,'FLOW-003 repeated routing neither duplicates handlers nor blocker episodes')
  const acknowledge=tickets.find(t=>t.jobId===jobs[3].id)
  const ack=await h.command('routing.acknowledge',{blockerId:acknowledge.id,version:acknowledge.version,note:'Manager owns the unmatched skill review'})
  assert.equal(ack.acknowledgment.by.id,owner.id)
  await h.command('routing.acknowledge',{blockerId:ack.id,version:ack.version,note:'Duplicate acknowledgment'},{status:409})
  await h.cron(closed+'T12:00:00Z')
  assert.ok((await h.state()).records.routingBlocker.every(t=>!t.escalation),'FLOW-003 the closed-day cron cannot escalate early')
  await h.cron(opening+'T09:00:00Z')
  assert.ok((await h.state()).records.routingBlocker.every(t=>!t.escalation),'FLOW-003 the opening boundary is before one full open minute')
  const mailBefore=h.messages.length
  await h.cron(opening+'T09:01:00Z')
  state=await h.state();tickets=state.records.routingBlocker
  assert.equal(tickets.filter(t=>t.escalation).length,originalCount-1)
  assert.ok(tickets.filter(t=>t.escalation).every(t=>t.escalation.to.id===owner.id&&t.escalation.at===opening+'T09:01:00.000Z'&&/Internal escalation task/.test(t.escalation.label)))
  assert.equal(h.messages.length,mailBefore,'FLOW-003 internal escalation makes no mail delivery claim')
  const escalationEvents=state.records.event.filter(e=>e.kind==='routing.escalated')
  await h.configure({ROUTING_RESTART:'second isolate'})
  await h.cron(opening+'T10:00:00Z');await h.cron(opening+'T10:00:00Z')
  assert.deepEqual((await h.state()).records.event.filter(e=>e.kind==='routing.escalated'),escalationEvents,'FLOW-003 repeated cron and Worker restart escalate each unacknowledged blocker exactly once')
  const approval=tickets.find(t=>t.kind==='approval-waiting')
  await h.command('routing.resolve',{blockerId:approval.id,version:approval.version,reason:'Pretend it is approved'},{status:409})
  await authorise(h,quoted)
  let plan=(await h.state()).records.promisePlan.find(r=>r.jobId===jobs[1].id)
  await h.command('promise.partETA',{jobId:partsJob.id,version:partsJob.version,planVersion:plan.version,partId:'chip',name:'Controller chip',eta:opening+'T08:00:00Z',receivedAt:new Date(Date.now()-60000).toISOString(),reason:'Receiving slip physically checked',sourceNote:'Receipt 117'})
  let diagnostic=(await h.state()).records.routingBlocker.find(t=>t.kind==='diagnostic-exception')
  const diagnosticEscalation=structuredClone(diagnostic.escalation)
  diagnostic=await h.command('routing.acknowledge',{blockerId:diagnostic.id,version:diagnostic.version,note:'Manager reviewing the bench evidence'})
  assert.deepEqual(diagnostic.escalation,diagnosticEscalation,'FLOW-003 late acknowledgment preserves the already issued escalation')
  const resolved=await h.command('routing.resolve',{blockerId:diagnostic.id,version:diagnostic.version,reason:'Scope test repeated; connector failure confirmed, original reading retained'})
  assert.equal(resolved.resolution.by.id,owner.id);assert.match(resolved.resolution.reason,/original reading retained/)
  await h.command('routing.resolve',{blockerId:resolved.id,version:resolved.version,reason:'Overwrite resolution'},{status:409})
  await h.command('routing.run',{})
  state=await h.state()
  assert.ok(state.records.routingBlocker.filter(t=>['approval-waiting','parts-stalled','diagnostic-exception'].includes(t.kind)).every(t=>t.resolution),'FLOW-003 source changes resolve approval and part blockers without rewriting escalation history')
  // First match wins; changing rules does not steal an existing live handler, and versions/reasons remain retained.
  const replacement=await h.command('routing.configure',{...policyInput,policyVersion:policy.version,deadlineMinutes:Object.fromEntries(Object.keys(deadlines).map(k=>[k,2])),managerId:other.id,rules:[{...rules[0],id:'new-first',handlerId:owner.id},...rules,{id:'chicago',location:'Chicago',repairType:'brakes',skill:'hydraulics',priority:'any',handlerId:owner.id}]})
  assert.equal(replacement.revisions.length,2)
  const oldEpisode=(await h.state()).records.routingBlocker.find(t=>t.id===ack.id)
  assert.equal(oldEpisode.manager.id,owner.id);assert.equal(oldEpisode.dueAt,opening+'T09:01:00.000Z','FLOW-003 policy edits never reset existing blocker deadlines or managers')
  await h.command('routing.run',{})
  assert.equal((await h.state()).records.routingCase.find(r=>r.jobId===jobs[0].id).assignment.handler.id,advisor.id)
  assert.ok((await h.state()).records.routingBlocker.find(t=>t.jobId===jobs[2].id&&t.kind==='unassigned').resolution,'FLOW-003 successful routing resolves an unassigned episode')
  await h.api('/auth/operator/status',{operatorId:advisor.id,status:'inactive'})
  await h.command('routing.run',{})
  state=await h.state();row=state.records.routingCase.find(r=>r.jobId===jobs[0].id)
  assert.equal(row.assignment.handler.id,owner.id);assert.equal(row.assignments.length,2,'FLOW-003 removed handler is replaced once using the first active matching rule')
  await h.command('routing.run',{})
  assert.equal((await h.state()).records.routingCase.find(r=>r.id===row.id).assignments.length,2)
  const memberState=await h.state({as:tech.cookie}),agentState=await h.state(agent)
  for(const s of [memberState,agentState])for(const kind of ['routingPolicy','routingCase','routingBlocker'])assert.equal(s.records[kind],undefined,'FLOW-003 existing member/agent boundary remains enforced')
  assert.ok(memberState.records.event.every(e=>!e.kind.startsWith('routing.')));assert.ok(agentState.records.event.every(e=>!e.kind.startsWith('routing.')))
  await h.state({as:advisor.cookie,status:401})
  row=(await h.state()).records.routingCase.find(r=>r.jobId===jobs[1].id)
  await h.command('routing.exception',{jobId:partsJob.id,version:partsJob.version,caseVersion:row.version,detail:'A later independent symptom needs another specialist review'})
  await h.command('routing.run',{})
  const recurring=(await h.state()).records.routingBlocker.filter(t=>t.kind==='diagnostic-exception')
  assert.equal(recurring.length,2);assert.ok(recurring.find(t=>t.id===resolved.id).resolution);assert.ok(recurring.some(t=>!t.resolution&&!t.acknowledgment&&!t.escalation),'FLOW-003 a distinct recurring exception keeps the old resolved episode and starts fresh')
  await h.api('/auth/operator/status',{operatorId:other.id,status:'inactive'})
  await h.cron(opening+'T10:00:00Z')
  const fallback=(await h.state()).records.routingBlocker.find(t=>t.kind==='diagnostic-exception'&&!t.resolution)
  assert.equal(fallback.escalation.to.id,owner.id,'FLOW-003 a deactivated named manager cannot receive new authority; the current owner receives the internal exception')
  // OPS-001: exact product history is portable; the old actor attribution grants no destination authority.
  const saved=await archive(h)
  fresh=await installation({bindings:{OWNER_EMAIL:'fresh-routing-owner@example.test'}})
  await restore(fresh,saved)
  const restored=await fresh.state(),final=await h.state()
  for(const kind of ['routingPolicy','routingCase','routingBlocker'])assert.deepEqual(restored.records[kind],final.records[kind],'FLOW-003 / OPS-001 exact routing history restores')
  assert.notEqual(restored.actor.id,owner.id)
  await fresh.state({as:h.owner,status:401})
  const priorEscalations=restored.records.event.filter(e=>e.kind==='routing.escalated'),priorSubjects=new Set(priorEscalations.map(e=>e.subjectId))
  await fresh.cron(opening+'T10:00:00Z')
  assert.deepEqual((await fresh.state()).records.event.filter(e=>e.kind==='routing.escalated'&&priorSubjects.has(e.subjectId)),priorEscalations,'FLOW-003 restored escalations retain the exact event and are never replayed')
  await routingDstJourney()
  return {cases:cases.length,blockerKinds:4,escalations:escalationEvents.length}
 }finally{await fresh?.close();await h.close()}
}

async function routingDstJourney(){
 const h=await installation()
 try{
  const owner=(await h.state()).actor
  await h.command('routing.configure',{policyVersion:0,rules:[],managerId:owner.id,reason:'Sunday overnight DST workshop',calendar:{timeZone:'America/New_York',weekdays:[0],openMinute:60,closeMinute:180,closedDates:[]},deadlineMinutes:{'unassigned':180,'approval-waiting':180,'parts-stalled':180,'diagnostic-exception':180}})
  const {job}=await booking(h)
  await h.command('routing.intake',{jobId:job.id,version:job.version,location:'Detroit',repairType:'electrical',skill:'diagnosis'})
  // US fall-back: 01:00 EDT = 05:00 UTC; 01:00 repeats at 06:00 UTC, closing 03:00 EST = 08:00 UTC.
  await h.cron('2027-11-07T05:00:00Z')
  let blocker=(await h.state()).records.routingBlocker[0]
  assert.equal(blocker.dueAt,'2027-11-07T08:00:00.000Z','FLOW-003 the repeated DST hour counts as real shop-open minutes')
  await h.cron('2027-11-07T07:59:00Z');assert.equal((await h.state()).records.routingBlocker[0].escalation,null)
  await h.cron('2027-11-07T08:00:00Z');assert.equal((await h.state()).records.routingBlocker[0].escalation.to.id,owner.id)
 }finally{await h.close()}
}
