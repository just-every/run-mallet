import assert from 'node:assert/strict'
import {archive,restore,installation} from '../harness.mjs'
export const coverageDates={startsAt:'2026-01-01T00:00:00.000Z',endsAt:'2027-12-31T23:59:59.000Z',dueAt:'2026-11-01T12:00:00.000Z'}
export async function coverageFixture(h,f){
 const job=(await h.state()).records.job.find(j=>j.id===f.job.id)
 const terms=await h.command('warranty.terms',{invoiceId:f.invoice.id,version:f.invoice.version,...coverageDates,mileageLimit:100000,unit:'mi',terms:'Shop-asserted pad warranty; time and mileage bounds require a separate coverage decision.'})
 const base={jobId:job.id,version:job.version,...coverageDates,consentEvidence:'Customer asked for an internal coverage review; recorded telephone permission, synthetic-mallet-600. No sending permission.'}
 const warranty={...base,kind:'warranty',reference:'synthetic-mallet-601',termsId:terms.id}
 const contract={...base,kind:'service-contract',reference:'synthetic-mallet-602',documentReference:'synthetic-mallet-603',terms:'Retained service contract; customer must decide any renewal separately.',evidence:'Owner transcribed dates from retained signed agreement synthetic-mallet-603; no provider verification.'}
 return {terms,base,warranty,contract}
}
export async function coverageJourney(h,f){
 const fixture=await coverageFixture(h,f),{warranty,contract}=fixture,owner=(await h.state()).actor
 const admin=await h.person(['synthetic-mallet-coverage-advisor','example.test'].join('@'),'admin'),member=await h.person(['synthetic-mallet-coverage-tech','example.test'].join('@')),key=await h.command('agent.create',{label:'synthetic-mallet-604'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 const baseline=(await h.state()).records
 for(const command of ['coverage.schedule','coverage.cancel','coverage.transfer','coverage.symptom','coverage.resolve','coverage.activate']){
  for(const opts of [{as:'',status:401},{as:admin.cookie,status:403},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,warranty,opts)
 }
 await h.command('coverage.sweep',{localIds:[]},{status:404})
 await h.command('coverage.schedule',{...contract,evidence:''},{status:400})
 await h.command('coverage.schedule',{...warranty,dueAt:'2028-01-01T00:00:00Z'},{status:409})
 assert.deepEqual((await h.state()).records,baseline,'Denied or unevidenced changes leave the original records exact')
 let check=await h.command('coverage.schedule',warranty),renewal=await h.command('coverage.schedule',contract)
 assert.equal(check.source.id,fixture.terms.id);assert.equal(check.source.independentlyVerified,false);assert.equal(renewal.source.independentlyVerified,false)
 assert.equal(renewal.source.startsAt,coverageDates.startsAt);assert.equal(renewal.source.endsAt,coverageDates.endsAt)
 assert.deepEqual(await h.command('coverage.schedule',warranty),check)
 await h.command('coverage.schedule',{...warranty,dueAt:'2026-11-02T12:00:00Z'},{status:409})
 const canceled=await h.command('coverage.schedule',{...contract,reference:'synthetic-mallet-605',documentReference:'synthetic-mallet-605-document'})
 await h.command('coverage.cancel',{id:canceled.id,version:canceled.version,reason:'Customer canceled the agreement; retained source synthetic-mallet-606'})
 await h.command('coverage.schedule',{...contract,reference:'synthetic-mallet-605-replay',documentReference:'synthetic-mallet-605-document'},{status:409})
 const renewalAt=Date.parse(coverageDates.dueAt),messages=h.messages.length
 await h.cron(renewalAt-1);assert.equal((await h.state()).records.coverageTask?.length??0,0)
 await h.cron(renewalAt);await h.restart();await h.cron(renewalAt)
 let s=await h.state();check=s.records.coverageReview.find(r=>r.id===check.id);renewal=s.records.coverageReview.find(r=>r.id===renewal.id)
 assert.equal(s.records.coverageTask.length,2,'Exactly one native task for each due, eligible schedule after replay and restart')
 const task=s.records.coverageTask.find(t=>t.coverageId===check.id)
 assert.equal(task.scheduledBy.id,owner.id);assert.equal(task.createdBy.role,'system');assert.equal(task.dueAt,coverageDates.dueAt)
 assert.equal(s.records.coverageTask.some(t=>t.coverageId===canceled.id),false)
 const report={id:check.id,version:check.version,reference:'synthetic-mallet-607',symptom:'Same pad squeal after the original repair',evidence:'Customer telephone report synthetic-mallet-608; recorded by owner, no diagnosis inferred.',reportedAt:'2026-10-01T10:00:00Z'}
 check=await h.command('coverage.symptom',report)
 check=await h.command('coverage.symptom',{...report,version:check.version})
 assert.equal(check.symptoms.length,1);assert.equal(check.symptoms[0].text,report.symptom);assert.equal(check.jobId,f.job.id);assert.equal(check.assetId,f.job.assetId);assert.equal(check.symptoms[0].by.id,owner.id)
 const beforeResolve=(await h.state()).records
 await h.command('coverage.resolve',{id:check.id,version:check.version,reason:'Unsafe advisor completion'},{as:admin.cookie,status:403})
 assert.deepEqual((await h.state()).records,beforeResolve)
 check=await h.command('coverage.resolve',{id:check.id,version:check.version,reason:'Owner reviewed saved terms and linked symptom. Further work needs separate customer authorization.'})
 assert.equal((await h.state()).records.coverageTask.find(t=>t.id===task.id).status,'completed')
 // A later review remains inert when recovered until a fresh owner explicitly activates it.
 const pendingInput={...contract,reference:'synthetic-mallet-609',dueAt:'2027-01-01T00:00:00Z'},pending=await h.command('coverage.schedule',pendingInput)
 const final=(await h.state()).records,backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:['synthetic-mallet-coverage-recovery','example.test'].join('@')}})
 try{
  assert.ok(!backup[0].tables.some(t=>t.name==='mallet_coverage_authority'))
  await restore(fresh,backup)
  for(const kind of ['coverageReview','coverageTask','warrantyTerms','invoice','export'])assert.deepEqual((await fresh.state()).records[kind],final[kind],'Recovery retains exact '+kind+' history')
  await fresh.state({as:h.owner,status:401})
  const future=Date.parse('2027-01-01T00:00:00Z')
  await fresh.command('coverage.schedule',pendingInput)
  await fresh.cron(future)
  assert.equal((await fresh.state()).records.coverageTask.length,2,'A replayed archived capture cannot restore scheduling permission')
  const setup=await fresh.mf.dispatchFetch(fresh.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:fresh.origin,cookie:fresh.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=10&partsTaxable=yes&laborTaxable=yes'});assert.equal(setup.status,303)
  const local=await fresh.request('/app/jobs/'+f.job.id+'/coverage');assert.equal(local.status,200);assert.match(await local.text(),/Review scheduling paused/)
  await fresh.command('coverage.activate',{id:pending.id,version:pending.version,reason:'Fresh destination owner reviewed current vehicle, source and permission.'})
  await fresh.cron(future);await fresh.cron(future)
  assert.equal((await fresh.state()).records.coverageTask.filter(t=>t.coverageId===pending.id).length,1)
 }finally{await fresh.close()}
 const asset=(await h.state()).records.asset.find(a=>a.id===f.job.assetId)
 await h.command('coverage.transfer',{assetId:asset.id,version:asset.version,reason:'Customer reported vehicle sale; owner recorded source synthetic-mallet-610'})
 await h.cron('2027-01-01T00:00:00Z')
 s=await h.state();assert.equal(s.records.coverageReview.find(r=>r.id===pending.id).status,'transferred');assert.equal(s.records.coverageTask.some(t=>t.coverageId===pending.id),false)
 assert.equal(s.records.coverageTask.find(t=>t.coverageId===renewal.id).status,'suppressed')
 await h.command('coverage.schedule',{...contract,reference:'synthetic-mallet-610-replay'},{status:409})
 // A real update of the ownership record also suppresses an outstanding task without a manual stop.
 const currentAsset=(await h.state()).records.asset.find(a=>a.id===asset.id)
 let changed=await h.command('asset.update',{assetId:asset.id,version:currentAsset.version,customerName:'New recorded owner',customerEmail:'',label:asset.label,identifier:asset.identifier})
 const changedInput={...contract,reference:'synthetic-mallet-613',documentReference:'synthetic-mallet-613-document'}
 const changedReview=await h.command('coverage.schedule',changedInput)
 changed=await h.command('asset.update',{assetId:changed.id,version:changed.version,customerName:'Later recorded owner',customerEmail:'',label:changed.label,identifier:changed.identifier})
 await h.cron('2027-01-01T00:00:00Z')
 assert.equal((await h.state()).records.coverageReview.find(r=>r.id===changedReview.id).status,'transferred')
 await h.command('coverage.transfer',{assetId:changed.id,version:changed.version,reason:'Owner records a further sale with no outstanding reviews.'})
 await h.command('coverage.schedule',{...contract,reference:'synthetic-mallet-614',documentReference:'synthetic-mallet-614-document'},{status:409})
 await h.command('coverage.activate',{id:pending.id,version:s.records.coverageReview.find(r=>r.id===pending.id).version,reason:'Cannot undo recorded transfer'},{status:409})
 assert.equal(h.messages.length,messages,'No task, symptom, cancellation or transfer sends renewal mail')
 assert.deepEqual(s.records.invoice.find(i=>i.id===f.invoice.id),f.invoice,'Review tasks never reprice or renew the original invoice')
 const privateState=await h.state({as:admin.cookie});assert.equal(privateState.records.coverageReview,undefined);assert.equal(privateState.records.coverageTask,undefined);assert.ok(privateState.records.event.every(e=>!e.kind.startsWith('coverage.')))
 assert.equal((await h.request('/app/jobs/'+f.job.id+'/coverage',{as:admin.cookie})).status,403)
 await h.command('agent.revoke',{id:key.id});await h.command('coverage.schedule',warranty,{...agent,status:401})
 // Existing customer erasure is the public privacy door for the private free-text observations.
 const customerId=asset.customerAccountId
 assert.ok(customerId)
 const preview=await h.command('retention.preview',{customerId,categories:['personal','import']})
 await h.command('customer.erase',{customerId,categories:['personal','import'],fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requested removal of eligible personal records.',consentEvidence:'Verified customer erasure request synthetic-mallet-611'})
 s=await h.state();const erased=s.records.coverageReview.find(r=>r.id===check.id)
 assert.equal(erased.status,'erased');assert.equal(erased.symptoms[0].text,undefined);assert.equal(erased.basis,null);assert.equal(erased.reference,'erased-'+erased.id);assert.equal(erased.ownership,'0'.repeat(64))
 await h.command('coverage.schedule',{...contract,reference:'synthetic-mallet-612'},{status:409})
 const recovered=await installation()
 try{await restore(recovered,await archive(h));const r=(await recovered.state()).records.coverageReview.find(r=>r.id===check.id);assert.deepEqual(r,erased);await recovered.cron('2027-02-01T00:00:00Z');assert.equal((await recovered.state()).records.coverageReview.find(r=>r.id===check.id).status,'erased')}finally{await recovered.close()}
}
