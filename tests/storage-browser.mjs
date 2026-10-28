import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {readyInvoice} from './support/return-journey.mjs'
import {ruleInput,openInput} from './support/storage-journey.mjs'
import {handoverInput} from './support/handover-input.mjs'
import {publicDoor} from './support/portable-repair.mjs'
export async function storageBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const reviewer=await publicDoor(h.origin,h.owner).person('storage-reviewer@example.test','admin')
  await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_STORAGE_PROOF_DIR??'.cache/storage-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});if(width===1440)assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const fill=async(command,fields,button)=>{const target=p.locator(`form:has(input[name="command"][value="${command}"])`);for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  for(const state of ['CA','TX']){
   const asset=await h.command('asset.create',{customerName:'Storage '+state,label:'Storage vehicle',identifier:'synthetic-mallet-browser-storage-'+state}),{job,invoice}=await readyInvoice(h,{asset,reviewer}),pickup=await handoverInput(h,job.id,job.asset.customerName)
   await p.goto(h.origin+'/app/settings/storage');await fill('storage.rule',ruleInput(state),'Publish reviewed rule version');await shot(state+'-rules')
   const rule=(await h.state()).records.storageRule.find(r=>r.state===state);await p.goto(h.origin+'/app/jobs/'+job.id+'/return');await p.getByRole('link',{name:'Storage & notices',exact:true}).click()
   const {jobId,version,...fields}=openInput((await h.state()).records.job.find(j=>j.id===job.id),rule);await fill('storage.open',fields,'Open storage ledger');assert.ok((await p.locator('main').innerText()).includes('$30.00 storage'));await shot(state+'-ledger')
   await fill('storage.dispose',{},'Check disposal gate');assert.ok((await p.locator('main').innerText()).includes('Disposal requires timely delivery'));await shot(state+'-early-refusal')
   await p.goto(h.origin+'/app/jobs/'+job.id+'/storage');await fill('storage.notice',{deliveredAt:'2000-01-03T12:00:00Z',evidence:'synthetic-mallet-1203: exact notice and signed delivery receipts for both recipients'},'Record notice evidence');assert.ok((await p.locator('main').innerText()).includes('Within recorded deadline'));await shot(state+'-notice')
   await fill('storage.review',{evidence:'synthetic-mallet-1204: counsel review and statutory steps'},'Record legal review');await fill('storage.dispose',{},'Check disposal gate');assert.ok((await p.locator('main').innerText()).includes('Disposal remains disabled'));await shot(state+'-reviewed-refusal')
   await h.command('payment.record',{jobId:job.id,invoiceId:invoice.id,version:invoice.version,invoiceRevision:invoice.revision,method:'cash',amountCents:invoice.totals.totalCents,reference:'synthetic-mallet-browser-'+state,evidence:'Cash counted for exact repair invoice'})
   await p.goto(h.origin+'/app/jobs/'+job.id+'/return');await fill('flow.collect',{collectorName:pickup.collectorName,comparisonId:pickup.comparisonId,readingId:pickup.readingId,identityEvidence:pickup.identityEvidence,warrantyAdvice:pickup.warrantyAdvice},'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('storage frozen at $30.00'));await shot(state+'-handover')
   await p.goto(h.origin+'/app/jobs/'+job.id+'/storage');assert.equal(await p.locator('form').count(),0);assert.ok((await p.locator('main').innerText()).includes('Physical release ends storage accrual'));await shot(state+'-released')
  }
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
