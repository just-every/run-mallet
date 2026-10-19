import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {publicDoor} from './portable-repair.mjs'
import {installation,booking,archive,restore} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {supplementBrowser,supplementInvoiceBrowser} from '../supplement-browser.mjs'
export async function supplementJourney(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
 h.person=publicDoor(h.origin,h.owner).person
 try{
  const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,host:new URL(h.origin).host,'content-type':'application/x-www-form-urlencoded',cookie:h.owner},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const tech=await h.person('luis-supplements@example.test'),other=await h.person('other-supplements@example.test'),owner=(await h.state()).actor
  const asset=await h.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V',identifier:'OH-SUPPLEMENT-4471'})
  let {job}=await booking(h,{asset,technicianId:tech.id,startAt:'2026-10-19T09:00:00-04:00',endAt:'2026-10-19T12:00:00-04:00'})
  const refresh=async()=>job=(await h.state()).records.job.find(j=>j.id===job.id)
  const prepare=async(lines,reason)=>{await refresh();return h.command('estimate.prepare',{jobId:job.id,version:job.version,lines,...(reason?{supplement:true,reason}:{})})}
  const send=async q=>{const revision=q.revisions.at(-1).n;q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision});return h.command('estimate.markSent',{estimateId:q.id,version:q.version,revision,method:'printed',note:'Printed exact incremental scope; handed to Dana, not provider delivered'})}
  const decide=(q,lineIds)=>h.command('estimate.authorise',{estimateId:q.id,version:q.version,revision:q.revisions.at(-1).n,lineIds,customerName:'Dana Brooks',method:'signed',evidence:'Dana signed exact paper revision retained at counter'})
  const work=async(q,lineId,quantity,options={})=>{await refresh();return h.command('work.record',{jobId:job.id,version:job.version,estimateId:q.id,revision:q.revisions.at(-1).n,lineId,quantity,note:'Performed authorized brake repair'},{as:tech.cookie,...options})}
  let root=await prepare([{id:'pads',kind:'part',description:'Front brake pads',quantity:2,unitCents:5000},{id:'labor',kind:'labor',description:'Brake labor',quantity:1.5,unitCents:12000},{id:'cabin',kind:'part',description:'Cabin filter',quantity:1,unitCents:2500}]);root=await decide(await send(root),['pads','labor']);const original=structuredClone(root)
  await work(root,'pads',1);await work(root,'labor',.5)
  let declined=await prepare([{id:'labor',kind:'part',description:'Rotor after measured inspection',quantity:1,unitCents:10000}],'Rotor wear discovered during authorized brake work');declined=await decide(await send(declined),[])
  assert.equal(declined.status,'declined');assert.equal(declined.authorisation.totals.totalCents,0)
  assert.equal((await work(declined,'labor',1,{status:409})).error,'NOT_AUTHORISED')
  await work(root,'labor',.25);assert.deepEqual((await h.state()).records.estimate.find(q=>q.id===root.id),original,'EST-004 original accepted/declined lines and decision stay exact')
  const declinedSnapshot=structuredClone(declined),replaces=(q,lineId)=>({estimateId:q.id,revision:q.revisions.at(-1).n,lineId})
  // A pending repricing neither consumes authority nor survives newly completed work.
  let raced=await prepare([{kind:'labor',description:'Reprice unworked brake labor',quantity:.75,unitCents:13000,replaces:replaces(root,'labor')}],'Updated labor price for unworked balance');raced=await send(raced)
  await work(root,'labor',.25)
  assert.equal((await h.command('estimate.authorise',{estimateId:raced.id,version:raced.version,revision:1,lineIds:[raced.revisions[0].lines[0].id],customerName:'Dana Brooks',method:'signed',evidence:'Prior quantity now exceeds remaining work'},{status:409})).error,'REPLACEMENT_QUANTITY')
  let rotor=await prepare([{id:'labor',kind:'part',description:'Replacement rotor',quantity:1,unitCents:10000}],'New rotor proposal after full decline');rotor=await send(rotor);const sentOld=structuredClone(rotor)
  rotor=await h.command('estimate.revise',{estimateId:rotor.id,version:rotor.version,revision:1,lines:[{id:'labor',kind:'part',description:'Replacement rotor',quantity:1,unitCents:11000}],notes:'Current supplier quote; a separate customer decision is needed'})
  await h.command('estimate.authorise',{estimateId:sentOld.id,version:sentOld.version,revision:1,lineIds:['labor'],customerName:'Dana Brooks',method:'signed',evidence:'Stale price rejected'},{status:409})
  rotor=await decide(await send(rotor),['labor']);assert.equal(rotor.revisions.length,2);assert.equal(rotor.authorisation.revision,2)
  await refresh();assert.equal((await h.command('work.record',{jobId:job.id,version:job.version,estimateId:rotor.id,revision:1,lineId:'labor',quantity:1},{as:tech.cookie,status:409})).error,'REVISION')
  await work(rotor,'labor',1);await work(rotor,'labor',.001,{status:409});await work(root,'cabin',1,{status:409});await work(root,'pads',2,{status:409});await work(rotor,'labor',1,{as:other.cookie,status:403})
  await supplementBrowser(h,{job,root,declined,rotor,tech})
  // Upward and downward prospective price changes leave every performed price exact.
  let higher=await prepare([{id:'labor',kind:'labor',description:'Remaining brake labor at revised rate',quantity:.5,unitCents:13000,replaces:replaces(root,'labor')}],'Revised labor rate for remaining half hour');higher=await decide(await send(higher),['labor'])
  let lower=await prepare([{id:'pads',kind:'part',description:'Remaining pad at reduced price',quantity:1,unitCents:4000,replaces:replaces(root,'pads')}],'Lower current supplier price for uninstalled pad');lower=await decide(await send(lower),['pads'])
  await work(root,'pads',.001,{status:409});await work(root,'labor',.001,{status:409});await work(higher,'labor',.5);await work(lower,'pads',1)
  await refresh();const before=await h.state();assert.deepEqual(before.records.estimate.find(q=>q.id===root.id),original);assert.deepEqual(before.records.estimate.find(q=>q.id===declined.id),declinedSnapshot)
  const unrelated=(await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),technicianId:tech.id,startAt:'2026-10-20T09:00:00-04:00',endAt:'2026-10-20T10:00:00-04:00'})).job
  await h.command('work.record',{jobId:unrelated.id,version:unrelated.version,estimateId:rotor.id,revision:2,lineId:'labor',quantity:1},{as:tech.cookie,status:409})
  const key=await h.command('agent.create',{label:'Supplement preparation only'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
  let agentDraft=await prepare([{kind:'part',description:'Pending optional clip',quantity:1,unitCents:300}],'Optional finding needs a separate decision')
  for(const command of ['estimate.approve','estimate.markSent','estimate.authorise'])await h.command(command,{estimateId:agentDraft.id,version:agentDraft.version,revision:1},{...agent,status:403})
  await refresh();await qualityReady(h,job,{technician:tech});job=await h.command('job.complete',{jobId:job.id,version:job.version})
  let invoice=await h.command('invoice.prepare',{jobId:job.id,version:job.version})
  assert.equal(invoice.totals.totalCents,40000,'EST-004 invoice exact original and incremental cent totals')
  assert.equal(invoice.lines.length,5);assert.equal(invoice.sources.length,4)
  const tuple=l=>[l.sourceEstimateId,l.sourceRevision,l.id,l.quantity,l.unitCents]
  assert.deepEqual(invoice.lines.map(tuple),[[root.id,1,'pads',1,5000],[root.id,1,'labor',1,12000],[rotor.id,2,'labor',1,11000],[higher.id,1,'labor',.5,13000],[lower.id,1,'pads',1,4000]])
  assert.ok(!invoice.sources.some(s=>s.estimateId===declined.id||s.estimateId===raced.id||s.estimateId===agentDraft.id));assert.deepEqual(invoice.sources.find(s=>s.estimateId===root.id).customerAuthorisation,root.authorisation)
  invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
  const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version});assert.deepEqual(await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),exported)
  const csv=await(await h.request('/api/mallet/exports/'+exported.id)).text();assert.ok(csv.includes(rotor.id)&&csv.includes(root.id));assert.equal(csv,exported.csv)
  await supplementInvoiceBrowser(h,job.id)
  const backup=await archive(h),fresh=await installation({bindings:{OWNER_EMAIL:'supplement-recovery@example.test'}})
  try{await restore(fresh,backup);const recovered=await fresh.state();for(const q of before.records.estimate)assert.deepEqual(recovered.records.estimate.find(x=>x.id===q.id),q);assert.deepEqual(recovered.records.invoice.find(x=>x.id===invoice.id).sources,invoice.sources);assert.deepEqual(recovered.records.job.find(x=>x.id===job.id).actuals,before.records.job.find(x=>x.id===job.id).actuals);assert.equal((await(await fresh.request('/api/mallet/exports/'+exported.id)).text()),csv);await fresh.state({as:tech.cookie,status:401})}finally{await fresh.close()}
  await h.api('/auth/operator/status',{operatorId:tech.id,status:'inactive'});await h.state({as:tech.cookie,status:401});assert.equal(owner.role,'owner')
 }finally{await h.close()}
}
