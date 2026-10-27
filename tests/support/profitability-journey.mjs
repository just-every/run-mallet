import assert from 'node:assert/strict'
import {authorise,archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
export const profitPath='/api/mallet/reports/profitability'
const job=async(h,id)=>(await h.state()).records.job.find(j=>j.id===id)
export async function profitabilityFixture(h){
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=0&partsTaxable=yes&laborTaxable=yes'});assert.equal(setup.status,303)
 const owner=(await h.state()).actor,advisor=await h.person('profit-advisor@example.test','admin')
 let asset=await h.command('asset.create',{customerName:'Elena Torres',customerEmail:'elena@example.test',label:'2018 Subaru Outback',identifier:'synthetic-mallet-profit-1'})
 let original=await h.command('job.book',{assetId:asset.id,version:asset.version,title:'Brake service and rotor machining',technicianId:owner.id,bayId:'Profit bay',startAt:'2026-11-02T09:00:00Z',endAt:'2026-11-02T12:00:00Z'},{as:advisor.cookie})
 const q=await authorise(h,await h.command('estimate.prepare',{jobId:original.id,version:original.version,lines:[{kind:'part',description:'Brake pads',quantity:1,unitCents:10000,unitDiscountCents:1000,costCents:4000},{kind:'labor',description:'Replace and tune',quantity:2,unitCents:10000,unitDiscountCents:1000,costCents:3000},{kind:'fee',description:'Rotor machining',quantity:1,unitCents:15000,feeTaxable:false},{kind:'fee',description:'Core deposit',quantity:1,unitCents:2000,feeTaxable:false}]}))
 const [part,labor,service,coreLine]=q.revisions[0].lines
 const rateInput={technicianId:owner.id,version:0,centsPerHour:4000,effectiveFrom:'2026-01-01',reason:'Loaded wage plus payroll burden and benefits'}
 let rate=await h.command('costRate.set',rateInput)
 rate=await h.command('costRate.set',{...rateInput,version:rate.version,centsPerHour:9900,effectiveFrom:'2099-01-01',reason:'Future rate must not apply early'})
 const attendance=await h.command('time.clockIn'),timer=await h.command('time.start',{jobId:original.id,version:(await job(h,original.id)).version,category:'billable'})
 await h.command('time.pause',{jobId:original.id});await h.command('time.clockOut')
 const correct=async(id,startAt,endAt,reason,approve=true)=>{
  const entry=(await h.state()).records.timeEntry.find(e=>e.id===id),c=await h.command('time.correct',{entryId:id,entryVersion:entry.version,startAt,endAt,reason})
  if(approve)await h.command('time.approveCorrection',{correctionId:c.id,correctionVersion:c.version})
  return c
 }
 const end=(await h.state()).records.timeEntry.find(e=>e.id===attendance.id).revisions.at(-1).endAt
 await correct(attendance.id,'2026-10-19T00:00:00Z',end,'Retained shift covers corrected paper job ticket')
 await correct(timer.id,'2026-10-19T09:00:00Z','2026-10-19T10:30:00Z','Paper ticket: ninety minutes actual labor')
 const refs=async extra=>({jobId:original.id,version:(await job(h,original.id)).version,...extra})
 let sublet=await h.command('sublet.record',await refs({estimateId:q.id,revision:1,lineId:service.id,supplier:'Cedar Machine Shop',poReference:'synthetic-mallet-profit-2',item:'Brake rotors',custodian:'Morgan at shop',costCents:8000,eta:'2026-11-02T10:00:00Z',evidence:'Quoted machining cost',reason:'Customer authorized machining'}))
 const sr=async extra=>refs({subletId:sublet.id,subletVersion:sublet.version,...extra})
 sublet=await h.command('sublet.send',await sr({observedAt:q.authorisation.at,handedTo:'Pat at machine shop',reference:'synthetic-mallet-profit-3'}))
 sublet=await h.command('sublet.bill',await sr({billReference:'synthetic-mallet-profit-4',costCents:9000,evidence:'Retained supplier invoice',reason:'Actual supplier cost rose'}))
 sublet=await h.command('sublet.receive',await sr({observedAt:sublet.bills.at(-1).at,custodian:'Morgan at shop',handedBy:'Pat',reference:'synthetic-mallet-profit-5'}))
 const item=await h.command('stock.item',{sku:'synthetic-mallet-profit-6',barcode:'synthetic-mallet-profit-7',name:'Brake pads',unit:'each'}),bin=await h.command('stock.bin',{code:'Brake shelf',barcode:'synthetic-mallet-profit-8'})
 const lot=await h.command('stock.lot',{itemBarcode:item.barcode,binBarcode:bin.barcode,quantity:2,supplier:'Cedar Parts',supplierLot:'synthetic-mallet-profit-9',serial:'',reference:'synthetic-mallet-profit-10',unitCostCents:6000,evidence:'Supplier invoice proves a higher cost than quoted'})
 for(const line of q.revisions[0].lines)original=await h.command('work.record',await refs({estimateId:q.id,revision:1,lineId:line.id,quantity:line.quantity}))
 const use=await h.command('stock.useLot',await refs({actualId:original.actuals[0].id,lotId:lot.id,quantity:1,reference:'synthetic-mallet-profit-11',reason:'Installed marked supplier pad lot'}))
 await qualityReady(h,await job(h,original.id));original=await h.command('job.complete',await refs())
 let invoice=await h.command('invoice.prepare',await refs());invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const query='?from='+new Date(Date.parse(original.createdAt)-86400000).toISOString().slice(0,10)+'&to='+new Date(Date.parse(original.createdAt)+86400000).toISOString().slice(0,10)
 return {owner,advisor,original,q,part,labor,coreLine,lot,use,invoice,query,rate,rateInput,timer,correct,refs}
}
export async function profitabilityJourney(h,{recovery=true}={}){
 const f=await profitabilityFixture(h),read=()=>h.api(profitPath+f.query)
 let r=await read(),original=r.repairs.find(j=>j.jobId===f.original.id)
 assert.deepEqual(original.estimated,{revenueCents:44000,costCents:18000,grossProfitCents:26000,marginBps:5909})
 assert.deepEqual(original.realized,{revenueCents:44000,costCents:21000,grossProfitCents:23000,marginBps:5227},'Higher received cost and 90 minutes loaded labor change realized margin, not estimated margin')
 assert.deepEqual(original.costEvents.map(e=>[e.kind,e.amountCents]).sort(),[['labor-timer',6000],['part-use',6000],['sublet-bill',9000]])
 const costTimer=original.costEvents.find(e=>e.kind==='labor-timer');assert.equal(costTimer.detail.ms,5400000);assert.equal(costTimer.detail.rate.centsPerHour,4000);assert.equal(costTimer.detail.revisions.at(-1).reason,'Paper ticket: ninety minutes actual labor')
 const pending=await f.correct(f.timer.id,'2026-10-19T09:00:00Z','2026-10-19T10:00:00Z','Pending correction must not alter costs',false)
 assert.deepEqual((await read()).realized,r.realized)
 // Physical return reduces cost, while the separately issued customer credit reduces revenue once.
 const payment=await h.command('payment.record',{invoiceId:f.invoice.id,version:f.invoice.version,method:'cash',amountCents:f.invoice.totals.totalCents,reference:'synthetic-mallet-profit-12',evidence:'Cash counted against invoice'})
 let core=await h.command('stock.coreOpen',{invoiceId:f.invoice.id,version:f.invoice.version,lineId:f.coreLine.id,stockUseId:f.use.id,customerDueAt:'2026-12-01T00:00:00Z',supplierDueAt:'2026-12-10T00:00:00Z',expectedCreditCents:1500,alertDays:7,terms:'Recorded core terms'})
 core=await h.command('stock.coreReturn',{coreId:core.id,version:core.version,condition:'Intact original core',evidence:'Counter received old core'})
 core=await h.command('stock.coreShip',{coreId:core.id,version:core.version,carrier:'Shop delivery',tracking:'synthetic-mallet-profit-13',evidence:'Signed supplier handoff'})
 const creditInput={coreId:core.id,version:core.version,reference:'synthetic-mallet-profit-14',amountCents:1200,evidence:'Supplier issued credit document',reason:'Supplier actual core credit differs from expected'}
 const supplierCredit=await h.command('stock.coreCredit',creditInput);await h.command('stock.coreCredit',creditInput)
 const coreNote=await h.command('stock.coreCorrect',{coreId:core.id,version:core.version,paymentId:payment.id,reason:'Customer returned core',consentEvidence:'Customer requested original cash refund',confirm:'correct-core'})
 await h.command('stock.returnUse',{stockUseId:f.use.id,version:f.use.version,quantity:.25,reference:'synthetic-mallet-profit-15',reason:'Counter inspected saleable unused quarter',confirm:'return-to-stock'})
 const credit={invoiceId:f.invoice.id,version:f.invoice.version,lines:[{lineId:f.part.id,sourceEstimateId:f.q.id,sourceRevision:1,quantity:.25}],destination:'original-tender',paymentId:payment.id,reference:'synthetic-mallet-profit-16',reason:'Unused quarter returned',consentEvidence:'Customer requested cash for returned quantity'}
 const review=await h.command('credit.preview',credit),note=await h.command('credit.issue',{...credit,review,confirm:'issue-credit'})
 r=await read();original=r.repairs.find(j=>j.jobId===f.original.id)
 assert.deepEqual(original.realized,{revenueCents:39750,costCents:18300,grossProfitCents:21450,marginBps:5396})
 assert.deepEqual(original.estimated,{revenueCents:44000,costCents:18000,grossProfitCents:26000,marginBps:5909})
 assert.equal(original.costEvents.find(e=>e.kind==='core-credit').sourceId,supplierCredit.id);assert.equal(original.costEvents.find(e=>e.kind==='saleable-return').amountCents,-1500)
 const beforeRefund=r.realized
 for(const n of [coreNote,note]){const refund=(await h.state()).records.refund.find(r=>r.creditNoteId===n.id);await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-profit-refund-'+n.id,evidence:'Owner returned counted cash',confirm:'record-refund'})}
 assert.deepEqual((await read()).realized,beforeRefund,'Completing refunds never deducts issued credits twice')
 const now=f.q.authorisation.at,terms=await h.command('warranty.terms',{invoiceId:f.invoice.id,version:f.invoice.version,startsAt:'2026-01-01T00:00:00Z',endsAt:'2099-01-01T00:00:00Z',mileageLimit:100000,unit:'mi',terms:'Recorded shop warranty'})
 const asset=(await h.state()).records.asset.find(a=>a.id===f.original.assetId)
 let w=await h.command('warranty.open',{termsId:terms.id,assetId:asset.id,assetVersion:asset.version,stockUseId:f.use.id,failure:'Pad bonding failed',failureAt:now,mileage:65000,title:'No-charge pad comeback',technicianId:f.owner.id,bayId:'Comeback bay',startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T11:00:00Z'})
 w=await h.command('warranty.decide',{warrantyId:w.id,version:w.version,outcome:'covered',responsibility:'supplier',reason:'Within retained terms'})
 let comeback=await job(h,w.jobId),quote=await authorise(h,await h.command('estimate.prepare',{jobId:comeback.id,version:comeback.version,lines:[{kind:'part',description:'Covered replacement pad',quantity:1,unitCents:0,costCents:1500},{kind:'labor',description:'Covered replacement labor',quantity:1,unitCents:0,costCents:2000}]}))
 for(const l of quote.revisions[0].lines){comeback=await h.command('work.record',{jobId:comeback.id,version:(await job(h,comeback.id)).version,lineId:l.id,quantity:1});w=await h.command('warranty.cost',{warrantyId:w.id,version:w.version,actualId:comeback.actuals.at(-1).id,amountCents:l.kind==='part'?1500:2000,evidence:'Recorded actual comeback cost'})}
 w=await h.command('warranty.claim',{warrantyId:w.id,version:w.version,claimant:'Cedar Parts',reference:'synthetic-mallet-profit-17',amountCents:1000,evidence:'Approved external claim record'})
 const beforeClaim=(await read()).repairs.find(j=>j.jobId===comeback.id).realized.costCents;assert.equal(beforeClaim,3500,'Prepared claim does not reduce cost')
 for(const status of ['submitted','accepted','credited'])w=await h.command('warranty.claimOutcome',{warrantyId:w.id,version:w.version,claimId:w.claims[0].id,status,creditCents:1000,evidence:'Recorded supplier '+status+' document'})
 await qualityReady(h,await job(h,comeback.id));comeback=await h.command('job.complete',{jobId:comeback.id,version:(await job(h,comeback.id)).version})
 let noCharge=await h.command('invoice.prepare',{jobId:comeback.id,version:comeback.version});noCharge=await h.command('invoice.approve',{invoiceId:noCharge.id,version:noCharge.version})
 r=await read()
 assert.deepEqual(new Set(r.repairs.map(j=>j.jobId)),new Set([f.original.id,comeback.id]))
 assert.deepEqual(r.realized,{revenueCents:39750,costCents:20800,grossProfitCents:18950,marginBps:4767})
 assert.deepEqual(r.warrantyAdjusted.find(j=>j.jobId===f.original.id),{jobId:f.original.id,comebackJobIds:[comeback.id],netReworkCostCents:2500,grossProfitCents:18950})
 assert.equal(r.repairs.find(j=>j.jobId===comeback.id).realized.marginBps,null,'Zero-price rework has no percentage denominator')
 for(const dimension of ['category','technician','advisor','service','supplier']){
  assert.ok(r.groups[dimension].length>0)
  assert.equal(r.groups[dimension].reduce((n,g)=>n+g.realized.revenueCents,0),39750,dimension+' revenue reconciles')
  assert.equal(r.groups[dimension].reduce((n,g)=>n+g.realized.costCents,0),20800,dimension+' costs reconcile')
 }
 assert.equal(r.groups.category.find(g=>g.key==='sublet').realized.grossProfitCents,6000)
 assert.equal(r.groups.advisor.find(g=>g.key===f.advisor.id).realized.grossProfitCents,21450)
 assert.deepEqual(r.groups.supplier.filter(g=>g.key==='Cedar Machine Shop').map(g=>g.realized.costCents),[9000])
 for(const repair of r.repairs)assert.equal((await h.request(repair.jobUrl)).status,200)
 const before=await h.state();await read();assert.deepEqual(await h.state(),before,'Report reads create no product writes')
 if(recovery)await profitabilityAllocationJourney()
 if(recovery){const fresh=await installation();try{await restore(fresh,await archive(h));assert.deepEqual(await fresh.api(profitPath+f.query),r);await fresh.api(profitPath+f.query,undefined,{as:h.owner,status:401});assert.ok((await fresh.state()).records.audit.some(a=>a.action==='costRate.set'))}finally{await fresh.close()}}
 return {...f,comeback,w,report:r,pending}
}

// This extends the registered native journey without changing its browser fixture totals.
async function profitabilityAllocationJourney(){
 const h=await installation()
 try{
  const f=await profitabilityFixture(h),read=()=>h.api(profitPath+f.query),original=async()=>(await read()).repairs.find(r=>r.jobId===f.original.id)
  const retained=await h.state(),declarations=[
   {centsPerHour:8000,effectiveFrom:'2026-10-20',reason:'Next day loaded burden'},
   {centsPerHour:4500,effectiveFrom:'2026-10-19',reason:'Start date loaded burden correction'},
   {centsPerHour:3000,effectiveFrom:'2026-10-18',reason:'Earlier date must not displace later effective revision'},
   {centsPerHour:5000,effectiveFrom:'2026-10-19',reason:'Latest declaration for the same effective date'}
  ]
  let rate=f.rate
  for(const [i,entry]of declarations.entries()){
   rate=await h.command('costRate.set',{...f.rateInput,...entry,version:rate.version})
   assert.equal((await original()).costEvents.find(e=>e.kind==='labor-timer').amountCents,[6000,6750,6750,7500][i])
   const history=(await read()).rateHistory,revision=history.find(r=>r.id===rate.id&&r.revision===rate.version)
   assert.deepEqual(revision.before,rate.revisions.at(-2));assert.deepEqual(revision.after,rate.revisions.at(-1))
   assert.equal(revision.after.centsPerHour,entry.centsPerHour);assert.equal(revision.after.effectiveFrom,entry.effectiveFrom);assert.equal(revision.after.reason,entry.reason)
   assert.equal(revision.after.by.id,f.owner.id);assert.ok(Number.isFinite(Date.parse(revision.after.at)))
   const audit=(await h.api('/api/mallet/audit?action=costRate.set')).entries.find(a=>a.id===revision.audit.id)
   assert.equal(audit.actor.id,f.owner.id);assert.equal(audit.at,revision.after.at)
   assert.deepEqual(audit.changes,[{kind:'costRate',id:rate.id,beforeRevision:rate.version-1,afterRevision:rate.version}])
  }
  const history=(await read()).rateHistory.filter(r=>r.id===rate.id)
  assert.equal(history[0].before,null);assert.deepEqual(history.map(r=>r.after),rate.revisions)
  const afterRates=await h.state()
  for(const kind of ['invoice','estimate','timeEntry','timeCorrection','payment'])assert.deepEqual(afterRates.records[kind],retained.records[kind],'Loaded cost declarations preserve retained '+kind)
  await f.correct(f.timer.id,'2026-10-18T09:00:00Z','2026-10-18T10:30:00Z','Earlier effective date contrast')
  assert.equal((await original()).costEvents.find(e=>e.kind==='labor-timer').amountCents,4500)
  await f.correct(f.timer.id,'2026-10-20T09:00:00Z','2026-10-20T10:30:00Z','Later effective date contrast')
  assert.equal((await original()).costEvents.find(e=>e.kind==='labor-timer').amountCents,12000)

  const asset=(await h.state()).records.asset.find(a=>a.id===f.original.assetId)
  let repair=await h.command('job.book',{assetId:asset.id,version:asset.version,title:'synthetic-mallet-allocation',technicianId:f.owner.id,bayId:'synthetic-mallet-allocation-bay',startAt:'2026-11-05T09:00:00Z',endAt:'2026-11-05T11:00:00Z'})
  const matrix=await h.command('pricing.save',{version:0,name:'synthetic-mallet-allocation-matrix',kind:'part',minimumCents:0,roundingCents:1,reason:'Retained package unit costs',bands:[{fromCents:0,toCents:null,markupBps:0}]})
  const recipeInput={version:0,name:'synthetic-mallet-historical-package',reason:'Original service package',lines:[{kind:'part',description:'synthetic-mallet-mixed-part',quantity:3,unitCents:0,costCents:1000,matrixId:matrix.id},{kind:'part',description:'synthetic-mallet-second-part',quantity:1,unitCents:0,costCents:1000,matrixId:matrix.id}]}
  let recipe=await h.command('inspectionJob.save',recipeInput)
  const quote=await authorise(h,await h.command('recipe.prepare',{jobId:repair.id,version:repair.version,recipeId:recipe.id,recipeVersion:recipe.version,overrides:[{lineIndex:0,unitCents:3333,reason:'Exact reviewed package charge'}]}))
  const refs=async extra=>({jobId:repair.id,version:(await job(h,repair.id)).version,...extra})
  const bin=await h.command('stock.bin',{code:'synthetic-mallet-allocation-bin',barcode:'synthetic-mallet-allocation-bin'})
  const items=[]
  for(const n of [0,1])items.push(await h.command('stock.item',{sku:'synthetic-mallet-allocation-item-'+n,barcode:'synthetic-mallet-allocation-item-'+n,name:'synthetic-mallet-allocation-item-'+n,unit:'each'}))
  const purchase=async(supplier,lines,taxCents,freightCents)=>{
   let po=await h.command('purchase.create',{reference:'synthetic-mallet-allocation-'+supplier,supplier,shipTo:'synthetic-mallet-workshop',expectedAt:'2026-11-01T00:00:00Z',lines,taxCents,freightCents})
   po=await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Exact retained purchase costs'})
   return po
  }
  let a=await purchase('synthetic-mallet-supplier-a',[{itemId:items[0].id,quantity:2,unitCents:1001},{itemId:items[1].id,quantity:1,unitCents:999}],55,101)
  let b=await purchase('synthetic-mallet-supplier-b',[{itemId:items[0].id,quantity:2,unitCents:2000}],7,11)
  const receipts=[]
  const receive=async(po,index,quantity,suffix)=>{
   const item=items[index],current=(await h.state()).records.purchaseOrder.find(p=>p.id===po.id)
   const receipt=await h.command('purchase.receive',{purchaseId:po.id,version:current.version,lineId:po.lines.find(l=>l.itemId===item.id).id,itemBarcode:item.barcode,binBarcode:bin.barcode,quantity,reference:'synthetic-mallet-receipt-'+suffix})
   receipts.push(receipt);return receipt
  }
  const first=await receive(a,0,1,'a-first');await receive(a,0,1,'a-unused');const second=await receive(a,1,1,'a-second'),third=await receive(b,0,2,'b')
  const lots=[]
  for(const [po,receipt,index,quantity,unitCostCents,suffix]of [[a,first,0,1,1001,'a-first'],[a,second,1,1,999,'a-second'],[b,third,0,2,2000,'b']])lots.push(await h.command('stock.lot',{itemBarcode:items[index].barcode,binBarcode:bin.barcode,quantity,supplier:po.supplier,supplierLot:'synthetic-mallet-lot-'+suffix,reference:'synthetic-mallet-trace-'+suffix,serial:'',unitCostCents,purchaseReceiptId:receipt.id,evidence:'Retained received purchase provenance'}))
  for(const line of quote.revisions[0].lines)repair=await h.command('work.record',await refs({estimateId:quote.id,revision:1,lineId:line.id,quantity:line.quantity}))
  const uses=[]
  for(const [lot,index,quantity]of [[lots[0],0,1],[lots[1],1,1],[lots[2],0,2]])uses.push(await h.command('stock.useLot',await refs({actualId:repair.actuals[index].id,lotId:lot.id,quantity,reference:'synthetic-mallet-use-'+lot.id,reason:'Identified installed purchase lot'})))
  const costed=async()=>(await read()).repairs.find(r=>r.jobId===repair.id)
  assert.equal((await costed()).realized.costCents,null,'Purchase receipts cannot invent reconciled tax or freight')
  const bill=async(po,change={})=>{
   const current=(await h.state()).records.purchaseOrder.find(p=>p.id===po.id)
   return h.command('purchase.bill',{purchaseId:po.id,version:current.version,invoiceNumber:'synthetic-mallet-bill-'+po.id,lines:po.lines.map(l=>({lineId:l.id,quantity:l.quantityMilli/1000,unitCents:l.unitCents})),taxCents:po.taxCents,freightCents:po.freightCents,evidence:'Complete supplier invoice with retained charges',...change})
  }
  await bill(a,{taxCents:56});await bill(b)
  assert.equal((await costed()).realized.costCents,null,'An exception bill cannot establish realized purchase costs')
  const matched=await bill(a)
  await qualityReady(h,await job(h,repair.id));repair=await h.command('job.complete',await refs())
  let invoice=await h.command('invoice.prepare',await refs());invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
  recipe=await h.command('inspectionJob.save',{...recipeInput,id:recipe.id,version:recipe.version,name:'synthetic-mallet-renamed-package',reason:'Later package revision must not relabel retained repairs'})
  let report=await read(),result=await costed()
  assert.equal(result.realized.revenueCents,10999);assert.equal(result.realized.costCents,6123)
  assert.deepEqual(result.costEvents.filter(e=>e.sourceId===matched.id).map(e=>[e.kind,e.amountCents]).sort(),[['purchase-freight',34],['purchase-freight',34],['purchase-supplier-tax',18],['purchase-supplier-tax',19]])
  const allocated=result.lines[0].supplierShares
  assert.deepEqual(allocated.map(s=>[s.supplier,s.estimatedWeight,s.realizedWeight]),[['synthetic-mallet-supplier-a',1000,1000],['synthetic-mallet-supplier-b',2000,2000]])
  for(const [supplier,revenue,cost]of [['synthetic-mallet-supplier-a',4333,2105],['synthetic-mallet-supplier-b',6666,4018]]){
   const g=report.groups.supplier.find(g=>g.key===supplier);assert.equal(g.realized.revenueCents,revenue);assert.equal(g.realized.costCents,cost)
  }
  for(const line of result.lines){assert.deepEqual(line.servicePackage,quote.revisions[0].inspectionSource.pricedRecipe);assert.equal(line.servicePackage.revision,1)}
  assert.ok(result.costEvents.every(e=>e.servicePackage.id===recipe.id&&e.servicePackage.revision===1))
  const service=report.groups.service.find(g=>g.key===result.lines[0].service);assert.equal(service.realized.revenueCents,10999);assert.equal(service.realized.costCents,6123)
  await h.command('stock.returnUse',{stockUseId:uses[0].id,version:uses[0].version,quantity:.333,reference:'synthetic-mallet-allocation-return',reason:'Unused saleable fraction inspected',confirm:'return-to-stock'})
  const payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,method:'cash',amountCents:invoice.totals.totalCents,reference:'synthetic-mallet-allocation-payment',evidence:'Cash counted'})
  const credit={invoiceId:invoice.id,version:invoice.version,lines:[{lineId:quote.revisions[0].lines[0].id,sourceEstimateId:quote.id,sourceRevision:1,quantity:.333}],destination:'original-tender',paymentId:payment.id,reference:'synthetic-mallet-allocation-credit',reason:'Returned unused fractional quantity',consentEvidence:'Customer requests original cash refund'}
  const review=await h.command('credit.preview',credit);await h.command('credit.issue',{...credit,review,confirm:'issue-credit'})
  report=await read();result=await costed()
  assert.equal(result.realized.costCents,5773);assert.equal(result.realized.revenueCents,9889)
  assert.deepEqual(result.costEvents.filter(e=>e.detail.stockUseId===uses[0].id&&e.kind.startsWith('purchase-')).map(e=>e.amountCents),[23,13])
  assert.equal(report.groups.supplier.find(g=>g.key==='synthetic-mallet-supplier-a').realized.revenueCents,3223)
  for(const dimension of Object.values(report.groups)){
   assert.equal(dimension.reduce((n,g)=>n+g.realized.revenueCents,0),report.realized.revenueCents)
   assert.equal(dimension.reduce((n,g)=>n+g.realized.costCents,0),report.realized.costCents)
  }
  const fresh=await installation()
  try{await restore(fresh,await archive(h));assert.deepEqual(await fresh.api(profitPath+f.query),report)}finally{await fresh.close()}
 }finally{await h.close()}
}
