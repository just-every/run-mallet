import assert from 'node:assert/strict'
import {partsBrowser} from './support/parts-browser.mjs'
import {supplierFixture} from './support/supplier-orders-journey.mjs'
import {supplierEdge} from './support/supplier-edge.mjs'
export async function supplierBrowser(){
 const edge=supplierEdge()
 return partsBrowser('supplier-orders',supplierFixture,async({h,f,p,go,shot,submit,form})=>{
 await go('/app/purchasing/suppliers');await submit('purchase.compare',f.compare)
 let content=await p.locator('main').innerText();for(const text of ['Cedar Parts','Maple Parts','OE-equivalent','Remanufactured','Available 10','Freight $2.00','ETA','Delivery cutoff'])assert.ok(content.includes(text),text)
 await shot('01-two-current-supplier-offers')
 await submit('purchase.cart',{quoteId:'synthetic-mallet-201',reference:'synthetic-mallet-230',shipTo:'Receiving bench, 17 Cedar Rd',binId:f.bin.id});await shot('02-exact-supplier-cart')
 await submit('purchase.approve',{reason:'Approve exact Cedar SKU, grade, quantity and $13 cart'});await shot('03-explicit-approved-spend')
 await submit('purchase.submit',{});assert.match(await p.locator('main').innerText(),/Supplier outcome: uncertain/);assert.equal(edge.orders.size,1);await shot('04-timed-out-outcome-not-acknowledged')
 await submit('purchase.reconcile',{});assert.match(await p.locator('main').innerText(),/Supplier outcome: acknowledged/)
 const po=(await h.state()).records.purchaseOrder[0];assert.equal((await h.api('/api/mallet/supplier-orders')).orders[0].lines[0].jobId,f.job.id);assert.equal(edge.calls.filter(c=>c.path==='/v1/orders'&&c.method==='POST').length,1);await shot('05-one-acknowledged-order-linked-to-repair')
 edge.substitute(po.id);await submit('purchase.reconcile',{});assert.match(await p.locator('main').innerText(),/Different grade/);await shot('06-unapproved-substitution')
 await submit('purchase.rejectSubstitution',{reason:'Reject the different grade and higher price; retain original cart'});assert.match(await p.locator('main').innerText(),/Supplier outcome: acknowledged/);assert.equal(edge.orders.size,1);assert.equal(edge.actions.size,1);await shot('07-substitution-rejected-original-spend-retained')
 await p.getByText('Request supplier cancellation',{exact:true}).click();await submit('purchase.cancel',{reason:'Explicitly cancel after the repair scope changed'});assert.match(await p.locator('main').innerText(),/Supplier outcome: cancelled/);await shot('08-confirmed-cancellation')
 edge.mode='reject';await submit('purchase.compare',f.compare);await submit('purchase.cart',{quoteId:'synthetic-mallet-202',reference:'synthetic-mallet-232',shipTo:'Receiving bench'})
 await submit('purchase.approve',{reason:'Review a new exact supplier order after cancellation'});await submit('purchase.submit',{});assert.match(await p.locator('main').innerText(),/Supplier outcome: rejected/);await shot('09-visible-rejected-order')
 await go('/connectors');assert.match(await p.locator('main').innerText(),/Supplier ordering gateway/);await shot('10-published-data-flow-declaration')
 await go('/app/connectors');assert.match(await p.locator('main').innerText(),/Supplier ordering gateway/);assert.ok(!(await p.content()).includes(edge.key));await shot('11-owner-key-management-and-declaration')
 },{bindings:{MALLET_SUPPLIER_ORIGIN:edge.origin,MALLET_SUPPLIER_KEY:edge.key},outboundService:edge.fetch})
}
