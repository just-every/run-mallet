import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking,archive,restore} from './harness.mjs'
import {readyInvoice,stripeEdge,assertDelegateEvidence,assertRecordedAt} from './support/return-journey.mjs'
import {handoverInput} from './support/handover-input.mjs'
import {publicDoor} from './support/portable-repair.mjs'
export async function returnBrowser(){
 const edge=stripeEdge(),h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-91'},outboundService:edge.edge});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const reviewer=await publicDoor(h.origin,h.owner).person('return-reviewer@example.test','admin'),{job,invoice}=await readyInvoice(h,{reviewer}),input=await handoverInput(h,job.id,'Authorized collector')
  const payment=edge.paid('synthetic-mallet-98',invoice);edge.receipts.set(payment.id,payment)
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C19_PROOF_DIR??'.cache/return-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else if(await el.getAttribute('type')==='checkbox')await el.check();else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  const releaseFields={collectorName:input.collectorName,delegateId:input.delegateId,comparisonId:input.comparisonId,readingId:input.readingId,identityEvidence:input.identityEvidence,warrantyAdvice:input.warrantyAdvice}
  await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByRole('link',{name:'Document handover',exact:true}).click();await shot('return-01-unpaid')
  await fill(form('flow.collect'),releaseFields,'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('Processor-confirmed captured funds'));await shot('return-02-unpaid-refused')
  await p.goto(h.origin+'/app/jobs/'+job.id+'/return');await fill(form('return.delegate'),{delegateName:input.collectorName,evidence:'Customer signed new explicit collection authority at counter',consent:true},'Record delegate authority')
  releaseFields.delegateId=(await h.state()).records.returnDelegate.find(d=>d.jobId===job.id&&d.evidence==='Customer signed new explicit collection authority at counter').id;await shot('return-03-delegate-recorded')
  await fill(form('payment.verifyStripe'),{paymentIntentId:payment.id},'Check processor receipt');assert.ok((await p.locator('main').innerText()).includes('Live mode'));await shot('return-04-processor-confirmed')
  await fill(form('flow.collect'),releaseFields,'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('Stripe confirmed captured funds at handover'));await shot('return-05-documented-handover')
  await p.getByRole('link',{name:'Print or save handover receipt'}).click();assert.ok((await p.locator('main').innerText()).includes('Vehicle key: 1 of 1 returned'));await shot('return-06-print-receipt')
  // The explicit unpaid exception is a different receipt and never records tender.
  const asset=await h.command('asset.create',{customerName:'Second Customer',label:'Second vehicle',identifier:'synthetic-mallet-99'}),second=await readyInvoice(h,{asset,reviewer}),unpaid=await handoverInput(h,second.job.id,'Second Customer')
  await h.stepUp();await p.goto(h.origin+'/app/jobs/'+second.job.id+'/return');assert.ok((await p.locator('main').innerText()).includes('possessory lien'));await fill(form('return.override'),{reason:'Owner explicitly releases this vehicle pending payment after reviewing the customer agreement'},'Permit unpaid release');const exception=(await h.state()).records.returnOverride.find(o=>o.jobId===second.job.id&&o.reason==='Owner explicitly releases this vehicle pending payment after reviewing the customer agreement')
  await fill(form('flow.collect'),{collectorName:unpaid.collectorName,comparisonId:unpaid.comparisonId,readingId:unpaid.readingId,identityEvidence:unpaid.identityEvidence,warrantyAdvice:unpaid.warrantyAdvice,overrideId:exception.id},'Record documented handover');assert.ok((await p.locator('main').innerText()).includes(exception.reason));assert.ok((await p.locator('main').innerText()).includes('settlement is not verified'));await shot('return-07-explicit-owner-exception')
  for(const [n,method]of ['cash','check','other'].entries()){
   const asset=await h.command('asset.create',{customerName:'Counter '+method,label:'Counter pickup',identifier:'synthetic-mallet-'+(110+n)}),manual=await readyInvoice(h,{asset,reviewer,failedQuality:method==='cash',onFailed:async({job,failed})=>{
    await p.goto(h.origin+'/app/jobs/'+job.id)
    assert.ok((await p.locator('main').innerText()).includes(failed.note),'The native repair retains the failed physical check')
    await shot('return-13-failed-quality')
    await p.goto(h.origin+'/app/jobs/'+job.id+'/return')
    assert.equal(await form('flow.collect').count(),0,'An uncleared repair has no native handover form')
    assert.ok((await p.locator('main').innerText()).includes('invoice'))
    await shot('return-14-failed-quality-no-handover')
   }}),pickup=await handoverInput(h,manual.job.id,method==='cash'?'Cash pickup delegate':asset.customerName)
   const recorder=(await h.state()).actor
   let authorization,delegateBefore,delegateAfter,savedDelegate
   if(method==='cash'){
    authorization={jobId:manual.job.id,customerName:'Counter cash',delegateName:'Cash pickup delegate',consent:true,evidence:'Customer signed cash pickup authorization synthetic-mallet-119 at the counter'}
    const known=(await h.state()).records.returnDelegate.map(d=>d.id);await p.goto(h.origin+'/app/jobs/'+manual.job.id+'/return');delegateBefore=new Date().toISOString()
    await fill(form('return.delegate'),{customerName:authorization.customerName,delegateName:authorization.delegateName,consent:true,evidence:authorization.evidence},'Record delegate authority');delegateAfter=new Date().toISOString()
    savedDelegate=(await h.state()).records.returnDelegate.find(d=>!known.includes(d.id));assertDelegateEvidence(savedDelegate,authorization,recorder,delegateBefore,delegateAfter)
    pickup.delegateId=savedDelegate.id;pickup.identityEvidence='Counter staff checked this collector against the signed cash pickup authority; no identity document retained'
    await p.reload();assert.ok((await p.locator('main').innerText()).includes(authorization.evidence));await shot('return-11-cash-delegate-authority')
   }
   await p.goto(h.origin+'/app/jobs/'+manual.job.id+'/return');await fill(form('payment.record'),{method,reference:'synthetic-mallet-'+(113+n),evidence:'Counter staff recorded '+method+' tender for the exact revision'},'Record tender evidence');assert.ok(p.url().endsWith('/return'));await shot('return-09-'+method+'-tender')
   const handoverBefore=new Date().toISOString()
   await fill(form('flow.collect'),{collectorName:pickup.collectorName,delegateId:pickup.delegateId,comparisonId:pickup.comparisonId,readingId:pickup.readingId,identityEvidence:pickup.identityEvidence,warrantyAdvice:pickup.warrantyAdvice},'Record documented handover');const handoverAfter=new Date().toISOString(),copy=await p.locator('main').innerText();assert.ok(copy.includes('Tender recorded by staff; Mallet did not verify funds'));assert.equal(copy.includes('not cleared'),method==='check');await shot('return-10-'+method+'-handover')
   if(method==='cash'){
    const state=await h.state(),saved=state.records.handover.find(r=>r.jobId===manual.job.id)
    assert.equal(saved.jobId,manual.job.id);assert.equal(saved.assetId,asset.id);assert.equal(saved.invoiceId,manual.invoice.id);assert.equal(saved.collectorName,'Cash pickup delegate')
    assertDelegateEvidence(state.records.returnDelegate.find(d=>d.id===savedDelegate.id),authorization,recorder,delegateBefore,delegateAfter)
    assertDelegateEvidence(saved.delegate,authorization,recorder,delegateBefore,delegateAfter);assert.deepEqual(saved.delegate,savedDelegate)
    assert.equal(saved.identityEvidence,pickup.identityEvidence);assert.equal(saved.identityVerifiedByMallet,false);assert.deepEqual(saved.by,recorder);assertRecordedAt(saved.at,handoverBefore,handoverAfter)
    await h.command('return.delegate',{...authorization,version:pickup.version,evidence:'Attempted browser receipt replacement'},{status:409});await h.command('flow.collect',pickup,{status:409})
    assert.deepEqual((await h.state()).records,state.records,'Refused replacement and collection replay preserve every saved record')
    await p.reload();await p.getByRole('link',{name:'Print or save handover receipt'}).click()
    const printable=await p.locator('main').innerText()
    for(const text of [authorization.customerName,authorization.delegateName,authorization.evidence,pickup.identityEvidence,recorder.name,'Vehicle key: 1 of 1 returned','Collector identity was checked by staff, not verified by Mallet.'])assert.ok(printable.includes(text),'The printable cash handover shows '+text)
    await shot('return-12-cash-delegate-print')
    const fresh=await installation()
    try{
     const freshOwner=(await fresh.state()).actor;await restore(fresh,await archive(h));const recovered=await fresh.state();assert.equal(recovered.actor.id,freshOwner.id);assert.notEqual(recovered.actor.id,recorder.id)
     for(const kind of ['handover','returnDelegate','returnOverride','payment','flow','quality'])assert.deepEqual(recovered.records[kind],state.records[kind],'The native cash flow recovers exact '+kind+' evidence')
     await fresh.command('flow.collect',pickup,{as:h.owner,status:401});await fresh.command('flow.collect',pickup,{status:409});assert.deepEqual((await fresh.state()).records,recovered.records)
    }finally{await fresh.close()}
   }
  }
  const freeAsset=await h.command('asset.create',{customerName:'Warranty Customer',customerEmail:'free@example.test',label:'No-charge warranty repair',identifier:'synthetic-mallet-102'}),free=await readyInvoice(h,{asset:freeAsset,reviewer,free:true}),freeInput=await handoverInput(h,free.job.id,'Warranty Customer')
  await p.goto(h.origin+'/app/jobs/'+free.job.id+'/return');await fill(form('flow.collect'),{collectorName:freeInput.collectorName,comparisonId:freeInput.comparisonId,readingId:freeInput.readingId,identityEvidence:freeInput.identityEvidence,warrantyAdvice:freeInput.warrantyAdvice},'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('No payment due on this zero-total invoice'));assert.ok(!(await p.locator('main').innerText()).includes('Stripe confirmed captured funds at handover'));assert.ok(!/processor-confirmed captured funds/i.test(await p.locator('main').innerText()));await shot('return-08-no-charge-no-processor-claim');assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
