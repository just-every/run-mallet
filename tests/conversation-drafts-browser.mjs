import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {archive,installation,restore} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {conversationFixture,conversationPath,mailbox,priceQuestion} from './support/conversation-drafts-journey.mjs'
const cookies=(cookie,url)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url}))
export async function conversationBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true})
 let browser,fresh
 try{
  const f=await conversationFixture(h),path='/app/jobs/'+f.job.id+'/conversation'
  browser=await chromium.launch({headless:true,executablePath:process.env.RER_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
  await context.addCookies(cookies(h.owner,h.origin))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const form=(page,command)=>page.locator(`form:has(input[name="command"][value="${command}"])`)
  const submit=async(target,label)=>{await target.getByRole('button',{name:label,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await mkdir('.cache/conversation-browser',{recursive:true})
  const shot=async(name,page=p)=>{
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(requestAnimationFrame))
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
    assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0)
    await page.screenshot({path:'.cache/conversation-browser/'+name+'-'+width+'.png',fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
  await p.goto(h.origin+'/app/jobs/'+f.job.id)
  await p.getByRole('link',{name:'Private conversation drafts',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal(new URL(p.url()).pathname,path)
  const capture=form(p,'conversation.capture')
  await capture.locator('[name="captureReference"]').fill('synthetic-mallet-980')
  await capture.locator('[name="source"]').selectOption('entered-email')
  await capture.locator('[name="enteredAt"]').fill('2026-10-28T10:00:00Z')
  await capture.locator('[name="evidence"]').fill('Owner-entered text from retained customer correspondence 980')
  await capture.locator('[name="topic"]').selectOption('estimate')
  await capture.locator('[name="question"]').fill(priceQuestion)
  await capture.locator('[name="reportId"]').selectOption(f.report.id)
  await capture.locator('[name="estimateSource"]').selectOption(JSON.stringify({estimateId:f.quote.id,revision:1}))
  const before=(await h.state()).records.estimate
  await submit(capture,'Prepare private draft')
  let row=(await h.api(conversationPath(f.job))).drafts[0]
  assert.equal(row.revision.outcome,'draft');assert.ok((await p.locator('main').innerText()).includes('$206.00'))
  assert.ok(!(await p.locator('main').innerText()).includes(f.privateNote))
  assert.ok((await p.locator('main').innerText()).includes('Authenticated customer-channel receipt: no'))
  await shot('01-private-cited-draft')
  const review=form(p,'conversation.review')
  await review.locator('[name="note"]').fill('Owner compared exact prices with the shared revision and report.')
  await submit(review,'Record exact review')
  row=(await h.api(conversationPath(f.job))).drafts[0]
  assert.equal(row.reviews[0].decision,'approved');assert.equal(row.reviews[0].content,row.revision.content)
  await p.getByText('Draft and attributable review history',{exact:true}).click()
  assert.ok((await p.locator('main').innerText()).includes('Owner compared exact prices'))
  await shot('02-exact-owner-review')
  const escalation=form(p,'conversation.capture')
  await escalation.locator('[name="captureReference"]').fill('synthetic-mallet-981')
  await escalation.locator('[name="enteredAt"]').fill('2026-10-28T10:05:00Z')
  await escalation.locator('[name="evidence"]').fill('Customer asked about driving safety in person at the counter.')
  await escalation.locator('[name="question"]').fill('Is it safe to drive? Can I get a discount?')
  await escalation.locator('[name="reportId"]').selectOption(f.report.id)
  await escalation.locator('[name="estimateSource"]').selectOption(JSON.stringify({estimateId:f.quote.id,revision:1}))
  await submit(escalation,'Prepare private draft')
  let view=await h.api(conversationPath(f.job));const unsafe=view.drafts.find(d=>d.captureReference==='synthetic-mallet-981')
  assert.equal(unsafe.revision.outcome,'escalated')
  const human=form(p,'conversation.review').filter({has:p.locator('input[name="draftId"][value="'+unsafe.id+'"]')})
  assert.equal(await human.locator('select[name="decision"] option[value="approved"]').count(),0)
  await human.locator('[name="note"]').fill('Owner retained the exception for a person to answer; no assurance or discount offered.')
  await submit(human,'Record exact review')
  assert.deepEqual((await h.state()).records.estimate,before)
  await shot('03-human-escalation')
  await h.command('inspection.record',{...f.observation,version:(await f.current()).version,inspectionVersion:f.inspection.version,measurementValue:3})
  await p.goto(h.origin+path)
  assert.equal((await h.api(conversationPath(f.job))).drafts.find(d=>d.id===row.id).stale,true)
  assert.ok((await p.locator('main').innerText()).includes('Sources changed; prior review is invalid'))
  await shot('04-source-review-invalidated')
  const saved=await archive(h),expected=(await h.state()).records.conversationDraft
  fresh=await installation({network:true,secureNetwork:true,assets:true,bindings:{OWNER_EMAIL:mailbox(982)}})
  await restore(fresh,saved);await shopSetup(fresh)
  const recovered=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true})
  await recovered.addCookies(cookies(fresh.owner,fresh.origin))
  const page=await recovered.newPage();await page.goto(fresh.origin+path)
  assert.deepEqual((await fresh.state()).records.conversationDraft,expected)
  const history=page.getByRole('heading',{name:'Question: '+priceQuestion,exact:true}).locator('xpath=ancestor::section').getByText('Draft and attributable review history',{exact:true});await history.click()
  assert.ok((await page.locator('main').innerText()).includes('Owner compared exact prices'))
  assert.equal(fresh.messages.length,0)
  await shot('05-fresh-owner-history',page)
  assert.deepEqual(errors,[])
 }finally{try{await browser?.close()}finally{await fresh?.close();await h.close()}}
}
