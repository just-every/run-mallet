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
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
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
// EST-006 / EST-007: chase policy, advisor queue, per-link reminders and the customer's Stop reminders door at 1440/390.
export async function chaseBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  await shopSetup(h);const tech=await publicDoor(h.origin,h.owner).person('morgan-chase@example.test')
  const {asset,job:first}=await booking(h,{technicianId:tech.id}),second=(await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),technicianId:tech.id,startAt:'2026-11-03T09:00:00Z',endAt:'2026-11-03T10:00:00Z'})).job
  for(const job of [first,second]){const q=await estimate(h,job);await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})}
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const errors=[],open=async(cookie,width)=>{const c=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/Los_Angeles',locale:'en-US',hasTouch:width<500});if(cookie)await c.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
  await mkdir('.cache/chase-browser',{recursive:true})
  const shot=async(p,name,target)=>{for(const width of [390,1440]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'EST-006 / EST-007 responsive '+name+' '+width);await p.screenshot({path:`.cache/chase-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
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
  const optedLink=(await h.state()).records.approvalLink.find(l=>l.jobId===first.id),beforeExpiry=h.messages.length
  await h.cron(Date.parse(optedLink.expiresAt)+60_000)
  const optedTask=(await h.state()).records.chaseTask.find(t=>t.linkId===optedLink.id)
  assert.deepEqual([optedTask.jobId,optedTask.estimateId,optedTask.revision,optedTask.kind,optedTask.resolvedAt],[first.id,optedLink.estimateId,1,'unanswered',null])
  await h.cron(Date.parse(optedLink.expiresAt)+86400000)
  assert.deepEqual((await h.state()).records.chaseTask.filter(t=>t.linkId===optedLink.id),[optedTask]);assert.equal(h.messages.length,beforeExpiry)
  await o.goto(h.origin+'/app/jobs/'+first.id);assert.match(await panel.innerText(),/the customer opted out of reminders[\s\S]*Estimate unanswered[\s\S]*expired undecided/)
  await shot(o,'11-opted-out-expiry',panel)
  await o.goto(h.origin+'/app/approvals');assert.equal(await tasks.getByRole('link',{name:first.title,exact:true}).getAttribute('href'),'/app/jobs/'+first.id+'#approval-links')
  const optedNote='Owner called after the opted-out estimate expired; no email resend'
  await tasks.getByLabel('What you did').fill(optedNote);await tasks.getByRole('button',{name:'Resolve task'}).click();await o.waitForLoadState('domcontentloaded')
  const optedResolved=(await h.state()).records.chaseTask.find(t=>t.id===optedTask.id)
  assert.deepEqual([optedResolved.resolvedBy.id,optedResolved.resolvedBy.role,optedResolved.note],[(await h.state()).actor.id,'owner',optedNote]);assert.ok(optedResolved.resolvedAt)
  await o.goto(h.origin+'/app/jobs/'+first.id);assert.ok((await panel.innerText()).includes(optedNote));assert.ok((await panel.innerText()).includes(optedResolved.resolvedBy.name));await shot(o,'12-opted-out-resolution',panel)
  await uncertainTaskBrowser(browser)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}


// Use the native sending form against a controlled mail transport, without development suppression.
async function uncertainTaskBrowser(browser){
 let interrupted=false,calls=0,observed
 const h=await installation({network:true,secureNetwork:true,assets:true,clock:'2026-10-30T12:00:00Z',mailService:async message=>{
  if(!interrupted)return Response.json({id:'synthetic-mallet-approval-mail'})
  calls++;observed=message;throw new Error('synthetic-mallet-interrupted-approval-handoff')
 }})
 let context
 try{
  await shopSetup(h)
  const tech=await h.person(['synthetic-mallet-chase-tech','example.test'].join('@'))
  const {job}=await booking(h,{technicianId:tech.id})
  let q=await estimate(h,job);q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
  const agent=await h.command('agent.create',{label:'synthetic-mallet-chase-boundary'})
  await h.stepUp()
  context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const shot=async name=>{
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000})
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Uncertain task fits the viewport')
    assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon-only controls have tooltips')
    await p.screenshot({path:'.cache/chase-browser/'+name+'-'+width+'.png',fullPage:true})
   }
   await p.setViewportSize({width:1440,height:1000})
  }
  await p.goto(h.origin+'/app/jobs/'+job.id);const beforeHandoff=h.messages.length;interrupted=true
  await p.locator('#approval-links').getByRole('button',{name:'Email approval link',exact:true}).click();await p.waitForLoadState('domcontentloaded');interrupted=false
  assert.equal(calls,1,'The native form reaches the interrupted mail edge once')
  assert.match(observed.text,/\/approve\//,'The transport observed the native approval-link request before interruption')
  const read=async()=>(await h.state()).records
  let records=await read(),link=records.approvalLink.find(l=>l.jobId===job.id),task=records.chaseTask.find(t=>t.linkId===link.id)
  assert.equal(link.delivery.status,'uncertain')
  assert.deepEqual([task.jobId,task.linkId,task.estimateId,task.revision,task.kind],[job.id,link.id,q.id,1,'delivery-failed'])
  assert.equal(records.chaseTask.filter(t=>t.linkId===link.id).length,1);assert.match(task.detail,/uncertain/)
  await p.goto(h.origin+'/app/jobs/'+job.id);assert.match(await p.locator('main').innerText(),/Approval email failed[\s\S]*uncertain/);await shot('07-interrupted-repair')
  await p.goto(h.origin+'/app/approvals');let tasks=p.locator('#chase-tasks')
  assert.match(await tasks.innerText(),/Approval email failed[\s\S]*uncertain/);assert.equal(await tasks.getByRole('link',{name:job.title,exact:true}).getAttribute('href'),'/app/jobs/'+job.id+'#approval-links')
  await shot('08-uncertain-task')
  await h.cron(Date.parse(link.createdAt)+2*86400000+60000);await h.cron(Date.parse(link.createdAt)+5*86400000+60000)
  records=await read();assert.deepEqual(records.chaseTask.filter(t=>t.linkId===link.id),[task]);assert.deepEqual(records.approvalLink.find(l=>l.id===link.id).delivery,link.delivery);assert.equal(calls,1);assert.equal(h.messages.length,beforeHandoff+1,'Every later handoff is counted, including an accepted resend')
  const snapshot=r=>Object.fromEntries(['chaseTask','approvalChase','approvalLink','estimate','job'].map(kind=>[kind,r[kind]])),beforeDenied=snapshot(records)
  const resolution={taskId:task.id,version:task.version,note:'Owner reviewed interrupted delivery and called customer; no resend'}
  // Exercise the real form transport with a forged technician submission.
  const refused=await h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:tech.cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({command:'chaseTask.resolve',...resolution})})
  assert.equal(refused.status,403);assert.deepEqual(snapshot(await read()),beforeDenied)
  await h.command('chaseTask.resolve',resolution,{as:'',headers:{authorization:'Bearer '+agent.token},status:403});assert.deepEqual(snapshot(await read()),beforeDenied)
  await p.reload();await tasks.getByLabel('What you did').fill(resolution.note);await shot('09-owner-resolution')
  await tasks.getByRole('button',{name:'Resolve task'}).click();await p.waitForLoadState('domcontentloaded')
  assert.match(await p.locator('#chase-tasks').innerText(),/No open tasks/);await shot('10-resolved-task')
  records=await read();const resolved=records.chaseTask.find(t=>t.id===task.id)
  assert.equal(resolved.note,resolution.note);assert.equal(resolved.resolvedBy.id,(await h.state()).actor.id);assert.equal(resolved.resolvedBy.role,'owner');assert.ok(resolved.resolvedAt)
  await p.goto(h.origin+'/app/jobs/'+job.id)
  const resolvedHistory=await p.locator('#approval-links').innerText()
  assert.ok(resolvedHistory.includes(resolution.note));assert.ok(resolvedHistory.includes(resolved.resolvedBy.name));assert.match(resolvedHistory,/Resolved by/)
  await shot('13-uncertain-resolution-history')
  await h.cron(Date.parse(link.createdAt)+5*86400000+120000)
  records=await read();assert.deepEqual(records.chaseTask.filter(t=>t.linkId===link.id),[resolved]);assert.deepEqual(records.approvalLink.find(l=>l.id===link.id).delivery,link.delivery);assert.equal(calls,1);assert.equal(h.messages.length,beforeHandoff+1,'Every later handoff is counted, including an accepted resend')
  assert.deepEqual(errors,[])
 }finally{await context?.close();await h.close()}
}
