import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
export async function bookingsBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  await shopSetup(h);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const owner=await browser.newContext(),customer=await browser.newContext();await owner.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await owner.newPage(),c=await customer.newPage(),dir=process.env.MALLET_BOOKING_PROOF_DIR??'.cache/bookings-browser';await mkdir(dir,{recursive:true})
  const shot=async(page,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  await p.goto(h.origin+'/app/jobs');await p.getByRole('link',{name:'Online appointments',exact:true}).click()
  const fields={name:'Brake inspection',location:'Main workshop',skill:'brakes',skills:'brakes, inspection',bayId:'Bay 1',startAt:new Date(Date.now()+86400000).toISOString().slice(0,10)+'T09:00:00Z',endAt:new Date(Date.now()+86400000).toISOString().slice(0,10)+'T12:00:00Z',durationMinutes:'60',leadMinutes:'60'}
  for(const [name,value]of Object.entries(fields))await p.locator(`[name="${name}"]`).fill(value)
  await shot(p,'booking-01-publish');await p.getByRole('button',{name:'Publish service'}).click();await p.waitForLoadState('domcontentloaded');await shot(p,'booking-02-staff-appointments')
  await c.goto(h.origin+'/book');await c.setViewportSize({width:390,height:1000});await shot(c,'booking-03-customer-times')
  const first=c.locator('form:has(input[value="hold"])').first();await first.getByLabel('Your name').fill('Dana Brooks');await first.getByLabel('Confirmation email').fill('dana@example.test');await first.getByRole('checkbox').check();await first.getByRole('button',{name:'Hold this time'}).click();await c.waitForLoadState('domcontentloaded');await shot(c,'booking-04-tentative')
  assert.match(await c.locator('main').innerText(),/held/);await c.getByRole('button',{name:'Confirm appointment',exact:true}).click();await c.waitForLoadState('domcontentloaded');await shot(c,'booking-05-confirmed');assert.match(await c.locator('main').innerText(),/confirmed/)
  await c.getByRole('button',{name:'Move appointment'}).first().click();await c.waitForLoadState('domcontentloaded');await shot(c,'booking-06-rescheduled');await c.getByRole('button',{name:'Cancel appointment',exact:true}).click();await c.waitForLoadState('domcontentloaded');await shot(c,'booking-07-canceled');assert.match(await c.locator('main').innerText(),/canceled/)
  await p.reload();assert.match(await p.locator('main').innerText(),/canceled/);await shot(p,'booking-08-staff-cancellation')
 }finally{await browser?.close();await h.close()}
}
