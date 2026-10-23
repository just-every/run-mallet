import assert from 'node:assert/strict'
import {partsBrowser} from './support/parts-browser.mjs'
import {transferFixture} from './support/transfers-journey.mjs'
export async function transfersBrowser(){return partsBrowser('transfers',transferFixture,async({h,f,p,go,shot,submit})=>{
 await go('/app/inventory/transfers');await submit('stock.transferRequest',{reference:f.input.reference,lot0:f.lots[0].id,quantity0:1,lot1:f.lots[1].id,quantity1:1,destinationBinId:f.destination.id,reason:f.input.reason});await shot('01-requested-exact-serials-and-cost')
 await submit('stock.transferApprove',{reason:'Approve source and destination serialized custody'});await shot('02-approved-transfer')
 await submit('stock.transferDispatch',{evidence:'Driver signed for two sealed serialized units'});assert.match(await p.locator('main').innerText(),/In transit 1/);await shot('03-sending-stock-removed-in-transit')
 await submit('stock.transferReceive',{received0:1,damaged0:0,received1:0,damaged1:0,evidence:'Destination received first serial, second missing'});assert.match(await p.locator('main').innerText(),/shortage/);await shot('04-one-unit-short')
 await submit('stock.transferCorrect',{outcome:'received',reason:'Carrier found the missing original serial',evidence:'Destination checked and scanned recovered serial'})
 const t=(await h.api('/api/mallet/transfers'))[0];assert.equal(t.status,'resolved');assert.deepEqual(t.lines.map(l=>l.inTransitMilli),[0,0]);const balances=(await h.api('/api/mallet/inventory')).balances;assert.equal(balances.find(b=>b.binId===f.destination.id).onHandMilli,2000);assert.equal(balances.find(b=>b.binId===f.bin.id).onHandMilli,0);await shot('05-approved-correction')
 await go('/app/inventory');assert.match(await p.locator('main').innerText(),/On hand 2/);await shot('06-sending-and-receiving-balances')
})}
