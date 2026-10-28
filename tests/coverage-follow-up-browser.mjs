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
}
