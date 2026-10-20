import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {specialPartFixture} from './support/special-part-journey.mjs'

const at=hours=>new Date(Date.now()+hours*3_600_000).toISOString()

// PART-006: real counter forms link the approved charge, retain supplier changes,
// put an internal notice before the advisor and require an actual receiving slip.
export async function specialPartBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const f=await specialPartFixture(h,{person:publicDoor(h.origin,h.owner).person}),errors=[],mailBefore=h.messages.length
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'})
  await context.addCookies(f.advisor.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message))
  const url=h.origin+'/app/jobs/'+f.job.id,panel=()=>p.locator('#special-parts'),notices=()=>p.locator('#special-part-notices')
  const form=command=>p.locator(`form:has(input[name="command"][value="${command}"])`)
  const submit=async(target,label)=>{await target.getByRole('button',{name:label,exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok(p.url().includes('/app/jobs'),'PART-006 native command returns to the repair workflow')}
  await mkdir('.cache/special-part-browser',{recursive:true})
  const shot=async(name,target)=>{
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame))
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'PART-006 no horizontal overflow: '+name+' at '+width)
    await target.screenshot({path:`.cache/special-part-browser/${name}-${width}.png`})
   }
   await p.setViewportSize({width:1440,height:1000})
  }
  await p.goto(url)
  await panel().getByText('Link a special-order part',{exact:true}).click()
  const create=form('specialPart.record'),source=JSON.stringify({estimateId:f.quote.id,revision:1,lineId:f.line.id}),initialETA=at(-2)
  await create.locator('select[name="source"]').selectOption(source)
  const choices=await create.locator('select[name="source"] option').allTextContents()
  assert.ok(choices.some(label=>label.includes(f.line.description)));assert.ok(!choices.some(label=>label.includes(f.declined.description)||label.includes(f.labor.description)),'PART-006 only authorized part charges can be linked')
  await create.getByLabel('Supplier',{exact:true}).fill('Great Lakes Subaru Parts')
  await create.getByLabel('Supplier order reference',{exact:true}).fill('GL-PO-6412')
  await create.getByLabel('Supplier acknowledgment evidence',{exact:true}).fill('Supplier email GL-PO-6412: rear wheel bearings on backorder; counter retains acknowledgment')
  await create.getByLabel('Supplier ETA (ISO with timezone)',{exact:true}).fill(initialETA)
  await create.getByLabel('Reason',{exact:true}).fill('Approved rear bearing assemblies are unavailable from shop stock')
  await shot('01-link-approved-charge',panel());await submit(create,'Record special part')
  await panel().getByText('Supplier acknowledgment history',{exact:true}).click()
  let text=await panel().innerText()
  assert.ok(text.includes(f.line.description)&&text.includes('GL-PO-6412')&&text.includes('backorder'))
  assert.equal(await form('specialPart.receive').count(),1)
  assert.match(await p.locator('#promises').innerText(),/Not physically received/)
  let part=(await h.state()).records.specialPart.find(row=>row.jobId===f.job.id)
  assert.equal(part.receipt,null);assert.equal(part.revisions[0].eta,initialETA)
  await shot('02-backorder-past-eta',panel())
  await p.goto(h.origin+'/app?q='+encodeURIComponent(f.asset.identifier))
  assert.ok((await p.locator('.stage-parts').innerText()).includes(f.line.description),'PART-006 the passed ETA leaves the real board waiting for physical parts')
  await shot('03-board-waiting',p.locator('.stage-parts'))
  await p.goto(url)
  await panel().getByText('Update supplier ETA',{exact:true}).click()
  const delay=form('specialPart.delay'),delayedETA=at(10),delayEvidence='Supplier email GL-PO-6412: distribution truck delayed; next run is tomorrow'
  await delay.getByLabel('Supplier ETA (ISO with timezone)',{exact:true}).fill(delayedETA)
  await delay.getByLabel('Supplier acknowledgment evidence',{exact:true}).fill(delayEvidence)
  await delay.getByLabel('Reason',{exact:true}).fill('Supplier revised dispatch after the truck missed its connection')
  await shot('04-supplier-delay-form',panel());await submit(delay,'Record supplier delay')
  await panel().getByText('Supplier acknowledgment history',{exact:true}).click()
  text=await panel().innerText();assert.ok(text.includes('counter retains acknowledgment')&&text.includes(delayEvidence),'PART-006 the original acknowledgment and changed ETA remain visible together')
  await shot('05-retained-acknowledgments',panel())
  part=(await h.state()).records.specialPart.find(row=>row.id===part.id)
  assert.equal(part.revisions.length,2);assert.equal(part.revisions.at(-1).eta,delayedETA);assert.equal(part.receipt,null)
  await p.goto(h.origin+'/app/jobs')
  const delayedNotice=notices().locator('article').filter({hasText:delayEvidence})
  assert.equal(await delayedNotice.count(),1);assert.equal(await delayedNotice.getByRole('button',{name:'Mark reviewed',exact:true}).count(),1)
  await shot('06-internal-delay-notice',notices())
  await delayedNotice.getByLabel('Review note',{exact:true}).fill('Advisor reviewed the supplier delay and will prepare a separate customer pickup revision')
  await submit(delayedNotice,'Mark reviewed')
  assert.ok((await delayedNotice.innerText()).includes('Advisor reviewed the supplier delay'))
  assert.equal(await delayedNotice.getByRole('button',{name:'Mark reviewed',exact:true}).count(),0)
  await shot('07-advisor-reviewed-delay',notices())
  await p.goto(url);await panel().getByText('Record physical receipt',{exact:true}).click()
  const receive=form('specialPart.receive'),receivedAt=at(-.25),receipt='Receiving slip GL-6412: both assemblies counted and matched to this repair'
  await receive.getByLabel('Physical receipt (ISO with timezone)',{exact:true}).fill(receivedAt)
  await receive.getByLabel('Receiving reference',{exact:true}).fill(receipt)
  await shot('08-physical-receipt-form',panel());await submit(receive,'Confirm physical receipt')
  await panel().getByText('Supplier acknowledgment history',{exact:true}).click()
  text=await panel().innerText();assert.ok(text.includes(receipt)&&text.includes(delayEvidence)&&text.includes('counter retains acknowledgment'))
  assert.equal(await form('specialPart.receive').count(),0);assert.equal(await form('specialPart.delay').count(),0,'PART-006 a recorded physical receipt is immutable through the native UI')
  assert.match(await p.locator('#promises').innerText(),/Physical receipt recorded/)
  await shot('09-received-with-history',panel())
  const state=await h.state(),received=state.records.specialPart.find(row=>row.id===part.id),plan=state.records.promisePlan.find(row=>row.jobId===f.job.id)
  assert.equal(received.receipt.receivedAt,receivedAt);assert.equal(received.receipt.reference,receipt);assert.equal(received.receipt.quantityMilli,2000);assert.equal(received.receipt.by.id,f.advisor.id)
  assert.equal(plan.revisions.at(-1).parts.find(row=>row.specialPartId===part.id).receivedAt,receivedAt)
  assert.equal(state.records.job.find(row=>row.id===f.job.id).actuals.length,0,'PART-006 receiving never records billable consumption')
  assert.deepEqual(state.records.estimate.find(row=>row.id===f.quote.id),f.quote,'PART-006 native special ordering leaves the approved charge and customer decision intact')
  await p.goto(h.origin+'/app/jobs')
  for(const note of ['Counter checked the original backorder acknowledgment','Advisor checked the physical receiving slip']){
   const pending=notices().locator('article').filter({has: p.getByRole('button',{name:'Mark reviewed',exact:true})}).first()
   await pending.getByLabel('Review note',{exact:true}).fill(note);await submit(pending,'Mark reviewed')
  }
  assert.equal(await notices().getByRole('button',{name:'Mark reviewed',exact:true}).count(),0)
  assert.equal((await h.state()).records.specialPartNotice.filter(row=>row.specialPartId===part.id&&row.review).length,3)
  await shot('10-received-notices-reviewed',notices())
  await p.goto(h.origin+'/app?q='+encodeURIComponent(f.asset.identifier))
  assert.ok((await p.locator('.stage-work').innerText()).includes(f.asset.customerName),'PART-006 physical receipt makes the same repair available for work')
  await shot('11-board-available',p.locator('.stage-work'))
  assert.equal(h.messages.length,mailBefore,'PART-006 all supplier and advisor operations stay internal')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
