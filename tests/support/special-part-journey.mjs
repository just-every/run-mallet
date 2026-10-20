import assert from 'node:assert/strict'
import {archive,authorise,booking,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {qualityReady} from './quality-ready.mjs'

const at=hours=>new Date(Date.now()+hours*3_600_000).toISOString()
const records=async(h,kind)=>(await h.state()).records[kind]??[]
const card=(board,id)=>board.stages.flatMap(s=>s.cards.map(c=>({...c,stage:s.id}))).find(c=>c.jobId===id)

export async function specialPartFixture(h,{person=h.person,partialStock=false}={}){
 await shopSetup(h)
 const advisor=await person('casey-special-parts@example.test','admin'),member=await person('jules-special-parts@example.test'),other=await person('lee-special-parts@example.test')
 const owner=(await h.state()).actor,asset=await h.command('asset.create',{customerName:'Elena Torres',customerEmail:'elena.torres@example.test',label:'2018 Subaru Outback 2.5i',identifier:'OH SP 6412'})
 const {job}=await booking(h,{asset,technicianId:owner.id,startAt:at(1),endAt:at(3),bayId:'Special order bay'})
 let quote=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Rear wheel bearing assembly',quantity:2,unitCents:12500},{kind:'labor',description:'Replace rear wheel bearings and road test',quantity:1.5,unitCents:12000},{kind:'part',description:'Optional rear brake shields',quantity:2,unitCents:5000}]})
 quote=await authorise(h,quote,quote.revisions[0].lines.slice(0,2).map(l=>l.id))
 const [line,labor,declined]=quote.revisions[0].lines,current=async()=>(await records(h,'job')).find(j=>j.id===job.id)
 if(partialStock)await h.command('work.record',{jobId:job.id,version:(await current()).version,estimateId:quote.id,revision:1,lineId:line.id,quantity:.5,note:'Existing stock issued before the supplier special order'})
 return {owner,advisor,member,other,asset,job,quote,line,labor,declined,current,ADV:{as:advisor.cookie}}
}

// PART-006: one approved RO charge retains supplier evidence, internal advisor
// changes and physical receiving separately, through invoicing and recovery.
export async function specialPartJourney(h){
 const f=await specialPartFixture(h,{partialStock:true}),{owner,advisor,member,other,job,quote,line,labor,declined,current,ADV}=f
 const foreign=(await booking(h,{startAt:at(5),endAt:at(6),bayId:'Other repair bay'})).job
 const foreignQuote=await authorise(h,await h.command('estimate.prepare',{jobId:foreign.id,version:foreign.version,lines:[{kind:'part',description:'Other repair alternator',quantity:1,unitCents:31000}]}))
 const key=await h.command('agent.create',{label:'Special part authority boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 const input={jobId:job.id,version:(await current()).version,estimateId:quote.id,revision:1,lineId:line.id,supplier:'Great Lakes Subaru Parts',orderReference:'GL-PO-6412',acknowledgment:'Morgan at supplier acknowledged GL-PO-6412 by email; retained in RO custody',eta:at(-2),reason:'Only half a bearing assembly was in stock; supplier backorder covers the remaining authorized quantity'}
 const beforeRefusals=(await h.state()).records
 for(const options of [{as:member.cookie,status:403},{...agent,status:403},{as:'',status:401}])await h.command('specialPart.record',input,options)
 for(const change of [{lineId:declined.id},{lineId:labor.id},{lineId:'unknown-line'},{estimateId:foreignQuote.id,lineId:foreignQuote.revisions[0].lines[0].id},{revision:2},{version:input.version+1}])await h.command('specialPart.record',{...input,...change},{status:409})
 await h.command('specialPart.record',{...input,acknowledgment:''},{status:400})
 await h.command('specialPart.record',{...input,eta:'2026-10-21T10:00:00'},{status:400})
 assert.deepEqual((await h.state()).records,beforeRefusals,'PART-006 unauthorized, wrong-kind, declined, foreign, stale and incomplete orders write nothing')
 const mailBefore=h.messages.length,actualsBefore=(await current()).actuals
 let part=await h.command('specialPart.record',input,ADV)
 assert.equal(part.jobId,job.id);assert.equal(part.estimateId,quote.id);assert.equal(part.revision,1);assert.equal(part.lineId,line.id)
 assert.deepEqual(part.charge,{description:line.description,quantityMilli:1500,quantity:1.5,unitCents:line.unitCents,taxable:true,taxRateMillionths:75000,subtotalCents:18750,salesTaxCents:1406,totalCents:20156})
 assert.equal(part.supplier,input.supplier);assert.equal(part.orderReference,input.orderReference);assert.equal(part.receipt,null)
 assert.equal(part.revisions[0].eta,input.eta);assert.equal(part.revisions[0].acknowledgment,input.acknowledgment);assert.equal(part.revisions[0].by.id,advisor.id);assert.ok(part.revisions[0].at)
 assert.deepEqual((await current()).actuals,actualsBefore,'PART-006 ordering never records consumed parts or charges twice')
 const firstPart=structuredClone(part),plan=async()=>(await records(h,'promisePlan')).find(p=>p.jobId===job.id),linked=async()=>(await plan()).revisions.at(-1).parts.find(p=>p.specialPartId===part.id)
 let projected=await linked()
 assert.equal(projected.partId,'special:'+part.id);assert.equal(projected.eta,input.eta);assert.equal(projected.receivedAt,null)
 assert.equal(projected.source,'staff-recorded supplier acknowledgment; not provider-verified');assert.ok(projected.sourceNote.includes(input.acknowledgment))
 let board=await h.api('/api/mallet/board')
 assert.equal(card(board,job.id).stage,'parts','PART-006 an elapsed supplier ETA leaves the repair waiting for parts')
 assert.ok(card(board,job.id).blockers.some(b=>b.includes(line.description)))
 const workInput={jobId:job.id,version:(await current()).version,estimateId:quote.id,revision:1,lineId:line.id,quantity:1.5}
 await h.command('work.record',workInput,{status:409})
 await h.command('invoice.prepare',{jobId:job.id,version:(await current()).version},{status:409})
 await h.command('specialPart.record',{...input,version:(await current()).version},{status:409})
 await h.command('promise.partETA',{jobId:job.id,version:(await current()).version,planVersion:(await plan()).version,partId:'special:'+part.id,name:line.description,eta:at(1),receivedAt:at(-1),sourceNote:'Attempt to bypass receiving',reason:'Forged arrival'},{status:409})
 assert.equal((await linked()).receivedAt,null,'PART-006 legacy ETA entry cannot fabricate special-order arrival')
 const original=await h.command('promise.set',{jobId:job.id,version:(await current()).version,pickupAt:at(4),reason:'Original customer pickup agreed at intake'},ADV)
 const proposal=await h.command('promise.propose',{jobId:job.id,version:(await current()).version,promiseVersion:original.version,planVersion:(await plan()).version,pickupAt:at(8),reason:'Advisor reviewed supplier backorder and authorized labor'},ADV)
 const refs=async()=>({jobId:job.id,version:(await current()).version,specialPartId:part.id,partVersion:part.version})
 const delay={eta:at(10),acknowledgment:'Supplier email GL-PO-6412: truck delayed until the next distribution run',reason:'Supplier revised the promised dispatch after advisor review'}
 for(const command of ['specialPart.delay','specialPart.receive'])for(const options of [{as:member.cookie,status:403},{...agent,status:403}])await h.command(command,{...await refs(),...delay,receivedAt:at(-1),receiptReference:'Not authorized'},options)
 await h.command('specialPart.delay',{...await refs(),...delay,eta:part.revisions[0].eta},{status:409})
 await h.command('specialPart.delay',{...await refs(),...delay,partVersion:part.version+1},{status:409})
 await h.command('specialPart.delay',{...await refs(),...delay,jobId:foreign.id,version:(await records(h,'job')).find(j=>j.id===foreign.id).version},{status:409})
 part=await h.command('specialPart.delay',{...await refs(),...delay})
 assert.deepEqual(part.revisions[0],firstPart.revisions[0]);assert.equal(part.revisions.length,2);assert.equal(part.revisions[1].eta,delay.eta);assert.equal(part.revisions[1].acknowledgment,delay.acknowledgment);assert.equal(part.receipt,null)
 assert.equal((await linked()).eta,delay.eta);assert.equal((await linked()).receivedAt,null)
 await h.command('promise.approveAndNotify',{proposalId:proposal.id,proposalVersion:proposal.version},{...ADV,status:409})
 assert.equal(h.messages.length,mailBefore,'PART-006 supplier changes are internal and invalidate the old customer-notice review before any send')
 assert.equal((await records(h,'promiseNotice')).length,0)
 let notices=(await records(h,'specialPartNotice')).filter(n=>n.specialPartId===part.id)
 assert.deepEqual(notices.map(n=>n.kind).sort(),['backorder','delay']);assert.ok(notices.every(n=>n.review===null&&n.jobId===job.id&&n.at&&n.by.id))
 assert.ok(notices.some(n=>n.kind==='delay'&&n.revision===2))
 const notice=notices.find(n=>n.kind==='delay'),review={noticeId:notice.id,version:notice.version,reason:'Advisor called the counter team; pickup needs a fresh reviewed proposal'}
 for(const options of [{as:member.cookie,status:403},{...agent,status:403}])await h.command('specialPart.review',review,options)
 await h.command('specialPart.review',{...review,version:notice.version+1},{status:409})
 const reviewed=await h.command('specialPart.review',review,ADV)
 assert.equal(reviewed.review.by.id,advisor.id);assert.equal(reviewed.review.reason,review.reason);assert.ok(reviewed.review.at)
 await h.command('specialPart.review',review,{...ADV,status:409})
 await h.command('specialPart.review',{...review,version:reviewed.version},{...ADV,status:409})
 const receiptInput={...await refs(),receivedAt:at(-.25),receiptReference:'Receiving slip GL-6412; counted and matched to this RO'}
 await h.command('specialPart.receive',{...receiptInput,receivedAt:at(1)},{status:400})
 await h.command('specialPart.receive',{...receiptInput,partVersion:firstPart.version},{status:409})
 await h.command('specialPart.receive',{...receiptInput,version:(await current()).version+1},{status:409})
 await h.command('specialPart.receive',{...receiptInput,jobId:foreign.id,version:(await records(h,'job')).find(j=>j.id===foreign.id).version},{status:409})
 const actualsAtReceipt=(await current()).actuals
 part=await h.command('specialPart.receive',receiptInput,ADV)
 assert.deepEqual(part.revisions.slice(0,1),firstPart.revisions);assert.equal(part.receipt.receivedAt,receiptInput.receivedAt);assert.equal(part.receipt.reference,receiptInput.receiptReference);assert.equal(part.receipt.quantityMilli,1500);assert.equal(part.receipt.by.id,advisor.id);assert.ok(part.receipt.at)
 assert.deepEqual((await current()).actuals,actualsAtReceipt,'PART-006 physical receipt supplies availability without inventing billable consumption')
 assert.equal((await linked()).receivedAt,receiptInput.receivedAt)
 board=await h.api('/api/mallet/board');assert.equal(card(board,job.id).stage,'work');assert.ok(!card(board,job.id).blockers.some(b=>b.includes('Waiting for '+line.description)))
 notices=(await records(h,'specialPartNotice')).filter(n=>n.specialPartId===part.id)
 assert.deepEqual(notices.map(n=>n.kind).sort(),['backorder','delay','received'])
 for(const command of ['specialPart.receive','specialPart.delay'])await h.command(command,{...await refs(),...delay,...receiptInput,partVersion:part.version},{status:409})
 assert.deepEqual((await records(h,'specialPart')).find(p=>p.id===part.id),part,'PART-006 physical receipt and supplier history cannot be silently reopened')
 const memberState=await h.state({as:other.cookie}),agentState=await h.state(agent)
 for(const kind of ['specialPart','specialPartNotice']){assert.ok(!(memberState.records[kind]??[]).some(r=>r.jobId===job.id));assert.equal(agentState.records[kind],undefined)}
 const page=await (await h.request('/app/jobs/'+job.id)).text(),list=await (await h.request('/app/jobs')).text()
 for(const text of [line.description,input.orderReference,input.acknowledgment,delay.acknowledgment,receiptInput.receiptReference])assert.ok(page.includes(text),'PART-006 the RO retains '+text)
 assert.ok(list.includes(input.orderReference),'PART-006 internal advisor notices retain the supplier order reference')
 assert.equal(h.messages.length,mailBefore,'PART-006 reviewing and receiving send no external messages')
 await h.command('work.record',{...workInput,version:(await current()).version})
 await h.command('specialPart.record',{...input,version:(await current()).version},{status:409})
 await h.command('work.record',{jobId:job.id,version:(await current()).version,estimateId:quote.id,revision:1,lineId:labor.id,quantity:1.5,note:'Authorized bearing replacement and road test complete'})
 await qualityReady(h,await current(),{reviewer:advisor})
 let completed=await h.command('job.complete',{jobId:job.id,version:(await current()).version})
 for(const command of ['specialPart.record','specialPart.delay','specialPart.receive'])await h.command(command,{...input,...await refs(),...delay,receivedAt:receiptInput.receivedAt,receiptReference:'Cannot edit a finished RO'},{status:409})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:completed.version})
 const billed=invoice.lines.filter(l=>l.id===line.id)
 assert.equal(billed.length,1);assert.equal(billed[0].quantity,2);assert.equal(billed[0].unitCents,line.unitCents);assert.equal(billed[0].totalCents,line.totalCents);assert.equal(billed[0].sourceEstimateId,quote.id);assert.equal(billed[0].sourceRevision,1)
 assert.equal(invoice.lines.length,2);assert.equal(invoice.totals.totalCents,44875);assert.deepEqual(invoice.customerAuthorisation,quote.authorisation)
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
 const saved=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),repeated=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 assert.deepEqual(repeated,saved);assert.equal((await records(h,'export')).filter(e=>e.invoiceId===invoice.id).length,1)
 const response=await h.request('/api/mallet/exports/'+saved.id);assert.equal(response.status,200);const bytes=await response.text()
 assert.equal(bytes.split('\n').filter(l=>l.includes(line.description)).length,1,'PART-006 saved invoice exports the approved part exactly once')
 const state=await h.state(),backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'recovered-special-parts@example.test'}})
 try{
  const freshOwner=(await fresh.state()).actor;assert.notEqual(freshOwner.id,owner.id)
  await restore(fresh,backup)
  const restored=await fresh.state()
  assert.deepEqual(restored.records,state.records,'PART-006 all special orders, exact charges, evidence revisions, receipts, internal decisions and saved invoice survive native recovery')
  assert.equal(restored.actor.id,freshOwner.id);assert.equal(await (await fresh.request('/api/mallet/exports/'+saved.id)).text(),bytes)
  await fresh.state({as:h.owner,status:401});await fresh.state({...agent,status:401})
 }finally{await fresh.close()}
}
