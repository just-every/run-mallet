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
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}}
  for(const [kind,path,heading]of [['appointment','/app/bookings','Appointment email follow-up'],['declined','/app/jobs/'+declined.job.id,'Declined-work email follow-up']]){
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
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
