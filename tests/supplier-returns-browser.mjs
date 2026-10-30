import assert from 'node:assert/strict'
import {partsBrowser} from './support/parts-browser.mjs'
import {archive,restore,installation} from './harness.mjs'
import {rmaFixture,rmaClock,rmaActor,rmaAuthorization,rmaShipment,rmaReadback,refuseRmaChange} from './support/supplier-returns-journey.mjs'
export async function rmaBrowser(){return partsBrowser('supplier-returns',rmaFixture,async({h,f,p,go,shot,submit})=>{
 await p.setViewportSize({width:1440,height:1000})
 const proof=async name=>{await shot(name);await p.setViewportSize({width:1440,height:1000})}
 const by=rmaActor((await h.state()).actor),expected={by}
 const card=()=>p.locator('section.card').filter({has:p.getByRole('heading',{name:f.input.reference,exact:true})})
 const rendered=async()=>{
  const content=await card().innerText()
  for(const value of [f.input.reason,f.input.evidence,'synthetic-mallet-102','synthetic-mallet-116','Quantity 1'])assert.ok(content.includes(value),'Saved original return evidence: '+value)
  assert.equal(await card().getByRole('link',{name:'Open purchase',exact:true}).getAttribute('href'),'/app/purchasing#po-'+f.po.id)
  assert.equal(await card().getByRole('link',{name:'Original repair',exact:true}).getAttribute('href'),'/app/jobs/'+f.job.id)
  for(const [label,saved]of [['Authorized RMA',expected.authorization],['Shipped',expected.shipment]])if(saved){
   const evidence=card().locator('p').filter({hasText:label}),text=await evidence.innerText()
   for(const value of label==='Authorized RMA'?[saved.number,saved.label,saved.evidence]:[saved.carrier,saved.tracking,saved.evidence,'Quantity 1'])assert.ok(text.includes(value),'Rendered saved custody: '+value)
   assert.ok(text.includes('Recorded by '+saved.by.name),'Saved custody identifies its recorder')
   assert.equal(await evidence.locator('time').getAttribute('datetime'),rmaClock)
  }
 }
 await go('/app/inventory/returns');await proof('01-original-po-lot-and-repair')
 await submit('stock.rmaOpen',f.input);assert.match(await p.locator('main').innerText(),/Quarantined 1/);assert.match(await p.locator('main').innerText(),/Rework cost \$35.00/);await proof('02-removed-installed-part-in-quarantine')
 const rma=(await h.state()).records.stockRma.find(r=>r.reference===f.input.reference)
 await rmaReadback(h,f,rma.id,expected);await go('/app/inventory/returns');await rendered()
 await go('/app/inventory/count');await submit('stock.count',{...f.scans,mode:'cycle',quantity:2,reason:'Do not count the physically removed serial as saleable stock'})
 await submit('stock.approveCount',{lotId:f.lot.id,reason:'The failed serial is held in quarantine'})
 assert.match(await p.locator('main').innerText(),/already available, in transit or quarantined/);await proof('02b-quarantined-serial-count-refused');await go('/app/inventory/returns')
 await submit('stock.rmaAuthorize',rmaAuthorization)
 expected.authorization={...rmaAuthorization,by,at:rmaClock}
 let saved=await rmaReadback(h,f,rma.id,expected);await go('/app/inventory/returns');await rendered()
 await refuseRmaChange(h,'stock.rmaAuthorize',{rmaId:rma.id,version:saved.record.version,number:'synthetic-mallet-120',label:'Replacement label',evidence:'Cannot replace the original evidence'})
 await go('/app/inventory/returns');await rendered();await proof('03-authorized-label')
 await submit('stock.rmaShip',rmaShipment)
 expected.shipment={...rmaShipment,quantityMilli:1000,by,at:rmaClock}
 saved=await rmaReadback(h,f,rma.id,expected);await go('/app/inventory/returns');await rendered()
 await refuseRmaChange(h,'stock.rmaShip',{rmaId:rma.id,version:saved.record.version,carrier:'Replacement carrier',tracking:'synthetic-mallet-112',evidence:'Cannot ship twice'})
 await go('/app/inventory/returns');await rendered();await proof('04-shipped-custody')
 await submit('stock.rmaCredit',{reference:'synthetic-mallet-113',amountCents:1000,reason:'Supplier credited only part of claim',evidence:'Partial supplier credit document'})
 await rmaReadback(h,f,rma.id,expected);await go('/app/inventory/returns');await rendered()
 assert.match(await p.locator('main').innerText(),/Net warranty cost after these credits \$25.00/);assert.match(await p.locator('main').innerText(),/Exposure \$5.00/);assert.match(await p.locator('main').innerText(),/Quarantined 0/)
 assert.equal((await h.api('/api/mallet/inventory')).balances[0].onHandMilli,1000);await proof('05-partial-credit-and-warranty-cost')
 const before=(await h.state()).records,fresh=await installation({clock:rmaClock,bindings:{OWNER_EMAIL:['synthetic-mallet-122','example.test'].join('@')}})
 try{
  assert.notEqual((await fresh.state()).actor.id,by.id);await restore(fresh,await archive(h))
  assert.deepEqual((await fresh.state()).records,before);const recovered=await rmaReadback(fresh,f,rma.id,expected)
  assert.deepEqual(recovered,await rmaReadback(h,f,rma.id,expected))
  await refuseRmaChange(fresh,'stock.rmaShip',{rmaId:rma.id,version:recovered.record.version,...rmaShipment})
 }finally{await fresh.close()}
},{clock:rmaClock})}
