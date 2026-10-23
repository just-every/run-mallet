import assert from 'node:assert/strict'
import {partsBrowser} from './support/parts-browser.mjs'
import {coreFixture} from './support/cores-journey.mjs'
export async function coresBrowser(){return partsBrowser('cores',coreFixture,async({h,f,p,go,shot,submit})=>{
 await go('/app/inventory/cores');await shot('01-separate-authorized-core-fee')
 const {invoiceId,version,...values}=f.input;await submit('stock.coreOpen',values)
 assert.match(await p.locator('main').innerText(),/Separate core deposit \$50.00 · Tax \$5.00 · Total \$55.00/);assert.match(await p.locator('main').innerText(),/credit expires soon/);await shot('02-deposit-collected-and-expiry-alert')
 await submit('stock.coreReturn',{condition:'Old alternator with cracked tab',evidence:'Physical core at counter'});await shot('03-returned-condition')
 await submit('stock.coreShip',{carrier:'Synthetic carrier',tracking:'synthetic-mallet-95',evidence:'Carrier receipt'});await shot('04-shipped-core')
 await submit('stock.coreCredit',{reference:'synthetic-mallet-96',amountCents:3500,reason:'Supplier deducted cracked tab',evidence:'Adjusted supplier document'})
 await submit('stock.coreCorrect',{paymentId:f.payment.id,reason:'Returned core under saved rules',consentEvidence:'Customer requested original cash refund'})
 assert.match(await p.locator('main').innerText(),/Immutable correction MC-/);assert.match(await p.locator('main').innerText(),/Supplier exposure \$5.00/);await shot('05-adjusted-credit-and-invoice-correction')
 await submit('stock.coreRefund',{status:'refunded',reference:'synthetic-mallet-97',evidence:'Owner retained signed cash refund receipt'})
 assert.match(await p.locator('main').innerText(),/Refund recorded \$55.00/);assert.deepEqual((await h.state()).records.invoice[0],f.invoice);await shot('06-refund-evidence-original-invoice-preserved')
})}
