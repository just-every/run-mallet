import assert from 'node:assert/strict'
import {archive,authorise,booking,estimate,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'

export const future=hours=>new Date(Date.now()+hours*3_600_000).toISOString()
export const promiseForm=(h,command,input={},as=h.owner)=>h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:as,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({command,...input}).toString()})
const localTime=(at,zone)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(at))
const records=async(h,kind)=>(await h.state()).records[kind]??[]
export async function promiseFixture(h,{person=h.person}={}){
 await shopSetup(h)
 const tech=await person('jules-promise@example.test'),advisor=await person('casey-promise@example.test','admin'),other=await person('lee-promise@example.test'),T={as:tech.cookie},ADV={as:advisor.cookie}
 const {asset,job}=await booking(h,{technicianId:tech.id,startAt:future(2),endAt:future(3)})
 const quote=await authorise(h,await estimate(h,job)),current=async()=>(await records(h,'job')).find(j=>j.id===job.id)
 const source=(await booking(h,{asset:(await records(h,'asset')).find(a=>a.id===asset.id),technicianId:tech.id,bayId:'Shared lift',startAt:future(0.5),endAt:future(1.5)})).job
 return {tech,advisor,other,T,ADV,asset,job,quote,source,current}
}
// FLOW-002: promise versus booking, physical part dependency, authorized remaining work, advisor decision, one honest mail receipt, OPS-001.
export async function promiseJourney(h){
 const f=await promiseFixture(h),{tech,advisor,other,T,ADV,asset,job,quote,source,current}=f,pickupAt=future(6)
 const offsetPickup=new Date(Date.parse(pickupAt)-5*3_600_000).toISOString().replace('Z','-05:00')
 const original=await h.command('promise.set',{jobId:job.id,version:(await current()).version,pickupAt:offsetPickup,reason:'Customer agreed pickup after the afternoon repair'},ADV)
 assert.equal(original.revisions[0].pickupAt,pickupAt)
 assert.equal(original.revisions[0].approvedBy.id,advisor.id)
 assert.equal((await current()).endAt,job.endAt,'FLOW-002 setting the pickup promise does not move the bay booking')
 assert.equal((await records(h,'promiseNotice')).length,0,'FLOW-002 original recording never invents a customer send')
 const input={jobId:job.id,version:(await current()).version,planVersion:0,partId:'PADS-SET',name:'Front brake pads',eta:future(4),sourceNote:'Pat at parts counter quoted the expected truck; staff report',reason:'Required for the authorized brake repair'}
 let plan=await h.command('promise.partETA',input,T)
 const firstPlan=structuredClone(plan.revisions[0]),later=future(8)
 plan=await h.command('promise.partETA',{...input,planVersion:plan.version,eta:later,reason:'Truck delayed beyond the promised pickup',supplierConfirmed:true},T)
 assert.deepEqual(plan.revisions[0],firstPlan,'FLOW-002 updating ETA retains its original source and date')
 assert.equal(plan.revisions.at(-1).parts[0].source,'staff-reported; not supplier-confirmed')
 assert.equal(plan.revisions.at(-1).parts[0].receivedAt,null,'FLOW-002 expected arrival never records physical receipt')
 plan=await h.command('promise.dependency',{jobId:job.id,version:(await current()).version,planVersion:plan.version,dependencyJobId:source.id,resource:'both',reason:'Lift and assigned technician must finish the preceding repair'},ADV)
 await h.command('promise.dependency',{jobId:source.id,version:source.version,planVersion:0,dependencyJobId:job.id,resource:'bay',reason:'Would create a circular resource plan'},{status:409})
 await h.command('work.record',{jobId:job.id,version:(await current()).version,lineId:quote.revisions[0].lines[1].id,quantity:0.5,note:'First half hour performed'},T)
 const page=await (await h.request('/app/jobs/'+job.id)).text(),fullPlan=await (await h.request('/app/jobs')).text()
 for(const value of ['Pickup promise at risk','Customer-authorized sold labor: 1.5 hours','Performed labor: 0.5 hours','Labor remaining: 1 hours','Front brake pads','Truck delayed','staff-reported; not supplier-confirmed','Shared lift'])assert.ok((page+fullPlan).includes(value),'FLOW-002 capacity and early warning show '+value)
 assert.ok(page.includes('resource dependencies')||page.includes('Resource dependencies'))
 assert.match(fullPlan,/Shared lift/,'FLOW-002 advisors inspect the affected bay and technician plan')
 assert.match(await (await h.request('/app/jobs/'+job.id,T)).text(),/Front brake pads/,'FLOW-002 assigned technician sees operational promise plan')
 assert.equal((await h.request('/app/jobs/'+job.id,{as:other.cookie})).status,404)
 for(const command of ['promise.set','promise.propose','promise.approveAndNotify'])await h.command(command,{jobId:job.id,version:(await current()).version,pickupAt:future(10),reason:'Not advisor approved'},{...T,status:403})
 await h.command('promise.partETA',{...input,version:(await current()).version,planVersion:plan.version},{as:other.cookie,status:403})
 const key=await h.command('agent.create',{label:'Promise boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 for(const command of ['promise.set','promise.partETA','promise.dependency','promise.propose','promise.approveAndNotify'])await h.command(command,input,{...agent,status:403})
 const agentState=await h.state(agent);for(const kind of ['promise','promisePlan','promiseRevision','promiseNotice'])assert.equal(agentState.records[kind],undefined)
 assert.ok(!agentState.records.event.some(e=>e.kind.startsWith('promise.')))
 await h.command('promise.approve',{proposalId:'forged',proposalVersion:1},{status:404});await h.command('promise.noticeOutcome',{noticeId:'forged',version:1,status:'accepted',provider:'forged'},{status:404})
 await h.command('promise.set',input,{as:'',status:401})
 const beforeOrigin=(await h.state()).records
 await h.command('promise.partETA',{...input,version:(await current()).version,planVersion:plan.version},{headers:{origin:'https://outside.example'},status:403})
 assert.deepEqual((await h.state()).records,beforeOrigin,'FLOW-002 cross-origin refusal writes nothing')
 const propose=async()=>h.command('promise.propose',{jobId:job.id,version:(await current()).version,promiseVersion:(await records(h,'promise')).find(p=>p.id===original.id).version,planVersion:(await records(h,'promisePlan')).find(p=>p.jobId===job.id).version,pickupAt:future(12),reason:'Parts truck delayed; advisor has reviewed the resource plan'},ADV)
 const stale=await propose(),mailBefore=h.messages.length
 plan=await h.command('promise.partETA',{...input,version:(await current()).version,planVersion:plan.version,eta:future(9),reason:'Second dispatch update before approval'},T)
 await h.command('promise.approveAndNotify',{proposalId:stale.id,proposalVersion:stale.version},{...ADV,status:409})
 assert.equal(h.messages.length,mailBefore,'FLOW-002 changing a part ETA invalidates approval before any email')
 const dependencyStale=await propose()
 await h.command('promise.partETA',{jobId:source.id,version:source.version,planVersion:0,partId:'PRIOR',name:'Preceding repair part',eta:future(3),sourceNote:'Parts desk report',reason:'Preceding resource repair is delayed'},T)
 await h.command('promise.approveAndNotify',{proposalId:dependencyStale.id,proposalVersion:dependencyStale.version},{...ADV,status:409})
 assert.equal(h.messages.length,mailBefore,'FLOW-002 resource dependency ETA changes invalidate the reviewed revision')
 const recipientStale=await propose(),a=(await records(h,'asset')).find(a=>a.id===asset.id)
 await h.command('asset.update',{assetId:a.id,version:a.version,customerName:a.customerName,customerEmail:'new-recipient@example.test',identifier:a.identifier,label:a.label})
 await h.command('promise.approveAndNotify',{proposalId:recipientStale.id,proposalVersion:recipientStale.version},{...ADV,status:409})
 const workStale=await propose()
 await h.command('work.record',{jobId:job.id,version:(await current()).version,lineId:quote.revisions[0].lines[1].id,quantity:0.25,note:'Additional authorized labor changes the reviewed remaining work'},T)
 await h.command('promise.approveAndNotify',{proposalId:workStale.id,proposalVersion:workStale.version},{...ADV,status:409})
 assert.equal(h.messages.length,mailBefore,'FLOW-002 performed work changing the reviewed job refuses a stale notice')
 const pendingSupplement=await h.command('estimate.prepare',{jobId:job.id,version:(await current()).version,supplement:true,reason:'Extra authorized work changes the remaining labor plan',lines:[{kind:'labor',description:'Adjust parking brake',quantity:1,unitCents:12000}]})
 const scopeStale=await propose();await authorise(h,pendingSupplement)
 await h.command('promise.approveAndNotify',{proposalId:scopeStale.id,proposalVersion:scopeStale.version},{...ADV,status:409})
 assert.equal(h.messages.length,mailBefore,'FLOW-002 newly authorized supplemental labor requires another plan review before email')
 const zoneStale=await propose();await h.command('promise.timeZone',{timeZone:'America/Chicago',settingsVersion:0,reason:'Our shop is in Illinois'},ADV);await h.command('promise.approveAndNotify',{proposalId:zoneStale.id,proposalVersion:zoneStale.version},{...ADV,status:409});assert.equal(h.messages.length,mailBefore,'FLOW-002 changing the shop zone requires fresh notice review');
 const proposed=await propose(),notice=await h.command('promise.approveAndNotify',{proposalId:proposed.id,proposalVersion:proposed.version},ADV)
 assert.equal(notice.outcome.status,'accepted');assert.equal(notice.oldPickupAt,pickupAt);assert.equal(notice.newPickupAt,proposed.pickupAt);assert.equal(notice.to,'new-recipient@example.test')
 const message=h.messages.at(-1);assert.equal(notice.timeZone,'America/Chicago');assert.ok(message.text.includes(localTime(pickupAt,notice.timeZone))&&message.text.includes(localTime(proposed.pickupAt,notice.timeZone)),'FLOW-002 actual provider message contains exact old/new shop-local promises');assert.ok(message.text.includes('(America/Chicago)'),'FLOW-002 customer mail names the installation zone');assert.ok(JSON.stringify(message.to).includes(notice.to))
 const afterApproved=await h.state();assert.equal(afterApproved.records.promise.find(p=>p.id===original.id).revisions.length,2);assert.deepEqual(afterApproved.records.promise.find(p=>p.id===original.id).revisions[0],original.revisions[0])
 assert.equal((await current()).endAt,job.endAt,'FLOW-002 approving a revised pickup never silently moves capacity')
 await h.command('promise.approveAndNotify',{proposalId:proposed.id,proposalVersion:proposed.version},{...ADV,status:409})
 assert.equal(h.messages.length,mailBefore+1,'FLOW-002 one revision can claim exactly one email')
 assert.match(await (await h.request('/app/jobs/'+job.id)).text(),/Handed to the mail provider; delivery is not confirmed/)
 // Native forms use the same command, version and provider paths, with exact timezone normalization.
 const nativeOriginal=await promiseForm(h,'promise.set',{jobId:source.id,version:source.version,pickupAt:future(5),reason:'Original counter pickup'},advisor.cookie);assert.equal(nativeOriginal.status,303)
 let sourcePromise=(await records(h,'promise')).find(p=>p.jobId===source.id),sourcePlan=(await records(h,'promisePlan')).find(p=>p.jobId===source.id)
 let native=await promiseForm(h,'promise.propose',{jobId:source.id,version:source.version,promiseVersion:sourcePromise.version,planVersion:sourcePlan.version,pickupAt:future(7),reason:'Advisor counter review of the delayed prior part'},advisor.cookie);assert.equal(native.status,303)
 const nativeProposal=(await records(h,'promiseRevision')).findLast(p=>p.jobId===source.id)
 native=await promiseForm(h,'promise.approveAndNotify',{jobId:source.id,proposalId:nativeProposal.id,proposalVersion:nativeProposal.version},advisor.cookie);assert.equal(native.status,303)
 assert.equal((await records(h,'promiseNotice')).find(n=>n.jobId===source.id).outcome.status,'accepted')
 // Customer notices preserve the configured zone's winter/summer offset, not the browser or server zone.
 const nextYear=new Date().getUTCFullYear()+1,winter=`${nextYear}-01-15T17:00:00.000Z`,summer=`${nextYear}-07-15T17:00:00.000Z`
 let zone=(await records(h,'promiseSettings'))[0];await h.command('promise.timeZone',{timeZone:'America/New_York',settingsVersion:zone.version,reason:'Check the shop customer daylight-saving display'},ADV)
 const seasonalJob=(await booking(h,{asset:(await records(h,'asset')).find(a=>a.id===asset.id),technicianId:other.id,bayId:'Seasonal bay',startAt:future(30),endAt:future(31)})).job
 const seasonalPromise=await h.command('promise.set',{jobId:seasonalJob.id,version:seasonalJob.version,pickupAt:winter,reason:'Winter pickup agreement'},ADV)
 const seasonalProposal=await h.command('promise.propose',{jobId:seasonalJob.id,version:seasonalJob.version,promiseVersion:seasonalPromise.version,planVersion:0,pickupAt:summer,reason:'Customer changed the service season'},ADV)
 const seasonalNotice=await h.command('promise.approveAndNotify',{proposalId:seasonalProposal.id,proposalVersion:seasonalProposal.version},ADV)
 assert.equal(seasonalNotice.timeZone,'America/New_York');assert.match(h.messages.at(-1).text,/12:00 PM EST[\s\S]*1:00 PM EDT/,'FLOW-002 one customer notice honors both winter and summer shop offsets')
 await h.command('promise.timeZone',{timeZone:'America/Invalid',settingsVersion:(await records(h,'promiseSettings'))[0].version,reason:'Invalid zone'},{...ADV,status:400})
 await h.command('promise.timeZone',{timeZone:'America/Denver',settingsVersion:0,reason:'Technician cannot change customer zone'},{...T,status:403})
 // Overdue is computed on read, independently of background jobs or a retained earlier warning.
 const dueAsset=await h.command('asset.create',{customerName:'Pickup clock',customerEmail:'clock@example.test',label:'Clock vehicle',identifier:'PROMISE-CLOCK'})
 const dueJob=(await booking(h,{asset:dueAsset,technicianId:other.id,bayId:'Pickup clock bay',startAt:future(20),endAt:future(21)})).job
 await h.command('promise.set',{jobId:dueJob.id,version:dueJob.version,pickupAt:new Date(Date.now()+1000).toISOString(),reason:'Observe the real pickup deadline'},ADV)
 await new Promise(resolve=>setTimeout(resolve,1100))
 assert.match(await (await h.request('/app/jobs/'+dueJob.id)).text(),/Overdue pickup promise/)
 // A missed ETA is unresolved until staff record physical receipt, even with a later pickup promise.
 plan=(await records(h,'promisePlan')).find(p=>p.jobId===job.id)
 const overduePart={...input,version:(await current()).version,planVersion:plan.version,partId:'CLIP',name:'Brake retaining clip',eta:future(-1),sourceNote:'The promised morning truck did not arrive',reason:'Check the overdue required part'}
 plan=await h.command('promise.partETA',overduePart,T)
 assert.match(await (await h.request('/app/jobs/'+job.id)).text(),/Pickup promise at risk[\s\S]*Arrival unconfirmed after staff-reported ETA: Brake retaining clip/,'FLOW-002 a missed ETA cannot imply physical availability')
 plan=await h.command('promise.partETA',{...overduePart,planVersion:plan.version,receivedAt:new Date().toISOString(),reason:'Inspected the actual arriving clip'},T)
 assert.match(await (await h.request('/app/jobs/'+job.id)).text(),/Physical receipt recorded/,'FLOW-002 physical receipt is a separate staff event')
 const beforeRevocation=(await h.state()).records
 await h.api('/auth/operator/status',{operatorId:tech.id,status:'inactive'})
 await h.command('promise.partETA',{...input,version:(await current()).version,planVersion:plan.version},{...T,status:401})
 assert.deepEqual((await h.state()).records,beforeRevocation,'FLOW-002 revoked staff cannot change the operational plan')
 // OPS-001 keeps original/updated part sources, proposals, approvals and provider receipt; credentials grant no restored authority.
 const state=await h.state(),backup=await archive(h),fresh=await installation()
 try{
  await restore(fresh,backup);const restored=await fresh.state()
  for(const kind of ['promiseSettings','promise','promisePlan','promiseRevision','promiseNotice'])assert.deepEqual(restored.records[kind],state.records[kind],'FLOW-002 exact archive recovery of '+kind)
  await fresh.command('promise.approveAndNotify',{proposalId:proposed.id,proposalVersion:proposed.version},{status:409});assert.equal(fresh.messages.length,0,'FLOW-002 recovery cannot resend a claimed historical notice')
  await fresh.state({...ADV,status:401})
 }finally{await fresh.close()}
 return f
}

export async function promiseMailFailureJourney(){
 let status=422,calls=0
 const h=await installation({outboundService:async request=>{assert.equal(new URL(request.url).hostname,'api.sendgrid.com');calls++;return new Response(null,{status})}})
 try{
  await shopSetup(h);const {job}=await booking(h,{startAt:future(1),endAt:future(2)})
  let promise=await h.command('promise.set',{jobId:job.id,version:job.version,pickupAt:future(3),reason:'Original customer agreement'})
  const proposal=async()=>h.command('promise.propose',{jobId:job.id,version:job.version,promiseVersion:promise.version,planVersion:0,pickupAt:future(5),reason:'Advisor approved delay notification'})
  await h.configure({MAIL_PROVIDER:'sendgrid'})
  for(const [providerStatus,expected] of [[422,'rejected'],[503,'uncertain']]){
   status=providerStatus;const p=await proposal(),notice=await h.command('promise.approveAndNotify',{proposalId:p.id,proposalVersion:p.version});assert.equal(notice.outcome.status,expected)
   assert.equal(calls,expected==='rejected'?1:2,'FLOW-002 provider failures never cause automatic retries')
   await h.command('promise.approveAndNotify',{proposalId:p.id,proposalVersion:p.version},{status:409})
   assert.match(await (await h.request('/app/jobs/'+job.id)).text(),expected==='rejected'?/Customer notice failed/:/Customer notice unconfirmed/)
   promise=(await records(h,'promise')).find(r=>r.id===promise.id)
  }
  const before=await h.state();await h.configure({MAIL_PROVIDER:'development'})
  const p=await proposal();await h.command('promise.approveAndNotify',{proposalId:p.id,proposalVersion:p.version},{status:409})
  assert.deepEqual((await h.state()).records.promise,before.records.promise,'FLOW-002 missing sender refuses before changing a promise')
 }finally{await h.close()}
}
