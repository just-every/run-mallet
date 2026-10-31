import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {archive,authorise,booking,estimate,installation,restore} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {collaborationClock,recordHandoffTime,correctHandoffInterval} from './support/collaboration-journey.mjs'
// FLOW-004 / FLOW-005 native forms: helper, dependent subtasks, a mention, and a handoff the specialist acknowledges at 1440/390.
export async function collaborationBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,clock:collaborationClock,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser,fresh
 try{
  await shopSetup(h);const door=publicDoor(h.origin,h.owner),lead=await door.person('morgan-crew@example.test'),specialist=await door.person('rio-crew@example.test'),advisor=await door.person('casey-crew@example.test','admin')
  const {job}=await booking(h,{technicianId:lead.id});await authorise(h,await estimate(h,job))
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const errors=[],open=async(cookie,origin=h.origin)=>{const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'});await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  const proof=process.env.MALLET_COLLABORATION_PROOF_DIR??'.cache/collaboration-browser'
  await mkdir(proof,{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [390,1440]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'FLOW-004 / FLOW-005 responsive '+name+' '+width);await p.screenshot({path:`${proof}/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  const go=async(p,path)=>{await p.goto(h.origin+path);return p.locator('#crew')},submit=async(p,button)=>{await button.click();await p.waitForLoadState('domcontentloaded')}
  const owner=await open(h.owner);let crew=await go(owner,'/app/jobs/'+job.id)
  await crew.getByLabel('Add a helper technician').selectOption(specialist.id);await submit(owner,crew.getByRole('button',{name:'Add helper'}))
  await recordHandoffTime(h,job.id,lead,specialist)
  const tech=await open(lead.cookie);crew=await go(tech,'/app/jobs/'+job.id)
  await crew.getByText('Add a subtask').click();await crew.getByLabel('Subtask',{exact:true}).fill('Scan codes');await crew.getByLabel('Assign to').selectOption(lead.id);await submit(tech,crew.getByRole('button',{name:'Add subtask'}))
  crew=tech.locator('#crew');await crew.getByText('Add a subtask').click();await crew.getByLabel('Subtask',{exact:true}).fill('Replace ignition coil');await crew.getByLabel('Assign to').selectOption(specialist.id);await crew.getByLabel('Scan codes').check();await submit(tech,crew.getByRole('button',{name:'Add subtask'}))
  crew=tech.locator('#crew');await crew.getByLabel('Staff note (never shown to customers)').fill('Coil 3 arcing; harness quote needed');await crew.getByLabel(/casey crew \(service advisor\)/).check();await submit(tech,crew.getByRole('button',{name:'Add note'}))
  const spec=await open(specialist.cookie);crew=await go(spec,'/app/jobs/'+job.id);assert.match(await crew.innerText(),/Replace ignition coil[\s\S]*waiting on dependencies/,'FLOW-004 the dependent subtask waits');assert.equal(await crew.getByRole('button',{name:'Complete subtask'}).count(),0)
  crew=await go(tech,'/app/jobs/'+job.id);await submit(tech,crew.getByRole('button',{name:'Complete subtask'}))
  crew=await go(spec,'/app/jobs/'+job.id);await shot(spec,'01-helper-subtasks',crew);await submit(spec,crew.getByRole('button',{name:'Complete subtask'}))
  crew=await go(tech,'/app/jobs/'+job.id);await crew.getByText('Add a subtask').click();await crew.getByLabel('Subtask',{exact:true}).fill('Road test');await crew.getByLabel('Assign to').selectOption(specialist.id);await submit(tech,crew.getByRole('button',{name:'Add subtask'}))
  const adv=await open(advisor.cookie);await adv.goto(h.origin+'/app/jobs');const waiting=adv.locator('#waiting');assert.match(await waiting.innerText(),/morgan crew mentioned you: Coil 3 arcing/);await shot(adv,'02-advisor-mention',waiting)
  crew=await go(adv,'/app/jobs/'+job.id);await submit(adv,crew.getByRole('button',{name:'Mark mention seen'}))
  crew=await go(tech,'/app/jobs/'+job.id);await crew.getByText('Hand off this repair').click();await crew.getByLabel('Hand to specialist').selectOption(specialist.id);await crew.getByLabel('Work so far and what is next').fill('Codes scanned and coil replaced; road test left');await shot(tech,'03-propose-handoff',crew);await submit(tech,crew.getByRole('button',{name:'Propose handoff'}))
  const proposed=(await h.state()).records.handoff.find(x=>x.jobId===job.id);assert.equal((await h.state()).records.job.find(j=>j.id===job.id).technicianId,lead.id,'A native proposal keeps the lead until acknowledgment')
  await spec.goto(h.origin+'/app/jobs');const mine=spec.locator('#waiting');assert.match(await mine.innerText(),/Handoff: Brake service[\s\S]*road test left/);await shot(spec,'04-handoff-waiting',mine)
  await submit(spec,mine.getByRole('button',{name:'Acknowledge and take over'}))
  crew=await go(owner,'/app/jobs/'+job.id);const text=await crew.innerText();assert.match(text,/rio crew · lead/);assert.match(text,/Handover receipt[\s\S]*morgan crew → rio crew[\s\S]*road test left/);assert.match(text,/Time on this repair/);await shot(owner,'05-handover-receipt',crew)
  const accepted=(await h.state()).records.handoff.find(x=>x.id===proposed.id),frozen=structuredClone(accepted.receipt)
  assert.equal((await h.state()).records.job.find(j=>j.id===job.id).technicianId,specialist.id)
  assert.equal(frozen.from.id,lead.id);assert.equal(frozen.to.id,specialist.id);assert.equal(frozen.proposedBy.id,lead.id)
  assert.equal(frozen.note,'Codes scanned and coil replaced; road test left');assert.equal(frozen.proposedAt,proposed.proposedAt);assert.equal(frozen.acknowledgedAt,collaborationClock)
  const road=(await h.state()).records.subtask.find(t=>t.jobId===job.id&&t.title==='Road test')
  assert.deepEqual(frozen.openSubtasks,[{id:road.id,title:'Road test',assigneeId:specialist.id}])
  assert.deepEqual(frozen.time,{
   [lead.id]:{name:'morgan crew',billable:1500,rework:420,nonbillable:300},
   [specialist.id]:{name:'rio crew',billable:720,rework:1440,nonbillable:540}
  },'The native handover receipt retains independently specified category seconds')
  const receiptText=async p=>{
   assert.deepEqual((await p.locator('#crew .receipt li').allTextContents()).sort(),[
    'morgan crew · billable 0.42 h · rework 0.12 h · nonbillable 0.08 h',
    'rio crew · billable 0.20 h · rework 0.40 h · nonbillable 0.15 h'
   ].sort(),'Rendered receipt distinguishes every technician and time category')
   assert.match(await p.locator('#crew .receipt').innerText(),/Open subtasks at handover: Road test/)
  }
  await receiptText(owner)
  // Change live time and finish the open task; the saved handover stays frozen.
  const rework=(await h.state()).records.timeEntry.find(e=>e.jobId===job.id&&e.ownerId===specialist.id&&e.category==='rework')
  await correctHandoffInterval(h,rework,specialist,'2026-10-28T09:15:00Z','2026-10-28T09:38:00Z')
  crew=await go(spec,'/app/jobs/'+job.id);await submit(spec,crew.getByRole('button',{name:'Complete subtask'}))
  assert.ok((await h.state()).records.subtask.find(t=>t.id===road.id).completedAt)
  assert.equal((await h.state()).records.timeEntry.find(e=>e.id===rework.id).revisions.at(-1).endAt,'2026-10-28T09:38:00.000Z')
  await owner.reload();await receiptText(owner)
  assert.deepEqual((await h.state()).records.handoff.find(x=>x.id===accepted.id).receipt,frozen)
  // Decline through native forms, then reload state and rendered history.
  crew=await go(spec,'/app/jobs/'+job.id);await crew.getByText('Hand off this repair').click();await crew.getByLabel('Hand to specialist').selectOption(lead.id);await crew.getByLabel('Work so far and what is next').fill('Need a second opinion');await submit(spec,crew.getByRole('button',{name:'Propose handoff'}))
  const beforeDecline=(await h.state()).records,declining=beforeDecline.handoff.find(x=>x.status==='proposed'),reason='Booked on another repair; available after the alignment'
  await tech.goto(h.origin+'/app/jobs');const decline=tech.locator('#waiting');await decline.getByText('Decline',{exact:true}).click();await decline.getByLabel('Why you are declining').fill(reason);await submit(tech,decline.getByRole('button',{name:'Decline handoff'}))
  const afterDecline=(await h.state()).records
  assert.equal(afterDecline.handoff.find(x=>x.id===declining.id).status,'declined')
  assert.equal(afterDecline.handoff.find(x=>x.id===declining.id).reason,reason)
  for(const kind of ['job','subtask','timeEntry','timeCorrection'])assert.deepEqual(afterDecline[kind],beforeDecline[kind],'Native decline changes no '+kind)
  crew=await go(owner,'/app/jobs/'+job.id);await owner.reload();assert.ok((await crew.innerText()).includes(reason));await receiptText(owner);await shot(owner,'06-declined-history',crew)
  assert.deepEqual((await h.state()).records.handoff.find(x=>x.id===accepted.id).receipt,frozen,'Decline preserves the earlier receipt')
  // Recovery uses fresh native authority, retaining exact receipts, reasons and time.
  fresh=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,clock:collaborationClock,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
  assert.notEqual((await fresh.state()).actor.id,(await h.state()).actor.id)
  await restore(fresh,await archive(h));await shopSetup(fresh)
  const recovered=(await fresh.state()).records
  for(const kind of ['jobNote','subtask','handoff','job','timeEntry','timeCorrection'])assert.deepEqual(recovered[kind],afterDecline[kind],'Fresh-owner recovery retains '+kind)
  await fresh.state({as:specialist.cookie,status:401})
  const recoveredOwner=await open(fresh.owner,fresh.origin);await recoveredOwner.goto(fresh.origin+'/app/jobs/'+job.id)
  await receiptText(recoveredOwner);assert.ok((await recoveredOwner.locator('#crew').innerText()).includes(reason));await shot(recoveredOwner,'07-recovered-history',recoveredOwner.locator('#crew'))
  assert.deepEqual(errors,[])
 }finally{try{await browser?.close()}finally{await fresh?.close();await h.close()}}
}
