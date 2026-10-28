import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {archive,booking,installation,restore} from '../harness.mjs'
import {inspectionPhoto} from './inspection-photo.mjs'
import {decide} from './approval-journey.mjs'
import {shopSetup} from './diagnosis-journey.mjs'

export const mailbox=n=>['synthetic-mallet-'+n,'example.test'].join('@')
export const question='What did the inspection find?'
export const priceQuestion='What is the approved estimate price?'
export const conversationPath=job=>'/api/mallet/repairs/'+job.id+'/conversation'
export const reviewInput=row=>({jobId:row.jobId,draftId:row.id,version:row.version,revision:row.revisions.at(-1).n,content:row.revisions.at(-1).content,decision:'approved',note:'Owner checked the exact cited facts and private draft text.'})
export async function conversationFixture(h,n=930){
 await shopSetup(h)
 const contact=await h.command('contact.save',{version:0,name:'Morgan Customer',email:mailbox(n),phone:'',communication:'email',notes:''})
 const account=await h.command('customer.save',{version:0,name:'Morgan Customer',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''})
 let asset=await h.command('asset.create',{customerName:'Morgan Customer',customerEmail:mailbox(n),label:'2019 Honda Civic',identifier:'synthetic-mallet-'+n})
 asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Customer confirmed the vehicle relationship.'})
 const {job}=await booking(h,{asset,bayId:'synthetic-mallet-'+n,startAt:n===930?'2026-11-01T09:00:00Z':'2026-11-02T09:00:00Z',endAt:n===930?'2026-11-01T10:00:00Z':'2026-11-02T10:00:00Z'})
 const template=await h.command('inspectionTemplate.save',{version:0,name:'Brake measurement',vehicle:'Passenger vehicle',service:'Brakes',reason:'Measured evidence',items:[{id:'front-pads',label:'Front brake pads',measurement:{name:'Pad thickness',unit:'mm'}}]})
 let inspection=await h.command('inspection.assign',{jobId:job.id,version:job.version,templateId:template.id,templateVersion:template.version,templateRevision:1,technicianId:(await h.state()).actor.id,reason:'Record the measured pads'})
 const photo=await inspectionPhoto(h,job.id,h.owner)
 const observation={photoUploadId:photo.id,jobId:job.id,version:job.version,inspectionId:inspection.id,itemId:'front-pads',outcome:'red',measurementValue:2.5,measurementUnit:'mm',reason:'Measured pads; replacement recommended'}
 inspection=await h.command('inspection.record',{...observation,inspectionVersion:inspection.version})
 let quote=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Front brake pads',quantity:1,unitCents:8000,costCents:2000},{kind:'labor',description:'Replace front pads',quantity:1,unitCents:12000}]})
 quote=await h.command('estimate.approve',{estimateId:quote.id,version:quote.version,revision:1})
 quote=await h.command('estimate.markSent',{estimateId:quote.id,version:quote.version,revision:1,method:'printed',note:'Exact printed revision handed to the customer.'})
 const privateNote='synthetic-mallet-'+n+' private supplier dispute and technician speculation'
 await h.command('diagnosis.record',{jobId:job.id,version:(await h.state()).records.job.find(j=>j.id===job.id).version,complaint:'Brake noise',cause:'Measured pads',correction:'Replacement proposed',testMethod:'Measured pad thickness',staffNote:privateNote,customerExplanation:'Measured front pads',dtcs:[],measurements:[]})
 const current=()=>h.state().then(s=>s.records.job.find(j=>j.id===job.id))
 const createReport=async(i=inspection,q=quote)=>{
  const report=await h.command('inspectionReport.review',{jobId:job.id,version:(await current()).version,title:'Reviewed front brake inspection',entries:[{inspectionId:i.id,inspectionVersion:i.version,resultId:i.results.at(-1).id,estimateId:q.id,estimateVersion:q.version,revision:q.revisions.at(-1).n,lineIds:q.revisions.at(-1).lines.map(l=>l.id),mediaIds:[],explanation:'Front pads measured 2.5 mm; replacement is proposed.'}]})
  await h.command('inspectionReport.send',{reportId:report.id,operationId:randomUUID(),to:asset.customerEmail,consent:true,consentEvidence:'Customer requested this exact report at the counter.',days:7})
  return report
 }
 const report=await createReport()
 const capture={jobId:job.id,captureReference:'synthetic-mallet-'+n,question,topic:'inspection',source:'telephone',evidence:'Customer question entered from dated telephone note '+n,enteredAt:'2026-10-28T10:00:00Z',reportId:report.id,estimateId:quote.id,revision:1}
 return {job,asset,account,contact,inspection,quote,report,capture,privateNote,current,observation,createReport}
}
async function refused(h,command,input,options={},code){
 const response=await h.request('/api/mallet/commands',{method:'POST',body:{command,input},...options})
 assert.ok([400,401,403,409].includes(response.status),command+' refuses unsafe input or authority: '+response.status)
 const result=await response.json();if(code)assert.equal(result.error,code)
}
export async function conversationJourney(h){
 const f=await conversationFixture(h),before=(await h.state()).records,messageCount=h.messages.length
 let draft=await h.command('conversation.capture',f.capture)
 assert.equal(draft.authenticatedReceipt,false);assert.equal(draft.source,'telephone');assert.equal(draft.evidence,f.capture.evidence);assert.equal(draft.question,question)
 const revision=draft.revisions[0]
 assert.equal(revision.outcome,'draft');assert.ok(revision.content.includes('2.5 mm'));assert.ok(revision.content.includes('Machine-assisted'))
 assert.ok(!JSON.stringify(draft).includes(f.privateNote));assert.ok(!JSON.stringify(draft).includes('costCents'))
 assert.ok(revision.citations.some(c=>c.kind==='inspection'&&c.id===f.inspection.id&&c.version===f.inspection.version&&c.resultId===f.inspection.results[0].id))
 assert.ok(revision.citations.some(c=>c.kind==='estimate'&&c.id===f.quote.id&&c.revision===1))
 const saved=structuredClone((await h.state()).records)
 assert.deepEqual(await h.command('conversation.capture',f.capture),draft)
 assert.deepEqual((await h.state()).records,saved,'Capture replay changes no records')
 await refused(h,'conversation.capture',{...f.capture,question:'Different entered text'}, {},'CONVERSATION_REPLAY')
 await refused(h,'conversation.review',{...reviewInput(draft),content:revision.content+' invented answer'}, {},'CONVERSATION_EXACT')
 draft=await h.command('conversation.review',reviewInput(draft))
 assert.equal(draft.reviews[0].by.id,(await h.state()).actor.id);assert.equal(draft.reviews[0].content,revision.content)
 const prices=await h.command('conversation.capture',{...f.capture,captureReference:'synthetic-mallet-931',topic:'estimate',question:priceQuestion})
 assert.equal(prices.revisions[0].outcome,'draft');assert.ok(prices.revisions[0].content.includes('$80.00'));assert.ok(prices.revisions[0].content.includes('$206.00'))
 const sensitive=['Can I get a discount?','Is it safe to drive?','I dispute this price','Please add a new repair','What about that other issue?']
 for(const [n,q] of sensitive.entries()){
  const row=await h.command('conversation.capture',{...f.capture,captureReference:'synthetic-mallet-'+(940+n),question:q})
  assert.equal(row.revisions[0].outcome,'escalated');assert.ok(!row.revisions[0].content.includes('2.5 mm'))
  await refused(h,'conversation.review',reviewInput(row),{},'CONVERSATION_ESCALATION')
  const reviewed=await h.command('conversation.review',{...reviewInput(row),decision:'escalated',note:'Owner will contact the customer through the separately approved process.'})
  assert.equal(reviewed.reviews[0].decision,'escalated')
 }
 const missing=await h.command('conversation.capture',{...f.capture,captureReference:'synthetic-mallet-945',reportId:undefined,estimateId:undefined,revision:undefined})
 assert.equal(missing.revisions[0].outcome,'escalated')
 const after=(await h.state()).records
 for(const kind of ['estimate','approval','job','inspection','approvalLink'])assert.deepEqual(after[kind],before[kind],'Private drafts and entered replies never change '+kind)
 assert.equal(h.messages.length,messageCount,'Drafting, reviewing and escalation make no outbound calls')
 const member=await h.person(mailbox(950)),admin=await h.person(mailbox(951),'admin'),key=await h.command('agent.create',{label:'synthetic-mallet-952'})
 const agent={as:'',headers:{authorization:'Bearer '+key.token}}
 for(const options of [{as:member.cookie},{as:admin.cookie},agent,{as:''}]){
  const unchanged=(await h.state()).records
  for(const command of ['conversation.capture','conversation.redraft','conversation.review'])await refused(h,command,{...f.capture,...reviewInput(draft)},options)
  for(const path of [conversationPath(f.job),'/app/jobs/'+f.job.id+'/conversation']){
   const r=await h.request(path,options);assert.ok([303,401,403].includes(r.status));assert.ok(!(await r.text()).includes(f.capture.evidence))
  }
  const state=await h.state({...options,...(options.as===''&&!options.headers?{status:401}:{})})
  if(state.records)assert.equal(state.records.conversationDraft,undefined)
  assert.deepEqual((await h.state()).records,unchanged)
 }
 const revokedOwner=await h.signInAs(['owner','example.test'].join('@'))
 assert.equal((await h.request('/auth/signout',{as:revokedOwner,method:'POST',body:{}})).status,204)
 await refused(h,'conversation.capture',f.capture,{as:revokedOwner})
 assert.equal((await h.request(conversationPath(f.job),{as:revokedOwner})).status,401)
 const other=await conversationFixture(h,960)
 await refused(h,'conversation.capture',{...f.capture,captureReference:'synthetic-mallet-961',reportId:other.report.id},{},'CONVERSATION_SCOPE')
 await refused(h,'conversation.capture',{...f.capture,captureReference:'synthetic-mallet-962',estimateId:other.quote.id},{},'CONVERSATION_SCOPE')
 const recipientDraft=await h.command('conversation.capture',other.capture)
 await h.command('contact.save',{...other.contact,contactId:other.contact.id,version:other.contact.version,email:mailbox(965)})
 assert.equal((await h.api(conversationPath(other.job))).drafts.find(d=>d.id===recipientDraft.id).stale,true)
 await refused(h,'conversation.review',reviewInput(recipientDraft),{},'CONVERSATION_STALE')
 f.inspection=await h.command('inspection.record',{...f.observation,version:(await f.current()).version,inspectionVersion:f.inspection.version,measurementValue:3})
 assert.equal((await h.api(conversationPath(f.job))).drafts.find(d=>d.id===draft.id).stale,true)
 await refused(h,'conversation.review',reviewInput(draft),{},'CONVERSATION_STALE')
 const stale=await h.command('conversation.capture',{...f.capture,captureReference:'synthetic-mallet-963'})
 assert.equal(stale.revisions[0].outcome,'escalated')
 const updated=await f.createReport(f.inspection,f.quote)
 draft=await h.command('conversation.redraft',{jobId:f.job.id,draftId:draft.id,version:draft.version,reportId:updated.id,estimateId:f.quote.id,revision:1})
 assert.equal(draft.revisions.length,2);assert.deepEqual(draft.revisions[0],revision)
 draft=await h.command('conversation.review',reviewInput(draft));assert.equal(draft.reviews.length,2)
 // A changed person-approved price invalidates the earlier review as well.
 let q=await h.command('estimate.revise',{estimateId:f.quote.id,version:f.quote.version,revision:1,lines:[{kind:'part',description:'Revised front brake pads',quantity:1,unitCents:9000}]})
 assert.equal((await h.api(conversationPath(f.job))).drafts.find(d=>d.id===draft.id).stale,true)
 await refused(h,'conversation.review',reviewInput(draft),{},'CONVERSATION_STALE')
 assert.deepEqual((await h.state()).records.estimate.find(e=>e.id===q.id).authorisation,null)
 // Exact native signed-link decisions remain the only customer decision door.
 q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:2})
 const link=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:2,days:7})
 const path=new URL(link.url).pathname,chosen=q.revisions.at(-1).lines[0].id
 assert.equal((await decide(h,path,{['line-'+chosen]:'approve',typedName:'Morgan Customer',consent:''})).status,400)
 const signed=await decide(h,path,{['line-'+chosen]:'approve',typedName:'Morgan Customer',consent:'yes'})
 assert.equal(signed.status,200)
 const decision=(await h.state()).records.approvalLink.find(l=>l.id===link.id).decision
 const entered=await h.command('conversation.capture',{...f.capture,captureReference:'synthetic-mallet-966',question:'I approve more work in this entered transcript',source:'entered-transcript'})
 assert.equal(entered.authenticatedReceipt,false);assert.equal(entered.revisions[0].outcome,'escalated')
 assert.deepEqual((await h.state()).records.approvalLink.find(l=>l.id===link.id).decision,decision,'Entered reply cannot change the exact signed customer decision')
 await conversationRecovery(h,f)
 await h.api('/auth/operator/status',{operatorId:admin.id,status:'inactive'})
 await refused(h,'conversation.capture',{...f.capture,captureReference:'synthetic-mallet-964'},{as:admin.cookie})
 await h.command('agent.revoke',{id:key.id,version:key.version})
 await refused(h,'conversation.capture',f.capture,agent)
}
export async function conversationRecovery(h,f){
 const before=(await h.state()).records,old=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:mailbox(970)}})
 try{
  await restore(fresh,old)
  assert.deepEqual((await fresh.state()).records.conversationDraft,before.conversationDraft,'Fresh owner recovers exact eligible drafts and reviews')
  assert.equal((await fresh.request(conversationPath(f.job),{as:h.owner})).status,401)
  assert.equal(fresh.messages.length,0,'Recovered history sends nothing')
 }finally{await fresh.close()}
 const exported=await h.command('customer.export',{customerId:f.account.id})
 assert.ok(exported.records.conversationDraft.some(d=>d.jobId===f.job.id))
 const categories=['media','personal','import'],preview=await h.command('retention.preview',{customerId:f.account.id,mode:'erase',categories})
 await h.command('customer.erase',{customerId:f.account.id,categories,fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requested eligible private content erasure',consentEvidence:'Dated customer request reviewed by the owner'})
 const erased=(await h.state()).records.conversationDraft.filter(d=>d.jobId===f.job.id)
 assert.ok(erased.length);for(const d of erased){assert.equal(d.question,'');assert.equal(d.evidence,'');assert.deepEqual(d.revisions,[]);assert.deepEqual(d.reviews,[]);assert.ok(d.privacyErasedAt)}
 await refused(h,'conversation.capture',f.capture,{},'CONVERSATION_ERASED')
 const denied=await h.request(conversationPath(f.job));assert.equal(denied.status,409);assert.ok(!(await denied.text()).includes(f.capture.evidence))
 const postErase=await archive(h),destination=await installation({bindings:{OWNER_EMAIL:mailbox(971)}})
 try{
  await restore(destination,old,{laterJournal:{sourceIdentity:postErase[0].sourceIdentity,epoch:postErase[0].epoch,journal:postErase[0].journal},status:400})
  assert.equal((await destination.state()).records.conversationDraft,undefined,'An older archive cannot resurrect erased private conversations')
 }finally{await destination.close()}
 const recovered=await installation({bindings:{OWNER_EMAIL:mailbox(972)}})
 try{await restore(recovered,postErase);assert.deepEqual((await recovered.state()).records.conversationDraft, (await h.state()).records.conversationDraft)}finally{await recovered.close()}
}
