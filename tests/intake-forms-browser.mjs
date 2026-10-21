import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking} from './harness.mjs'
export async function intakeFormsBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=0&partsTaxable=yes'});assert.equal(setup.status,303)
  const asset=await h.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V',identifier:'synthetic-mallet-101'}),{job}=await booking(h,{asset})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const owner=await browser.newContext(),customer=await browser.newContext({viewport:{width:390,height:1000}});await owner.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await owner.newPage(),c=await customer.newPage(),errors=[];for(const page of [p,c])page.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C19_PROOF_DIR??'.cache/intake-forms-browser';await mkdir(dir,{recursive:true})
  const shot=async(page,name)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await page.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  const form=(page,command)=>page.locator(`form:has(input[name="command"][value="${command}"])`),fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/jobs/'+job.id+'/intake');await p.getByRole('link',{name:'Configure vehicle/device templates'}).click()
  for(const [kind,name]of [['vehicle','Vehicle intake'],['device','Device intake']])await fill(form(p,'intakeForm.publish').first(),{kind,name,fieldLines:'concern | '+(kind==='vehicle'?'When does the noise happen?':'Does the device power on?')+' | required\nnotes | Other details | optional',feeUsd:75,storageTerms:'Storage $10/day after three days.',teardownTerms:'Diagnosis only; teardown needs separate permission.'},'Publish template')
  assert.ok((await p.locator('main').innerText()).includes('Device intake'));await shot(p,'forms-01-two-published-templates')
  const t=(await h.state()).records.intakeTemplate.find(t=>t.revisions[0].kind==='vehicle')
  await p.goto(h.origin+'/app/jobs/'+job.id+'/intake');await fill(form(p,'intakeForm.create'),{templateSource:JSON.stringify({id:t.id,version:t.version})},'Create customer intake link')
  const link=await p.getByRole('link',{name:'Open customer intake form',exact:true}).getAttribute('href')
  // Never retain a screenshot of the one-time credential page or the browser address bar.
  await c.goto(link);await shot(c,'forms-02-phone-intake');await c.getByLabel('Symptom',{exact:true}).fill('Brake squeal on cold mornings');await c.getByRole('button',{name:'Sign terms & request copy'}).click();await c.waitForLoadState('domcontentloaded');assert.ok((await c.getByRole('alert').innerText()).includes('Your draft was saved'));assert.equal(await c.getByLabel('Symptom',{exact:true}).inputValue(),'Brake squeal on cold mornings');await shot(c,'forms-03-required-fields-kept')
  await c.getByLabel('When does the noise happen? (required)',{exact:true}).fill('Only at the first stop');await c.getByLabel('Typed name',{exact:true}).fill('Dana Brooks');await c.locator('[name="consent"]').check();await c.getByRole('button',{name:'Sign terms & request copy'}).click();await c.waitForLoadState('domcontentloaded');assert.ok((await c.locator('main').innerText()).includes('development email was not sent'));await shot(c,'forms-04-exact-signed-copy')
  const signed=(await h.state()).records.intakeForm.find(f=>f.jobId===job.id).receipt;assert.equal(signed.template.diagnosticFeeCents,7500)
  await p.goto(h.origin+'/app/intake-templates');const revision=form(p,'intakeForm.publish').filter({has:p.locator(`input[name="templateId"][value="${t.id}"]`)});await revision.locator('..').locator('summary').click();await fill(revision,{feeUsd:95,storageTerms:'New terms for future intakes only.'},'Publish new version');await shot(p,'forms-05-new-terms-version')
  await c.reload();assert.ok((await c.locator('main').innerText()).includes('Diagnostic fee: $75.00'));assert.ok(!(await c.locator('main').innerText()).includes('New terms for future intakes only.'));await shot(c,'forms-06-original-copy-after-change')
  await p.goto(h.origin+'/app/jobs/'+job.id+'/intake');await p.getByRole('link',{name:'Retrieve original signed intake'}).click();assert.ok((await p.locator('main').innerText()).includes('Diagnostic fee: $75.00'));await shot(p,'forms-07-staff-original-retrieval')
  const download=await customer.request.get(link+'?download=1');assert.equal(download.status(),200);assert.deepEqual(await download.json(),signed);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
