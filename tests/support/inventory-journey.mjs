import assert from 'node:assert/strict'
import {booking,archive,restore,installation} from '../harness.mjs'
// These expectations come from the entered shipment and physical recount, before any other stock workflow.
export function assertInventoryReconciliation(report,{item,bin,receiptId,receiver,receiptNote,countId,counter,countNote,approver,approvalReason,reservedMilli=0}){
 assert.equal(report.receipts.length,1,'The receiving report retains exactly one shipment')
 const receipt=report.receipts[0]
 assert.deepEqual({id:receipt.id,itemId:receipt.itemId,binId:receipt.binId,reference:receipt.reference,expectedMilli:receipt.expectedMilli,quantityMilli:receipt.quantityMilli,shortageMilli:receipt.shortageMilli,reason:receipt.reason,by:receipt.by},
  {id:receiptId,itemId:item.id,binId:bin.id,reference:'synthetic-mallet-4',expectedMilli:10000,quantityMilli:9000,shortageMilli:1000,reason:receiptNote,by:receiver})
 const movements=[{itemId:item.id,binId:bin.id,deltaMilli:9000,source:{kind:'receipt',id:receiptId},reason:receiptNote,by:receiver}]
 if(countId){
  assert.equal(report.counts.length,1,'The variance report retains exactly one count')
  const count=report.counts[0]
  assert.deepEqual({id:count.id,itemId:count.itemId,binId:count.binId,mode:count.mode,countedMilli:count.countedMilli,expectedMilli:count.expectedMilli,movementCount:count.movementCount,reason:count.reason,by:count.by,varianceMilli:count.varianceMilli},
   {id:countId,itemId:item.id,binId:bin.id,mode:'blind',countedMilli:8000,expectedMilli:9000,movementCount:1,reason:countNote,by:counter,varianceMilli:-1000})
  const adjustment=report.movements.find(m=>m.source.kind==='count'&&m.source.id===countId)
  assert.ok(adjustment,'The count has its own linked movement')
  assert.deepEqual(count.approval,{by:approver,at:adjustment.at,reason:approvalReason,movementId:adjustment.id})
  assert.match(count.approval.at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  movements.push({itemId:item.id,binId:bin.id,deltaMilli:-1000,source:{kind:'count',id:countId},reason:approvalReason,by:approver})
 }else assert.deepEqual(report.counts,[])
 const bySource=(a,b)=>a.source.kind.localeCompare(b.source.kind)
 assert.deepEqual(report.movements.map(({itemId,binId,deltaMilli,source,reason,by})=>({itemId,binId,deltaMilli,source,reason,by})).sort(bySource),movements.sort(bySource),'Every receipt and variance has exactly one movement with its exact source and identities')
 assert.equal(report.movements.find(m=>m.source.kind==='receipt'&&m.source.id===receiptId).at,receipt.at)
 const onHandMilli=countId?8000:9000
 assert.deepEqual(report.balances,[{itemId:item.id,binId:bin.id,onHandMilli,reservedMilli,availableMilli:onHandMilli-reservedMilli,sku:item.sku,item:item.name,bin:bin.code}])
 assert.equal(report.movements.reduce((n,m)=>n+m.deltaMilli,0),onHandMilli)
 assert.equal(report.receipts.reduce((n,r)=>n+r.quantityMilli,0)+report.counts.filter(c=>c.approval).reduce((n,c)=>n+c.varianceMilli,0),onHandMilli)
}
export async function inventoryFixture(h){
 const item=await h.command('stock.item',{sku:'synthetic-mallet-1',barcode:'synthetic-mallet-2',name:'Brake pads',unit:'each'}),bin=await h.command('stock.bin',{code:'Shelf A',barcode:'synthetic-mallet-3'})
 return {item,bin,scans:{itemBarcode:item.barcode,binBarcode:bin.barcode}}
}
export async function inventoryJourney(h){
 const {item,bin,scans}=await inventoryFixture(h),{job}=await booking(h),member=await h.person('stock-tech@example.test'),admin=await h.person('stock-advisor@example.test','admin'),key=await h.command('agent.create',{label:'Stock boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 const receive={...scans,expectedQuantity:10,quantity:9,reference:'synthetic-mallet-4',reason:'One unit missing from labeled shipment'}
 const before=(await h.state()).records
 for(const opts of [{as:'',status:401},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('stock.receive',receive,opts)
 for(const command of ['stock.item','stock.bin','stock.reserve','stock.release','stock.count','stock.approveCount'])await h.command(command,{}, {as:member.cookie,status:403})
 await h.command('stock.receive',{...receive,quantity:-1},{status:400});await h.command('stock.receive',{...receive,quantity:1.0001},{status:400});await h.command('stock.receive',{...receive,binBarcode:'synthetic-mallet-unknown'},{status:404})
 assert.deepEqual((await h.state()).records,before)
 const actor=({id,name,role})=>({id,name,role}),receiver=actor((await h.state({as:admin.cookie})).actor),counter=actor((await h.state()).actor),receivedAfter=Date.now()
 const receipt=await h.command('stock.receive',receive,{as:admin.cookie});assert.equal(receipt.shortageMilli,1000);assert.equal(receipt.by.id,admin.id)
 const expected={item,bin,receiptId:receipt.id,receiver,receiptNote:receive.reason}
 let report=await h.api('/api/mallet/inventory');assertInventoryReconciliation(report,expected)
 assert.ok(Date.parse(report.receipts[0].at)>=receivedAfter&&Date.parse(report.receipts[0].at)<=Date.now())
 await h.command('stock.receive',receive,{status:409});assert.deepEqual(await h.api('/api/mallet/inventory'),report,'Duplicate receipt preserves both reports and every movement');await h.command('stock.item',{sku:'SYNTHETIC-MALLET-1',barcode:'other',name:'Duplicate',unit:'each'},{status:409})
 const reserved=await h.command('stock.reserve',{...scans,jobId:job.id,quantity:3,reference:'synthetic-mallet-5'})
 report=await h.api('/api/mallet/inventory');assert.deepEqual(report.balances[0],{itemId:item.id,binId:bin.id,onHandMilli:9000,reservedMilli:3000,availableMilli:6000,sku:item.sku,item:item.name,bin:bin.code})
 await h.command('stock.reserve',{...scans,jobId:job.id,quantity:7,reference:'synthetic-mallet-6'},{status:409})
 const blind=await (await h.request('/app/inventory/count')).text();assert.ok(!blind.includes('On hand 9'));assert.ok(!blind.includes('Expected 9'))
 let count=await h.command('stock.count',{...scans,mode:'blind',quantity:8,reason:'Physical shortage counted'})
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].onHandMilli,9000,'A count never changes stock before approval')
 const beforeStale=await h.api('/api/mallet/inventory')
 await h.command('stock.approveCount',{countId:count.id,version:2,reason:'Stale approval'},{status:409})
 assert.deepEqual(await h.api('/api/mallet/inventory'),beforeStale,'Wrong-version approval changes no stock or report')
 const approvedAfter=Date.now()
 count=await h.command('stock.approveCount',{countId:count.id,version:count.version,reason:'Recount confirmed one missing unit'},{as:admin.cookie});assert.equal(count.varianceMilli,-1000);assert.equal(count.approval.by.id,admin.id)
 report=await h.api('/api/mallet/inventory')
 assertInventoryReconciliation(report,{...expected,countId:count.id,counter,countNote:'Physical shortage counted',approver:receiver,approvalReason:'Recount confirmed one missing unit',reservedMilli:3000})
 assert.ok(Date.parse(report.counts[0].approval.at)>=approvedAfter&&Date.parse(report.counts[0].approval.at)<=Date.now())
 await h.command('stock.approveCount',{countId:count.id,version:count.version,reason:'Cannot apply twice'},{status:409})
 assert.deepEqual(await h.api('/api/mallet/inventory'),report,'Duplicate approval preserves both reports and every movement')
 let cycle=await h.command('stock.count',{...scans,mode:'cycle',quantity:1,reason:'Would destroy reserved stock'})
 const beforeLow=await h.api('/api/mallet/inventory')
 await h.command('stock.approveCount',{countId:cycle.id,version:cycle.version,reason:'Too low'},{status:409})
 assert.deepEqual(await h.api('/api/mallet/inventory'),beforeLow,'Refused below-reserved adjustment changes no stock or report')
 cycle=await h.command('stock.count',{...scans,mode:'cycle',quantity:7,reason:'Cycle count before later arrival'})
 await h.command('stock.receive',{...receive,expectedQuantity:.5,quantity:.5,reference:'synthetic-mallet-7'})
 const beforeMoved=await h.api('/api/mallet/inventory')
 await h.command('stock.approveCount',{countId:cycle.id,version:cycle.version,reason:'Stale after receiving'},{status:409})
 assert.deepEqual(await h.api('/api/mallet/inventory'),beforeMoved,'Intervening receipt invalidates approval without changing stock or reports')
 await h.command('stock.release',{reservationId:reserved.id,version:reserved.version,reason:'Repair no longer needs reserved units'})
 await h.command('stock.release',{reservationId:reserved.id,version:2,reason:'Duplicate release'},{status:409})
 report=await h.api('/api/mallet/inventory');assert.equal(report.balances[0].onHandMilli,8500);assert.equal(report.balances[0].availableMilli,8500)
 assert.equal(report.movements.reduce((n,m)=>n+m.deltaMilli,0),report.balances[0].onHandMilli);assert.equal(report.receipts.reduce((n,r)=>n+r.quantityMilli,0)+report.counts.filter(c=>c.approval).reduce((n,c)=>n+c.varianceMilli,0),8500)
 for(const opts of [{as:member.cookie},agent]){await h.api('/api/mallet/inventory',undefined,{...opts,status:403});assert.equal((await h.state(opts)).records.stockItem,undefined);assert.equal((await h.request('/app/inventory',opts)).status,403)}
 const saved=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'stock-recovery@example.test'}})
 try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records,saved);assert.deepEqual(await fresh.api('/api/mallet/inventory'),report);await fresh.state({as:h.owner,status:401});await fresh.state({...agent,status:401});await fresh.command('stock.receive',{...receive,reference:'synthetic-mallet-8'});assert.equal((await fresh.api('/api/mallet/inventory')).balances[0].onHandMilli,17500)}finally{await fresh.close()}
}
