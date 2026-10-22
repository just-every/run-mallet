import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {prepareReport,reportDeliveryEvents} from './support/inspection-report-journey.mjs'
export async function inspectionReportBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  const ready=await prepareReport(h);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const owner=await browser.newContext({ignoreHTTPSErrors:true}),customer=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:1000}});await owner.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await owner.newPage(),c=await customer.newPage(),dir=process.env.MALLET_REPORT_PROOF_DIR??'.cache/inspection-report-browser';await mkdir(dir,{recursive:true})
  const shot=async(page,name,target=page.locator('main'),mask=[])=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:false,mask})}}
  await p.goto(h.origin+'/app/jobs/'+ready.job.id);const panel=p.locator('#inspection-reports'),review=panel.locator('form:has(input[value="inspectionReport.review"])')
  await review.locator('[name^="include:"]').check();await review.getByLabel('Advisor-reviewed explanation for Front brake pads',{exact:true}).fill(ready.entry.explanation);await review.locator('[name^="line:"]').first().check();for(const checkbox of await review.locator('[name^="media:"]').all())await checkbox.check();await shot(p,'report-01-advisor-review',panel)
  await review.getByRole('button',{name:'Save reviewed report'}).click();await p.waitForLoadState('domcontentloaded');await shot(p,'report-02-reviewed-snapshot',panel)
  const send=panel.locator('form:has(input[value="inspectionReport.send"])');await send.getByLabel('Customer email',{exact:true}).fill('dana@example.test');await send.getByLabel('Customer permission evidence',{exact:true}).fill('Dana requested this report by email at the counter.');await send.getByRole('checkbox').check();await shot(p,'report-03-explicit-send',send)
  const before=await h.state();await send.getByRole('button',{name:'Email reviewed report'}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/Handed to the mail provider; delivery is not confirmed/);await shot(p,'report-04-honest-provider-handoff',p.locator('main'),[p.getByRole('link',{name:'Open reviewed customer report'})])
  const url=await p.getByRole('link',{name:'Open reviewed customer report'}).getAttribute('href');await c.goto(url);await shot(c,'report-05-phone-report');assert.match(await c.locator('main').innerText(),/Pad thickness: 2.5 mm/);assert.doesNotMatch(await c.locator('main').innerText(),/38\.12|Coil costs us|cedar@example.test/)
  const video=c.locator('video');await video.evaluate(async v=>{await v.play()});await c.waitForFunction(()=>{const v=document.querySelector('video');return v.currentTime>0.15});assert.ok(await video.evaluate(v=>v.videoWidth>0&&!v.error),'Actual shared video plays');await video.evaluate(v=>v.pause());await shot(c,'report-06-video-playback',video)
  assert.ok(await c.locator('img[alt^="Reviewed inspection"]').evaluate(i=>i.complete&&i.naturalWidth>0),'Reviewed shared photo loads')
  await c.getByRole('link',{name:'Open proposed repair: Front brake pads'}).click();await c.waitForLoadState('domcontentloaded');await shot(c,'report-07-exact-proposal');assert.match(await c.locator('main').innerText(),/Brake pads/);assert.doesNotMatch(await c.locator('main').innerText(),/Replace and tune/)
  const after=await h.state();for(const kind of ['estimate','approval','job','inspection'])assert.deepEqual(after.records[kind],before.records[kind],'Customer playback and proposed repair change no '+kind)
  const report=after.records.inspectionReport[0],delivery=after.records.inspectionReportDelivery[0]
  const explicitSend={reportId:report.id,to:'dana@example.test',consentEvidence:'Dana requested this report by email at the counter.',consent:true}
  await reportDeliveryEvents(h,delivery,explicitSend)
  await p.goto(h.origin+'/app/jobs/'+ready.job.id);await shot(p,'report-08-delivery-and-views',panel);assert.match(await panel.innerText(),/1 report views; views never authorize work/);assert.match(await panel.innerText(),/Last viewed/);assert.ok(Number.isFinite(Date.parse(after.records.diagnosisLinkView[0].at)),'The shown view retains its timestamp')
  await shot(p,'report-10-provider-delivered',panel.locator('p').filter({hasText:'Provider confirmed delivery'}));await shot(p,'report-11-provider-bounced',panel.locator('p').filter({hasText:'Email bounced'}))
  await panel.locator('form:has(input[name="linkId"][value="'+delivery.linkId+'"])').getByRole('button',{name:'Revoke report link'}).click();await p.waitForLoadState('domcontentloaded');assert.equal((await c.goto(url)).status(),404);await shot(c,'report-09-revoked')
 }finally{await browser?.close();await h.close()}
}
