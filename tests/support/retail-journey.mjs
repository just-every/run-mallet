import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
export async function retailFixture(h){
 await shopSetup(h)
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 const item=await h.command('stock.item',{sku:'synthetic-mallet-retail-1',barcode:'synthetic-mallet-retail-2',name:'Counter accessory',unit:'each'})
 const bin=await h.command('stock.bin',{code:'Counter shelf',barcode:'synthetic-mallet-retail-3'})
 const scans={itemBarcode:item.barcode,binBarcode:bin.barcode}
 await h.command('stock.receive',{...scans,quantity:5,expectedQuantity:5,reference:'synthetic-mallet-retail-4',reason:'Observed accessory delivery'})
 return {item,bin,scans,sale:{...scans,reference:'synthetic-mallet-retail-5',quantity:3,unitCents:99,cashCents:500}}
}
export async function retailJourney(h){
 const f=await retailFixture(h),member=await h.person('counter-member@example.test'),advisor=await h.person('counter-advisor@example.test','admin')
 const key=await h.command('agent.create',{label:'Counter authority boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 const denied=[{as:'',status:401},{as:member.cookie,status:403},{as:advisor.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}]
 const baseline=(await h.state()).records
 for(const options of denied)await h.command('retail.sell',f.sale,options)
 for(const input of [{...f.sale,quantity:6},{...f.sale,cashCents:1},{...f.sale,itemBarcode:'synthetic-mallet-absent'}])await h.command('retail.sell',input,{status:input.itemBarcode==='synthetic-mallet-absent'?404:input.cashCents===1?400:409})
 assert.deepEqual((await h.state()).records,baseline,'Refusals leave all product records unchanged')
 const sale=await h.command('retail.sell',f.sale),frozen=structuredClone(sale)
 assert.deepEqual([sale.subtotalCents,sale.salesTaxCents,sale.totalCents,sale.cashCents,sale.changeCents],[297,22,319,500,181])
 assert.deepEqual(await h.command('retail.sell',f.sale),sale,'Identical sale replay returns the immutable receipt')
 await h.command('retail.sell',{...f.sale,unitCents:100},{status:409})
 const input={saleId:sale.id,reference:'synthetic-mallet-retail-6',quantity:1,reason:'Inspected saleable accessory and cash handed back',confirm:'saleable-cash-returned'}
 for(const options of denied)await h.command('retail.return',input,options)
 for(const options of denied.slice(0,4)){const response=await h.request('/api/mallet/retail',options);assert.equal(response.status,options.status)}
 const partial=await h.command('retail.return',input)
 assert.deepEqual([partial.subtotalCents,partial.salesTaxCents,partial.totalCents],[99,7,106])
 assert.deepEqual(await h.command('retail.return',input),partial)
 const before=(await h.state()).records
 await h.command('retail.return',{...input,quantity:2},{status:409})
 await h.command('retail.return',{...input,reference:'synthetic-mallet-retail-7',quantity:3},{status:409})
 await h.command('retail.return',{...input,reference:'synthetic-mallet-retail-7',confirm:'no'},{status:409})
 assert.deepEqual((await h.state()).records,before)
 await h.command('tax.configure',{ratePercent:20,partsTaxable:true,laborTaxable:false})
 let report=await h.api('/api/mallet/retail'),inventory=await h.api('/api/mallet/inventory')
 assert.deepEqual([report.sales.length,report.returns.length,report.netCashCents],[1,1,213])
 assert.equal(inventory.balances.find(b=>b.itemId===f.item.id&&b.binId===f.bin.id).onHandMilli,3000)
 assert.deepEqual(report.sales[0],frozen)
 assert.equal((await h.state()).records.job?.length??0,0,'Counter trading creates no repair')
 assert.equal(inventory.movements.filter(m=>m.source.kind.startsWith('retail')).length,2)
 const privateView=await h.state({as:advisor.cookie});assert.equal(privateView.records.retailSale,undefined);assert.equal(privateView.records.retailReturn,undefined)
 assert.ok(!privateView.records.event.some(e=>e.kind.startsWith('retail.')))
 const audit=await h.api('/api/mallet/audit?format=json');assert.ok(JSON.stringify(audit).includes(sale.id),'Attributable receipt changes reach private audit')
 const saved=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'fresh-counter-owner@example.test'}})
 try{
  await restore(fresh,saved)
  report=await fresh.api('/api/mallet/retail')
  assert.deepEqual(report.sales,[frozen]);assert.deepEqual(report.returns,[partial]);assert.equal(report.netCashCents,213)
  assert.notEqual((await fresh.state()).actor.id,(await h.state()).actor.id)
  await fresh.state({as:h.owner,status:401})
  assert.deepEqual(await fresh.command('retail.sell',f.sale),frozen,'Historical retry under fresh authority never moves stock twice')
  const rest=await fresh.command('retail.return',{...input,reference:'synthetic-mallet-retail-8',quantity:2})
  assert.deepEqual([rest.subtotalCents,rest.salesTaxCents,rest.totalCents],[198,15,213])
  report=await fresh.api('/api/mallet/retail');assert.equal(report.netCashCents,0)
  inventory=await fresh.api('/api/mallet/inventory');assert.equal(inventory.balances.find(b=>b.itemId===f.item.id&&b.binId===f.bin.id).onHandMilli,5000)
  await fresh.command('retail.return',{...input,reference:'synthetic-mallet-retail-9'},{status:409})
 }finally{await fresh.close()}
 // A traced accessory consumes only its selected lot, with the same return custody.
 const lot=await h.command('stock.lot',{...f.scans,quantity:2,reference:'synthetic-mallet-retail-10',supplier:'Synthetic supplier',supplierLot:'synthetic-mallet-retail-11',unitCostCents:50,evidence:'Observed marked lot'})
 const traced=await h.command('retail.sell',{...f.sale,reference:'synthetic-mallet-retail-12',lotId:lot.id,quantity:2})
 assert.equal((await h.api('/api/mallet/trace?q='+lot.supplierLot)).lots[0].remainingMilli,0)
 await h.command('retail.return',{...input,saleId:traced.id,reference:'synthetic-mallet-retail-13'})
 assert.equal((await h.api('/api/mallet/trace?q='+lot.supplierLot)).lots[0].remainingMilli,1000)
}
