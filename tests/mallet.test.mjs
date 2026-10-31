import {preparationKeyBrowser} from './browser-journey.mjs'
import {blockerJourney} from './support/blocker-journey.mjs'
import {blockerBrowser} from './blocker-browser.mjs'
import {enterpriseBrowser} from './enterprise-browser.mjs'
import {enterpriseJourney} from './support/enterprise-journey.mjs'
import {randomBytes} from 'node:crypto'
import {stripeReturnsEdge,stripeReturnsJourney} from './support/stripe-returns-journey.mjs'
import {terminalEdge,terminalJourney,terminalStoppedJourney} from './support/terminal-journey.mjs'
import {stripeJourney,stripeStoppedJourney,collectionEdge} from './support/stripe-journey.mjs'
import {stripeBrowser} from './stripe-browser.mjs'
import {governanceBrowser} from './governance-browser.mjs'
import {auditJourney,staffJourney} from './support/governance-journey.mjs'
import {routingJourney} from './support/routing-journey.mjs'
import {specialPartJourney} from './support/special-part-journey.mjs'
import {specialPartBrowser} from './special-part-browser.mjs'
import {promiseJourney,promiseMailFailureJourney} from './support/promise-journey.mjs'
import {promiseBrowser} from './promise-browser.mjs'
import {timeBrowser} from './time-browser.mjs'
import {reportBrowser} from './report-browser.mjs'
import {reportJourney} from './support/report-journey.mjs'
import {diagnosisJourney,shopSetup} from './support/diagnosis-journey.mjs'
import {diagnosisBrowser} from './diagnosis-browser.mjs'
import {approvalJourney} from './support/approval-journey.mjs'
import {approvalBrowser,chaseBrowser} from './approval-browser.mjs'
import {chaseJourney} from './support/chase-journey.mjs'
import {collaborationJourney,collaborationClock} from './support/collaboration-journey.mjs'
import {collaborationBrowser} from './collaboration-browser.mjs'
import {flowJourney} from './support/flow-journey.mjs'
import {flowBrowser} from './flow-browser.mjs'
import {timeJourney} from './support/time-journey.mjs'
import {pricingBrowser} from './pricing-browser.mjs'
import {pricingJourney} from './support/pricing-journey.mjs'
import {inspectionJourney} from './support/inspection-journey.mjs'
import {inspectionBrowser} from './inspection-browser.mjs'
import {supplementJourney} from './support/supplement-journey.mjs'
import {qualityReady} from './support/quality-ready.mjs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {portableRepair} from './support/portable-repair.mjs'
import {connectorJourney} from './support/connector-journey.mjs'
import {securityBrowser} from './security-browser.mjs'
import {linkProtectionJourney} from './support/link-protection-journey.mjs'
import {secondFactorJourney,policyRecoveryJourney,stepUpJourney} from './support/strong-auth-journey.mjs'
import {run,installation,assetInput,booking,estimate,authorise,archive,restore,snapshots} from './harness.mjs'

test('ADV-003: source-cited blockers require actual evidence, exact consent and physical receipt, preserve handlers and recover privately',()=>run(blockerJourney))
test('ADV-003: native blocker packet, handlers and proposal review at 1440 and 390',blockerBrowser)

test('native sign-in, CSRF, member isolation and immediate session revocation',()=>run(async h=>{
 await h.state({as:'',status:401})
 const tech=await h.person('alex@example.test'),other=await h.person('sam@example.test')
 await h.command('asset.create',assetInput(),{as:tech.cookie,status:403})
 await h.command('asset.create',assetInput(),{headers:{origin:'https://elsewhere.test'},status:403})
 const {job}=await booking(h,{technicianId:tech.id}),q=await authorise(h,await estimate(h,job))
 let current=(await h.state()).records.job[0]
 await h.command('work.record',{jobId:job.id,version:current.version,lineId:q.revisions[0].lines[0].id,quantity:1},{as:other.cookie,status:403})
 assert.equal((await h.state({as:other.cookie})).records.job.length,0)
 await h.command('work.record',{jobId:job.id,version:current.version,lineId:q.revisions[0].lines[0].id,quantity:1},{as:tech.cookie})
 await h.api('/auth/operator/status',{operatorId:tech.id,status:'inactive'})
 await h.state({as:tech.cookie,status:401})
}))

test('booking rejects bay and technician collisions and keeps every asset visit',()=>run(async h=>{
 const {asset,job}=await booking(h)
 const current=()=>h.state().then(s=>s.records.asset.find(a=>a.id===asset.id))
 const input={assetId:asset.id,version:(await current()).version,title:'Second visit',bayId:'Bay 1',technicianId:'Jordan',startAt:job.startAt,endAt:job.endAt}
 assert.equal((await h.command('job.book',input,{status:409})).error,'DISPATCH_CONFLICT')
 await h.command('job.book',{...input,bayId:'Bay 2',technicianId:job.technicianId},{status:409})
 const post=(path,fields)=>h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',cookie:h.owner},body:new URLSearchParams(fields).toString()})
 assert.equal((await post('/setup',{confirm:'yes',ratePercent:'10',partsTaxable:'yes',laborTaxable:'yes'})).status,303)
 const refused=await post('/app/actions',{command:'job.book',...input}),html=await refused.text()
 assert.equal(refused.status,409);assert.ok(html.includes(`/app/jobs/${job.id}`),'links the clashing visit');assert.ok(html.includes('Back to the booking form')&&html.includes('title=Second+visit'));assert.ok(!html.includes('DISPATCH_CONFLICT'))
 assert.match(await (await h.request(`/app/assets/${asset.id}`)).text(),/<select name="technicianId"/)
 await h.command('job.book',{...input,startAt:'2026-10-20T09:00:00+10:00',endAt:'2026-10-20T10:00:00+10:00'})
 const history=await h.request(`/api/mallet/assets/${asset.id}/history.csv`)
 assert.equal(history.status,200);assert.match(await history.text(),/Second visit|job.book/)
 assert.equal((await current()).visits.length,2)
}))

test('exact revision, partial authorisation and quantity ceilings protect customer consent',()=>run(async h=>{
 const {job}=await booking(h);let q=await estimate(h,job)
 await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:2},{status:409})
 q=await authorise(h,q,[q.revisions[0].lines[0].id])
 await h.command('estimate.revise',{estimateId:q.id,version:q.version,revision:1,lines:q.revisions[0].lines},{status:409})
 let j=(await h.state()).records.job[0]
 await h.command('work.record',{jobId:j.id,version:j.version,lineId:q.revisions[0].lines[1].id,quantity:1},{status:409})
 await h.command('work.record',{jobId:j.id,version:j.version,lineId:q.revisions[0].lines[0].id,quantity:3},{status:409})
 j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:q.revisions[0].lines[0].id,quantity:2})
 await h.command('job.complete',{jobId:j.id,version:j.version-1},{status:409})
 assert.equal(q.authorisation.totals.totalCents,5500)
}))

