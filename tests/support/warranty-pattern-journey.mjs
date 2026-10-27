import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {termsInput,openInput} from './warranty-journey.mjs'
export async function patternFixture(h,f,w,{lot=f.lot,index=0}={}){
 const asset=await h.command('asset.create',{customerName:'Other driver',customerEmail:'quality@example.test',label:'Second vehicle',identifier:'synthetic-mallet-'+(200+index)})
 let {job}=await booking(h,{asset,startAt:`2026-10-${21+index}T09:00:00Z`,endAt:`2026-10-${21+index}T10:00:00Z`}),q=await authorise(h,await estimate(h,job))
 job=(await h.state()).records.job.find(j=>j.id===job.id)
 const diagnosis=await h.command('diagnosis.record',{jobId:job.id,version:job.version,complaint:'Pad squeal',measurements:[{name:'Pad thickness',value:3.2,unit:'mm'}],testMethod:'Measured with caliper'})
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1})
 await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:lot.id,quantity:1,reference:'synthetic-mallet-'+(210+index),reason:'Second installed part from the same marked lot'})
 await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-'+(220+index),evidence:'Original repair paid'})
 const terms=await h.command('warranty.terms',termsInput(invoice)),input=await openInput(h,{job},terms)
 const second=await h.command('warranty.open',{...input,failure:'  '+w.failure.toUpperCase().replaceAll(' ','   ')+'  ',startAt:new Date(Date.now()+(10+index*4)*3600000).toISOString(),endAt:new Date(Date.now()+(11+index*4)*3600000).toISOString()})
 const unrelated=await h.command('warranty.open',{...input,assetVersion:(await h.state()).records.asset.find(a=>a.id===asset.id).version,failure:'Unrelated cabin rattle',startAt:new Date(Date.now()+(12+index*4)*3600000).toISOString(),endAt:new Date(Date.now()+(13+index*4)*3600000).toISOString()})
 return {second,unrelated,diagnosis}
}
export async function patternJourney(h,f,w){
 const url='/api/mallet/warranty-patterns/'+w.id,initial=await h.api(url)
 assert.equal(initial.repeat,false,'Repeated cases on one original repair do not prove a repeat cluster')
 const {second,unrelated,diagnosis}=await patternFixture(h,f,w)
 const excluded=[]
 for(const [index,changes]of [{itemBarcode:f.fixture.replacement.barcode},{supplier:'Other supplier'},{supplierLot:'synthetic-mallet-other-lot'}].entries()){
  const lot=await h.command('stock.lot',{...f.fixture.lot,...changes,reference:'synthetic-mallet-partition-'+index})
  excluded.push((await patternFixture(h,f,w,{lot,index:index+1})).second.id)
 }
 const packet=await h.api(url)
 assert.ok(excluded.every(id=>!packet.evidence.some(c=>c.id===id)),'Other catalog items, suppliers and marked lots are excluded independently')
 assert.equal(packet.repeat,true)
 assert.deepEqual(new Set(packet.members),new Set([w.id,second.id]))
 const other=packet.evidence.find(c=>c.id===second.id)
 assert.deepEqual(other.diagnoses[0].revision.measurements,[{name:'Pad thickness',value:3.2,unit:'mm'}])
 assert.equal(other.diagnoses[0].id,diagnosis.id);assert.equal(other.installed.lotId,f.lot.id);assert.equal(other.lot.supplierLot,f.lot.supplierLot)
 assert.equal(other.originalJobId,second.originalJobId);assert.equal(other.labor[0].actuals.length+other.labor[1].actuals.length,1)
 const anchor=packet.evidence.find(c=>c.id===w.id)
 assert.equal(anchor.claims[0].status,'credited')
 assert.deepEqual(anchor.labor.map(j=>j.actuals.map(a=>a.quantity)),[[1,1],[1,1]],'Exact original and rework quantities are cited')
 assert.ok(anchor.decision,'Packet includes its cited warranty decision')
 assert.deepEqual([anchor.decision.outcome,anchor.decision.responsibility,anchor.decision.noChargeLabor],['covered','supplier',true],'Exact human coverage decision is cited')
 assert.deepEqual(anchor.decision,w.decision)
 const citationSchema=sources=>{assert.ok(sources.length>0);for(const source of sources){assert.deepEqual(Object.keys(source).sort(),['id','kind','version']);assert.equal(typeof source.id,'string');assert.ok(Number.isInteger(source.version)&&source.version>0)}}
 packet.evidence.forEach(c=>citationSchema(c.sources))
 assert.ok(other.sources.some(s=>s.kind==='diagnosis'&&s.id===diagnosis.id&&s.version===1),'Citation names the independently created diagnostic revision')
 assert.equal(packet.evidence.find(c=>c.id===unrelated.id).matches,false)
 const member=await h.person('pattern-tech@example.test'),agent=await h.command('agent.create',{label:'No pattern authority'}),bearer={as:'',headers:{authorization:'Bearer '+agent.token}}
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403}])await h.api(url,undefined,options)
 const admin=await h.person('pattern-admin@example.test','admin')
 assert.deepEqual(await h.api(url,undefined,{as:admin.cookie}),packet,'Admin can inspect the complete packet')
 const reviewMessages=h.messages.length
 const before=await h.state(),review={warrantyId:w.id,version:w.version,candidateId:unrelated.id,sourceKey:packet.sourceKey,decision:'rejected',reason:'Cabin rattle is unrelated to the pad failure'}
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('warranty.patternReview',review,options)
 await h.command('warranty.patternReview',{...review,sourceKey:'old'},{status:409});assert.deepEqual((await h.state()).records,before.records)
 await h.command('warranty.patternReview',{...review,reason:'   '},{status:400})
 assert.deepEqual((await h.state()).records,before.records,'Reasonless review leaves all decisions unchanged')
 let reviewed=await h.command('warranty.patternReview',review,{as:admin.cookie})
 const result=await h.api(url)
 assert.equal(result.evidence.find(c=>c.id===unrelated.id).rejected,true);assert.equal(result.reviews.length,1);assert.equal(result.reviews[0].reason,review.reason);assert.deepEqual(result.reviews[0].sources,packet.evidence.flatMap(c=>c.sources))
 assert.deepEqual(new Set(result.members),new Set([w.id,second.id]))
 assert.deepEqual((await h.state()).records.quality,before.records.quality,'Pattern review never clears a repair')
 assert.deepEqual((await h.state()).records.diagnosis,before.records.diagnosis,'Pattern review never diagnoses a repair')
 assert.deepEqual(reviewed.claims,w.claims,'Pattern review never prepares or submits a claim')
 assert.equal(h.messages.length,reviewMessages,'Pattern review causes no outbound mail')
 assert.deepEqual(reviewed.decision,w.decision,'Review preserves the human coverage decision')
 citationSchema(reviewed.patternReviews[0].sources)
 const audit=(await h.api('/api/mallet/audit?action=warranty.patternReview')).entries
 assert.equal(audit.length,1);assert.equal(audit[0].actor.id,admin.id)
 assert.deepEqual(audit[0].changes.filter(c=>c.kind==='warranty'),[{kind:'warranty',id:w.id,beforeRevision:w.version,afterRevision:reviewed.version}])
 for(const kind of ['invoice','export','payment','stockSupplierCredit'])assert.deepEqual((await h.state()).records[kind],before.records[kind],'Review makes no financial posting: '+kind)
 await h.command('warranty.patternReview',review,{status:409})
 for(const [decision,expected] of [['rejected',false],['retained',true]]){
  const current=await h.api(url)
  reviewed=await h.command('warranty.patternReview',{...review,version:reviewed.version,candidateId:second.id,sourceKey:current.sourceKey,decision,reason:'Human reviewed the supported association'})
  assert.equal((await h.api(url)).repeat,expected)
 }
 assert.deepEqual(reviewed.patternReviews.map(r=>r.decision),['rejected','rejected','retained'])

 // A valid captured packet must become stale when a cited diagnosis revision changes.
 const reworkJob=(await h.state()).records.job.find(j=>j.id===second.jobId)
 const diagnosticInput={jobId:reworkJob.id,version:reworkJob.version,complaint:'Technician rechecked the returned squeal',measurements:[{name:'Pad thickness',value:3.1,unit:'mm'}],testMethod:'Independent caliper recheck'}
 const mutableDiagnosis=await h.command('diagnosis.record',diagnosticInput)
 const captured=await h.api(url)
 const d=await h.command('diagnosis.record',{...diagnosticInput,diagnosisId:mutableDiagnosis.id,diagnosisVersion:mutableDiagnosis.version,measurements:[{name:'Pad thickness',value:3,unit:'mm'}]})
 const revisedSources=(await h.state()).records
 await h.command('warranty.patternReview',{...review,version:reviewed.version,sourceKey:captured.sourceKey},{status:409})
 assert.deepEqual((await h.state()).records,revisedSources,'Captured stale review makes no writes')
 const claim={warrantyId:w.id,version:reviewed.version,claimant:'Cedar Parts',reference:'synthetic-mallet-new-claim',amountCents:1,evidence:'Human reviewed cited cost',sourceKey:captured.sourceKey}
 // Use an unallocated covered case so stale evidence, rather than a cost cap, refuses approval.
 let payable=await h.command('warranty.decide',{warrantyId:second.id,version:second.version,outcome:'covered',responsibility:'supplier',reason:'Human coverage approval'})
 const {noChargeWork}=await import('./warranty-journey.mjs'),work=await noChargeWork(h,payable)
 payable=await h.command('warranty.cost',{warrantyId:payable.id,version:payable.version,actualId:work.actuals[0].id,amountCents:100,evidence:'Recorded replacement cost'})
 const claimPacket=await h.api('/api/mallet/warranty-patterns/'+payable.id)
 await h.command('diagnosis.record',{...diagnosticInput,version:(await h.state()).records.job.find(j=>j.id===reworkJob.id).version,diagnosisId:d.id,diagnosisVersion:d.version,measurements:[{name:'Pad thickness',value:2.9,unit:'mm'}]})
 const beforeStaleClaim=(await h.state()).records
 await h.command('warranty.claim',{...claim,warrantyId:payable.id,version:payable.version,sourceKey:claimPacket.sourceKey},{status:409})
 assert.deepEqual((await h.state()).records,beforeStaleClaim,'Captured stale claim makes no writes')
 const freshPacket=await h.api('/api/mallet/warranty-patterns/'+payable.id)
 payable=await h.command('warranty.claim',{...claim,warrantyId:payable.id,version:payable.version,sourceKey:freshPacket.sourceKey},{as:admin.cookie})
 const claimAudit=(await h.api('/api/mallet/audit?action=warranty.claim')).entries
 assert.ok(claimAudit.some(e=>e.actor.id===admin.id&&e.changes.some(c=>c.kind==='warranty'&&c.id===payable.id&&c.beforeRevision===beforeStaleClaim.warranty.find(w=>w.id===payable.id).version&&c.afterRevision===payable.version)),'Detected-cluster claim approval is audited with exact revisions')
 assert.equal(payable.claims[0].status,'prepared');assert.deepEqual(payable.claims[0].history,[]);citationSchema(payable.claims[0].patternSources)
 assert.deepEqual(new Set(payable.claims[0].patternMembers),new Set([w.id,second.id]))
 assert.match(payable.claims[0].label,/not submitted/)
 for(const kind of ['customerClaim','correctiveAction']){
  const current=await h.api(url),input={warrantyId:w.id,version:reviewed.version,sourceKey:current.sourceKey,kind,reference:'synthetic-mallet-'+kind,reason:'Manager reviewed the cited cluster and approved this action'}
  const beforeAction=(await h.state()).records,messageCount=h.messages.length
  for(const opts of [{as:member.cookie,status:403},{...bearer,status:403},{as:'',status:401},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('warranty.patternAction',input,opts)
  await h.command('warranty.patternAction',{...input,sourceKey:captured.sourceKey},{status:409})
  assert.deepEqual((await h.state()).records,beforeAction)
  reviewed=await h.command('warranty.patternAction',input,{as:admin.cookie})
  const action=reviewed.patternActions.at(-1)
  assert.ok(action,'The explicitly approved action is retained')
  assert.equal(action.kind,kind);assert.equal(action.status,'approved');assert.equal(action.by.id,admin.id);assert.equal(action.reason,input.reason)
  assert.deepEqual(new Set(action.members),new Set([w.id,second.id]));citationSchema(action.sources)
  assert.equal(h.messages.length,messageCount,'Approval causes no outbound mail')
  const afterAction=(await h.state()).records
  for(const recordKind of ['diagnosis','quality','invoice','export','payment','stockSupplierCredit'])assert.deepEqual(afterAction[recordKind],beforeAction[recordKind],'Approval does not execute or post: '+recordKind)
 }
 assert.deepEqual(reviewed.patternActions.map(a=>a.kind),['customerClaim','correctiveAction'])
 const actionAudit=(await h.api('/api/mallet/audit?action=warranty.patternAction')).entries
 assert.equal(actionAudit.length,2);assert.ok(actionAudit.every(e=>e.actor.id===admin.id&&e.changes.some(c=>c.kind==='warranty'&&c.id===w.id&&c.afterRevision===c.beforeRevision+1)))
 const financialBefore=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'pattern-erasure@example.test'}})
 try{
  await restore(fresh,backup)
  const asset=financialBefore.asset.find(a=>a.id===f.job.assetId),customerId=asset.customerAccountId,categories=['personal','import','media']
  const preview=await fresh.command('retention.preview',{customerId,categories})
  const receipt=await fresh.command('customer.erase',{customerId,categories,fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requested erasure',consentEvidence:'Recorded customer instruction synthetic-mallet-erase'})
  assert.equal(receipt.phase,'complete')
  const erased=(await fresh.state()).records,retained=erased.warranty.find(c=>c.id===w.id)
  assert.deepEqual(retained.patternReviews,reviewed.patternReviews,'Erasure retains exact authorization citations')
  assert.deepEqual(retained.patternActions,reviewed.patternActions)
  assert.deepEqual(retained.claims,reviewed.claims)
  assert.equal(erased.asset.find(a=>a.id===asset.id).customerEmail,'','Mutable customer identity is erased')
  assert.deepEqual(erased.invoice,financialBefore.invoice,'Issued financial history is retained')
  retained.patternReviews.forEach(r=>citationSchema(r.sources));retained.patternActions.forEach(a=>citationSchema(a.sources));retained.claims.forEach(c=>citationSchema(c.patternSources))
  const restoredAudit=(await fresh.api('/api/mallet/audit?action=warranty.patternReview')).entries
  assert.equal(restoredAudit.length,3);assert.ok(restoredAudit.some(e=>e.actor.id===admin.id))
 }finally{await fresh.close()}
 return {w:reviewed,result}
}
