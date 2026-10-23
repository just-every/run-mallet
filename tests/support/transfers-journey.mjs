import assert from 'node:assert/strict'
import {archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
export async function transferFixture(h){
 const f=await inventoryFixture(h),destination=await h.command('stock.bin',{code:'Receiving B',barcode:'synthetic-mallet-120'})
 await h.command('stock.location',{binId:f.bin.id,version:f.bin.version,location:'Shop A'});await h.command('stock.location',{binId:destination.id,version:destination.version,location:'Shop B'})
 const lots=[];for(const n of [1,2])lots.push(await h.command('stock.lot',{...f.scans,quantity:1,serial:'synthetic-mallet-'+(120+n),supplier:'Cedar Parts',supplierLot:'synthetic-mallet-123',reference:'synthetic-mallet-'+(123+n),unitCostCents:1000+n,evidence:'Serialized supplier receipt'}))
 return {...f,destination,lots,input:{reference:'synthetic-mallet-126',destinationBinId:destination.id,lines:lots.map(l=>({lotId:l.id,quantity:1})),reason:'Move serialized parts from Shop A to Shop B'}}
}
export async function transfersJourney(h){
 const f=await transferFixture(h),member=await h.person('transfer-tech@example.test'),admin=await h.person('transfer-advisor@example.test','admin')
 for(const command of ['stock.location','stock.transferRequest','stock.transferApprove','stock.transferDispatch','stock.transferReceive','stock.transferCorrect'])for(const options of [{as:'',status:401},{as:member.cookie,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,f.input,options)
 await h.command('stock.transferRequest',{...f.input,lines:[f.input.lines[0],f.input.lines[0]]},{status:409});await h.command('stock.transferRequest',{...f.input,lines:[{lotId:f.lots[0].id,quantity:.5}]},{status:409})
 let transfer=await h.command('stock.transferRequest',f.input),refs=()=>({transferId:transfer.id,version:transfer.version})
 const balance=async()=> (await h.api('/api/mallet/inventory')).balances.filter(b=>b.itemId===f.item.id)
 assert.deepEqual((await balance()).map(b=>b.onHandMilli).sort(),[0,2000])
 await h.command('stock.transferDispatch',{...refs(),evidence:'Not approved'},{status:409})
 transfer=await h.command('stock.transferApprove',{...refs(),reason:'Approve exact serial, source, destination and cost custody'},{as:admin.cookie});assert.equal(transfer.approval.lines[0].unitCostCents,1001)
 transfer=await h.command('stock.transferDispatch',{...refs(),evidence:'Driver signed for two sealed serialized units'})
 assert.deepEqual((await balance()).map(b=>b.onHandMilli),[0,0]);let report=(await h.api('/api/mallet/transfers'))[0];assert.deepEqual(report.lines.map(l=>l.inTransitMilli),[1000,1000])
 await h.command('stock.transferDispatch',{...refs(),evidence:'Cannot dispatch twice'},{status:409})
 await h.command('stock.transferReceive',{...refs(),lines:transfer.lines.map(l=>({lineId:l.id,received:2,damaged:0})),evidence:'Over receipt'},{status:409})
 transfer=await h.command('stock.transferReceive',{...refs(),lines:transfer.lines.map((l,n)=>({lineId:l.id,received:n?0:1,damaged:0})),evidence:'One sealed unit received; second unit missing'})
 report=(await h.api('/api/mallet/transfers'))[0];assert.equal(report.status,'exception');assert.deepEqual(report.lines.map(l=>[l.receivedMilli,l.inTransitMilli]),[[1000,0],[0,1000]])
 let balances=await balance();assert.equal(balances.find(b=>b.binId===f.bin.id).onHandMilli,0);assert.equal(balances.find(b=>b.binId===f.destination.id).onHandMilli,1000)
 const ex=report.exceptions[0],correction={...refs(),exceptionId:ex.id,outcome:'received',reason:'Carrier found the original missing serial',evidence:'Destination scanned the missing original serial'}
 await h.command('stock.transferCorrect',{...correction,version:1},{status:409})
 transfer=await h.command('stock.transferCorrect',correction,{as:admin.cookie});await h.command('stock.transferCorrect',{...correction,version:transfer.version},{status:409})
 report=(await h.api('/api/mallet/transfers'))[0];assert.equal(report.status,'resolved');assert.equal(report.exceptions[0].correction.approvedBy.id,admin.id);assert.deepEqual(report.lines.map(l=>l.inTransitMilli),[0,0]);assert.equal((await balance()).find(b=>b.binId===f.destination.id).onHandMilli,2000)
 let trace=await h.api('/api/mallet/trace?q=synthetic-mallet-123');for(const original of f.lots){assert.equal(trace.lots.filter(l=>l.serial===original.serial).reduce((n,l)=>n+l.remainingMilli,0),1000);const child=trace.lots.find(l=>l.parentLotId===original.id);assert.equal(child.binId,f.destination.id);assert.equal(child.unitCostCents,original.unitCostCents);assert.deepEqual(child.catalog,original.catalog)}
 // A damaged physical receipt stays out of availability until an explicit inspected correction.
 const children=trace.lots.filter(l=>l.transferId===transfer.id)
 let back=await h.command('stock.transferRequest',{reference:'synthetic-mallet-127',destinationBinId:f.bin.id,lines:children.map(l=>({lotId:l.id,quantity:1})),reason:'Return custody to Shop A'})
 back=await h.command('stock.transferApprove',{transferId:back.id,version:back.version,reason:'Exact return serials'})
 back=await h.command('stock.transferDispatch',{transferId:back.id,version:back.version,evidence:'Return driver custody'})
 back=await h.command('stock.transferReceive',{transferId:back.id,version:back.version,lines:back.lines.map((l,n)=>({lineId:l.id,received:0,damaged:n?0:1})),evidence:'First damaged, second missing'})
 const exceptions=(await h.api('/api/mallet/transfers')).find(t=>t.id===back.id).exceptions
 assert.equal((await balance()).reduce((n,b)=>n+b.availableMilli,0),0)
 for(const exception of exceptions){back=await h.command('stock.transferCorrect',{transferId:back.id,version:back.version,exceptionId:exception.id,outcome:exception.kind==='damaged'?'destroyed':'returned',reason:'Approved documented '+exception.kind+' custody',evidence:'Witnessed disposition and original serial'})}
 assert.equal((await balance()).reduce((n,b)=>n+b.onHandMilli,0),1000)
 const final=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'transfer-recovery@example.test'}})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,final);assert.deepEqual(await fresh.api('/api/mallet/transfers'),await h.api('/api/mallet/transfers'));await fresh.command('stock.transferReceive',{...refs(),lines:[],evidence:'No duplicate receipt after restore'},{status:409})}finally{await fresh.close()}
 await h.api('/api/mallet/transfers',undefined,{as:member.cookie,status:403});assert.equal((await h.state({as:member.cookie})).records.stockTransfer,undefined)
}
