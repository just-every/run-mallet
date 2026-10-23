import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,snapshots} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {assetFixtures,assetInput,repairToInvoice,currentJob} from './support/asset-journey.mjs'
export async function assetBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const reviewer=await publicDoor(h.origin,h.owner).person('asset-reviewer@example.test','admin')
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext();await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const dir=process.env.MALLET_ASSET_PROOF_DIR??'.cache/asset-browser';await mkdir(dir,{recursive:true})
  const form=command=>p.locator(`form:has(input[name="command"][value="${command}"])`)
  const fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const input=target.locator(`[name="${name}"]`);if(await input.evaluate(e=>e.tagName)==='SELECT')await input.selectOption(String(value));else if(await input.getAttribute('type')==='checkbox')await input.check();else await input.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
   // All controls on these screens use visible words. This catches an icon-only
   // addition that would need the owner's hover/focus tooltip before shipping.
   for(const el of await p.locator('a,button').all())if(await el.isVisible())assert.ok((await el.innerText()).trim(),name+' control has visible words or needs a tooltip')
   await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  for(const [index,f]of assetFixtures.entries()){
   if(f.assetType!=='vehicle'){
    await p.goto(h.origin+'/app/tax');const detail=p.locator('details').filter({has:form('tax.configure').filter({has:p.locator(`input[name="assetType"][value="${f.assetType}"]`)})})
    await detail.locator('summary').click();const tax=detail.locator('form');await tax.locator('[name="ratePercent"]').fill(String(f.tax.ratePercent));await tax.locator('[name="partsTaxable"]').setChecked(f.tax.partsTaxable);await tax.locator('[name="laborTaxable"]').setChecked(f.tax.laborTaxable);await shot(f.assetType+'-00-tax-form');await tax.getByRole('button',{name:'Save '+f.assetType+' tax rule'}).click();await p.waitForLoadState('domcontentloaded');await shot(f.assetType+'-00-tax-rule')
   }
   await p.goto(h.origin+'/app/customers?type='+f.assetType+'#add');await shot(f.assetType+'-01-register')
   const input=assetInput(f);await fill(form('asset.create'),{customerName:input.customerName,customerEmail:input.customerEmail,label:input.label,identifier:input.identifier,...Object.fromEntries(Object.entries(input.specifications).map(([key,value])=>['spec:'+key,value]))},f.assetType==='vehicle'?'Add vehicle':'Add asset')
   const assetId=p.url().split('/').at(-1);assert.ok((await p.locator('main').innerText()).includes(f.identifier));await shot(f.assetType+'-02-asset')
   await fill(form('job.book'),{title:f.labor,bayId:'Bench '+index,startAt:'2026-10-23T09:00:00Z',endAt:'2026-10-23T10:00:00Z'},'Book visit');const jobId=p.url().split('/').at(-1)
   assert.ok((await p.locator('main').innerText()).includes(f.identifier));await shot(f.assetType+'-03-repair')
   if(f.assetType==='bicycle'){
    await p.goto(h.origin+'/app/assets/'+assetId);await fill(form('asset.update'),{'spec:components':'Later component description'},'Save asset details');assert.ok(p.url().endsWith('/app/assets/'+assetId));assert.ok((await p.locator('main').innerText()).includes('Later component description'));await shot(f.assetType+'-04-edited-asset')
   }
   await p.goto(h.origin+'/app/jobs/'+jobId+'/intake')
   await fill(form('intake.record'),{damage:'Observed scratches before '+f.assetType+' work',itemLines:f.items.map(i=>i.kind+' | '+i.label+' | '+i.quantity).join('\n'),lockHandling:'Customer keeps all credentials; no unlock secret collected',signedBy:input.customerName,consent:true},'Sign custody receipt');await shot(f.assetType+'-05-intake')
   let job=await currentJob(h,jobId);const {invoice}=await repairToInvoice(h,job,f,{reviewer,configure:false});job=await currentJob(h,jobId)
   await p.goto(h.origin+'/app/jobs/'+jobId);await shot(f.assetType+'-06-invoice')
   if(['vehicle','equipment'].includes(f.assetType)){
    await p.getByText('Record mileage or hours',{exact:true}).click();assert.equal(await form('reading.record').locator('[name="unit"]').inputValue(),f.assetType==='equipment'?'hours':'miles')
    await fill(form('reading.record'),{value:f.assetType==='equipment'?241:65000,stage:'out',observedAt:new Date(Date.now()-1000).toISOString()},'Save reading')
   }
   await p.goto(h.origin+'/app/jobs/'+jobId+'/intake');await p.getByText('Compare the actual handover checklist',{exact:true}).click();await fill(form('intake.compare'),{signedBy:input.customerName,consent:true},'Sign checklist comparison')
   const state=await h.state(),comparison=state.records.intakeComparison.find(r=>r.jobId===jobId),reading=state.records.reading?.find(r=>r.jobId===jobId&&r.stage==='out')
   await p.goto(h.origin+'/app/jobs/'+jobId+'/return');assert.equal(await form('flow.collect').locator('[name="readingId"]').count(),reading?1:0);await shot(f.assetType+'-07-return-unpaid')
   await fill(form('flow.collect'),{collectorName:input.customerName,comparisonId:comparison.id,...(reading?{readingId:reading.id}:{}),identityEvidence:'Staff checked collector in person',warrantyAdvice:'Warranty explained; ask the shop for a paper receipt.'},'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('Processor-confirmed captured funds'));await shot(f.assetType+'-08-unpaid-refused')
   await p.goto(h.origin+'/app/jobs/'+jobId+'/return');await fill(form('payment.record'),{amountUsd:invoice.totals.totalCents/100,method:'cash',reference:'synthetic-mallet-'+(220+index),evidence:'Staff counted this exact cash tender at the counter'},'Record tender evidence');await shot(f.assetType+'-09-tender')
   await fill(form('flow.collect'),{collectorName:input.customerName,comparisonId:comparison.id,...(reading?{readingId:reading.id}:{}),identityEvidence:'Staff checked collector in person',warrantyAdvice:'Warranty explained; ask the shop for a paper receipt.'},'Record documented handover');assert.ok((await p.locator('main').innerText()).includes('Tender recorded by staff; Mallet did not verify funds'));await shot(f.assetType+'-10-handover')
   await p.getByRole('link',{name:'Print or save handover receipt'}).click();const copy=await p.locator('main').innerText();assert.ok(copy.includes(f.identifier));for(const item of f.items)assert.ok(copy.includes(item.label+': '+item.quantity+' of '+item.quantity+' returned'));assert.equal(copy.includes('Mileage-out:'),f.assetType==='vehicle');assert.equal(copy.includes('Hours-out:'),f.assetType==='equipment');await shot(f.assetType+'-11-print')
  }
  const legacyInput=await snapshots(),preview=await h.api('/api/mallet/imports/preview',legacyInput)
  await h.api('/api/mallet/imports/apply',{...legacyInput,fingerprint:preview.fingerprint});const legacy=(await h.state()).records.asset.find(a=>!a.assetType)
  await p.goto(h.origin+'/app/assets/'+legacy.id);await shot('legacy-12-unclassified')
  await fill(form('asset.update'),{assetType:'equipment'},'Save asset details');await fill(form('asset.update'),{'spec:model':'Declared compressor model'},'Save asset details');assert.ok((await p.locator('main').innerText()).includes('Declared compressor model'));await shot('legacy-13-classified')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
