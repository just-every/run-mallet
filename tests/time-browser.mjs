import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {timeJourney} from './support/time-journey.mjs'
export async function timeBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const {tech,job,first}=await timeJourney(h,{person:publicDoor(h.origin,h.owner).person})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=async(cookie)=>{const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'});await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));return c}
  const tc=await context(tech.cookie),oc=await context(h.owner),page=await tc.newPage(),manager=await oc.newPage(),errors=[]
  for(const p of [page,manager])p.on('pageerror',e=>errors.push(e.message))
  await mkdir('.cache/time-browser',{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'TIME-001 responsive '+name+' '+width);await p.screenshot({path:`.cache/time-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  const click=async(p,name)=>{await p.getByRole('button',{name,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await page.goto(h.origin+'/app/jobs');await shot(page,'01-assigned-jobs',page.getByRole('link',{name:'My time & attendance',exact:true}));await page.getByRole('link',{name:'My time & attendance',exact:true}).click()
  await shot(page,'02-shift-totals',page.locator('#time'));await click(page,'Clock in')
  await page.goto(h.origin+'/app');await page.locator(`a.ro[href="/app?ro=${job.id}#ro"]`).click();await page.getByRole('link',{name:'Repair order',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  const timer=page.locator(`form:has([name=command][value="time.start"]):has([name=jobId][value="${job.id}"])`)
  await timer.locator('[name=category]').selectOption('billable');await timer.getByRole('button',{name:'Resume job timer',exact:true}).click();await page.waitForLoadState('domcontentloaded');await shot(page,'03-running-job',page.locator('#time'));await click(page,'Pause job timer')
  await click(page,'Start break');await shot(page,'04-break',page.locator('#time'));await click(page,'End break');await click(page,'Clock out')
  await page.getByText('Your stopped intervals and retained history',{exact:true}).click()
  const correction=page.locator(`form:has([name=command][value="time.correct"]):has([name=entryId][value="${first.id}"])`)
  await correction.locator('..').locator('summary').click();const shortened=new Date(Date.parse(first.revisions.at(-1).endAt)-60000).toISOString();await correction.locator('[name=endAt]').fill(shortened);await correction.getByLabel('Reason for this time correction',{exact:true}).fill('Paper notes confirm first repair ended one minute earlier');await shot(page,'05-technician-correction',correction);await correction.getByRole('button',{name:'Propose time correction',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  const pending=(await h.state()).records.timeCorrection.find(c=>c.reason==='Paper notes confirm first repair ended one minute earlier')
  await manager.goto(h.origin+'/app/time');await manager.getByText('Time correction decisions',{exact:true}).click();const approval=manager.locator(`form:has([name=command][value="time.approveCorrection"]):has([name=correctionId][value="${pending.id}"])`);await shot(manager,'06-manager-decision',approval.locator('..'));await approval.getByRole('button',{name:'Approve time correction',exact:true}).click();await manager.waitForLoadState('domcontentloaded');await manager.getByText('Time correction decisions',{exact:true}).click();await shot(manager,'07-approved-retained-decision',manager.getByText(pending.reason,{exact:true}).locator('..'))
  let current=(await h.state()).records.job.find(j=>j.id===job.id),quote=(await h.state()).records.estimate.find(q=>q.jobId===job.id)
  await h.command('work.record',{jobId:job.id,version:current.version,lineId:quote.revisions[0].lines.find(l=>l.kind==='labor').id,quantity:.25,note:'Authorized initial brake adjustment'},{as:tech.cookie})
  await page.goto(h.origin+'/app/jobs/'+job.id);await shot(page,'08-job-elapsed-versus-sold',page.locator('#time'))
  await page.goto(h.origin+'/app?ro='+job.id);await shot(page,'09-board-clock',page.locator('main'));assert.match(await page.locator('main').innerText(),/clocked 0:59/,'TIME-001 board uses 59 elapsed minutes rather than 0.25 billed hours')
  const entry=(await h.state()).records.timeEntry.find(e=>e.id===first.id);assert.equal(entry.revisions.at(-1).endAt,shortened);assert.equal(entry.revisions.at(-1).approvedBy.id,(await h.state()).actor.id);assert.deepEqual(entry.revisions.slice(0,first.revisions.length),first.revisions)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