test('agent prepares, person approves, immutable actual-work invoice exports once',async()=>{
 let entered,release
 const waiting=new Promise(resolve=>{entered=resolve}),resumed=new Promise(resolve=>{release=resolve})
 let outboundCalls=0
 await run(async h=>{
  const {job}=await booking(h),unused=await h.command('asset.create',{...assetInput('synthetic-mallet-unused'),customerEmail:''})
  const key=await h.command('agent.create',{label:'synthetic-mallet-901'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
  assert.equal(typeof key.token,'string','Owner issuance returns a private preparation credential')
  assert.equal(key.token.length,43,'Issued credential is usable by the native bearer door')
  assert.equal(key.expiresAt,Date.parse('2026-11-29T12:00:00Z'),'Issued key has its full bounded lifetime')
  const preparer={id:key.id,name:'synthetic-mallet-901',role:'agent'},owner=(await h.state()).actor
  await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:true})
  const first=[{id:'synthetic-mallet-902',kind:'part',description:'Brake pads',quantity:2,unitCents:2500},{id:'synthetic-mallet-903',kind:'labor',description:'Replace and tune',quantity:1.5,unitCents:12000}]
  const revised=[{id:'synthetic-mallet-904',kind:'part',description:'Reviewed brake pads',quantity:2.5,unitCents:2000},{id:'synthetic-mallet-905',kind:'labor',description:'Reviewed adjustment',quantity:0.75,unitCents:10000}]
  const inspectRevision=(revision,n,expected,subtotal,salesTax,total)=>{
   assert.equal(revision.n,n);assert.deepEqual(revision.preparedBy,preparer)
   assert.equal(revision.preparedAt,'2026-10-30T12:00:00.000Z')
   assert.deepEqual(revision.lines.map(({id,kind,description,quantity,unitCents})=>({id,kind,description,quantity,unitCents})),expected)
   assert.deepEqual(revision.totals,{currency:'USD',subtotalCents:subtotal,salesTaxCents:salesTax,totalCents:total})
  }
  let q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:first,notes:'synthetic-mallet-906'},agent)
  inspectRevision(q.revisions[0],1,[{id:'synthetic-mallet-902',kind:'part',description:'Brake pads',quantity:2,unitCents:2500},{id:'synthetic-mallet-903',kind:'labor',description:'Replace and tune',quantity:1.5,unitCents:12000}],23000,2300,25300)
  assert.equal(q.jobId,job.id);assert.equal(q.revisions[0].notes,'synthetic-mallet-906');assert.equal(q.revisions[0].approval,null)
  const firstSnapshot=structuredClone(q.revisions[0])
  q=await h.command('estimate.revise',{estimateId:q.id,version:q.version,revision:1,lines:revised,notes:'synthetic-mallet-907'},agent)
  q=(await h.state()).records.estimate.find(row=>row.id===q.id)
  assert.equal(q.revisions.length,2);assert.deepEqual(q.revisions[0],firstSnapshot)
  inspectRevision(q.revisions[1],2,[{id:'synthetic-mallet-904',kind:'part',description:'Reviewed brake pads',quantity:2.5,unitCents:2000},{id:'synthetic-mallet-905',kind:'labor',description:'Reviewed adjustment',quantity:0.75,unitCents:10000}],12500,1250,13750);assert.equal(q.revisions[1].notes,'synthetic-mallet-907')
  const scopeFixture=await booking(h,{asset:await h.command('asset.create',{...assetInput('synthetic-mallet-914'),customerEmail:''}),bayId:'synthetic-mallet-915',startAt:'2027-01-03T12:00:00Z',endAt:'2027-01-03T13:00:00Z'})
  let scope=await h.command('estimate.prepare',{jobId:scopeFixture.job.id,version:scopeFixture.job.version,lines:first})
  const refuse=async(command,input,status=403,options=agent)=>{
   const before=(await h.state()).records,mailCount=h.messages.length,external=outboundCalls
   const response=await h.command(command,input,{...options,status})
   assert.match(response.error,/FORBIDDEN|manager_required|owner_required|invalid_agent_key|CONCURRENT_CHANGE/,'The authority boundary refuses '+command)
   assert.deepEqual((await h.state()).records,before,command+' refusal preserves every business record, version and successful event')
   assert.equal(h.messages.length,mailCount,command+' refusal hands no message to the mail edge')
   assert.equal(outboundCalls,external,command+' refusal makes no external handoff')
  }
  await refuse('estimate.approve',{estimateId:scope.id,version:scope.version,revision:1})
  scope=await h.command('estimate.approve',{estimateId:scope.id,version:scope.version,revision:1})
  q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:2})
  const approved=(await h.state()).records.approval.find(row=>row.subjectId===q.id)
  assert.deepEqual(approved.preparedBy,preparer);assert.deepEqual(approved.approvedBy,{id:owner.id,name:owner.name,role:'owner'})
  assert.equal(approved.revision,2);assert.equal(approved.subjectVersion,q.version);assert.equal(approved.decision,'approved')
  assert.equal(approved.at,'2026-10-30T12:00:00.000Z');assert.deepEqual(q.revisions[1].approval.by,approved.approvedBy)
  await refuse('estimate.markSent',{estimateId:scope.id,version:scope.version,revision:1,method:'printed',note:'synthetic-mallet-908'})
  scope=await h.command('estimate.markSent',{estimateId:scope.id,version:scope.version,revision:1,method:'printed',note:'synthetic-mallet-908'})
  q=await h.command('estimate.markSent',{estimateId:q.id,version:q.version,revision:2,method:'printed',note:'synthetic-mallet-908'})
  const decision={estimateId:q.id,version:q.version,revision:2,lineIds:['synthetic-mallet-904'],customerName:'Cedar Bikes',method:'signed',evidence:'synthetic-mallet-909'}
  const scopeDecision={estimateId:scope.id,version:scope.version,revision:1,lineIds:['synthetic-mallet-902'],customerName:'Cedar Bikes',method:'signed',evidence:'synthetic-mallet-916'}
  await refuse('estimate.authorise',scopeDecision)
  scope=await h.command('estimate.authorise',scopeDecision)

  q=await h.command('estimate.authorise',decision)
  const retained=(await h.state()).records.estimate.find(row=>row.id===q.id)
  assert.deepEqual(retained.authorisation,{revision:2,lineIds:['synthetic-mallet-904'],customerName:'Cedar Bikes',method:'signed',evidence:'synthetic-mallet-909',recordedBy:approved.approvedBy,at:'2026-10-30T12:00:00.000Z',totals:{currency:'USD',subtotalCents:5000,salesTaxCents:500,totalCents:5500}})
  assert.deepEqual(retained.revisions[1].approval,q.revisions[1].approval)
  let j=(await h.state()).records.job.find(row=>row.id===job.id)
  j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:'synthetic-mallet-904',quantity:2.5})
  await qualityReady(h,j)
  j=await h.command('job.complete',{jobId:j.id,version:j.version})
  let invoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version},agent)
  assert.equal(invoice.totals.totalCents,5500);assert.equal(invoice.lines.length,1)
  assert.deepEqual(invoice.preparedBy,preparer);assert.equal(invoice.preparedAt,'2026-10-30T12:00:00.000Z');assert.equal(invoice.estimateRevision,2)
  await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version},{status:409})
  invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
  let scopeJob=(await h.state()).records.job.find(row=>row.id===scopeFixture.job.id)
  scopeJob=await h.command('work.record',{jobId:scopeJob.id,version:scopeJob.version,lineId:'synthetic-mallet-902',quantity:2})
  await qualityReady(h,scopeJob)
  scopeJob=await h.command('job.complete',{jobId:scopeJob.id,version:scopeJob.version})
  let scopeInvoice=await h.command('invoice.prepare',{jobId:scopeJob.id,version:scopeJob.version})
  scopeInvoice=await h.command('invoice.approve',{invoiceId:scopeInvoice.id,version:scopeInvoice.version,revision:1})
  await refuse('invoice.export',{invoiceId:scopeInvoice.id,version:scopeInvoice.version})
  const scopeExport=await h.command('invoice.export',{invoiceId:scopeInvoice.id,version:scopeInvoice.version});assert.equal(scopeExport.totals.totalCents,5500)
  await refuse('asset.erase',{assetId:unused.id,confirm:'ERASE'})
  await h.command('asset.erase',{assetId:unused.id,confirm:'ERASE'})
  assert.ok(!(await h.state()).records.asset.some(row=>row.id===unused.id),'A separately authorized owner can erase the exact unused asset')
  await refuse('agent.create',{label:'synthetic-mallet-910'})
  await refuse('agent.revoke',{id:key.id})
  const a=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),b=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
  assert.deepEqual(a,b);assert.equal((await h.state()).records.export.filter(row=>row.invoiceId===invoice.id).length,1);assert.equal((await h.state()).records.export.length,2)
  const response=await h.request(`/api/mallet/exports/${a.id}`);assert.equal(response.status,200);assert.match(await response.text(),/55.00/)
  assert.equal((await h.state()).records.approval.filter(row=>row.subjectId===q.id||row.subjectId===invoice.id).length,2);assert.equal((await h.state()).records.approval.length,4)
  const other=await booking(h,{asset:await h.command('asset.create',{...assetInput('synthetic-mallet-917'),customerEmail:''}),bayId:'synthetic-mallet-911',startAt:'2026-12-01T12:00:00Z',endAt:'2026-12-01T13:00:00Z'})
  let draft=await h.command('estimate.prepare',{jobId:other.job.id,version:other.job.version,lines:first},agent)
  const pendingInput={estimateId:draft.id,version:draft.version,revision:1,lines:revised}
  const pending=h.request('/api/mallet/commands',{method:'POST',body:{command:'estimate.revise',input:pendingInput},...agent,headers:{...agent.headers,'x-synthetic-mallet-pause-write':'yes'}})
  try{
   await Promise.race([waiting,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Preparation did not reach the transaction barrier')),10000);timer.unref()})])
   await h.command('agent.revoke',{id:key.id})
   const before=(await h.state()).records,mailCount=h.messages.length
   release()
   const refused=await pending;assert.equal(refused.status,409);assert.equal((await refused.json()).error,'CONCURRENT_CHANGE')
   assert.deepEqual((await h.state()).records,before,'An authenticated in-flight write cannot commit after owner revocation')
   assert.equal(h.messages.length,mailCount)
  }finally{release();await pending}
  await refuse('estimate.revise',pendingInput,401)
  await h.state({...agent,status:401})
  // An expiry boundary fixture changes only the clock's deadline; outcomes still
  // run through the real bearer route with independently valid inputs.
  const expiring=await h.command('agent.create',{label:'synthetic-mallet-912'}),expired={as:'',headers:{authorization:'Bearer '+expiring.token}},db=await h.mf.getD1Database('DB'),now=Date.parse('2026-10-30T12:00:00Z')
  await db.prepare('UPDATE mallet_agent_keys SET expires_at=? WHERE id=?').bind(now+1,expiring.id).run()
  const live=await h.command('estimate.revise',pendingInput,expired);assert.equal(live.revisions.length,2)
  await db.prepare('UPDATE mallet_agent_keys SET expires_at=? WHERE id=?').bind(now,expiring.id).run()
  await refuse('estimate.revise',{...pendingInput,version:live.version,revision:2},401,expired)
  await h.state({...expired,status:401})
  const recoveryKey=await h.command('agent.create',{label:'synthetic-mallet-913'}),recoveryAgent={as:'',headers:{authorization:'Bearer '+recoveryKey.token}}
  await h.state(recoveryAgent)
  const original=(await h.state()).records,backup=await archive(h)
  assert.ok(!backup[0].tables.some(table=>table.name==='mallet_agent_keys'),'An archive excludes preparation credentials')
  const fresh=await installation({clock:'2026-10-30T12:00:00Z'})
  try{
   await restore(fresh,backup)
   assert.deepEqual((await fresh.state()).records,original,'Exact revisions, attribution and person decisions recover under a fresh owner')
   await fresh.command('estimate.revise',{...pendingInput,version:live.version,revision:2},{...recoveryAgent,status:401})
   assert.deepEqual((await fresh.state()).records,original,'Recovery cannot make the source preparation credential runnable')
  }finally{await fresh.close()}
  assert.equal(outboundCalls,1,'Only the synthetic database scheduling signal reached the controlled edge')
 },{entry:'tests/support/preparation-worker.ts',clock:'2026-10-30T12:00:00Z',outboundService:async request=>{outboundCalls++;assert.equal(new URL(request.url).pathname,'/preparation-write');entered();await resumed;return new Response('continue')}})
 await preparationKeyBrowser()
})

