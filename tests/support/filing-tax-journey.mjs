import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'
import {receivablesFixture} from './receivables-journey.mjs'
export async function filingTaxJourney(h){
 const {account,i1,i2,invoice}=await receivablesFixture(h)
 for(const invoice of [i1,i2])await h.command('tax.assignJurisdiction',{invoiceId:invoice.id,version:invoice.version,jurisdiction:'Synthetic jurisdiction',evidence:'Owner reviewed jurisdiction basis'})
 const deposit=await h.command('deposit.record',{accountId:account.id,amountCents:5000,method:'cash',reference:'synthetic-mallet-filing-cash',evidence:'Account instructed cash deposit retention'})
 const allocation=await h.command('deposit.allocate',{depositId:deposit.id,invoiceId:i1.id,version:i1.version,amountCents:5000,reference:'synthetic-mallet-filing-allocation',evidence:'Account instructed exact allocation',confirm:'allocate-deposit'})
 const check=await h.command('payment.record',{invoiceId:i1.id,version:i1.version,method:'check',amountCents:6000,reference:'synthetic-mallet-filing-check',evidence:'Paper check observed, not cleared'})
 const other=await h.command('payment.record',{invoiceId:i2.id,version:i2.version,method:'other',amountCents:11000,reference:'synthetic-mallet-filing-other',evidence:'Corporate tender observed, not cleared'})
 const date=allocation.at.slice(0,10),query='/api/mallet/tax/filing?'+new URLSearchParams({from:'2000-01-02',to:'2099-01-01'}),report=()=>h.api(query)
 let result=await report();assert.equal(result.groups[0].collectedTaxCents,455);assert.equal(result.reviewRequired,true);assert.equal(result.events.length,1);assert.equal(result.events[0].sourceId,deposit.id);assert.ok(result.excluded.some(e=>e.paymentId===check.id));assert.ok(result.excluded.some(e=>e.paymentId===other.id))
 const clearInput={sourceKind:'payment',sourceId:check.id,observedOn:check.at.slice(0,10),reference:'synthetic-mallet-filing-bank',evidence:'Owner inspected bank receipt for cleared original check'}
 const admin=await h.person('filing-admin@example.test','admin'),before=JSON.stringify((await h.state()).records)
 await h.command('tender.clearance',clearInput,{as:admin.cookie,status:403});await h.command('tender.clearance',{...clearInput,evidence:''},{status:400});await h.command('tender.clearance',{...clearInput,observedOn:'2099-01-01'},{status:409});await h.command('tender.clearance',{...clearInput,sourceId:allocation.id},{status:409})
 assert.equal(JSON.stringify((await h.state()).records),before)
 const clear=await h.command('tender.clearance',clearInput);assert.equal((await h.command('tender.clearance',clearInput)).id,clear.id);await h.command('tender.clearance',{...clearInput,reference:'changed'},{status:409})
 result=await report();assert.equal(result.groups[0].collectedTaxCents,1000);assert.equal(result.events.find(e=>e.paymentId===check.id).taxCents,545);assert.equal(result.events.find(e=>e.paymentId===check.id).clearanceId,clear.id)
 await h.command('tender.clearance',{...clearInput,sourceId:other.id,observedOn:other.at.slice(0,10),reference:'synthetic-mallet-other-bank'})
 result=await report();assert.equal(result.groups[0].collectedTaxCents,2000);assert.equal(result.reviewRequired,false)
 const creditInput={invoiceId:i1.id,version:i1.version,lines:[{lineId:i1.lines[0].id,sourceEstimateId:i1.lines[0].sourceEstimateId,sourceRevision:i1.lines[0].sourceRevision,quantity:0.1}],destination:'original-tender',paymentId:allocation.id,reference:'synthetic-mallet-filing-credit',reason:'Return one tenth of original quantity',consentEvidence:'Customer requested original cash refund'}
 const preview=await h.command('credit.preview',creditInput),note=await h.command('credit.issue',{...creditInput,review:preview,confirm:'issue-credit'});let refund=(await h.state()).records.refund.find(r=>r.creditNoteId===note.id)
 assert.equal((await report()).groups[0].refundTaxCents,0)
 refund=await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-filing-refund',evidence:'Owner observed counted original cash refund',confirm:'record-refund'})
 result=await report();assert.equal(result.groups[0].refundTaxCents,100);assert.equal(result.groups[0].netTaxCents,1900)
 assert.equal((await report()).events.filter(e=>e.refundId===refund.id).length,1)
 const replacement=await invoice(3),creditRequest={...creditInput,invoiceId:i2.id,version:i2.version,lines:[{lineId:i2.lines[0].id,sourceEstimateId:i2.lines[0].sourceEstimateId,sourceRevision:i2.lines[0].sourceRevision,quantity:0.1}],destination:'account-credit',reference:'synthetic-mallet-filing-account-credit'}
 delete creditRequest.paymentId
 const review=await h.command('credit.preview',creditRequest),credit=await h.command('credit.issue',{...creditRequest,review,confirm:'issue-credit'})
 const transferInput={creditNoteId:credit.id,invoiceId:replacement.id,version:replacement.version,amountCents:1100,reference:'synthetic-mallet-filing-transfer',reason:'Same payer instructed transfer to replacement invoice',confirm:'apply-credit'},transfer=await h.command('credit.apply',transferInput)
 assert.equal((await h.command('credit.apply',transferInput)).id,transfer.id)
 result=await report();assert.equal(result.groups[0].collectedTaxCents,2000);assert.equal(result.groups[0].netTaxCents,1900);assert.deepEqual(result.invoiceBasis,{invoicedTaxCents:3000,creditedTaxCents:200,netTaxCents:2800});assert.equal(result.reviewRequired,true)
 assert.ok(result.excluded.some(e=>e.paymentId===transfer.id&&e.amountCents===1100));assert.ok(result.excluded.some(e=>e.creditNoteId===credit.id));assert.equal(result.events.some(e=>e.paymentId===transfer.id),false,'A customer-credit transfer never invents a new cash receipt')
 const prior='2000-01-01';assert.deepEqual((await h.api('/api/mallet/tax/filing?from='+prior+'&to='+prior)).groups,[])
 assert.equal((await h.request('/api/mallet/tax/filing?from=2026-02-30&to=2026-03-01')).status,400);assert.equal((await h.request('/api/mallet/tax/filing?from=2026-03-02&to=2026-03-01')).status,400)
 assert.equal((await h.request(query,{as:admin.cookie})).status,403);assert.equal((await h.state({as:admin.cookie})).records.tenderClearance,undefined)
 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);assert.deepEqual(await fresh.api(query),result);assert.deepEqual((await fresh.state()).records.tenderClearance,(await h.state()).records.tenderClearance)}finally{await fresh.close()}
 return {account,i1,i2,check,other,date}
}
