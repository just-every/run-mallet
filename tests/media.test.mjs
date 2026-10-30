import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {crc32} from 'node:zlib'
import {run,booking,archive,restore,installation} from './harness.mjs'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
// A real PNG with a large ancillary metadata chunk makes interruption span
// multiple chunks without a repository binary or a substitute application.
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')
const text=Buffer.from('Inspection source\0'+'brake evidence; '.repeat(10000)),type=Buffer.from('tEXt'),length=Buffer.alloc(4),crc=Buffer.alloc(4)
length.writeUInt32BE(text.length);crc.writeUInt32BE(crc32(Buffer.concat([type,text])))
const photo=Buffer.concat([pixel.subarray(0,pixel.length-12),length,type,text,crc,pixel.subarray(-12)])
const path='/api/mallet/media'
const chunk=(bytes,index)=>{const b=bytes.subarray(index*65536,Math.min(bytes.length,(index+1)*65536));return{sha256:hash(b),base64:b.toString('base64')}}

test('DVI-002 and OPS-001: private original and shared custody, interrupted upload, exact replay, assignment and revocation and full archive recovery',()=>run(async h=>{
 const tech=await h.person('brake-tech@example.test'),other=await h.person('other-tech@example.test')
 const unassigned=await h.person(tech.session.operator.email.replace('brake-tech','synthetic-mallet-3'))
 let {job}=await booking(h,{technicianId:tech.id})
 const started=Date.now(),input={jobId:job.id,clientId:randomUUID(),title:'Front brake pad wear',capturedAt:'2026-10-01T09:15:00-04:00'}
 await h.api(path+'/findings',input,{as:'',status:401})
 await h.api(path+'/findings',input,{as:other.cookie,status:404})
 await h.api(path+'/findings',input,{headers:{origin:'https://elsewhere.test'},status:403})
 await h.api(path+'/findings',{...input,capturedAt:'2026-02-31T09:15:00Z'},{status:400})
 const finding=await h.api(path+'/findings',input,{as:tech.cookie})
 assert.equal(finding.by.id,tech.id);assert.equal(finding.capturedAt,'2026-10-01T13:15:00.000Z');assert.ok(Date.parse(finding.createdAt)>=started)
 const createdAudit=(await h.api('/api/mallet/audit?q='+finding.id)).entries
 assert.deepEqual(await h.api(path+'/findings',input,{as:tech.cookie}),finding)
 assert.deepEqual((await h.api('/api/mallet/audit?q='+finding.id)).entries,createdAudit,'Finding replay adds no change')
 await h.api(path+'/findings',{...input,title:'Changed replay'},{status:409})
 const originalInput={findingId:finding.id,clientId:randomUUID(),variant:'original',filename:'front-brake.png',mime:'image/png',size:photo.length,sha256:hash(photo),capturedAt:finding.capturedAt}
 await h.api(path+'/uploads',{...originalInput,size:8*1024*1024+1},{status:400})
 await h.api(path+'/uploads',{...originalInput,mime:'video/webm',size:32*1024*1024+1},{status:400})
 let upload=await h.api(path+'/uploads',originalInput,{as:tech.cookie})
 assert.equal(upload.complete,false);assert.deepEqual(upload.received,[])
 await h.api(path+'/uploads/'+upload.id+'/complete',{},{status:409})
 const first=await h.api(path+'/uploads/'+upload.id+'/chunks/0',chunk(photo,0),{method:'PUT',as:tech.cookie})
 assert.deepEqual(first.received,[0]);assert.deepEqual(await h.api(path+'/uploads/'+upload.id+'/chunks/0',chunk(photo,0),{method:'PUT',as:tech.cookie}),first)
 const wrong=Buffer.from(photo);wrong[100]^=1
 await h.api(path+'/uploads/'+upload.id+'/chunks/0',chunk(wrong,0),{method:'PUT',status:409})
 await h.api(path+'/uploads/'+upload.id+'/chunks/1',{...chunk(photo,1),sha256:'0'.repeat(64)},{method:'PUT',status:400})
 const progress=await h.api(path+'/uploads/'+upload.id);assert.deepEqual(progress.received,[0]);assert.equal(progress.contentUrl,null)
 await h.api(path+'/uploads/'+upload.id+'/content',undefined,{status:409})
 // Dispatch changes current visibility immediately, without rewriting capture provenance.
 const proposal=await h.command('dispatch.prepare',{jobId:job.id,version:job.version,bayId:job.bayId,technicianId:other.id,startAt:job.startAt,endAt:job.endAt,reason:'Specialist takes over'})
 await h.command('dispatch.approve',{proposalId:proposal.id,version:proposal.version})
 await h.api(path+'/uploads/'+upload.id,undefined,{as:tech.cookie,status:404})
 await h.api(path+'/uploads/'+upload.id+'/chunks/1',chunk(photo,1),{method:'PUT',as:tech.cookie,status:404})
 // Explicit resume reads stored progress; only unconfirmed chunks are submitted.
 upload=await h.api(path+'/uploads',originalInput)
 assert.deepEqual(upload.received,[0])
 for(let i=1;i<Math.ceil(photo.length/65536);i++)await h.api(path+'/uploads/'+upload.id+'/chunks/'+i,chunk(photo,i),{method:'PUT'})
 upload=await h.api(path+'/uploads/'+upload.id+'/complete',{})
 const mediaAudit=(await h.api('/api/mallet/audit?q='+job.id)).entries.filter(e=>e.action.startsWith('media.'));assert.ok(mediaAudit.some(e=>e.actor.id===tech.id&&e.evidence.includes('job:'+job.id)),'Private media writes retain the real actor and repair reference');assert.ok(!JSON.stringify(mediaAudit).includes(photo.toString('base64')),'Audit never copies media bytes')
 assert.deepEqual(mediaAudit.find(e=>e.action==='media.finding.created').changes,[{kind:'mediaFinding',id:finding.id,beforeRevision:null,afterRevision:1}]);assert.deepEqual(mediaAudit.find(e=>e.action==='media.upload.completed').changes,[{kind:'mediaUpload',id:upload.id,beforeRevision:1,afterRevision:2}]);assert.equal(upload.revision,2)
 assert.equal(upload.complete,true);assert.equal(upload.sha256,hash(photo));assert.equal(upload.by.id,tech.id);assert.equal(upload.capturedAt,finding.capturedAt);assert.ok(Date.parse(upload.receivedAt)>=started)
 const duplicate=await h.api(path+'/uploads',{...originalInput,clientId:randomUUID()});assert.equal(duplicate.id,upload.id)
 await h.api(path+'/uploads',{...originalInput,filename:'changed.png'},{status:409})
 assert.deepEqual(await h.api(path+'/uploads/'+upload.id+'/complete',{}),upload)
 for(const as of [h.owner,other.cookie]){
  const response=await h.request(upload.contentUrl,{as});assert.equal(response.status,200)
  const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual(bytes,photo);assert.equal(hash(bytes),originalInput.sha256)
  const ranged=await h.request(upload.contentUrl,{as,headers:{Range:'bytes=65530-65550'}});assert.equal(ranged.status,206)
  assert.deepEqual(Buffer.from(await ranged.arrayBuffer()),photo.subarray(65530,65551))
 }
 await h.api('/auth/operator/status',{operatorId:other.id,status:'inactive'})
 await h.api(path+'/uploads/'+upload.id,undefined,{as:other.cookie,status:401})
 // Read the raw refusal, including range requests, so a denial status cannot
 // conceal an original or a fragment of its bytes in the response body.
 for(const [label,as,status] of [['signed out','',401],['unassigned',unassigned.cookie,404],['reassigned',tech.cookie,404],['revoked',other.cookie,401]]){
  for(const range of [null,'bytes=0-63','bytes=65530-65550','bytes=-32']){
   const response=await h.request(upload.contentUrl,{as,headers:range?{Range:range}:{}}),bytes=Buffer.from(await response.arrayBuffer())
   const context=label+' '+(range??'full original')
   assert.equal(response.status,status,context);assert.match(response.headers.get('content-type'),/^application\/json\b/,context)
   assert.equal(response.headers.get('content-range'),null,context)
   assert.equal(bytes.includes(photo),false,context+' discloses no original')
   for(let offset=0;offset+16<=bytes.length;offset++)assert.equal(photo.includes(bytes.subarray(offset,offset+16)),false,context+' discloses no source fragment')
   const refusal=JSON.parse(bytes.toString('utf8'));assert.equal(refusal.error,status===401?'sign_in_required':'NOT_FOUND',context)
   assert.equal(refusal.details??null,null,context)
  }
 }
 const retained=await h.request(upload.contentUrl);assert.equal(retained.status,200);assert.equal(hash(Buffer.from(await retained.arrayBuffer())),originalInput.sha256)
 await h.api(upload.contentUrl,undefined,{as:tech.cookie,status:404})
 await h.api(upload.contentUrl,undefined,{method:'DELETE',status:405})
 const range=await h.request(upload.contentUrl,{headers:{Range:'bytes=65530-65550'}});assert.equal(range.status,206);assert.deepEqual(Buffer.from(await range.arrayBuffer()),photo.subarray(65530,65551))
 const annotation={text:'Front pad wear',strokes:[{color:'#c62828',width:.01,points:[{x:.1,y:.2},{x:.5,y:.7}]}],labels:[{text:'Wear edge',x:.1,y:.9}]}
 const sharedInput={...originalInput,clientId:randomUUID(),variant:'shared',originalId:upload.id,filename:'front-brake-shared.png',size:pixel.length,sha256:hash(pixel),annotations:annotation}
 let shared=await h.api(path+'/uploads',sharedInput)
 await h.api(path+'/uploads/'+shared.id+'/chunks/0',chunk(pixel,0),{method:'PUT'})
 shared=await h.api(path+'/uploads/'+shared.id+'/complete',{})
 assert.deepEqual(shared.annotations,annotation);assert.equal(shared.originalId,upload.id)
 const findings=(await h.api(path+'/findings?jobId='+job.id)).findings
 assert.equal(findings.length,1);assert.equal(findings[0].media.length,2);assert.ok(findings[0].media.every(m=>m.complete))
 const key=await h.command('agent.create',{label:'No media authority'})
 await h.api(path+'/findings?jobId='+job.id,undefined,{as:'',headers:{authorization:'Bearer '+key.token},status:403})
 await h.api(upload.contentUrl,undefined,{as:'',status:401})
 await h.api(upload.contentUrl,undefined,{as:'',headers:{authorization:'Bearer '+key.token},status:403})
 // The same native archive door carries finding metadata and every exact byte.
 const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'media-recovery@example.test'}})
 try{
  await restore(fresh,backup)
  assert.deepEqual((await fresh.api('/api/mallet/audit?q='+job.id)).entries.filter(e=>e.action.startsWith('media.')),(await h.api('/api/mallet/audit?q='+job.id)).entries.filter(e=>e.action.startsWith('media.')))
  assert.deepEqual((await fresh.api(path+'/findings?jobId='+job.id)).findings,findings)
  for(const m of [upload,shared]){const response=await fresh.request(m.contentUrl);assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),m.sha256)}
  await fresh.api(upload.contentUrl,undefined,{as:h.owner,status:401})
 }finally{await fresh.close()}
}))