test('INVOICE-001: exact approval history, actual-work rows and saved export retrieval',()=>run(async h=>{
 const {job}=await booking(h),key=await h.command('agent.create',{label:'Workshop assistant'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 const decidingPerson=(await h.state()).actor,preparer={id:key.id,name:'Workshop assistant',role:'agent'}
 let q=await estimate(h,job,agent)
 await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1},{...agent,status:403})
 q=await h.command('estimate.revise',{estimateId:q.id,version:q.version,revision:1,lines:q.revisions[0].lines.map(({id,kind,description,quantity,unitCents})=>({id,kind,description,quantity:kind==='part'?3:quantity,unitCents}))},agent)
 q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:2})
 q=await h.command('estimate.markSent',{estimateId:q.id,version:q.version,revision:2,method:'printed'})
 q=await h.command('estimate.authorise',{estimateId:q.id,version:q.version,revision:2,lineIds:[q.revisions[1].lines[0].id],customerName:'Cedar Bikes',method:'signed',evidence:'Signed parts-only decision synthetic-mallet-1'})
 let j=(await h.state()).records.job[0]
 j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:q.revisions[0].lines[0].id,quantity:2})
 await qualityReady(h,j)
 j=await h.command('job.complete',{jobId:j.id,version:j.version})
 let invoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version},agent)
 assert.equal(invoice.totals.totalCents,5500);assert.equal(invoice.lines.length,1)
 const expectedLines=[{id:q.revisions[0].lines[0].id,kind:'part',description:'Brake pads',quantity:2,quantityMilli:2000,unitCents:2500,taxable:true,taxRatePercent:10,taxRateMillionths:100000,pierItemId:null,subtotalCents:5000,salesTaxCents:500,totalCents:5500,sourceEstimateId:q.id,sourceRevision:2}]
 assert.deepEqual(invoice.lines,expectedLines,'Freeze actual quantity two, not authorized quantity three or the declined labor')
 assert.deepEqual(invoice.totals,{currency:'USD',subtotalCents:5000,salesTaxCents:500,totalCents:5500})
 assert.equal(invoice.estimateId,q.id);assert.equal(invoice.estimateRevision,2)
 assert.deepEqual(invoice.actuals,j.actuals);assert.deepEqual(invoice.preparedBy,preparer)
 const beforeRefusal=(await h.state()).records
 await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version},{status:409})
 await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:2},{status:409})
 await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1},{...agent,status:403})
 assert.deepEqual((await h.state()).records,beforeRefusal,'Unapproved, wrong-revision and agent decisions leave all records unchanged')
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
 assert.deepEqual(invoice.approval,{by:decidingPerson,at:invoice.approval.at,revision:1,totals:{currency:'USD',subtotalCents:5000,salesTaxCents:500,totalCents:5500}})
 const approvalHistory=(await h.state()).records.approval
 assert.deepEqual(approvalHistory.filter(a=>a.subjectKind==='invoice'),[{id:approvalHistory.find(a=>a.subjectKind==='invoice').id,version:1,subjectKind:'invoice',subjectId:invoice.id,revision:1,subjectVersion:invoice.version,preparedBy:preparer,approvedBy:decidingPerson,decision:'approved',at:invoice.approval.at}])
 const a=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 invoice=(await h.state()).records.invoice.find(i=>i.id===invoice.id)
 const b=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),preceding=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version-1})
 assert.deepEqual(a,b);assert.equal((await h.state()).records.export.length,1)
 assert.deepEqual(preceding,a);assert.deepEqual(a.lines,expectedLines)
 assert.equal(a.invoiceId,invoice.id);assert.equal(a.invoiceRevision,1);assert.equal(a.invoiceVersion,invoice.version-1)
 assert.deepEqual((await h.state()).records.approval,approvalHistory,'Both retrieval versions preserve exact approval history')
 const response=await h.request(`/api/mallet/exports/${a.id}`);assert.equal(response.status,200);assert.match(await response.text(),/55.00/)
 const expectedCsv='"InvoiceNumber","CustomerName","CustomerEmail","Vehicle","Identifier","JobId","EstimateRevision","Description","Kind","Quantity","UnitUSD","SubtotalUSD","SalesTaxUSD","TotalUSD","Currency","EstimateId"\r\n'+
  [`"${invoice.number}"`,'"Cedar Bikes"',`"${invoice.customer.customerEmail}"`,'"Trek FX 3"','"BIKE-1"',`"${j.id}"`,'"2"','"Brake pads"','"part"','"2"','"25.00"','"50.00"','"5.00"','"55.00"','"USD"',`"${q.id}"`].join(',')+'\r\n'
 assert.equal(a.csv,expectedCsv);assert.equal(await (await h.request(`/api/mallet/exports/${a.id}`)).text(),expectedCsv)
 assert.equal((await h.state()).records.approval.length,2)
 const frozen=(await h.state()).records
 await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version-2},{status:409})
 await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version},{...agent,status:403})
 const deniedDownload=await h.request(`/api/mallet/exports/${a.id}`,agent)
 assert.equal(deniedDownload.status,403);assert.ok(!(await deniedDownload.text()).includes(a.csv),'Preparation credentials cannot download saved financial bytes')
 assert.deepEqual((await h.state()).records,frozen,'Stale and unauthorized retrieval cannot create exports or decisions')
 await h.command('agent.revoke',{id:key.id})
 const afterRevocation=(await h.state()).records
 await h.state({...agent,status:401})
 await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version},{...agent,status:401})
 const revokedDownload=await h.request(`/api/mallet/exports/${a.id}`,agent)
 assert.equal(revokedDownload.status,401);assert.ok(!(await revokedDownload.text()).includes(a.csv),'Revocation also closes the saved download door')
 assert.deepEqual((await h.state()).records,afterRevocation,'Revoked preparation credentials cannot change saved invoice evidence')
 console.log('PROBE INVOICE-001 approval: public invoice commands -> exact person and revision retained; unsafe decisions refused without writes')
 console.log('PROBE INVOICE-001 actuals: public state and CSV -> two authorized parts at 2500 cents, source revision 2, tax 500 and total 5500; declined labor excluded')
 console.log('PROBE INVOICE-001 replay: current and preceding version commands -> identical saved export bytes and identity, one export and unchanged approvals')
}))

test('INVOICE-001: native invoice and downloaded CSV readback at 1440 and 390',()=>run(async h=>{
 const {browserJourney}=await import('./browser-journey.mjs')
 await h.stepUp()
 await browserJourney(h.origin+'/app',{cookie:h.owner,directory:process.env.MALLET_SCREENSHOTS??'.cache/invoice-browser'})
},{entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}}))

