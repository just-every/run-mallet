import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
export async function replenishmentFixture(h){
 const f=await inventoryFixture(h),{job:booked}=await booking(h),q=await authorise(h,await estimate(h,booked))
 let job=(await h.state()).records.job[0]
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:2})
 const lot=await h.command('stock.lot',{...f.scans,quantity:3,supplier:'Cedar Parts',supplierLot:'synthetic-mallet-70',serial:'',reference:'synthetic-mallet-71',unitCostCents:1000,evidence:'Synthetic supplier lot'})
 const po=await h.command('purchase.create',{reference:'synthetic-mallet-72',supplier:'Cedar Parts',shipTo:'Shelf A',expectedAt:'2026-11-01T12:00:00Z',binId:f.bin.id,lines:[{itemId:f.item.id,quantity:2,unitCents:1000}],taxCents:0,freightCents:0})
 await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Outstanding stock order'})
 await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:lot.id,quantity:2,reference:'synthetic-mallet-73',reason:'Installed pads'})
 return {...f,job,lot,policy:{itemId:f.item.id,binId:f.bin.id,minimum:4,maximum:10,demand:1,supplier:'Cedar Parts',unitCents:1000,shipTo:'Shelf A',expectedAt:'2026-11-01T12:00:00Z'}}
}
export async function replenishmentJourney(h){
 const f=await replenishmentFixture(h),member=await h.person('stock-demand@example.test')
 for(const command of ['stock.replenishment','stock.replenish'])for(const options of [{as:'',status:401},{as:member.cookie,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,f.policy,options)
 await h.command('stock.replenishment',{...f.policy,minimum:11},{status:400})
 let policy=await h.command('stock.replenishment',f.policy)
 let report=await h.api('/api/mallet/replenishment');assert.deepEqual(report.map(r=>[r.availableMilli,r.openOrderMilli,r.projectedMilli,r.suggestedMilli]),[[1000,2000,2000,8000]])
 const first=await h.command('stock.replenish'),second=await h.command('stock.replenish');assert.equal(first.placed,false);assert.deepEqual(second.drafts,first.drafts);assert.equal(first.drafts[0].lines[0].quantityMilli,8000);assert.equal(first.drafts[0].approval,null);assert.equal(first.drafts[0].totalCents,8000)
 let po=first.drafts[0]
 const reserve=await h.command('stock.reserve',{...f.scans,jobId:f.job.id,quantity:1,reference:'synthetic-mallet-74'})
 await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Stale demand'},{status:409})
 const refreshed=await h.command('stock.replenish');po=refreshed.drafts[0];assert.equal(po.lines[0].quantityMilli,9000);assert.notEqual(po.id,first.drafts[0].id)
 await h.command('purchase.approve',{purchaseId:first.drafts[0].id,version:2,reason:'Superseded draft'},{status:409})
 policy=await h.command('stock.replenishment',{...f.policy,version:policy.version,unitCents:1100})
 await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Stale price'},{status:409})
 po=(await h.command('stock.replenish')).drafts[0];assert.equal(po.totalCents,9900)
 po=await h.command('purchase.approve',{purchaseId:po.id,version:po.version,reason:'Approve exact refreshed cart'})
 assert.equal(po.approval.totalCents,9900);assert.deepEqual(po.approval.lines,po.lines)
 assert.deepEqual((await h.command('stock.replenish')).drafts,[])
 report=await h.api('/api/mallet/replenishment');assert.equal(report[0].openOrderMilli,11000);assert.equal(report[0].suggestedMilli,0);assert.equal((await h.state()).records.purchaseOrder.filter(p=>p.approval).length,2)
 assert.equal((await h.request('/app/inventory/replenishment',{as:member.cookie})).status,403);await h.api('/api/mallet/replenishment',undefined,{as:member.cookie,status:403});assert.equal((await h.state({as:member.cookie})).records.stockReplenishment,undefined)
 const records=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'replenishment-recovery@example.test'}})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,records);assert.deepEqual(await fresh.api('/api/mallet/replenishment'),report);assert.deepEqual((await fresh.command('stock.replenish')).drafts,[])}finally{await fresh.close()}
 assert.equal(h.messages.length,1,'Only the staff invitation; no supplier order has been sent')
 // The same unlocated stock order cannot reduce demand at two locations.
 const bin=await h.command('stock.bin',{code:'Shelf B',barcode:'synthetic-mallet-75'})
 await h.command('stock.replenishment',{...f.policy,binId:bin.id,demand:0})
 const unlocated=await h.command('purchase.create',{reference:'synthetic-mallet-76',supplier:'Cedar Parts',shipTo:'Receiving',expectedAt:f.policy.expectedAt,lines:[{itemId:f.item.id,quantity:1,unitCents:1000}],taxCents:0,freightCents:0})
 await h.command('purchase.approve',{purchaseId:unlocated.id,version:unlocated.version,reason:'One unlocated stock unit'})
 report=await h.api('/api/mallet/replenishment');assert.equal(report.reduce((n,r)=>n+r.openOrderMilli,0),12000)
}
