import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking} from './harness.mjs'
import {readyInvoice,stripeEdge} from './support/return-journey.mjs'
import {handoverInput} from './support/handover-input.mjs'
import {publicDoor} from './support/portable-repair.mjs'
export async function returnBrowser(){
 const edge=stripeEdge(),h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-91'},outboundService:edge.edge});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const reviewer=await publicDoor(h.origin,h.owner).person('return-reviewer@example.test','admin'),{job,invoice}=await readyInvoice(h,{reviewer}),input=await handoverInput(h,job.id,'Authorized collector')
  const payment=edge.paid('synthetic-mallet-98',invoice);edge.receipts.set(payment.id,payment)
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext();await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C19_PROOF_DIR??'.cache/return-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else if(await el.getAttribute('type')==='checkbox')await el.check();else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  const releaseFields={collectorName:input.collectorName,delegateId:input.delegateId,comparisonId:input.comparisonId,readingId:input.readingId,identityEvidence:input.identityEvidence,warrantyAdvice:input.warrantyAdvice}
  await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByRole('link',{name:'Document handover',exact:true}).click();await shot('return-01-unpaid')
  await fill(form('flow.collect'),releaseFields,'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('Processor-confirmed captured funds'));await shot('return-02-unpaid-refused')
  await p.goto(h.origin+'/app/jobs/'+job.id+'/return');await fill(form('return.delegate'),{delegateName:input.collectorName,evidence:'Customer signed new explicit collection authority at counter',consent:true},'Record delegate authority')
  releaseFields.delegateId=(await h.state()).records.returnDelegate.find(d=>d.jobId===job.id&&d.evidence==='Customer signed new explicit collection authority at counter').id;await shot('return-03-delegate-recorded')
  await fill(form('payment.verifyStripe'),{paymentIntentId:payment.id},'Check processor receipt');assert.ok((await p.locator('main').innerText()).includes('Test mode'));await shot('return-04-processor-confirmed')
  await fill(form('flow.collect'),releaseFields,'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('Stripe confirmed captured funds at handover'));await shot('return-05-documented-handover')
  await p.getByRole('link',{name:'Print or save handover receipt'}).click();assert.ok((await p.locator('main').innerText()).includes('Vehicle key: 1 of 1 returned'));await shot('return-06-print-receipt')
  // The explicit unpaid exception is a different receipt and never records tender.
  const asset=await h.command('asset.create',{customerName:'Second Customer',label:'Second vehicle',identifier:'synthetic-mallet-99'}),second=await readyInvoice(h,{asset,reviewer}),unpaid=await handoverInput(h,second.job.id,'Second Customer')
  await p.goto(h.origin+'/app/jobs/'+second.job.id+'/return');await fill(form('return.override'),{reason:'Owner explicitly releases this vehicle pending payment after reviewing the customer agreement'},'Permit unpaid release');const exception=(await h.state()).records.returnOverride.find(o=>o.jobId===second.job.id&&o.reason==='Owner explicitly releases this vehicle pending payment after reviewing the customer agreement')
  await fill(form('flow.collect'),{collectorName:unpaid.collectorName,comparisonId:unpaid.comparisonId,readingId:unpaid.readingId,identityEvidence:unpaid.identityEvidence,warrantyAdvice:unpaid.warrantyAdvice,overrideId:exception.id},'Record documented handover');assert.ok((await p.locator('main').innerText()).includes(exception.reason));assert.ok((await p.locator('main').innerText()).includes('settlement is not verified'));await shot('return-07-explicit-owner-exception')
  const freeAsset=await h.command('asset.create',{customerName:'Warranty Customer',customerEmail:'free@example.test',label:'No-charge warranty repair',identifier:'synthetic-mallet-102'}),free=await readyInvoice(h,{asset:freeAsset,reviewer,free:true}),freeInput=await handoverInput(h,free.job.id,'Warranty Customer')
  await p.goto(h.origin+'/app/jobs/'+free.job.id+'/return');await fill(form('flow.collect'),{collectorName:freeInput.collectorName,comparisonId:freeInput.comparisonId,readingId:freeInput.readingId,identityEvidence:freeInput.identityEvidence,warrantyAdvice:freeInput.warrantyAdvice},'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('No payment due on this zero-total invoice'));assert.ok(!(await p.locator('main').innerText()).includes('Stripe confirmed captured funds at handover'));await shot('return-08-no-charge-no-processor-claim');assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
