import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,archive,restore} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {appointmentFixture,declinedFixture,declinedScheduleFields,OUTREACH_CLOCK} from './support/outreach-journey.mjs'
export async function outreachBrowser(){
 let reject=false
 const h=await installation({clock:OUTREACH_CLOCK,network:true,secureNetwork:true,assets:true,mailService:async()=>reject?Response.json({error:'synthetic-mallet-840'},{status:422}):Response.json({id:'synthetic-mallet-841'})});let browser
 try{
  const {appointment}=await appointmentFixture(h),declined=await declinedFixture(h)
  await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/outreach-browser';await mkdir(directory,{recursive:true})
  const shot=async (name,target=p)=>{for(const width of [1440,390]){await target.setViewportSize({width,height:1000});assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await target.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon-only controls have tooltips');await target.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true});if(name.startsWith('declined'))await target.getByRole('heading',{name:'Declined-work email follow-up',exact:true}).locator('..').screenshot({path:join(directory,name+'-panel-'+width+'.png')})}}
  for(const [kind,path,heading]of [['appointment','/app/bookings','Appointment email follow-up'],['declined','/app/jobs/'+declined.job.id,'Declined-work email follow-up']]){
   await p.goto(h.origin+path);await shot(kind+'-before')
   let section=p.getByRole('heading',{name:heading,exact:true}).locator('..')
   if(kind==='declined'){
    const consent=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.consent"]')})
    await consent.getByLabel('Customer permission time with UTC offset').fill('2026-10-01T09:00:00-04:00')
    await consent.getByLabel('Permission captured through').selectOption('telephone')
    await consent.getByLabel('Customer permission evidence reference').fill('Customer telephone permission for this declined item; synthetic-mallet-810')
    await consent.getByText('The customer affirmatively gave the displayed declined-item permission.').check()
    await consent.getByRole('button',{name:'Record customer permission',exact:true}).click();await p.waitForLoadState('domcontentloaded')
    section=p.getByRole('heading',{name:heading,exact:true}).locator('..')
    const review=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.availability"]')})
    await review.getByLabel('Native stock for Brake pads').selectOption(declined.stock.id)
    await review.getByLabel('Stock bin for Brake pads').selectOption(declined.bin.id)
    await review.getByLabel('Availability evidence expiry with UTC offset').fill('2026-11-01T18:00:00Z')
    await review.getByLabel('Availability review evidence').fill('Owner reviewed native receiving and booked repair; synthetic-mallet-811')
    await review.getByRole('button',{name:'Review native availability',exact:true}).click();await p.waitForLoadState('domcontentloaded')
    section=p.getByRole('heading',{name:heading,exact:true}).locator('..')
   }
   const f=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.schedule"]')})
   await f.getByLabel('Due time with UTC offset').fill('2026-11-01T09:00:00-05:00')
   await f.getByLabel('Expiry with UTC offset').fill('2026-11-01T18:00:00Z')
   await f.getByLabel(kind==='appointment'?'Pre-visit instructions':'Follow-up instructions',{exact:true}).fill('Bring the service record.')
   if(kind==='appointment'){
    await f.getByLabel('Customer email consent evidence').fill('Customer asked the owner for this one daytime email.')
    await f.getByText('The customer explicitly requested this email follow-up.').check()
   }
   if(kind==='declined'){await f.getByLabel('Urgency',{exact:true}).fill('Review soon');await f.getByText('I approve one email with this recipient, refreshed quote, consent and native availability evidence.').check()}
   await shot(kind+'-filled')
   await f.getByRole('button',{name:'Schedule email',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   await shot(kind+'-pending')
   assert.equal((await h.state()).records.outreach.find(r=>r.kind===kind).status,'pending')
   const stop=p.locator('form').filter({has:p.locator('input[name="command"][value="outreach.stop"]')})
   await stop.getByLabel('Stop reason').fill('Customer opted out at the counter')
   await stop.getByRole('button',{name:'Stop follow-up',exact:true}).click();await p.waitForLoadState('domcontentloaded');await shot(kind+'-stopped')
   assert.equal((await h.state()).records.outreach.find(r=>r.kind===kind).status,'stopped')
  }
  // The screen shows source invalidation and exact failed-handoff recovery.
  const noMail=h.messages.filter(m=>m.subject==='Your declined-work follow-up').length
  const stale=await h.command('outreach.schedule',await declinedScheduleFields(h,declined))
  await h.command('stock.receive',{itemBarcode:declined.stock.barcode,binBarcode:declined.bin.barcode,quantity:1,expectedQuantity:1,reference:'synthetic-mallet-842',reason:'Native stock changed after email approval'})
  await h.cron('2026-11-01T14:00:00Z')
  assert.equal(h.messages.filter(m=>m.subject==='Your declined-work follow-up').length,noMail)
  assert.equal((await h.state()).records.outreach.find(r=>r.id===stale.id).status,'stopped')
  await p.goto(h.origin+'/app/jobs/'+declined.job.id);assert.match(await p.locator('main').innerText(),/Native availability sources changed/);await shot('declined-stock-invalidated')
  await h.command('reading.record',{jobId:declined.job.id,version:(await h.state()).records.job.find(j=>j.id===declined.job.id).version,unit:'miles',stage:'intake',value:1300,observedAt:'2026-10-02T09:00:00Z'})
  const failed=await h.command('outreach.schedule',await declinedScheduleFields(h,declined));reject=true;await h.cron('2026-11-01T14:10:00Z')
  assert.equal((await h.state()).records.outreach.find(r=>r.id===failed.id).status,'failed')
  await p.goto(h.origin+'/app/jobs/'+declined.job.id)
  const resolution=p.locator('form').filter({has:p.locator('input[name="command"][value="outreach.resolve"]')})
  await resolution.getByLabel('Human resolution evidence').fill('Owner inspected the failed handoff; fresh permission and approval required; synthetic-mallet-843')
  await shot('declined-failed-review');await resolution.getByRole('button',{name:'Record resolution',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal((await h.state()).records.outreach.find(r=>r.id===failed.id).resolution.evidence,'Owner inspected the failed handoff; fresh permission and approval required; synthetic-mallet-843')
  assert.match(await p.locator('main').innerText(),/Staff resolution recorded; no automatic retry/)
  await p.getByText('Exact email and evidence',{exact:true}).last().click();assert.match(await p.locator('main').innerText(),/USD 64.50/);assert.match(await p.locator('main').innerText(),/declined-permission-v1/);await shot('declined-resolved-history')
  reject=false
  await h.command('outreach.schedule',await declinedScheduleFields(h,declined))
  const backup=await archive(h),fresh=await installation({clock:OUTREACH_CLOCK,network:true,secureNetwork:true,assets:true,bindings:{OWNER_EMAIL:'synthetic-mallet-844'+String.fromCharCode(64)+'example.test'}})
  try{
   await restore(fresh,backup);for(const kind of ['outreach','declinedConsent','declinedAvailability'])assert.deepEqual((await fresh.state()).records[kind],(await h.state()).records[kind])
   await shopSetup(fresh)
   await fresh.cron('2026-11-01T14:20:00Z');assert.equal(fresh.messages.filter(m=>m.subject==='Your declined-work follow-up').length,0)
   const recovered=await browser.newContext({ignoreHTTPSErrors:true})
   try{await recovered.addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})));const restored=await recovered.newPage();await restored.goto(fresh.origin+'/app/jobs/'+declined.job.id);assert.match(await restored.locator('main').innerText(),/authority unavailable/);await shot('declined-inert-recovery',restored)}finally{await recovered.close()}
  }finally{await fresh.close()}
  await p.goto(h.origin+'/app/jobs/'+declined.job.id)
  const inapplicable=p.locator('form').filter({has:p.locator('input[name="command"][value="decline.inapplicable"]')})
  await inapplicable.getByLabel('Current finding review evidence').fill('Owner inspected the vehicle; this finding no longer applies')
  await shot('declined-inapplicable-review');await inapplicable.getByRole('button',{name:'Finding no longer applies'}).click();await p.waitForLoadState('domcontentloaded');await shot('declined-inapplicable-stopped')
  assert.match(await p.locator('main').innerText(),/Finding no longer applies: Owner inspected the vehicle/);assert.ok((await h.state()).records.declinedWork[0].inapplicable);assert.equal(await p.getByRole('heading',{name:'Declined-work email follow-up',exact:true}).locator('..').getByRole('button',{name:'Schedule email'}).count(),0)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
