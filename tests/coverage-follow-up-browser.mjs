import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {installation,archive,restore} from './harness.mjs'
import {coverageFixture,coverageDates} from './support/coverage-follow-up-journey.mjs'

export async function coverageBrowser(h,p,f,shot,browser){
 const fixture=await coverageFixture(h,f)
 const form=c=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+c+'"]')})
 const fill=async(target,fields,button)=>{
  for(const [name,value]of Object.entries(fields)){
   const el=target.locator('[name="'+name+'"]')
   if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))
  }
  await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')
 }
 await p.goto(h.origin+'/app/jobs/'+f.job.id+'/warranty')
 await p.getByRole('link',{name:'Coverage review register',exact:true}).click()
 await p.setViewportSize({width:1440,height:1000})
 const schedules=form('coverage.schedule')
 await fill(schedules.filter({has:p.locator('input[name="kind"][value="warranty"]')}),{termsId:fixture.terms.id,reference:fixture.warranty.reference,dueAt:coverageDates.dueAt,consentEvidence:fixture.base.consentEvidence},'Schedule warranty review')
 await fill(form('coverage.schedule').filter({has:p.locator('input[name="kind"][value="service-contract"]')}),{...Object.fromEntries(['reference','documentReference','terms','startsAt','endsAt','evidence','dueAt','consentEvidence'].map(k=>[k,fixture.contract[k]]))},'Schedule contract review')
 let s=await h.state(),check=s.records.coverageReview.find(r=>r.reference===fixture.warranty.reference),renewal=s.records.coverageReview.find(r=>r.reference===fixture.contract.reference)
 const canceled=await h.command('coverage.schedule',{...fixture.contract,reference:'synthetic-mallet-620',documentReference:'synthetic-mallet-620-document'})
 const sibling=await h.command('coverage.schedule',{...fixture.contract,reference:'synthetic-mallet-620-sibling',documentReference:'synthetic-mallet-620-document'})
 await p.reload()
 await p.getByRole('heading',{name:canceled.reference,exact:true}).locator('..').getByText('Cancel this coverage review',{exact:true}).click()
 await fill(form('coverage.cancel').filter({has:p.locator('input[name="id"][value="'+canceled.id+'"]')}),{reason:'Customer canceled the agreement; owner retained cancellation evidence.'},'Cancel coverage review')
 assert.equal((await h.state()).records.coverageReview.find(r=>r.id===canceled.id).status,'canceled')
 assert.equal((await h.state()).records.coverageReview.find(r=>r.id===sibling.id).status,'canceled')
 await shot('coverage-01-scheduled-and-canceled')
 await h.cron(coverageDates.dueAt);await h.cron(coverageDates.dueAt);await p.reload()
 assert.equal(await p.getByRole('heading',{name:'Native review task · open',exact:true}).count(),2)
 s=await h.state();assert.equal(s.records.coverageTask.length,2);check=s.records.coverageReview.find(r=>r.id===check.id)
 assert.equal(s.records.coverageTask.some(t=>[canceled.id,sibling.id].includes(t.coverageId)),false)
 const panel=p.getByRole('heading',{name:check.reference,exact:true}).locator('..')
 await panel.getByText('Record a reported repeat symptom',{exact:true}).click()
 await fill(form('coverage.symptom').filter({has:p.locator('input[name="id"][value="'+check.id+'"]')}),{reference:'synthetic-mallet-621',symptom:'Same pad squeal reported after original repair',reportedAt:'2026-10-01T10:00:00Z',evidence:'Owner recorded customer telephone report; no new work authorized.'},'Link symptom to original repair')
 s=await h.state();check=s.records.coverageReview.find(r=>r.id===check.id)
 assert.equal(check.symptoms[0].text,'Same pad squeal reported after original repair');assert.equal(check.jobId,f.job.id)
 assert.ok((await p.locator('main').innerText()).includes('Not independently verified'))
 assert.ok((await p.locator('main').innerText()).includes(check.symptoms[0].text))
 await shot('coverage-02-due-task-and-linked-symptom')
 await fill(form('coverage.resolve').filter({has:p.locator('input[name="id"][value="'+check.id+'"]')}),{reason:'Owner reviewed source dates and recorded symptom; further repair needs separate authorization.'},'Complete review task')
 assert.equal((await h.state()).records.coverageTask.find(t=>t.coverageId===check.id).status,'completed')
 await fill(form('coverage.transfer'),{reason:'Customer reported vehicle sold; stop all outstanding coverage reviews.'},'Record transfer and stop reviews')
 s=await h.state();assert.equal(s.records.coverageReview.find(r=>r.id===renewal.id).status,'transferred');assert.equal(s.records.coverageTask.find(t=>t.coverageId===renewal.id).status,'suppressed')
 await shot('coverage-03-completed-and-transfer-suppression')
 const fresh=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),OWNER_EMAIL:['synthetic-mallet-browser-recovery','example.test'].join('@')}})
 let context
 try{
  await restore(fresh,await archive(h))
  for(const kind of ['coverageReview','coverageTask'])assert.deepEqual((await fresh.state()).records[kind],s.records[kind])
  const setup=await fetch(fresh.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:fresh.origin,Cookie:fresh.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=10&partsTaxable=yes&laborTaxable=yes'});assert.equal(setup.status,303)
  context=await browser.newContext();await context.addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})))
  const recovered=await context.newPage()
  await recovered.goto(fresh.origin+'/app/jobs/'+f.job.id+'/coverage')
  await recovered.setViewportSize({width:1440,height:1000})
  const text=await recovered.locator('main').innerText();assert.ok(text.includes('Same pad squeal reported after original repair'));assert.ok(text.includes('transferred'));assert.ok(text.includes('suppressed'))
  const {mkdir}=await import('node:fs/promises'),{join}=await import('node:path'),dir=process.env.MALLET_C19_PROOF_DIR??'.cache/warranty-browser'
  await mkdir(dir,{recursive:true})
  for(const width of [1440,390]){await recovered.setViewportSize({width,height:1000});await recovered.screenshot({path:join(dir,'coverage-04-exact-recovery-'+width+'.png'),fullPage:true})}
 }finally{await context?.close();await fresh.close()}
 await coverageMailBrowser(browser)
}

