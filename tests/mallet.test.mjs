import {test} from 'node:test'
import assert from 'node:assert/strict'
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
 await h.command('job.book',{...input,bayId:'Bay 2',technicianId:'Alex'},{status:409})
 const post=(path,fields)=>h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',cookie:h.owner},body:new URLSearchParams(fields).toString()})
 assert.equal((await post('/setup',{confirm:'yes'})).status,303)
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

test('complete archive restores records and import custody; populated restore is refused',()=>run(async h=>{
 const input=await snapshots(),plan=await h.api('/api/mallet/imports/preview',input),imported=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint})
 const backup=await archive(h),fresh=await installation()
 try{
  await restore(fresh,backup)
  assert.deepEqual((await fresh.state()).records.asset,(await h.state()).records.asset)
  const journal=await fresh.api('/api/mallet/imports/journal?id='+imported.id);assert.equal(journal.originals.length,2)
  const failed=await restore(fresh,backup,{status:409});assert.ok(failed.error)
 }finally{await fresh.close()}
}))

test('unused imported asset erasure withdraws custody and later journal fences old restore',()=>run(async h=>{
 const input=await snapshots(),plan=await h.api('/api/mallet/imports/preview',input),job=await h.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint}),old=await archive(h)
 const asset=(await h.state()).records.asset[0],member=await h.person('tech@example.test')
 await h.command('asset.erase',{assetId:asset.id,confirm:'ERASE'},{as:member.cookie,status:403})
 await h.command('asset.erase',{assetId:asset.id,confirm:'no'},{status:400})
 await h.command('asset.erase',{assetId:asset.id,confirm:'ERASE'})
 assert.ok(!(await h.state()).records.asset?.some(a=>a.id===asset.id))
 const later=await archive(h),fresh=await installation()
 try{const failed=await restore(fresh,old,{status:400,laterJournal:{sourceIdentity:later[0].sourceIdentity,epoch:later[0].epoch,journal:later[0].journal}});assert.ok(failed.error)}finally{await fresh.close()}
 await h.api('/api/mallet/imports/undo',{id:job.id})
 assert.ok(!(await h.state()).records.asset?.some(a=>a.id===asset.id))
}))
