import assert from 'node:assert/strict'
import {booking,authorise,archive,restore,installation} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
export async function stockConsumptionJourney(h){
 await shopSetup(h)
 const one=await booking(h),two=await booking(h,{bayId:'Bay 2',technicianId:'synthetic-mallet-tech-2',asset:await h.command('asset.create',{customerName:'Second customer',customerEmail:'second@example.test',label:'Second repair',identifier:'synthetic-mallet-stock-1'})})
 await h.command('tax.configure',{ratePercent:0,partsTaxable:false,laborTaxable:false})
 const q=await authorise(h,await h.command('estimate.prepare',{jobId:one.job.id,version:one.job.version,lines:[{kind:'part',description:'Reserved replacement',quantity:1,unitCents:10000}]}))
 const item=await h.command('stock.item',{sku:'synthetic-mallet-stock-2',barcode:'synthetic-mallet-stock-3',name:'Replacement',unit:'each'}),bin=await h.command('stock.bin',{code:'Atomic shelf',barcode:'synthetic-mallet-stock-4'})
 const scans={itemBarcode:item.barcode,binBarcode:bin.barcode}
 const lot=await h.command('stock.lot',{...scans,quantity:1,reference:'synthetic-mallet-stock-5',supplier:'Synthetic supplier',supplierLot:'synthetic-mallet-stock-6',unitCostCents:4321,evidence:'Physical receipt and supplier label'})
 const reserve=await h.command('stock.reserve',{...scans,jobId:one.job.id,quantity:1,reference:'synthetic-mallet-stock-7'})
 await h.command('stock.reserve',{...scans,jobId:two.job.id,quantity:1,reference:'synthetic-mallet-stock-8'},{status:409})
 const job=(await h.state()).records.job.find(j=>j.id===one.job.id),input={jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1,reservationId:reserve.id,lotId:lot.id,stockReference:'synthetic-mallet-stock-9',stockEvidence:'Installed from exact reserved lot'}
 const before=await h.state()
 await h.command('work.record',{...input,lotId:'synthetic-mallet-missing'},{status:404});assert.deepEqual(await h.state(),before,'Failed stock commit records neither actual work nor release')
 const worked=await h.command('work.record',input)
 let state=await h.state(),use=state.records.stockUse.find(u=>u.jobId===job.id)
 assert.equal(worked.actuals.length,1);assert.equal(use.actualId,worked.actuals[0].id);assert.equal(use.costCents,4321);assert.equal(state.records.stockReservation.find(r=>r.id===reserve.id).release.kind,'consumed')
 assert.equal(state.records.stockMovement.filter(m=>m.itemId===item.id).reduce((n,m)=>n+m.deltaMilli,0),0)
 await h.command('work.record',input,{status:409})
 await h.command('stock.reserve',{...scans,jobId:two.job.id,quantity:1,reference:'synthetic-mallet-stock-8'},{status:409})
 const back={stockUseId:use.id,version:use.version,quantity:1,reference:'synthetic-mallet-stock-10',reason:'Removed unused replacement, inspected saleable and physically returned to original bin',confirm:'return-to-stock'}
 await h.command('stock.returnUse',{...back,quantity:2},{status:409})
 use=await h.command('stock.returnUse',back);await h.command('stock.returnUse',back)
 await h.command('stock.returnUse',{...back,version:use.version,reference:'synthetic-mallet-stock-11'},{status:409})
 const next=await h.command('stock.reserve',{...scans,jobId:two.job.id,quantity:1,reference:'synthetic-mallet-stock-8'})
 await h.command('flow.close',{jobId:two.job.id,version:two.job.version,outcome:'canceled',reason:'Customer canceled before installation'})
 state=await h.state();assert.equal(state.records.stockReservation.find(r=>r.id===next.id).release.kind,'cancellation');assert.equal(state.records.stockUse.length,1);assert.equal(state.records.stockMovement.filter(m=>m.source.kind==='return').length,1)
 assert.equal(state.records.job.find(j=>j.id===job.id).actuals.length,1,'A physical return does not silently reverse authorized work or invoice charges')
 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);const recovered=await fresh.state();for(const kind of ['stockReservation','stockUse','stockLot','stockMovement'])assert.deepEqual(recovered.records[kind],state.records[kind]);await fresh.command('stock.returnUse',{...back,version:use.version,reference:'synthetic-mallet-stock-12'},{status:409})}finally{await fresh.close()}
}
