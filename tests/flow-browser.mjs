import {handoverInput} from './support/handover-input.mjs'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {assetInput,authorise,booking,estimate,installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {qualityReady} from './support/quality-ready.mjs'
// FLOW-001 native board: nine stages, the technician and overdue-promise filters, priority, cancel and recorded collection at 1440/390.
export async function flowBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  await shopSetup(h);const door=publicDoor(h.origin,h.owner),andre=await door.person('andre-board@example.test'),mei=await door.person('mei-board@example.test'),casey=await door.person('casey-board@example.test','admin')
  const job=async id=>(await h.state()).records.job.find(j=>j.id===id)
  const done=(await booking(h,{technicianId:(await h.state()).actor.id})).job,quote=await authorise(h,await estimate(h,done))
  for(const line of quote.revisions[0].lines)await h.command('work.record',{jobId:done.id,version:(await job(done.id)).version,estimateId:quote.id,revision:1,lineId:line.id,quantity:line.quantity})
  const late=(await booking(h,{technicianId:mei.id,asset:await h.command('asset.create',{...assetInput('2'),customerName:'Rivera Plumbing',identifier:'OH FLT 2207'}),bayId:'Bay 2'})).job
  await h.command('promise.set',{jobId:late.id,version:late.version,pickupAt:new Date(Date.now()+1500).toISOString(),reason:'Customer leaves at noon'})
  const spare=(await booking(h,{technicianId:andre.id,asset:await h.command('asset.create',assetInput('3')),bayId:'Bay 3'})).job
  await new Promise(r=>setTimeout(r,2000))
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'});await c.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  await mkdir('.cache/flow-browser',{recursive:true})
  const shot=async(name,target)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'FLOW-001 responsive '+name+' '+width);await p.screenshot({path:`.cache/flow-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  const submit=async button=>{await button.click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/jobs/'+done.id)
  const beforeQuality=await h.state(),beforeCompletion=beforeQuality.records.job.find(j=>j.id===done.id)
  const refusal=p.waitForResponse(r=>r.url()===h.origin+'/app/actions'&&r.request().method()==='POST')
  await submit(p.getByRole('button',{name:'Complete repair',exact:true}))
  assert.equal((await refusal).status(),409)
  assert.match(await p.locator('main').innerText(),/Quality clearance is incomplete or has changed/)
  const afterQuality=await h.state()
  assert.deepEqual(afterQuality.records.job.find(j=>j.id===done.id),beforeCompletion,'FLOW-001 refused form preserves completion fields, version and actual work')
  assert.deepEqual(afterQuality.records.event.filter(e=>e.jobId===done.id&&e.kind==='job.complete'),[],'FLOW-001 refused form creates no completion event')
  await shot('00-quality-refused',p.locator('main'))
  await p.goto(h.origin+'/app/jobs/'+done.id)
  assert.match(await p.locator('#flow').innerText(),/Stage: Work/)
  await shot('00-retained-work',p.locator('#flow'))
  await p.goto(h.origin+'/app?ro=none#board')
  const retainedCard=p.locator(`#board a.ro[href*="ro=${done.id}"]`)
  assert.equal(await retainedCard.count(),1)
  assert.equal(await retainedCard.getAttribute('data-stage'),'work','FLOW-001 blocked repair stays on the Work board')
  assert.equal(await p.locator(`#board .stage-ready a.ro[href*="ro=${done.id}"]`).count(),0)
  await shot('00-blocked-board',retainedCard)
  await qualityReady(h,await job(done.id),{reviewer:casey})
  await p.goto(h.origin+'/app/jobs/'+done.id)
  assert.match(await p.locator('#flow').innerText(),/Stage: Quality/)
  await submit(p.getByRole('button',{name:'Complete repair',exact:true}))
  const completed=await job(done.id)
  assert.equal(completed.status,'completed');assert.ok(completed.completedAt)
  assert.equal(completed.completedBy.id,beforeQuality.actor.id);assert.deepEqual(completed.actuals,beforeCompletion.actuals)
  assert.match(await p.locator('#flow').innerText(),/Stage: Ready/)
  const invoice=await h.command('invoice.prepare',{jobId:done.id,version:completed.version});await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version,revision:1})
  await p.goto(h.origin+'/app');const board=p.locator('#board')
  assert.deepEqual(await board.locator('.column h2').evaluateAll(hs=>hs.map(x=>x.firstChild.textContent.trim())),['Intake','Diagnosis','Approval','Parts','Work','Quality','Ready','Collected','Closed'],'FLOW-001 nine stages')
  assert.match(await board.locator('.column.stage-ready').innerText(),/Collection not recorded/);await shot('01-board',board)
  const filters=p.getByRole('search',{name:'Filter the board'})
  await filters.getByLabel('Technician').selectOption(mei.id);await filters.getByLabel('Customer promise').selectOption('overdue');await submit(filters.getByRole('button',{name:'Filter'}))
  assert.equal(await board.locator('a.ro').count(),1,'FLOW-001 one technician, overdue promise');assert.match(await board.locator('a.ro').innerText(),/Rivera Plumbing[\s\S]*Promise overdue[\s\S]*Customer promise overdue/);await shot('02-filtered',p.locator('main'))
  await p.goto(h.origin+'/app/jobs/'+late.id);let panel=p.locator('#flow');await panel.getByText('Change priority').click();await panel.getByLabel('Priority').selectOption('urgent');await panel.getByLabel('Why').fill('Fleet van off the road');await submit(panel.getByRole('button',{name:'Save priority'}))
  panel=p.locator('#flow');assert.match(await panel.innerText(),/Priority: urgent/);await shot('03-priority',panel)
  await p.goto(h.origin+'/app/jobs/'+spare.id);panel=p.locator('#flow');await panel.getByText('Cancel or mark lost').click();await panel.getByLabel('Outcome').selectOption('canceled');await panel.getByLabel('Reason').fill('Customer sold the car');await submit(panel.getByRole('button',{name:'Close repair order'}))
  panel=p.locator('#flow');assert.match(await panel.innerText(),/Stage: Closed[\s\S]*Canceled at Intake[\s\S]*Customer sold the car/)
  const handover=await handoverInput(h,done.id,'Dana Cedar');await p.goto(h.origin+'/app/jobs/'+done.id);await p.getByRole('link',{name:'Document handover',exact:true}).click();const handoverForm=p.locator('form:has(input[value="flow.collect"])');for(const name of ['collectorName','identityEvidence','warrantyAdvice'])await handoverForm.locator(`[name="${name}"]`).fill(handover[name]);for(const name of ['delegateId','comparisonId','readingId','overrideId'])await handoverForm.locator(`[name="${name}"]`).selectOption(handover[name]);await submit(handoverForm.getByRole('button',{name:'Record documented handover'}));assert.ok((await p.locator('main').innerText()).includes('settlement is not verified'));await p.goto(h.origin+'/app/jobs/'+done.id)
  panel=p.locator('#flow');assert.match(await panel.innerText(),/Stage: Collected[\s\S]*Collected by Dana Cedar[\s\S]*identity was checked by staff, not verified by Mallet/);await shot('04-collected',panel)
  await p.goto(h.origin+'/app?stage=closed#board');assert.match(await board.innerText(),/Closed[\s\S]*Canceled/);await shot('05-closed',board)
  await p.goto(h.origin+'/app?priority=urgent');assert.match(await board.locator('a.ro').innerText(),/Urgent[\s\S]*Rivera Plumbing/)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
