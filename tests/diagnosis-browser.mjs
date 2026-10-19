import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {booking,installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {inspectionPhoto} from './support/inspection-photo.mjs'
import {coilDiagnosis,shopSetup} from './support/diagnosis-journey.mjs'
export async function diagnosisBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  await shopSetup(h);const door=publicDoor(h.origin,h.owner),tech=await door.person('dana-diag@example.test'),advisor=await door.person('alex-advisor-diag@example.test','admin')
  const {job}=await booking(h,{technicianId:tech.id});await inspectionPhoto(h,job.id,tech.cookie,'Misfire coil')
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const errors=[],open=async cookie=>{const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Denver',locale:'en-US'});if(cookie)await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  await mkdir('.cache/diagnosis-browser',{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'DIAG-001 responsive '+name+' '+width);await p.screenshot({path:`.cache/diagnosis-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  const t=await open(tech.cookie),panel=t.locator('#diagnosis')
  await t.goto(h.origin+'/app/jobs/'+job.id);await panel.getByText('Record diagnosis',{exact:true}).click()
  const f=panel.locator('form:has([name=command][value="diagnosis.record"])').first()
  await f.getByLabel('Complaint (customer concern)',{exact:true}).fill(coilDiagnosis.complaint);await f.getByLabel('Cause',{exact:true}).fill(coilDiagnosis.cause);await f.getByLabel('Correction',{exact:true}).fill(coilDiagnosis.correction)
  await f.getByLabel('Trouble codes (one per line, code first)',{exact:true}).fill('P0301 Cylinder 1 misfire\nP0300');await f.getByLabel('Measurements (one per line: name = value unit)',{exact:true}).fill('Compression cylinder 1 = 165 psi\nCoil primary resistance = 0.4 ohm')
  await f.getByLabel('Test method',{exact:true}).fill(coilDiagnosis.testMethod);await f.getByRole('checkbox').first().check();await f.getByLabel('Staff-only note (never shown to the customer)',{exact:true}).fill(coilDiagnosis.staffNote);await f.getByLabel('Customer explanation',{exact:true}).fill(coilDiagnosis.customerExplanation)
  await shot(t,'01-technician-form',f);await f.getByRole('button',{name:'Save diagnosis',exact:true}).click();await t.waitForLoadState('domcontentloaded')
  await shot(t,'02-recorded-private-note',t.locator('#diagnosis'));assert.match(await t.locator('#diagnosis').innerText(),/Staff only: Coil costs us \$38\.12[\s\S]*Not shared with the customer|Not shared with the customer[\s\S]*Staff only: Coil costs us \$38\.12/)
  const a=await open(advisor.cookie);await a.goto(h.origin+'/app/jobs/'+job.id);await a.locator('#diagnosis').getByRole('button',{name:'Share revision 1 with the customer',exact:true}).click();await a.waitForLoadState('domcontentloaded')
  const o=await open(h.owner);await o.goto(h.origin+'/app/jobs/'+job.id);await shot(o,'03-owner-link-form',o.locator('#diagnosis'));await o.locator('#diagnosis').getByRole('button',{name:'Create customer inspection link',exact:true}).click();await o.waitForLoadState('domcontentloaded')
  const url=(await o.locator('pre').innerText()).trim();assert.match(url,/\/inspection\/[A-Za-z0-9_-]{43}$/);await shot(o,'04-link-shown-once',o.locator('main'))
  const customer=await open('');await customer.goto(url);const text=await customer.locator('main').innerText();await shot(customer,'05-customer-view',customer.locator('main'))
  assert.match(text,/P0301[\s\S]*Compression cylinder 1: 165 psi[\s\S]*The ignition coil for cylinder 1 has failed/);assert.doesNotMatch(text,/38\.12|Coil costs us|misfire-coil/)
  await o.goto(h.origin+'/app/jobs/'+job.id);assert.match(await o.locator('#diagnosis').innerText(),/Not sent by Mallet · 1 view/)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
