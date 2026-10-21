import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {purchasingFixture} from './support/purchasing-journey.mjs'
export async function purchasingBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const f=await purchasingFixture(h);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_PURCHASING_PROOF_DIR??'.cache/purchasing-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(c,fields,button)=>{const target=form(c);for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/purchasing');if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.waitForLoadState('domcontentloaded');await p.goto(h.origin+'/app/purchasing')}
  await shot('01-purchase-order-form')
  await fill('purchase.create',{reference:f.input.reference,supplier:f.input.supplier,shipTo:f.input.shipTo,expectedAt:f.input.expectedAt,item0:f.item.id,quantity0:2,cost0:25,job0:f.job.id,item1:f.second.id,quantity1:4,cost1:10,taxUsd:7.5,freightUsd:5},'Prepare two-line PO')
  assert.ok((await p.locator('main').innerText()).includes('Prepared total $102.50'));assert.equal(await form('purchase.receive').count(),0);await shot('02-exact-spend-awaiting-approval')
  await fill('purchase.approve',{reason:'Approve exact two-line PO'},'Approve spend');await shot('03-approved-spend')
  const section=()=>p.locator('section.card').filter({has:p.getByRole('heading',{name:f.input.reference,exact:true})}),receive=async(lineId,item,quantity,reference)=>{await section().locator('summary').filter({hasText:/^Receive goods$/}).click();await fill('purchase.receive',{lineId,itemBarcode:item.barcode,binBarcode:f.bin.barcode,quantity,reference},'Receive PO goods')}
  let po=(await h.state()).records.purchaseOrder[0]
  await receive(po.lines[0].id,f.item,2,'synthetic-mallet-13');await receive(po.lines[1].id,f.second,1,'synthetic-mallet-14')
  assert.ok((await section().innerText()).includes('Received 1 · Backorder 3'));assert.ok((await section().innerText()).includes('Reserved on receipt'));await shot('04-partial-receipt-and-backorder')
  await section().locator('summary').filter({hasText:/^Record supplier bill$/}).click();await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-15',billQuantity0:2,billCost0:26,billQuantity1:4,billCost1:10,evidence:'Changed supplier invoice'},'Match supplier bill')
  assert.ok((await section().innerText()).includes('billed unit cost differs'));assert.ok((await section().innerText()).includes('quantities differ'));await shot('05-changed-bill-exception')
  await fill('purchase.close',{reason:'Backorder cannot be closed'},'Close matched PO');assert.ok((await p.locator('main').innerText()).includes('Outstanding backorders'));await shot('06-closure-refused')
  await p.goto(h.origin+'/app/purchasing');await receive(po.lines[1].id,f.second,3,'synthetic-mallet-16')
  await section().locator('summary').filter({hasText:/^Record supplier bill$/}).click();await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-15',evidence:'Supplier corrected the full invoice'},'Match supplier bill')
  assert.ok((await section().innerText()).includes('synthetic-mallet-15 · Matched'));await shot('07-matched-with-exception-history')
  await fill('purchase.close',{reason:'Receipts and corrected bill match approved spend'},'Close matched PO');assert.ok((await section().innerText()).includes('closed'));assert.equal(await form('purchase.bill').count(),0);await shot('08-closed-matched-po')
  await p.getByRole('link',{name:'Stock & receiving',exact:true}).last().click();assert.ok((await p.locator('main').innerText()).includes('On hand 2 · Reserved 2 · Available 0'));await shot('09-repair-reservation-and-stock')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
