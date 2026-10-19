import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
export async function supplementBrowser(h,{job,root,declined,rotor}){
 let browser
 try{
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',timezoneId:'America/New_York'})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const dir='.cache/supplement-browser';await mkdir(dir,{recursive:true})
  const shot=async(name,locator)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'EST-004 fits '+width);if(locator)await locator.scrollIntoViewIfNeeded();await page.screenshot({path:dir+'/'+name+'-'+width+'.png'})}await page.setViewportSize({width:1440,height:1000})}
  const url=h.origin+'/app/jobs/'+job.id;await page.goto(url);await shot('01-exact-scopes')
  const add=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Additional scope on this repair',exact:true})})
  await add.getByText('Prepare an incremental supplement',{exact:true}).click();const prepare=add.locator('form').first()
  await prepare.getByLabel('Why this supplement is needed').fill('Small retaining clip found during brake reassembly; optional labor remains separate')
  for(const [label,value] of [['Part description','Retaining clip'],['Part quantity','1'],['Part unit price (before tax)','3'],['Labor description','Optional clip installation'],['Labor hours','0.1'],['Labor rate (per hour, before tax)','120']])await prepare.getByLabel(label,{exact:true}).fill(value)
  await shot('02-incremental-form',prepare);await prepare.getByRole('button',{name:'Prepare supplement',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  let q=(await h.state()).records.estimate.find(q=>q.reason==='Small retaining clip found during brake reassembly; optional labor remains separate');assert.ok(q)
  const card=()=>page.locator('section.card').filter({has:page.getByRole('heading',{name:`Supplement ${q.sequence} · incremental scope`,exact:true})})
  await shot('03-draft-incremental',card());await card().getByRole('button',{name:'Approve estimate',exact:true}).click();await page.waitForLoadState('domcontentloaded');await card().getByLabel('Shared by').selectOption('printed');await card().getByLabel('Handoff note').fill('Printed and handed to Dana; no email delivery claimed');await card().getByRole('button',{name:'Record estimate shared',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  await card().getByLabel('Customer who authorized').fill('Dana Brooks');await card().getByLabel('Authorization evidence / reference').fill('Dana declined all clip work on the paper supplement; existing brakes remain authorized')
  await shot('04-separate-decision',card());await card().getByRole('button',{name:'Record customer authorization',exact:true}).click();await page.waitForLoadState('domcontentloaded');await shot('05-declined-keeps-work',card())
  q=(await h.state()).records.estimate.find(e=>e.id===q.id);assert.equal(q.status,'declined');assert.deepEqual(q.authorisation.lineIds,[])
  await add.getByText('Change the price of unworked authorized scope',{exact:true}).click()
  const reprice=add.locator('form').last();await reprice.getByLabel('Authorized scope to reprice').selectOption({index:0});await reprice.getByLabel('Unworked quantity to replace').fill('1');await reprice.getByLabel('New unit price (USD before tax)').fill('45');await reprice.getByLabel('Why this price change is needed').fill('Current pad quote requires an independent prospective price decision')
  await shot('08-prospective-price-form',reprice);await reprice.getByRole('button',{name:'Prepare price-change supplement',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  const replacement=(await h.state()).records.estimate.find(e=>e.reason==='Current pad quote requires an independent prospective price decision');assert.ok(replacement);assert.equal(replacement.revisions[0].lines[0].unitCents,4500);assert.deepEqual(replacement.revisions[0].lines[0].replaces,{estimateId:root.id,revision:1,lineId:'pads',quantityMilli:1000});assert.equal(replacement.authorisation,null)
  const state=await h.state();assert.deepEqual(state.records.estimate.find(e=>e.id===root.id),root);assert.deepEqual(state.records.estimate.find(e=>e.id===declined.id),declined)
  assert.equal(state.records.job.find(j=>j.id===job.id).estimateId,root.id)
  await page.goto(h.origin+'/app/estimates/'+rotor.id+'/print');assert.ok((await page.locator('main').innerText()).includes('Replacement rotor'));await shot('06-printed-supplement')
  await page.goto(h.origin+'/app');await shot('07-board-existing-work');assert.deepEqual(errors,[],'EST-004 browser errors')
 }finally{await browser?.close()}
}

export async function supplementInvoiceBrowser(h,jobId){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',timezoneId:'America/New_York'})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage();await page.goto(h.origin+'/app/jobs/'+jobId)
  const card=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Handover invoice',exact:true})})
  assert.ok((await card.innerText()).includes('$400.00'));assert.equal(await card.locator('a[href^="/api/mallet/exports/"]').count(),1)
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await card.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'EST-004 invoice fits '+width);await page.screenshot({path:'.cache/supplement-browser/09-combined-invoice-'+width+'.png'})}
 }finally{await browser.close()}
}
