import {test} from 'node:test'
import assert from 'node:assert/strict'
import {run,installation,booking,authorise,archive,restore} from './harness.mjs'
import {qualityReady} from './support/quality-ready.mjs'
const path='/api/mallet/reports/sales'
const date=(at,timeZone)=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]))
 return `${parts.year}-${parts.month}-${parts.day}`
}
async function setup(h){
 const response=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes&laborTaxable=yes'})
 assert.equal(response.status,303)
}
async function quote(h,n,{approve=true,discount=0}={}){
 const {job}=await booking(h,{bayId:'Bay '+n,startAt:`2026-11-${String(n).padStart(2,'0')}T09:00:00Z`,endAt:`2026-11-${String(n).padStart(2,'0')}T10:00:00Z`,asset:await h.command('asset.create',{customerName:'Sales '+n,customerEmail:`sales${n}@example.test`,label:'Ford '+n,identifier:'SALE-'+n})})
 const q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:n===1?'=HYPERLINK("example")':'Repair part',quantity:1,unitCents:n===2?10002:10001,unitDiscountCents:discount},{kind:'labor',description:'Optional labor',quantity:1,unitCents:4999}]})
 return {job,q:await authorise(h,q,approve?[q.revisions[0].lines[0].id]:[])}
}
const currentJob=async(h,id)=>(await h.state()).records.job.find(j=>j.id===id)
async function complete(h,{job,q},{invoice='approved'}={}){
 let j=await currentJob(h,job.id)
 j=await h.command('work.record',{jobId:j.id,version:j.version,estimateId:q.id,revision:1,lineId:q.revisions[0].lines[0].id,quantity:1})
 await qualityReady(h,j)
 j=await h.command('job.complete',{jobId:j.id,version:j.version})
 if(invoice===null)return
 let i=await h.command('invoice.prepare',{jobId:j.id,version:j.version})
 if(invoice!=='draft')i=await h.command('invoice.approve',{invoiceId:i.id,version:i.version})
 return i
}