test('DVI-002: phone/tablet markup, compression, visible interruption/resume, original/shared photo and playable video',async()=>{
 const {mediaBrowser}=await import('./media-browser.mjs');await mediaBrowser()
})

test('DVI-004 / OPS-001: compare same-asset measurements/images, imported provenance, declined carry without new tests/consent, resolution and exact restore',()=>run(async h=>{
 const tech=await h.person('history-tech@example.test'),other=await h.person('history-other@example.test')
 const {asset,job}=await booking(h,{technicianId:tech.id,startAt:'2026-09-01T09:00:00-04:00',endAt:'2026-09-01T10:00:00-04:00'})
 const base={jobId:job.id,clientId:randomUUID(),title:'Front brake pads',capturedAt:'2026-09-01T09:10:00-04:00',observation:{measurements:[{name:'Front pad thickness',value:3,unit:'mm'}],recommendation:'Replace front pads',provenance:{kind:'native'}}}
 const source=await h.api(path+'/findings',base,{as:tech.cookie})
 await h.api(path+'/findings',{...base,clientId:randomUUID(),observation:{...base.observation,measurements:[{name:'Front pad thickness',value:2,unit:''}]}},{status:400})
 const imported=await h.api(path+'/findings',{...base,clientId:randomUUID(),title:'Prior supplier inspection',capturedAt:'2026-08-01T09:00:00Z',observation:{measurements:[{name:'Front pad thickness',value:4,unit:'mm'}],recommendation:'Monitor pad wear',provenance:{kind:'imported',system:'Owner-supplied prior report',recordId:'BR-18',observer:'Pat, prior technician'}}})
 let upload=await h.api(path+'/uploads',{findingId:source.id,clientId:randomUUID(),variant:'original',filename:'prior-brake.png',mime:'image/png',size:pixel.length,sha256:hash(pixel),capturedAt:source.capturedAt})
 await h.api(path+'/uploads/'+upload.id+'/chunks/0',chunk(pixel,0),{method:'PUT'});upload=await h.api(path+'/uploads/'+upload.id+'/complete',{})
 const {estimate,authorise}=await import('./harness.mjs');let quote=await estimate(h,job);quote=await authorise(h,quote,[])
 let state=await h.state(),prior=state.records.job.find(j=>j.id===job.id)
 const reading=await h.command('reading.record',{jobId:job.id,version:prior.version,stage:'intake',value:60000,observedAt:source.capturedAt})
 const decline=await h.command('decline.record',{estimateId:quote.id,version:quote.version,lineId:quote.revisions[0].lines[0].id,readingId:reading.id,reason:'Customer defers pads',evidence:'Recorded exact full decline',dueValue:65000})
 const currentAsset=(await h.state()).records.asset.find(a=>a.id===asset.id)
 const next=(await booking(h,{asset:currentAsset,technicianId:tech.id,startAt:'2026-10-01T09:00:00-04:00',endAt:'2026-10-01T10:00:00-04:00'})).job
 const measured=await h.api(path+'/findings',{...base,jobId:next.id,clientId:randomUUID(),capturedAt:'2026-10-01T09:10:00-04:00',observation:{...base.observation,measurements:[{name:'Front pad thickness',value:2,unit:'mm'}]}},{as:tech.cookie})
 let currentUpload=await h.api(path+'/uploads',{findingId:measured.id,clientId:randomUUID(),variant:'original',filename:'current-brake.png',mime:'image/png',size:pixel.length,sha256:hash(pixel),capturedAt:measured.capturedAt})
 await h.api(path+'/uploads/'+currentUpload.id+'/chunks/0',chunk(pixel,0),{method:'PUT'});currentUpload=await h.api(path+'/uploads/'+currentUpload.id+'/complete',{})
 const input={jobId:next.id,findingId:source.id,declinedWorkId:decline.id}
 await h.api(path+'/carry',input,{as:other.cookie,status:404});await h.api(path+'/carry',input,{headers:{origin:'https://elsewhere.test'},status:403})
 const carried=await h.api(path+'/carry',{...input,capturedAt:'2026-10-01T09:10:00Z',observation:{measurements:[]}},{as:tech.cookie})
 assert.equal(carried.capturedAt,source.capturedAt);assert.equal(carried.observation,null);assert.equal(carried.carriedFrom.id,source.id);assert.equal(carried.carriedFrom.by.id,tech.id);assert.deepEqual(carried.carriedFrom.measurements,base.observation.measurements);assert.equal(carried.carriedFrom.declinedWorkId,decline.id)
 const carriedAudit=(await h.api('/api/mallet/audit?action=media.finding.carried&q='+source.id)).entries;assert.equal(carriedAudit.length,1);assert.deepEqual(carriedAudit[0].changes,[{kind:'mediaFinding',id:carried.id,beforeRevision:null,afterRevision:1}]);assert.ok(carriedAudit[0].evidence.includes('declinedWork:'+decline.id))
 assert.deepEqual(await h.api(path+'/carry',input,{as:tech.cookie}),carried)
 assert.deepEqual((await h.api('/api/mallet/audit?action=media.finding.carried&q='+source.id)).entries,carriedAudit)
 const history=await h.api(path+'/history?jobId='+next.id,undefined,{as:tech.cookie})
 assert.deepEqual(history.visits.map(v=>v.job.id),[job.id,next.id]);assert.equal(history.visits[0].findings.find(f=>f.id===source.id).media[0].id,upload.id)
 assert.equal(history.visits[0].findings.find(f=>f.id===imported.id).observation.provenance.observer,'Pat, prior technician')
 assert.equal(history.visits[1].findings.find(f=>f.id===measured.id).observation.measurements[0].value,2);assert.equal(history.visits[1].findings.find(f=>f.id===measured.id).media[0].id,currentUpload.id);assert.notEqual(currentUpload.id,upload.id);assert.notEqual(currentUpload.capturedAt,upload.capturedAt)
 assert.equal(history.visits[0].findings.find(f=>f.id===source.id).observation.measurements[0].value,3)
 assert.equal(history.visits[1].findings.filter(f=>f.carriedFrom).length,1)
 state=await h.state();assert.equal(state.records.job.find(j=>j.id===next.id).estimateId,null);assert.deepEqual(state.records.estimate.find(q=>q.id===quote.id).authorisation,quote.authorisation)
 const unrelated=(await booking(h,{asset:await h.command('asset.create',{customerName:'Someone Else',label:'Different vehicle',identifier:'OTHER-VEHICLE'}),bayId:'Bay 3',technicianId:'Someone',startAt:'2026-11-01T09:00:00Z',endAt:'2026-11-01T10:00:00Z'})).job
 await h.api(path+'/carry',{...input,jobId:unrelated.id},{status:400});await h.api(path+'/carry',{jobId:job.id,findingId:measured.id},{status:400})
 const resolution=await h.api(path+'/findings/'+source.id+'/resolve',{reason:'Pads replaced under a later separately authorized repair'},{as:tech.cookie})
 const resolvedAudit=(await h.api('/api/mallet/audit?action=media.finding.resolved&q='+source.id)).entries;assert.equal(resolvedAudit.length,1);assert.deepEqual(resolvedAudit[0].changes,[{kind:'mediaFinding',id:source.id,beforeRevision:1,afterRevision:2},{kind:'mediaResolution',id:source.id,beforeRevision:null,afterRevision:1}]);assert.deepEqual(await h.api(path+'/findings/'+source.id+'/resolve',{reason:resolution.reason},{as:tech.cookie}),resolution);assert.deepEqual((await h.api('/api/mallet/audit?action=media.finding.resolved&q='+source.id)).entries,resolvedAudit)
 assert.equal(JSON.parse(resolution.actor_json).id,tech.id);await h.api(path+'/carry',input,{status:409})
 const after=await h.api(path+'/history?jobId='+next.id)
 assert.equal(after.visits[0].findings.find(f=>f.id===source.id).resolution.reason,resolution.reason)
 const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'history-restore@example.test'}})
 try{await restore(fresh,backup);assert.deepEqual(await fresh.api(path+'/history?jobId='+next.id),after);assert.deepEqual(Buffer.from(await(await fresh.request(upload.contentUrl)).arrayBuffer()),pixel);await fresh.api(path+'/history?jobId='+next.id,undefined,{as:tech.cookie,status:401})}finally{await fresh.close()}
 await h.api('/auth/operator/status',{operatorId:tech.id,status:'inactive'});await h.api(path+'/history?jobId='+next.id,undefined,{as:tech.cookie,status:401})
}))

