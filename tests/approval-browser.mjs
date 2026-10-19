import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {booking,estimate,installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
export async function approvalBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  await shopSetup(h);const tech=await publicDoor(h.origin,h.owner).person('morgan-approve@example.test')
  const {job}=await booking(h,{technicianId:tech.id});let q=await estimate(h,job);q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const errors=[],open=async(cookie,width)=>{const c=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/Los_Angeles',locale:'en-US',hasTouch:width<500});if(cookie)await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  await mkdir('.cache/approval-browser',{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [390,1440]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'EST-003 responsive '+name+' '+width);await p.screenshot({path:`.cache/approval-browser/${name}-${width}.png`})}await p.setViewportSize({width:390,height:1000})}
  const o=await open(h.owner,1440);await o.goto(h.origin+'/app/jobs/'+job.id);const panel=o.locator('#approval-links');await shot(o,'01-advisor-send',panel)
  await panel.getByRole('button',{name:'Email approval link',exact:true}).click();await o.waitForLoadState('domcontentloaded')
  assert.match(await o.locator('main').innerText(),/development mail outbox[\s\S]*not sent/,'EST-003 the development outbox is never claimed as a send');const url=(await o.locator('pre').innerText()).trim()
  const phone=await open('',390);await phone.goto(url);await shot(phone,'02-customer-estimate',phone.locator('main'))
  const consent=phone.getByRole('checkbox');assert.match(await consent.locator('..').innerText(),/sign and receive this record electronically[\s\S]*paper copy[\s\S]*by phone or in person/,'EST-003 electronic-record consent and paper-copy instructions precede signing');assert.equal(await consent.isChecked(),false);assert.equal(await consent.getAttribute('required'),'');assert.ok(await consent.evaluate(e=>!!(e.compareDocumentPosition(e.form.querySelector('button'))&Node.DOCUMENT_POSITION_FOLLOWING)),'EST-003 consent is before the submit decision');
  const [pads,labor]=q.revisions[0].lines
  await phone.locator(`select[name="line-${pads.id}"]`).selectOption('approve');await phone.locator(`select[name="line-${labor.id}"]`).selectOption('decline')
  await phone.getByLabel('Your full name',{exact:true}).fill('Dana Brooks');await phone.getByRole('checkbox').check();await shot(phone,'03-customer-signs',phone.getByRole('button',{name:'Sign and submit decision',exact:true}))
  await phone.getByRole('button',{name:'Sign and submit decision',exact:true}).click();await phone.waitForLoadState('domcontentloaded')
  const receipt=await phone.locator('main').innerText();assert.match(receipt,/sign and receive this record electronically[\s\S]*paper copy[\s\S]*by phone or in person/,'EST-003 receipt retains the disclosure');await shot(phone,'04-signed-receipt',phone.locator('main'));assert.match(receipt,/Signed by Dana Brooks[\s\S]*Approved\s+Brake pads[\s\S]*Declined\s+Replace and tune[\s\S]*Receipt SHA-256/)
  await o.goto(h.origin+'/app/jobs/'+job.id);await shot(o,'05-staff-receipt',o.locator('#approval-links'));assert.match(await o.locator('#approval-links').innerText(),/Signed by Dana Brooks/)
  const quote=(await h.state()).records.estimate.find(x=>x.id===q.id);assert.deepEqual(quote.authorisation.lineIds,[pads.id])
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
