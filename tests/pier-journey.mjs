import {test} from 'node:test'
import assert from 'node:assert/strict'
import {installation} from './harness.mjs'
import {realPier} from './support/real-pier.mjs'

const stock=s=>({positions:s.positions,movements:s.movements,reservations:s.reservations,purchaseOrders:s.purchaseOrders,receipts:s.receipts})
test('PIER-001: real Pier catalog, observation, revocation and credential rotation never move source stock',async()=>{
 const pier=await realPier();let mallet
 try {
  const item=await pier.command('item.save',{sku:'B05S-BRAKE-PAD',name:'Shimano B05S brake pads',unit:'pair',packSize:'1'})
  const archived=await pier.command('item.save',{sku:'OLD-PAD',name:'Superseded brake pads',unit:'pair',packSize:'1'})
  await pier.command('item.save',{...archived,archived:true,version:archived.version})
  const bin=await pier.command('location.save',{name:'Service parts A1',warehouse:'Buckeye',kind:'bin'})
  const supplier=await pier.command('party.save',{name:'Local bicycle parts supply',kind:'supplier'})
  const po=await pier.command('po.draft',{supplierId:supplier.id,promiseDate:'2026-11-01',lines:[{itemId:item.id,quantity:'12',price:'18.50'}],reason:'Stock for brake repairs'})
  await pier.command('po.approve',{poId:po.id,version:po.version})
  await pier.command('po.commit',{poId:po.id,version:po.version})
  await pier.command('receipt.create',{poId:po.id,supplierReference:'BRAKE-PADS-DELIVERY',lines:[{poLineId:po.lines[0].id,locationId:bin.id,quantity:'12',cost:'18.50'}]})
  const source=await pier.state(),before=stock(source)
  assert.ok(source.positions.some(p=>p.itemId===item.id&&Number(p.quantity)===12),'Real received stock exists before browsing')
  let credential=await pier.session()
  let requests=[]
  mallet=await installation({bindings:{PIER_ORIGIN:pier.origin,PIER_SESSION:credential},outboundService:async request=>{
   assert.equal(new URL(request.url).origin,pier.origin)
   requests.push({method:request.method,path:new URL(request.url).pathname})
   return pier.fetch(request)
  }})
  const started=Date.now(),catalog=await mallet.api('/api/mallet/catalogue')
  assert.deepEqual(catalog.items,source.items.filter(i=>!i.archived).map(({id,sku,name,unit})=>({id,sku,name,unit})))
  assert.equal(catalog.source,'Pier');assert.ok(Date.parse(catalog.observedAt)>=started&&Date.parse(catalog.observedAt)<=Date.now())
  assert.deepEqual(requests,[{method:'GET',path:'/api/pier/state'}])
  assert.deepEqual(stock(await pier.state()),before)
  assert.ok(!JSON.stringify(catalog).includes(credential),'Private connection cookie is not returned')
  await mallet.api('/api/mallet/catalogue',undefined,{as:'',status:401})
  const member=await mallet.person('technician@example.test')
  await mallet.api('/api/mallet/catalogue',undefined,{as:member.cookie,status:403})
  assert.equal(requests.length,1,'Unauthorized browsing never calls Pier')
  const signedOut=await pier.request('/auth/signout',{method:'POST',body:{},as:credential});assert.equal(signedOut.status,204)
  const denied=await mallet.api('/api/mallet/catalogue',undefined,{status:503})
  assert.equal(denied.error,'PIER_UNAVAILABLE');assert.match(denied.message,/current authorized session/)
  assert.deepEqual(stock(await pier.state()),before,'Revocation error leaves stock unchanged')
  credential=await pier.session()
  await mallet.configure({PIER_SESSION:credential})
  const recovered=await mallet.api('/api/mallet/catalogue')
  assert.deepEqual(recovered.items,catalog.items);assert.equal(recovered.source,'Pier')
  assert.deepEqual(stock(await pier.state()),before,'Credential rotation and repeat browsing leave stock unchanged')
  assert.ok(requests.every(r=>r.method==='GET'&&r.path==='/api/pier/state'))
  await mallet.configure({PIER_SESSION:''})
  const missing=await mallet.api('/api/mallet/catalogue',undefined,{status:503});assert.equal(missing.error,'PIER_UNAVAILABLE');assert.match(missing.message,/Connect Pier/)
  assert.deepEqual(stock(await pier.state()),before)
 }finally{await mallet?.close();await pier.close()}
})
