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

test('DVI-002 / OPS-001: private original/shared custody, interrupted upload, exact replay, assignment/revocation and full archive recovery',()=>run(async h=>{
 const tech=await h.person('brake-tech@example.test'),other=await h.person('other-tech@example.test')
 let {job}=await booking(h,{technicianId:tech.id})
 const started=Date.now(),input={jobId:job.id,clientId:randomUUID(),title:'Front brake pad wear',capturedAt:'2026-10-01T09:15:00-04:00'}
 await h.api(path+'/findings',input,{as:'',status:401})
 await h.api(path+'/findings',input,{as:other.cookie,status:404})
 await h.api(path+'/findings',input,{headers:{origin:'https://elsewhere.test'},status:403})
 await h.api(path+'/findings',{...input,capturedAt:'2026-02-31T09:15:00Z'},{status:400})
 const finding=await h.api(path+'/findings',input,{as:tech.cookie})
 assert.equal(finding.by.id,tech.id);assert.equal(finding.capturedAt,'2026-10-01T13:15:00.000Z');assert.ok(Date.parse(finding.createdAt)>=started)
 assert.deepEqual(await h.api(path+'/findings',input,{as:tech.cookie}),finding)
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
 await h.api('/auth/operator/status',{operatorId:other.id,status:'inactive'})
 await h.api(path+'/uploads/'+upload.id,undefined,{as:other.cookie,status:401})
 // Explicit resume reads stored progress; only unconfirmed chunks are submitted.
 upload=await h.api(path+'/uploads',originalInput)
 assert.deepEqual(upload.received,[0])
 for(let i=1;i<Math.ceil(photo.length/65536);i++)await h.api(path+'/uploads/'+upload.id+'/chunks/'+i,chunk(photo,i),{method:'PUT'})
 upload=await h.api(path+'/uploads/'+upload.id+'/complete',{})
 assert.equal(upload.complete,true);assert.equal(upload.sha256,hash(photo));assert.equal(upload.by.id,tech.id);assert.equal(upload.capturedAt,finding.capturedAt);assert.ok(Date.parse(upload.receivedAt)>=started)
 const duplicate=await h.api(path+'/uploads',{...originalInput,clientId:randomUUID()});assert.equal(duplicate.id,upload.id)
 await h.api(path+'/uploads',{...originalInput,filename:'changed.png'},{status:409})
 assert.deepEqual(await h.api(path+'/uploads/'+upload.id+'/complete',{}),upload)
 assert.deepEqual(Buffer.from(await (await h.request(upload.contentUrl)).arrayBuffer()),photo)
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
  assert.deepEqual((await fresh.api(path+'/findings?jobId='+job.id)).findings,findings)
  for(const m of [upload,shared]){const response=await fresh.request(m.contentUrl);assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),m.sha256)}
  await fresh.api(upload.contentUrl,undefined,{as:h.owner,status:401})
 }finally{await fresh.close()}
}))

test('DVI-002: phone/tablet markup, compression, visible interruption/resume, original/shared photo and playable video',async()=>{
 const {mediaBrowser}=await import('./media-browser.mjs');await mediaBrowser()
})
