import assert from 'node:assert/strict'
import {booking,archive,restore,installation} from '../harness.mjs'
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
 const receipt=await h.command('stock.receive',receive,{as:admin.cookie});assert.equal(receipt.shortageMilli,1000);assert.equal(receipt.by.id,admin.id)
 await h.command('stock.receive',receive,{status:409});await h.command('stock.item',{sku:'SYNTHETIC-MALLET-1',barcode:'other',name:'Duplicate',unit:'each'},{status:409})
 const reserved=await h.command('stock.reserve',{...scans,jobId:job.id,quantity:3,reference:'synthetic-mallet-5'})
 let report=await h.api('/api/mallet/inventory');assert.deepEqual(report.balances[0],{itemId:item.id,binId:bin.id,onHandMilli:9000,reservedMilli:3000,availableMilli:6000,sku:item.sku,item:item.name,bin:bin.code})
 await h.command('stock.reserve',{...scans,jobId:job.id,quantity:7,reference:'synthetic-mallet-6'},{status:409})
 const blind=await (await h.request('/app/inventory/count')).text();assert.ok(!blind.includes('On hand 9'));assert.ok(!blind.includes('Expected 9'))
 let count=await h.command('stock.count',{...scans,mode:'blind',quantity:8,reason:'Physical shortage counted'})
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].onHandMilli,9000,'A count never changes stock before approval')
 await h.command('stock.approveCount',{countId:count.id,version:2,reason:'Stale approval'},{status:409})
 count=await h.command('stock.approveCount',{countId:count.id,version:count.version,reason:'Recount confirmed one missing unit'},{as:admin.cookie});assert.equal(count.varianceMilli,-1000);assert.equal(count.approval.by.id,admin.id)
 await h.command('stock.approveCount',{countId:count.id,version:count.version,reason:'Cannot apply twice'},{status:409})
 let cycle=await h.command('stock.count',{...scans,mode:'cycle',quantity:1,reason:'Would destroy reserved stock'})
 await h.command('stock.approveCount',{countId:cycle.id,version:cycle.version,reason:'Too low'},{status:409})
 cycle=await h.command('stock.count',{...scans,mode:'cycle',quantity:7,reason:'Cycle count before later arrival'})
 await h.command('stock.receive',{...receive,expectedQuantity:.5,quantity:.5,reference:'synthetic-mallet-7'})
 await h.command('stock.approveCount',{countId:cycle.id,version:cycle.version,reason:'Stale after receiving'},{status:409})
 await h.command('stock.release',{reservationId:reserved.id,version:reserved.version,reason:'Repair no longer needs reserved units'})
 await h.command('stock.release',{reservationId:reserved.id,version:2,reason:'Duplicate release'},{status:409})
 report=await h.api('/api/mallet/inventory');assert.equal(report.balances[0].onHandMilli,8500);assert.equal(report.balances[0].availableMilli,8500)
 assert.equal(report.movements.reduce((n,m)=>n+m.deltaMilli,0),report.balances[0].onHandMilli);assert.equal(report.receipts.reduce((n,r)=>n+r.quantityMilli,0)+report.counts.filter(c=>c.approval).reduce((n,c)=>n+c.varianceMilli,0),8500)
 for(const opts of [{as:member.cookie},agent]){await h.api('/api/mallet/inventory',undefined,{...opts,status:403});assert.equal((await h.state(opts)).records.stockItem,undefined);assert.equal((await h.request('/app/inventory',opts)).status,403)}
 const saved=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'stock-recovery@example.test'}})
 try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records,saved);assert.deepEqual(await fresh.api('/api/mallet/inventory'),report);await fresh.state({as:h.owner,status:401});await fresh.state({...agent,status:401});await fresh.command('stock.receive',{...receive,reference:'synthetic-mallet-8'});assert.equal((await fresh.api('/api/mallet/inventory')).balances[0].onHandMilli,17500)}finally{await fresh.close()}
}
