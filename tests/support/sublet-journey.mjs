import assert from 'node:assert/strict'
import {archive,authorise,booking,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
export const at=hours=>new Date(Date.now()+hours*3600000).toISOString()
export async function subletFixture(h,{person=h.person,assignedMember=false}={}){
 await shopSetup(h)
 const advisor=await person('casey-sublet@example.test','admin'),member=await person('jules-sublet@example.test'),other=await person('lee-sublet@example.test'),owner=(await h.state()).actor
 const asset=await h.command('asset.create',{customerName:'Elena Torres',customerEmail:'elena@example.test',label:'2018 Subaru Outback',identifier:'synthetic-mallet-17'})
 const {job}=await booking(h,{asset,technicianId:assignedMember?member.id:owner.id,startAt:at(1),endAt:at(3),bayId:'Sublet bay'})
 const current=async()=>(await h.state()).records.job.find(j=>j.id===job.id)
 let quote=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'fee',description:'Cylinder head resurfacing',quantity:1,unitCents:50000,feeTaxable:false},{kind:'labor',description:'Remove and refit cylinder head',quantity:2,unitCents:10000},{kind:'fee',description:'Optional specialist inspection',quantity:1,unitCents:20000,feeTaxable:true}]})
 quote=await authorise(h,quote,quote.revisions[0].lines.slice(0,2).map(l=>l.id))
 const [line,labor,declined]=quote.revisions[0].lines,ADV={as:advisor.cookie}
 const input={jobId:job.id,version:(await current()).version,estimateId:quote.id,revision:1,lineId:line.id,supplier:'Cedar Machine Shop',poReference:'synthetic-mallet-1701',item:'Cylinder head CH-17',custodian:'Morgan at shop counter',costCents:30000,eta:at(4),evidence:'Supplier quote CM-17 confirms resurfacing and expected return',reason:'Approved outside machining on this repair'}
 return {owner,advisor,member,other,asset,job,quote,line,labor,declined,current,ADV,input}
}
export async function subletJourney(h){
 const f=await subletFixture(h,{assignedMember:true}),{owner,advisor,member,other,job,quote,line,labor,declined,current,ADV,input}=f
 const key=await h.command('agent.create',{label:'Sublet boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 // Existing quality clearance must stop applying when outsourced scope/custody changes.
 await qualityReady(h,await current(),{technician:member,reviewer:advisor})
 const before=(await h.state()).records
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('sublet.record',input,options)
 for(const change of [{lineId:declined.id},{lineId:labor.id},{revision:2},{version:input.version+1},{estimateId:'synthetic-mallet-unknown'}])await h.command('sublet.record',{...input,...change},{status:409})
 for(const change of [{costCents:-1},{eta:'tomorrow'},{evidence:''},{poReference:''}])await h.command('sublet.record',{...input,...change},{status:400})
 assert.deepEqual((await h.state()).records,before,'SUBLET-001 refused authority, consent, stale and malformed commands write nothing')
 const mailBefore=h.messages.length
 let sublet=await h.command('sublet.record',input,ADV),original=structuredClone(sublet)
 const refs=async()=>({jobId:job.id,version:(await current()).version,subletId:sublet.id,subletVersion:sublet.version})
 assert.equal(sublet.supplier,input.supplier);assert.equal(sublet.poReference,input.poReference);assert.deepEqual(sublet.scopes[0].charge,line);assert.deepEqual(sublet.scopes[0].customerDecision,quote.authorisation);assert.equal(sublet.scopes[0].approval.by.id,owner.id);assert.equal(sublet.scopes[0].by.id,advisor.id)
 assert.equal(sublet.scopes[0].costCents,30000);assert.equal(sublet.etaHistory[0].eta,input.eta);assert.equal(sublet.custody[0].custodian,input.custodian)
 await h.command('sublet.record',input,{status:409})
 const work={jobId:job.id,version:(await current()).version,estimateId:quote.id,revision:1,lineId:line.id,quantity:1}
 await h.command('work.record',work,{status:409})
 await h.command('estimate.prepare',{jobId:job.id,version:(await current()).version,supplement:true,reason:'Cannot revoke dispatched supplier scope',lines:[{kind:'fee',description:'Prospective replacement',quantity:1,unitCents:60000,feeTaxable:false,replaces:{estimateId:quote.id,revision:1,lineId:line.id}}]},{status:409})
 let quality=(await h.state()).records.quality.find(q=>q.jobId===job.id)
 const denied=await h.command('quality.signTechnician',{jobId:job.id,version:(await current()).version,qualityVersion:quality.version,qualification:'Unassigned technician',note:'Cannot inspect another repair’s outside custody'},{as:other.cookie,status:403})
 assert.equal(denied.error,'FORBIDDEN');assert.equal(denied.details,null,'SUBLET-001 another technician receives no outside-custody identifiers')
 await h.command('quality.signQuality',{jobId:job.id,version:(await current()).version,qualityVersion:quality.version,qualification:'Independent reviewer',note:'Not physically returned',safetyDecision:'safe'},{...ADV,status:409})
 await h.command('sublet.receive',{...await refs(),observedAt:at(-1),custodian:'Morgan',handedBy:'Carrier',reference:'Cannot receive before sending'},{status:409})
 await h.command('sublet.bill',{...await refs(),billReference:'CM-17',costCents:31000,evidence:'Invoice copy',reason:'Cannot bill before dispatch'},{status:409})
 const send={...await refs(),observedAt:at(-2),handedTo:'Pat at Cedar Machine Shop',reference:'Dispatch slip CH-17 signed by carrier'}
 await h.command('sublet.send',{...send,observedAt:at(1)},{status:400})
 sublet=await h.command('sublet.send',send,ADV)
 assert.equal(sublet.custody.at(-1).custodian,input.supplier);assert.equal(sublet.custody.at(-1).handedTo,send.handedTo);assert.equal(sublet.custody.at(-1).observedAt,send.observedAt)
 await h.command('sublet.send',{...send,...await refs()},{status:409})
 const delay={eta:at(24),evidence:'Pat called: machine queue delayed by one day',reason:'Revised outside return after supplier delay'}
 sublet=await h.command('sublet.delay',{...await refs(),...delay},ADV)
 assert.deepEqual(sublet.etaHistory[0],original.etaHistory[0]);assert.equal(sublet.etaHistory[1].eta,delay.eta);assert.equal(sublet.receipt,null)
 assert.ok((await h.api('/api/mallet/board')).stages.flatMap(x=>x.cards).find(x=>x.jobId===job.id).blockers.some(x=>x.includes('Outside custody: Cylinder head CH-17 at Cedar Machine Shop')))
 const bill={billReference:'CM-INVOICE-17',costCents:31000,evidence:'Supplier invoice CM-INVOICE-17 retained at the counter',reason:'Supplier actual cost includes handling'}
 sublet=await h.command('sublet.bill',{...await refs(),...bill},ADV)
 assert.equal(sublet.bills[0].reference,bill.billReference);assert.equal(sublet.bills[0].costCents,31000);assert.equal(sublet.bills[0].scopeCount,1)
 await h.command('sublet.bill',{...await refs(),...bill},{status:409})
 let supplement=await h.command('estimate.prepare',{jobId:job.id,version:(await current()).version,supplement:true,reason:'Pressure test found a valve-seat issue',lines:[{kind:'fee',description:'Added valve-seat machining',quantity:1,unitCents:10000,feeTaxable:true}]})
 const extra=supplement.revisions[0].lines[0],addition={estimateId:supplement.id,revision:1,lineId:extra.id,costCents:7000,reason:'Customer separately authorized valve-seat repair'}
 await h.command('sublet.addScope',{...await refs(),...addition},{status:409})
 supplement=await authorise(h,supplement)
 const beforeAdd=structuredClone(sublet)
 sublet=await h.command('sublet.addScope',{...await refs(),...addition},ADV)
 assert.deepEqual(sublet.scopes[0],original.scopes[0]);assert.equal(sublet.scopes.length,2);assert.deepEqual(sublet.scopes[1].customerDecision,supplement.authorisation);assert.deepEqual(sublet.bills,beforeAdd.bills)
 let page=await (await h.request('/app/jobs/'+job.id)).text()
 assert.ok(page.includes('Pending bill for current scope'),'SUBLET-001 an earlier supplier bill does not prove the cost of new scope')
 sublet=await h.command('sublet.bill',{...await refs(),...bill,costCents:39000,reason:'Revised supplier invoice includes separately approved valve-seat work'},ADV)
 assert.deepEqual(sublet.bills[0],beforeAdd.bills[0]);assert.equal(sublet.bills[1].scopeCount,2);assert.equal(sublet.bills[1].costCents,39000)
 await h.command('sublet.delay',{...await refs(),...delay,subletVersion:1},{status:409})
 const foreign=(await booking(h,{startAt:at(5),endAt:at(6),bayId:'Other sublet bay'})).job
 await h.command('sublet.delay',{...await refs(),...delay,jobId:foreign.id,version:foreign.version},{status:409})
 await h.command('work.record',{jobId:job.id,version:(await current()).version,estimateId:quote.id,revision:1,lineId:labor.id,quantity:2})
 await h.command('job.complete',{jobId:job.id,version:(await current()).version},{status:409})
 await h.command('flow.close',{jobId:job.id,version:(await current()).version,outcome:'lost',reason:'Cannot abandon outside custody'},{status:409})
 await h.command('flow.collect',{jobId:job.id,version:(await current()).version,flowVersion:0,collectorName:'Elena Torres'},{status:409})
 await h.command('invoice.prepare',{jobId:job.id,version:(await current()).version},{status:409})
 for(const command of ['sublet.send','sublet.delay','sublet.bill','sublet.receive','sublet.addScope'])for(const options of [{as:member.cookie,status:403},{...agent,status:403}])await h.command(command,{...await refs(),...delay,...bill,...addition},options)
 // Recovery while the item is outside must retain the gates and fresh identity, not just final totals.
 const outside=(await h.state()).records,backupOutside=await archive(h),recovered=await installation({bindings:{OWNER_EMAIL:'recovered-sublet@example.test'}})
 try{
  await restore(recovered,backupOutside);assert.deepEqual((await recovered.state()).records,outside)
  await recovered.command('job.complete',{jobId:job.id,version:(await current()).version},{status:409})
  assert.notEqual((await recovered.state()).actor.id,owner.id)
  await recovered.state({as:h.owner,status:401});await recovered.state({...agent,status:401})
  const freshCurrent=async()=>(await recovered.state()).records.job.find(j=>j.id===job.id)
  let rq=(await recovered.state()).records.quality.find(q=>q.jobId===job.id)
  await recovered.command('quality.takeover',{jobId:job.id,version:(await freshCurrent()).version,qualityVersion:rq.version,reason:'Fresh owner resumes the archived outside repair under native authority'})
  await recovered.command('sublet.receive',{jobId:job.id,version:(await freshCurrent()).version,subletId:sublet.id,subletVersion:sublet.version,observedAt:at(-.1),custodian:'Fresh shop owner',handedBy:'Cedar courier',reference:'Recovered shop receiving receipt'})
  for(const [q,l] of [[quote,line],[supplement,extra]])await recovered.command('work.record',{jobId:job.id,version:(await freshCurrent()).version,estimateId:q.id,revision:1,lineId:l.id,quantity:1})
  await qualityReady(recovered,await freshCurrent())
  const finished=await recovered.command('job.complete',{jobId:job.id,version:(await freshCurrent()).version})
  const recoveredInvoice=await recovered.command('invoice.prepare',{jobId:job.id,version:finished.version})
  assert.equal(recoveredInvoice.sublets[0].reconciliation.billCents,39000)
  assert.equal(recoveredInvoice.sublets[0].reconciliation.marginCents,21000)
  assert.equal(recoveredInvoice.preparedBy.id,(await recovered.state()).actor.id)
  const recoveredBeforeRefusedRestore=(await recovered.state()).records
  await restore(recovered,backupOutside,{status:409})
  assert.deepEqual((await recovered.state()).records,recoveredBeforeRefusedRestore)
 }finally{await recovered.close()}
 const receipt={observedAt:at(-.25),custodian:'Morgan at receiving bench',handedBy:'Pat via Cedar courier',reference:'Signed return CH-17; cylinder head and both approved machining operations received'}
 for(const change of [{observedAt:at(1)},{observedAt:at(-3)}])await h.command('sublet.receive',{...await refs(),...receipt,...change},{status:400})
 sublet=await h.command('sublet.receive',{...await refs(),...receipt},ADV)
 assert.equal(sublet.custody.length,3);assert.equal(sublet.receipt.scopeCount,2);assert.equal(sublet.receipt.observedAt,receipt.observedAt);assert.equal(sublet.receipt.by.id,advisor.id);assert.equal(sublet.custody.at(-1).custodian,receipt.custodian)
 const received=structuredClone(sublet)
 for(const command of ['sublet.receive','sublet.send','sublet.delay','sublet.addScope'])await h.command(command,{...await refs(),...receipt,...delay,...addition},{status:409})
 assert.deepEqual((await h.state()).records.sublet.find(x=>x.id===sublet.id),received,'SUBLET-001 custody and authorized scope remain immutable after receipt')
 await h.command('job.complete',{jobId:job.id,version:(await current()).version},{status:409})
 await h.command('work.record',{...work,version:(await current()).version},{as:member.cookie})
 await h.command('work.record',{jobId:job.id,version:(await current()).version,estimateId:supplement.id,revision:1,lineId:extra.id,quantity:1})
 await h.command('job.complete',{jobId:job.id,version:(await current()).version},{status:409})
 quality=await qualityReady(h,await current(),{technician:member,reviewer:advisor})
 // Even a changed cost receipt invalidates quality's exact sublet snapshot.
 sublet=await h.command('sublet.bill',{...await refs(),...bill,costCents:40000,reason:'Supplier final freight correction retained for this scope'},ADV)
 await h.command('job.complete',{jobId:job.id,version:(await current()).version},{status:409})
 quality=await qualityReady(h,await current(),{technician:member,reviewer:advisor})
 const technicianPage=await (await h.request('/app/jobs/'+job.id,{as:member.cookie})).text()
 assert.ok(technicianPage.includes('Current checks and both signatures clear this repair for handover.'),'SUBLET-001 assigned technician sees the same current sublet-bound quality clearance')
 const complete=await h.command('job.complete',{jobId:job.id,version:(await current()).version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:complete.version})
 const billed=invoice.lines.filter(x=>[line.id,extra.id].includes(x.id))
 assert.equal(billed.length,2);assert.deepEqual(billed.map(x=>x.subtotalCents),[50000,10000]);assert.deepEqual(billed.map(x=>x.salesTaxCents),[0,750]);assert.equal(invoice.totals.totalCents,80750)
 assert.deepEqual(invoice.sublets[0].reconciliation,{customerCents:60000,salesTaxCents:750,totalCents:60750,quotedCostCents:37000,billCents:40000,marginCents:20000,marginPercent:33.33})
 assert.deepEqual(invoice.sublets[0].receipt,sublet.receipt);assert.deepEqual(invoice.sublets[0].bills,sublet.bills)
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),repeat=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 assert.deepEqual(repeat,exported);assert.equal(exported.lines.filter(l=>l.id===line.id).length,1);assert.equal(exported.lines.filter(l=>l.id===extra.id).length,1)
 await h.command('flow.collect',{jobId:job.id,version:(await current()).version,flowVersion:0,collectorName:'Elena Torres',note:'Staff recorded pickup after sublet return and repair quality clearance'})
 await h.command('sublet.bill',{...await refs(),...bill},{status:409})
 page=await (await h.request('/app/jobs/'+job.id)).text()
 for(const text of ['Cylinder head CH-17','CM-INVOICE-17',delay.evidence,receipt.reference,'$200.00','33.33%','Current repair quality clearance recorded'])assert.ok(page.includes(text),'SUBLET-001 public repair page retains '+text)
 for(const options of [{as:member.cookie},{as:other.cookie},agent]){
  const state=await h.state(options);assert.equal(state.records.sublet,undefined);assert.ok(!state.records.event?.some(e=>e.kind.startsWith('sublet.')))
 }
 assert.equal(h.messages.length,mailBefore,'SUBLET-001 staff evidence does not place orders or message suppliers')
 const final=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'fresh-final-sublet@example.test'}})
 try{
  await restore(fresh,backup);assert.deepEqual((await fresh.state()).records,final,'SUBLET-001 / OPS-001 every scope, custody handoff, cost/bill revision, quality signature and saved invoice restores exactly')
  assert.equal(await (await fresh.request('/api/mallet/exports/'+exported.id)).text(),await (await h.request('/api/mallet/exports/'+exported.id)).text())
  assert.notEqual((await fresh.state()).actor.id,owner.id)
 }finally{await fresh.close()}
}