test('dispatch proposal is inert until a person approves current free resources',()=>run(async h=>{
 const {job}=await booking(h),key=await h.command('agent.create',{label:'Dispatcher'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 const p=await h.command('dispatch.prepare',{jobId:job.id,version:job.version,bayId:'Bay 2',technicianId:'Jordan',startAt:'2026-10-20T09:00:00+10:00',endAt:'2026-10-20T10:00:00+10:00',reason:'Move to the diagnostic bay'},agent)
 const saved=(await h.state()).records.proposal.find(row=>row.id===p.id)
 assert.equal(saved.jobId,job.id);assert.equal(saved.jobVersion,job.version);assert.equal(saved.status,'pending')
 assert.deepEqual(saved.preparedBy,{id:key.id,name:'Dispatcher',role:'agent'})
 assert.ok(Number.isFinite(Date.parse(saved.preparedAt)))
 assert.deepEqual(saved.plan,{liftId:'',loanerId:'',requiredSkill:'',bayId:'Bay 2',technicianId:'Jordan',startAt:'2026-10-19T23:00:00.000Z',endAt:'2026-10-20T00:00:00.000Z'})
 assert.equal((await h.state()).records.job[0].bayId,'Bay 1')
 await h.command('dispatch.approve',{proposalId:p.id,version:p.version},{...agent,status:403})
 await h.command('dispatch.approve',{proposalId:p.id,version:p.version})
 assert.equal((await h.state()).records.job[0].bayId,'Bay 2')
 assert.equal((await h.state()).records.approval[0].preparedBy.role,'agent')
}))

test('RepairShopr dry run, reviewed fingerprint, original custody, replay and undo',()=>run(async h=>{
 const input=await snapshots()
 input.assets.assets=Array.from({length:14},(_,i)=>({...input.assets.assets[0],id:1000+i,asset_serial:'BATCH-'+i}))
 const plan=await h.api('/api/mallet/imports/preview',input)
 assert.equal(plan.links.length,input.assets.assets.length)
 assert.equal((await h.state()).records.asset,undefined)
 await h.api('/api/mallet/imports/apply',{...input,fingerprint:'0'.repeat(64)},{status:409})
 const checkpoints=[]
 const checkpoint=async current=>{
  const position=checkpoints.at(-1)?.checkpoint??0
  assert.equal(current.total,plan.plan.entries.length)
  assert.equal(current.fingerprint,plan.fingerprint)
  assert.equal(current.id,checkpoints[0]?.id??current.id)
  assert.ok(current.checkpoint>position,'each continuation advances the reviewed plan')
  assert.equal(current.fence,(checkpoints.at(-1)?.fence??0)+1)
  checkpoints.push(current)
  const retained=await h.api('/api/mallet/imports/journal?id='+current.id)
  assert.deepEqual(retained.job,current)
  assert.deepEqual(retained.plan,plan.plan)
  assert.deepEqual(retained.links,plan.links)
  assert.deepEqual(retained.batches,checkpoints.map((step,i)=>({action:'apply',position:i?checkpoints[i-1].checkpoint:0,end_position:step.checkpoint,fence:step.fence})))
  const expected=plan.plan.entries.slice(0,current.checkpoint).flatMap(entry=>entry.effects.map(effect=>effect.value))
  const byId=(a,b)=>a.id.localeCompare(b.id)
  assert.deepEqual(((await h.state()).records.asset??[]).sort(byId),expected.sort(byId),'only the checkpointed asset effects are present, exactly once')
 }
 let job=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint})
 assert.notEqual(job.state,'completed','the fixture requires bounded continuation')
 await checkpoint(job)
 while(job.state!=='completed'){
  job=await h.api('/api/mallet/imports/resume',{id:job.id})
  await checkpoint(job)
 }
 const completed=await h.api('/api/mallet/imports/journal?id='+job.id)
 assert.deepEqual(completed.batches.flatMap(batch=>Array.from({length:batch.end_position-batch.position},(_,i)=>batch.position+i)),plan.plan.entries.map((_,i)=>i),'ordered batches cover the entire review without gaps or duplicate positions')
 const repeated=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint});assert.equal(repeated.id,job.id)
 assert.deepEqual(repeated,job)
 assert.deepEqual(await h.api('/api/mallet/imports/resume',{id:job.id}),job)
 const journal=await h.api('/api/mallet/imports/journal?id='+job.id)
 assert.deepEqual(journal,completed,'completed apply and resume replay add no batch or fence')
 assert.ok(journal.originals.length>=2);assert.ok(journal.batches.length)
 for(const [kind,snapshot] of Object.entries(input)){
  const original=journal.originals.find(item=>item.name===`repairshopr-${kind}.json`)
  assert.equal(original.jobId,job.id);assert.equal(original.original.status,'retained')
  assert.equal(Buffer.from(original.original.base64,'base64').toString('utf8'),JSON.stringify(snapshot))
 }
 assert.equal((await h.state()).records.asset.length,plan.links.length)
 for(const source of input.assets.assets){
  const link=journal.links.find(item=>item.assetSourceId===String(source.id))
  const asset=(await h.state()).records.asset.find(item=>item.id===link.targetId)
  assert.equal(link.customerSourceId,String(source.customer_id))
  assert.equal(asset.identifier,source.asset_serial);assert.equal(asset.label,source.name)
  assert.equal(asset.version,1);assert.deepEqual(asset.visits,[])
 }
 let undone=await h.api('/api/mallet/imports/undo',{id:job.id})
 while(undone.state!=='undone')undone=await h.api('/api/mallet/imports/undo',{id:job.id})
 assert.equal((await h.state()).records.asset,undefined)
}))

test('import undo preserves an asset once it has a native repair visit',()=>run(async h=>{
 const input=await snapshots(),plan=await h.api('/api/mallet/imports/preview',input)
 const imported=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint})
 const asset=(await h.state()).records.asset[0],{job}=await booking(h,{asset})
 const before=await h.state(),usedAsset=before.records.asset.find(item=>item.id===asset.id),visit=before.records.job.find(item=>item.id===job.id)
 assert.ok(usedAsset.version>asset.version)
 assert.deepEqual(usedAsset.visits,[job.id]);assert.equal(visit.assetId,asset.id)
 const failed=await h.api('/api/mallet/imports/undo',{id:imported.id},{status:409})
 const after=await h.state()
 assert.ok(failed.error);assert.equal(after.records.job.length,1)
 assert.deepEqual(after.records.asset.find(item=>item.id===asset.id),usedAsset,'denied undo preserves the exact used asset, version, fields and visit linkage')
 assert.deepEqual(after.records.job.find(item=>item.id===job.id),visit,'denied undo preserves the exact native visit and its asset snapshot')
 assert.deepEqual(after.records.asset,before.records.asset)
 assert.deepEqual(after.records.job,before.records.job)
}))

test('OPS-001: complete native archive restores every current record and finishes repair under fresh authority',()=>run(portableRepair))

test('DATA-001: native erasure fences known old archives and labels unknown fresh recovery',()=>run(async h=>{
 const input=await snapshots(),plan=await h.api('/api/mallet/imports/preview',input),job=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint}),old=await archive(h)
 const asset=(await h.state()).records.asset[0],member=await h.person('tech@example.test')
 await h.command('asset.erase',{assetId:asset.id,confirm:'ERASE'},{as:member.cookie,status:403})
 await h.command('asset.erase',{assetId:asset.id,confirm:'no'},{status:400})
 await h.command('asset.erase',{assetId:asset.id,confirm:'ERASE'})
 assert.ok(!(await h.state()).records.asset?.some(a=>a.id===asset.id))
 const later=await archive(h),fresh=await installation()
 try{const failed=await restore(fresh,old,{status:400,laterJournal:{sourceIdentity:later[0].sourceIdentity,epoch:later[0].epoch,journal:later[0].journal}});assert.ok(failed.error)}finally{await fresh.close()}
 const unknown=await installation(),current=await installation()
 try{const restored=await restore(unknown,old);assert.equal(restored.erasureHistory,'unverified');assert.match(restored.erasureNotice,/Erasure history unverified/);assert.ok((await unknown.state()).records.asset.some(a=>a.id===asset.id));const verified=await restore(current,later,{laterJournal:{sourceIdentity:later[0].sourceIdentity,epoch:later[0].epoch,journal:later[0].journal}});assert.equal(verified.erasureHistory,'journal-supplied');assert.ok(!(await current.state()).records.asset?.some(a=>a.id===asset.id))}finally{await unknown.close();await current.close()}
 await h.api('/api/mallet/imports/undo',{id:job.id})
 assert.ok(!(await h.state()).records.asset?.some(a=>a.id===asset.id))
}))

test('VEH-002: visit readings, reasoned corrections, regression warnings and observed service due',()=>run(async h=>{
 const {job}=await booking(h),id=job.id
 const setupStart=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',cookie:h.owner},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setupStart.status,303)
 const post=async fields=>h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',cookie:h.owner},body:new URLSearchParams(fields).toString()})
 const input={jobId:id,version:job.version,stage:'intake',value:62100,observedAt:'2026-10-01T09:00:00-04:00'}
 const saved=await post({command:'reading.record',...input});assert.equal(saved.status,303)
 let s=await h.state(),r=s.records.reading[0],j=s.records.job.find(j=>j.id===id)
 assert.equal(r.unit,'miles');assert.equal(r.value,62100);assert.equal(r.observedAt,'2026-10-01T13:00:00.000Z');assert.equal(r.jobId,id);assert.ok(r.by.id)
 const out=await h.command('reading.record',{...input,version:j.version,stage:'out',value:62112,observedAt:'2026-10-01T11:00:00-04:00'})
 j=(await h.state()).records.job.find(j=>j.id===id)
 await h.command('reading.record',{...input,version:j.version,corrects:r.id,value:62090,reason:''},{status:400})
 const correction=await h.command('reading.record',{...input,version:j.version,corrects:r.id,value:62090,reason:'Photo confirms transposed intake digits'})
 assert.equal(correction.corrects,r.id);assert.equal(correction.reason,'Photo confirms transposed intake digits')
 j=(await h.state()).records.job.find(j=>j.id===id)
 await h.command('serviceInterval.save',{jobId:id,version:j.version,name:'Brake inspection',dueValue:62112,dueDate:'2099-12-01'})
 await h.command('serviceInterval.save',{jobId:id,version:j.version,name:'Calendar service',dueValue:99999,dueDate:'2020-01-01'})
 await h.command('serviceInterval.save',{jobId:id,version:j.version,name:'Unknown metric reading',unit:'km',dueValue:99999,dueDate:'2099-12-01'})
 const hour=await h.command('reading.record',{...input,version:j.version,unit:'hours',value:120})
 assert.equal(hour.unit,'hours')
 j=(await h.state()).records.job.find(j=>j.id===id)
 const bad=await h.command('reading.record',{...input,version:j.version,unit:'hours',stage:'out',value:119,observedAt:'2026-10-01T11:00:00-04:00'})
 assert.equal(bad.regression,true)
 // Finish the actual repair; out mileage and full observation history survive completion.
 let q=await authorise(h,await estimate(h,(await h.state()).records.job.find(j=>j.id===id)))
 j=(await h.state()).records.job.find(j=>j.id===id)
 j=await h.command('work.record',{jobId:id,version:j.version,lineId:q.revisions[0].lines[0].id,quantity:1})
 await qualityReady(h,j)
 await h.command('job.complete',{jobId:id,version:j.version})
 s=await h.state();assert.equal(s.records.job.find(j=>j.id===id).status,'completed');assert.equal(s.records.reading.find(x=>x.id===out.id).value,62112);assert.equal(s.records.reading.find(x=>x.id===r.id).value,62100)
 // Public pages expose thresholds without extrapolating a current odometer.
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',cookie:h.owner},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'})
 assert.equal(setup.status,303)
 const page=await h.request('/app/jobs/'+id),html=await page.text();assert.equal(page.status,200)
 assert.match(html,/62,112/);assert.match(html,/62,090/);assert.match(html,/Superseded/);assert.match(html,/Photo confirms transposed intake digits/);assert.match(html,/Warning: reading regresses/);assert.match(html,/Reading threshold reached/);assert.match(html,/Time due/);assert.match(html,/Last observed:/);assert.match(html,/No observed reading in this unit/)
 const csv=await h.request(`/api/mallet/assets/${job.assetId}/history.csv`);assert.match(await csv.text(),/reading.record/)
 const member=await h.person('reader@example.test');await h.command('reading.record',{...input,version:1},{as:member.cookie,status:403})
}))

