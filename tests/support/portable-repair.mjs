import {qualityReady} from './quality-ready.mjs'
import assert from 'node:assert/strict'
import {installation,booking,estimate,authorise,archive,restore,snapshots} from '../harness.mjs'

// A public HTTP client for the actual rer-launched installation. Credentials stay
// in this process and never enter assertions, screenshots, or console output.
export function publicDoor(origin,owner) {
 const request=(path,{method='GET',body,as=owner,headers={}}={})=>fetch(origin+path,{method,redirect:'manual',headers:{origin,'content-type':'application/json',...(as?{cookie:as}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
 const api=async(path,body,{status=200,...options}={})=>{const response=await request(path,{...(body===undefined?{}:{method:'POST',body}),...options});assert.equal(response.status,status,'OPS-001: public response at '+path);return response.json()}
 const person=async(email,role='member',displayName=email.split('@')[0].replace(/-/g,' '))=>{
  await api('/auth/invite',{email,role,displayName,returnTo:'/app'},{status:202})
  const entered=await request('/auth/one-click?as='+encodeURIComponent(email));assert.equal(entered.status,303,'QUALITY-001: invited reviewer enters the native development door')
  const cookies=new Map(owner.split('; ').map(pair=>[pair.slice(0,pair.indexOf('=')),pair.slice(pair.indexOf('=')+1)]))
  for(const value of entered.headers.getSetCookie()){const pair=value.split(';')[0],at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1))}
  const cookie=[...cookies].map(([k,v])=>k+'='+v).join('; '),session=await api('/auth/session',undefined,{as:cookie})
  return {id:session.operator.id,cookie,session}
 }
 return {origin,owner,request,api,person,command:(command,input,options)=>api('/api/mallet/commands',{command,input},options),state:options=>api('/api/mallet/state',undefined,options)}
}

export async function portableRepair(source) {
 // Import original source captures through the real reviewed door, independently
 // of any move-in performed earlier by the browser journey.
 const input=await snapshots()
 for(const c of input.customers.customers)c.id+=10000
 for(const a of input.assets.assets){a.id+=10000;a.customer_id+=10000;a.asset_serial='OPS-'+a.asset_serial;if(a.customer)a.customer.id+=10000}
 const plan=await source.api('/api/mallet/imports/preview',input)
 const imported=await source.api('/api/mallet/imports/apply',{...input,fingerprint:plan.fingerprint})
 assert.equal(imported.state,'completed')
 await source.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
 const asset=await source.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V EX',identifier:'OH-OPS-4471'})
 let {job}=await booking(source,{asset,bayId:'Recovery bay',technicianId:(await source.state()).actor.id,startAt:'2026-12-01T09:00:00-05:00',endAt:'2026-12-01T11:00:00-05:00'})
 const key=await source.command('agent.create',{label:'Pre-update drafting assistant'})
 let q=await estimate(source,job,{as:'',headers:{authorization:'Bearer '+key.token}})
 q=await authorise(source,q,[q.revisions[0].lines[0].id])
 const latest=()=>source.state().then(s=>s.records.job.find(j=>j.id===job.id))
 job=await latest()
 const proposal=await source.command('dispatch.prepare',{jobId:job.id,version:job.version,bayId:'Recovery bay 2',technicianId:job.technicianId,startAt:job.startAt,endAt:job.endAt,reason:'Move to the covered service bay'})
 await source.command('dispatch.approve',{proposalId:proposal.id,version:proposal.version})
 job=await latest()
 const reading=await source.command('reading.record',{jobId:job.id,version:job.version,value:62100,unit:'miles',stage:'intake',observedAt:'2026-10-01T09:00:00-04:00'})
 job=await latest()
 await source.command('serviceInterval.save',{jobId:job.id,version:job.version,name:'Brake follow-up',dueValue:67000,dueDate:'2027-04-01'})
 await source.command('decline.record',{estimateId:q.id,version:q.version,lineId:q.revisions[0].lines[1].id,readingId:reading.id,reason:'Customer defers labor',evidence:'Signed paper decision OPS-4127',dueValue:67000,dueDate:'2027-04-01'})
 job=await source.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1,note:'One authorized pad supplied before backup'})
 // A second repair proves immutable invoiced history and saved bytes travel too.
 const priorAsset=await source.command('asset.create',{customerName:'Morgan Reed',customerEmail:'morgan@example.test',label:'2020 Ford Transit',identifier:'OH-OPS-2264'})
 let prior=(await booking(source,{asset:priorAsset,bayId:'Invoice bay',technicianId:(await source.state()).actor.id,startAt:'2026-11-01T09:00:00-05:00',endAt:'2026-11-01T10:00:00-05:00'})).job
 const oldQuote=await authorise(source,await estimate(source,prior))
 prior=(await source.state()).records.job.find(j=>j.id===prior.id)
 prior=await source.command('work.record',{jobId:prior.id,version:prior.version,lineId:oldQuote.revisions[0].lines[1].id,quantity:1})
 await qualityReady(source,prior)
 prior=await source.command('job.complete',{jobId:prior.id,version:prior.version})
 let invoice=await source.command('invoice.prepare',{jobId:prior.id,version:prior.version})
 invoice=await source.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version})
 const saved=await source.command('invoice.export',{invoiceId:invoice.id,version:invoice.version})
 const savedBytes=await (await source.request('/api/mallet/exports/'+saved.id)).text()
 const original=(await source.state()).records,backup=await archive(source)
 for(const table of backup[0].tables)assert.ok(!/^oa_|^mallet_agent_keys$|^mallet_customer_links$|^mallet_approval_links$/.test(table.name),'OPS-001: identity and access keys are excluded')
 assert.equal(backup[0].objects.length,0,'OPS-001: current capabilities have no object-store media')
 const fresh=await installation({bindings:{OWNER_EMAIL:'recovered-owner@example.test'}})
 try {
  const freshActor=(await fresh.state()).actor
  assert.notEqual(freshActor.id,(await source.state()).actor.id)
  await restore(fresh,backup)
  const restored=(await fresh.state()).records
  assert.deepEqual(restored,original,'OPS-001: every current record, snapshot, decision and cent amount survives exactly')
  for(const [kind,records] of Object.entries(original))assert.equal(restored[kind].length,records.length,'OPS-001: restored '+kind+' count')
  const journal=await fresh.api('/api/mallet/imports/journal?id='+imported.id)
  assert.equal(journal.originals.length,2);assert.deepEqual(journal.originals,(await source.api('/api/mallet/imports/journal?id='+imported.id)).originals)
  assert.equal(await (await fresh.request('/api/mallet/exports/'+saved.id)).text(),savedBytes)
  await fresh.state({as:source.owner,status:401})
  await fresh.state({as:'',headers:{authorization:'Bearer '+key.token},status:401})
  assert.equal((await fresh.state()).actor.id,freshActor.id,'OPS-001: destination keeps its fresh owner')
  let continued=restored.job.find(j=>j.id===job.id)
  await fresh.command('work.record',{jobId:continued.id,version:continued.version,lineId:q.revisions[0].lines[1].id,quantity:1},{status:409})
  continued=await fresh.command('work.record',{jobId:continued.id,version:continued.version,lineId:q.revisions[0].lines[0].id,quantity:1,note:'Finish under recovered owner'})
  continued=await fresh.command('quality.takeover',{jobId:continued.id,version:continued.version,qualityVersion:0,reason:'Fresh owner takes explicit custody of unfinished repair after recovery'})
  await qualityReady(fresh,continued)
  continued=await fresh.command('job.complete',{jobId:continued.id,version:continued.version})
  let finished=await fresh.command('invoice.prepare',{jobId:continued.id,version:continued.version})
  assert.equal(finished.lines.length,1);assert.equal(finished.lines[0].quantity,2);assert.equal(finished.totals.totalCents,5375)
  assert.deepEqual(finished.customerAuthorisation,q.authorisation)
  finished=await fresh.command('invoice.approve',{invoiceId:finished.id,version:finished.version})
  const exported=await fresh.command('invoice.export',{invoiceId:finished.id,version:finished.version})
  assert.equal(exported.by.id,freshActor.id)
  assert.equal((await source.state()).records.job.find(j=>j.id===job.id).status,'working','OPS-001: recovery never mutates the original shop')
  const beforeRefused=(await fresh.state()).records
  await restore(fresh,backup,{status:409})
  assert.deepEqual((await fresh.state()).records,beforeRefused,'OPS-001: populated restore writes nothing')
 }finally{await fresh.close();await source.command('agent.revoke',{id:key.id})}
}
