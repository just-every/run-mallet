import assert from 'node:assert/strict'
import {archive,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {coilDiagnosis,shopSetup} from './diagnosis-journey.mjs'
import {qualityReady} from './quality-ready.mjs'
import {handoverInput} from './handover-input.mjs'
export const noticeAt=(base,hours)=>new Date(base+hours*3600000).toISOString()
export async function statusFixture(h){
 await shopSetup(h)
 const base=Date.now(),hour=new Date(base).getUTCHours(),{asset,job}=await booking(h,{startAt:noticeAt(base,24),endAt:noticeAt(base,25)}),owner=(await h.state()).actor
 const current=async()=>(await h.state()).records.job.find(j=>j.id===job.id)
 const consentInput={jobId:job.id,version:job.version,to:asset.customerEmail,channel:'email',consent:true,wordingVersion:'repair-status-email-v1',consentedAt:noticeAt(base,-1),captureChannel:'in-person',sourceEvidence:'synthetic-mallet-940: customer chose status email at the counter'}
 const consent=await h.command('statusNotice.consent',consentInput)
 const approval=async(kind,overrides={})=>{
  const s=await h.state(),j=s.records.job.find(j=>j.id===job.id),source=s.records.stageEvent.filter(e=>e.jobId===job.id).sort((a,b)=>a.sequence-b.sequence).at(-1)
  return {jobId:job.id,jobVersion:j.version,sourceId:source.id,kind,templateVersion:kind+'-v1',consentId:consent.id,version:consent.version,confirm:true,customerText:'Please contact Cedar repair shop for this '+kind+' update.',dueAt:noticeAt(base,-.01),expiresAt:noticeAt(base,12),timeZone:'UTC',allowedStart:(hour+23)%24,allowedEnd:(hour+18)%24,...(['ready','pickup'].includes(kind)?{pickupDueAt:noticeAt(base,3),pickupPolicy:'Owner calls after the agreed pickup deadline; no fee, disposal or title action.'}:{}),...overrides}
 }
 const approve=async(kind,overrides={})=>h.command('statusNotice.approve',await approval(kind,overrides))
 const diagnosis=async()=>h.command('diagnosis.record',{jobId:job.id,version:(await current()).version,...coilDiagnosis,dtcs:[],measurements:[],attachmentIds:[]})
 const prepare=async()=>estimate(h,await current())
 const parts=async(q)=>{
  q=(await h.state()).records.estimate.find(r=>r.id===q.id)
  if(q.status==='draft')await authorise(h,q)
  else{q=await h.command('estimate.markSent',{estimateId:q.id,version:q.version,revision:1,method:'printed'});await h.command('estimate.authorise',{estimateId:q.id,version:q.version,revision:1,lineIds:q.revisions[0].lines.map(l=>l.id),customerName:'Cedar Bikes',method:'signed',evidence:'synthetic-mallet-947: signed repair authorization'})}
  return h.command('promise.partETA',{jobId:job.id,version:(await current()).version,planVersion:0,partId:'synthetic-mallet-941',name:'Brake pads',eta:noticeAt(base,2),sourceNote:'Supplier phone call, staff observation',reason:'Authorized pads on order'})
 }
 const ready=async(q,plan)=>{
  await h.command('promise.partETA',{jobId:job.id,version:(await current()).version,planVersion:plan.version,partId:'synthetic-mallet-941',name:'Brake pads',eta:noticeAt(base,2),receivedAt:noticeAt(base,-.01),sourceNote:'Counted at the parts desk',reason:'Pads physically received'})
  for(const line of q.revisions[0].lines)await h.command('work.record',{jobId:job.id,version:(await current()).version,lineId:line.id,quantity:line.quantity})
  await qualityReady(h,await current());await h.command('job.complete',{jobId:job.id,version:(await current()).version})
 }
 return {asset,job,owner,base,hour,current,consent,consentInput,approval,approve,diagnosis,prepare,parts,ready}
}
export async function statusDeliveryJourney(){
 const h=await installation();try{
  const f=await statusFixture(h),member=await h.person('synthetic-mallet-942@example.test'),advisor=await h.person('synthetic-mallet-943@example.test','admin'),key=await h.command('agent.create',{label:'Status boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
  for(const options of [{as:member.cookie,status:403},{as:advisor.cookie,status:403},{...agent,status:403},{as:'',status:401}]){
   await h.command('statusNotice.consent',f.consentInput,options)
   assert.equal((await h.request('/app/jobs/'+f.job.id+'/notifications',options)).status,options.as===''&&!options.headers?303:403)
  }
  assert.equal((await h.state({as:advisor.cookie})).records.statusConsent,undefined)
  await h.command('statusNotice.claim',{id:'synthetic-mallet-944',version:1},{status:404})
  await h.command('statusNotice.consent',{...f.consentInput,consent:false},{status:422})
  await h.command('statusNotice.consent',{...f.consentInput,channel:'sms'},{status:422})
  await f.diagnosis()
  for(const change of [{confirm:false},{sourceId:'synthetic-mallet-wrong-source'},{templateVersion:'synthetic-mallet-wrong-template'}])await h.command('statusNotice.approve',await f.approval('diagnosis',change),{status:409})
  const diagnosis=await f.approve('diagnosis'),before=h.messages.length
  await h.cron(noticeAt(f.base,0));assert.equal(h.messages.length,before+1);assert.equal(h.messages.at(-1).subject,'Your repair: diagnosis')
  assert.match(h.messages.at(-1).text,/Please contact Cedar repair shop/);assert.doesNotMatch(h.messages.at(-1).text,/Cylinder|P0301/,'Private diagnosis is never copied into a status template')
  const q=await f.prepare();await h.command('statusNotice.approve',await f.approval('approval'),{status:409})
  const approved=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1}),approval=await f.approve('approval');await h.cron(noticeAt(f.base,.01))
  const plan=await f.parts(approved),parts=await f.approve('parts');await Promise.all([h.cron(noticeAt(f.base,.02)),h.cron(noticeAt(f.base,.02))]);await h.restart();await h.cron(noticeAt(f.base,.03))
  assert.equal(h.messages.filter(m=>m.subject==='Your repair: parts').length,1)
  await h.command('statusNotice.approve',await f.approval('parts'),{status:409})
  await f.ready(q,plan);const ready=await f.approve('ready'),pickup=await f.approve('pickup');await h.cron(noticeAt(f.base,.04))
  const notices=(await h.state()).records.statusNotice
  assert.deepEqual(notices.map(n=>n.kind).sort(),['approval','diagnosis','parts','pickup','ready'])
  assert.deepEqual(notices.map(n=>n.status),Array(5).fill('accepted'))
  for(const n of notices){assert.ok(n.providerReference);assert.equal(n.by.id,f.owner.id);assert.equal(n.templateVersion,n.kind+'-v1');assert.ok(n.claimedAt);assert.ok(n.outcomeAt)}
  assert.equal(h.messages.filter(m=>m.subject.startsWith('Your repair: ')).length,5)
  await h.cron(noticeAt(f.base,4));await h.cron(noticeAt(f.base,4.1))
  let s=await h.state(),tasks=s.records.subtask.filter(t=>t.kind==='pickup-followup')
  assert.equal(tasks.length,1);assert.equal(tasks[0].jobId,f.job.id);assert.match(tasks[0].policy,/no fee, disposal or title action/)
  assert.match(await (await h.request('/app/jobs/'+f.job.id+'/notifications')).text(),/Uncollected repair: owner follow-up required/)
  assert.match(await (await h.request('/app/jobs')).text(),/Open status and pickup follow-up/)
  const open=s.records.statusNotice.find(n=>n.uncollectedTaskId)
  await h.command('statusNotice.resolve',{id:open.id,version:open.version,reason:'Owner reached customer; pickup agreed for tomorrow'})
  s=await h.state();assert.ok(s.records.subtask.find(t=>t.id===tasks[0].id).completedAt);assert.equal(s.records.statusNotice.find(n=>n.id===open.id).resolution.by.id,f.owner.id)
  const backup=await archive(h),fresh=await installation()
  try{await restore(fresh,backup);const recovered=await fresh.state();for(const kind of ['statusConsent','statusNotice'])assert.deepEqual(recovered.records[kind],s.records[kind]);await fresh.cron(noticeAt(f.base,5));assert.equal(fresh.messages.length,0);await fresh.command('statusNotice.approve',await f.approval('pickup'),{status:409});await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
  assert.ok(s.records.audit.some(a=>a.action==='statusNotice.approve'&&a.actor.id===f.owner.id))
  return {diagnosis,approval,parts,ready,pickup}
 }finally{await h.close()}
}
export async function statusStopsJourney(){
 let reject=false
 const h=await installation({mailService:async()=>reject?Response.json({error:'synthetic-mallet-945'},{status:422}):Response.json({id:'synthetic-mallet-946'})})
 try{
  const f=await statusFixture(h);await f.diagnosis()
  const quiet=await f.approve('diagnosis',{allowedStart:(f.hour+2)%24,allowedEnd:(f.hour+8)%24})
  const before=h.messages.length;await h.cron(noticeAt(f.base,.1));assert.equal(h.messages.length,before)
  const backup=await archive(h),fresh=await installation()
  try{await restore(fresh,backup);await fresh.cron(noticeAt(f.base,2.1));assert.equal(fresh.messages.length,0,'Restored consent grants no outbound authority');const s=await fresh.state();await fresh.command('statusNotice.approve',await f.approval('diagnosis'),{status:409});assert.equal(s.records.statusNotice.find(n=>n.id===quiet.id).status,'skipped')}finally{await fresh.close()}
  await f.prepare();await h.cron(noticeAt(f.base,2.1));assert.equal(h.messages.length,before);assert.equal((await h.state()).records.statusNotice.find(n=>n.id===quiet.id).status,'stopped','Changed repair invalidates pending content')
  const q=(await h.state()).records.estimate[0];await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
  const failed=await f.approve('approval');reject=true;await h.cron(noticeAt(f.base,.2));assert.equal((await h.state()).records.statusNotice.find(n=>n.id===failed.id).status,'failed')
  const calls=h.messages.length;await h.restart();await h.cron(noticeAt(f.base,.3));assert.equal(h.messages.length,calls,'Failed email never retries')
  let n=(await h.state()).records.statusNotice.find(n=>n.id===failed.id);await h.command('statusNotice.resolve',{id:n.id,version:n.version,reason:'Owner called the customer after rejected email'})
  const plan=await f.parts(q),parts=await f.approve('parts')
  await h.command('statusNotice.withdraw',{consentId:f.consent.id,version:f.consent.version,reason:'Customer asked to stop all status email'})
  await h.cron(noticeAt(f.base,.4));assert.equal(h.messages.length,calls);assert.equal((await h.state()).records.statusNotice.find(n=>n.id===parts.id).status,'stopped')
  await h.command('statusNotice.consent',{...f.consentInput,version:(await f.current()).version},{status:409})
  assert.equal(plan.jobId,f.job.id)
 }finally{await h.close()}
 // Recorded collection suppresses the uncollected-property task.
 const collected=await installation();try{
  const f=await statusFixture(collected),q=await f.prepare(),plan=await f.parts(q);await f.ready(q,plan);await f.approve('ready')
  let bill=await collected.command('invoice.prepare',{jobId:f.job.id,version:(await f.current()).version});bill=await collected.command('invoice.approve',{invoiceId:bill.id,version:bill.version})
  await collected.command('flow.collect',await handoverInput(collected,f.job.id,'Elena Torres'))
  await collected.cron(noticeAt(f.base,4));assert.equal(((await collected.state()).records.subtask??[]).filter(t=>t.kind==='pickup-followup').length,0);assert.equal(collected.messages.filter(m=>m.subject==='Your repair: ready').length,0)
 }finally{await collected.close()}
 const erased=await installation();try{
  const f=await statusFixture(erased),contact=await erased.command('contact.save',{name:'Cedar Bikes',email:f.asset.customerEmail,phone:'',communication:'none',notes:''}),account=await erased.command('customer.save',{name:'Cedar Bikes',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''})
  await erased.command('customer.linkAsset',{assetId:f.asset.id,version:(await erased.state()).records.asset.find(a=>a.id===f.asset.id).version,customerId:account.id,customerVersion:account.version,reason:'Owner checked exact customer identity'})
  await f.diagnosis();const n=await f.approve('diagnosis'),backup=await archive(erased)
  await erased.command('retention.hold',{customerId:account.id,scope:'all',jobId:'',reason:'Preserve customer authorization history',caseReference:'synthetic-mallet-951'})
  const categories=['personal','import'],preview=await erased.command('retention.preview',{customerId:account.id,categories})
  await erased.command('customer.erase',{customerId:account.id,categories,fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requested erasure; honor active hold',consentEvidence:'synthetic-mallet-952'})
  const before=erased.messages.length;await erased.cron(noticeAt(f.base,.1));assert.equal(erased.messages.length,before,'Erasure revokes pending send authority even under a hold')
  assert.deepEqual((await erased.state()).records.statusConsent,[f.consent],'Held authorization evidence remains exact')
  assert.equal((await erased.state()).records.statusNotice.find(r=>r.id===n.id).status,'skipped')
  const current=await archive(erased),destination=await installation()
  try{await restore(destination,backup,{laterJournal:{sourceIdentity:current[0].sourceIdentity,epoch:current[0].epoch,journal:current[0].journal},status:400})}finally{await destination.close()}
 }finally{await erased.close()}
}
