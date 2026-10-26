import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {readyInvoice} from './return-journey.mjs'
import {handoverInput} from './handover-input.mjs'

export const reviewUrl='https://g.page/r/synthetic-mallet-920/review'
export const permissionFields=job=>({jobId:job.id,to:job.asset.customerEmail,consent:true,wordingVersion:'review-email-v1',consentedAt:new Date(Date.now()-1000).toISOString(),captureChannel:'in-person',sourceEvidence:'Customer requested this one review email at the counter, synthetic-mallet-921'})
export async function reviewFixture(h,{paid=true,free=false}={}){
 await shopSetup(h)
 const {job,invoice}=await readyInvoice(h,{free})
 const input=await handoverInput(h,job.id,job.asset.customerName)
 if(paid&&!free){
  await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,invoiceRevision:invoice.revision,method:'cash',amountCents:invoice.totals.totalCents,reference:'synthetic-mallet-922',evidence:'Staff counted the cash for this exact invoice'})
  delete input.overrideId
 }
 if(free)delete input.overrideId
 await h.command('flow.collect',input)
 return {job:(await h.state()).records.job.find(j=>j.id===job.id),invoice}
}
export const sendReview=(h,consent,extra={})=>h.command('review.send',{jobId:consent.jobId,consentId:consent.id,version:consent.version,reviewUrl,confirm:true,...extra})
export function privatePath(h){return new URL(h.messages.findLast(m=>m.subject==='Your repair visit: review and private feedback').text.match(/Private satisfaction page: (https?:[^\s]+)/)[1]).pathname}
export const reviewPost=(h,path,data,headers={})=>{
 // Native form transport, through the same Worker HTTP door as the customer page.
 return h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(data).toString()})
}

