import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {authorise,booking,estimate,installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
// FLOW-004 / FLOW-005 native forms: helper, dependent subtasks, a mention, and a handoff the specialist acknowledges at 1440/390.
export async function collaborationBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  await shopSetup(h);const door=publicDoor(h.origin,h.owner),lead=await door.person('morgan-crew@example.test'),specialist=await door.person('rio-crew@example.test'),advisor=await door.person('casey-crew@example.test','admin')
  const {job}=await booking(h,{technicianId:lead.id});await authorise(h,await estimate(h,job))
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const errors=[],open=async cookie=>{const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'});await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  await mkdir('.cache/collaboration-browser',{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [390,1440]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'FLOW-004 / FLOW-005 responsive '+name+' '+width);await p.screenshot({path:`.cache/collaboration-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  const go=async(p,path)=>{await p.goto(h.origin+path);return p.locator('#crew')},submit=async(p,button)=>{await button.click();await p.waitForLoadState('domcontentloaded')}
  const owner=await open(h.owner);let crew=await go(owner,'/app/jobs/'+job.id)
  await crew.getByLabel('Add a helper technician').selectOption(specialist.id);await submit(owner,crew.getByRole('button',{name:'Add helper'}))
  const tech=await open(lead.cookie);crew=await go(tech,'/app/jobs/'+job.id)
  await crew.getByText('Add a subtask').click();await crew.getByLabel('Subtask',{exact:true}).fill('Scan codes');await crew.getByLabel('Assign to').selectOption(lead.id);await submit(tech,crew.getByRole('button',{name:'Add subtask'}))
  crew=tech.locator('#crew');await crew.getByText('Add a subtask').click();await crew.getByLabel('Subtask',{exact:true}).fill('Replace ignition coil');await crew.getByLabel('Assign to').selectOption(specialist.id);await crew.getByLabel('Scan codes').check();await submit(tech,crew.getByRole('button',{name:'Add subtask'}))
  crew=tech.locator('#crew');await crew.getByLabel('Staff note (never shown to customers)').fill('Coil 3 arcing; harness quote needed');await crew.getByLabel(/casey crew \(service advisor\)/).check();await submit(tech,crew.getByRole('button',{name:'Add note'}))
  const spec=await open(specialist.cookie);crew=await go(spec,'/app/jobs/'+job.id);assert.match(await crew.innerText(),/Replace ignition coil[\s\S]*waiting on dependencies/,'FLOW-004 the dependent subtask waits');assert.equal(await crew.getByRole('button',{name:'Complete subtask'}).count(),0)
  crew=await go(tech,'/app/jobs/'+job.id);await submit(tech,crew.getByRole('button',{name:'Complete subtask'}))
  crew=await go(spec,'/app/jobs/'+job.id);await shot(spec,'01-helper-subtasks',crew);await submit(spec,crew.getByRole('button',{name:'Complete subtask'}))
  const adv=await open(advisor.cookie);await adv.goto(h.origin+'/app/jobs');const waiting=adv.locator('#waiting');assert.match(await waiting.innerText(),/morgan crew mentioned you: Coil 3 arcing/);await shot(adv,'02-advisor-mention',waiting)
  crew=await go(adv,'/app/jobs/'+job.id);await submit(adv,crew.getByRole('button',{name:'Mark mention seen'}))
  crew=await go(tech,'/app/jobs/'+job.id);await crew.getByText('Hand off this repair').click();await crew.getByLabel('Hand to specialist').selectOption(specialist.id);await crew.getByLabel('Work so far and what is next').fill('Codes scanned and coil replaced; road test left');await shot(tech,'03-propose-handoff',crew);await submit(tech,crew.getByRole('button',{name:'Propose handoff'}))
  await spec.goto(h.origin+'/app/jobs');const mine=spec.locator('#waiting');assert.match(await mine.innerText(),/Handoff: Brake service[\s\S]*road test left/);await shot(spec,'04-handoff-waiting',mine)
  await submit(spec,mine.getByRole('button',{name:'Acknowledge and take over'}))
  crew=await go(owner,'/app/jobs/'+job.id);const text=await crew.innerText();assert.match(text,/rio crew · lead/);assert.match(text,/Handover receipt[\s\S]*morgan crew → rio crew[\s\S]*road test left/);assert.match(text,/Time on this repair/);await shot(owner,'05-handover-receipt',crew)
  assert.equal((await h.state()).records.job.find(j=>j.id===job.id).technicianId,specialist.id)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
