import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
import {termsInput,openInput,noChargeWork} from './warranty-journey.mjs'
export const rmaClock='2026-10-30T12:00:00.000Z'
export const rmaAuthorization={number:'synthetic-mallet-110',label:'Supplier label synthetic-mallet-111',evidence:'External supplier authorization'}
export const rmaShipment={carrier:'Synthetic carrier',tracking:'synthetic-mallet-109',evidence:'Carrier scanned the sealed return'}
export const rmaActor=actor=>({id:actor.id,name:actor.name,role:actor.role})

// Reload both public projections and compare custody with the independently entered
// inputs and the original purchase, goods receipt, installed lot and repair.
export async function rmaReadback(h,f,id,{by,authorization=null,shipment=null,disposition=null}){
 const state=await h.state(),report=(await h.api('/api/mallet/supplier-returns')).find(r=>r.id===id),record=state.records.stockRma.find(r=>r.id===id)
 const expected={id,reference:f.input.reference,kind:'warranty',itemId:f.item.id,binId:f.bin.id,lotId:f.lot.id,purchaseId:f.po.id,purchaseReceiptId:f.receipt.id,stockUseId:f.use.id,jobId:f.job.id,warrantyId:f.warranty.id,quantityMilli:1000,supplier:'Cedar Parts',serial:'synthetic-mallet-116',supplierLot:'synthetic-mallet-102',unitCostCents:1000,originalCostCents:1000,expectedCreditCents:1500,reason:f.input.reason,removalEvidence:f.input.evidence,by,at:rmaClock,authorization,shipment,disposition}
 for(const row of [record,report]){
  assert.ok(row,'The saved RMA is visible through both public read doors')
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key=>[key,row[key]])),expected)
 }
 assert.equal(state.records.purchaseReceipt.find(r=>r.id===f.receipt.id).purchaseId,f.po.id)
 assert.equal(state.records.stockLot.find(r=>r.id===f.lot.id).purchaseReceiptId,f.receipt.id)
 assert.equal(state.records.stockUse.find(r=>r.id===f.use.id).jobId,f.job.id)
 return {record,report}
}

