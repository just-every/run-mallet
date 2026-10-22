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
// EST-006: chase policy, advisor queue, per-link reminders and the customer's Stop reminders door at 1440/390.
export async function chaseBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  await shopSetup(h);const tech=await publicDoor(h.origin,h.owner).person('morgan-chase@example.test')
  const {asset,job:first}=await booking(h,{technicianId:tech.id}),second=(await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),technicianId:tech.id,startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T10:00:00Z'})).job
  for(const job of [first,second]){const q=await estimate(h,job);await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})}
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const errors=[],open=async(cookie,width)=>{const c=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/Los_Angeles',locale:'en-US',hasTouch:width<500});if(cookie)await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  await mkdir('.cache/chase-browser',{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [390,1440]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'EST-006 responsive '+name+' '+width);await p.screenshot({path:`.cache/chase-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  const o=await open(h.owner,1440);await o.goto(h.origin+'/app/approvals');const policy=o.locator('#chase-policy')
  await policy.getByLabel('Approval links expire after (days, 1–7)').fill('7');await policy.getByLabel('Reminder days after sending (up to three, comma separated)').fill('2, 6');await shot(o,'01-chase-policy',policy)
  await policy.getByRole('button',{name:'Save chase policy'}).click();await o.waitForLoadState('domcontentloaded')
  assert.deepEqual((await h.state()).records.chasePolicy.map(p=>[p.linkDays,p.reminderDays]),[[7,[2,6]]],'EST-006 the native form saves expiry and reminder steps')
  await o.goto(h.origin+'/app/jobs/'+first.id);const panel=o.locator('#approval-links');assert.equal(await panel.getByLabel('Valid for days (1–7)').inputValue(),'7')
  await panel.getByRole('button',{name:'Email approval link',exact:true}).click();await o.waitForLoadState('domcontentloaded');const url=(await o.locator('pre').innerText()).trim()
  await o.goto(h.origin+'/app/jobs/'+first.id);assert.match(await panel.innerText(),/Reminder 1 \(day 2\)[\s\S]*scheduled[\s\S]*Reminder 2 \(day 6\)/);await shot(o,'02-job-reminders',panel)
  const phone=await open('',390);await phone.goto(url);const stop=phone.getByRole('button',{name:'Stop reminders',exact:true});await shot(phone,'03-customer-stop',stop)
  await stop.click();await phone.waitForLoadState('domcontentloaded');assert.match(await phone.locator('main').innerText(),/will not send you automatic estimate reminders/);await shot(phone,'04-customer-stopped',phone.locator('main'))
  await o.goto(h.origin+'/app/jobs/'+first.id);assert.match(await panel.innerText(),/Reminders stopped[\s\S]*the customer opted out of reminders/,'EST-006 staff see why reminders stopped')
  // A one-day link expires unanswered; the advisor resolves the task from the queue.
  await o.goto(h.origin+'/app/jobs/'+second.id);await panel.getByLabel('Valid for days (1–7)').fill('1');await panel.getByRole('button',{name:'Email approval link',exact:true}).click();await o.waitForLoadState('domcontentloaded')
  const link=(await h.state()).records.approvalLink.find(l=>l.jobId===second.id);await h.cron(Date.parse(link.expiresAt)+60_000)
  await o.goto(h.origin+'/app/approvals');const tasks=o.locator('#chase-tasks');assert.match(await tasks.innerText(),/Estimate unanswered[\s\S]*expired undecided/);await shot(o,'05-advisor-task',tasks);await shot(o,'06-opt-outs',o.locator('#chase-opt-outs'))
  await tasks.getByLabel('What you did').fill('Phoned the customer; decision by Friday');await tasks.getByRole('button',{name:'Resolve task'}).click();await o.waitForLoadState('domcontentloaded')
  assert.match(await o.locator('#chase-tasks').innerText(),/No open tasks/);assert.equal((await h.state()).records.chaseTask[0].note,'Phoned the customer; decision by Friday')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
