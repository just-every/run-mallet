import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {purchasingFixture,assertApprovedPurchase,assertPartialPurchase} from './support/purchasing-journey.mjs'
export async function purchasingBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const f=await purchasingFixture(h);browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_PURCHASING_PROOF_DIR??'.cache/purchasing-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{const original=p.viewportSize();for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize(original)}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(c,fields,button)=>{const target=form(c);for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/purchasing');if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.waitForLoadState('domcontentloaded');await p.goto(h.origin+'/app/purchasing')}
  await shot('01-purchase-order-form')
  await fill('purchase.create',{reference:f.input.reference,supplier:f.input.supplier,shipTo:f.input.shipTo,expectedAt:f.input.expectedAt,item0:f.item.id,quantity0:2,cost0:25,job0:f.job.id,item1:f.second.id,quantity1:4,cost1:10,taxUsd:7.5,freightUsd:5},'Prepare two-line PO')
  assert.ok((await p.locator('main').innerText()).includes('Prepared total $102.50'));assert.equal(await form('purchase.receive').count(),0);await shot('02-exact-spend-awaiting-approval')
  const prepared=(await h.state()).records.purchaseOrder.find(r=>r.reference===f.input.reference),lineIds=prepared.lines.map(l=>l.id)
  await fill('purchase.approve',{reason:'Approve exact two-line PO'},'Approve spend')
  let activeReference=f.input.reference
  const section=()=>p.locator('section.card').filter({has:p.getByRole('heading',{name:activeReference,exact:true})}),receive=async(lineId,item,quantity,reference)=>{await section().locator('summary').filter({hasText:/^Receive goods$/}).click();await fill('purchase.receive',{lineId,itemBarcode:item.barcode,binBarcode:f.bin.barcode,quantity,reference},'Receive PO goods')}
  await p.goto(h.origin+'/app/purchasing')
  let po=(await h.state()).records.purchaseOrder.find(r=>r.id===prepared.id)
  assertApprovedPurchase(po,f,lineIds)
  assertApprovedPurchase((await h.api('/api/mallet/purchasing')).find(r=>r.id===prepared.id),f,lineIds)
  const renderedLines=section().locator('ul.list > li.plain')
  assert.equal(await renderedLines.count(),2)
  assert.equal(await renderedLines.nth(0).locator('strong').innerText(),f.item.name)
  assert.ok((await renderedLines.nth(0).innerText()).includes('Ordered 2 × $25.00 · Received 0 · Backorder 2'))
  assert.equal(await renderedLines.nth(1).locator('strong').innerText(),f.second.name)
  assert.ok((await renderedLines.nth(1).innerText()).includes('Ordered 4 × $10.00 · Received 0 · Backorder 4'))
  let text=await section().innerText()
  for(const amount of ['Approved spend $102.50','supplier tax $7.50 and freight $5.00'])assert.ok(text.includes(amount))
  await shot('03-approved-spend')
  await receive(po.lines[0].id,f.item,2,'synthetic-mallet-13')
  const fullReceipt=(await h.state()).records.purchaseReceipt.find(r=>r.reference==='synthetic-mallet-13')
  await receive(po.lines[1].id,f.second,1,'synthetic-mallet-14')
  await p.goto(h.origin+'/app/purchasing')
  const report=(await h.api('/api/mallet/purchasing')).find(r=>r.id===po.id),receivedState=(await h.state()).records.purchaseReceipt
  assertPartialPurchase(report,f,lineIds)
  assert.deepEqual(receivedState.find(r=>r.id===fullReceipt.id),report.receipts.find(r=>r.reference==='synthetic-mallet-13'))
  assert.deepEqual(receivedState.find(r=>r.reference==='synthetic-mallet-14'),report.receipts.find(r=>r.reference==='synthetic-mallet-14'))
  assert.ok((await renderedLines.nth(0).innerText()).includes('Ordered 2 × $25.00 · Received 2 · Backorder 0'))
  assert.ok((await renderedLines.nth(1).innerText()).includes('Ordered 4 × $10.00 · Received 1 · Backorder 3'))
  const renderedReceipts=section().locator('section.card').filter({has:p.getByRole('heading',{name:'Goods receipts',exact:true})}).locator('p')
  assert.equal(await renderedReceipts.count(),2)
  assert.ok((await renderedReceipts.nth(0).innerText()).startsWith('synthetic-mallet-13 · '+f.item.name+' · 2 · '))
  assert.ok((await renderedReceipts.nth(1).innerText()).startsWith('synthetic-mallet-14 · '+f.second.name+' · 1 · '))
  assert.ok((await section().innerText()).includes('Received 1 · Backorder 3'));assert.ok((await section().innerText()).includes('Reserved on receipt'));await shot('04-partial-receipt-and-backorder')
  await section().locator('summary').filter({hasText:/^Record supplier bill$/}).click();await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-15',billQuantity0:2,billCost0:26,billQuantity1:4,billCost1:10,evidence:'Changed supplier invoice'},'Match supplier bill')
  assert.ok((await section().innerText()).includes('billed unit cost differs'));assert.ok((await section().innerText()).includes('quantities differ'));await shot('05-changed-bill-exception')
  await fill('purchase.close',{reason:'Backorder cannot be closed'},'Close matched PO');assert.ok((await p.locator('main').innerText()).includes('Outstanding backorders'));await shot('06-closure-refused')
  await p.goto(h.origin+'/app/purchasing');await receive(po.lines[1].id,f.second,3,'synthetic-mallet-16')
  await section().locator('summary').filter({hasText:/^Record supplier bill$/}).click();await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-15',evidence:'Supplier corrected the full invoice'},'Match supplier bill')
  assert.ok((await section().innerText()).includes('synthetic-mallet-15 · Matched'));await shot('07-matched-with-exception-history')
  await fill('purchase.close',{reason:'Receipts and corrected bill match approved spend'},'Close matched PO');assert.ok((await section().innerText()).includes('closed'));assert.equal(await form('purchase.bill').count(),0);await shot('08-closed-matched-po')
  await p.getByRole('link',{name:'Stock & receiving',exact:true}).last().click();assert.ok((await p.locator('main').innerText()).includes('On hand 2 · Reserved 2 · Available 0'));await shot('09-repair-reservation-and-stock')
  for(const [n,width]of [1440,390].entries()){
   await p.setViewportSize({width,height:1000});await p.goto(h.origin+'/app/purchasing');activeReference='synthetic-mallet-'+(30+n*4)
   await fill('purchase.create',{reference:activeReference,supplier:f.input.supplier,shipTo:f.input.shipTo,expectedAt:f.input.expectedAt,item0:f.item.id,quantity0:2,cost0:25,job0:f.job.id,item1:f.second.id,quantity1:4,cost1:10,taxUsd:7.5,freightUsd:5},'Prepare two-line PO')
   await fill('purchase.approve',{reason:'Approve exact spend before supplier shortage'},'Approve spend');po=(await h.state()).records.purchaseOrder.find(r=>r.reference===activeReference)
   await receive(po.lines[0].id,f.item,2,'synthetic-mallet-'+(31+n*4));await receive(po.lines[1].id,f.second,1,'synthetic-mallet-'+(32+n*4))
   await section().locator('summary').filter({hasText:/^Record supplier bill$/}).click();await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-'+(33+n*4),evidence:'Partial invoice before shortage decision'},'Match supplier bill')
   assert.ok((await section().innerText()).includes('quantities differ'))
   await section().locator('summary').filter({hasText:/^Short-close backorders$/}).click();assert.equal(await form('purchase.shortClose').locator('textarea[name="reason"]').evaluate(e=>e.checkValidity()),false);await shot('10-short-close-reason-required-'+width)
   const stockBefore=await h.api('/api/mallet/inventory'),reason='Supplier cancelled the three remaining filters at '+width
   await fill('purchase.shortClose',{reason},'Short-close remaining quantities')
   let text=await section().innerText();assert.ok(text.includes('Received 1 · Backorder 0 · Short-closed 3'));assert.ok(text.includes(reason));assert.ok(text.includes('Original approved spend $102.50 retained'));assert.ok(text.includes('Short-closed quantities were not received'));assert.equal(await form('purchase.receive').count(),0);assert.equal(await form('purchase.shortClose').count(),0);await shot('11-audited-short-close-'+width)
   await fill('purchase.close',{reason:'An earlier bill cannot close the short-closed PO'},'Close matched PO');assert.ok((await p.locator('main').innerText()).includes('Match the current supplier bill'))
   await p.goto(h.origin+'/app/purchasing');await section().locator('summary').filter({hasText:/^Record supplier bill$/}).click();await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-'+(33+n*4),billCost0:26,taxUsd:8.5,freightUsd:6,evidence:'Changed costs still require correction after shortage'},'Match supplier bill')
   text=await section().innerText();for(const exception of ['unit cost','Supplier tax differs','Freight differs'])assert.ok(text.includes(exception))
   await shot('12-short-close-retains-bill-exceptions-'+width)
   await section().locator('summary').filter({hasText:/^Record supplier bill$/}).click();await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-'+(33+n*4),evidence:'Corrected invoice for goods physically received'},'Match supplier bill')
   assert.ok((await section().innerText()).includes('$72.50'));await fill('purchase.close',{reason:'Received quantities and corrected bill reconcile after short-close'},'Close matched PO')
   text=await section().innerText();assert.ok(text.includes('closed'));assert.ok(text.includes(reason));assert.ok(text.includes('Exception'));assert.ok(text.includes('Matched'));assert.equal(await form('purchase.bill').count(),0);assert.deepEqual(await h.api('/api/mallet/inventory'),stockBefore)
   const report=(await h.api('/api/mallet/purchasing')).find(r=>r.id===po.id);assert.equal(report.fullyReceived,false);assert.equal(report.fullyResolved,true);assert.equal(report.currentBill.totalCents,7250);assert.equal(report.approval.totalCents,10250);await shot('13-closed-short-po-with-source-history-'+width)
  }
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
