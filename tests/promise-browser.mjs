import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {future,promiseFixture} from './support/promise-journey.mjs'

// FLOW-002 native forms: delayed part -> affected capacity -> advisor revision -> retained original and honest customer notice.
export async function promiseBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const f=await promiseFixture(h,{person:publicDoor(h.origin,h.owner).person}),errors=[]
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const open=async(cookie,width)=>{const c=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/Los_Angeles',locale:'en-US',hasTouch:width<500});await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  const p=await open(h.owner,1440),url=h.origin+'/app/jobs/'+f.job.id
  const panel=()=>p.locator('#promises'),command=(name)=>panel().locator(`form:has(input[name="command"][value="${name}"])`)
  const submit=async(form,label)=>{await form.getByRole('button',{name:label,exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok(p.url().includes('/app/jobs/'),'FLOW-002 native form returns to its repair')}
  await mkdir('.cache/promise-browser',{recursive:true})
  const shot=async(name,target=panel())=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'FLOW-002 responsive '+name+' '+width);await p.screenshot({path:`.cache/promise-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  await p.goto(url)
  const original=command('promise.set'),pickupAt=future(6)
  await original.getByLabel('Customer pickup (ISO with timezone)',{exact:true}).fill(pickupAt);await original.getByLabel('Reason for original promise',{exact:true}).fill('Customer agreed to the afternoon pickup')
  await shot('01-original-promise');await submit(original,'Approve original pickup promise')
  const part=async(eta,reason)=>{
   await panel().getByText('Record required part or change its ETA',{exact:true}).click()
   const form=command('promise.partETA');await form.getByLabel('Part reference',{exact:true}).fill('PADS-SET');await form.getByLabel('Required part name',{exact:true}).fill('Front brake pads');await form.getByLabel('Staff-reported ETA (ISO with timezone)',{exact:true}).fill(eta);await form.getByLabel('ETA source note',{exact:true}).fill('Parts desk phone call; the truck has not arrived');await form.getByLabel('Reason for plan change',{exact:true}).fill(reason)
   await submit(form,'Save required part ETA')
  }
  await part(future(4),'Pads required for the authorized brake service')
  await part(future(8),'Truck delayed beyond the original customer promise')
  await panel().getByText('Manage resource dependency',{exact:true}).click()
  const dep=command('promise.dependency');await dep.locator('select[name="dependencyJobId"]').selectOption(f.source.id);await dep.locator('select[name="resource"]').selectOption('both');await dep.getByLabel('Reason for resource dependency change',{exact:true}).fill('Shared lift and technician must finish the previous repair');await submit(dep,'Save resource dependency')
  const work=p.locator('form:has(input[name="command"][value="work.record"])').first();await work.locator('select[name="lineId"]').selectOption(f.quote.revisions[0].lines[1].id);await work.getByLabel('Quantity used / hours worked',{exact:true}).fill('0.5');await submit(work,'Record parts or labor')
  let view=await panel().innerText();assert.match(view,/Pickup promise at risk/);assert.match(view,/sold labor: 1.5 hours/);assert.match(view,/Performed labor: 0.5 hours/);assert.match(view,/Labor remaining: 1 hours/);assert.match(view,/staff-reported; not supplier-confirmed/);assert.match(view,/Not physically received/);assert.match(view,/Shared lift/)
  await shot('02-delayed-required-part')
  await p.goto(h.origin+'/app/jobs');assert.match(await p.locator('#promise-plan').innerText(),/Pickup promise at risk[\s\S]*Front brake pads/);await shot('03-affected-resource-plan',p.locator('#promise-plan'))
  await p.goto(url);await panel().getByText('Propose a revised customer pickup promise',{exact:true}).click()
  const revision=command('promise.propose'),newPickup=future(12)
  await revision.getByLabel('Revised pickup (ISO with timezone)',{exact:true}).fill(newPickup);await revision.getByLabel('Reason for revised promise',{exact:true}).fill('Parts truck delayed; advisor reviewed remaining labor and shared lift capacity');await submit(revision,'Prepare promise revision')
  const decision=command('promise.approveAndNotify');assert.match(await panel().innerText(),/Old pickup[\s\S]*America\/New_York[\s\S]*Proposed pickup[\s\S]*America\/New_York/,'FLOW-002 a browser in Los Angeles still renders customer promises in shop New York time')
  await shot('04-advisor-reviews-revision',decision)
  await submit(decision,'Approve and email revised promise')
  await panel().getByText('Retained original and approved pickup promises',{exact:true}).click()
  view=await panel().innerText();assert.match(view,/Original promise/);assert.match(view,/Approved revision 2/);assert.match(view,/Development outbox only; not sent/)
  await shot('05-original-and-notice-receipt',panel().locator('ul').filter({hasText:'Development outbox only; not sent'}))
  const state=await h.state(),promise=state.records.promise.find(r=>r.jobId===f.job.id),notice=state.records.promiseNotice.find(r=>r.jobId===f.job.id)
  assert.equal(promise.revisions[0].pickupAt,pickupAt);assert.equal(promise.revisions[1].pickupAt,newPickup);assert.equal(notice.oldPickupAt,pickupAt);assert.equal(notice.newPickupAt,newPickup);assert.equal(notice.outcome.status,'development');assert.equal(state.records.job.find(j=>j.id===f.job.id).endAt,f.job.endAt)
  await p.goto(h.origin+'/app/jobs');await p.getByText('Shop time zone for customer promises',{exact:true}).click()
  const zoneForm=p.locator('form:has(input[name="command"][value="promise.timeZone"])');await zoneForm.getByLabel('Shop time zone',{exact:true}).fill('America/Chicago');await zoneForm.getByLabel('Reason for time zone change',{exact:true}).fill('The workshop is based in Illinois');await shot('06-shop-zone-form',zoneForm);await zoneForm.getByRole('button',{name:'Save shop time zone',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.match(await p.locator('#promise-plan').innerText(),/America\/Chicago/,'FLOW-002 native installation zone setting persists');await shot('06-shop-zone-settings',p.locator('#promise-plan').getByText('Customer promises use shop time: America/Chicago.',{exact:true}))
  await p.goto(url);assert.match(await panel().innerText(),/Customer pickup promises use shop time \(America\/Chicago\)/);assert.match(await panel().innerText(),/Customer notice receipts[\s\S]*America\/New_York/,'FLOW-002 the earlier customer notice retains its original shop zone');await shot('07-retained-notice-zone',panel().locator('ul').filter({hasText:'Development outbox only; not sent'}))
  const tech=await open(f.tech.cookie,390);await tech.goto(url);const text=await tech.locator('#promises').innerText();assert.match(text,/Front brake pads/);assert.match(text,/Labor remaining: 1 hours/);assert.equal(await tech.getByRole('button',{name:'Approve and email revised promise',exact:true}).count(),0)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
