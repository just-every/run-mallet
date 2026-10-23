import assert from 'node:assert/strict'
import {partsBrowser} from './support/parts-browser.mjs'
import {rmaFixture} from './support/supplier-returns-journey.mjs'
export async function rmaBrowser(){return partsBrowser('supplier-returns',rmaFixture,async({h,f,p,go,shot,submit})=>{
 await go('/app/inventory/returns');await shot('01-original-po-lot-and-repair')
 await submit('stock.rmaOpen',f.input);assert.match(await p.locator('main').innerText(),/Quarantined 1/);assert.match(await p.locator('main').innerText(),/Rework cost \$35.00/);await shot('02-removed-installed-part-in-quarantine')
 await go('/app/inventory/count');await submit('stock.count',{...f.scans,mode:'cycle',quantity:2,reason:'Do not count the physically removed serial as saleable stock'})
 await submit('stock.approveCount',{lotId:f.lot.id,reason:'The failed serial is held in quarantine'})
 assert.match(await p.locator('main').innerText(),/already available, in transit or quarantined/);await shot('02b-quarantined-serial-count-refused');await go('/app/inventory/returns')
 await submit('stock.rmaAuthorize',{number:'synthetic-mallet-110',label:'Supplier label synthetic-mallet-111',evidence:'External supplier authorization'})
 await shot('03-authorized-label');await submit('stock.rmaShip',{carrier:'Synthetic carrier',tracking:'synthetic-mallet-109',evidence:'Carrier scanned the sealed return'})
 await shot('04-shipped-custody');await submit('stock.rmaCredit',{reference:'synthetic-mallet-113',amountCents:1000,reason:'Supplier credited only part of claim',evidence:'Partial supplier credit document'})
 assert.match(await p.locator('main').innerText(),/Net warranty cost after these credits \$25.00/);assert.match(await p.locator('main').innerText(),/Exposure \$5.00/);assert.match(await p.locator('main').innerText(),/Quarantined 0/)
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].onHandMilli,1000);await shot('05-partial-credit-and-warranty-cost')
})}
