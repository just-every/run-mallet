import assert from 'node:assert/strict'
import {booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
export async function traceFixture(h){
 const {item,bin,scans}=await inventoryFixture(h),replacement=await h.command('stock.item',{sku:'synthetic-mallet-30',barcode:'synthetic-mallet-31',name:'Updated brake pad',unit:'each'})
 const catalog={itemId:item.id,version:item.version,name:'Brake pads',crossReferences:'Supplier A: synthetic-mallet-32\nOEM: synthetic-mallet-33',fitment:'Shop declared: 2019 Honda CR-V EX',costCents:1001,sellCents:2500,warranty:'Shop declared 12-month part warranty',supersededBy:replacement.id}
 const lot={...scans,quantity:2,supplier:'Cedar Parts',supplierLot:'synthetic-mallet-34',serial:'',reference:'synthetic-mallet-35',unitCostCents:1001,evidence:'Supplier packing slip synthetic-mallet-35; lot marked on package'}
 return {item,bin,scans,replacement,catalog,lot}
}
export async function traceJourney(h){
 const f=await traceFixture(h),{bin,scans,replacement,catalog,lot}=f;let item=await h.command('stock.catalog',catalog)
 assert.equal(item.fitment,catalog.fitment);assert.equal(item.crossReferences,catalog.crossReferences);assert.equal(item.unit,'each');assert.equal(item.costCents,1001);assert.equal(item.sellCents,2500);assert.equal(item.warranty,catalog.warranty);assert.equal(item.supersededBy,replacement.id)
 await h.command('stock.catalog',{...catalog,version:1},{status:409});await h.command('stock.catalog',{...catalog,itemId:replacement.id,version:replacement.version,supersededBy:item.id},{status:409})
 const a=await h.command('stock.lot',lot),b=await h.command('stock.lot',{...lot,supplierLot:'synthetic-mallet-36',reference:'synthetic-mallet-37',unitCostCents:1500})
 await h.command('stock.lot',lot,{status:409})
 const serial=await h.command('stock.lot',{...lot,itemBarcode:replacement.barcode,quantity:1,serial:'synthetic-mallet-38',supplierLot:'synthetic-mallet-39',reference:'synthetic-mallet-40'})
 await h.command('stock.lot',{...lot,serial:'synthetic-mallet-38',quantity:1,reference:'synthetic-mallet-41'},{status:409})
 await h.command('stock.lot',{...lot,serial:'synthetic-mallet-42',quantity:2,reference:'synthetic-mallet-43'},{status:409})
 const one=await booking(h),other=await booking(h,{startAt:'2026-10-20T09:00:00+10:00',endAt:'2026-10-20T10:00:00+10:00',asset:await h.command('asset.create',{customerName:'Unaffected Customer',customerEmail:'unaffected@example.test',label:'Other vehicle',identifier:'OH-OTHER-1'})})
 const quote=await authorise(h,await estimate(h,one.job));let job=(await h.state()).records.job.find(j=>j.id===one.job.id)
 job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:quote.revisions[0].lines[0].id,quantity:1.5})
 const input={jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:a.id,quantity:1.5,reference:'synthetic-mallet-44',reason:'Technician identified installed brake pads from marked supplier lot'}
 const member=await h.person('trace-tech@example.test'),key=await h.command('agent.create',{label:'Trace boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}},before=(await h.state()).records
 for(const command of ['stock.catalog','stock.lot','stock.useLot'])for(const opts of [{as:'',status:401},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,input,opts)
 await h.command('stock.useLot',{...input,quantity:2},{status:409});await h.command('stock.useLot',{...input,jobId:other.job.id,version:other.job.version},{status:409});await h.command('stock.useLot',{...input,version:1},{status:409})
 assert.deepEqual((await h.state()).records,before)
 const use=await h.command('stock.useLot',input);assert.equal(use.costCents,1502);assert.equal(use.unitCostCents,1001);assert.equal(use.estimateId,quote.id)
 await h.command('stock.useLot',input,{status:409});await h.command('stock.useLot',{...input,reference:'synthetic-mallet-45',quantity:.001},{status:409})
 let report=await h.api('/api/mallet/trace?q='+a.supplierLot);assert.equal(report.lots.length,1);assert.equal(report.lots[0].remainingMilli,500);assert.equal(report.uses.length,1);assert.equal(report.uses[0].jobId,one.job.id);assert.equal(report.uses[0].identifier,one.asset.identifier);assert.ok(!report.uses.some(u=>u.jobId===other.job.id))
 assert.equal((await h.api('/api/mallet/trace?q='+b.supplierLot)).uses.length,0);assert.equal((await h.api('/api/mallet/trace?q='+serial.serial)).lots[0].id,serial.id)
 item=await h.command('stock.catalog',{...catalog,version:item.version,costCents:2000,warranty:'Revised warranty for new receipts'})
 report=await h.api('/api/mallet/trace?q='+a.supplierLot);assert.equal(report.lots[0].catalog.warranty,catalog.warranty);assert.equal(report.lots[0].catalog.costCents,1001);assert.equal(report.uses[0].costCents,1502)
 const count=await h.command('stock.count',{...scans,mode:'cycle',quantity:2.25,reason:'One quarter unit damaged during count'})
 await h.command('stock.approveCount',{countId:count.id,version:count.version,reason:'Must identify the affected tracked lot'},{status:409})
 await h.command('stock.approveCount',{countId:count.id,version:count.version,lotId:a.id,reason:'Confirmed shortage belongs to supplier lot synthetic-mallet-34'})
 report=await h.api('/api/mallet/trace?q='+a.supplierLot);assert.equal(report.lots[0].remainingMilli,250);assert.equal((await h.api('/api/mallet/inventory')).balances.find(b=>b.itemId===item.id).onHandMilli,2250)
 for(const opts of [{as:member.cookie},agent]){await h.api('/api/mallet/trace',undefined,{...opts,status:403});assert.equal((await h.request('/app/inventory/trace',opts)).status,403);assert.equal((await h.state(opts)).records.stockLot,undefined)}
 const final=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'trace-recovery@example.test'}})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,final);assert.deepEqual(await fresh.api('/api/mallet/trace?q='+a.supplierLot),report);await fresh.state({as:h.owner,status:401});await fresh.state({...agent,status:401});await fresh.command('stock.lot',{...lot,reference:'synthetic-mallet-46'});assert.equal((await fresh.api('/api/mallet/trace?q='+a.supplierLot)).lots.length,2)}finally{await fresh.close()}
}
