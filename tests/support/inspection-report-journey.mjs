import assert from 'node:assert/strict'
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {archive,assetInput,booking,installation,restore} from '../harness.mjs'
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
 let q=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Brake pads',quantity:2,unitCents:2500,unitDiscountCents:500,costCents:1000},{kind:'labor',description:'Replace and tune',quantity:1.5,unitCents:12000}]});q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
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
 await reportDeliveryEvents(h,delivery,send)
 assert.equal((await h.mf.dispatchFetch('https://other.test'+path)).status,404,'Customer report enforces the configured host')
 const before=await h.state(),response=await h.request(path,{as:''}),html=await response.text();assert.equal(response.status,200)
 for(const shown of ['Front brake pads','Urgency: red','Pad thickness: 2.5 mm',entry.explanation,'does not approve or decline'])assert.ok(html.includes(shown),'Report shows '+shown)
 for(const hidden of [coilDiagnosis.staffNote,'38.12',photo.id,originalVideo.id,'cedar@example.test','Cedar Bikes','costCents','originalId','Morgan Workshop'])assert.ok(!html.includes(hidden),'Report hides '+hidden)
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.match(response.headers.get('content-security-policy'),/media-src 'self'/)
 const grant=await h.request(path+'/media/'+sharedVideo.id,{as:''});assert.equal(grant.status,303);const bytePath=grant.headers.get('location');assert.ok(Number(new URL(bytePath,h.origin).searchParams.get('until'))<=Date.now()+5*60*1000);assert.equal((await h.request(bytePath.replace(/proof=[^&]+/,'proof='+'A'.repeat(43)),{as:''})).status,404);assert.equal((await h.request(bytePath.replace(/until=[0-9]+/,'until=1'),{as:''})).status,404);
 const media=await h.request(bytePath,{as:'',headers:{range:'bytes=0-99'}});assert.equal(media.status,206);assert.deepEqual(Buffer.from(await media.arrayBuffer()),bytes.subarray(0,100))
 const all=await h.request(bytePath,{as:''});assert.deepEqual(Buffer.from(await all.arrayBuffer()),bytes)
 const imageGrant=await h.request(path+'/media/'+sharedPhoto.id,{as:''});assert.equal(imageGrant.status,303);const image=await h.request(imageGrant.headers.get('location'),{as:''});assert.equal(image.status,200);assert.equal(createHash('sha256').update(Buffer.from(await image.arrayBuffer())).digest('hex'),sharedPhoto.sha256)
 for(const id of [photo.id,originalVideo.id,randomUUID()])assert.equal((await h.request(path+'/media/'+id,{as:''})).status,404)
 assert.equal((await h.request(path+'/media/'+sharedVideo.id,{as:'',method:'POST',body:{}})).status,405)
 const proposal=await h.request(path+'/proposal/'+report.entries[0].id,{as:''}),proposed=await proposal.text();assert.equal(proposal.status,200);assert.ok(proposed.includes(entry.lineIds[0])===false);assert.ok(proposed.includes(ready.quote.revisions[0].lines[0].description));assert.ok(!proposed.includes(ready.quote.revisions[0].lines[1].description));assert.ok(!proposed.includes('costCents'));assert.equal(report.entries[0].proposal.lines[0].unitDiscountCents,500);assert.equal(report.entries[0].proposal.lines[0].totalCents,4300);assert.ok(proposed.includes('per-unit discount $5.00'));assert.ok(proposed.includes('line total $43.00'))
 const after=await h.state();for(const kind of ['estimate','approval','job','inspection'])assert.deepEqual(after.records[kind],before.records[kind],'Viewing changes no '+kind)
 await h.request(path,{as:''})
 const query='?from='+ready.job.createdAt.slice(0,10)+'&to='+ready.job.createdAt.slice(0,10)
 const outcomes=await h.api('/api/mallet/reports/turnaround'+query)
 assert.equal(outcomes.metrics.inspections,1);assert.equal(outcomes.metrics.inspectionsComplete,1);assert.equal(outcomes.metrics.dviCompletionRateTenths,1000)
 assert.equal(outcomes.metrics.reviewedReports,1);assert.equal(outcomes.metrics.reportsViewed,1);assert.equal(outcomes.metrics.viewRequests,2);assert.equal(outcomes.metrics.engagementRateTenths,1000,'Repeated requests do not inflate the engaged-report count')
 assert.equal(outcomes.repairs.find(r=>r.jobId===ready.job.id).dvi.reports[0].id,report.id)
 const views=after.records.diagnosisLinkView.filter(v=>v.reportId===report.id);assert.equal(views.length,1);assert.ok(Number.isFinite(Date.parse(views[0].at)),'Report view has a durable timestamp')
 assert.equal((await h.state(bearer)).records.inspectionReport,undefined);assert.equal((await h.state(bearer)).records.inspectionReportDelivery,undefined);assert.equal((await h.state({as:member.cookie})).records.inspectionReport,undefined)
 let q=ready.quote;q=await h.command('estimate.revise',{estimateId:q.id,version:q.version,revision:1,lines:[{kind:'part',description:'A later draft not shared',quantity:1,unitCents:9999}]})
 assert.ok((await (await h.request(path+'/proposal/'+report.entries[0].id,{as:''})).text()).includes('Historical proposal'))
 assert.deepEqual((await h.state()).records.inspectionReport.find(r=>r.id===report.id),report)
 const backup=await archive(h),saved=await h.state(),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-11@example.test'}})
 try{await restore(fresh,backup);const recovered=await fresh.state();for(const kind of ['inspectionReport','inspectionReportDelivery','diagnosisLink','diagnosisLinkView'])assert.deepEqual(recovered.records[kind],saved.records[kind]);assert.equal((await fresh.request(path,{as:''})).status,404);const original=await fresh.request('/api/mallet/media/uploads/'+originalVideo.id+'/content');assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes);const sourceDb=await h.mf.getD1Database('DB'),targetDb=await fresh.mf.getD1Database('DB');for(const table of ['rer_mail_event_receipts','rer_mail_event_states'])assert.deepEqual((await targetDb.prepare('SELECT * FROM '+table+' ORDER BY '+(table==='rer_mail_event_receipts'?'provider,tenant_id,event_namespace,event_id':'provider,tenant_id,event_namespace,provider_message_id,recipient')).all()).results,(await sourceDb.prepare('SELECT * FROM '+table+' ORDER BY '+(table==='rer_mail_event_receipts'?'provider,tenant_id,event_namespace,event_id':'provider,tenant_id,event_namespace,provider_message_id,recipient')).all()).results,'Durable downstream '+table+' survives recovery')}finally{await fresh.close()}
 // GOV-005 / GOV-008: another customer's private media is not reachable through this customer's link.
 const stranger=await booking(h,{asset:await h.command('asset.create',assetInput('GOV5-OTHER')),startAt:'2026-10-26T09:00:00Z',endAt:'2026-10-26T10:00:00Z'}),strangerPhoto=await inspectionPhoto(h,stranger.job.id,h.owner,'Other customer pads')
 assert.equal((await h.request(path+'/media/'+strangerPhoto.id,{as:''})).status,404,'GOV-005 another customer media is not served through this link')
 const link=(await h.state()).records.diagnosisLink.find(l=>l.id===delivery.linkId);await h.command('diagnosisLink.revoke',{linkId:link.id,version:link.version})
 const revoked=await h.request(path,{as:''}),unknown=await h.request('/inspection/'+'A'.repeat(43),{as:''});assert.equal(revoked.status,404);assert.equal(await revoked.text(),await unknown.text());assert.equal((await h.request(path+'/media/'+sharedVideo.id,{as:''})).status,404);assert.equal((await h.request(bytePath,{as:''})).status,404)
 return ready
}