test('EST-005: decline tires at 60000 miles, retain exact evidence and reprice on the next visit for a fresh decision',()=>run(async h=>{
 const {job,asset}=await booking(h)
 await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 let q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Set of four tires',quantity:4,unitCents:15000},{kind:'labor',description:'Brake adjustment',quantity:1,unitCents:10000}]})
 q=await authorise(h,q,[q.revisions[0].lines[1].id])
 let j=(await h.state()).records.job.find(x=>x.id===job.id)
 const reading=await h.command('reading.record',{jobId:j.id,version:j.version,stage:'intake',value:60000,observedAt:'2026-10-01T09:00:00-04:00'})
 const declinedInput={estimateId:q.id,version:q.version,lineId:q.revisions[0].lines[0].id,readingId:reading.id,reason:'Customer defers until next pay period',evidence:'Signed decision paper RO-4127',dueValue:65000,dueDate:'2099-12-01'}
 await h.command('decline.record',{...declinedInput,lineId:q.revisions[0].lines[1].id},{status:409})
 const item=await h.command('decline.record',declinedInput)
 assert.equal(item.disposition,'declined');assert.equal(item.reason,declinedInput.reason);assert.equal(item.evidence,declinedInput.evidence);assert.deepEqual(item.line,q.revisions[0].lines[0]);assert.deepEqual(item.decision,q.authorisation);assert.equal(item.reading.value,60000);assert.equal(item.reading.unit,'miles');assert.equal(item.dueValue,65000);assert.equal(item.dueDate,'2099-12-01');assert.ok(item.at&&item.owner.id)
 await h.command('decline.record',declinedInput,{status:409})
 j=(await h.state()).records.job.find(x=>x.id===job.id)
 await h.command('work.record',{jobId:j.id,version:j.version,lineId:item.line.id,quantity:1},{status:409})
 j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:q.revisions[0].lines[1].id,quantity:1})
 await qualityReady(h,j)
 j=await h.command('job.complete',{jobId:j.id,version:j.version})
 const oldInvoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version});assert.equal(oldInvoice.lines.length,1);assert.equal(oldInvoice.lines[0].description,'Brake adjustment');assert.equal(oldInvoice.totals.totalCents,10000)
 const next=await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),startAt:'2026-11-01T09:00:00-05:00',endAt:'2026-11-01T10:00:00-05:00'})
 const newQuote=await h.command('decline.reprice',{declinedWorkId:item.id,itemVersion:item.version,jobId:next.job.id,version:next.job.version,unitCents:16000,reason:'Tread remains below recommendation; tire price rechecked'})
 assert.equal(newQuote.estimate.revisions[0].totals.totalCents,68800);assert.equal(newQuote.estimate.status,'draft');assert.equal(newQuote.estimate.authorisation,null);assert.notEqual(newQuote.estimate.id,q.id)
 j=(await h.state()).records.job.find(x=>x.id===next.job.id)
 await h.command('work.record',{jobId:j.id,version:j.version,lineId:newQuote.estimate.revisions[0].lines[0].id,quantity:4},{status:409})
 const decided=await authorise(h,newQuote.estimate)
 assert.equal(decided.authorisation.totals.totalCents,68800)
 j=(await h.state()).records.job.find(x=>x.id===next.job.id)
 await h.command('work.record',{jobId:j.id,version:j.version,lineId:decided.revisions[0].lines[0].id,quantity:4})
 const state=await h.state(),old=state.records.estimate.find(e=>e.id===q.id),kept=state.records.declinedWork.find(d=>d.id===item.id)
 assert.deepEqual(old,q);assert.deepEqual(kept.line,item.line);assert.deepEqual(kept.decision,item.decision);assert.equal(kept.proposals[0].estimateId,decided.id);assert.equal(state.records.invoice.find(i=>i.id===oldInvoice.id).totals.totalCents,10000)
 // The next visit's public page recalls the old price/reason/mileage and both outcomes.
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',cookie:h.owner},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
 const page=await h.request('/app/jobs/'+next.job.id),html=await page.text();assert.equal(page.status,200);assert.match(html,/60,000 miles/);assert.match(html,/65,000 miles/);assert.match(html,/Customer defers until next pay period/);assert.match(html,/Signed decision paper RO-4127/);assert.match(html,/Fresh customer authorization recorded/);assert.match(html,/Original revision 1/);assert.match(html,/not sold/)
 assert.match(html,/Follow-up not due from recorded observations/)
 j=(await h.state()).records.job.find(j=>j.id===next.job.id)
 await h.command('reading.record',{jobId:j.id,version:j.version,stage:'intake',value:65000,observedAt:'2026-10-03T09:00:00-04:00'})
 assert.match(await (await h.request('/app/jobs/'+next.job.id)).text(),/Follow-up due/)
 const full=await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),startAt:'2026-12-01T09:00:00-05:00',endAt:'2026-12-01T10:00:00-05:00'})
 const refused=await authorise(h,await estimate(h,full.job),[])
 assert.equal(refused.status,'declined');assert.equal(refused.authorisation.totals.totalCents,0)
 j=(await h.state()).records.job.find(j=>j.id===full.job.id)
 const later=await h.command('reading.record',{jobId:j.id,version:j.version,stage:'intake',value:61000,observedAt:'2026-10-02T09:00:00-04:00'})
 const deferred=await h.command('decline.record',{estimateId:refused.id,version:refused.version,lineId:refused.revisions[0].lines[0].id,readingId:later.id,disposition:'deferred',reason:'Customer requests deferral',evidence:'Customer phone decision in shop record',dueDate:'2027-01-01'})
 assert.equal(deferred.disposition,'deferred');assert.deepEqual(deferred.decision.lineIds,[])
 const board=await h.request('/app?ro='+j.id);assert.match(await board.text(),/All work declined/)

}))

test('QUALITY-001 / OPS-001: failed brake test blocks ready; corrective work, independent sign-off, reasoned override and immutable restore',()=>run(async h=>{
 const {qualityJourney}=await import('./support/quality-journey.mjs');await qualityJourney(h)
}))

test('QUALITY-001: counter/technician failed test, corrective work and independent Ready clearance at 1440/390',async()=>{
 const {qualityBrowser}=await import('./quality-browser.mjs');await qualityBrowser()
})

test('EST-004: separate incremental decisions, prospective price changes, exact actuals/invoice and recovery',supplementJourney)

test('DVI-001 / DVI-004: exact assigned template, measured/photo outcomes, not-inspected state, canned-job estimate and archive',()=>run(inspectionJourney))
test('DVI-001: native template/recipe/assignment and technician inspection at 1440/390',inspectionBrowser)

test('EST-002: cost-priced packages, finding overrides, immutable rules and fresh-owner recovery',()=>run(pricingJourney))

test('EST-002: native matrix/package editors and reasoned override at 1440 and 390',pricingBrowser)

test('TIME-001: two assigned job timers, breaks, approved corrections, isolation and recovery',()=>run(timeJourney))

test('TIME-001: native clocks, reasoned correction decisions and actual board time at 1440/390',timeBrowser)

test('REPORT-003 / REPORT-006: sold versus actual hours, recomputed corrections, drill-through, owner-only pay rates and recovery',()=>run(reportJourney))

test('REPORT-003: native technician report, rate form and role views at 1440/390',reportBrowser)

test('DIAG-001: codes, measurements, staff-only notes, reviewed sharing and a read-only customer link',()=>run(diagnosisJourney))

test('DIAG-001: native diagnosis form, advisor sharing and customer link at 1440/390',diagnosisBrowser)

