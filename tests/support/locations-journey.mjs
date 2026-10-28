import {creditAccountFixture,creditInput,issueCredit} from './refunds-journey.mjs'
import assert from 'node:assert/strict'
import {assetInput,archive,restore,installation,authorise} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {grantInput} from './governance-journey.mjs'
export const locationInput=(code,state,timeZone,ratePercent)=>({code,name:code+' workshop',state,timeZone,ratePercent,partsTaxable:true,laborTaxable:false,invoicePrefix:code,hours:[null,...Array.from({length:5},()=>({open:480,close:1020})),null],merchantReference:'synthetic-mallet-'+code,ledgerReference:'synthetic-mallet-ledger-'+code,reason:'Owner reviewed local settings and private routing references'})
export async function locationFixture(h){
 const a=await h.command('location.save',locationInput('CA','CA',['America','Los_Angeles'].join('/'),7.25)),b=await h.command('location.save',locationInput('TX','TX',['America','Chicago'].join('/'),6.25))
 const {account}=await creditAccountFixture(h,'locations')
 const techA=await h.person('synthetic-mallet-location-a@example.test'),techB=await h.person('synthetic-mallet-location-b@example.test')
 const create=async(location,tech,suffix)=>{
  let asset=await h.command('asset.create',{...assetInput(suffix),locationId:location.id});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Owner records explicit household linkage at this location'});const job=await h.command('job.book',{assetId:asset.id,version:asset.version,locationId:location.id,title:location.code+' brake service',bayId:'Bay 1',technicianId:tech.id,startAt:'2026-11-02T16:00:00Z',endAt:'2026-11-02T17:00:00Z'})
  return {asset,job}
 }
 return {a,b,account,techA,techB,first:await create(a,techA,'701'),second:await create(b,techB,'702')}
}
export async function locationJourney(h){
 const f=await locationFixture(h),member=await h.person('synthetic-mallet-location-member@example.test'),admin=await h.person('synthetic-mallet-location-admin@example.test','admin')
 await h.command('location.save',{...locationInput('BAD','CA',['Invalid','Zone'].join('/'),1)},{status:400});await h.command('location.save',{...locationInput('CA','TX',['America','Chicago'].join('/'),1)},{status:409});await h.command('location.save',{...locationInput('BAD','CA','UTC',1),hours:[]},{status:400})
 for(const options of [{as:'',status:401},{as:member.cookie,status:403},{as:admin.cookie,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command('location.save',locationInput('NO','CA','UTC',1),options)
 await h.command('location.save',{...locationInput('CA','CA',['America','Los_Angeles'].join('/'),9.75),id:f.a.id,version:f.a.version,invoicePrefix:'NEW'},{status:409})
 await h.command('location.save',{...locationInput('CA','CA',['America','Los_Angeles'].join('/'),9.75),id:f.a.id,version:f.a.version})
 const scopedProposal=await h.command('dispatch.prepare',{jobId:f.first.job.id,version:f.first.job.version,locationId:f.b.id,bayId:'Bay 3',reason:'Dispatch must retain original location'});assert.equal(scopedProposal.plan.locationId,f.a.id)
 const invoices=[]
 for(const [location,{job},total]of [[f.a,f.first,10725],[f.b,f.second,10625]]){
  let q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Location priced brake part',quantity:1,unitCents:10000}]});assert.equal(q.revisions[0].totals.totalCents,total)
  q=await authorise(h,q);let j=(await h.state()).records.job.find(j=>j.id===job.id);j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:q.revisions[0].lines[0].id,quantity:1});await qualityReady(h,j,{technician:location.id===f.a.id?f.techA:f.techB});j=(await h.state()).records.job.find(j=>j.id===job.id);j=await h.command('job.complete',{jobId:j.id,version:j.version})
  let invoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version});assert.equal(invoice.number,location.code+'-000001');assert.equal(invoice.locationId,location.id);assert.equal(invoice.totals.totalCents,total);invoices.push(await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1}))
 }
 const metrics=await h.command('location.metrics');assert.deepEqual(metrics.groups.map(g=>[g.locationId,g.repairs,g.invoiceCount,g.netCents]),[['shop',0,0,0],[f.a.id,1,1,10725],[f.b.id,1,1,10625]]);assert.deepEqual(metrics.total,{repairs:2,invoiceCount:2,grossCents:21350,creditCents:0,netCents:21350})
 assert.equal((await h.api('/api/mallet/stripe/checkout',{invoiceId:invoices[0].id,version:invoices[0].version,consent:true,operationId:'synthetic-mallet-710',method:'card'},{status:409})).error,'location_merchant_unconfigured')
 await h.command('payment.verifyStripe',{invoiceId:invoices[0].id,version:invoices[0].version,paymentIntentId:'synthetic-mallet-718'},{status:409})
 await h.command('payment.record',{invoiceId:invoices[0].id,version:invoices[0].version,amountCents:10725,method:'cash',reference:'synthetic-mallet-719',evidence:'Owner records California cash tender'})
 const note=await issueCredit(h,creditInput(invoices[0],null,'synthetic-mallet-720',invoices[0].lines[0],0.5));assert.equal(note.totals.totalCents,5363)
 const deposit=await h.command('deposit.record',{accountId:f.account.id,amountCents:100,method:'cash',reference:'synthetic-mallet-721',evidence:'Original shop cash held for this household'})
 const fundsBefore=(await h.state()).records
 assert.equal((await h.command('credit.apply',{creditNoteId:note.id,invoiceId:invoices[1].id,version:invoices[1].version,amountCents:100,reference:'synthetic-mallet-722',reason:'Cannot move California credit to Texas',confirm:'apply-credit'},{status:409})).error,'LOCATION_FUNDS')
 assert.equal((await h.command('deposit.allocate',{depositId:deposit.id,invoiceId:invoices[1].id,version:invoices[1].version,amountCents:100,reference:'synthetic-mallet-723',evidence:'Cannot move original shop funds to Texas',confirm:'allocate-deposit'},{status:409})).error,'LOCATION_FUNDS');assert.deepEqual((await h.state()).records,fundsBefore)
 assert.deepEqual((await h.command('location.metrics')).total,{repairs:2,invoiceCount:2,grossCents:21350,creditCents:5363,netCents:15987})
 const asset=await h.command('asset.create',{...assetInput('703'),locationId:f.a.id}),job=await h.command('job.book',{assetId:asset.id,version:asset.version,title:'Transfer vehicle',bayId:'Bay 2',technicianId:'Transfer technician',startAt:'2026-11-03T16:00:00Z',endAt:'2026-11-03T17:00:00Z'})
 await h.command('job.book',{assetId:asset.id,version:asset.version+1,locationId:f.b.id,title:'Unpermitted sharing'},{status:403})
 const input={jobId:job.id,version:job.version,assetVersion:asset.version+1,locationId:f.b.id,bayId:'Bay 2',technicianId:f.techB.id,confirm:'transfer-repair',reason:'Customer requested destination custody',evidence:'Signed vehicle handover'}
 await h.command('location.transferRepair',{...input,confirm:''},{status:400});const moved=await h.command('location.transferRepair',input);assert.equal(moved.locationId,f.b.id);assert.equal(moved.locationSnapshot.tax.ratePercent,6.25);assert.equal((await h.state()).records.asset.find(a=>a.id===asset.id).locationId,f.b.id);assert.deepEqual((await h.state()).records.locationTransfer.map(t=>[t.from,t.to,t.evidence]),[[f.a.id,f.b.id,'Signed vehicle handover']]);await h.command('location.transferRepair',input,{status:409})
 const item=await h.command('stock.item',{sku:'synthetic-mallet-711',barcode:'synthetic-mallet-712',name:'Traced brake part',unit:'each'}),bins=[]
 for(const [i,location]of [f.a,f.b].entries()){const bin=await h.command('stock.bin',{code:'Location bin '+i,barcode:'synthetic-mallet-bin-'+i});bins.push(await h.command('location.bin',{binId:bin.id,version:bin.version,locationId:location.id,reason:'Assign unused destination bin'}))}
 const lot=await h.command('stock.lot',{itemBarcode:item.barcode,binBarcode:bins[0].barcode,quantity:2,supplier:'Cedar Parts',supplierLot:'synthetic-mallet-713',reference:'synthetic-mallet-714',unitCostCents:500,evidence:'Received supplier lot'})
 let transfer=await h.command('stock.transferRequest',{reference:'synthetic-mallet-715',destinationBinId:bins[1].id,lines:[{lotId:lot.id,quantity:1}],reason:'Interlocation custody transfer'})
 transfer=await h.command('stock.transferApprove',{transferId:transfer.id,version:transfer.version,reason:'Owner approves exact locations and lot'});transfer=await h.command('stock.transferDispatch',{transferId:transfer.id,version:transfer.version,evidence:'Carrier custody'});transfer=await h.command('stock.transferReceive',{transferId:transfer.id,version:transfer.version,lines:[{lineId:transfer.lines[0].id,received:1,damaged:0}],evidence:'Destination signed custody'})
 assert.equal(transfer.status,'received');assert.deepEqual((await h.api('/api/mallet/inventory')).balances.map(b=>b.onHandMilli),[1000,1000]);await h.command('location.bin',{binId:bins[0].id,version:bins[0].version,locationId:f.b.id,reason:'Cannot relabel physical stock'},{status:409})
 const manager=await h.person('synthetic-mallet-location-manager@example.test');await h.command('staff.grant',{...grantInput(manager.id,'manager'),location:f.a.id})
 const view=await h.api('/api/mallet/staff/state',undefined,{as:manager.cookie});assert.equal(view.location,f.a.id);assert.deepEqual(view.records.job.map(j=>j.id),[f.first.job.id]);assert.deepEqual(view.records.invoice.map(i=>i.id),[invoices[0].id]);assert.deepEqual(view.balances.map(i=>i.invoiceId),[invoices[0].id]);assert.deepEqual(view.records.stockBin.map(b=>b.id),[bins[0].id])
 const receive={itemBarcode:item.barcode,binBarcode:bins[0].barcode,expectedQuantity:1,quantity:1,reference:'synthetic-mallet-716',reason:'Manager receives own stock'};await h.command('stock.receive',receive,{as:manager.cookie})
 const before=(await h.state()).records;for(const input of [{...receive,reference:'synthetic-mallet-717',binBarcode:bins[1].barcode.toUpperCase()},{...receive,locationId:f.b.id}])await h.command('stock.receive',input,{as:manager.cookie,status:403});await h.command('estimate.prepare',{jobId:f.second.job.id,version:1,lines:[]},{as:manager.cookie,status:403});await h.command('job.book',{assetId:f.second.asset.id,version:2},{as:manager.cookie,status:403});assert.deepEqual((await h.state()).records,before)
 const final=(await h.state()).records,fresh=await installation();try{await fresh.command('asset.create',{...assetInput('foreign-location'),locationId:f.a.id},{status:404});await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,final);assert.deepEqual(await fresh.command('location.metrics'),await h.command('location.metrics'));assert.equal(await (await fresh.mf.getD1Database('DB')).prepare('SELECT count(*) AS n FROM mallet_location_staff_grants').first('n'),0);await fresh.api('/api/mallet/staff/state',undefined,{as:manager.cookie,status:401})}finally{await fresh.close()}
}
