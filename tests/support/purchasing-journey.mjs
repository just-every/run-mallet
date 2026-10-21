import assert from 'node:assert/strict'
import {booking,archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
export async function purchasingFixture(h){
 const {item,bin,scans}=await inventoryFixture(h),second=await h.command('stock.item',{sku:'synthetic-mallet-10',barcode:'synthetic-mallet-11',name:'Oil filters',unit:'each'}),{job}=await booking(h)
 const input={reference:'synthetic-mallet-12',supplier:'Cedar Parts',shipTo:'Receiving bench, 17 Cedar Rd',expectedAt:'2026-10-23T09:00:00-04:00',taxCents:750,freightCents:500,lines:[{itemId:item.id,quantity:2,unitCents:2500,jobId:job.id},{itemId:second.id,quantity:4,unitCents:1000}]}
 return {item,bin,scans,second,job,input}
}
export async function purchasingJourney(h){
 const {item,bin,second,job,input}=await purchasingFixture(h),member=await h.person('purchase-tech@example.test'),admin=await h.person('purchase-advisor@example.test','admin'),key=await h.command('agent.create',{label:'Purchasing boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}},before=(await h.state()).records
 for(const command of ['purchase.create','purchase.approve','purchase.receive','purchase.bill','purchase.close'])for(const opts of [{as:'',status:401},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,input,opts)
 await h.command('purchase.create',{...input,lines:[{...input.lines[0],quantity:-1}]},{status:400});await h.command('purchase.create',{...input,taxCents:-1},{status:400})
 assert.deepEqual((await h.state()).records,before)
 let po=await h.command('purchase.create',input),snapshot=structuredClone(po)
 assert.equal(po.totalCents,10250);assert.equal(po.shipTo,input.shipTo);assert.equal(po.expectedAt,'2026-10-23T13:00:00.000Z')
 await h.command('purchase.create',input,{status:409});let refs=()=>({purchaseId:po.id,version:po.version})
 const receipt=(line,item,quantity,reference)=>({...refs(),lineId:line.id,itemBarcode:item.barcode,binBarcode:bin.barcode,quantity,reference})
 await h.command('purchase.receive',receipt(po.lines[0],item,2,'synthetic-mallet-13'),{status:409})
 await h.command('purchase.approve',{...refs(),version:2,reason:'Stale'},{status:409})
 po=await h.command('purchase.approve',{...refs(),reason:'Approved exact two-line spend'},{as:admin.cookie});assert.deepEqual(po.approval.lines,snapshot.lines);assert.equal(po.approval.totalCents,10250);assert.equal(po.approval.by.id,admin.id)
 const refresh=async()=>{po=(await h.state()).records.purchaseOrder.find(x=>x.id===po.id)}
 await h.command('purchase.receive',receipt(po.lines[0],second,1,'synthetic-mallet-13'),{status:409});await h.command('purchase.receive',receipt(po.lines[0],item,3,'synthetic-mallet-13'),{status:409})
 await h.command('purchase.receive',receipt(po.lines[0],item,2,'synthetic-mallet-13'));await refresh()
 await h.command('purchase.receive',receipt(po.lines[1],second,1,'synthetic-mallet-14'));await refresh()
 let report=(await h.api('/api/mallet/purchasing'))[0];assert.deepEqual(report.lines.map(l=>[l.receivedMilli,l.backorderMilli]),[[2000,0],[1000,3000]])
 let stock=await h.api('/api/mallet/inventory');assert.equal(stock.balances.find(b=>b.itemId===item.id).reservedMilli,2000);assert.equal(stock.balances.find(b=>b.itemId===item.id).availableMilli,0);assert.equal(stock.reservations[0].jobId,job.id)
 await h.command('purchase.receive',receipt(po.lines[1],second,1,'synthetic-mallet-14'),{status:409});await h.command('purchase.close',{...refs(),reason:'Cannot discard backorder'},{status:409})
 const billInput=()=>({...refs(),invoiceNumber:'synthetic-mallet-15',lines:po.lines.map(l=>({lineId:l.id,quantity:l.quantityMilli/1000,unitCents:l.unitCents})),taxCents:po.taxCents,freightCents:po.freightCents,evidence:'Full supplier invoice retained at counter'})
 let bill=await h.command('purchase.bill',{...billInput(),lines:billInput().lines.map((l,n)=>({...l,unitCents:l.unitCents+(n===0?100:0)}))});await refresh()
 assert.equal(bill.matched,false);assert.ok(bill.exceptions.some(e=>e.includes('unit cost')));assert.ok(bill.exceptions.some(e=>e.includes('quantities')))
 const retained=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'purchase-recovery@example.test'}})
 try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records,retained);await fresh.command('purchase.close',{...refs(),reason:'Restored backorder still blocks'},{status:409});await fresh.state({as:h.owner,status:401});await fresh.state({...agent,status:401});await fresh.command('purchase.receive',receipt(po.lines[1],second,3,'synthetic-mallet-16'));assert.equal((await fresh.api('/api/mallet/purchasing'))[0].fullyReceived,true)}finally{await fresh.close()}
 await h.command('purchase.receive',receipt(po.lines[1],second,3,'synthetic-mallet-16'));await refresh()
 await h.command('purchase.close',{...refs(),reason:'Changed cost still blocks'},{status:409})
 const badLines=billInput().lines.map(l=>({...l,lineId:po.lines[0].id}));await h.command('purchase.bill',{...billInput(),lines:badLines},{status:400})
 const changed=await h.command('purchase.bill',{...billInput(),freightCents:600});await refresh();assert.ok(changed.exceptions.some(e=>e.includes('Freight')))
 await h.command('purchase.close',{...refs(),reason:'Unmatched freight blocks'},{status:409})
 bill=await h.command('purchase.bill',billInput());await refresh();assert.equal(bill.matched,true);assert.deepEqual(bill.exceptions,[]);assert.equal(bill.receiptIds.length,3)
 po=await h.command('purchase.close',{...refs(),reason:'All goods received and corrected invoice matches approved spend'});assert.equal(po.closed.billId,bill.id)
 const final=await h.state();assert.equal(final.records.purchaseBill.length,3);assert.equal(final.records.purchaseBill.find(b=>b.sequence===1).matched,false);assert.equal(final.records.purchaseOrder[0].approval.totalCents,10250)
 for(const c of ['purchase.receive','purchase.bill','purchase.approve','purchase.close'])await h.command(c,{...billInput(),reason:'Closed evidence immutable'},{status:409})
 report=(await h.api('/api/mallet/purchasing'))[0];assert.ok(report.fullyReceived);assert.deepEqual(report.lines.map(l=>l.backorderMilli),[0,0]);assert.equal(report.currentBill.totalCents,10250)
 stock=await h.api('/api/mallet/inventory');assert.deepEqual(stock.balances.map(b=>b.onHandMilli),[2000,4000]);assert.equal(stock.movements.reduce((n,m)=>n+m.deltaMilli,0),6000)
 for(const opts of [{as:member.cookie},agent]){assert.equal((await h.request('/app/purchasing',opts)).status,403);await h.api('/api/mallet/purchasing',undefined,{...opts,status:403});assert.equal((await h.state(opts)).records.purchaseOrder,undefined)}
 assert.equal(h.messages.length,2,'Only staff invitations reached the mail edge; purchasing sends nothing')
 const recovery=await installation({bindings:{OWNER_EMAIL:'final-purchase@example.test'}})
 try{await restore(recovery,await archive(h));assert.deepEqual((await recovery.state()).records,final.records);assert.deepEqual(await recovery.api('/api/mallet/purchasing'),[report])}finally{await recovery.close()}
}
