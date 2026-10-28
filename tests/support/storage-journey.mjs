import assert from 'node:assert/strict'
import {archive,restore,installation} from '../harness.mjs'
import {readyInvoice} from './return-journey.mjs'
import {handoverInput} from './handover-input.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
export const ruleInput=state=>({state,scope:'vehicle',dailyCents:1500,capCents:3000,graceHours:24,noticeDays:10,waitDays:30,method:'Certified mail with return receipt to every reviewed recipient',basis:'Synthetic reviewed agreement and eligible unpaid repair principal. Not a statement of statutory values.',review:'synthetic-mallet-1200: counsel review of state and property applicability'})
export const openInput=(job,rule)=>({jobId:job.id,version:job.version,ruleId:rule.id,notifiedAt:'2000-01-01T12:00:00Z',repairCents:1000,evidence:'synthetic-mallet-1201: exact ready notice and agreed storage terms',recipients:'Owner at recorded address and lienholder at title-search address; synthetic-mallet-1202'})
export async function storageJourney(h){
 await shopSetup(h)
 const advisor=await h.person('storage-advisor@example.test','admin'),member=await h.person('storage-technician@example.test'),key=await h.command('agent.create',{label:'No legal authority'})
 for(const options of [{as:'',status:401},{as:advisor.cookie,status:403},{as:member.cookie,status:403},{as:'',headers:{authorization:'Bearer '+key.token},status:403},{headers:{origin:'https://other.test'},status:403}])await h.command('storage.rule',ruleInput('CA'),options)
 const cases=[]
 for(const state of ['CA','TX']){
  const asset=await h.command('asset.create',{customerName:'Storage '+state,label:'Storage vehicle',identifier:'synthetic-mallet-storage-'+state}),{job,invoice}=await readyInvoice(h,{asset}),rule=await h.command('storage.rule',ruleInput(state))
  const original=await h.command('storage.open',openInput(job,rule));assert.equal(original.startsAt,'2000-01-02T12:00:00.000Z');assert.equal(original.noticeDueAt,'2000-01-12T12:00:00.000Z')
  const nextRule=await h.command('storage.rule',{...ruleInput(state),dailyCents:0});assert.notEqual(nextRule.id,rule.id)
  let r=(await h.state()).records.storageCase.find(r=>r.id===original.id);assert.equal(r.rule.dailyCents,1500,'A new rule cannot rewrite an existing repair')
  const base={jobId:job.id,version:job.version,caseVersion:r.version}
  await h.command('storage.dispose',base,{status:409})
  r=await h.command('storage.notice',{...base,deliveredAt:'2000-01-03T12:00:00Z',evidence:'synthetic-mallet-1203: exact notice and signed delivery receipts for both recipients'})
  assert.equal(r.notices.length,1);assert.equal(r.notices[0].late,false);assert.equal(r.notices[0].eligibleAt,'2000-02-02T12:00:00.000Z');assert.equal(r.notices[0].recipients,original.recipients)
  await h.command('storage.dispose',{...base,caseVersion:r.version},{status:409})
  await h.command('storage.notice',{...base,caseVersion:r.version,deliveredAt:'2000-01-04T12:00:00Z',evidence:'Advisor cannot record legal notice'},{as:advisor.cookie,status:403})
  await h.command('storage.review',{...base,evidence:'Stale review'},{status:409})
  r=await h.command('storage.review',{...base,caseVersion:r.version,evidence:'synthetic-mallet-1204: case counsel reviewed every statutory step and evidence'})
  const blocked=await h.command('storage.dispose',{...base,caseVersion:r.version},{status:409});assert.equal(blocked.error,'LEGAL_POLICY_PENDING')
  const pickup=await handoverInput(h,job.id,job.asset.customerName);delete pickup.overrideId
  await h.command('flow.collect',pickup,{status:409});assert.equal((await h.state()).records.storageCase.find(c=>c.id===r.id).release,null)
  await h.command('payment.record',{jobId:job.id,invoiceId:invoice.id,version:invoice.version,invoiceRevision:invoice.revision,method:'cash',amountCents:invoice.totals.totalCents,reference:'synthetic-mallet-'+state,evidence:'Cash counted for this exact repair invoice'})
  const released=await h.command('flow.collect',pickup),saved=(await h.state()).records.storageCase.find(c=>c.id===r.id),receipt=(await h.state()).records.handover.find(v=>v.id===released.collection.handoverId)
  assert.equal(saved.release.balance.storageCents,3000);assert.equal(saved.release.balance.lienCents,3000);assert.equal(saved.release.lienWaivedCents,3000);assert.equal(saved.release.handoverId,receipt.id);assert.deepEqual(receipt.storageRelease,saved.release)
  await h.command('storage.notice',{...base,caseVersion:saved.version,deliveredAt:'2000-01-04T12:00:00Z',evidence:'Cannot change released property'},{status:409})
  cases.push(saved)
 }
 const privateState=await h.state({as:advisor.cookie});assert.deepEqual(privateState.records.storageCase,[]);assert.deepEqual(privateState.records.storageRule,[]);assert.ok(!privateState.records.event.some(e=>e.kind.startsWith('storage.')))
 const lines=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'storage-recovery@example.test'}})
 try{await restore(fresh,lines);assert.deepEqual((await fresh.state()).records.storageCase.sort((a,b)=>a.id.localeCompare(b.id)),cases.sort((a,b)=>a.id.localeCompare(b.id)));await fresh.state({as:h.owner,status:401})}finally{await fresh.close()}
}
