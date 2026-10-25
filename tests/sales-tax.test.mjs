import {qualityReady} from './support/quality-ready.mjs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {unstable_splitSqlQuery} from 'wrangler'
import {run,booking,authorise} from './harness.mjs'

const danaLines=[
 {kind:'part',description:'Front brake pads',quantity:1,unitCents:6685},
 {kind:'part',description:'Brake rotor',quantity:2,unitCents:4190},
 {kind:'part',description:'Brake fluid',quantity:1,unitCents:1995},
 {kind:'labor',description:'Brake and fluid service',quantity:2.4,unitCents:13500},
]
const postForm=(h,path,input)=>h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(input).toString()})

test('shop setup, taxability, frozen Dana invoice and USD CSV use per-line sales tax',()=>run(async h=>{
 const {job}=await booking(h)
 assert.equal((await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:danaLines},{status:409})).error,'TAX_NOT_CONFIGURED')
 const setup=await postForm(h,'/setup',{confirm:'yes',ratePercent:'7.5',partsTaxable:'yes',laborTaxable:'yes'})
 assert.equal(setup.status,303)
 const member=await h.person('tech@example.test')
 await h.command('tax.configure',{ratePercent:0},{as:member.cookie,status:403})
 for(const ratePercent of [-1,101,7.12345,null])await h.command('tax.configure',{ratePercent},{status:400})
 let estimate=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:danaLines})
 assert.deepEqual(estimate.revisions[0].lines.map(l=>l.salesTaxCents),[501,629,150,2430])
 assert.deepEqual(estimate.revisions[0].totals,{currency:'USD',subtotalCents:49460,salesTaxCents:3710,totalCents:53170})
 estimate=await authorise(h,estimate)
 await h.command('tax.configure',{ratePercent:9})
 let current=(await h.state()).records.job.find(j=>j.id===job.id)
 for(const line of estimate.revisions[0].lines)current=await h.command('work.record',{jobId:job.id,version:current.version,lineId:line.id,quantity:line.quantity})
 await qualityReady(h,current)
 current=await h.command('job.complete',{jobId:job.id,version:current.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:current.version})
 assert.equal(invoice.totals.totalCents,53170)
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
 const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 assert.deepEqual(await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),exported)
 const csv=await (await h.request('/api/mallet/exports/'+exported.id)).text()
 assert.match(csv,/SalesTaxUSD/);assert.doesNotMatch(csv,/AUD|GST/)
 assert.equal(exported.totals.totalCents,53170)
 const html=await (await h.request('/app/jobs/'+job.id)).text()
 assert.match(html,/531\.70/);assert.match(html,/USD/)
 const next=await booking(h,{startAt:'2026-10-20T09:00:00Z',endAt:'2026-10-20T10:00:00Z',asset:(await h.state()).records.asset[0]})
 const q=await h.command('estimate.prepare',{jobId:next.job.id,version:next.job.version,lines:danaLines})
 assert.equal(q.revisions[0].lines[3].salesTaxCents,0)
 assert.equal(q.revisions[0].totals.salesTaxCents,1536)
 await h.command('tax.configure',{ratePercent:5,partsTaxable:false,laborTaxable:true})
 const laborOnly=await h.command('estimate.revise',{estimateId:q.id,version:q.version,revision:1,lines:danaLines})
 assert.deepEqual(laborOnly.revisions.at(-1).lines.map(l=>l.salesTaxCents),[0,0,0,1620])
 await h.command('tax.configure',{ratePercent:0,partsTaxable:false,laborTaxable:true})
 const revision=await h.command('estimate.revise',{estimateId:q.id,version:laborOnly.version,revision:2,lines:danaLines})
 assert.equal(revision.revisions.at(-1).totals.salesTaxCents,0)
}))

test('pre-US records migrate without changing amounts and request unknown shop rate',()=>run(async h=>{
 const db=await h.mf.getD1Database('DB')
 const legacy={id:'legacy-invoice',version:1,number:'M-000001',totals:{currency:'AUD',subtotalCents:5000,gstCents:500,totalCents:5500},lines:[{id:'line-1',kind:'labour',quantity:1,quantityMilli:1000,unitCents:5000,gst:true,subtotalCents:5000,gstCents:500,totalCents:5500}]}
 await db.prepare('INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,?,?)').bind('invoice',legacy.id,1,JSON.stringify(legacy)).run()
 await db.prepare("DELETE FROM mallet_records WHERE kind='taxSettings'").run()
 const migration=await readFile('migrations/core/0018_sales_tax.sql','utf8')
 await db.batch(unstable_splitSqlQuery(migration).map(sql=>db.prepare(sql)))
 const state=await h.state(),invoice=state.records.invoice[0]
 assert.equal(invoice.totals.totalCents,5500);assert.equal(invoice.totals.subtotalCents,5000)
 assert.equal(invoice.totals.salesTaxCents,500);assert.equal(invoice.totals.currency,'USD')
 assert.equal(invoice.lines[0].taxRatePercent,10);assert.equal(invoice.lines[0].kind,'labor')
 assert.equal(state.records.taxSettings[0].ratePercent,null)
}))

import {taxCustodyJourney} from './support/tax-custody-journey.mjs'
test('TAX-002: private certificate dates and declared jurisdiction tax reverse exact issued credits without repricing',taxCustodyJourney)

import {taxCustodyBrowser} from './invoice-documents-browser.mjs'
test('TAX-002: owner retains an expired certificate and declares invoice jurisdiction through native forms at 1440 and 390',taxCustodyBrowser)

test('TAX-002: dedicated filing-period deposit attribution, observed check clearance, exact partial receipt cents and completed refund recovery',()=>run(async h=>{const {filingTaxJourney}=await import('./support/filing-tax-journey.mjs');await filingTaxJourney(h)}))