test('EST-003: emailed approval link, signed line decision, replay, stale and revoked links and receipt recovery',()=>run(approvalJourney))

test('EST-003: customer approves and declines lines on a phone with a signed receipt at 390/1440',approvalBrowser)

test('EST-006 / EST-007: scheduled reminders chase only the current undecided revision; reply, decision and opt-out stop them; failures and silence open advisor tasks',chaseJourney)

test('EST-006 / EST-007: native chase policy, reminder history, customer opt-out and advisor task at 1440/390',chaseBrowser)


test('FLOW-002: delayed required parts, resource/labor plan, advisor promise notices and archive recovery',()=>run(promiseJourney))
test('FLOW-002: failed/uncertain provider outcome claims one send and remains visible',promiseMailFailureJourney)
test('FLOW-002: revised pickup promise and customer notice through native forms at 1440/390',promiseBrowser)

test('FLOW-004 / FLOW-005: helper crew, dependent subtasks, mentioned advisor with media, acknowledged handoff, per-person time and recovery',()=>run(collaborationJourney,{clock:collaborationClock}))
test('FLOW-004 / FLOW-005: native helper, dependent subtasks, mention and acknowledged handoff at 1440/390',collaborationBrowser)
test('FLOW-001 / REPORT-004 / REPORT-006: nine-stage board, measured delays, promises, gated moves, technician, overdue, priority and search filters, canceled and lost retention, recorded collection and recovery',()=>run(flowJourney))
test('FLOW-001: native board filters, priority, cancel and recorded collection at 1440/390',flowBrowser)

test('PART-006: supplier backorder, approved charge, internal advisor changes, actual receipt, invoice once and fresh-owner archive recovery',()=>run(specialPartJourney))
test('PART-006: approved special order, retained delay, advisor review and physical receipt through native forms at 1440/390',specialPartBrowser)

test('FLOW-003 / OPS-001: deterministic routing, closed-day deadlines, durable escalation and resolution through public doors',routingJourney)

test('EST-001 / OPS-001: fleet/customer rates, direct costs, fees and discounts freeze through consent, actuals, invoice and recovery',()=>run(async h=>{const {estimatePricingJourney}=await import('./support/estimate-pricing-journey.mjs');await estimatePricingJourney(h)}))
test('EST-001: rate profile and discounted mixed estimate through native forms at 1440/390',async()=>{const {estimatePricingBrowser}=await import('./estimate-pricing-browser.mjs');await estimatePricingBrowser()})

test('SUBLET-001 / OPS-001: approved outsourced scope, delayed custody, supplier bills, receiving and quality gates, exact margin and fresh recovery',()=>run(async h=>{const {subletJourney}=await import('./support/sublet-journey.mjs');await subletJourney(h)}))

test('SUBLET-001: outside handoff, delay, added-scope decision, supplier bill, receipt, quality and margin through native forms at 1440/390',async()=>{const {subletBrowser}=await import('./sublet-browser.mjs');await subletBrowser()})

test('PART-002 / OPS-001: barcode receiving, separate balances, blind and cycle variances, approval fences, reports and fresh recovery',async()=>{const {inventoryJourney}=await import('./support/inventory-journey.mjs');await run(inventoryJourney)})
test('PART-002: scan shipment and bins, approve shortage and reconcile through native forms at 1440/390',async()=>{const {inventoryBrowser}=await import('./inventory-browser.mjs');await inventoryBrowser()})

test('BUY-001 / OPS-001: approved spend, partial receipt, repair allocation, backorder, bill exceptions, closure and fresh recovery',async()=>{const {purchasingJourney}=await import('./support/purchasing-journey.mjs');await run(purchasingJourney)})
test('BUY-001: two-line spend approval, partial receiving, backorder and changed bill exception through native forms at 1440/390',async()=>{const {purchasingBrowser}=await import('./purchasing-browser.mjs');await purchasingBrowser()})

test('CUS-001 / OPS-001: owner/admin accounts, previewed merges, payer sessions, frozen invoices and recovery',async()=>{const {customersJourney}=await import('./support/customers-journey.mjs');await run(customersJourney)})
test('CUS-001: admin intake, merge preview and payer-only account billing through native forms at 1440/390',async()=>{const {customersBrowser}=await import('./customers-browser.mjs');await customersBrowser()})

test('PART-001 / OPS-001: declared catalog, two supplier lots, serial identity, exact installed costs, affected repairs, count reconciliation and recovery',async()=>{const {traceJourney}=await import('./support/stock-trace-journey.mjs');await run(traceJourney)})
test('PART-001: maintain catalog, receive two lots, identify installation and find only affected vehicles at 1440/390',async()=>{const {traceBrowser}=await import('./stock-trace-browser.mjs');await traceBrowser()})

test('WARRANTY-001 / OPS-001: paid original, linked lot and no-charge comeback, coverage decision, supplier claim and preserved invoice recovery',async()=>{
 let outboundCalls=0
 await run(async h=>{const {warrantyJourney}=await import('./support/warranty-journey.mjs');const {f}=await warrantyJourney(h);const {coverageJourney}=await import('./support/coverage-follow-up-journey.mjs');await coverageJourney(h,f)},{outboundService:()=>{outboundCalls++;return new Response('No external action is authorized',{status:503})}})
 assert.equal(outboundCalls,0,'Detection, review and human approvals never submit to an external provider')
})

test('WARRANTY-001: original invoice, linked rework, no-charge costs and supplier claim at 1440/390',async()=>{const {warrantyBrowser}=await import('./warranty-browser.mjs');await warrantyBrowser()})

test('RETURN-001 / PAY-004 / OPS-001: quality and unpaid gates, fresh processor split receipts, authorized delegate, keys, mileage, receipt and recovery',async()=>{const {returnJourney}=await import('./support/return-journey.mjs');await returnJourney()})

test('RETURN-001: unpaid refusal, processor confirmation, delegate handover and owner-exception receipt at 1440/390',async()=>{const {returnBrowser}=await import('./return-browser.mjs');await returnBrowser()})

test('PORTAL-001: known and unknown requests answer before mail; address and client limits disclose nothing',async()=>{const {portalRequestJourney}=await import('./support/portal-journey.mjs');await portalRequestJourney()})

test('PORTAL-001: confirmation, separate sessions, sign-out and contact changes fence account access',async()=>{const {portalSessionJourney}=await import('./support/portal-journey.mjs');await portalSessionJourney()})

test('PAY-005 / PAY-008 / OPS-001: reviewed original-tender refunds, exact tax credits, exchanges, account isolation and recovery',async()=>{const {refundsJourney}=await import('./support/refunds-journey.mjs');await refundsJourney()})
test('PAY-005 / PAY-008: one approved Stripe refund, uncertain recovery and duplicate or failed provider outcomes',async()=>{const {stripeRefundJourney}=await import('./support/refunds-journey.mjs');await stripeRefundJourney()})

test('PAY-005: full original cash, check and other manual refunds preserve issued invoices and zero the balance',async()=>{const {fullRefundJourney}=await import('./support/refunds-journey.mjs');await fullRefundJourney()})

test('PAY-005 / PAY-008: payer refund privacy, current-payer refusal and credit statements at 1440 and 390',async()=>{const {refundsBrowser}=await import('./customers-browser.mjs');await refundsBrowser()})

const {onlineBookingJourney,bookingAvailabilityJourney,bookingAbuseJourney}=await import('./support/booking-journey.mjs')
const {bookingsBrowser}=await import('./bookings-browser.mjs')
test('BOOK-001: final-slot contenders retain one exact confirmation, cancel, reclaim and recover with fresh authority',()=>run(onlineBookingJourney))
test('BOOK-001: opening windows, skills, duration, lead time and expiring tentative capacity',()=>run(bookingAvailabilityJourney))
test('BOOK-001: embedded service selection, final-slot contention and released capacity at 1440 and 390',bookingsBrowser)

const {inspectionReportJourney}=await import('./support/inspection-report-journey.mjs')
test('DVI-003: reviewed private evidence, exact proposed lines, delivery and read-only view analytics survive recovery',()=>run(inspectionReportJourney))
const {inspectionReportBrowser}=await import('./inspection-report-browser.mjs')
test('DVI-003: advisor review, email, mobile video and proposed repair at 1440 and 390',inspectionReportBrowser)
test('BOOK-001: failed or uncertain confirmation mail preserves the appointment without an automatic resend',async()=>{const {bookingFailureJourney}=await import('./support/booking-journey.mjs');await bookingFailureJourney()})
test('DVI-003: rejected or uncertain report mail retains one honest attempt without an automatic resend',async()=>{const {inspectionReportFailureJourney}=await import('./support/inspection-report-journey.mjs');await inspectionReportFailureJourney();const {inspectionReportDevelopmentJourney}=await import('./support/inspection-report-journey.mjs');await inspectionReportDevelopmentJourney()})

test('BOOK-001: anonymous tentative holds are bounded per source and normalized email',()=>run(bookingAbuseJourney))

const {calendarJourney}=await import('./support/calendar-journey.mjs')
test('BOOK-002: qualified resources, absences, recurring DST reservations and dispatch contention recover',()=>run(calendarJourney))