test('DVI-004: second-visit comparison, imported source, declined carry and resolved history on desktop and phone',async()=>{
 const {inspectionHistoryBrowser}=await import('./inspection-history-browser.mjs');await inspectionHistoryBrowser()
})

test('INTAKE-001 / INTAKE-004 / OPS-001: signed condition and custody, exact checklist comparison, private temporary secrets and fresh-owner recovery',()=>run(async h=>{const {intakeJourney}=await import('./support/intake-journey.mjs');await intakeJourney(h)}))

test('INTAKE-001: vehicle and device signed custody and actual checklist comparison at 1440/390',async()=>{const {intakeBrowser}=await import('./intake-browser.mjs');await intakeBrowser()})

test('INTAKE-002 / OPS-001: two templates, retained required-field draft, original signed terms and exact delivered copy with recovery',()=>run(async h=>{const {intakeFormsJourney}=await import('./support/intake-forms-journey.mjs');await intakeFormsJourney(h)}))

test('INTAKE-002: publish two templates, retain phone draft and retrieve original signed copy after terms change at 1440/390',async()=>{const {intakeFormsBrowser}=await import('./intake-forms-browser.mjs');await intakeFormsBrowser()})


test('INTAKE-003 / OPS-001: private after-hours request, exact diagnostic consent, advisor-confirmed match, duplicate refusal and recovery',()=>run(async h=>{const {checkInRecoveryJourney}=await import('./support/check-in-journey.mjs');await checkInRecoveryJourney(h)}))

test('INTAKE-003: after-hours customer request, counter match and diagnostic-only booking at 1440/390',async()=>{const {checkInBrowser}=await import('./check-in-browser.mjs');await checkInBrowser()})
