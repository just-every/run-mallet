import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {storageInstallation,ruleInput,CLOCK} from './support/storage-journey.mjs'
import {readyInvoice} from './support/return-journey.mjs'
import {handoverInput} from './support/handover-input.mjs'
import {publicDoor} from './support/portable-repair.mjs'
export async function storageBrowser(t){
 const h=await storageInstallation(t,{entry:'tests/storage-dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
 let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const reviewer=await publicDoor(h.origin,h.owner).person('storage-reviewer@example.test','admin'),asset=await h.command('asset.create',{customerName:'Synthetic Storage Customer',label:'Uncollected California vehicle',identifier:'synthetic-mallet-1220'}),{job,invoice}=await readyInvoice(h,{asset,reviewer}),pickup=await handoverInput(h,job.id,asset.customerName);delete pickup.overrideId
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  const cookies=async()=>{await context.clearCookies();await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))};await cookies()
  const p=await context.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message))
  const dir=process.env.MALLET_STORAGE_PROOF_DIR??'.cache/storage-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const form=command=>p.locator(`form:has(input[name="command"][value="${command}"])`)
  const fill=async(target,fields,button)=>{for(const [key,value]of Object.entries(fields)){const el=target.locator(`[name="${key}"]`).first();if(await el.getAttribute('type')==='checkbox'){if(value)await el.check();else await el.uncheck()}else if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/data');await p.getByRole('link',{name:'Storage rule settings',exact:true}).click()
  const ruleFields={...ruleInput(),storageCapUsd:150};delete ruleFields.storageCapCents;await fill(form('storage.rule'),ruleFields,'Save reviewed rule version');assert.match(await p.locator('main').innerText(),/Synthetic reviewed CA version 1/);await shot('01-reviewed-settings')
  await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByRole('link',{name:'Storage & repair lien',exact:true}).click()
  const rule=(await h.state()).records.storageRule[0]
  await fill(form('storage.open'),{ruleId:rule.id,uncollectedAt:CLOCK,dailyUsd:50,triggerEvidence:'Customer notified of completion and agreed the recorded rate',recipientSearch:'Synthetic title search: one lender, all required recipients recorded',ownerAddress:'1 Synthetic Street',lienholderName:'Synthetic Lender',lienholderAddress:'2 Synthetic Street',reviewer:'Synthetic Case Reviewer',legalReference:'synthetic-mallet-1221',confirm:true},'Open storage case');assert.match(await p.locator('main').innerText(),/Synthetic Lender/)
  await shot('02-open-custody')
  await fill(form('storage.dispose'),{reviewer:'Synthetic lawyer',legalReference:'synthetic-mallet-1222',completedSteps:'Review requested before clocks complete',evidence:'No disposition occurred',confirm:true},'Record legally reviewed disposal');assert.match(await p.locator('main').innerText(),/Every required recipient/);await shot('03-early-disposal-refused')
  await h.advance('2026-11-11T12:00:00.000Z');await cookies();await p.goto(h.origin+'/app/jobs/'+job.id+'/storage')
  let r=(await h.state()).records.storageCase[0]
  for(const recipient of r.recipients){await fill(form('storage.notice'),{recipientId:recipient.id,method:'Certified mail',sentAt:'2026-11-11T12:00:00Z',deliveredAt:'2026-11-11T12:00:00Z',content:'Reviewed exact notice for '+recipient.name,deliveryEvidence:'Synthetic signed delivery '+recipient.name},'Record delivery evidence')}
  assert.match(await p.locator('main').innerText(),/all required delivery evidence recorded/);await shot('04-notice-clocks')
  await h.advance('2026-11-13T12:00:00.000Z');await cookies();await p.goto(h.origin+'/app/jobs/'+job.id+'/storage')
  await fill(form('storage.accrue'),{throughAt:'2026-11-13T12:00:00Z'},'Record storage statement');assert.match(await p.locator('main').innerText(),/2 elapsed days · accrued \$100\.00/)
  await fill(form('storage.payment'),{amountUsd:100,reference:'synthetic-mallet-1223',evidence:'Staff counted separate storage tender'},'Record storage tender');assert.match(await p.locator('main').innerText(),/storage due \$0\.00/);await shot('05-paid-storage')
  await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,invoiceRevision:invoice.revision,amountCents:invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-1224',evidence:'Staff counted repair tender'})
  await p.getByRole('link',{name:'Document handover',exact:true}).click();await fill(form('flow.collect'),{collectorName:pickup.collectorName,comparisonId:pickup.comparisonId,readingId:pickup.readingId,identityEvidence:pickup.identityEvidence,warrantyAdvice:pickup.warrantyAdvice,lienWaiverUsd:0},'Record documented handover')
  assert.match(await p.locator('main').innerText(),/Storage release/);assert.match(await p.locator('main').innerText(),/accrued \$100\.00 · paid \$100\.00 · lien waived \$0\.00/);await shot('06-release-receipt')
  await h.advance('2026-11-15T12:00:00.000Z');await cookies();await p.goto(h.origin+'/app/jobs/'+job.id+'/storage');assert.match(await p.locator('main').innerText(),/Final accrued storage \$100\.00/);assert.match(await p.locator('main').innerText(),/Accrual has ended/);await shot('07-frozen-history')
  const iconOnly=await p.locator('button,a').evaluateAll(items=>items.filter(el=>el.querySelector('svg')&&!el.textContent.trim()).map(el=>el.outerHTML));assert.deepEqual(iconOnly,[],'Changed screen has no icon-only controls');assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close();t.mock.timers.reset()}
}