async function coverageMailBrowser(browser){
 const {coverageMailFixture,coverageResponsePath}=await import('./support/coverage-mail-journey.mjs'),{warrantyOriginal}=await import('./support/warranty-journey.mjs')
 const h=await installation({network:true,secureNetwork:true,assets:true});let ownerContext,customerContext
 try{
  const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=10&partsTaxable=yes&laborTaxable=yes'});assert.equal(setup.status,303)
  const f=await warrantyOriginal(h),x=await coverageMailFixture(h,f);await h.stepUp()
  ownerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  await ownerContext.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await ownerContext.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message))
  const {mkdir}=await import('node:fs/promises'),{join}=await import('node:path'),directory=process.env.MALLET_C19_PROOF_DIR??'.cache/warranty-browser';await mkdir(directory,{recursive:true})
  const shot=async(page,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(width===1440){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Coverage screen fits desktop');assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon controls have tooltips');assert.equal(await page.locator('main p,main label,main button,main summary').evaluateAll(nodes=>nodes.filter(n=>parseFloat(getComputedStyle(n).fontSize)<13).length),0,'Coverage text is at least 13 pixels')}await page.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+c+'"]')})
  const fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const el=target.locator('[name="'+name+'"]');if(typeof value==='boolean')await el.setChecked(value);else if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/jobs/'+f.job.id+'/coverage')
  await p.getByText('Coverage email permission',{exact:true}).click()
  await fill(form('coverage.consent'),{consentedAt:x.consent.consentedAt,captureChannel:'telephone',sourceEvidence:x.consent.sourceEvidence,consent:true},'Record coverage email permission')
  const permission=(await h.state()).records.coverageConsent[0];assert.equal(permission.wordingVersion,x.consent.wordingVersion);assert.equal(permission.captureChannel,'telephone')
  await fill(form('coverage.approve'),{...x.approval},'Approve coverage email')
  assert.equal((await h.state()).records.coverageNotice[0].status,'pending');await shot(p,'coverage-05-approved-email-policy')
  await h.cron(x.dueAt);await h.cron(x.dueAt);await p.reload()
  assert.equal((await h.state()).records.coverageNotice[0].status,'accepted');assert.ok((await p.locator('main').innerText()).includes('delivery not confirmed'))
  customerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  const cp=await customerContext.newPage(),path=coverageResponsePath(h.messages)
  await cp.goto(h.origin+path);await cp.getByLabel('Repeat symptom',{exact:true}).fill('Same pad squeal after the original repair; please review privately.')
  await shot(cp,'coverage-06-customer-symptom')
  await cp.getByRole('button',{name:'Send symptom report',exact:true}).click();await cp.waitForLoadState('domcontentloaded')
  assert.ok((await cp.locator('main').innerText()).includes('Your report was saved'))
  assert.equal((await h.state()).records.coverageCase.length,1)
  await p.goto(h.origin+'/app/jobs');await shot(p,'coverage-07-owner-follow-up-queue')
  await p.getByRole('link',{name:'Open coverage follow-up',exact:true}).first().click();await p.waitForLoadState('domcontentloaded')
  assert.ok((await p.locator('main').innerText()).includes('Same pad squeal after the original repair; please review privately.'))
  await fill(form('coverage.caseResolve'),{reason:'Owner contacted the customer; separate diagnosis and repair authorization remain required.'},'Resolve linked symptom case')
  assert.equal((await h.state()).records.coverageCase[0].status,'resolved');await shot(p,'coverage-08-linked-case-resolved')
  const old=(await h.state()).records.coverageReview.find(r=>r.id===x.review.id)
  await p.getByText('Record a separately executed renewal',{exact:true}).click()
  await fill(form('coverage.recordRenewal'),{documentReference:'synthetic-mallet-browser-signed-renewal',terms:'Owner retained the separately signed renewal; coverage has not been independently verified.',startsAt:x.contract.startsAt,endsAt:x.contract.endsAt,evidence:'Signed renewal reference synthetic-mallet-browser-signed-renewal',reference:'synthetic-mallet-browser-next-review',dueAt:x.dueAt,consentEvidence:'Fresh customer internal-review permission recorded at the counter.',reason:'Customer signed a new service contract outside Mallet; owner retained evidence.',confirm:'record-evidenced-renewal'},'Record renewal evidence')
  const s=await h.state();assert.equal(s.records.coverageRenewal.length,1);assert.equal(s.records.coverageRenewal[0].coverageId,old.id);assert.equal(s.records.coverageReview.find(r=>r.id===old.id).status,'completed');assert.equal(s.records.invoice.length,1)
  await shot(p,'coverage-09-renewal-evidence-and-next-review')
  assert.equal((await cp.goto(h.origin+path)).status(),404,'A completed renewal review cannot accept obsolete customer submissions')
  const backup=await archive(h),fresh=await installation({network:true,secureNetwork:true,assets:true})
  let recoveredContext
  try{
   await restore(fresh,backup)
   for(const kind of ['coverageReview','coverageRenewal','coverageConsent','coverageNotice','coverageCase'])assert.deepEqual((await fresh.state()).records[kind],s.records[kind])
   const setup=await fresh.mf.dispatchFetch(fresh.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:fresh.origin,cookie:fresh.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=10&partsTaxable=yes&laborTaxable=yes'});assert.equal(setup.status,303)
   recoveredContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
   await recoveredContext.addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})))
   const recovered=await recoveredContext.newPage();await recovered.goto(fresh.origin+'/app/jobs/'+f.job.id+'/coverage')
   assert.ok((await recovered.locator('main').innerText()).includes('Same pad squeal after the original repair; please review privately.'));await shot(recovered,'coverage-10-mail-case-and-renewal-recovery')
   assert.equal((await fresh.request(path,{as:''})).status,404)
  }finally{await recoveredContext?.close();await fresh.close()}
  assert.deepEqual(errors,[])
 }finally{await customerContext?.close();await ownerContext?.close();await h.close()}
}