test('REPORT-001: known native repairs reconcile sales and decisions, download sources and recover without new authority',()=>run(async h=>{
 await setup(h)
 const one=await quote(h,1,{discount:1000}),two=await quote(h,2),three=await quote(h,3,{approve:false}),four=await quote(h,4),five=await quote(h,5),six=await quote(h,6,{approve:false})
 const i1=await complete(h,one),i2=await complete(h,two)
 await complete(h,four,{invoice:'draft'});await complete(h,five,{invoice:null})
 // A real canceled repair with a retained all-declined decision contributes no sales.
 const j3=await currentJob(h,three.job.id)
 await h.command('flow.close',{jobId:j3.id,version:j3.version,outcome:'canceled',reason:'Customer declined repair'})
 const j6=await currentJob(h,six.job.id)
 await h.command('flow.close',{jobId:j6.id,version:j6.version,outcome:'lost',reason:'Customer chose another workshop'})
 const query='?from=2000-01-01&to=2000-01-02'
 let r=await h.api(path+query)
 assert.equal(r.sales.completedVehicleCount,0);assert.equal(r.sales.averageRepairOrderCents,null);assert.equal(r.funnel.approvalRatioTenths,null)
 const range=`?from=${date(one.q.authorisation.at,r.period.timeZone)}&to=${date(Date.now(),r.period.timeZone)}`
 r=await h.api(path+range)
 // $90.01 + $100.02 = $190.03 pretax; two invoices; $95.015 rounds half up to $95.02 ARO.
 assert.deepEqual({...r.sales,sources:undefined},{completedVehicleCount:4,invoicedRepairCount:2,completedWithoutApprovedInvoice:2,netSalesCents:19003,salesTaxCents:1425,grossSalesCents:20428,averageRepairOrderCents:9502,sources:undefined})
 // Six decisions, four accepting one line; unbilled authorizations and cancellations never inflate sales.
 assert.equal(r.funnel.decisionCount,6);assert.equal(r.funnel.approvedDecisionCount,4);assert.equal(r.funnel.fullyDeclinedDecisionCount,2);assert.equal(r.funnel.approvalRatioTenths,667)
 assert.equal(r.funnel.authorizedSubtotalCents,39005);assert.equal(r.funnel.declinedSubtotalCents,49996)
 assert.deepEqual(new Set(r.sales.sources.filter(s=>s.invoice).map(s=>s.invoice.id)),new Set([i1.id,i2.id]))
 for(const source of [...r.sales.sources,...r.funnel.sources])assert.equal((await h.request(source.jobUrl)).status,200,'Every component opens the real source repair')
 for(const source of r.funnel.sources){const q=[one,two,three,four,five,six].find(x=>x.q.id===source.estimateId).q;assert.equal(source.revision,q.authorisation.revision);assert.deepEqual(source.lines.map(l=>[l.id,l.authorized]),q.revisions[0].lines.map(l=>[l.id,q.authorisation.lineIds.includes(l.id)]))}
 const download=await h.request(path+range+'&format=csv'),csv=await download.text()
 assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment; filename="mallet-sales-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv"/)
 assert.equal(download.headers.get('cache-control'),'no-store');assert.match(csv,/"summary","averageRepairOrderCents","9502"/);assert.match(csv,/"decision-line"/);assert.ok(csv.includes('"\'=HYPERLINK(""example"")"'),'Spreadsheet formulas remain inert in source descriptions')
 for(const source of r.sales.sources)assert.ok(csv.includes(source.jobId))
 // Export retrieval is idempotent and never changes the totals or denominator.
 await h.command('invoice.export',{invoiceId:i1.id,version:i1.version});await h.command('invoice.export',{invoiceId:i1.id,version:i1.version})
 let after=await h.api(path+range)
 assert.equal(after.sales.netSalesCents,19003);assert.equal(after.sales.invoicedRepairCount,2)
 // A full void credit and a partial return adjust sales once, even before the observed refund is completed.
 for(const [invoice,quantity,reference]of [[i1,1,'synthetic-mallet-sales-1'],[i2,0.5,'synthetic-mallet-sales-2']]){
  const current=(await h.state()).records.invoice.find(i=>i.id===invoice.id)
  const payment=await h.command('payment.record',{invoiceId:current.id,version:current.version,method:'cash',amountCents:current.totals.totalCents,reference:reference+'-tender',evidence:'Original cash counted'})
  const line=current.lines[0],input={invoiceId:current.id,version:current.version,lines:[{lineId:line.id,sourceEstimateId:line.sourceEstimateId,sourceRevision:line.sourceRevision,quantity}],destination:'original-tender',paymentId:payment.id,reference,reason:quantity===1?'Void entire repair invoice':'Return half of original part',consentEvidence:'Customer explicitly requested original cash refund'}
  const review=await h.command('credit.preview',input),note=await h.command('credit.issue',{...input,review,confirm:'issue-credit'})
  const pending=await h.api(path+range),refund=(await h.state()).records.refund.find(r=>r.creditNoteId===note.id)
  await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:reference+'-refund',evidence:'Owner returned the original counted cash',confirm:'record-refund'})
  const settled=await h.api(path+range);assert.deepEqual(settled.sales.sources.map(r=>r.invoice),pending.sales.sources.map(r=>r.invoice),'Refund completion does not deduct the credit twice')
 }
 const advisor=await h.person('comparison-advisor@example.test','admin'),advisorH={...h,command:(command,input,options={})=>h.command(command,input,{as:advisor.cookie,...options})}
 await quote(advisorH,7,{approve:false})
 after=await h.api(path+range)
 assert.deepEqual({...after.sales,sources:undefined},{completedVehicleCount:3,invoicedRepairCount:1,completedWithoutApprovedInvoice:2,netSalesCents:5001,salesTaxCents:375,grossSalesCents:5376,averageRepairOrderCents:5001,sources:undefined})
 assert.equal(after.sales.sources.find(r=>r.invoice?.id===i1.id).excluded,true)
 assert.equal(after.sales.sources.flatMap(r=>r.credits).length,2)
 assert.deepEqual({...after.closeFunnel,sources:undefined},{estimated:7,approved:4,declined:3,undecided:0,completed:4,collected:0,closed:0,canceledOrLost:2,approvalRatioTenths:571,completionRatioTenths:1000,collectionRatioTenths:0,closeRatioTenths:0,sources:undefined})
 assert.equal(after.advisors.length,2);assert.equal(after.advisors.find(a=>a.advisor.id===advisor.id).closeFunnel.declined,1)
 assert.equal(after.advisors.reduce((n,a)=>n+a.netSalesCents,0),5001)
 for(const source of [...after.closeFunnel.sources,...after.advisors.flatMap(a=>[...a.salesSources,...a.funnelSources])])assert.equal((await h.request(source.jobUrl)).status,200)
 const adjustedCsv=await (await h.request(path+range+'&format=csv')).text();assert.match(adjustedCsv,/"credit-note","fully-credited-exclusion"/);assert.match(adjustedCsv,/"close-summary","estimated","7"/);assert.match(adjustedCsv,/"advisor"/)

 const state=await h.state();await h.api(path+range);assert.deepEqual(await h.state(),state,'Reporting creates no records or events')
 // OPS-001: derived reports restore from current product records; no new archive class or credential.
 const backup=await archive(h),fresh=await installation()
 try{await restore(fresh,backup);assert.deepEqual(await fresh.api(path+range),after);await fresh.api(path+range,undefined,{as:h.owner,status:401})}finally{await fresh.close()}
}))