export async function reportDeliveryEvents(h,delivery,send){
 const endpoint='/api/mallet/inspection-report-events/resend',secret=randomBytes(32),before=await h.state(),mailCount=h.messages.length
 assert.ok(delivery.providerMessageId,'Submission retains its real provider message id')
 assert.equal((await h.request(endpoint,{method:'POST',as:'',body:{}})).status,503,'Unconfigured verification fails closed')
 await h.configure({MAIL_EVENT_KEY:['whsec',secret.toString('base64')].join('_')})
 const at=Date.now()-10000
 const event=(type,time=at)=>({type:'email.'+type,created_at:new Date(time).toISOString(),data:{email_id:delivery.providerMessageId,to:[send.to]}})
 const post=async(body,{id=randomUUID(),signature=true,status=204,timestamp=String(Math.floor(Date.now()/1000))}={})=>{
  const bytes=JSON.stringify(body),mac=createHmac('sha256',secret).update(id+'.'+timestamp+'.'+bytes).digest('base64')
  const response=await h.request(endpoint,{method:'POST',as:'',body,headers:{'svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+(signature?mac:Buffer.alloc(32).toString('base64'))}})
  assert.equal(response.status,status);return id
 }
 const snapshot=async()=>(await h.state()).records.inspectionReportDelivery.find(d=>d.id===delivery.id)
 await post(event('delivered'),{signature:false,status:401})
 await post(event('delivered'),{timestamp:'1',status:401})
 await post({...event('delivered'),data:{email_id:delivery.providerMessageId,to:['synthetic-mallet-13@example.test']}},{status:400})
 await post({...event('delivered'),data:{email_id:'synthetic-mallet-14',to:[send.to]}},{status:400})
 assert.equal((await snapshot()).downstream,undefined,'Invalid signatures and foreign recipient/message make no delivery claim')
 const deferred=event('delivery_delayed'),id=await post(deferred)
 assert.equal((await snapshot()).downstream.status,'deferred')
 const first=await snapshot();await post(deferred,{id});assert.deepEqual(await snapshot(),first,'Duplicate provider event changes no receipt projection')
 await post(event('delivered',at+1000),{id,status:400});assert.deepEqual(await snapshot(),first,'Conflicting reused event id is refused')
 await post(event('delivered',at+2000));const delivered=await snapshot();assert.equal(delivered.status,'accepted');assert.equal(delivered.downstream.status,'delivered');assert.equal(delivered.downstream.at,new Date(at+2000).toISOString())
 await post(event('delivery_delayed',at+1000));assert.deepEqual(await snapshot(),delivered,'Older deferred event cannot regress confirmed delivery')
 await post(event('opened',at+3000));assert.deepEqual(await snapshot(),delivered,'An email open changes neither delivery nor approval')
 const bounceSend={...send,operationId:randomUUID()},bounce=await h.command('inspectionReport.send',bounceSend)
 await post({...event('bounced',at+4000),data:{email_id:bounce.providerMessageId,to:[send.to]}})
 assert.equal((await h.state()).records.inspectionReportDelivery.find(d=>d.id===bounce.id).downstream.status,'bounced')
 assert.equal(h.messages.length,mailCount+1,'Only the explicitly requested second send made an outbound call; webhook events never send')
 const staff=await (await h.request('/app/jobs/'+delivery.jobId)).text();assert.match(staff,/Provider confirmed delivery/);assert.match(staff,/Email bounced/)
 const after=await h.state();for(const kind of ['estimate','approval','job','inspection'])assert.deepEqual(after.records[kind],before.records[kind],'Downstream events change no '+kind)
 const oversized=await h.request(endpoint,{method:'POST',as:'',body:{value:'x'.repeat(1024*1024)}});assert.equal(oversized.status,413)
 assert.equal((await h.request('/api/mallet/inspection-report-events/sendgrid',{method:'POST',as:'',body:{}})).status,404,'An unconfigured provider cannot submit receipts')
}

export async function inspectionReportFailureJourney(){
 let providerStatus=422,calls=0
 const h=await installation({outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.sendgrid.com');calls++;return new Response(null,{status:providerStatus})}})
 try{
  const {input}=await prepareReport(h),report=await h.command('inspectionReport.review',input);await h.configure({MAIL_PROVIDER:'sendgrid'})
  for(const [status,expected]of [[422,'failed'],[429,'rate_limited'],[503,'uncertain']]){
   providerStatus=status;const before=calls,send={reportId:report.id,operationId:randomUUID(),to:'synthetic-mallet-12@example.test',consentEvidence:'Customer explicitly requested this reviewed email.',consent:true}
   const outcome=await h.command('inspectionReport.send',send);assert.equal(outcome.status,expected);assert.equal(calls,before+1)
   await h.command('inspectionReport.send',send,{status:409});assert.equal(calls,before+1,'A provider failure has one send attempt and no automatic replay')
   assert.ok(!(await (await h.request('/app/jobs/'+input.jobId)).text()).includes('Handed to the mail provider; delivery not confirmed'))
  }
 }finally{await h.close()}
}

export async function inspectionReportDevelopmentJourney(){
 const h=await installation({bindings:{AUTH_LOCAL:'true'}})
 try{const {input}=await prepareReport(h),report=await h.command('inspectionReport.review',input),count=h.messages.length,send={reportId:report.id,operationId:randomUUID(),to:'synthetic-mallet-24@example.test',consentEvidence:'Customer requested this report by email.',consent:true}
 const receipt=await h.command('inspectionReport.send',send);assert.equal(receipt.status,'development');assert.equal(receipt.providerMessageId,null);assert.equal(h.messages.length,count,'Suppression never contacts a mail provider');await h.command('inspectionReport.send',send,{status:409})
 }finally{await h.close()}
}