const {waitlistCancellationJourney,waitlistExpiryJourney,waitlistLimitsJourney,waitlistSourceLimitJourney,waitlistMailFailureJourney}=await import('./support/waitlist-journey.mjs')
test('BOOK-002 / BOOK-003: cancellation offers FIFO eligible customers one private bounded reservation',()=>run(waitlistCancellationJourney))
test('BOOK-002 / BOOK-003: waitlist offer expiry requires explicit staff advancement',()=>run(waitlistExpiryJourney))
test('BOOK-002 / BOOK-003: existing tentative email holds preserve waitlist eligibility',()=>run(waitlistLimitsJourney))
test('BOOK-002 / BOOK-003: waitlist offers share the tentative source capacity bound',()=>run(waitlistSourceLimitJourney))
test('BOOK-002 / BOOK-003: failed or uncertain waitlist mail never automatically retries',waitlistMailFailureJourney)

const {calendarBrowser}=await import('./calendar-browser.mjs')
test('BOOK-002 / BOOK-003: native day week resources and cancellation offers at 1440 and 390',calendarBrowser)

test('GOV-004: authenticator app, passkey and recovery-code sign-in with replay, clone, origin and guessing fences',()=>run(secondFactorJourney))
test('GOV-004: owner-required policy, lost-device reset and deployment owner recovery',()=>run(policyRecoveryJourney))
test('GOV-004: refunds, agent keys, erasure and custody reveals need a fresh second factor and refusals write nothing',()=>run(stepUpJourney))
test('GOV-004 / GOV-007: stolen, revoked and expired customer links look unknown on every door, misses are paced and no link grants payer authority',()=>run(linkProtectionJourney))
test('GOV-004 / GOV-005: authenticator app, passkey, sign-in confirmation, step-up and sealed connector credentials through native forms at 1440/390',securityBrowser)
test('GOV-005: sealed provider secrets rotate and revoke behind a fresh proof, webhooks prove their origin, and no secret reaches a response, archive, audit row or log',connectorJourney)

 test('GOV-006: explicit holds, customer erasure, import custody and manual retention survive fresh-owner recovery without resurrecting media',async()=>{const {retentionJourney}=await import('./support/retention-journey.mjs');await run(retentionJourney)})

test('GOV-006: owner reviews financial and media holds, erases eligible photos and releases a hold for manual retention at 1440/390',async()=>{const {retentionBrowser}=await import('./retention-browser.mjs');await retentionBrowser()})

test('OPS-002 / OPS-003: durable reminder jobs survive restart, preserve one provider handoff and expose owner recovery',async()=>{const {jobsJourney}=await import('./support/jobs-journey.mjs');await jobsJourney()})

test('OPS-002: account search is paged, indexed, exact across aliases and Unicode, and survives restore',async()=>{const {searchJourney}=await import('./support/search-journey.mjs');await searchJourney()})
test('OPS-002 / OPS-003: approved provider GET jobs survive restart, require explicit replay and deduplicate payment evidence',async()=>{const {providerJobsJourney}=await import('./support/provider-jobs-journey.mjs');await providerJobsJourney()})

test('OPS-002: core RO reads keep lines, inspections and decisions with current crew authority and exact recovery',async()=>{const {repairReadJourney}=await import('./support/repair-read-journey.mjs');await repairReadJourney()})
test('OPS-002: native capacity import verifies record and media graphs before publishing',async()=>{const {capacityImportJourney}=await import('./support/capacity-import-journey.mjs');await capacityImportJourney()})

test('OPS-002 / OPS-003: owner queues, inspects and recovers background jobs through native forms at 1440/390',async()=>{const {jobsBrowser}=await import('./jobs-browser.mjs');await jobsBrowser()})

test('OPS-002: staff search phone and plate and page native account results at 1440/390',async()=>{const {searchBrowser}=await import('./search-browser.mjs');await searchBrowser()})

test('OPS-002: native peer boards update stages and priority while preserving drafts and focus at 1440/390',async()=>{const {boardLiveJourney}=await import('./support/board-live-journey.mjs');await boardLiveJourney()})

test('PART-007 / OPS-001: consumed stock, location demand, open-order deduction, replay-safe drafts, stale approval and recovery',async()=>{const {replenishmentJourney}=await import('./support/replenishment-journey.mjs');await run(replenishmentJourney)})
test('PART-007: low stock, repeated preparation and exact cart approval at 1440/390',async()=>{const {replenishmentBrowser}=await import('./replenishment-browser.mjs');await replenishmentBrowser()})
test('PART-004 / OPS-001: separate taxed core deposit, tender, due alerts, returned condition, shipment, adjusted supplier credit and immutable invoice correction',async()=>{const {coresJourney,coreClock}=await import('./support/cores-journey.mjs');await run(coresJourney,{clock:coreClock})})
test('PART-004: core deposit, expiry alert, shipment and adjusted credit correction at 1440/390',async()=>{const {coresBrowser}=await import('./cores-browser.mjs');await coresBrowser()})
test('PART-005 / OPS-001: installed and unused supplier returns, PO provenance, quarantine, authorization, shipment, partial credit and warranty costs survive recovery',async()=>{const {rmaJourney}=await import('./support/supplier-returns-journey.mjs');await run(rmaJourney)})
test('PART-005: remove failed part, authorize RMA, ship and reconcile partial credit at 1440/390',async()=>{const {rmaBrowser}=await import('./supplier-returns-browser.mjs');await rmaBrowser()})
test('PART-008 / OPS-001: serialized inter-store request, approval, dispatch, shortage/damage custody, exact corrections and recovery',async()=>{const {transfersJourney}=await import('./support/transfers-journey.mjs');await run(transfersJourney)})
test('PART-008: serialized inter-store transfer received short and approved correction at 1440/390',async()=>{const {transfersBrowser}=await import('./transfers-browser.mjs');await transfersBrowser()})
test('BUY-002 / OPS-001: supplier comparison, exact cart approval, timed-out submit replay, rejected substitution, cancellation, rejected orders and recovery',async()=>{const {supplierJourney}=await import('./support/supplier-orders-journey.mjs');await supplierJourney()})
test('BUY-002: compare suppliers, approve cart, reconcile timeout, reject substitution and inspect cancellation/rejection at 1440/390',async()=>{const {supplierBrowser}=await import('./supplier-orders-browser.mjs');await supplierBrowser()})
test('ASSET-001 / OPS-001: typed bicycle, device, equipment and auto repairs retain custody, parts, tax, paid returns and recovery',()=>run(async h=>{const {assetJourney}=await import('./support/asset-journey.mjs');await assetJourney(h)}))
test('ASSET-001: typed intake, bench booking and paid return through native forms at 1440/390',async()=>{const {assetBrowser}=await import('./asset-browser.mjs');await assetBrowser()})
test('DIAG-002 / OPS-001: private Phonecheck result imports retain raw tests, quarantine serial mismatches and recover without shared authority',()=>run(async h=>{const {diagnosticResultsJourney}=await import('./support/diagnostic-results-journey.mjs');await diagnosticResultsJourney(h)}))
test('DIAG-002: native private result import, mismatch and raw evidence at 1440/390',async()=>{const {diagnosticResultsBrowser}=await import('./diagnostic-results-browser.mjs');await diagnosticResultsBrowser()})

import {invoiceDocumentsJourney} from './support/invoice-documents-journey.mjs'
test('INV-001: exact mixed USD copies, linked corrections, single Base mail handoff and private archive recovery',invoiceDocumentsJourney)

import {invoiceDocumentsBrowser} from './invoice-documents-browser.mjs'
test('INV-001: owner issues, prints, emails and corrects invoice copies through native forms at 1440 and 390',invoiceDocumentsBrowser)

test('PAY-004 / OPS-001: pre-order deposits, cross-invoice allocations, split tender, cancellation refunds and fresh recovery',async()=>{const {stripeEdge}=await import('./support/return-journey.mjs'),edge=stripeEdge();await run(async h=>{const {depositsJourney}=await import('./support/deposits-journey.mjs');await depositsJourney(h,{edge})},{bindings:{STRIPE_SECRET_KEY:'synthetic-mallet-91'},outboundService:edge.edge})})

test('PART-003 / OPS-001: atomic reserved lot usage, last-item conflicts, cancellation release, recorded returns and recovery',()=>run(async h=>{const {stockConsumptionJourney}=await import('./support/stock-consumption-journey.mjs');await stockConsumptionJourney(h)}))

test('PAY-004: owner records pre-order deposits, allocates customer credit and refunds canceled deposits through native forms at 1440 and 390',async()=>{const {depositsBrowser}=await import('./inventory-browser.mjs');await depositsBrowser()})

test('PART-003: reserved work, inspected stock returns and cancellation release through native forms at 1440 and 390',async()=>{const {stockConsumptionBrowser}=await import('./inventory-browser.mjs');await stockConsumptionBrowser()})

test('AR-001 and FLEET-001: owner-reviewed terms, credit limits, fleet authorizer, check allocation, disputes, promises and private recovered statements',()=>run(async h=>{const {receivablesJourney}=await import('./support/receivables-journey.mjs');await receivablesJourney(h)}))

