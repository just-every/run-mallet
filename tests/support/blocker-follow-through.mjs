import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'

const at=hours=>new Date(Date.now()+hours*3600000).toISOString()
const state=h=>h.state()
const record=async(h,kind,id)=>(await state(h)).records[kind].find(r=>r.id===id)
const view=(h,job)=>h.api(`/api/mallet/repairs/${job.id}/blockers`)
const sweep=async(h,job)=>{await h.cron(new Date().toISOString());const v=await view(h,job);assert.equal(v.stale,false);assert.deepEqual(v.packet.revisions.at(-1).nextAction,v.current.nextAction);return v}

/** One continued repair journey: the worker observes; native people decide and perform. */
export async function blockerFollowThrough(h,f,agent){
 const {evidence,consent,other,member}=f
 // A new actual quote becomes the next prepared review without a manual packet refresh.
 let job=await record(h,'job',evidence.job.id)
 let quote=await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'labor',description:'Inspect the reported bearing noise',quantity:.5,unitCents:12000}]})
 let v=await sweep(h,job),action=v.current.nextAction
 assert.equal(action.command,'estimate.approve');assert.equal(action.input.estimateId,quote.id);assert.equal(action.input.revision,1)
 const beforeDecision=(await state(h)).records,mailBefore=h.messages.length
 await h.command(action.command,action.input,{...agent,status:403})
 await h.command('blocker.sweep',{activePeople:[{id:member.id,role:'owner'}]},{status:404})
 assert.deepEqual((await state(h)).records,beforeDecision,'The public door cannot invoke the internal observer or approve with a bearer')
 assert.equal(h.messages.length,mailBefore,'Background review preparation never sends')
 quote=await h.command(action.command,action.input)
 v=await sweep(h,job);action=v.current.nextAction
 assert.equal(action.command,'approvalLink.create');assert.equal(v.tasks.find(t=>t.source.id===quote.id).resolution,null)
 const link=await h.command(action.command,{...action.input,days:1})
 assert.equal(link.delivery.status,'accepted');assert.equal(h.messages.length,mailBefore+1)
 v=await sweep(h,job);assert.ok(v.current.blockers.some(b=>b.source.id===quote.id),'Mail handoff is not consent')
 const input={typedName:evidence.asset.customerName,consent:'yes',...Object.fromEntries(quote.revisions[0].lines.map(l=>['line-'+l.id,'approve']))}
 const send=()=>h.mf.dispatchFetch(link.url,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(input).toString()})
 assert.equal((await send()).status,200)
 v=await sweep(h,job)
 assert.ok(!v.current.blockers.some(b=>b.source.id===quote.id));assert.ok(v.tasks.find(t=>t.source.id===quote.id).resolution)
 const decided=(await state(h)).records
 assert.equal((await send()).status,200)
 await h.cron(new Date().toISOString())
 assert.deepEqual((await state(h)).records,decided,'Replayed customer capture and repeated background observation create no duplicate effect')
 // Current promise review cites the actual promise and never applies the recommendation.
 job=await record(h,'job',consent.job.id)
 const original=await h.command('promise.set',{jobId:job.id,version:job.version,pickupAt:at(1),reason:'Customer agreed early collection; capacity needs advisor review'})
 v=await sweep(h,job);assert.equal(v.current.promiseAction.command,'promise.propose');assert.equal(v.current.promiseAction.source.id,original.id)
 assert.equal(v.current.progress.promiseAt,original.revisions[0].pickupAt)
 let proposal=await h.command('promise.propose',{...v.current.promiseAction.input,pickupAt:at(24),reason:'Advisor reviewed the remaining authorized work and current capacity'})
 assert.equal((await record(h,'promise',original.id)).version,original.version,'Preparation never changes a pickup promise')
 let asset=await record(h,'asset',consent.asset.id)
 await h.command('asset.update',{...asset,assetId:asset.id,customerEmail:'revised-'+asset.customerEmail})
 const beforeStale=h.messages.length
 await h.command('promise.approveAndNotify',{proposalId:proposal.id,proposalVersion:proposal.version},{status:409})
 assert.equal(h.messages.length,beforeStale,'Changed recipient is fenced before promise approval or sending')
 v=await sweep(h,job)
 proposal=await h.command('promise.propose',{...v.current.promiseAction.input,pickupAt:at(24),reason:'Advisor reviewed the updated recipient and exact revised pickup'})
 const approval={proposalId:proposal.id,proposalVersion:proposal.version}
 const beforeDenied=(await state(h)).records
 await h.command('promise.approveAndNotify',approval,{...agent,status:403})
 await h.command('promise.approveAndNotify',approval,{as:member.cookie,status:403})
 assert.deepEqual((await state(h)).records,beforeDenied)
 const notice=await h.command('promise.approveAndNotify',approval,{as:other.cookie})
 assert.equal(notice.outcome.status,'accepted');assert.equal(notice.approvedBy.id,other.id)
 assert.equal(notice.to,'revised-'+asset.customerEmail)
 const sent=h.messages.length
 await h.command('promise.approveAndNotify',approval,{status:409})
 v=await sweep(h,job);assert.equal(h.messages.length,sent)
 assert.equal(v.current.progress.promiseAt,proposal.pickupAt);assert.equal(v.current.promiseAction,null)
 // Receiving or clearing consent never supplies actuals. Follow each remaining exact line.
 let work=await sweep(h,job)
 assert.equal(work.current.nextAction.command,'work.record')
 while(work.current.nextAction?.command==='work.record'){
  const a=work.current.nextAction,current=await record(h,'job',job.id)
  assert.equal(a.input.version,current.version)
  await h.command(a.command,{...a.input,quantity:a.remainingQuantity,note:'Technician performed this exact remaining authorized line'})
  work=await sweep(h,job)
 }
 assert.equal(work.current.nextAction.command,'quality.configure')
 job=await record(h,'job',job.id)
 await h.command('job.complete',{jobId:job.id,version:job.version},{status:409})
 let quality=await h.command('quality.configure',{...work.current.nextAction.input,reason:'Actual work needs both current quality signatures',items:[{label:'Pre-work condition',stage:'pre',required:true,critical:false},{label:'Post-work function',stage:'post',required:true,critical:true}]})
 work=await sweep(h,job);assert.equal(work.current.nextAction.command,'quality.record')
 for(const item of quality.revisions.at(-1).items)quality=await h.command('quality.record',{jobId:job.id,version:job.version,qualityVersion:quality.version,itemId:item.id,outcome:'pass',note:'Assigned technician performed the physical check'})
 work=await sweep(h,job);assert.equal(work.current.nextAction.command,'quality.signTechnician')
 quality=await h.command('quality.signTechnician',{...work.current.nextAction.input,qualification:'Assigned repair technician',note:'Checked current work and results'})
 work=await sweep(h,job);assert.equal(work.current.nextAction.command,'quality.signQuality')
 await h.command('job.complete',{jobId:job.id,version:job.version},{status:409})
 quality=await h.command('quality.signQuality',{...work.current.nextAction.input,qualification:'Independent qualified reviewer',note:'Independently checked current repair',safetyDecision:'safe'},{as:other.cookie})
 work=await sweep(h,job);assert.equal(work.current.nextAction.command,'job.complete')
 assert.equal((await record(h,'job',job.id)).status,'working','Even fully signed quality never infers completion')
 await h.command('job.complete',work.current.nextAction.input)
 work=await sweep(h,job);assert.equal(work.current.nextAction,null);assert.equal(work.current.progress.status,'completed')
 // New automated attribution and prepared steps recover with exact product history, no credentials.
 const backup=await archive(h),fresh=await installation()
 try{
  await restore(fresh,backup)
  const recovered=(await fresh.state()).records,original=(await h.state()).records
  for(const kind of ['repairBlockerPacket','repairBlockerTask','promise','promiseNotice'])assert.deepEqual(recovered[kind],original[kind])
 }finally{await fresh.close()}
}
