import assert from 'node:assert/strict'
import {archive,assetInput,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {coilDiagnosis,shopSetup} from './diagnosis-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
const stagesOf=board=>Object.fromEntries(board.stages.flatMap(s=>s.cards.map(c=>[c.jobId,s.id])))
const cardOf=(board,id)=>board.stages.flatMap(s=>s.cards).find(c=>c.jobId===id)
const ids=board=>board.stages.flatMap(s=>s.cards.map(c=>c.jobId)).sort()
// FLOW-001: several repairs move intake -> closed through their gated commands; the board filters one technician
// and an overdue promise, refuses skipped authorization/quality gates, and retains canceled and lost work.
export async function flowJourney(h){
 await shopSetup(h)
 const andre=await h.person('andre-flow@example.test'),mei=await h.person('mei-flow@example.test'),advisor=await h.person('casey-flow@example.test','admin'),A={as:andre.cookie},M={as:mei.cookie},ADV={as:advisor.cookie}
 const board=async(query='',options={})=>h.api('/api/mallet/board'+(query?'?'+query:''),undefined,options)
 const job=async id=>(await h.state()).records.job.find(j=>j.id===id),stage=async(id,o)=>stagesOf(await board('',o))[id]
 const first=await booking(h,{technicianId:andre.id}),ro=first.job
 const promisedAt=new Date(Date.now()+86400000).toISOString()
 const b=await board();assert.deepEqual(b.stages.map(s=>s.id),['intake','diagnosis','approval','parts','work','quality','ready','collected','closed'],'FLOW-001 the nine stages')
 assert.equal(stagesOf(b)[ro.id],'intake');assert.equal(cardOf(b,ro.id).customer,'Cedar Bikes');assert.equal(cardOf(b,ro.id).technicianId,andre.id);assert.equal(cardOf(b,ro.id).priority,'normal');assert.deepEqual(cardOf(b,ro.id).due,{at:ro.endAt,kind:'booking'})
 await h.command('promise.set',{jobId:ro.id,version:ro.version,pickupAt:promisedAt,reason:'Tomorrow pickup after brake service'},ADV)
 await h.command('diagnosis.record',{jobId:ro.id,version:(await job(ro.id)).version,...coilDiagnosis,dtcs:[{code:'P0301',description:'Cylinder 1 misfire'}],measurements:[],attachmentIds:[]},A)
 assert.equal(await stage(ro.id),'diagnosis','FLOW-001 diagnosis evidence moves the card')
 let quote=await estimate(h,await job(ro.id));assert.equal(await stage(ro.id),'approval')
 await new Promise(resolve=>setTimeout(resolve,50)) // a real, measured customer-approval wait
 assert.ok(cardOf(await board(),ro.id).blockers.includes('Estimate waiting for a person to approve'),'FLOW-001 blocker named')
 // Skipping authorization: work cannot be recorded, and the card stays in approval.
 await h.command('work.record',{jobId:ro.id,version:(await job(ro.id)).version,estimateId:quote.id,revision:1,lineId:quote.revisions[0].lines[0].id,quantity:1},{...A,status:409})
 assert.equal(await stage(ro.id),'approval','FLOW-001 the authorization gate cannot be skipped')
 quote=await authorise(h,quote);assert.equal(await stage(ro.id),'work')
 let plan=await h.command('promise.partETA',{jobId:ro.id,version:(await job(ro.id)).version,planVersion:0,partId:'pads',name:'Brake pads',eta:new Date(Date.now()+86400000).toISOString(),sourceNote:'Supplier phone call',reason:'Pads on order'},A)
 await new Promise(resolve=>setTimeout(resolve,50)) // a real, measured parts wait
 assert.equal(await stage(ro.id),'parts');assert.match(cardOf(await board(),ro.id).blockers.join('|'),/Waiting for Brake pads: staff-reported ETA/)
 plan=await h.command('promise.partETA',{jobId:ro.id,version:(await job(ro.id)).version,planVersion:plan.version,partId:'pads',name:'Brake pads',eta:new Date(Date.now()+86400000).toISOString(),receivedAt:new Date(Date.now()-1000).toISOString(),sourceNote:'Counted at the parts desk',reason:'Pads arrived'},A)
 for(const line of quote.revisions[0].lines)await h.command('work.record',{jobId:ro.id,version:(await job(ro.id)).version,estimateId:quote.id,revision:1,lineId:line.id,quantity:line.quantity},A)
 assert.equal(await stage(ro.id),'work');assert.equal(await stage(ro.id,A),'work','FLOW-001 the technician board shows the same stage')
 // Skipping quality: completion is refused while clearance is incomplete.
 await h.command('job.complete',{jobId:ro.id,version:(await job(ro.id)).version},{status:409})
 await qualityReady(h,await job(ro.id),{technician:{id:andre.id,cookie:andre.cookie},reviewer:advisor})
 assert.equal(await stage(ro.id),'quality','FLOW-001 signed checks put the card in quality')
 await h.command('flow.close',{jobId:ro.id,version:(await job(ro.id)).version,outcome:'canceled',reason:'Customer changed mind'},{status:409})
 await h.command('job.complete',{jobId:ro.id,version:(await job(ro.id)).version});assert.equal(await stage(ro.id),'ready')
 assert.deepEqual(cardOf(await board(),ro.id).blockers,['Invoice not prepared','Collection not recorded'])
 await h.command('flow.collect',{jobId:ro.id,version:(await job(ro.id)).version,flowVersion:0,collectorName:'Dana Cedar'},{status:409})
 let invoice=await h.command('invoice.prepare',{jobId:ro.id,version:(await job(ro.id)).version},ADV);invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
 await h.command('flow.collect',{jobId:ro.id,version:(await job(ro.id)).version,flowVersion:0,collectorName:'Dana Cedar'},{...A,status:403})
 const key=await h.command('agent.create',{label:'Board boundary'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 await h.command('flow.collect',{jobId:ro.id,version:(await job(ro.id)).version,flowVersion:0,collectorName:'Dana Cedar'},{...agent,status:403})
 const flow=await h.command('flow.collect',{jobId:ro.id,version:(await job(ro.id)).version,flowVersion:0,collectorName:'Dana Cedar',note:'Paid at the counter'},ADV)
 assert.equal(flow.collection.invoiceNumber,invoice.number);assert.match(flow.collection.label,/did not record or verify payment/);assert.equal(await stage(ro.id),'collected')
 await h.command('flow.collect',{jobId:ro.id,version:(await job(ro.id)).version,flowVersion:flow.version,collectorName:'Again'},{...ADV,status:409})
 invoice=(await h.state()).records.invoice.find(i=>i.id===invoice.id);await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 assert.equal(await stage(ro.id),'closed','FLOW-001 collected and exported repairs close')
 // A second technician's repair with a customer promise that passes, raised to urgent by the advisor.
 const second=await booking(h,{technicianId:mei.id,asset:await h.command('asset.create',{...assetInput('2'),customerName:'Rivera Plumbing',identifier:'OH FLT 2207'}),bayId:'Bay 2'}),late=second.job
 await h.command('promise.set',{jobId:late.id,version:late.version,pickupAt:new Date(Date.now()+1500).toISOString(),reason:'Customer leaves at noon'},ADV)
 await h.command('flow.priority',{jobId:late.id,version:(await job(late.id)).version,flowVersion:0,priority:'urgent',reason:'Fleet van off the road'},{...M,status:403})
 const urgent=await h.command('flow.priority',{jobId:late.id,version:(await job(late.id)).version,flowVersion:0,priority:'urgent',reason:'Fleet van off the road'},ADV)
 await h.command('flow.priority',{jobId:late.id,version:(await job(late.id)).version,flowVersion:0,priority:'high',reason:'stale'},{...ADV,status:409})
 assert.deepEqual(urgent.priorityHistory.map(x=>[x.from,x.to,x.by.id]),[['normal','urgent',advisor.id]])
 await new Promise(r=>setTimeout(r,2000))
 assert.deepEqual(ids(await board('technician='+mei.id)),[late.id],'FLOW-001 filter one technician')
 assert.deepEqual(ids(await board('due=overdue')),[late.id],'FLOW-001 filter overdue customer promise');assert.ok(cardOf(await board(),late.id).blockers.includes('Customer promise overdue'))
 assert.deepEqual(ids(await board('priority=urgent')),[late.id]);assert.deepEqual(ids(await board('q=flt%202207')),[late.id],'FLOW-001 search by plate');assert.deepEqual(ids(await board('q=rivera')),[late.id])
 assert.deepEqual(ids(await board('stage=closed')),[ro.id]);assert.deepEqual(ids(await board('',M)),[late.id],'FLOW-001 a technician board holds only their repairs')
 const html=await (await h.request('/app?technician='+mei.id+'&due=overdue')).text()
 assert.match(html,/Rivera Plumbing/);assert.doesNotMatch(html,/Cedar Bikes/);for(const label of ['Intake','Diagnosis','Approval','Parts','Work','Quality','Ready','Collected','Closed'])assert.match(html,new RegExp(`<h2>${label} <span>`))
 assert.match(html,/Urgent/);assert.match(html,/Promise overdue/);assert.match(html,/http-equiv="refresh" content="60"/,'FLOW-001 the board re-reads current records every minute')
 // Canceled and lost work is retained under Closed and frees its bay and technician.
 const cancel=await booking(h,{technicianId:mei.id,asset:await h.command('asset.create',assetInput('3')),bayId:'Bay 3',startAt:'2026-10-21T09:00:00-04:00',endAt:'2026-10-21T11:00:00-04:00'})
 await h.command('flow.close',{jobId:cancel.job.id,version:cancel.job.version,outcome:'canceled',reason:'Customer sold the car'},{...M,status:403})
 const canceled=await h.command('flow.close',{jobId:cancel.job.id,version:cancel.job.version,outcome:'canceled',reason:'Customer sold the car'},ADV)
 assert.equal(canceled.status,'canceled');assert.equal(canceled.closure.stage,'intake');assert.equal(canceled.closure.by.id,advisor.id)
 const lostRo=await booking(h,{technicianId:mei.id,asset:await h.command('asset.create',assetInput('4')),bayId:'Bay 4',startAt:'2026-10-22T09:00:00-04:00',endAt:'2026-10-22T11:00:00-04:00'})
 await authorise(h,await estimate(h,lostRo.job),[])
 assert.ok(cardOf(await board(),lostRo.job.id).blockers.includes('Customer declined all work'))
 await h.command('flow.close',{jobId:lostRo.job.id,version:(await job(lostRo.job.id)).version,outcome:'lost',reason:'Took it to the dealer'},ADV)
 assert.deepEqual(ids(await board('stage=closed')),[ro.id,cancel.job.id,lostRo.job.id].sort(),'FLOW-001 canceled and lost repairs stay on the board')
 await h.command('estimate.prepare',{jobId:cancel.job.id,version:canceled.version,lines:[{kind:'labor',description:'x',quantity:1,unitCents:100}]},{status:409})
 const asset5=await h.command('asset.create',assetInput('5'))
 await h.command('job.book',{assetId:asset5.id,version:asset5.version,title:'Rebooked slot',technicianId:mei.id,bayId:'Bay 3',startAt:'2026-10-21T09:00:00-04:00',endAt:'2026-10-21T10:00:00-04:00'})
 const jobHtml=await (await h.request('/app/jobs/'+cancel.job.id)).text();assert.match(jobHtml,/Canceled[\s\S]*Customer sold the car/)
 // REPORT-004: stage delay and promise variance drill to the actual command events.
 const reportQuery='?from='+ro.createdAt.slice(0,10)+'&to='+ro.createdAt.slice(0,10)
 const report=await h.api('/api/mallet/reports/turnaround'+reportQuery)
 const measured=report.repairs.find(r=>r.jobId===ro.id),completed=await job(ro.id)
 assert.equal(measured.historyComplete,true,'REPORT-004 a newly booked repair has history from intake')
 assert.deepEqual(measured.intervals.map(i=>i.stage),['intake','diagnosis','approval','work','parts','work','quality','ready','collected','closed'])
 assert.ok(measured.stageTotalsMs.approval>=50,'REPORT-004 the report includes the actual customer-decision wait')
 assert.ok(measured.stageTotalsMs.parts>=50,'REPORT-004 the report includes the actual unreceived-parts wait')
 assert.equal(measured.cycleMs,Date.parse(completed.completedAt)-Date.parse(ro.createdAt))
 assert.equal(measured.promise.pickupAt,promisedAt)
 assert.equal(measured.promise.completionVarianceMs,Date.parse(completed.completedAt)-Date.parse(promisedAt))
 assert.ok(measured.promise.completionVarianceMs<0,'REPORT-004 completed before the promised pickup')
 assert.equal(measured.promise.overdue,false)
 assert.equal(Object.values(measured.stageTotalsMs).reduce((a,b)=>a+b,0),measured.elapsedMs,'REPORT-004 all observed stage time reconciles to booking-to-closure elapsed time')
 const evidence=(await h.state()).records.event
 for(const interval of measured.intervals)for(const id of interval.eventIds){const event=evidence.find(e=>e.id===id);assert.equal(event.jobId,ro.id);assert.equal(event.at,interval.from);assert.ok(interval.commands.includes(event.kind),'REPORT-004 every drill-through resolves to the real same-repair command event')}
 const lateRow=report.repairs.find(r=>r.jobId===late.id)
 assert.equal(lateRow.promise.overdue,true,'REPORT-004 the still-open passed promise is overdue')
 assert.equal(lateRow.promise.completionVarianceMs,null,'REPORT-004 an unfinished repair has no invented completion')
 assert.equal(lateRow.cycleMs,null)
 const mine=await h.api('/api/mallet/reports/turnaround'+reportQuery,undefined,A)
 assert.ok(mine.repairs.some(r=>r.jobId===ro.id));assert.ok(!mine.repairs.some(r=>r.jobId===late.id),'REPORT-004 existing native assignment scope applies')
 await h.api('/api/mallet/reports/turnaround'+reportQuery,undefined,{...agent,status:403})
 await h.api('/api/mallet/reports/turnaround'+reportQuery,undefined,{as:'',status:401})
 await h.api('/api/mallet/reports/turnaround?from=2026-10-22&to=2026-10-21',undefined,{status:400})
 const nextDay=new Date(Date.parse(ro.createdAt.slice(0,10))+86400000).toISOString().slice(0,10)
 assert.deepEqual((await h.api('/api/mallet/reports/turnaround?from='+nextDay+'&to='+nextDay)).repairs,[],'REPORT-004 the inclusive booking-date filter excludes other dates')
 // OPS-001: board records restore exactly.
 const state=await h.state(),backup=await archive(h),target=await installation()
 try{await restore(target,backup);const restored=await target.state();assert.deepEqual(restored.records.flow,state.records.flow);assert.deepEqual(restored.records.job,state.records.job);assert.deepEqual(restored.records.stageEvent,state.records.stageEvent,'REPORT-004 / OPS-001 stage evidence restores exactly')
  const restoredReport=await target.api('/api/mallet/reports/turnaround'+reportQuery)
  assert.deepEqual(restoredReport.repairs.find(r=>r.jobId===ro.id),measured,'REPORT-004 a closed repair report is identical under fresh native authority')
  assert.deepEqual(stagesOf(await target.api('/api/mallet/board')),stagesOf(await board()),'FLOW-001 stages survive restore')}finally{await target.close()}
}
