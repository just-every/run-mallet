import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation,archive,restore} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {blockerFixture} from './support/blocker-journey.mjs'

const cookies=(cookie,origin)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin}))

// ADV-003 PARTIAL: native repair links, review fences, named handler ownership
// and existing proposal approval, captured with real assigned repair evidence.
export async function blockerBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
 let browser,fresh
 try{
  const f=await blockerFixture(h,{person:publicDoor(h.origin,h.owner).person}),errors=[]
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'})
  await context.addCookies(cookies(h.owner,h.origin))
  const p=await context.newPage();p.on('pageerror',error=>errors.push(error.message))
  const form=(page,command)=>page.locator(`form:has(input[name="command"][value="${command}"])`)
  const blockerPath=job=>`/app/jobs/${job.id}/blockers`
  const open=job=>p.goto(h.origin+blockerPath(job))
  const submit=async(page,target,label)=>{await target.getByRole('button',{name:label,exact:true}).click();await page.waitForLoadState('domcontentloaded')}
  const proofDirectory=process.env.MALLET_BLOCKER_PROOF_DIR??'.cache/blocker-browser'
  await mkdir(proofDirectory,{recursive:true})
  const shot=async(name,page=p)=>{
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(requestAnimationFrame))
    if(width===1440)assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`ADV-003 ${name} fits ${width}`)
    if(width===1440)assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'ADV-003 every icon-only control has a tooltip')
    await page.screenshot({path:`${proofDirectory}/${name}-${width}.png`,fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
  const refresh=async(job)=>{
   await open(job)
   await submit(p,form(p,'blocker.refresh'),'Refresh blocker packet')
   const v=await f.view(job);assert.ok(v.packet);assert.equal(v.stale,false)
   return v
  }
  const clickSource=async(job,ref)=>{
   await open(job)
   const link=p.locator(`a[href=${JSON.stringify(ref.href)}]`).first()
   assert.equal(await link.count(),1,'ADV-003 exact saved source has a native link')
   for(const details of (await link.locator('xpath=ancestor::details').all()).reverse())if(!await details.evaluate(element=>element.open))await details.locator(':scope > summary').click()
   await link.click();await p.waitForLoadState('domcontentloaded')
   assert.equal(new URL(p.url()).origin,h.origin)
   assert.equal(new URL(p.url()).pathname,new URL(ref.href,h.origin).pathname,'ADV-003 source opens its real repair workflow')
  }
  await p.goto(h.origin+'/app/jobs/'+f.evidence.job.id)
  assert.equal(await p.locator(`a[href="${blockerPath(f.evidence.job)}"]`).count(),1)
  await shot('01-repair-blocker-link')
  await p.locator(`a[href="${blockerPath(f.evidence.job)}"]`).click();await p.waitForLoadState('domcontentloaded')
  assert.equal(new URL(p.url()).pathname,blockerPath(f.evidence.job))
  await shot('02-current-evidence')
  let v=await refresh(f.evidence.job)
  const task=v.tasks.find(t=>t.source.id===f.evidence.inspection.id&&!t.resolution)
  assert.ok(task)
  const assign=form(p,'blocker.assign').filter({has:p.locator(`input[name="taskId"][value="${task.id}"]`)})
  await assign.locator('xpath=parent::details').locator(':scope > summary').click()
  await assign.locator('select[name="handlerId"]').selectOption(f.advisor.id)
  const candidates=await assign.locator('select[name="handlerId"] option').evaluateAll(options=>options.map(o=>o.value))
  assert.ok(candidates.includes(f.advisor.id)&&candidates.includes(f.owner.id));assert.ok(!candidates.includes(f.member.id),'ADV-003 member identities are not offered as handlers')
  await submit(p,assign,'Assign handler')
  v=await f.view(f.evidence.job)
  assert.equal(v.tasks.find(t=>t.id===task.id).handler.id,f.advisor.id)
  await shot('03-handler-assigned')
  const advisorContext=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'})
  await advisorContext.addCookies(cookies(f.advisor.cookie,h.origin))
  const advisor=await advisorContext.newPage();advisor.on('pageerror',error=>errors.push(error.message))
  await advisor.goto(h.origin+blockerPath(f.evidence.job))
  const acknowledgment=form(advisor,'blocker.acknowledge').filter({has:advisor.locator(`input[name="taskId"][value="${task.id}"]`)})
  const note='synthetic-mallet-880: advisor following up on the missing inspection key'
  await acknowledgment.locator('[name="note"]').fill(note)
  await submit(advisor,acknowledgment,'Acknowledge blocker')
  v=await f.view(f.evidence.job)
  const acknowledged=v.tasks.find(t=>t.id===task.id)
  assert.equal(acknowledged.acknowledgment.by.id,f.advisor.id);assert.equal(acknowledged.resolution,null)
  assert.ok((await advisor.locator('main').innerText()).includes(note),'ADV-003 actual acknowledgment remains visible beside unresolved source evidence')
  await shot('04-acknowledged-unresolved',advisor)
  // Source navigation uses the actual links exposed by the current packet.
  for(const category of ['intake','diagnostics']){
   const refs=v.current.sources[category]
   assert.ok(refs.length)
   for(const ref of refs)await clickSource(f.evidence.job,ref)
  }
  const before=(await h.state()).records.job.find(j=>j.id===f.evidence.job.id)
  await h.command('diagnosis.record',{jobId:before.id,version:before.version,diagnosisId:f.evidence.diagnosis.id,diagnosisVersion:f.evidence.diagnosis.version,...f.diagnosisInput,testMethod:'Native diagnostic revision added after the advisor review'})
  await open(f.evidence.job)
  assert.equal((await f.view(f.evidence.job)).stale,true)
  await shot('05-source-changed')
  v=await refresh(f.evidence.job)
  assert.ok(v.current.sources.diagnostics.some(s=>s.id===f.evidence.diagnosis.id&&s.revision===3))
  assert.ok(v.current.blockers.some(b=>b.source.id===f.evidence.inspection.id))
  await shot('06-refreshed-source-history')
  // A packet proposal opens the pre-existing estimate and its unchanged native
  // approval form. Approving and sharing do not record customer authorization.
  let consent=await refresh(f.consent.job)
  const dispatch=consent.current.proposals.find(r=>r.id===f.consent.proposal.id);assert.ok(dispatch)
  await clickSource(f.consent.job,dispatch)
  const dispatchApproval=form(p,'dispatch.approve').filter({has:p.locator(`input[name="proposalId"][value="${dispatch.id}"]`)})
  await submit(p,dispatchApproval,'Approve dispatch plan')
  consent=await refresh(f.consent.job)
  assert.ok(!consent.current.proposals.some(r=>r.id===dispatch.id))
  const proposal=consent.current.proposals.find(r=>r.id===f.consent.quote.id)
  assert.ok(proposal)
  await clickSource(f.consent.job,proposal)
  const approval=form(p,'estimate.approve').filter({has:p.locator(`input[name="estimateId"][value="${f.consent.quote.id}"]`)})
  await submit(p,approval,'Approve estimate')
  let quote=(await h.state()).records.estimate.find(q=>q.id===f.consent.quote.id)
  assert.equal(quote.status,'approved');assert.equal(quote.authorisation,null);assert.equal(quote.revisions.at(-1).n,2)
  const share=form(p,'estimate.markSent').filter({has:p.locator(`input[name="estimateId"][value="${quote.id}"]`)})
  await share.locator('[name="note"]').fill('synthetic-mallet-881: handed exact printed revision 2 to the customer')
  await submit(p,share,'Record estimate shared')
  consent=await refresh(f.consent.job)
  assert.ok(consent.current.blockers.some(b=>b.kind==='consent'&&b.source.id===quote.id&&b.source.revision===2))
  assert.ok(!consent.current.proposals.some(r=>r.id===quote.id))
  await shot('07-shared-awaiting-exact-decision')
  // The separate repair with actual labor remains held by physical receiving.
  let backorder=await refresh(f.backorder.job)
  await shot('08-physical-part-outstanding')
  assert.equal(backorder.packet.version,1);assert.equal(backorder.packet.revisions.at(-1).progress.stage,'parts')
  const quality=f.backorder.quality
  const repair=(await h.state()).records.job.find(j=>j.id===f.backorder.job.id)
  await h.command('quality.record',{jobId:repair.id,version:repair.version,qualityVersion:quality.version,itemId:quality.revisions.at(-1).items.find(item=>item.stage==='post').id,outcome:'fail',note:'Post-work bearing check failed while replacement part remains outstanding'})
  await open(f.backorder.job)
  assert.equal((await f.view(f.backorder.job)).stale,true)
  await shot('08a-quality-source-changed')
  backorder=await refresh(f.backorder.job)
  assert.equal(backorder.packet.version,2);assert.equal(backorder.packet.revisions.at(-1).progress.stage,'quality')
  assert.ok(backorder.packet.revisions.at(-1).sources.progress.some(s=>s.kind==='quality'&&s.id===quality.id&&s.version===quality.version+1))
  assert.equal(await p.locator('dt').filter({hasText:/^Stage$/}).first().locator('xpath=following-sibling::dd[1]').innerText(),'quality')
  await shot('08b-quality-source-refreshed')
  for(const category of ['parts','authorization','progress','promises']){
   const ref=backorder.current.sources[category][0];assert.ok(ref)
   await clickSource(f.backorder.job,ref)
  }
  backorder=await refresh(f.backorder.job)
  assert.ok(backorder.current.blockers.some(b=>b.kind==='backorder'))
  const unchanged=(await h.state()).records.job.find(j=>j.id===f.backorder.job.id)
  assert.equal((await h.state()).records.job.find(j=>j.id===f.consent.job.id).bayId,'synthetic-mallet-864');assert.equal(unchanged.actuals.length,1)
  assert.equal(backorder.current.progress.recordedActuals,unchanged.actuals.length);assert.equal(backorder.current.progress.remainingHours,1)
  assert.equal((await h.state()).records.specialPart.find(r=>r.id===f.backorder.part.id).receipt,null)
  await shot('09-native-proposal-approved-part-still-pending')
  // Follow actual native source outcomes before reconciling the packet.
  for(const itemId of ['point-a','point-b']){
   await p.goto(h.origin+'/app/jobs/'+f.evidence.job.id)
   const observation=form(p,'inspection.record').filter({has:p.locator(`input[name="itemId"][value="${itemId}"]`)})
   await observation.locator('[name="outcome"]').selectOption('green')
   await observation.locator('[name="reason"]').fill('Customer supplied access; the assigned point was physically inspected')
   await submit(p,observation,'Record inspection point')
  }
  await p.goto(f.evidence.form.url)
  const terms=p.locator('form:has(input[name="typedName"])')
  await terms.locator('[name="symptom"]').fill('Rumbling from the rear axle at highway speed')
  await terms.locator('[name="concern"]').fill('Starts after about ten minutes of driving')
  await terms.locator('[name="typedName"]').fill(f.evidence.asset.customerName)
  for(const checkbox of await terms.locator('input[type="checkbox"]').all())await checkbox.check()
  await submit(p,terms,'Sign terms & request copy')
  v=await refresh(f.evidence.job)
  assert.equal(v.current.blockers.length,0);assert.ok(v.tasks.length>=3&&v.tasks.every(t=>t.resolution))
  await shot('10-evidence-source-cleared')
  await p.goto(h.origin+'/app/jobs/'+f.consent.job.id)
  const decision=form(p,'estimate.authorise')
  for(const checkbox of await decision.locator('input[name="lineIds"]').all())await checkbox.check()
  await decision.locator('[name="method"]').selectOption('signed')
  await decision.locator('[name="evidence"]').fill('Customer signed exact printed revision 2, retained with this visit')
  await submit(p,decision,'Record customer authorization')
  consent=await refresh(f.consent.job)
  assert.equal(consent.current.blockers.length,0);assert.ok(consent.tasks.length&&consent.tasks.every(t=>t.resolution))
  await shot('11-exact-customer-decision-recorded')
  await p.goto(h.origin+'/app/jobs/'+f.backorder.job.id)
  await p.locator('#special-parts').getByText('Record physical receipt',{exact:true}).click()
  const receipt=form(p,'specialPart.receive')
  await receipt.locator('[name="receivedAt"]').fill(new Date(Date.now()-60000).toISOString())
  await receipt.locator('[name="receiptReference"]').fill('Bearing counted and matched at the counter, receiving slip 876')
  await submit(p,receipt,'Confirm physical receipt')
  backorder=await refresh(f.backorder.job)
  assert.equal(backorder.current.blockers.length,0);assert.ok(backorder.tasks.length&&backorder.tasks.every(t=>t.resolution))
  assert.equal(backorder.current.progress.remainingHours,1);assert.equal(backorder.current.progress.recordedActuals,1)
  await shot('12-receipt-cleared-labor-still-open')
  const saved=await archive(h)
  fresh=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),OWNER_EMAIL:'synthetic-mallet-897@example.test'}})
  await restore(fresh,saved);await shopSetup(fresh)
  const restored=(await fresh.state()).records,original=(await h.state()).records
  for(const kind of ['repairBlockerPacket','repairBlockerTask'])assert.deepEqual(restored[kind],original[kind])
  const recoveredContext=await browser.newContext({viewport:{width:1440,height:1000}})
  await recoveredContext.addCookies(cookies(fresh.owner,fresh.origin))
  const recovered=await recoveredContext.newPage()
  for(const [index,repair] of f.repairs.entries()){
   await recovered.goto(fresh.origin+blockerPath(repair.job))
   const history=recovered.getByText(`Handler, acknowledgment and resolution history (${restored.repairBlockerTask.filter(t=>t.jobId===repair.job.id).length})`,{exact:true})
   await history.click()
   assert.ok((await recovered.locator('main').innerText()).includes('Resolution:'))
   await shot('13-recovered-source-history-'+index,recovered)
  }
  assert.deepEqual(errors,[])
 }finally{try{await browser?.close()}finally{await fresh?.close();await h.close()}}
}
