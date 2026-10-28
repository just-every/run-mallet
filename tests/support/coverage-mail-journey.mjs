import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {warrantyOriginal} from './warranty-journey.mjs'
import {coverageFixture} from './coverage-follow-up-journey.mjs'

export async function coverageMailFixture(h,f){
 const fixture=await coverageFixture(h,f),now=Date.now(),due=new Date(now+86400000);due.setUTCHours(12,0,0,0)
 // Cron receives a controlled future noon, independent of today's hour or date boundary.
 const dueAt=due.toISOString(),expiresAt=new Date(due.getTime()+2*86400000).toISOString()
 const contract={...fixture.contract,reference:'synthetic-mallet-640',startsAt:new Date(now-86400000).toISOString(),endsAt:new Date(now+365*86400000).toISOString(),dueAt}
 const review=await h.command('coverage.schedule',contract)
 const consent={id:review.id,version:review.version,to:(await h.state()).records.asset.find(a=>a.id===f.job.assetId).customerEmail,consent:true,wordingVersion:'coverage-email-v1',consentedAt:new Date(now-60000).toISOString(),captureChannel:'telephone',sourceEvidence:'Customer requested this one coverage email; recorded telephone statement synthetic-mallet-641.'}
 const approval={dueAt,expiresAt,timeZone:'UTC',allowedStart:12,allowedEnd:13,confirm:true}
 return {review,contract,consent,approval,dueAt,expiresAt}
}
export const coverageResponsePath=messages=>new URL(messages.findLast(m=>m.subject==='Your coverage review').text.match(/https?:\/\/[^\s]+\/coverage-response\/[^\s]+/)[0]).pathname
export async function coverageMailJourney(){
 let failMail=false
 const h=await installation({mailService:()=>failMail?new Response('Provider rejected request',{status:422}):Response.json({id:'synthetic-mallet-mail-reference'})})
 try{
  const f=await warrantyOriginal(h)
  const {customersFixture}=await import('./customers-journey.mjs'),cf=await customersFixture(h),account=await h.command('customer.save',cf.input),originalAsset=(await h.state()).records.asset.find(a=>a.id===f.job.assetId)
  await h.command('customer.linkAsset',{assetId:originalAsset.id,version:originalAsset.version,customerId:account.id,customerVersion:account.version,reason:'Owner reviewed current customer ownership before coverage permission.'})
  const x=await coverageMailFixture(h,f),owner=(await h.state()).actor
  const member=await h.person(['synthetic-mallet-mail-tech','example.test'].join('@')),admin=await h.person(['synthetic-mallet-mail-advisor','example.test'].join('@'),'admin'),key=await h.command('agent.create',{label:'synthetic-mallet-mail-agent'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
  const baseline=(await h.state()).records
  for(const command of ['coverage.consent','coverage.approve','coverage.withdraw','coverage.mailResolve','coverage.caseResolve','coverage.recordRenewal'])for(const opts of [{as:'',status:401},{as:admin.cookie,status:403},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(command,{},opts)
  for(const command of ['coverage.mailClaim','coverage.mailOutcome','coverage.reply','coverage.customerWithdraw'])await h.command(command,{}, {status:404})
  await h.command('coverage.consent',{...x.consent,consent:false},{status:422})
  await h.command('coverage.consent',{...x.consent,sourceEvidence:''},{status:400})
  await h.command('coverage.consent',{...x.consent,to:['other','example.test'].join('@')},{status:400})
  assert.deepEqual((await h.state()).records,baseline)
  const consent=await h.command('coverage.consent',x.consent)
  await h.command('coverage.approve',{...x.approval,consentId:consent.id,version:consent.version,confirm:false},{status:422})
  let notice=await h.command('coverage.approve',{...x.approval,consentId:consent.id,version:consent.version})
  assert.equal(notice.to,consent.to);assert.equal(notice.consentVersion,consent.version);assert.equal(notice.by.id,owner.id)
  assert.match(notice.content,/not independently verified/)
  const beforeSend=h.messages.length,at=Date.parse(x.dueAt)
  await h.cron(at-1);assert.equal(h.messages.length,beforeSend,'No coverage email before the review or outside the recipient window')
  await h.cron(at);await h.restart();await h.cron(at)
  assert.equal(h.messages.length,beforeSend+1,'Replay and restart cannot duplicate a provider handoff')
  notice=(await h.state()).records.coverageNotice.find(n=>n.id===notice.id)
  assert.equal(notice.status,'accepted');assert.equal(notice.providerReference,'synthetic-mallet-mail-reference')
  assert.equal(notice.replyExpiresAt,x.expiresAt)
  const path=coverageResponsePath(h.messages),message=h.messages.at(-1)
  assert.equal(message.to[0],consent.to);assert.match(message.text,/No work, contract renewal or payment is authorized/)
  const page=await h.request(path,{as:''});assert.equal(page.status,200);assert.equal(page.headers.get('referrer-policy'),'same-origin')
  const html=await page.text();assert.ok(!html.includes(f.invoice.number));assert.ok(!html.includes(consent.to),'A private response link does not reveal the stored recipient')
  const post=(target,body,headers={})=>h.mf.dispatchFetch(h.origin+target,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams(body)})
  const beforeReply=(await h.state()).records
  assert.equal((await post(path,{action:'respond',symptom:'Cross-origin report'},{origin:'https://elsewhere.test'})).status,403)
  assert.equal((await h.request('/coverage-response/'+'x'.repeat(43),{as:''})).status,404)
  assert.equal((await h.request(path+'/extra',{as:''})).status,404)
  assert.deepEqual((await h.state()).records,beforeReply)
  assert.equal((await post(path,{action:'respond',symptom:'Same pad squeal reported by customer',id:'another-notice',jobId:'another-repair'})).status,303)
  assert.equal((await post(path,{action:'respond',symptom:'Replay must not replace original report'})).status,303)
  let s=await h.state(),linked=s.records.coverageCase
  assert.equal(linked.length,1);assert.equal(linked[0].symptom,'Same pad squeal reported by customer');assert.equal(linked[0].jobId,f.job.id);assert.equal(linked[0].coverageId,x.review.id);assert.equal(linked[0].by.role,'customer')
  assert.match(await (await h.request(path,{as:''})).text(),/Your report was saved/)
  for(const kind of ['job','invoice','export','payment','warranty'])assert.deepEqual(s.records[kind],beforeReply[kind],'A customer symptom never authorizes or creates '+kind)
  const record=linked[0],beforeCase=s.records
  await h.command('coverage.caseResolve',{id:record.id,version:record.version,reason:'Unsafe advisor resolution'},{as:admin.cookie,status:403});assert.deepEqual((await h.state()).records,beforeCase)
  const resolved=await h.command('coverage.caseResolve',{id:record.id,version:record.version,reason:'Owner contacted customer separately; diagnosis and repair require separate approval.'})
  assert.equal(resolved.status,'resolved');assert.equal(resolved.resolution.by.id,owner.id)
  await h.command('coverage.approve',{...x.approval,consentId:consent.id,version:consent.version},{status:409})
  // Distinct agreements exercise every stop without reviving an earlier approval.
  const schedule=async n=>{
   const review=await h.command('coverage.schedule',{...x.contract,reference:'synthetic-mallet-mail-'+n,documentReference:'synthetic-mallet-document-'+n})
   const c=await h.command('coverage.consent',{...x.consent,id:review.id,version:review.version})
   const mail=await h.command('coverage.approve',{...x.approval,consentId:c.id,version:c.version})
   return {review,c,mail}
  }
  const cancel=await schedule('canceled')
  await h.command('coverage.cancel',{id:cancel.review.id,version:cancel.review.version,reason:'Customer canceled this agreement before the send.'})
  const failed=await schedule('failed');failMail=true
  const count=h.messages.length;await h.cron(at);await h.cron(at);await h.restart();await h.cron(at)
  s=await h.state();assert.equal(s.records.coverageNotice.find(n=>n.id===cancel.mail.id).status,'stopped');assert.equal(s.records.coverageNotice.find(n=>n.id===failed.mail.id).status,'failed');assert.equal(h.messages.length,count+1,'A failed provider handoff never retries')
  const failure=s.records.coverageNotice.find(n=>n.id===failed.mail.id)
  const recovery=await h.command('coverage.mailResolve',{id:failure.id,version:failure.version,reason:'Owner saw refusal and contacted the customer separately; no resend.'});assert.equal(recovery.resolution.by.id,owner.id)
  await h.cron(at);assert.equal(h.messages.length,count+1)
  failMail=false
  const renewed=await schedule('renewed'),beforeRenewal=(await h.state()).records
  const renewedInput={...x.contract,id:renewed.review.id,version:renewed.review.version,reference:'synthetic-mallet-renewal-next',documentReference:'synthetic-mallet-signed-renewal',confirm:'record-evidenced-renewal',reason:'Owner retained the separate signed customer renewal; no merchant charge or provider execution.'}
  await h.command('coverage.recordRenewal',{...renewedInput,confirm:''},{status:422})
  const renewal=await h.command('coverage.recordRenewal',renewedInput)
  s=await h.state();assert.equal(s.records.coverageRenewal.length,1);assert.equal(renewal.coverageId,renewed.review.id);assert.equal(renewal.by.id,owner.id)
  const replacement=s.records.coverageReview.find(r=>r.id===renewal.replacementCoverageId);assert.equal(replacement.source.documentReference,renewedInput.documentReference);assert.equal(replacement.dueAt,x.dueAt)
  assert.equal(s.records.coverageReview.find(r=>r.id===renewed.review.id).status,'completed')
  for(const kind of ['job','invoice','export','payment','warranty'])assert.deepEqual(s.records[kind],beforeRenewal[kind],'Recorded renewal evidence does not execute '+kind)
  await h.command('coverage.recordRenewal',{...renewedInput,version:s.records.coverageReview.find(r=>r.id===renewed.review.id).version},{status:409})
  const pending=await schedule('restore')
  const unapprovedReview=await h.command('coverage.schedule',{...x.contract,reference:'synthetic-mallet-unapproved',documentReference:'synthetic-mallet-unapproved-document'}),unapprovedConsent=await h.command('coverage.consent',{...x.consent,id:unapprovedReview.id,version:unapprovedReview.version})
  const backup=await archive(h),fresh=await installation()
  try{
   assert.ok(backup[0].tables.every(t=>!['mallet_coverage_reply_tokens','mallet_coverage_mail_authority','mallet_coverage_consent_authority'].includes(t.name)))
   await restore(fresh,backup)
   const final=(await h.state()).records
   for(const kind of ['coverageReview','coverageRenewal','coverageConsent','coverageNotice','coverageCase'])assert.deepEqual((await fresh.state()).records[kind],final[kind],'Exact portable '+kind+' history')
   assert.equal((await fresh.request(path,{as:''})).status,404,'Archived customer links never regain authority')
   await fresh.cron(at);assert.equal(fresh.messages.filter(m=>m.subject==='Your coverage review').length,0)
   const historic=await fresh.command('coverage.consent',{...x.consent,id:pending.review.id,version:pending.review.version})
   // A restored consent itself is not local approval authority.
   const beforeHistorical=(await fresh.state()).records
   await fresh.command('coverage.approve',{...x.approval,consentId:unapprovedConsent.id,version:unapprovedConsent.version},{status:403})
   assert.deepEqual((await fresh.state()).records,beforeHistorical)
   assert.ok(historic.id)
  }finally{await fresh.close()}
  const withdrawn=await schedule('withdrawn'),transfer=await schedule('transferred')
  assert.equal((await post(path,{action:'withdraw'})).status,303)
  assert.equal((await h.request(path,{as:''})).status,404)
  await h.command('coverage.consent',{...x.consent,id:withdrawn.review.id,version:withdrawn.review.version},{status:409})
  const asset=(await h.state()).records.asset.find(a=>a.id===f.job.assetId)
  await h.command('coverage.transfer',{assetId:asset.id,version:asset.version,reason:'Recorded vehicle transfer stops pending email.'})
  const sends=h.messages.length;await h.cron(at);s=await h.state();assert.equal(h.messages.length,sends)
  assert.equal(s.records.coverageNotice.find(n=>n.id===transfer.mail.id).status,'stopped')
  for(const opts of [{as:admin.cookie},agent]){const privateState=await h.state(opts);assert.equal(privateState.records.coverageNotice,undefined);assert.equal(privateState.records.coverageCase,undefined);assert.equal(privateState.records.coverageConsent,undefined)}
  const preview=await h.command('retention.preview',{customerId:account.id,categories:['personal','import']})
  await h.command('customer.erase',{customerId:account.id,categories:['personal','import'],fingerprint:preview.fingerprint,consent:true,confirm:'ERASE',reason:'Customer requested removal of eligible private coverage records.',consentEvidence:'Verified erasure request synthetic-mallet-649.'})
  s=await h.state();assert.equal(s.records.coverageCase[0].symptom,undefined);assert.equal(s.records.coverageCase[0].status,'erased');assert.ok(s.records.coverageNotice.every(n=>n.to==='erased'&&n.content==='Erased personal content'&&n.sourceBasis===''))
  assert.equal((await h.request(path,{as:''})).status,404)
  const erasedBackup=await archive(h),recovered=await installation()
  try{assert.equal(JSON.stringify(erasedBackup).includes('Same pad squeal reported by customer'),false);await restore(recovered,erasedBackup);for(const kind of ['coverageReview','coverageRenewal','coverageConsent','coverageNotice','coverageCase'])assert.deepEqual((await recovered.state()).records[kind],s.records[kind]);await recovered.cron(at);assert.equal(recovered.messages.filter(m=>m.subject==='Your coverage review').length,0)}finally{await recovered.close()}

 }finally{await h.close()}
 await coverageMailRevocationJourney()
}

async function coverageMailRevocationJourney(){
 const h=await installation()
 try{
  const f=await warrantyOriginal(h),x=await coverageMailFixture(h,f),original=(await h.state()).actor
  const consent=await h.command('coverage.consent',x.consent)
  await h.command('coverage.approve',{...x.approval,consentId:consent.id,version:consent.version})
  const next=await h.command('coverage.schedule',{...x.contract,reference:'synthetic-mallet-revoked-pending',documentReference:'synthetic-mallet-revoked-document'}),nextConsent=await h.command('coverage.consent',{...x.consent,id:next.id,version:next.version})
  const future=new Date(Date.parse(x.dueAt)+86400000).toISOString(),pending=await h.command('coverage.approve',{...x.approval,dueAt:future,consentId:nextConsent.id,version:nextConsent.version})
  await h.cron(x.dueAt)
  const path=coverageResponsePath(h.messages);assert.equal((await h.request(path,{as:''})).status,200)
  const email=['synthetic-mallet-current-owner','example.test'].join('@'),replacement=await h.person(email,'admin')
  const confirmOwnerAdministration=async as=>{
   await h.api('/auth/step-up',{action:'owner:transfer',returnTo:'/app'},{as,status:202})
   const token=new URL(h.messages.at(-1).text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?token=[^\s<>]+/)[0]).searchParams.get('token')
   assert.equal((await h.request('/auth/confirm',{method:'POST',as,body:{token}})).status,303)
  }
  await confirmOwnerAdministration(h.owner)
  await h.api('/auth/operator/role',{operatorId:replacement.id,role:'owner'})
  const cookie=await h.signInAs(email);await h.stepUp(cookie);await confirmOwnerAdministration(cookie)
  await h.api('/auth/operator/status',{operatorId:original.id,status:'inactive'},{as:cookie})
  await h.state({status:401})
  assert.equal((await h.request(path,{as:''})).status,404,'A revoked approving owner also revokes the private reply link')
  const messages=h.messages.length;await h.cron(future);await h.restart();await h.cron(future)
  const s=await h.state({as:cookie});assert.equal(s.records.coverageNotice.find(n=>n.id===pending.id).status,'stopped');assert.equal(s.records.coverageCase?.length??0,0);assert.equal(h.messages.length,messages,'Revoked owner approvals cannot send or create customer cases')
 }finally{await h.close()}
}