export async function reviewDeliveryJourney(){
 const h=await installation({mailService:async()=>Response.json({id:'synthetic-mallet-924'})})
 try{
  const {job}=await reviewFixture(h),fields=permissionFields(job),admin=await h.person('synthetic-mallet-925@example.test','admin'),key=await h.command('agent.create',{label:'Review isolation'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
  for(const opts of [{as:'',status:401},{as:admin.cookie,status:403},{...agent,status:403},{headers:{origin:'https://other.test'},status:403}])await h.command('review.consent',fields,opts)
  await h.command('review.consent',{...fields,consent:false},{status:422})
  await h.command('review.consent',{...fields,to:'different@example.test'},{status:400})
  await h.command('review.consent',{...fields,consentedAt:'2026-01-01T10:00:00'},{status:400})
  const consent=await h.command('review.consent',fields),count=h.messages.length
  const permissionArchive=await archive(h),pendingDestination=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-932@example.test'}})
  try{await restore(pendingDestination,permissionArchive);await pendingDestination.command('review.send',{jobId:job.id,consentId:consent.id,version:consent.version,reviewUrl,confirm:true},{status:409});assert.equal(pendingDestination.messages.filter(m=>m.subject==='Your repair visit: review and private feedback').length,0);assert.equal((await pendingDestination.state()).records.reviewRequest?.length??0,0)}finally{await pendingDestination.close()}
  await h.command('review.send',{jobId:job.id,consentId:consent.id,version:consent.version,reviewUrl:'https://untrusted.example.test/review',confirm:true},{status:400})
  await h.command('review.send',{jobId:job.id,consentId:consent.id,version:consent.version,reviewUrl,confirm:false},{status:422})
  await h.command('review.respond',{id:'synthetic-mallet-926',rating:1},{status:404})
  const [a,b]=await Promise.all([h.request('/api/mallet/commands',{method:'POST',body:{command:'review.send',input:{jobId:job.id,consentId:consent.id,version:consent.version,reviewUrl,confirm:true}}}),h.request('/api/mallet/commands',{method:'POST',body:{command:'review.send',input:{jobId:job.id,consentId:consent.id,version:consent.version,reviewUrl,confirm:true}}})])
  assert.deepEqual([a.status,b.status].sort(),[200,409]);await a.body?.cancel();await b.body?.cancel()
  assert.equal(h.messages.length,count+1,'Concurrent approval handoffs send one email')
  const request=(await h.state()).records.reviewRequest[0],message=h.messages.at(-1),path=privatePath(h)
  assert.equal(request.status,'accepted');assert.equal(request.providerReference,'synthetic-mallet-924');assert.equal(request.by.id,consent.by.id);assert.equal(request.consentId,consent.id);assert.ok(request.content.includes(reviewUrl));assert.ok(message.text.includes(reviewUrl));assert.ok(!request.content.includes(path),'Capability is excluded from product records')
  await h.restart();await h.cron(new Date().toISOString());await h.command('review.send',{jobId:job.id,consentId:consent.id,version:consent.version,reviewUrl,confirm:true},{status:409});assert.equal(h.messages.length,count+1)
  const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-927@example.test'}})
  try{
   await restore(fresh,backup);const state=await fresh.state();assert.deepEqual(state.records.reviewRequest,(await h.state()).records.reviewRequest);assert.deepEqual(state.records.reviewConsent,(await h.state()).records.reviewConsent)
   assert.equal((await fresh.request(path,{as:''})).status,404);await fresh.command('review.send',{jobId:job.id,consentId:consent.id,version:consent.version,reviewUrl,confirm:true},{status:409});assert.equal(fresh.messages.filter(m=>m.subject==='Your repair visit: review and private feedback').length,0)
  }finally{await fresh.close()}
  const scoped=await h.state({as:admin.cookie});assert.equal(scoped.records.reviewRequest,undefined);assert.equal(scoped.records.reviewConsent,undefined);assert.ok(!scoped.records.event.some(e=>e.kind.startsWith('review.')))
  assert.equal((await h.request('/app/jobs/'+job.id+'/reviews',{as:admin.cookie})).status,403)
  const resolvedConsent=await h.command('review.withdraw',{jobId:job.id,consentId:consent.id,version:consent.version,reason:'Customer withdrew permission'})
  await h.command('review.consent',fields,{status:409});assert.ok(resolvedConsent.withdrawnAt)
  // Another collected repair proves a provider refusal stays visible and has no resend door.
  const failed=await installation({mailService:async message=>message.subject==='Your repair visit: review and private feedback'?Response.json({error:'synthetic-mallet-928'},{status:422}):Response.json({id:crypto.randomUUID()})})
  try{const {job}=await reviewFixture(failed),c=await failed.command('review.consent',permissionFields(job)),row=await sendReview(failed,c);assert.equal(row.status,'failed');const n=failed.messages.length;await failed.command('review.send',{jobId:job.id,consentId:c.id,version:c.version,reviewUrl,confirm:true},{status:409});await failed.command('review.resolve',{id:row.id,version:row.version,reason:'Owner called customer; no resend'});await failed.restart();await failed.cron(new Date().toISOString());assert.equal(failed.messages.length,n)}finally{await failed.close()}
  for(const options of [{paid:false},{free:true}]){const ineligible=await installation();try{const {job}=await reviewFixture(ineligible,options);await ineligible.command('review.consent',permissionFields(job),{status:409})}finally{await ineligible.close()}}
 }finally{await h.close()}
}

export async function reviewFeedbackJourney(){
 const h=await installation()
 try{
  const {job}=await reviewFixture(h),consent=await h.command('review.consent',permissionFields(job)),request=await sendReview(h,consent),path=privatePath(h)
  const before=await h.request(path,{as:''});assert.equal(before.status,200);const html=await before.text();assert.ok(html.includes(reviewUrl));assert.ok(!html.includes(job.asset.customerEmail))
  assert.equal((await reviewPost(h,path,{action:'respond',rating:'1',feedback:'The repair took too long. Please call me.'},{origin:'https://other.test'})).status,403)
  assert.equal((await reviewPost(h,path,{action:'respond',rating:'6'})).status,400)
  assert.equal((await reviewPost(h,path,{action:'respond',rating:'1',feedback:'The repair took too long. Please call me.'})).status,303)
  const response=(await h.state()).records.reviewRequest.find(r=>r.id===request.id),task=(await h.state()).records.subtask.find(t=>t.id===response.taskId)
  assert.equal(response.response.rating,1);assert.equal(task.kind,'review-feedback');assert.equal(task.assigneeId,(await h.state()).actor.id);assert.equal(task.jobId,job.id);assert.equal(task.completedAt,null)
  const after=await (await h.request(path,{as:''})).text();assert.ok(after.includes('href="'+reviewUrl+'"'));assert.ok(!after.includes('The repair took too long'));assert.ok(after.includes('response was saved'))
  await reviewPost(h,path,{action:'respond',rating:'5',feedback:'Changed'});assert.deepEqual((await h.state()).records.reviewRequest.find(r=>r.id===request.id).response,response.response);assert.equal((await h.state()).records.subtask.length,1)
  assert.ok((await (await h.request('/app/jobs')).text()).includes('/app/jobs/'+job.id+'/reviews'))
  const member=await h.person('synthetic-mallet-929@example.test');await h.command('subtask.complete',{subtaskId:task.id,version:task.version},{as:member.cookie,status:403})
  assert.equal((await h.state({as:member.cookie})).records.subtask.some(t=>t.id===task.id),false)
  const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-930@example.test'}})
  try{await restore(fresh,backup);assert.deepEqual((await fresh.state()).records.reviewRequest,(await h.state()).records.reviewRequest);assert.deepEqual((await fresh.state()).records.subtask,(await h.state()).records.subtask);assert.equal((await fresh.request(path,{as:''})).status,404);await shopSetup(fresh);assert.ok((await(await fresh.request('/app/jobs')).text()).includes('/app/jobs/'+job.id+'/reviews'));await fresh.command('subtask.complete',{subtaskId:task.id,version:task.version});assert.equal((await fresh.state()).records.subtask[0].completedBy.id,(await fresh.state()).actor.id)}finally{await fresh.close()}
  const contact=await h.command('contact.save',{name:job.asset.customerName,email:job.asset.customerEmail,phone:'',communication:'none',notes:''}),account=await h.command('customer.save',{name:job.asset.customerName,kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''}),asset=(await h.state()).records.asset.find(a=>a.id===job.assetId)
  await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Owner checked the customer identity'})
  const preview=await h.command('retention.preview',{customerId:account.id,categories:['personal','import']})
  await h.command('customer.erase',{customerId:account.id,categories:['personal','import'],fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requested personal erasure',consentEvidence:'synthetic-mallet-931'})
  assert.equal((await h.request(path,{as:''})).status,404);const erased=(await h.state()).records.reviewRequest.find(r=>r.id===request.id);assert.ok(erased.response.erasedAt);assert.equal(erased.response.feedback,undefined);assert.equal(erased.response.rating,undefined)
  const postErase=await archive(h),destination=await installation()
  try{await restore(destination,backup,{laterJournal:{sourceIdentity:postErase[0].sourceIdentity,epoch:postErase[0].epoch,journal:postErase[0].journal},status:400})}finally{await destination.close()}
 }finally{await h.close()}
}