test('REPORT-001: local calendar boundaries, empty ratios, filter refusal and native report authority',()=>run(async h=>{
 await setup(h)
 const empty=await h.api(path)
 assert.equal(empty.sales.averageRepairOrderCents,null);assert.equal(empty.funnel.approvalRatioTenths,null)
 const one=await quote(h,1)
 await complete(h,one)
 // Pick an IANA shop zone on a different date from UTC, without altering the app clock or stored source records.
 const zone=new Date().getUTCHours()>=10?'Pacific/Kiritimati':'Pacific/Honolulu'
 await h.command('promise.timeZone',{settingsVersion:0,timeZone:zone,reason:'Installation reports in its local calendar'})
 const local=date(one.q.authorisation.at,zone),utc=one.q.authorisation.at.slice(0,10)
 assert.notEqual(local,utc)
 const query=`?from=${local}&to=${local}`
 const r=await h.api(path+query)
 assert.deepEqual(r.period,{from:local,to:local,timeZone:zone,inclusive:true});assert.equal(r.funnel.decisionCount,1);assert.equal(r.sales.completedVehicleCount,1)
 const outside=await h.api(path+`?from=${utc}&to=${utc}`)
 assert.equal(outside.funnel.decisionCount,0);assert.equal(outside.sales.completedVehicleCount,0)
 assert.equal((await h.api(path)).funnel.decisionCount,1,'Default period follows the installation date')
 for(const q of ['?from=2026-02-30','?from=2026-02-29','?from=0000-00-00','?from=2026-02-01&to=2026-01-31','?from=2025-01-01&to=2026-01-02','?location=other','?advisor=somebody','?format=xml','?from=2024-01-01&to=2025-01-01','?from=2026-10-21&from=2026-10-20'])await h.api(path+q,undefined,{status:400})
 assert.equal((await h.api(path+'?from=2024-01-01&to=2024-12-31&location=installation')).sales.completedVehicleCount,0)
 const admin=await h.person('sales-admin@example.test','admin'),member=await h.person('sales-member@example.test')
 assert.deepEqual(await h.api(path+query,undefined,{as:admin.cookie}),r)
 for(const format of ['json','csv']){
  await h.api(path+'?format='+format,undefined,{as:'',status:401})
  await h.api(path+'?format='+format,undefined,{as:member.cookie,status:403})
 }
 const key=await h.command('agent.create',{label:'Prepare only'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 await h.api(path,undefined,{...agent,status:403})
 assert.equal((await h.mf.dispatchFetch('https://other.test'+path,{headers:{cookie:h.owner}})).status,403);await h.api(path,undefined,{headers:{'sec-fetch-site':'cross-site'},status:403})
 await h.api(path,{}, {status:405})
 await h.api('/auth/operator/status',{operatorId:admin.id,status:'inactive'})
 await h.api(path+query,undefined,{as:admin.cookie,status:401})
}))
