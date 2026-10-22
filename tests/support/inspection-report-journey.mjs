import assert from 'node:assert/strict'
import {createHash,randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {archive,booking,estimate,installation,restore} from '../harness.mjs'
import {shopSetup,coilDiagnosis} from './diagnosis-journey.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'
export async function reportUpload(h,finding,bytes,mime,variant='original',originalId=null){
 const sha256=createHash('sha256').update(bytes).digest('hex')
 let media=await h.api('/api/mallet/media/uploads',{findingId:finding.id,clientId:randomUUID(),variant,originalId,filename:'synthetic-mallet-'+(mime.startsWith('video')?'1.webm':'2.png'),mime,size:bytes.length,sha256,capturedAt:finding.capturedAt})
 for(let offset=0,ordinal=0;offset<bytes.length;offset+=65536,ordinal++){const chunk=bytes.subarray(offset,offset+65536);await h.api('/api/mallet/media/uploads/'+media.id+'/chunks/'+ordinal,{sha256:createHash('sha256').update(chunk).digest('hex'),base64:chunk.toString('base64')},{method:'PUT'})}
 return h.api('/api/mallet/media/uploads/'+media.id+'/complete',{})
}
export async function prepareReport(h){
 await shopSetup(h);const {job,asset}=await booking(h),photo=await inspectionPhoto(h,job.id,h.owner),pixels=Buffer.from(await (await h.request(photo.contentUrl)).arrayBuffer())
 const sharedPhoto=await reportUpload(h,{id:photo.findingId,capturedAt:photo.capturedAt},pixels,'image/png','shared',photo.id)
 const vf=await h.api('/api/mallet/media/findings',{jobId:job.id,clientId:randomUUID(),title:'synthetic-mallet-3 video evidence',capturedAt:'2026-10-22T09:00:00Z'}),bytes=await readFile('tests/fixtures/dvi/synthetic-inspection.webm')
 const originalVideo=await reportUpload(h,vf,bytes,'video/webm'),sharedVideo=await reportUpload(h,vf,bytes,'video/webm','shared',originalVideo.id)
 const template=await h.command('inspectionTemplate.save',{version:0,name:'synthetic-mallet-4 brake check',vehicle:'Passenger vehicle',service:'Brakes',reason:'synthetic-mallet-5',items:[{id:'front-pads',label:'Front brake pads',measurement:{name:'Pad thickness',unit:'mm'}}]})
 let inspection=await h.command('inspection.assign',{jobId:job.id,version:job.version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:(await h.state()).actor.id,reason:'synthetic-mallet-6'})
 inspection=await h.command('inspection.record',{jobId:job.id,version:job.version,inspectionId:inspection.id,inspectionVersion:inspection.version,itemId:'front-pads',outcome:'red',measurementValue:2.5,measurementUnit:'mm',photoUploadId:photo.id,reason:'Measured pad thickness below shop replacement criterion'})
 let q=await estimate(h,job);q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
 const current=(await h.state()).records.job.find(x=>x.id===job.id)
 await h.command('diagnosis.record',{jobId:job.id,version:current.version,...coilDiagnosis})
 const entry={inspectionId:inspection.id,inspectionVersion:inspection.version,resultId:inspection.results[0].id,estimateId:q.id,estimateVersion:q.version,revision:1,lineIds:[q.revisions[0].lines[0].id],mediaIds:[sharedPhoto.id,sharedVideo.id],explanation:'The front pads measured 2.5 mm. Your advisor recommends the linked pad replacement. Please contact the shop before approving any work.'}
 return {job:current,asset,inspection,quote:q,photo,sharedPhoto,originalVideo,sharedVideo,bytes,entry,input:{jobId:job.id,version:current.version,title:'Your brake inspection',entries:[entry]}}
}
export async function inspectionReportJourney(h){
 const ready=await prepareReport(h),{job,entry,input,photo,sharedPhoto,originalVideo,sharedVideo,bytes}=ready
 const member=await h.person('synthetic-mallet-7@example.test'),agent=await h.command('agent.create',{label:'synthetic-mallet-8'}),bearer={as:'',headers:{authorization:'Bearer '+agent.token}}
 for(const as of [member.cookie])await h.command('inspectionReport.review',input,{as,status:403})
 await h.command('inspectionReport.review',input,{...bearer,status:403})
 await h.command('inspectionReport.review',{...input,entries:[{...entry,mediaIds:[photo.id]}]},{status:400})
 await h.command('inspectionReport.review',{...input,entries:[{...entry,lineIds:['synthetic-mallet-9']}]},{status:400})
 await h.command('inspectionReport.review',{...input,entries:[{...entry,inspectionVersion:1}]},{status:409})
 const report=await h.command('inspectionReport.review',{...input,entries:[{...entry,media:[{id:photo.id,mime:'image/png'}]}]})
 assert.deepEqual(report.entries[0].media.map(m=>m.id),entry.mediaIds,'Client-supplied original snapshots are ignored')
 const send={reportId:report.id,operationId:randomUUID(),to:'synthetic-mallet-10@example.test',consentEvidence:'Customer requested this report by email at the counter.',consent:true,days:7}
 await h.command('inspectionReport.send',{...send,consent:false},{status:422})
 await h.command('inspectionReport.send',send,{as:member.cookie,status:403});await h.command('inspectionReport.claim',send,{status:404})
 const delivery=await h.command('inspectionReport.send',send),path=new URL(delivery.url).pathname
 assert.equal(delivery.status,'accepted');assert.equal(h.messages.filter(m=>m.subject==='Your reviewed inspection report').length,1);assert.ok(h.messages.at(-1).text.includes(delivery.url));assert.ok(h.messages.at(-1).html.includes('href="'+delivery.url+'"'),'HTML email has a usable private report link')
 await h.command('inspectionReport.send',send,{status:409});assert.equal(h.messages.filter(m=>m.subject==='Your reviewed inspection report').length,1,'One durable claim prevents a replayed outbound send')
 assert.equal((await h.request(path,{as:'',headers:{host:'other.test'}})).status,404,'Customer report enforces the configured host')
 const before=await h.state(),response=await h.request(path,{as:''}),html=await response.text();assert.equal(response.status,200)
 for(const shown of ['Front brake pads','Urgency: red','Pad thickness: 2.5 mm',entry.explanation,'does not approve or decline'])assert.ok(html.includes(shown),'Report shows '+shown)
 for(const hidden of [coilDiagnosis.staffNote,'38.12',photo.id,originalVideo.id,'cedar@example.test','Cedar Bikes','costCents','originalId','Morgan Workshop'])assert.ok(!html.includes(hidden),'Report hides '+hidden)
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('content-security-policy'),/media-src 'self'/)
 const media=await h.request(path+'/media/'+sharedVideo.id,{as:'',headers:{range:'bytes=0-99'}});assert.equal(media.status,206);assert.deepEqual(Buffer.from(await media.arrayBuffer()),bytes.subarray(0,100))
 const all=await h.request(path+'/media/'+sharedVideo.id,{as:''});assert.deepEqual(Buffer.from(await all.arrayBuffer()),bytes)
 const image=await h.request(path+'/media/'+sharedPhoto.id,{as:''});assert.equal(image.status,200);assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),sharedPhoto.sha256)
 for(const id of [photo.id,originalVideo.id,randomUUID()])assert.equal((await h.request(path+'/media/'+id,{as:''})).status,404)
 assert.equal((await h.request(path+'/media/'+sharedVideo.id,{as:'',method:'POST',body:{}})).status,405)
 const proposal=await h.request(path+'/proposal/'+report.entries[0].id,{as:''}),proposed=await proposal.text();assert.equal(proposal.status,200);assert.ok(proposed.includes(entry.lineIds[0])===false);assert.ok(proposed.includes(ready.quote.revisions[0].lines[0].description));assert.ok(!proposed.includes(ready.quote.revisions[0].lines[1].description));assert.ok(!proposed.includes('costCents'))
 const after=await h.state();for(const kind of ['estimate','approval','job','inspection'])assert.deepEqual(after.records[kind],before.records[kind],'Viewing changes no '+kind)
 assert.equal(after.records.diagnosisLinkView.filter(v=>v.reportId===report.id).length,1)
 assert.equal((await h.state(bearer)).records.inspectionReport,undefined);assert.equal((await h.state(bearer)).records.inspectionReportDelivery,undefined);assert.equal((await h.state({as:member.cookie})).records.inspectionReport,undefined)
 let q=ready.quote;q=await h.command('estimate.revise',{estimateId:q.id,version:q.version,revision:1,lines:[{kind:'part',description:'A later draft not shared',quantity:1,unitCents:9999}]})
 assert.ok((await (await h.request(path+'/proposal/'+report.entries[0].id,{as:''})).text()).includes('Historical proposal'))
 assert.deepEqual((await h.state()).records.inspectionReport.find(r=>r.id===report.id),report)
 const backup=await archive(h),saved=await h.state(),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-11@example.test'}})
 try{await restore(fresh,backup);const recovered=await fresh.state();for(const kind of ['inspectionReport','inspectionReportDelivery','diagnosisLink','diagnosisLinkView'])assert.deepEqual(recovered.records[kind],saved.records[kind]);assert.equal((await fresh.request(path,{as:''})).status,404);const original=await fresh.request('/api/mallet/media/uploads/'+originalVideo.id+'/content');assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes)}finally{await fresh.close()}
 const link=(await h.state()).records.diagnosisLink.find(l=>l.id===delivery.linkId);await h.command('diagnosisLink.revoke',{linkId:link.id,version:link.version})
 const revoked=await h.request(path,{as:''}),unknown=await h.request('/inspection/'+'A'.repeat(43),{as:''});assert.equal(revoked.status,404);assert.equal(await revoked.text(),await unknown.text());assert.equal((await h.request(path+'/media/'+sharedVideo.id,{as:''})).status,404)
 return ready
}

export async function inspectionReportFailureJourney(){
 let providerStatus=422,calls=0
 const h=await installation({outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.sendgrid.com');calls++;return new Response(null,{status:providerStatus})}})
 try{
  const {input}=await prepareReport(h),report=await h.command('inspectionReport.review',input);await h.configure({MAIL_PROVIDER:'sendgrid'})
  for(const [status,expected]of [[422,'failed'],[503,'uncertain']]){
   providerStatus=status;const before=calls,send={reportId:report.id,operationId:randomUUID(),to:'synthetic-mallet-12@example.test',consentEvidence:'Customer explicitly requested this reviewed email.',consent:true}
   const outcome=await h.command('inspectionReport.send',send);assert.equal(outcome.status,expected);assert.equal(calls,before+1)
   await h.command('inspectionReport.send',send,{status:409});assert.equal(calls,before+1,'A provider failure has one send attempt and no automatic replay')
   assert.ok(!(await (await h.request('/app/jobs/'+input.jobId)).text()).includes('Handed to the mail provider; delivery not confirmed'))
  }
 }finally{await h.close()}
}
