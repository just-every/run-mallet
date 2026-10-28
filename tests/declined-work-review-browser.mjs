import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,archive,restore} from './harness.mjs'
import {declinedReviewFixture} from './support/declined-work-review-journey.mjs'
export async function declinedReviewBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  const f=await declinedReviewFixture(h)
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true}),cookies=(h)=>h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin}))
  await context.addCookies(cookies(h));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const dir=process.env.MALLET_DECLINED_PROOF_DIR??'.cache/declined-review-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+c+'"]')})
  const click=async(c,name)=>{await form(c).getByRole('button',{name,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.setViewportSize({width:1440,height:1000});await p.goto(h.origin+'/app/jobs/'+f.job.id)
  await p.getByRole('link',{name:'Review declined work with current sources',exact:true}).click()
  await form('declineReview.refresh').getByLabel('Related inspection point').selectOption(f.findingKey)
  await click('declineReview.refresh','Build cited packet')
  let text=await p.locator('main').innerText();assert.ok(text.includes('1,350 miles'));assert.ok(text.includes('3.5 mm'));assert.ok(text.includes('Distance threshold: Reached'));assert.ok(text.includes('Recorded signed decision'));assert.ok(text.includes('Outreach consent: unknown'))
  await click('declineReview.prepare','Prepare advisory offer')
  assert.equal((await h.state()).records.declinedReview[0].offers.length,1)
  assert.ok((await p.locator('main').innerText()).includes('Advisory only'))
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon controls expose tooltips')
  await shot('declined-01-current-cited-advisory')
  await f.record('green',9);await p.reload()
  assert.ok((await p.locator('main').innerText()).includes('Stale packet'))
  assert.equal(await form('declineReview.prepare').count(),0)
  await click('declineReview.refresh','Refresh cited packet')
  assert.ok((await p.locator('main').innerText()).includes('Suppressed: Replacement inspection'))
  assert.equal(await form('declineReview.prepare').count(),0)
  await shot('declined-02-replacement-suppressed-history')
  const before=(await h.state()).records,backup=await archive(h),fresh=await installation({network:true,secureNetwork:true,assets:true})
  try{
   await restore(fresh,backup)
   // Complete destination onboarding through its native form before opening retained history.
   const confirmed=await fresh.mf.dispatchFetch(fresh.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:fresh.origin,Cookie:fresh.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(confirmed.status,303)
   assert.deepEqual((await fresh.state()).records.declinedReview,before.declinedReview)
   const recovered=await browser.newContext({ignoreHTTPSErrors:true});await recovered.addCookies(cookies(fresh));const page=await recovered.newPage()
   await page.goto(fresh.origin+'/app/jobs/'+f.job.id+'/declined-review');await page.setViewportSize({width:1440,height:1000})
   text=await page.locator('main').innerText();assert.ok(text.includes('Advisory only'));assert.ok(text.includes('Suppressed: Replacement inspection'))
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(dir,'declined-03-recovered-history-'+width+'.png'),fullPage:true})}
   await recovered.close()
  }finally{await fresh.close()}
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
