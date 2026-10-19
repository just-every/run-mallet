import {supplementJourney} from './support/supplement-journey.mjs'
import {qualityReady} from './support/quality-ready.mjs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {portableRepair} from './support/portable-repair.mjs'
import {run,installation,assetInput,booking,estimate,authorise,archive,restore,snapshots} from './harness.mjs'

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

test('agent prepares, person approves, immutable actual-work invoice exports once',()=>run(async h=>{
 const {job}=await booking(h),key=await h.command('agent.create',{label:'Workshop assistant'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 let q=await estimate(h,job,agent)
 await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1},{...agent,status:403})
 q=await authorise(h,q,[q.revisions[0].lines[0].id])
 let j=(await h.state()).records.job[0]
 j=await h.command('work.record',{jobId:j.id,version:j.version,lineId:q.revisions[0].lines[0].id,quantity:2})
 await qualityReady(h,j)
 j=await h.command('job.complete',{jobId:j.id,version:j.version})
 let invoice=await h.command('invoice.prepare',{jobId:j.id,version:j.version},agent)
 assert.equal(invoice.totals.totalCents,5500);assert.equal(invoice.lines.length,1)
 await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version},{status:409})
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
 const a=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),b=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 assert.deepEqual(a,b);assert.equal((await h.state()).records.export.length,1)
 const response=await h.request(`/api/mallet/exports/${a.id}`);assert.equal(response.status,200);assert.match(await response.text(),/55.00/)
 assert.equal((await h.state()).records.approval.length,2)
 await h.command('agent.revoke',{id:key.id})
 await h.state({...agent,status:401})
}))

test('dispatch proposal is inert until a person approves current free resources',()=>run(async h=>{
 const {job}=await booking(h),key=await h.command('agent.create',{label:'Dispatcher'}),agent={as:'',headers:{authorization:`Bearer ${key.token}`}}
 const p=await h.command('dispatch.prepare',{jobId:job.id,version:job.version,bayId:'Bay 2',technicianId:'Jordan',startAt:'2026-10-20T09:00:00+10:00',endAt:'2026-10-20T10:00:00+10:00',reason:'Move to the diagnostic bay'},agent)
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
 assert.equal((await h.state()).records.asset,undefined)
 await h.api('/api/mallet/imports/apply',{...input,fingerprint:'0'.repeat(64)},{status:409})
 let job=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint})
 while(job.state!=='completed')job=await h.api('/api/mallet/imports/resume',{id:job.id})
 const repeated=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint});assert.equal(repeated.id,job.id)
 const journal=await h.api('/api/mallet/imports/journal?id='+job.id)
 assert.ok(journal.originals.length>=2);assert.ok(journal.batches.length)
 assert.equal((await h.state()).records.asset.length,plan.links.length)
 let undone=await h.api('/api/mallet/imports/undo',{id:job.id})
 while(undone.state!=='undone')undone=await h.api('/api/mallet/imports/undo',{id:job.id})
 assert.equal((await h.state()).records.asset,undefined)
}))

test('import undo preserves an asset once it has a native repair visit',()=>run(async h=>{
 const input=await snapshots(),plan=await h.api('/api/mallet/imports/preview',input)
 const imported=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint})
 const asset=(await h.state()).records.asset[0];await booking(h,{asset})
 const failed=await h.api('/api/mallet/imports/undo',{id:imported.id},{status:409})
 assert.ok(failed.error);assert.equal((await h.state()).records.job.length,1)
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
