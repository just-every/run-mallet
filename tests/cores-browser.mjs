import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {archive,restore,installation} from './harness.mjs'
import {partsBrowser} from './support/parts-browser.mjs'
import {coreFixture,coreClock,coreShipmentExpectation,readCoreShipment} from './support/cores-journey.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
export async function coresBrowser(){return partsBrowser('cores',coreFixture,async({h,f,p,go,shot,submit})=>{
 await p.setViewportSize({width:1440,height:1000})
 await go('/app/inventory/cores');await shot('01-separate-authorized-core-fee')
 const {invoiceId,version,...values}=f.input;await submit('stock.coreOpen',values)
 assert.match(await p.locator('main').innerText(),/Separate core deposit \$50.00 · Tax \$5.00 · Total \$55.00/);assert.match(await p.locator('main').innerText(),/credit expires soon/);await shot('02-deposit-collected-and-expiry-alert')
 await submit('stock.coreReturn',{condition:'Old alternator with cracked tab',evidence:'Physical core at counter'});await shot('03-returned-condition')
 await p.setViewportSize({width:1440,height:1000})
 const opened=(await h.state()).records.stockCore[0],actor=(await h.state()).actor,shipmentInput={carrier:'Synthetic carrier',tracking:'synthetic-mallet-95',evidence:'Carrier receipt'}
 const expectedShipment=coreShipmentExpectation(f,opened.id,shipmentInput,actor)
 const renderedShipment=async()=>{
  const receipt=p.getByRole('region',{name:'Recorded core shipment'}),text=await receipt.innerText()
  for(const value of [expectedShipment.id,expectedShipment.jobId,expectedShipment.invoiceId,expectedShipment.lineId,expectedShipment.stockUseId,expectedShipment.lotId,...Object.values(shipmentInput),actor.id,actor.name])assert.ok(text.includes(value),'Rendered shipment retains '+value)
  assert.equal(await receipt.locator('time').getAttribute('datetime'),coreClock)
  assert.match(text,/Staff-recorded/);assert.match(text,/not independently verified/)
 }
 await submit('stock.coreShip',shipmentInput)
 const core=await readCoreShipment(h,expectedShipment)
 await go('/app/inventory/cores');await renderedShipment()
 const before=(await h.state()).records,report=await h.api('/api/mallet/cores')
 const denied=await p.request.post(h.origin+'/app/actions',{headers:{origin:h.origin},form:{command:'stock.coreShip',coreId:core.id,version:String(core.version),carrier:'Another carrier',tracking:'synthetic-mallet-98',evidence:'Cannot replace retained shipment'}})
 assert.equal(denied.status(),409)
 assert.deepEqual((await h.state()).records,before);assert.deepEqual(await h.api('/api/mallet/cores'),report)
 await go('/app/inventory/cores');await renderedShipment();await shot('04-reloaded-immutable-shipment')
 await p.setViewportSize({width:1440,height:1000})
 await submit('stock.coreCredit',{reference:'synthetic-mallet-96',amountCents:3500,reason:'Supplier deducted cracked tab',evidence:'Adjusted supplier document'})
 await submit('stock.coreCorrect',{paymentId:f.payment.id,reason:'Returned core under saved rules',consentEvidence:'Customer requested original cash refund'})
 assert.match(await p.locator('main').innerText(),/Immutable correction MC-/);assert.match(await p.locator('main').innerText(),/Supplier exposure \$5.00/);await shot('05-adjusted-credit-and-invoice-correction')
 await submit('stock.coreRefund',{status:'refunded',reference:'synthetic-mallet-97',evidence:'Owner retained signed cash refund receipt'})
 assert.match(await p.locator('main').innerText(),/Refund recorded \$55.00/);assert.deepEqual((await h.state()).records.invoice[0],f.invoice);await shot('06-refund-evidence-original-invoice-preserved')
 const fresh=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,clock:coreClock,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
 try{
  await restore(fresh,await archive(h));await shopSetup(fresh)
  assert.notEqual((await fresh.state()).actor.id,actor.id)
  await readCoreShipment(fresh,expectedShipment)
  await fresh.state({as:h.owner,status:401})
  await p.context().addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})))
  await p.setViewportSize({width:1440,height:1000});await p.goto(fresh.origin+'/app/inventory/cores');await renderedShipment();await shot('07-fresh-owner-shipment-history')
 }finally{await fresh.close()}
},{clock:coreClock})}
