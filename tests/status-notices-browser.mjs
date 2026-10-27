import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {statusFixture,noticeAt} from './support/status-notices-journey.mjs'

export async function statusNoticesBrowser(){
 let reject=false,browser
 const h=await installation({network:true,secureNetwork:true,assets:true,mailService:async()=>reject?Response.json({error:'synthetic-mallet-948'},{status:422}):Response.json({id:'synthetic-mallet-949'})})
 try{
  const f=await statusFixture(h),q=await f.prepare(),plan=await f.parts(q)
  await h.stepUp()
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_STATUS_PROOF_DIR??'.cache/status-notices-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){
   await p.setViewportSize({width,height:1000})
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow')
   assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon-only controls have tooltips')
   await p.screenshot({path:directory+'/'+name+'-'+width+'.png',fullPage:true})
  }await p.setViewportSize({width:1440,height:1000})}
  await p.goto(h.origin+'/app/jobs/'+f.job.id);await p.getByRole('link',{name:'Status & pickup notices',exact:true}).click();await shot('01-parts-stage')
  await p.getByText('Record customer permission',{exact:true}).click()
  const permission=p.locator('form').filter({has:p.locator('input[name="command"][value="statusNotice.consent"]')})
  await permission.getByLabel('Customer permission time with UTC offset').fill(noticeAt(f.base,-1))
  await permission.getByLabel('Permission evidence reference').fill('synthetic-mallet-950: customer chose repair status email in person')
  await permission.getByText('The customer affirmatively chose email for these repair updates.').check();await shot('02-permission-review')
  await permission.getByRole('button',{name:'Record email permission'}).click();await p.waitForLoadState('domcontentloaded')
  const consent=(await h.state()).records.statusConsent.find(c=>c.id!==f.consent.id);assert.ok(consent);assert.match(consent.sourceEvidence,/synthetic-mallet-950/)
  const approve=async(kind,message)=>{
   const form=p.locator('form').filter({has:p.locator('input[name="command"][value="statusNotice.approve"]')}).filter({has:p.locator('input[name="kind"][value="'+kind+'"]')})
   await form.getByLabel('Customer-safe message',{exact:true}).fill(message)
   await form.getByLabel('Send time with UTC offset').fill(noticeAt(f.base,-.01));await form.getByLabel('Approval expiry with UTC offset').fill(noticeAt(f.base,12))
   await form.getByLabel('Recipient timezone').fill('UTC');await form.getByLabel('First allowed hour').fill(String((f.hour+23)%24));await form.getByLabel('Last allowed hour (exclusive)').fill(String((f.hour+18)%24))
   if(['ready','pickup'].includes(kind)){await form.getByLabel('Pickup follow-up deadline with UTC offset').fill(noticeAt(f.base,3));await form.getByLabel('Shop pickup follow-up policy').fill('Owner calls after agreed pickup; no automatic fees or disposal.')}
   await form.getByText('I reviewed the exact customer-safe message, recipient, template and stage. Approve one email.').check();await shot(kind+'-approval')
   await form.getByRole('button',{name:'Approve one email'}).click();await p.waitForLoadState('domcontentloaded');await shot(kind+'-pending')
  }
  await approve('parts','Your brake pads are delayed. Please call us to discuss the revised arrival time.')
  await h.cron(noticeAt(f.base,.1));await p.reload();assert.match(await p.locator('main').innerText(),/Parts delay · accepted/)
  await p.getByText('Exact approved message and outcome',{exact:true}).click();await shot('03-parts-provider-outcome')
  assert.match(await p.locator('main').innerText(),/delivery is not confirmed/);assert.match(h.messages.at(-1).text,/Your brake pads are delayed/)
  await f.ready(q,plan);await p.reload();await approve('ready','Your repair is ready. Please contact us to agree collection.')
  await h.cron(noticeAt(f.base,.2));await p.reload();assert.match(await p.locator('main').innerText(),/Ready for pickup · accepted/);await shot('04-ready-provider-outcome')
  reject=true;await approve('pickup','Please contact the shop about collecting your completed repair.');await h.cron(noticeAt(f.base,.3));await p.reload()
  assert.match(await p.locator('main').innerText(),/Pickup reminder · failed/);await shot('05-failed-contact')
  const failed=p.locator('li').filter({has:p.getByText('Pickup reminder · failed',{exact:true})})
  await failed.getByLabel('Staff resolution').fill('Owner called and left a personal callback request.');await failed.getByRole('button',{name:'Record contact resolution'}).click();await p.waitForLoadState('domcontentloaded')
  await h.cron(noticeAt(f.base,4));await p.reload();assert.match(await p.locator('main').innerText(),/Uncollected repair: owner follow-up required/);await shot('06-uncollected-followup')
  await p.goto(h.origin+'/app/jobs');assert.equal(await p.getByRole('link',{name:'Open status and pickup follow-up',exact:true}).count(),1);await shot('06a-repair-list-queue');await p.getByRole('link',{name:'Open status and pickup follow-up',exact:true}).click()
  await p.goto(h.origin+'/app/jobs/'+f.job.id);await shot('06b-repair-task');await p.getByRole('link',{name:'Open status and pickup follow-up',exact:true}).click()
  const resolution=p.locator('form').filter({has:p.locator('input[name="command"][value="statusNotice.resolve"]')})
  await resolution.getByLabel('Staff resolution').fill('Reached customer; pickup agreed for tomorrow.');await resolution.getByRole('button',{name:'Record contact resolution'}).click();await p.waitForLoadState('domcontentloaded')
  assert.match(await p.locator('main').innerText(),/Uncollected repair: owner follow-up resolved/);await shot('07-resolved-followup')
  const withdraw=p.locator('form').filter({has:p.locator('input[name="command"][value="statusNotice.withdraw"]')}).last()
  await withdraw.getByLabel('Customer withdrawal evidence').fill('Customer asked at the counter to stop repair-status email.');await withdraw.getByRole('button',{name:'Withdraw email permission'}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal(await p.getByRole('button',{name:'Approve one email'}).count(),0);await shot('08-withdrawn')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
