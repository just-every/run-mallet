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
  const shot=async(p,name,target)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'REPORT-003 responsive '+name+' '+width);assert.deepEqual(await p.locator('main dd').evaluateAll(nodes=>nodes.filter(n=>{const range=document.createRange();range.selectNodeContents(n);return new Set([...range.getClientRects()].map(r=>r.top)).size>1}).map(n=>n.textContent)),[],'Report metric values stay on one line '+name+' '+width);await p.screenshot({path:`.cache/report-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
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
  const {attendanceFixture}=await import('./support/booking-journey.mjs'),appointment=await attendanceFixture(h)
  const day=appointment.startAt.slice(0,10),turnaround='?from='+day+'&to='+day
  await owner.goto(h.origin+'/app/reports/turnaround'+turnaround)
  await owner.getByText('Saved report filters',{exact:true}).click();await owner.getByLabel('Filter name',{exact:true}).fill('Owner turnaround period');await owner.getByRole('button',{name:'Save current filters',exact:true}).click();await owner.waitForLoadState('domcontentloaded');await owner.getByText('Saved report filters',{exact:true}).click();assert.equal(await owner.getByRole('link',{name:'Owner turnaround period',exact:true}).count(),1)
  await shot(owner,'06-turnaround-report',owner.locator('main'))
  const savedFilter=(await h.state()).records.reportFilter.find(f=>f.name==='Owner turnaround period'),scheduleForm=owner.locator('form:has(input[value="reportFilter.schedule"]):has(input[value="'+savedFilter.id+'"])')
  await scheduleForm.getByLabel('Interval in days',{exact:true}).fill('7');await scheduleForm.getByLabel('Scheduled email consent evidence',{exact:true}).fill('Owner explicitly consents to a weekly private report at the native owner address');await scheduleForm.locator('[name="active"]').check();await scheduleForm.locator('[name="consent"]').check();await scheduleForm.getByRole('button',{name:'Save delivery schedule',exact:true}).click();await owner.waitForLoadState('domcontentloaded');await owner.getByText('Saved report filters',{exact:true}).click();assert.match(await owner.locator('main').innerText(),/Local schedule: Active/);await shot(owner,'06b-consented-report-schedule',owner.locator('main'))
  const configured=(await h.state()).records.reportFilter.find(f=>f.id===savedFilter.id),sentAt=new Date(Date.parse(configured.schedule.nextAt)+120000).toISOString()
  await h.cron(sentAt);await owner.reload();await owner.getByText('Saved report filters',{exact:true}).click()
  const savedRow=owner.locator('li').filter({has:owner.getByRole('link',{name:'Owner turnaround period',exact:true})})
  assert.equal(await savedRow.locator('p').filter({hasText:'Last sent time:'}).locator('time').getAttribute('datetime'),sentAt)
  assert.match(await savedRow.locator('p').filter({hasText:'Last outcome:'}).innerText(),/Suppressed in development/)
  assert.equal(await savedRow.getByRole('button',{name:'Turn off schedule',exact:true}).count(),1,'The receipt and off switch share the report screen')
  await shot(owner,'06c-report-schedule-receipt',savedRow)
  await savedRow.getByRole('button',{name:'Turn off schedule',exact:true}).click();await owner.waitForLoadState('domcontentloaded');await owner.getByText('Saved report filters',{exact:true}).click()
  assert.equal((await h.state()).records.reportFilter.find(f=>f.id===savedFilter.id).schedule.active,false)
  assert.equal(await savedRow.getByRole('button',{name:'Turn off schedule',exact:true}).count(),0);await shot(owner,'06d-report-schedule-off',savedRow)
  const attendance=owner.locator('form:has(input[value="booking.attendance"])');await attendance.getByLabel('Observed attendance').selectOption('no-show');await attendance.getByLabel('Staff observation evidence').fill('Owner checked counter log after appointment start.')
  await attendance.getByRole('button',{name:'Record attendance'}).click();await owner.waitForLoadState('domcontentloaded')
  assert.match(await owner.locator('main').innerText(),/1 of 1 observed · 100.0%/)
  await shot(owner,'07-recorded-attendance',owner.locator('main'))
  const originalObservation=(await h.state()).records.appointment.find(a=>a.id===appointment.id).attendance
  await owner.getByText('Attendance observations and correction',{exact:true}).click()
  const correction=owner.locator('form:has(input[value="booking.attendance"])');await correction.getByLabel('Observed attendance').selectOption('arrived');await correction.getByLabel('Staff observation evidence',{exact:true}).fill('synthetic-mallet-60 signed arrival log');await correction.getByLabel('Reason for attendance correction',{exact:true}).fill('synthetic-mallet-61 the signed arrival log was found later')
  await shot(owner,'07b-attendance-correction-form',correction);await correction.getByRole('button',{name:'Record attendance correction',exact:true}).click();await owner.waitForLoadState('domcontentloaded')
  assert.match(await owner.locator('main').innerText(),/0 of 1 observed · 0.0%/)
  assert.deepEqual((await h.state()).records.appointment.find(a=>a.id===appointment.id).attendance,originalObservation)
  await owner.getByText('Attendance observations and correction',{exact:true}).click();assert.match(await owner.locator('main').innerText(),/Owner checked counter log after appointment start/);assert.match(await owner.locator('main').innerText(),/synthetic-mallet-61/);await shot(owner,'07c-attendance-observations',owner.locator('main'))
  await owner.getByText('Stage source events',{exact:true}).first().click();await shot(owner,'08-stage-evidence',owner.locator('main'))
  await tech.goto(h.origin+'/app/reports/turnaround'+turnaround);await shot(tech,'09-scoped-turnaround',tech.locator('main'));assert.match(await tech.locator('main').innerText(),/Unavailable in your scope/);assert.doesNotMatch(await tech.locator('main').innerText(),/Owner checked counter log/)
  for(const p of [owner,tech])assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon-only controls have tooltips')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
