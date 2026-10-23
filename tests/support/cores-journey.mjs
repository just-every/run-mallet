import assert from 'node:assert/strict'
import {booking,authorise,archive,restore,installation} from '../harness.mjs'
import {inventoryFixture} from './inventory-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
export async function coreFixture(h){
 const f=await inventoryFixture(h),lot=await h.command('stock.lot',{...f.scans,quantity:1,supplier:'Cedar Parts',supplierLot:'synthetic-mallet-90',serial:'synthetic-mallet-91',reference:'synthetic-mallet-92',unitCostCents:10000,evidence:'Alternator serial on packing slip'})
 await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:false})
 let {job}=await booking(h),q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Alternator sale',quantity:1,unitCents:20000},{kind:'fee',description:'Refundable core deposit',quantity:1,unitCents:5000,feeTaxable:true}]});q=await authorise(h,q)
 job=(await h.state()).records.job[0];for(const line of q.revisions[0].lines)job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:line.id,quantity:1})
 const use=await h.command('stock.useLot',{jobId:job.id,version:job.version,actualId:job.actuals[0].id,lotId:lot.id,quantity:1,reference:'synthetic-mallet-93',reason:'Installed alternator serial checked'})
 await qualityReady(h,job);job=await h.command('job.complete',{jobId:job.id,version:job.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version});invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const input={invoiceId:invoice.id,version:invoice.version,lineId:invoice.lines.find(l=>l.kind==='fee').id,stockUseId:use.id,customerDueAt:new Date(Date.now()+864e5).toISOString(),supplierDueAt:new Date(Date.now()+2*864e5).toISOString(),expectedCreditCents:4000,alertDays:7,terms:'Full customer core deposit including original tax refunded after physical core return. Supplier credits are reconciled separately.'}
 const payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-94',evidence:'Staff counted the customer tender, not verified by Mallet'})
 return {...f,lot,use,job,invoice,input,payment}
}
export async function coresJourney(h){
 const f=await coreFixture(h),member=await h.person('core-tech@example.test'),admin=await h.person('core-advisor@example.test','admin')
 for(const command of ['stock.coreOpen','stock.coreReturn','stock.coreShip','stock.coreCredit','stock.coreCorrect','stock.coreRefund'])for(const options of [{as:'',status:401},{as:member.cookie,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,f.input,options)
 await h.command('stock.coreOpen',{...f.input,lineId:f.invoice.lines[0].id},{status:409})
 let core=await h.command('stock.coreOpen',f.input,{as:admin.cookie});await h.command('stock.coreOpen',f.input,{status:409})
 let report=(await h.api('/api/mallet/cores'))[0];assert.equal(report.depositSubtotalCents,5000);assert.equal(report.depositTaxCents,500);assert.equal(report.depositTotalCents,5500);assert.equal(report.depositRecorded,true);assert.equal(report.customerDue,true);assert.equal(report.creditExpiryAlert,true)
 const refs=()=>({coreId:core.id,version:core.version}),refresh=async()=>{core=(await h.state()).records.stockCore[0]}
 await h.command('stock.coreShip',{...refs(),carrier:'Carrier',tracking:'synthetic-mallet-95',evidence:'No physical core yet'},{status:409})
 core=await h.command('stock.coreReturn',{...refs(),condition:'Used old alternator intact; one cracked mounting tab',evidence:'Advisor received and photographed the old core'})
 await h.command('stock.coreReturn',{...refs(),condition:'Cannot rewrite',evidence:'Second receipt'},{status:409})
 core=await h.command('stock.coreShip',{...refs(),carrier:'Synthetic carrier',tracking:'synthetic-mallet-95',evidence:'Counter receipt for core shipment'})
 const credit={...refs(),reference:'synthetic-mallet-96',amountCents:3500,reason:'Supplier deducted $5 for cracked tab',evidence:'Supplier adjusted credit document'}
 const reconciled=await h.command('stock.coreCredit',credit);assert.deepEqual(await h.command('stock.coreCredit',credit),reconciled);await h.command('stock.coreCredit',{...credit,amountCents:4000},{status:409})
 await h.command('stock.coreCorrect',{...refs(),paymentId:f.payment.id,reason:'Returned old core',consentEvidence:'Customer instructed original cash refund',confirm:'correct-core'},{as:admin.cookie,status:403})
 await h.command('stock.coreCorrect',{...refs(),paymentId:f.payment.id,reason:'Returned old core',consentEvidence:'Customer instruction',confirm:'correct-core'},{status:403,refuseStepUp:true})
 const note=await h.command('stock.coreCorrect',{...refs(),paymentId:f.payment.id,reason:'Returned old core',consentEvidence:'Customer instructed original cash refund',confirm:'correct-core'});await refresh()
 assert.equal(note.totals.totalCents,5500);assert.equal(note.lines[0].salesTaxCents,500);assert.equal(note.lines[0].lineId,f.input.lineId);assert.deepEqual((await h.state()).records.invoice[0],f.invoice)
 assert.equal((await h.command('stock.coreCorrect',refs())).id,note.id)
 let refund=(await h.state()).records.refund[0]
 await h.command('stock.coreRefund',{...refs(),refundVersion:refund.version,confirm:'record-refund',status:'refunded',reference:'synthetic-mallet-97',evidence:'Owner recorded cash returned after signed receipt'},{as:admin.cookie,status:403})
 refund=await h.command('stock.coreRefund',{...refs(),refundVersion:refund.version,confirm:'record-refund',status:'refunded',reference:'synthetic-mallet-97',evidence:'Owner recorded cash returned after signed receipt'})
 assert.equal(refund.amountCents,5500);report=(await h.api('/api/mallet/cores'))[0];assert.equal(report.customerCreditCents,5500);assert.equal(report.customerRefundCents,5500);assert.equal(report.supplierCreditCents,3500);assert.equal(report.supplierExposureCents,500);assert.equal(report.customerDue,false);assert.equal(report.creditExpiryAlert,true)
 await h.api('/api/mallet/cores',undefined,{as:member.cookie,status:403});assert.equal((await h.state({as:member.cookie})).records.stockCore,undefined)
 const final=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'core-recovery@example.test'}})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,final);assert.deepEqual((await fresh.api('/api/mallet/cores'))[0],report);assert.equal((await fresh.command('stock.coreCorrect',refs())).id,note.id)}finally{await fresh.close()}
}
