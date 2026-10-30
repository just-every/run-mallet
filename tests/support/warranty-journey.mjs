import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {traceFixture} from './stock-trace-journey.mjs'
export async function warrantyOriginal(h,{asset}={}){
 const fixture=await traceFixture(h),lot=await h.command('stock.lot',fixture.lot)
 let {job}=await booking(h,{asset}),q=await authorise(h,await estimate(h,job));job=(await h.state()).records.job.find(j=>j.id===job.id)
 for(const line of q.revisions[0].lines)job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:line.id,quantity:1})
 await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:lot.id,quantity:1,reference:'synthetic-mallet-81',reason:'Installed supplier-marked pad lot'})
 job=(await h.state()).records.job.find(j=>j.id===job.id);await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version});const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 invoice=(await h.state()).records.invoice.find(i=>i.id===invoice.id);job=(await h.state()).records.job.find(j=>j.id===job.id)
 return {fixture,job,invoice,exported,lot}
}
export const termsInput=i=>({invoiceId:i.id,version:i.version,startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+365*86400000).toISOString(),mileageLimit:100000,unit:'mi',terms:'Shop-declared 12 months / 100000 absolute miles on installed pads and replacement labor; excludes collision damage.'})
export async function openInput(h,f,t){const s=await h.state(),asset=s.records.asset.find(a=>a.id===f.job.assetId);return {termsId:t.id,assetId:asset.id,assetVersion:asset.version,failure:'Same brake squeal within coverage; pad bonding failure',failureAt:new Date().toISOString(),mileage:65000,stockUseId:s.records.stockUse.find(u=>u.jobId===f.job.id).id,title:'No-charge pad comeback',bayId:'Warranty bay',technicianId:s.actor.id,startAt:new Date(Date.now()+3600000).toISOString(),endAt:new Date(Date.now()+7200000).toISOString()}}
export async function noChargeWork(h,w){
 let job=(await h.state()).records.job.find(j=>j.id===w.jobId),q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Covered replacement pads',quantity:1,unitCents:0},{kind:'labor',description:'Covered replacement labor',quantity:1,unitCents:0}]});q=await authorise(h,q)
 job=(await h.state()).records.job.find(j=>j.id===job.id);for(const l of q.revisions[0].lines)job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:l.id,quantity:1});return job
}
export async function readNoChargeLabor(h,w){
 const {records}=await h.state(),job=records.job.find(j=>j.id===w.jobId)
 assert.ok(job,'The linked rework repair is publicly readable')
 const estimate=records.estimate.find(q=>q.id===job.estimateId),revision=estimate.revisions.find(r=>r.n===1)
 assert.equal(estimate.jobId,w.jobId);assert.equal(estimate.status,'authorised');assert.ok(revision.approval)
 assert.equal(estimate.authorisation.revision,1)
 const line=revision.lines.find(l=>l.kind==='labor'&&l.description==='Covered replacement labor')
 assert.ok(line);assert.ok(estimate.authorisation.lineIds.includes(line.id))
 assert.equal(line.unitCents,0,'Customer-authorized replacement labor has an exact zero unit price')
 assert.equal(line.quantity,1);assert.equal(line.quantityMilli,1000)
 const actuals=job.actuals.filter(a=>a.kind==='labor');assert.equal(actuals.length,1)
 const [labor]=actuals
 assert.deepEqual({estimateId:labor.estimateId,revision:labor.revision,lineId:labor.lineId,quantity:labor.quantity,quantityMilli:labor.quantityMilli},
  {estimateId:estimate.id,revision:1,lineId:line.id,quantity:1,quantityMilli:1000},'Saved labor binds the approved and customer-authorized line and exact performed quantity')
 assert.equal(revision.totals.totalCents,0);assert.equal(estimate.authorisation.totals.totalCents,0)
 return {job,estimate,labor}
}
export function assertInternalLaborCost(w,labor){
 const costs=w.costs.filter(c=>c.kind==='labor');assert.equal(costs.length,1)
 assert.equal(costs[0].amountCents,2000,'Internal technician cost is nonzero and separate from the zero customer price')
 assert.equal(costs[0].actualId,labor.id);assert.deepEqual(costs[0].actual,labor,'Internal cost retains the exact saved labor actual')
}
export async function warrantyJourney(h){
 const {customersFixture}=await import('./customers-journey.mjs'),cf=await customersFixture(h),account=await h.command('customer.save',cf.input);let asset=await h.command('asset.create',{customerName:'Cedar Fleet',customerEmail:'fleet@example.test',label:'Fleet vehicle',identifier:'synthetic-mallet-87'});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Owner reviewed the private payer snapshot'})
 const f=await warrantyOriginal(h,{asset}),terms=await h.command('warranty.terms',termsInput(f.invoice)),input=await openInput(h,f,terms),member=await h.person('warranty-tech@example.test'),admin=await h.person('warranty-advisor@example.test','admin'),agent=await h.command('agent.create',{label:'No warranty authority'}),bearer={as:'',headers:{authorization:'Bearer '+agent.token}}
 const baseline=(await h.state()).records
 for(const opts of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('warranty.open',input,opts)
 await h.command('warranty.open',input,{status:409});assert.deepEqual((await h.state()).records,baseline)
 const payment={invoiceId:f.invoice.id,version:f.invoice.version,amountCents:f.invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-82',evidence:'Cash counted against the original invoice; staff declaration only'}
 await h.command('payment.record',{...payment,amountCents:payment.amountCents+1},{status:409});const paid=await h.command('payment.record',payment);assert.equal(paid.verified,false);assert.deepEqual(await h.command('payment.record',payment),paid);await h.command('payment.record',{...payment,amountCents:1},{status:409})
 let w=await h.command('warranty.open',input,{as:admin.cookie});assert.ok(!JSON.stringify(w).includes('\"fleet\":'),'A non-owner command reply contains no private fleet decision snapshot');assert.ok(f.invoice.billing);assert.equal(w.originalInvoice.billing,undefined);assert.equal(w.identifier,f.invoice.customer.identifier);assert.equal(w.lot.supplierLot,f.lot.supplierLot);assert.equal(w.installed.jobId,f.job.id);assert.equal(w.originalPayment.outstandingCents,0);assert.equal(w.withinTerms,true)
 await h.command('warranty.cost',{warrantyId:w.id,version:w.version,actualId:'missing',amountCents:1,evidence:'Not approved'},{status:409})
 w=await h.command('warranty.decide',{warrantyId:w.id,version:w.version,outcome:'covered',responsibility:'supplier',reason:'Within saved term; supplier-marked pad failed; approve no-charge labor'},{as:admin.cookie})
 assert.equal(w.decision.noChargeLabor,true);await h.command('warranty.decide',{warrantyId:w.id,version:w.version,outcome:'declined',responsibility:'shop',reason:'Cannot rewrite'},{status:409})
 const rework=await noChargeWork(h,w),noCharge=await readNoChargeLabor(h,w),beforeCosts=(await h.state()).records
 for(const [i,a]of rework.actuals.entries())w=await h.command('warranty.cost',{warrantyId:w.id,version:w.version,actualId:a.id,amountCents:i?2000:1500,evidence:i?'One hour technician cost':'Replacement pad cost'})
 assertInternalLaborCost(w,noCharge.labor)
 const afterCosts=(await h.state()).records
 assert.deepEqual(afterCosts.job,beforeCosts.job,'Recording internal cost does not add customer work')
 for(const kind of ['estimate','invoice','payment','export'])assert.deepEqual(afterCosts[kind],beforeCosts[kind],'Internal cost cannot become a customer charge: '+kind)
 await h.command('warranty.cost',{warrantyId:w.id,version:w.version,actualId:rework.actuals[0].id,amountCents:1500,evidence:'Duplicate'},{status:409})
 await h.command('warranty.cost',{warrantyId:w.id,version:w.version,actualId:f.job.actuals.find(a=>a.kind==='labor').id,amountCents:2000,evidence:'Original paid labor is not rework'},{status:409})
 assert.deepEqual((await h.state()).records,afterCosts,'Duplicate cost and original paid actual are refused without changing any records')
 await h.command('warranty.claim',{warrantyId:w.id,version:w.version,claimant:'Cedar Parts',reference:'synthetic-mallet-83',amountCents:3501,evidence:'Over recorded cost'},{status:409})
 const claimInput={warrantyId:w.id,version:w.version,claimant:'Cedar Parts',reference:'synthetic-mallet-83',amountCents:3500,evidence:'Approved supplier claim for failed pads and replacement labor'},beforeClaim=(await h.state()).records
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{...bearer,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('warranty.claim',claimInput,options)
 assert.deepEqual((await h.state()).records,beforeClaim)
 w=await h.command('warranty.claim',claimInput,{as:admin.cookie})
 const claimId=w.claims[0].id;assert.equal(w.claims[0].status,'prepared');assert.match(w.claims[0].label,/not submitted/)
 await h.command('warranty.claimOutcome',{warrantyId:w.id,version:w.version,claimId,status:'credited',creditCents:3000,evidence:'Cannot skip external steps'},{status:409})
 for(const status of ['submitted','accepted','credited'])w=await h.command('warranty.claimOutcome',{warrantyId:w.id,version:w.version,claimId,status,creditCents:3000,evidence:'Staff attached external supplier '+status+' reference synthetic-mallet-84'})
 assert.equal(w.costs.reduce((n,x)=>n+x.amountCents,0)-w.claims[0].history.reduce((n,x)=>n+x.creditCents,0),500)
 // Terms are immutable snapshots; later shop declarations do not change this comeback.
 const {patternJourney}=await import('./warranty-pattern-journey.mjs');w=(await patternJourney(h,f,w)).w
 const laterTerms=await h.command('warranty.terms',{...termsInput(f.invoice),terms:'Different terms for later cases',mileageLimit:75000});assert.notEqual(laterTerms.id,w.terms.id)
 for(const [i,responsibility]of ['shop','OEM'].entries()){
  const source=await openInput(h,f,terms),edge=await h.command('warranty.open',{...source,failureAt:terms.startsAt,mileage:terms.mileageLimit,startAt:new Date(Date.now()+(3+i*2)*3600000).toISOString(),endAt:new Date(Date.now()+(4+i*2)*3600000).toISOString()})
  assert.equal(edge.withinTerms,true,'Inclusive start time and exact mileage limit are covered')
  const decided=await h.command('warranty.decide',{warrantyId:edge.id,version:edge.version,outcome:'covered',responsibility,reason:'Explicit '+responsibility+' coverage against saved original terms'});assert.equal(decided.decision.responsibility,responsibility)
 }
 const source=await openInput(h,f,terms),outside=await h.command('warranty.open',{...source,mileage:terms.mileageLimit+1,startAt:new Date(Date.now()+7*3600000).toISOString(),endAt:new Date(Date.now()+8*3600000).toISOString()});assert.equal(outside.withinTerms,false)
 await h.command('warranty.decide',{warrantyId:outside.id,version:outside.version,outcome:'covered',responsibility:'shop',reason:'Outside limit'},{status:409})
 const declined=await h.command('warranty.decide',{warrantyId:outside.id,version:outside.version,outcome:'declined',responsibility:'shop',reason:'Above the saved mileage limit'});assert.equal(declined.decision.noChargeLabor,false)
 const final=await h.state();assert.deepEqual(final.records.invoice.find(i=>i.id===f.invoice.id),f.invoice);assert.deepEqual(final.records.export.find(i=>i.id===f.exported.id),f.exported);assert.equal(final.records.job.find(j=>j.id===w.jobId).assetId,f.job.assetId);assert.equal(final.records.estimate.find(q=>q.jobId===w.jobId).revisions[0].totals.totalCents,0)
 assert.equal((await h.state(bearer)).records.warranty?.length??0,0);assert.equal((await h.request('/app/jobs/'+f.job.id+'/warranty',bearer)).status,403)
 const fresh=await installation({bindings:{OWNER_EMAIL:'warranty-recovery@example.test'}})
 try{await restore(fresh,await archive(h));const s=await fresh.state();assert.deepEqual(await fresh.api('/api/mallet/warranty-patterns/'+w.id),await h.api('/api/mallet/warranty-patterns/'+w.id));for(const kind of ['warranty','warrantyTerms','payment'])assert.deepEqual(s.records[kind],final.records[kind]);assert.deepEqual(s.records.invoice.find(i=>i.id===f.invoice.id),f.invoice);assert.deepEqual(s.records.export.find(i=>i.id===f.exported.id),f.exported);assert.deepEqual(await readNoChargeLabor(fresh,w),noCharge,'Fresh-owner recovery preserves the exact rework estimate, authorization and labor actual');assertInternalLaborCost(s.records.warranty.find(c=>c.id===w.id),noCharge.labor);await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
 const cohortDates=final.records.job.map(j=>j.createdAt.slice(0,10)).sort()
 const report=await h.api('/api/mallet/reports/turnaround?'+new URLSearchParams({from:cohortDates[0],to:cohortDates.at(-1)}))
 assert.equal(report.metrics.completedRepairs,5);assert.equal(report.metrics.repairsWithComebacks,5);assert.equal(report.metrics.comebackRateTenths,1000,'Multiple warranty cases count the original repair once')
 const original=report.repairs.find(r=>r.jobId===f.job.id);assert.ok(original.comebacks.some(c=>c.id===w.id&&c.jobId===w.jobId),'Comeback drill-through names exact retained repair')
 return {f,w}
}
