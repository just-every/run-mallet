import {ArchiveVerifier,ContentVerifier,makePart} from '@runeditrun/rer/modules/portability/format'
import {totpCode} from './second-factor.mjs'
import assert from 'node:assert/strict'
import {installation,archive,restore} from '../harness.mjs'
import {readyInvoice} from './return-journey.mjs'
import {handoverInput} from './handover-input.mjs'
export const CLOCK='2026-11-10T12:00:00.000Z'
export const ruleInput=(state='CA')=>({state,assetKind:'vehicle',label:'Synthetic reviewed '+state+' version 1',effectiveFrom:'2026-11-01T00:00:00Z',effectiveUntil:'2027-01-01T00:00:00Z',storageSource:state==='CA'?'https://leginfo.legislature.ca.gov':'https://statutes.capitol.texas.gov',noticeSource:'https://example.test/notice',lienSource:'https://example.test/lien',disposalSource:'https://example.test/disposal',storageRule:'Synthetic test review: elapsed 24-hour storage after a 24-hour delay, capped at USD 150. Not statutory values.',noticeRule:'Synthetic test review: recorded certified notice to the owner and all searched lienholders within two days.',lienRule:'Synthetic test review: current unpaid repair plus capped unpaid storage.',disposalRule:'Synthetic test review: minimum two days custody and two days after every delivery, explicit legal steps and owner decision.',noticeMethod:'Certified mail',startDelayHours:24,noticeWithinDays:2,waitDays:2,disposalAfterDays:2,storageCapCents:15000,repairLien:true,reviewer:'Synthetic legal reviewer',legalReference:'synthetic-mallet-1201'})
export async function storageInstallation(t,options={}){
 t.mock.timers.enable({apis:['Date'],now:new Date(CLOCK)})
 const base=await installation({entry:'tests/storage-worker.ts',...options,bindings:{...options.bindings,TEST_STORAGE_CLOCK:CLOCK}})
 const factor=await base.stepUp()
 let cookie=base.owner
 const confirm=async()=>{await (await base.mf.getD1Database('DB')).prepare("UPDATE mallet_factors SET last_step=NULL WHERE kind='totp'").run();await base.api('/api/mallet/security/verify/totp',{code:totpCode(factor.secret)},{as:cookie})}
 const h={...base,get mf(){return base.mf},get owner(){return cookie},request:(path,o={})=>base.request(path,{as:cookie,...o}),api:(path,p,o={})=>base.api(path,p,{as:cookie,...o}),command:(c,p,o={})=>base.command(c,p,{as:cookie,...o}),state:(o={})=>base.state({as:cookie,...o}),stepUp:confirm,async advance(at){t.mock.timers.setTime(Date.parse(at));await base.configure({TEST_STORAGE_CLOCK:at});cookie=await base.signInAs('owner@example.test');await confirm()}}
 return h
}
export const openInput=(job,rule)=>({jobId:job.id,ruleId:rule.id,uncollectedAt:CLOCK,dailyCents:5000,triggerEvidence:'Customer notified of completion and separately agreed storage rate, synthetic-mallet-1202',recipientSearch:'Current title search found one lienholder, synthetic-mallet-1203',recipients:[{role:'owner',name:job.asset.customerName,address:'1 Synthetic Street'},{role:'lienholder',name:'Synthetic Credit Union',address:'2 Synthetic Street'}],reviewer:'Synthetic case reviewer',legalReference:'synthetic-mallet-1204',confirm:true})
export const noticeInput=(r,recipient,sentAt='2026-11-11T12:00:00.000Z')=>({jobId:r.jobId,caseId:r.id,version:r.version,recipientId:recipient.id,method:'Certified mail',sentAt,deliveredAt:sentAt,content:'Exact reviewed synthetic notice for this repair, amount and recipient: '+recipient.name,deliveryEvidence:'Synthetic signed delivery receipt '+recipient.name})
export async function storageJourney(t){
 const h=await storageInstallation(t)
 try{
  const advisor=await h.person('storage-advisor@example.test','admin'),member=await h.person('storage-tech@example.test'),key=await h.command('agent.create',{label:'Synthetic storage assistant'}),reviewer=advisor
  const cases=[]
  for(const state of ['CA','TX']){
   const rule=await h.command('storage.rule',ruleInput(state)),asset=await h.command('asset.create',{customerName:'Synthetic '+state,customerEmail:'synthetic-'+state.toLowerCase()+'@example.test',label:state+' uncollected vehicle',identifier:'synthetic-mallet-'+(state==='CA'?1205:1206)}),{job,invoice}=await readyInvoice(h,{asset,reviewer})
   await h.command('storage.open',{...openInput(job,rule),confirm:false},{status:409})
   await h.command('storage.open',{...openInput(job,rule),uncollectedAt:'2026-11-09T12:00:00Z'},{status:409})
   const r=await h.command('storage.open',openInput(job,rule));assert.equal(r.rule.state,state);assert.deepEqual(r.rule.sources.storage,{url:ruleInput(state).storageSource,rule:ruleInput(state).storageRule});assert.equal(r.startsAt,'2026-11-11T12:00:00.000Z');assert.equal(r.rule.legalReview.reference,'synthetic-mallet-1201')
   assert.equal((await h.command('storage.dispose',{jobId:job.id,caseId:r.id,version:r.version,confirm:true,reviewer:'Reviewer',legalReference:'Review',completedSteps:'All',evidence:'Sale'},{status:409})).error,'STORAGE_EARLY')
   const replacement=await h.command('storage.rule',{...ruleInput(state),label:'Synthetic version 2',storageCapCents:1});assert.notEqual(replacement.id,rule.id);assert.equal((await h.state()).records.storageCase.find(x=>x.id===r.id).rule.storageCapCents,15000)
   cases.push({r,job,invoice,rule})
  }
  const active=cases[0].r,payload={jobId:active.jobId,caseId:active.id,version:active.version,throughAt:CLOCK}
  for(const as of [advisor.cookie,member.cookie]){await h.command('flow.collect',{jobId:active.jobId},{as,status:403});await h.command('storage.accrue',payload,{as,status:403});await h.request('/app/jobs/'+active.jobId+'/storage',{as}).then(r=>assert.equal(r.status,403));const view=await h.state({as});assert.equal(view.records.storageCase,undefined);assert.ok(!(view.records.event??[]).some(e=>e.kind.startsWith('storage.')))}
  await h.command('storage.accrue',payload,{as:'',headers:{authorization:'Bearer '+key.token},status:403})
  await h.command('storage.accrue',payload,{as:'',status:401});await h.command('storage.accrue',payload,{headers:{origin:'https://elsewhere.test'},status:403})
  await h.advance('2026-11-11T12:00:00.000Z')
  for(const c of cases){
   c.r=await h.command('storage.accrue',{jobId:c.job.id,caseId:c.r.id,version:c.r.version,throughAt:'2026-11-11T12:00:00Z'});assert.equal(c.r.accruals.at(-1).accruedCents,0)
   await h.command('storage.notice',{...noticeInput(c.r,c.r.recipients[0]),method:'Email'},{status:409})
   for(const recipient of c.r.recipients)c.r=await h.command('storage.notice',noticeInput(c.r,recipient))
   assert.deepEqual(c.r.notices.map(n=>[n.recipient.role,n.recipient.name,n.deliveryEvidence]),[['owner',c.job.asset.customerName,'Synthetic signed delivery receipt '+c.job.asset.customerName],['lienholder','Synthetic Credit Union','Synthetic signed delivery receipt Synthetic Credit Union']])
   assert.equal((await h.command('storage.dispose',{jobId:c.job.id,caseId:c.r.id,version:c.r.version},{status:409})).error,'STORAGE_EARLY')
  }
  await h.advance('2026-11-13T12:00:00.000Z')
  for(const c of cases){c.r=await h.command('storage.accrue',{jobId:c.job.id,caseId:c.r.id,version:c.r.version,throughAt:'2026-11-13T12:00:00Z'});assert.deepEqual(c.r.accruals.at(-1),{days:2,accruedCents:10000,paidCents:0,storageDueCents:10000,repairDueCents:c.invoice.totals.totalCents,lienCents:10000+c.invoice.totals.totalCents,asOf:'2026-11-13T12:00:00.000Z',ruleId:c.rule.id,by:c.r.accruals.at(-1).by,at:'2026-11-13T12:00:00.000Z'})}
  // Both state examples release on recorded payment through documented handover.
  for(const c of cases){
   const input=await handoverInput(h,c.job.id,c.job.asset.customerName);delete input.overrideId
   await h.command('payment.record',{invoiceId:c.invoice.id,version:c.invoice.version,invoiceRevision:c.invoice.revision,amountCents:c.invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-repair-'+c.rule.state,evidence:'Staff counted repair tender'})
   await h.command('flow.collect',{...input,lienWaiverCents:0},{status:409})
   await h.command('storage.payment',{jobId:c.job.id,caseId:c.r.id,version:c.r.version,amountCents:10001,reference:'synthetic-mallet-overpay',evidence:'Must refuse storage overpayment'},{status:409})
   c.r=await h.command('storage.payment',{jobId:c.job.id,caseId:c.r.id,version:c.r.version,amountCents:10000,reference:'synthetic-mallet-storage-'+c.rule.state,evidence:'Staff counted storage tender'})
   const collected=await h.command('flow.collect',{...input,lienWaiverCents:0}),receipt=(await h.state()).records.handover.find(r=>r.id===collected.collection.handoverId);assert.equal(receipt.storage.balance.accruedCents,10000);assert.equal(receipt.storage.waivedCents,0);assert.equal((await h.state({as:advisor.cookie})).records.handover.find(r=>r.id===receipt.id).storage,undefined,'Legal storage history stays private to the owner');assert.equal((await h.state()).records.storageCase.find(r=>r.id===c.r.id).closed?.kind,'release','Documented handover must close storage custody and end accrual')
  }
  // A separate case proves completed disposal and immutable history, not only refusals.
  const extraAsset=await h.command('asset.create',{customerName:'Synthetic disposed',label:'Disposal vehicle',identifier:'synthetic-mallet-1207'}),extra=await readyInvoice(h,{asset:extraAsset,reviewer}),rule=await h.command('storage.rule',ruleInput()),openedAt='2026-11-13T12:00:00.000Z'
  let disposed=await h.command('storage.open',{...openInput(extra.job,rule),uncollectedAt:openedAt})
  for(const recipient of disposed.recipients)disposed=await h.command('storage.notice',noticeInput(disposed,recipient,openedAt))
  await h.advance('2026-11-17T12:00:00.000Z');advisor.cookie=await h.signInAs('storage-advisor@example.test')
  const dispose={jobId:extra.job.id,caseId:disposed.id,version:disposed.version,confirm:true,reviewer:'Synthetic disposition lawyer',legalReference:'synthetic-mallet-1208',completedSteps:'Reviewed title, all recipients, notices, delivery, clocks and no objection or stay',evidence:'Synthetic physical disposition record'}
  await h.command('storage.dispose',{...dispose,reviewer:''},{status:400})
  await h.command('storage.dispose',dispose,{as:advisor.cookie,status:403})
  disposed=await h.command('storage.dispose',dispose);assert.equal(disposed.closed.kind,'disposal');assert.equal(disposed.closed.review.reference,'synthetic-mallet-1208');assert.equal(disposed.notices.length,2);assert.equal(disposed.closed.balance.accruedCents,15000)
  await h.command('storage.payment',{jobId:extra.job.id,caseId:disposed.id,version:disposed.version,amountCents:1,reference:'synthetic-mallet-1210',evidence:'Late'},{status:409})
  // A release with an unpaid balance records the exact waived lien and stops accrual.
  const waiverAsset=await h.command('asset.create',{customerName:'Synthetic waiver',label:'Waived lien vehicle',identifier:'synthetic-mallet-1211'}),waiverRepair=await readyInvoice(h,{asset:waiverAsset,reviewer}),waiverRule=await h.command('storage.rule',ruleInput('TX'))
  const waiverCase=await h.command('storage.open',{...openInput(waiverRepair.job,waiverRule),uncollectedAt:'2026-11-17T12:00:00.000Z'}),waiverPickup=await handoverInput(h,waiverRepair.job.id,waiverAsset.customerName)
  await h.command('flow.collect',{...waiverPickup,lienWaiverCents:1,lienWaiverReason:'Incorrect amount'},{status:409})
  await h.command('flow.collect',{...waiverPickup,lienWaiverCents:waiverRepair.invoice.totals.totalCents,lienWaiverReason:'Owner reviewed possessory lien consequences and explicitly waives the remaining repair lien'})
  const waived=(await h.state()).records.storageCase.find(r=>r.id===waiverCase.id);assert.equal(waived.closed.waivedCents,waiverRepair.invoice.totals.totalCents);assert.match(waived.closed.waiverReason,/explicitly waives/)
  // A device case remains open across restore; historical authority must not revive.
  const deviceAsset=await h.command('asset.create',{customerName:'Synthetic device owner',label:'Uncollected diagnostic tablet',identifier:'synthetic-mallet-1212',assetType:'device'}),deviceRepair=await readyInvoice(h,{asset:deviceAsset,reviewer}),deviceRule=await h.command('storage.rule',{...ruleInput('TX'),assetKind:'device'})
  let device=await h.command('storage.open',{...openInput(deviceRepair.job,deviceRule),uncollectedAt:'2026-11-17T12:00:00.000Z'})
  const ownerNotice=noticeInput(device,device.recipients[0],'2026-11-17T12:00:00.000Z');device=await h.command('storage.notice',ownerNotice)
  await h.command('storage.notice',{...ownerNotice,version:device.version},{status:409})
  assert.equal(device.rule.assetKind,'device');assert.equal(device.notices[0].recipient.role,'owner')
  const state=await h.state();for(const c of cases){const r=state.records.storageCase.find(r=>r.id===c.r.id);assert.equal(r.closed.kind,'release');assert.equal(r.closed.balance.accruedCents,10000)}
  // Exact public archive recovery retains business history and no source-owner authority.
  const image=await archive(h),corrupt=structuredClone(image),manifest=corrupt[0],parts=[],content=new ContentVerifier(manifest),integrity=new ArchiveVerifier(manifest)
  for(const original of corrupt.filter(r=>r.kind==='part')){
   for(const item of original.items)if(item.kind==='row'&&item.table==='mallet_records'&&item.row.kind==='storageCase'&&item.row.id===disposed.id){const value=JSON.parse(item.row.value);value.closed.balance.accruedCents=-1;item.row.value=JSON.stringify(value)}
   const part=await makePart(original.index,original.items);parts.push(part);integrity.add(part);for(const item of part.items)content.add(item)
  }
  const invalid=await installation({entry:'tests/storage-worker.ts',bindings:{TEST_STORAGE_CLOCK:'2026-11-17T12:00:00.000Z'}})
  try{await restore(invalid,[manifest,...parts,{kind:'closing',partCount:parts.length,contentHash:content.digest(),archiveHash:integrity.digest()}],{status:409});assert.equal((await invalid.state()).records.storageCase?.length??0,0,'Invalid storage history cannot publish a custody record');assert.equal((await invalid.state()).records.job?.length??0,0,'Invalid storage history cannot publish repairs')}finally{await invalid.close()}
  const destination=await installation({entry:'tests/storage-worker.ts',bindings:{TEST_STORAGE_CLOCK:'2026-11-17T12:00:00.000Z'}})
  try{await restore(destination,image);const after=await destination.state();assert.deepEqual(after.records.storageCase,state.records.storageCase);assert.deepEqual(after.records.storageRule,state.records.storageRule);assert.notEqual(after.actor.id,state.actor.id)
   await destination.command('storage.notice',noticeInput(device,device.recipients[1],'2026-11-17T12:00:00.000Z'),{status:409}).then(r=>assert.equal(r.error,'STORAGE_REVIEW'))
   await destination.command('storage.review',{jobId:device.jobId,caseId:device.id,version:device.version,ruleId:deviceRule.id,reviewer:'Destination lawyer',legalReference:'synthetic-mallet-1213',confirm:true},{status:409})
   const freshRule=await destination.command('storage.rule',{...ruleInput('TX'),assetKind:'device',label:'Destination legal review'})
   device=await destination.command('storage.review',{jobId:device.jobId,caseId:device.id,version:device.version,ruleId:freshRule.id,reviewer:'Destination lawyer',legalReference:'synthetic-mallet-1213',confirm:true})
   device=await destination.command('storage.notice',noticeInput(device,device.recipients[1],'2026-11-17T12:00:00.000Z'));assert.equal(device.notices.length,2);assert.equal(device.reviews.length,2);assert.deepEqual(device.reviews.map(r=>r.ruleId),[deviceRule.id,freshRule.id])
   const audit=await destination.api('/api/mallet/audit?action=storage.review');assert.equal(audit.entries.length,1);assert.equal(audit.entries[0].actor.id,after.actor.id)
}finally{await destination.close()}
 }finally{await h.close();t.mock.timers.reset()}
}
