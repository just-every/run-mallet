import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {reportJourney} from './support/report-journey.mjs'
export async function reportBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const {a,b,advisor,q}=await reportJourney(h,{person:publicDoor(h.origin,h.owner).person})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const open=async cookie=>{const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Chicago',locale:'en-US'});await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  const errors=[],owner=await open(h.owner),adv=await open(advisor.cookie),tech=await open(a.cookie)
  await mkdir('.cache/report-browser',{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'REPORT-003 responsive '+name+' '+width);await p.screenshot({path:`.cache/report-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  await owner.goto(h.origin+'/app/jobs');await owner.getByRole('link',{name:'Technician efficiency',exact:true}).click();await owner.waitForLoadState('domcontentloaded')
  const from=owner.getByLabel('From (UTC date)',{exact:true});await from.fill(q.slice(6,16));await owner.getByRole('button',{name:'Show report',exact:true}).click();await owner.waitForLoadState('domcontentloaded')
  const cardA=owner.locator('#tech-'+a.id),cardB=owner.locator('#tech-'+b.id)
  await shot(owner,'01-owner-report',cardA);assert.match(await cardA.innerText(),/150\.0%[\s\S]*26\.7%[\s\S]*\$225\.00/)
  await cardA.getByText('Timers, edits and assignments',{exact:true}).click();await shot(owner,'02-drill-through',cardA);assert.match(await cardA.innerText(),/Paper ticket shows brake job ended after one hour/)
  await cardB.getByText('Set hourly pay rate',{exact:true}).click();await cardB.getByLabel('Hourly pay rate (USD)',{exact:true}).fill('20');await cardB.getByLabel('Effective from (UTC date)',{exact:true}).fill(q.slice(6,16));await cardB.getByLabel('Reason for this rate',{exact:true}).fill('Starting wage');await shot(owner,'03-rate-form',cardB)
  await cardB.getByRole('button',{name:'Save pay rate',exact:true}).click();await owner.waitForLoadState('domcontentloaded')
  assert.match(await owner.locator('#tech-'+b.id).innerText(),/Pay cost: \$80\.00/,'REPORT-003 4 h net attendance at $20.00/h')
  await adv.goto(h.origin+'/app/reports/technicians'+q);await shot(adv,'04-advisor-report',adv.locator('main'));assert.doesNotMatch(await adv.locator('main').innerText(),/Pay cost|\$20\.00|\$30\.00/)
  await tech.goto(h.origin+'/app/reports/technicians'+q);await shot(tech,'05-technician-own-row',tech.locator('main'));assert.equal(await tech.locator('section[id^="tech-"]').count(),1)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
