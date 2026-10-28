import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {appointmentFixture,declinedFixture} from './support/outreach-journey.mjs'
export async function outreachBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  const {appointment}=await appointmentFixture(h),declined=await declinedFixture(h)
  await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/outreach-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon-only controls have tooltips');await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}}
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
  await p.goto(h.origin+'/app/jobs/'+declined.job.id)
  const inapplicable=p.locator('form').filter({has:p.locator('input[name="command"][value="decline.inapplicable"]')})
  await inapplicable.getByLabel('Current finding review evidence').fill('Owner inspected the vehicle; this finding no longer applies')
  await shot('declined-inapplicable-review');await inapplicable.getByRole('button',{name:'Finding no longer applies'}).click();await p.waitForLoadState('domcontentloaded');await shot('declined-inapplicable-stopped')
  assert.match(await p.locator('main').innerText(),/Finding no longer applies: Owner inspected the vehicle/);assert.ok((await h.state()).records.declinedWork[0].inapplicable);assert.equal(await p.getByRole('heading',{name:'Declined-work email follow-up',exact:true}).locator('..').getByRole('button',{name:'Schedule email'}).count(),0)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
