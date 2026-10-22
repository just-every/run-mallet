import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {checkInTemplate} from './support/check-in-journey.mjs'

export async function checkInBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  await shopSetup(h);await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:true})
  const asset=await h.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V',identifier:'OH-DANA-17'})
  const template=await h.command('intakeForm.publish',{...checkInTemplate,name:'After-hours vehicle diagnostic intake'})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const owner=await browser.newContext(),customer=await browser.newContext({viewport:{width:390,height:1000}})
  await owner.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await owner.newPage(),c=await customer.newPage(),errors=[];for(const page of [p,c])page.on('pageerror',e=>errors.push(e.message))
  const dir=process.env.MALLET_CHECKIN_PROOF_DIR??'.cache/check-in-browser';await mkdir(dir,{recursive:true})
  const shot=async(page,name,mask=[])=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true,mask})}}
  const form=command=>p.locator(`form:has(input[name="command"][value="${command}"])`)
  await p.goto(h.origin+'/app/jobs');await shot(p,'checkin-01-repair-orders-door');await p.getByRole('link',{name:'Counter & after-hours check-in queue'}).click();await shot(p,'checkin-02-staff-queue')
  await form('checkin.issue').locator('[name="templateSource"]').selectOption(JSON.stringify({id:template.id,version:template.version}));await form('checkin.issue').getByRole('button',{name:'Create check-in link'}).click();await p.waitForLoadState('domcontentloaded')
  await shot(p,'checkin-02b-private-link-issued',[p.locator('pre')])
  const url=await p.getByRole('link',{name:'Open customer check-in',exact:true}).getAttribute('href')
  // The one-time bearer URL is never retained in a screenshot.
  await c.goto(url);await shot(c,'checkin-03-customer-after-hours')
  const fields={contactName:'Dana Brooks',email:'dana@example.test',phone:'614-555-0117',vehicleIdentifier:asset.identifier,requestedWork:'Investigate a cold-start noise. Brake replacement is requested, not approved.',keyDrop:'One key in a sealed envelope in the shop drop box.',typedName:'Dana Brooks','answer:concern':'Only on the first cold start.'}
  for(const [name,value]of Object.entries(fields))await c.locator(`[name="${name}"]`).fill(value)
  await c.locator('[name="diagnosticConsent"]').check();await c.locator('[name="electronicConsent"]').check();await c.getByRole('button',{name:'Submit check-in request'}).click();await c.waitForLoadState('domcontentloaded')
  assert.match(await c.getByRole('alert').innerText(),/Acknowledge/);assert.equal(await c.getByLabel('Your name',{exact:true}).inputValue(),'Dana Brooks');await shot(c,'checkin-04-separate-terms-required')
  await c.locator('[name="acknowledgment:storageCharges"]').check();await c.getByRole('button',{name:'Submit check-in request'}).click();await c.waitForLoadState('domcontentloaded');await shot(c,'checkin-05-signed-queue-receipt')
  let state=await h.state();const request=state.records.counterIntake[0],receipt=request.receipt;assert.equal(request.status,'queued');assert.equal(state.records.job?.length??0,0);assert.equal(state.records.estimate?.length??0,0)
  await c.goto(url);assert.ok((await c.locator('main').innerText()).includes(receipt.sha256))
  await p.goto(h.origin+'/app/check-ins');await shot(p,'checkin-06-advisor-review')
  const confirm=form('checkin.confirm');await confirm.locator('[name="assetSource"]').selectOption(JSON.stringify({id:asset.id,version:asset.version}))
  for(const [name,value]of Object.entries({contactEvidence:'Kayla called Dana using the existing customer record and confirmed the request.',vehicleEvidence:'Kayla inspected the plate and VIN and matched the existing Honda.',keyReceipt:'Kayla opened the sealed envelope and counted one physical key.',bayId:'Bay 1',startAt:'2026-10-23T09:00:00-04:00',endAt:'2026-10-23T10:00:00-04:00'}))await confirm.locator(`[name="${name}"]`).fill(value)
  await confirm.locator('[name="confirmBooking"]').check();await confirm.locator('[name="confirmDiagnosticSpend"]').check();await confirm.getByRole('button',{name:'Confirm booking & diagnostic spend'}).click();await p.waitForLoadState('domcontentloaded');await shot(p,'checkin-07-confirmed-booking')
  state=await h.state();assert.equal(state.records.counterIntake.length,1);assert.equal(state.records.job.length,1);assert.equal(state.records.estimate.length,1);const estimate=state.records.estimate[0];assert.equal(estimate.authorisation.totals.totalCents,receipt.quote.totals.totalCents);assert.deepEqual(estimate.authorisation.lineIds,receipt.quote.lines.map(l=>l.id));assert.equal(estimate.revisions[0].lines.length,1)
  await p.getByRole('link',{name:'Open confirmed repair'}).click();assert.ok((await p.locator('main').innerText()).includes('Diagnostic assessment'));await shot(p,'checkin-08-diagnostic-only-repair')
  await c.goto(url);assert.match(await c.locator('main').innerText(),/advisor confirmed/);assert.ok(!(await c.locator('main').innerText()).includes('Kayla called Dana'));await c.emulateMedia({media:'print'});await shot(c,'checkin-09-printable-customer-copy');await c.emulateMedia({media:'screen'})
  await p.goto(h.origin+'/app/check-ins');await form('checkin.revoke').getByLabel('Reason to revoke customer link').fill('Dana requested withdrawal of private link access');await form('checkin.revoke').getByRole('button',{name:'Revoke check-in link'}).click();await p.waitForLoadState('domcontentloaded');assert.equal((await c.goto(url)).status(),404);await shot(c,'checkin-10-revoked-link')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
