import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {reviewFixture,reviewUrl,privatePath} from './support/reviews-journey.mjs'

export async function reviewsBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  const {job}=await reviewFixture(h);await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/reviews-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,target)=>{
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000});if(target)await target.scrollIntoViewIfNeeded();else await p.evaluate(()=>scrollTo(0,0))
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow')
    assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon controls have tooltips')
    await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:!target})
   }
  }
  await p.goto(h.origin+'/app/jobs/'+job.id+'/return');await shot('paid-handover',p.getByRole('heading',{name:'Customer review request'}))
  const consent=p.locator('form').filter({has:p.locator('input[name="command"][value="review.consent"]')})
  await consent.getByLabel('Permission time with UTC offset').fill(new Date(Date.now()-1000).toISOString())
  await consent.getByLabel('Permission capture channel').selectOption('in-person')
  await consent.getByLabel('Permission source evidence').fill('Customer asked Morgan at collection for this one review email, counter receipt synthetic-mallet-940')
  await consent.getByText('The customer explicitly agreed to this exact review email permission.').check()
  await shot('permission-filled',consent)
  await consent.getByRole('button',{name:'Record review permission'}).click();await p.waitForLoadState('domcontentloaded')
  const send=p.locator('form').filter({has:p.locator('input[name="command"][value="review.send"]')})
  await send.getByLabel('Google Business Profile review URL').fill(reviewUrl)
  await send.getByText('I approve this recipient and one review request under the recorded permission.').check()
  await shot('approved-request',send)
  await send.getByRole('button',{name:'Send review request'}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal((await h.state()).records.reviewRequest[0].status,'accepted');assert.equal(await p.getByRole('button',{name:'Send review request'}).count(),0)
  await shot('provider-handoff')
  const path=privatePath(h),customer=await browser.newContext({ignoreHTTPSErrors:true}),cp=await customer.newPage()
  // Browser context has no staff session. The private link is its only authority.
  await cp.goto(h.origin+path)
  const customerShot=async(name)=>{for(const width of [1440,390]){await cp.setViewportSize({width,height:1000});assert.ok(await cp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await cp.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}}
  await customerShot('customer-invitation')
  assert.equal(await cp.getByRole('link',{name:'Leave a review on Google'}).getAttribute('href'),reviewUrl)
  await cp.getByLabel('Your satisfaction rating').selectOption('1')
  await cp.getByLabel('Private feedback (optional)').fill('The pickup took longer than promised. Please contact me privately.')
  await customerShot('poor-feedback-filled')
  await cp.getByRole('button',{name:'Send private feedback'}).click();await cp.waitForLoadState('domcontentloaded')
  await customerShot('poor-feedback-saved')
  assert.equal(await cp.getByRole('link',{name:'Leave a review on Google'}).getAttribute('href'),reviewUrl);assert.equal(await cp.getByRole('button',{name:'Send private feedback'}).count(),0)
  await cp.route('https://g.page/**',route=>route.fulfill({status:204,body:''}))
  const [publicReviewRequest]=await Promise.all([cp.waitForRequest(reviewUrl),cp.getByRole('link',{name:'Leave a review on Google'}).click()])
  assert.equal(publicReviewRequest.headers().referer,undefined,'The public invitation does not disclose the private response link to Google')
  await p.goto(h.origin+'/app/jobs');await shot('staff-task',p.getByRole('heading',{name:'Waiting for you'}))
  await p.getByRole('link',{name:'Open private review feedback'}).click();await p.waitForLoadState('domcontentloaded')
  assert.ok((await p.locator('main').innerText()).includes('The pickup took longer than promised.'))
  await shot('owner-private-response')
  await p.getByRole('link',{name:'Open feedback follow-up task'}).click();await p.waitForLoadState('domcontentloaded')
  const crew=p.getByRole('heading',{name:'Crew & handoff',exact:true}).locator('..')
  await shot('completed-repair-task',crew)
  await crew.getByRole('button',{name:'Complete subtask',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.ok((await h.state()).records.subtask.find(t=>t.kind==='review-feedback').completedAt)
  await shot('task-completed',p.getByRole('heading',{name:'Crew & handoff',exact:true}).locator('..'))
  await cp.getByRole('button',{name:'Withdraw permission'}).click();await cp.waitForLoadState('domcontentloaded');await customerShot('permission-withdrawn')
  assert.equal(await cp.getByRole('link',{name:'Leave a review on Google'}).getAttribute('href'),reviewUrl)
  assert.deepEqual(errors,[]);await customer.close()
 }finally{await browser?.close();await h.close()}
}