test('AR-001, FLEET-001 and TAX-002: native terms, fleet PO, disputed statement, promise and observed-clearance preview at 1440 and 390',async()=>{const {receivablesBrowser}=await import('./receivables-browser.mjs');await receivablesBrowser()})

 test('GOV-002: private searchable audit retains decisions after revocation and fresh-owner recovery',()=>run(auditJourney))
 test('GOV-001: owner-only grants bound staff commands, private projections, handoffs and revoked authority',()=>run(staffJourney))

test('GOV-001 and GOV-002: owner grants, bounded staff handoff and private audit search and downloads at 1440 and 390',governanceBrowser)

test('Stripe public doors treat inherited handler names as unknown without exposing bindings',async()=>{
 const edge=collectionEdge(),canary='synthetic-mallet-prototype-binding'
 await run(async h=>{
  await shopSetup(h)
  await h.stepUp()
  const results=[]
  for(const command of ['unknown-handler','constructor','__proto__','hasOwnProperty']){
   for(const api of [true,false]){
    const response=api?await h.request('/api/mallet/stripe/'+command,{method:'POST',body:{}}):await h.mf.dispatchFetch(h.origin+'/app/stripe',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({command}).toString()})
    const body=await response.text()
    // Only booleans and status codes reach assertion diagnostics, never response bodies.
    results.push({command,api,status:response.status,unknown:api?body.includes('"error":"not_found"'):body.includes('not_found'),private:![canary,'synthetic-mallet-800','SESSION_SECRET','SETUP_TOKEN','STRIPE_SECRET_KEY','AUTH_ORIGIN'].some(value=>body.includes(value))})
   }
  }
  assert.deepEqual(results,['unknown-handler','constructor','__proto__','hasOwnProperty'].flatMap(command=>[true,false].map(api=>({command,api,status:404,unknown:true,private:true}))))
  assert.equal(edge.calls.length,0,'Unknown names never reach Stripe')
  const response=await h.request('/api/mallet/stripe/connect',{method:'POST',body:{consent:true}})
  assert.equal(response.status,200)
  assert.equal((await response.json()).accountId,'synthetic-mallet-801','A registered handler still works')
 },{bindings:{AUTH_LOCAL:'true',STRIPE_SECRET_KEY:'synthetic-mallet-800',PROTOTYPE_CANARY:canary},outboundService:edge.edge})
})

test('PAY-001: owner checkout, authenticated event replay, exact fee and payout membership and inert recovery',async()=>{
 const edge=collectionEdge()
 await run(h=>stripeJourney(h,edge),{entry:'tests/dev-worker.ts',bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
})
test('PAY-001: native merchant connection, invoice checkout and fee reconciliation at 1440 and 390',stripeBrowser)

test('PAY-001: explicit expiration and uncertain checkout stay stopped without allocating money',async()=>{
 const edge=collectionEdge()
 await run(h=>stripeStoppedJourney(h,edge),{entry:'tests/dev-worker.ts',bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
})

test('PAY-001: owner reader collection, authenticated payment and exact replay survive recovery',async()=>{
 const edge=terminalEdge()
 await run(h=>terminalJourney(h,edge),{entry:'tests/dev-worker.ts',bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
})
test('PAY-001: uncertain reader initiation and cancellation reconcile without outbound replay',async()=>{
 const edge=terminalEdge()
 await run(h=>terminalStoppedJourney(h,edge),{entry:'tests/dev-worker.ts',bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
})

test('PAY-001: authenticated ACH returns and reinstatement preserve captured payments across replay and recovery',async()=>{
 const edge=stripeReturnsEdge()
 await run(h=>stripeReturnsJourney(h,edge),{entry:'tests/dev-worker.ts',bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
})

test('AUTO-001: appointment email quiet hours across DST, replacement, cancellation, failure and inert recovery',async()=>{const {appointmentOutreachJourney}=await import('./support/outreach-journey.mjs');await appointmentOutreachJourney()})
test('AUTO-004: approved refreshed quote, observed mileage, explicit stop and repeat decline preserve decisions',async()=>{const {declinedOutreachJourney,declinedEligibilityJourney,declinedErasureJourney,declinedCustomerJourney,declinedClockJourney,declinedBookingJourney}=await import('./support/outreach-journey.mjs');await declinedOutreachJourney();await declinedEligibilityJourney();await declinedErasureJourney();await declinedCustomerJourney();await declinedClockJourney();await declinedBookingJourney()})
test('AUTO-001 and AUTO-004: owner schedules and stops email through native forms at 1440 and 390',async()=>{const {outreachBrowser}=await import('./outreach-browser.mjs');await outreachBrowser()})

test('GOV-003: explicit provider sign-in, SCIM employment revocation and repair attribution survive recovery',enterpriseJourney)

test('GOV-003: owner provisions and revokes a technician through native settings at 1440 and 390',enterpriseBrowser)

test('GOV-003: signed SAML admission, employment revocation and repair attribution survive recovery',async()=>{const {samlJourney}=await import('./support/saml-journey.mjs');await samlJourney()})

test('GOV-003: signed SAML browser admission and old-session refusal at 1440 and 390',async()=>{const {samlBrowser}=await import('./enterprise-saml-browser.mjs');await samlBrowser()})

test('AUTO-005: paid collection permits one consented review handoff with private and inert recovery',async()=>{const {reviewDeliveryJourney}=await import('./support/reviews-journey.mjs');await reviewDeliveryJourney()})
test('AUTO-005: poor private feedback keeps the public invitation and creates an owner task with erasure and recovery',async()=>{const {reviewFeedbackJourney}=await import('./support/reviews-journey.mjs');await reviewFeedbackJourney()})
test('AUTO-005: owner request, customer feedback and completed-repair task through native forms at 1440 and 390',async()=>{const {reviewsBrowser}=await import('./reviews-browser.mjs');await reviewsBrowser()})

test('AUTO-002: approved stage email sends once, uncollected pickup reaches the owner and recovery is inert',async()=>{const {statusDeliveryJourney}=await import('./support/status-notices-journey.mjs');await statusDeliveryJourney()})
test('AUTO-002: quiet hours, changed repairs, failed contact, withdrawal and collection stop unsafe notices',async()=>{const {statusStopsJourney}=await import('./support/status-notices-journey.mjs');await statusStopsJourney()})
test('AUTO-002: owner reviews status email, failed contact and pickup follow-up through native forms at 1440 and 390',async()=>{const {statusNoticesBrowser}=await import('./status-notices-browser.mjs');await statusNoticesBrowser()})

test('API-002: signed business outbox, bounded delivery, rotation, replay and inert recovery',async()=>{
 const {webhookJourney}=await import('./support/webhook-journey.mjs');await webhookJourney()
})

test('API-002: pinned public Crank workflow receives signed events and applies replay once',async()=>{
 const {crankWebhookJourney}=await import('./support/webhook-journey.mjs');await crankWebhookJourney()
})
const assistantProof=await import('./support/assistant-journey.mjs')
test('ADV-008: separate scoped authority refuses unsafe roles, channels, spending, expiry and preparation-key expansion',()=>run(assistantProof.assistantAuthorityJourney))
test('ADV-008: disclosed receptionist captures requested intake, reserves actual capacity and escalates to a person',()=>run(assistantProof.assistantIntakeJourney))
test('ADV-008: every note proposal preserves raw technician evidence and measured facts without publication',()=>run(assistantProof.assistantNotesJourney))
test('ADV-008: exact human email review, queued revocation, single handoff and inert archive recovery',()=>run(assistantProof.assistantSendJourney))
test('ADV-008: owner scopes, reviews and revokes assistant work with human handoff at 1440 and 390',async()=>{const {assistantsBrowser}=await import('./assistants-browser.mjs');await assistantsBrowser()})
test('ADV-008: failed or uncertain appointment email survives restart without an automatic retry and reaches human recovery',assistantProof.assistantFailureJourney)
test('API-001: versioned resource pages, retained repair history and stable identities recover without credentials',()=>run(async h=>{const {shopApiReadJourney}=await import('./support/shop-api-journey.mjs');await shopApiReadJourney(h)}))
test('API-001: scoped preparation retries are atomic across transports and preserve each existing person decision',()=>run(async h=>{const {shopApiRetryJourney}=await import('./support/shop-api-journey.mjs');await shopApiRetryJourney(h)}))
test('API-001: missing scopes, alternate transports and expired or revoked authority fail closed',()=>run(async h=>{const {shopApiAuthorityJourney}=await import('./support/shop-api-journey.mjs');await shopApiAuthorityJourney(h)}))

test('ADV-005: cited declined-work review preserves decisions, refuses stale or unsafe preparation and recovers erased history',async()=>{const {declinedReviewJourney}=await import('./support/declined-work-review-journey.mjs');await declinedReviewJourney()})
test('ADV-005: owner reviews later mileage, replacement inspection and advisory history at 1440 and 390',async()=>{const {declinedReviewBrowser}=await import('./declined-work-review-browser.mjs');await declinedReviewBrowser()})
test('RETURN-002: reviewed CA and TX storage versions, notice clocks, disposal refusal, payment release and private recovery',()=>run(async h=>{const {storageJourney}=await import('./support/storage-journey.mjs');await storageJourney(h)}))
test('RETURN-002: native storage rules, notices, legal refusal and released ledger at 1440 and 390',async()=>{const {storageBrowser}=await import('./storage-browser.mjs');await storageBrowser()})
