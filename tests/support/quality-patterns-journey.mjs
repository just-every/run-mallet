import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {rmaFixture} from './supplier-returns-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
import {termsInput,openInput,noChargeWork} from './warranty-journey.mjs'
export async function patternFixture(h){
 const f=await rmaFixture(h)
 const rework=(await h.state()).records.job.find(j=>j.id===f.warranty.jobId)
 const diagnosis=await h.command('diagnosis.record',{jobId:rework.id,version:rework.version,complaint:'Repeat brake noise',cause:'Technician observed separated pad bonding',correction:'Replace after customer authorization',measurements:[{name:'Pad thickness',value:4.2,unit:'mm'}]})
 await h.command('time.clockIn',{});await h.command('time.start',{jobId:rework.id,version:rework.version,category:'rework'});const labor=await h.command('time.pause',{jobId:rework.id});await h.command('time.clockOut',{})
 let rma=await h.command('stock.rmaOpen',f.input)
 rma=await h.command('stock.rmaAuthorize',{rmaId:rma.id,version:rma.version,number:'synthetic-mallet-701',label:'Supplier label',evidence:'Supplier received pad bonding evidence'})
 rma=await h.command('stock.rmaShip',{rmaId:rma.id,version:rma.version,carrier:'Synthetic carrier',tracking:'synthetic-mallet-702',evidence:'Sealed failed pad shipped'})
 await h.command('stock.rmaCredit',{rmaId:rma.id,version:rma.version,reference:'synthetic-mallet-703',amountCents:500,reason:'Partial supplier credit',evidence:'Supplier credit document'})
 const otherAsset=await h.command('asset.create',{customerName:'Second customer',customerEmail:'second@example.test',label:'Second independent vehicle',identifier:'synthetic-mallet-707'})
 let {job}=await booking(h,{asset:otherAsset,startAt:'2026-10-20T09:00:00Z',endAt:'2026-10-20T10:00:00Z',bayId:'Second original'}),q=await authorise(h,await estimate(h,job))
 job=(await h.state()).records.job.find(j=>j.id===job.id)
 for(const line of q.revisions[0].lines)job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:line.id,quantity:1})
 await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:f.secondLot.id,quantity:1,reference:'synthetic-mallet-704',reason:'Second independently repaired vehicle used same marked lot'})
 await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-705',evidence:'Original tender counted'})
 const terms=await h.command('warranty.terms',termsInput(invoice)),input=await openInput(h,{job},terms)
 let second=await h.command('warranty.open',{...input,startAt:'2026-12-01T09:00:00Z',endAt:'2026-12-01T10:00:00Z',failure:f.warranty.failure})
 second=await h.command('warranty.decide',{warrantyId:second.id,version:second.version,outcome:'covered',responsibility:'supplier',reason:'Technician evidence; saved supplier coverage decision'})
 const work=await noChargeWork(h,second)
 for(const [i,a]of work.actuals.entries())second=await h.command('warranty.cost',{warrantyId:second.id,version:second.version,actualId:a.id,amountCents:i?2400:1600,evidence:'Recorded second replacement cost'})
 const freshInput=await openInput(h,{job},terms)
 const unrelated=await h.command('warranty.open',{...freshInput,startAt:'2026-12-02T09:00:00Z',endAt:'2026-12-02T10:00:00Z',failure:'Unrelated radio reception symptom'})
 return {f,second,unrelated,rma,diagnosis,labor}
}
export async function patternJourney(h){
 const {f,second,unrelated,rma,diagnosis,labor}=await patternFixture(h),report=await h.api('/api/mallet/quality-patterns')
 assert.equal(report.clusters.length,1,'Exactly one repeat symptom cluster, never the unrelated radio symptom')
 const cluster=report.clusters[0]
 assert.deepEqual(new Set(cluster.matchingIds),new Set([f.warranty.id,second.id]));assert.deepEqual(cluster.relatedIds,[unrelated.id])
 const cited=cluster.cases.find(x=>x.warranty.id===f.warranty.id)
 assert.equal(cited.installed.id,f.use.id);assert.equal(cited.lot.serial,'synthetic-mallet-116');assert.equal(cited.rmas[0].id,rma.id);assert.equal(cited.rmas[0].shipment.tracking,'synthetic-mallet-702');assert.equal(cited.supplierCredits[0].amountCents,500)
 assert.deepEqual(cited.diagnoses[0],diagnosis);assert.deepEqual(cited.diagnoses[0].revisions[0].measurements,[{name:'Pad thickness',value:4.2,unit:'mm'}]);assert.deepEqual(cited.labor,[labor])
 assert.equal(cited.original.actuals[0].lineId,f.job.actuals[0].lineId);assert.ok(cited.measurements.length>0);assert.equal(cited.warranty.costs.reduce((n,c)=>n+c.amountCents,0),3500);assert.equal(cited.warranty.decision.responsibility,'supplier')
 const member=await h.person('pattern-technician@example.test'),admin=await h.person('pattern-advisor@example.test','admin'),manager=await h.person('pattern-manager@example.test'),agent=await h.command('agent.create',{label:'No autonomous quality decisions'}),bearer={as:'',headers:{authorization:'Bearer '+agent.token}}
 const prepare={warrantyId:f.warranty.id}
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('pattern.prepare',prepare,options)
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403}])await h.api('/api/mallet/quality-patterns',undefined,options)
 await h.command('pattern.prepare',{warrantyId:unrelated.id},{status:409})
 let packet=await h.command('pattern.prepare',prepare),refs=()=>({packetId:packet.id,version:packet.version})
 assert.deepEqual(packet.cases,cluster.cases);assert.equal(packet.approval,null)
 const approval=()=>({...refs(),reference:'synthetic-mallet-706',reason:'Manager reviewed cited failure evidence and separate warranty decisions',amountCents:7000,confirm:true})
 await h.command('pattern.approve',approval(),{status:409})
 for(const [id,outcome]of [[f.warranty.id,'include'],[second.id,'include'],[unrelated.id,'reject']])packet=await h.command('pattern.review',{...refs(),warrantyId:id,outcome,reason:outcome==='reject'?'Radio reception is unrelated to pad bonding':'Independent vehicle with the same recorded failed pad symptom'})
 assert.equal(packet.reviews.find(r=>r.warrantyId===unrelated.id).outcome,'reject');assert.equal(packet.reviews.length,3)
 await h.command('pattern.review',{...refs(),warrantyId:'synthetic-mallet-unknown',outcome:'include',reason:'Foreign case'},{status:409})
 await h.command('warranty.claim',{warrantyId:f.warranty.id,version:f.warranty.version,claimant:'Cedar Parts',reference:'synthetic-mallet-709',amountCents:3000,evidence:'Advisor cannot approve supplier claim'},{as:admin.cookie,status:403})
 await h.command('pattern.approve',approval(),{as:admin.cookie,status:403});await h.command('pattern.approve',approval(),{...bearer,status:403})
 await h.command('pattern.approve',{...approval(),amountCents:7001},{status:409});await h.command('pattern.approve',{...approval(),confirm:false},{status:409})
 const grant={operatorId:manager.id,version:0,role:'manager',location:'shop',discountBps:0,spendCents:6500,refundCents:0,costRight:true,confirm:'grant-staff',reason:'Owner delegates bounded supplier claim review'}
 await h.command('staff.grant',grant)
 await h.api('/api/mallet/quality-patterns',undefined,{as:manager.cookie})
 await h.stepUp(manager.cookie)
 await h.command('pattern.approve',approval(),{as:manager.cookie,status:403})
 await h.command('staff.grant',{...grant,version:1,spendCents:8000})
 const before=await h.state(),messages=h.messages.length
 packet=await h.command('pattern.approve',approval(),{as:manager.cookie})
 assert.equal(packet.approval.by.staffRole,'manager');assert.equal(packet.approval.amountCents,7000);assert.deepEqual(packet.approval.claims.map(c=>c.amountCents).sort(),[3000,4000]);assert.equal(packet.approval.claims.length,2)
 const after=await h.state();assert.equal(after.records.warranty.find(w=>w.id===unrelated.id).claims.length,0,'Rejected association cannot become a supplier claim')
 for(const kind of ['job','quality','diagnosis','invoice','stockRma','stockSupplierCredit'])assert.deepEqual(after.records[kind],before.records[kind],kind+' remains a separate human decision')
 await h.command('warranty.claim',{warrantyId:f.warranty.id,version:after.records.warranty.find(w=>w.id===f.warranty.id).version,claimant:'Cedar Parts',reference:'synthetic-mallet-710',amountCents:500,evidence:'RMA credit already covers these costs'},{status:409})
 assert.equal(h.messages.length,messages,'Approving records sends no supplier message');assert.match(packet.approval.label,/not submitted/)
 assert.ok(after.records.audit.some(a=>a.action==='pattern.approve'));assert.equal((await h.state(bearer)).records.qualityPattern?.length??0,0)
 await h.command('pattern.approve',approval(),{status:409});await h.command('pattern.review',{...refs(),warrantyId:unrelated.id,outcome:'include',reason:'Cannot rewrite final packet'},{status:409})
 await h.command('staff.revoke',{...grant,version:2});await h.api('/api/mallet/quality-patterns',undefined,{as:manager.cookie,status:403})
 // Current source changes invalidate a separately prepared packet, without deleting prior decisions.
 const stale=await h.command('pattern.prepare',prepare)
 await h.command('warranty.claimOutcome',{warrantyId:f.warranty.id,version:after.records.warranty.find(w=>w.id===f.warranty.id).version,claimId:packet.approval.claims.find(c=>c.warrantyId===f.warranty.id).claimId,status:'submitted',evidence:'Human submitted outside Mallet'})
 assert.equal((await h.command('pattern.review',{packetId:stale.id,version:stale.version,warrantyId:second.id,outcome:'include',reason:'Stale evidence'},{status:409})).error,'PATTERN_STALE')
 const final=await h.state(),fresh=await installation({bindings:{OWNER_EMAIL:'pattern-recovery@example.test'}})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records.qualityPattern,final.records.qualityPattern);assert.deepEqual((await fresh.api('/api/mallet/quality-patterns')).packets,(await h.api('/api/mallet/quality-patterns')).packets);await fresh.state({as:h.owner,status:401});await fresh.api('/api/mallet/quality-patterns',undefined,{as:manager.cookie,status:401})}finally{await fresh.close()}
}