export async function refuseRmaChange(h,command,input,options={}){
 const records=(await h.state()).records,report=await h.api('/api/mallet/supplier-returns')
 await h.command(command,input,{status:409,...options})
 assert.deepEqual((await h.state()).records,records,'Refused RMA action leaves original custody, stock, financial records and events unchanged')
 assert.deepEqual(await h.api('/api/mallet/supplier-returns'),report)
}
export async function rmaFixture(h){
 const f=await inventoryFixture(h)
 let po=await h.command('purchase.create',{reference:'synthetic-mallet-100',supplier:'Cedar Parts',shipTo:'Shelf A',expectedAt:'2026-10-23T12:00:00Z',taxCents:0,freightCents:0,lines:[{itemId:f.item.id,quantity:2,unitCents:1000}]})
 po=await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Buy traced supplier pads'})
 const receipt=await h.command('purchase.receive',{purchaseId:po.id,version:po.version,lineId:po.lines[0].id,...f.scans,quantity:2,reference:'synthetic-mallet-101'})
 const lotInput={...f.scans,purchaseReceiptId:receipt.id,quantity:1,supplier:'Cedar Parts',supplierLot:'synthetic-mallet-102',serial:'synthetic-mallet-116',reference:'synthetic-mallet-103',unitCostCents:1000,evidence:'Original PO goods receipt identified by marked lot'}
 const lot=await h.command('stock.lot',lotInput),secondLot=await h.command('stock.lot',{...lotInput,serial:'',reference:'synthetic-mallet-117'})
 let {job}=await booking(h),q=await authorise(h,await estimate(h,job));job=(await h.state()).records.job[0]
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1})
 const use=await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:lot.id,quantity:1,reference:'synthetic-mallet-104',reason:'Installed one supplier-marked pad'})
 await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-105',evidence:'Original customer tender recorded'})
 const terms=await h.command('warranty.terms',termsInput(invoice)),input=await openInput(h,{job},terms)
 let warranty=await h.command('warranty.open',input)
 warranty=await h.command('warranty.decide',{warrantyId:warranty.id,version:warranty.version,outcome:'covered',responsibility:'supplier',reason:'Supplier pad failed in covered service'})
 const rework=await noChargeWork(h,warranty)
 for(const [n,actual]of rework.actuals.entries())warranty=await h.command('warranty.cost',{warrantyId:warranty.id,version:warranty.version,actualId:actual.id,amountCents:n?2000:1500,evidence:'Recorded no-charge rework cost'})
 return {...f,lot,secondLot,lotInput,po,receipt,job,use,invoice,warranty,input:{lotId:lot.id,stockUseId:use.id,warrantyId:warranty.id,kind:'warranty',quantity:1,expectedCreditCents:1500,reference:'synthetic-mallet-106',reason:'Failed installed pad bonding',evidence:'Technician removed and sealed failed pad in quarantine'}}
}
export async function rmaJourney(h){
 const f=await rmaFixture(h),member=await h.person(['synthetic-mallet-118','example.test'].join('@')),advisor=await h.person(['synthetic-mallet-119','example.test'].join('@'),'admin')
 const ownerBy=rmaActor((await h.state()).actor),advisorBy=rmaActor((await h.state({as:advisor.cookie})).actor)
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].onHandMilli,1000,'Attaching PO provenance did not receive stock twice')
 await h.command('stock.lot',{...f.lotInput,reference:'synthetic-mallet-107'},{status:409})
 for(const command of ['stock.rmaOpen','stock.rmaAuthorize','stock.rmaShip','stock.rmaDispose','stock.rmaCredit'])for(const options of [{as:'',status:401},{as:member.cookie,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await refuseRmaChange(h,command,f.input,options)
 let rma=await h.command('stock.rmaOpen',f.input),refs=()=>({rmaId:rma.id,version:rma.version})
 const expected={by:ownerBy}
 await rmaReadback(h,f,rma.id,expected)
 const quarantineCount=await h.command('stock.count',{...f.scans,mode:'cycle',quantity:2,reason:'Do not count a removed quarantined serial as another available unit'})
 assert.equal((await h.command('stock.approveCount',{countId:quarantineCount.id,version:quarantineCount.version,lotId:f.lot.id,reason:'The removed serial is still in quarantine'},{status:409})).error,'SERIAL_CONFLICT')
 assert.equal(rma.purchaseId,f.po.id);assert.equal(rma.stockUseId,f.use.id);assert.equal(rma.jobId,f.job.id);assert.equal(rma.unitCostCents,1000)
 await h.command('stock.rmaOpen',{...f.input,reference:'synthetic-mallet-108'},{status:409})
 let report=(await h.api('/api/mallet/supplier-returns'))[0];assert.equal(report.quarantinedMilli,1000);assert.equal(report.reworkCostCents,3500);assert.equal((await h.api('/api/mallet/inventory')).balances[0].onHandMilli,1000,'Removed installed stock is unavailable quarantine, never a second stock receipt')
 await refuseRmaChange(h,'stock.rmaDispose',{...refs(),outcome:'restocked',reason:'Cannot sell a failed installed part',evidence:'Failed pad'})
 await refuseRmaChange(h,'stock.rmaShip',{...refs(),...rmaShipment,evidence:'No RMA yet'})
 rma=await h.command('stock.rmaAuthorize',{...refs(),...rmaAuthorization},{as:advisor.cookie})
 expected.authorization={...rmaAuthorization,by:advisorBy,at:rmaClock}
 await rmaReadback(h,f,rma.id,expected)
 await refuseRmaChange(h,'stock.rmaAuthorize',{...refs(),number:'synthetic-mallet-120',label:'Replacement label',evidence:'Cannot replace original authorization'})
 await h.api('/auth/operator/status',{operatorId:advisor.id,status:'inactive'})
 await h.api('/api/mallet/supplier-returns',undefined,{as:advisor.cookie,status:401})
 await refuseRmaChange(h,'stock.rmaShip',{...refs(),...rmaShipment},{as:advisor.cookie,status:401})
 rma=await h.command('stock.rmaShip',{...refs(),...rmaShipment})
 expected.shipment={...rmaShipment,quantityMilli:1000,by:ownerBy,at:rmaClock}
 await rmaReadback(h,f,rma.id,expected)
 await refuseRmaChange(h,'stock.rmaShip',{...refs(),carrier:'Carrier',tracking:'synthetic-mallet-112',evidence:'Cannot ship twice'})
 await rmaReadback(h,f,rma.id,expected)
 const credit={...refs(),reference:'synthetic-mallet-113',amountCents:1000,reason:'Partial credit: supplier excluded labor and a portion of part cost',evidence:'Supplier partial credit document'}
 const receipt=await h.command('stock.rmaCredit',credit);assert.deepEqual(await h.command('stock.rmaCredit',credit),receipt);await h.command('stock.rmaCredit',{...credit,amountCents:1500},{status:409})
 await rmaReadback(h,f,rma.id,expected)
 report=(await h.api('/api/mallet/supplier-returns'))[0];assert.equal(report.quarantinedMilli,0);assert.equal(report.creditCents,1000);assert.equal(report.creditExposureCents,500);assert.equal(report.netWarrantyCostCents,2500);assert.deepEqual((await h.state()).records.invoice[0],f.invoice)
 let unused=await h.command('stock.rmaOpen',{...f.input,lotId:f.secondLot.id,stockUseId:null,warrantyId:null,kind:'unused',reference:'synthetic-mallet-114',reason:'Unneeded stock',evidence:'One unopened pad in quarantine'})
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].availableMilli,0)
 await h.command('stock.rmaDispose',{rmaId:unused.id,version:unused.version,outcome:'restocked',reason:'Inspection confirmed unopened undamaged stock',evidence:'Inspector retained package evidence'})
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].availableMilli,1000)
 const faulty=await h.command('stock.rmaOpen',{...f.input,lotId:f.secondLot.id,stockUseId:null,warrantyId:null,kind:'faulty',reference:'synthetic-mallet-115',reason:'Shelf damage',evidence:'Damaged remaining package'})
 await h.command('stock.rmaDispose',{rmaId:faulty.id,version:faulty.version,outcome:'destroyed',reason:'Supplier declined return',evidence:'Witnessed destruction'})
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].onHandMilli,0)
 const packet=await h.api('/api/mallet/warranty-patterns/'+f.warranty.id),cited=packet.evidence.find(c=>c.id===f.warranty.id);assert.deepEqual(cited.rmas,[rma]);assert.equal(cited.credits.reduce((n,c)=>n+c.amountCents,0),1000);assert.equal(cited.lot.serial,f.lot.serial)
 const before=(await h.state()).records,fresh=await installation({clock:rmaClock,bindings:{OWNER_EMAIL:['synthetic-mallet-121','example.test'].join('@')}})
 try{
  const freshActor=(await fresh.state()).actor;assert.notEqual(freshActor.id,ownerBy.id)
  await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,before);assert.deepEqual(await fresh.api('/api/mallet/supplier-returns'),await h.api('/api/mallet/supplier-returns'))
  await rmaReadback(fresh,f,rma.id,expected)
  await refuseRmaChange(fresh,'stock.rmaShip',{...refs(),carrier:'Carrier',tracking:'synthetic-mallet-112',evidence:'Restored shipment stays final'})
  await refuseRmaChange(fresh,'stock.rmaAuthorize',{...refs(),number:'synthetic-mallet-120',label:'Replacement label',evidence:'Restored authorization stays final'})
  await fresh.state({as:h.owner,status:401});await fresh.state({as:advisor.cookie,status:401})
  assert.equal((await fresh.state()).actor.id,freshActor.id)
 }finally{await fresh.close()}
 await h.api('/api/mallet/supplier-returns',undefined,{as:member.cookie,status:403});assert.equal((await h.state({as:member.cookie})).records.stockRma,undefined)
}
