import assert from 'node:assert/strict'
import {installation,booking,estimate,assetInput,archive,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'

/** Real public reminder/jobs doors; only the mail provider is faked by installation(). */
export async function jobsJourney(){
 let reject=false
 const h=await installation({mailService:async()=>reject?Response.json({message:'Rejected fixture recipient'},{status:422}):Response.json({id:crypto.randomUUID()})})
 try{
  await shopSetup(h)
  const tech=await h.person('jobs-tech@example.test'),admin=await h.person('jobs-advisor@example.test','admin')
  const prepare=async(suffix)=>{
   const asset=await h.command('asset.create',assetInput('jobs-'+suffix))
   const {job}=await booking(h,{asset,technicianId:tech.id,startAt:`2026-11-${suffix}T09:00:00Z`,endAt:`2026-11-${suffix}T10:00:00Z`})
   let q=await estimate(h,job);q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
   const link=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:1})
   return {link,due:Date.parse(link.createdAt)+2*86400000+60000}
  }
  await h.api('/api/mallet/jobs',undefined,{as:tech.cookie,status:403})
  await h.api('/api/mallet/jobs',undefined,{as:admin.cookie,status:403})
  const first=await prepare('11')
  const pendingArchive=await archive(h)
  const fresh=await installation({bindings:{OWNER_EMAIL:'jobs-recovery@example.test'}})
  try{await restore(fresh,pendingArchive);await fresh.cron(first.due);assert.equal(fresh.messages.filter(m=>m.subject.startsWith('Reminder')).length,0,'An archive cannot recreate excluded customer-link authority');assert.equal((await fresh.api('/api/mallet/jobs')).jobs.find(j=>j.payload.linkId===first.link.id&&j.payload.step===1).outcome.status,'skipped')}finally{await fresh.close()}
  // Recreating the actual isolate with identical options retains the persisted installation.
  await h.restart()
  await h.cron(first.due)
  await h.cron(first.due+60000)
  const diagnostics=await h.api('/api/mallet/jobs'),done=diagnostics.jobs.find(j=>j.payload.linkId===first.link.id&&j.payload.step===1)
  assert.ok(done,'Due reminder is retained as a durable business job')
  assert.equal(done.status,'succeeded')
  assert.equal(h.messages.filter(m=>m.subject.startsWith('Reminder')).length,1)
  assert.equal(done.lease_token,undefined)
  const second=await prepare('12');reject=true
  await h.cron(second.due)
  const failed=(await h.api('/api/mallet/jobs')).jobs.find(j=>j.payload.linkId===second.link.id&&j.payload.step===1)
  assert.equal(failed.status,'failed')
  reject=false
  await h.cron(second.due+60000)
  assert.equal(h.messages.filter(m=>m.subject.startsWith('Reminder')).length,2,'Failed reminder never retries automatically')
  await h.api('/api/mallet/jobs/recover',{id:failed.id,action:'replay',reason:'Try again'},{status:409})
  await h.api('/api/mallet/jobs/recover',{id:failed.id,action:'resolve',reason:'Advisor inspected provider failure; will contact customer separately'})
  const final=await h.api('/api/mallet/jobs')
  assert.equal(final.jobs.find(j=>j.id===failed.id).status,'resolved')
  assert.equal(final.recoveries.filter(r=>r.job_id===failed.id).length,1)
 }finally{await h.close()}
}
