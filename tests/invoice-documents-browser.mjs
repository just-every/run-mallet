import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {localHttps} from './support/local-https.mjs'
import {creditAccountFixture} from './support/refunds-journey.mjs'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {mixedDocumentInvoice} from './support/invoice-documents-journey.mjs'
export async function invoiceDocumentsBrowser(){
 const h=await installation({network:true,assets:true,secureNetwork:true,localhost:true});let browser
 try{
  const setup=await localHttps(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const {invoice}=await mixedDocumentInvoice(h)
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C30_PROOF_DIR??'.cache/invoice-documents-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'No icon-only control lacks a tooltip');await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`)
  await p.goto(h.origin+'/app/jobs/'+invoice.jobId);await p.getByRole('link',{name:'Issue, print and email invoice copies'}).click();await shot('invoice-01-review')
  await form('invoice.issue').locator('[name="reference"]').fill('synthetic-mallet-310');await form('invoice.issue').locator('[name="warrantyTerms"]').fill('12 months on supplied parts, subject to shop review.');await form('invoice.issue').getByRole('button',{name:'Issue exact invoice copy'}).click();await p.waitForLoadState('domcontentloaded')
  assert.match(await p.locator('main').innerText(),/45000 miles/);assert.match(await p.locator('main').innerText(),/206.98/);await shot('invoice-02-issued')
  const original=(await h.state()).records.invoiceDocument[0]
  await p.getByRole('link',{name:'Print issued copy'}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/12 months on supplied parts/);await shot('invoice-03-print')
  await p.goto(h.origin+'/app/invoices/'+invoice.id)
  const downloadPromise=p.waitForEvent('download');await p.getByRole('link',{name:'Download exact PDF'}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),original.number+'.pdf');await download.saveAs(join(dir,'issued-copy.pdf'))
  await form('invoice.send').locator('[name="consentEvidence"]').fill('Customer explicitly requested this invoice email at the counter');await form('invoice.send').locator('[name="consent"]').check();await form('invoice.send').getByRole('button',{name:'Email exact invoice copy'}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/Handed to the mail provider; delivery is not confirmed/);await shot('invoice-04-provider-outcome');assert.equal(await form('invoice.send').count(),0)
  await form('invoice.issue').locator('[name="reference"]').fill('synthetic-mallet-311');await form('invoice.issue').locator('[name="reason"]').fill('Clarify the warranty copy at customer request');await form('invoice.issue').locator('[name="warrantyTerms"]').fill('12 months on supplied parts; customer must contact the shop for inspection.');await form('invoice.issue').getByRole('button',{name:'Issue exact invoice copy'}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/Corrects M-000001-D001/);await shot('invoice-05-linked-correction')
  assert.deepEqual((await h.state()).records.invoiceDocument.find(d=>d.id===original.id),original);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}

export async function taxCustodyBrowser(){
 const h=await installation({network:true,assets:true,secureNetwork:true,localhost:true});let browser
 try{
  const setup=await localHttps(h.origin+'/setup',{method:'POST',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const {account}=await creditAccountFixture(h),{invoice}=await mixedDocumentInvoice(h)
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C30_PROOF_DIR??'.cache/tax-custody-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`)
  await p.goto(h.origin+'/app/tax');await shot('tax-01-settings');await p.getByRole('link',{name:'Owner certificate custody and invoice tax report'}).click();await p.getByText(account.name,{exact:true}).click();await shot('tax-02-custody')
  for(const [name,value]of Object.entries({reference:'synthetic-mallet-330',jurisdiction:'California shop district',validFrom:'2000-01-01',expiresOn:'2001-01-01',certificate:'Synthetic fleet certificate, retained exactly as supplied.',evidence:'Owner reviewed the supplied certificate'}))await form('tax.certificate').locator('[name="'+name+'"]').fill(value)
  await form('tax.certificate').getByRole('button',{name:'Retain certificate'}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/expired/);assert.match(await p.locator('main').innerText(),/exemption not applied/);await shot('tax-03-expired-certificate')
  await form('tax.assignJurisdiction').locator('[name="jurisdiction"]').fill('California shop district');await form('tax.assignJurisdiction').locator('[name="evidence"]').fill('Owner checked the invoice location and retained supporting evidence');await form('tax.assignJurisdiction').getByRole('button',{name:'Assign invoice jurisdiction'}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/net invoice tax \$3.98/);assert.equal(await form('tax.assignJurisdiction').count(),0);await shot('tax-04-declared-jurisdiction')
  await p.getByRole('link',{name:invoice.number,exact:true}).click();assert.match(p.url(),new RegExp('/app/jobs/'+invoice.jobId));assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
