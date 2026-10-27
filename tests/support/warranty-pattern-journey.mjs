import assert from 'node:assert/strict'
import {booking,estimate,authorise} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {termsInput,openInput} from './warranty-journey.mjs'
export async function patternFixture(h,f,w){
 const asset=await h.command('asset.create',{customerName:'Other driver',customerEmail:'quality@example.test',label:'Second vehicle',identifier:'synthetic-mallet-200'})
 let {job}=await booking(h,{asset,startAt:'2026-10-21T09:00:00Z',endAt:'2026-10-21T10:00:00Z'}),q=await authorise(h,await estimate(h,job))
 job=(await h.state()).records.job.find(j=>j.id===job.id)
 const diagnosis=await h.command('diagnosis.record',{jobId:job.id,version:job.version,complaint:'Pad squeal',measurements:[{name:'Pad thickness',value:3.2,unit:'mm'}],testMethod:'Measured with caliper'})
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1})
 await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:f.lot.id,quantity:1,reference:'synthetic-mallet-201',reason:'Second installed part from the same marked lot'})
 await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-202',evidence:'Original repair paid'})
 const terms=await h.command('warranty.terms',termsInput(invoice)),input=await openInput(h,{job},terms)
 const second=await h.command('warranty.open',{...input,failure:w.failure,startAt:new Date(Date.now()+10*3600000).toISOString(),endAt:new Date(Date.now()+11*3600000).toISOString()})
 const unrelated=await h.command('warranty.open',{...input,assetVersion:(await h.state()).records.asset.find(a=>a.id===asset.id).version,failure:'Unrelated cabin rattle',startAt:new Date(Date.now()+12*3600000).toISOString(),endAt:new Date(Date.now()+13*3600000).toISOString()})
 return {second,unrelated,diagnosis}
}
export async function patternJourney(h,f,w){
 const url='/api/mallet/warranty-patterns/'+w.id,initial=await h.api(url)
 assert.equal(initial.repeat,false,'Repeated cases on one original repair do not prove a repeat cluster')
 const {second,unrelated,diagnosis}=await patternFixture(h,f,w),packet=await h.api(url)
 assert.equal(packet.repeat,true)
 assert.deepEqual(new Set(packet.members),new Set([w.id,second.id]))
 const other=packet.evidence.find(c=>c.id===second.id)
 assert.deepEqual(other.diagnoses[0].revision.measurements,[{name:'Pad thickness',value:3.2,unit:'mm'}])
 assert.equal(other.diagnoses[0].id,diagnosis.id);assert.equal(other.installed.lotId,f.lot.id);assert.equal(other.lot.supplierLot,f.lot.supplierLot)
 assert.equal(other.originalJobId,second.originalJobId);assert.equal(other.labor[0].actuals.length+other.labor[1].actuals.length,1)
 assert.equal(packet.evidence.find(c=>c.id===w.id).claims[0].status,'credited')
 assert.equal(packet.evidence.find(c=>c.id===unrelated.id).matches,false)
 const member=await h.person('pattern-tech@example.test'),agent=await h.command('agent.create',{label:'No pattern authority'}),bearer={as:'',headers:{authorization:'Bearer '+agent.token}}
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403}])await h.api(url,undefined,options)
 const before=await h.state(),review={warrantyId:w.id,version:w.version,candidateId:unrelated.id,sourceKey:packet.sourceKey,decision:'rejected',reason:'Cabin rattle is unrelated to the pad failure'}
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('warranty.patternReview',review,options)
 await h.command('warranty.patternReview',{...review,sourceKey:'old'},{status:409});assert.deepEqual((await h.state()).records,before.records)
 let reviewed=await h.command('warranty.patternReview',review)
 const result=await h.api(url)
 assert.equal(result.evidence.find(c=>c.id===unrelated.id).rejected,true);assert.equal(result.reviews.length,1);assert.equal(result.reviews[0].reason,review.reason);assert.deepEqual(result.reviews[0].sources,packet.evidence.flatMap(c=>c.sources))
 assert.deepEqual(new Set(result.members),new Set([w.id,second.id]))
 assert.deepEqual((await h.state()).records.quality,before.records.quality,'Pattern review never clears a repair')
 assert.deepEqual((await h.state()).records.diagnosis,before.records.diagnosis,'Pattern review never diagnoses a repair')
 assert.deepEqual(reviewed.claims,w.claims,'Pattern review never prepares or submits a claim')
 await h.command('warranty.patternReview',review,{status:409})
 for(const [decision,expected] of [['rejected',false],['retained',true]]){
  const current=await h.api(url)
  reviewed=await h.command('warranty.patternReview',{...review,version:reviewed.version,candidateId:second.id,sourceKey:current.sourceKey,decision,reason:'Human reviewed the supported association'})
  assert.equal((await h.api(url)).repeat,expected)
 }
 assert.deepEqual(reviewed.patternReviews.map(r=>r.decision),['rejected','rejected','retained'])

 return {w:reviewed,result}
}
