import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {appointmentFixture,declinedFixture,outreachInstallation,approveAppointment} from './support/outreach-journey.mjs'
export async function outreachBrowser(){
 const h=await outreachInstallation({network:true,secureNetwork:true,assets:true,mailService:async m=>m.subject==='Your appointment reminder'?Response.json({error:'synthetic-mallet-740'},{status:422}):Response.json({id:crypto.randomUUID()})});let browser
 try{
  const {appointment}=await appointmentFixture(h),declined=await declinedFixture(h)
  await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/outreach-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon-only controls have tooltips');await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}}
  await p.setViewportSize({width:1440,height:1000});await p.goto(h.origin+'/app/bookings')
  const section=p.getByRole('heading',{name:'Appointment email follow-up',exact:true}).locator('..')
  let f=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.consent"]')})
  await f.getByLabel('Customer permission time with UTC offset').fill('2026-10-28T07:00:00-04:00')
  await f.getByLabel('Permission capture channel').selectOption('telephone')
  await f.getByLabel('Customer permission evidence reference').fill('synthetic-mallet-741 telephone permission for this appointment reminder and instructions')
  await f.getByText('The customer affirmatively gave the displayed permission.').check()
  await f.getByRole('button',{name:'Record customer permission',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal((await h.state()).records.outreachConsent[0].captureChannel,'telephone')
  const prepare=async()=>{
   await p.setViewportSize({width:1440,height:1000})
   const form=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.prepare"]')})
   await form.getByLabel('Due time with UTC offset').fill('2026-11-01T09:00:00-05:00');await form.getByLabel('Expiry with UTC offset').fill('2026-11-01T18:00:00Z');await form.getByLabel('Pre-visit instructions',{exact:true}).fill('Bring the service record.')
   await form.getByRole('button',{name:'Prepare email for review'}).click();await p.waitForLoadState('domcontentloaded')
  }
  const approve=async()=>{
   const form=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.approve"]')})
   await form.getByText('I approve this exact recipient, email, consent, schedule, hours and expiry.').check();await form.getByRole('button',{name:'Approve one email'}).click();await p.waitForLoadState('domcontentloaded')
  }
  await prepare();assert.equal((await h.state()).records.outreach[0].status,'draft');assert.match(await section.innerText(),/Bring the service record/);assert.match(await section.innerText(),/private appointment management link/);await shot('appointment-exact-review')
  await p.setViewportSize({width:1440,height:1000});await approve();assert.equal((await h.state()).records.outreach[0].status,'pending')
  await h.cron('2026-11-01T14:00:00Z');await p.reload();assert.equal((await h.state()).records.outreach[0].status,'failed');assert.match(await section.innerText(),/Staff review required; no automatic retry/)
  const resolve=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.resolve"]')})
  await resolve.getByLabel('Staff resolution evidence').fill('synthetic-mallet-742 owner checked the failed provider handoff and confirmed current customer permission')
  await resolve.getByRole('button',{name:'Record resolution'}).click();await p.waitForLoadState('domcontentloaded');assert.equal((await h.state()).records.outreach[0].resolution.by.role,'owner');await shot('appointment-failure-resolved')
  await prepare();const retry=(await h.state()).records.outreach.find(r=>r.status==='draft');await approve();assert.equal((await h.state()).records.outreach.find(r=>r.id===retry.id).status,'pending')
  const withdraw=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.withdraw"]')})
  await withdraw.getByLabel('Customer withdrawal evidence').fill('synthetic-mallet-743 customer withdrew future reminders by telephone');await withdraw.getByRole('button',{name:'Record customer withdrawal'}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal((await h.state()).records.outreach.find(r=>r.id===retry.id).status,'stopped');assert.ok((await h.state()).records.outreachConsent[0].withdrawnAt);await shot('appointment-withdrawn')
  for(const [kind,path,heading]of [['declined','/app/jobs/'+declined.job.id,'Declined-work email follow-up']]){
   await p.goto(h.origin+path);await shot(kind+'-before')
   const section=p.getByRole('heading',{name:heading,exact:true}).locator('..'),f=section.locator('form').filter({has:p.locator('input[name="command"][value="outreach.schedule"]')})
   await f.getByLabel('Due time with UTC offset').fill('2026-11-01T09:00:00-05:00')
   await f.getByLabel('Expiry with UTC offset').fill('2026-11-01T18:00:00Z')
   await f.getByLabel(kind==='appointment'?'Pre-visit instructions':'Follow-up instructions',{exact:true}).fill('Bring the service record.')
   await f.getByLabel('Customer email consent evidence').fill('Customer asked the owner for this one daytime email.')
   await f.getByText('The customer explicitly requested this email follow-up.').check()
   if(kind==='declined'){await f.getByLabel('Urgency',{exact:true}).fill('Review soon');await f.getByLabel('Current price and availability evidence').fill('Owner checked current stock and approved quote');await f.getByText('I reviewed the exact refreshed price and current availability.').check()}
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
  await appointmentPreferenceBrowser(browser,directory)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}


async function appointmentPreferenceBrowser(browser,directory){
 const h=await outreachInstallation({network:true,secureNetwork:true,assets:true})
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
 try{
  const {appointment,path}=await appointmentFixture(h),p=await context.newPage()
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  await p.goto(h.origin+path)
  const choice=p.getByRole('checkbox',{name:'I choose email and give this reminder permission.'})
  assert.equal(await choice.isChecked(),false)
  await choice.check();await p.getByRole('button',{name:'Request one email reminder',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  const consent=(await h.state()).records.outreachConsent[0]
  assert.equal(consent.by.role,'customer');assert.equal(consent.purpose,'appointment-reminder')
  assert.equal(consent.to,appointment.email);assert.match(await p.locator('main').innerText(),/recorded permission/)
  await shot('customer-reminder-permission')
  await approveAppointment(h,appointment,{},consent);await h.cron('2026-11-01T14:00:00Z')
  assert.equal(h.messages.filter(m=>m.subject==='Your appointment reminder').length,1)
  const pending=await approveAppointment(h,appointment),calls=h.messages.length
  await p.getByRole('button',{name:'Stop appointment reminder email',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.match(await p.locator('main').innerText(),/Appointment reminder email is stopped/)
  assert.equal((await h.state()).records.outreach.find(r=>r.id===pending.id).status,'stopped')
  assert.equal((await h.state()).records.appointment[0].status,'confirmed')
  await h.cron('2026-11-01T14:15:00Z');assert.equal(h.messages.length,calls)
  await shot('customer-reminder-stopped')
 }finally{await context.close();await h.close()}
}
