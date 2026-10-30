import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {supplierEdge} from './support/supplier-edge.mjs'
import {replenishmentFixture} from './support/replenishment-journey.mjs'
export async function replenishmentBrowser(){
 const edge=supplierEdge(),posts=()=>edge.calls.filter(c=>c.method==='POST'&&c.path==='/v1/orders')
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,outboundService:edge.fetch,bindings:{MALLET_SUPPLIER_ORIGIN:edge.origin,MALLET_SUPPLIER_KEY:edge.key,AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
 const f=await replenishmentFixture(h);await h.stepUp();browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM_PATH?{executablePath:process.env.MALLET_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});const context=await browser.newContext()
 await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
 const p=await context.newPage(),directory=process.env.MALLET_REPLENISHMENT_PROOF_DIR??'.cache/replenishment-browser';await mkdir(directory,{recursive:true})
 const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
 await p.goto(h.origin+'/app/inventory/replenishment');if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.goto(h.origin+'/app/inventory/replenishment')}
 const form=p.locator('form').filter({has:p.locator('input[name="command"][value="stock.replenishment"]')})
 for(const [key,value]of Object.entries(f.policy)){const el=form.locator('[name="'+key+'"]');if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(value);else await el.fill(String(value))}
 await form.getByRole('button').click();await p.waitForLoadState('domcontentloaded');assert.ok((await p.locator('main').innerText()).includes('Suggested 8'));await shot('01-low-stock-with-outstanding-po')
 await p.getByRole('button',{name:'Prepare replenishment drafts',exact:true}).click();await p.waitForLoadState('domcontentloaded');await p.getByRole('button',{name:'Prepare replenishment drafts',exact:true}).click();await p.waitForLoadState('domcontentloaded')
 assert.equal((await h.state()).records.purchaseOrder.length,2);await shot('02-deducted-reviewable-draft')
 await p.getByRole('link',{name:'Review purchase orders',exact:true}).click();const approval=p.locator('form').filter({has:p.locator('input[name="command"][value="purchase.approve"]')});await approval.locator('[name="reason"]').fill('Review exact replenishment spend');await shot('03-exact-cart-review')
 await approval.getByRole('button',{name:'Approve spend',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.equal((await h.state()).records.purchaseOrder.filter(po=>po.approval).length,2);await shot('04-approved-cart-not-placed')
 const target=command=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+command+'"]')})
 const submit=async(command,values={})=>{const form=target(command);for(const [key,value]of Object.entries(values)){const input=form.locator('[name="'+key+'"]');if(await input.evaluate(e=>e.tagName)==='SELECT')await input.selectOption(String(value));else await input.fill(String(value))}await form.getByRole('button').click();await p.waitForLoadState('domcontentloaded')}
 await p.goto(h.origin+'/app/inventory/replenishment');await p.getByRole('button',{name:'Compare replenishment suppliers',exact:true}).click();await p.waitForLoadState('domcontentloaded')
 let comparison=(await h.state()).records.purchaseComparison[0];assert.equal(comparison.quantityMilli,8000);assert.equal(comparison.replenishmentSource.policyVersion,1)
 assert.match(await p.locator('main').innerText(),/OE-equivalent/);assert.match(await p.locator('main').innerText(),/Total \$83.00/);await shot('05-quoted-exact-unmet-demand')
 await submit('purchase.cart',{quoteId:'synthetic-mallet-201',reference:'synthetic-mallet-330'})
 let po=(await h.state()).records.purchaseOrder.find(po=>po.comparisonId===comparison.id);assert.equal(po.approval,null);assert.equal(po.binId,f.bin.id);assert.equal(po.lines[0].quantityMilli,8000);assert.equal(po.totalCents,8300);assert.equal(po.replenishmentSource.purchaseId,comparison.replenishmentSource.purchaseId)
 await submit('purchase.approve',{reason:'Approve fresh exact supplier quote with grade, destination, tax and freight'})
 await h.command('stock.reserve',{...f.scans,jobId:f.job.id,quantity:1,reference:'synthetic-mallet-331'})
 await submit('purchase.submit');assert.match(await p.locator('main').innerText(),/Stock, reservations, demand, policy or outstanding orders changed/);assert.equal(posts().length,0);assert.equal((await h.state()).records.purchaseSubmission?.length??0,0);await shot('06-stale-approved-cart-refused')
 await p.goto(h.origin+'/app/inventory/replenishment');await submit('stock.replenish');await p.goto(h.origin+'/app/inventory/replenishment');await p.getByRole('button',{name:'Compare replenishment suppliers',exact:true}).click();await p.waitForLoadState('domcontentloaded')
 const comparisons=(await h.state()).records.purchaseComparison;comparison=comparisons.find(c=>c.id!==comparison.id);assert.equal(comparison.quantityMilli,9000)
 // The earlier comparison already has its superseded cart, leaving one new form.
 await submit('purchase.cart',{quoteId:'synthetic-mallet-201',reference:'synthetic-mallet-332'})
 po=(await h.state()).records.purchaseOrder.find(po=>po.comparisonId===comparison.id)
 assert.deepEqual([po.lines[0].quantityMilli,po.subtotalCents,po.taxCents,po.freightCents,po.totalCents],[9000,9000,100,200,9300]);assert.equal(po.shipTo,'Shelf A');assert.equal(po.policyVersion,1)
 await submit('purchase.approve',{reason:'Approve refreshed exact nine-unit replenishment cart'})
 assert.match(await p.locator('main').innerText(),/Exact cart total \$93.00/);await shot('07-fresh-exact-supplier-approval')
 await submit('purchase.submit');assert.match(await p.locator('main').innerText(),/Supplier outcome: uncertain/);assert.equal(posts().length,1);assert.equal(edge.orders.size,1);await shot('08-durable-uncertain-submission')
 await submit('purchase.reconcile');assert.match(await p.locator('main').innerText(),/Supplier outcome: acknowledged/);assert.equal(posts().length,1)
 const order=(await h.api('/api/mallet/supplier-orders')).orders.find(order=>order.id===po.id);assert.equal(order.submission.orderId,'synthetic-mallet-210');assert.equal(order.submission.replenishmentSource.purchaseId,po.replenishmentSource.purchaseId);assert.equal(order.submission.cart.totalCents,9300);assert.equal(order.submission.cart.lines[0].quantityMilli,9000);await shot('09-one-matching-supplier-acknowledgment')
 await p.goto(h.origin+'/app/inventory/replenishment');const report=await h.api('/api/mallet/replenishment');assert.deepEqual(report.map(r=>[r.availableMilli,r.openOrderMilli,r.projectedMilli,r.suggestedMilli]),[[0,11000,10000,0]]);assert.match(await p.locator('main').innerText(),/Outstanding orders 11/);await shot('10-order-counted-once')

 }finally{await browser?.close();await h.close()}
}
