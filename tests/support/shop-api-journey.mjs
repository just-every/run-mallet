import assert from 'node:assert/strict'
import {archive,booking,installation,restore} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {bookingService,bookingPost,holdFields} from './booking-journey.mjs'

const readScopes=['customers:read','assets:read','bookings:read','repairs:read','parts:read','orders:read']
const prepScopes=['estimate:prepare','estimate:revise','dispatch:prepare','invoice:prepare']
const access=client=>({as:'',headers:{authorization:'Bearer '+client.token}})
const mint=(h,scopes)=>h.command('apiClient.create',{label:'synthetic-mallet-shop-api',scopes})
const read=(h,client,path,status=200)=>h.api('/api/mallet/v1/'+path,undefined,{...access(client),status})
const noMoney=value=>{
 const walk=v=>{if(!v||typeof v!=='object')return;for(const [key,entry] of Object.entries(v)){assert.ok(!/cents|totals|billing|prices|unitcost|revisions|actuals|approval|authorisation|notes|credential|token/i.test(key),'Private field leaked: '+key);walk(entry)}}
 walk(value)
}
async function pages(h,client,path){
 const found=[];let next=path+'?limit=1'
 do{const result=await read(h,client,next);assert.ok(result.data.length<=1);found.push(...result.data);next=result.nextCursor?path+'?limit=1&cursor='+encodeURIComponent(result.nextCursor):null}while(next)
 assert.equal(new Set(found.map(r=>r.externalId)).size,found.length,'Cursor pages contain no duplicate identities')
 return found
}
export async function shopApiReadJourney(h){
 await shopSetup(h)
 const contact=await h.command('contact.save',{name:'synthetic-mallet-1',email:'synthetic-mallet-1@example.test',phone:'5550100',communication:'email'})
 const customer=await h.command('customer.save',{name:'synthetic-mallet-2',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'standard'})
 const assets=[]
 for(let n=1;n<=3;n++)assets.push(await h.command('asset.create',{customerName:'synthetic-mallet-1',customerEmail:'synthetic-mallet-1@example.test',label:'synthetic-mallet-'+n,identifier:'synthetic-mallet-'+n}))
 const {job}=await booking(h,{asset:assets[0]})
 await h.command('flow.close',{jobId:job.id,version:job.version,reason:'Retained canceled repair',outcome:'canceled'})
 const item=await h.command('stock.item',{sku:'synthetic-mallet-4',barcode:'synthetic-mallet-5',name:'synthetic-mallet-6',unit:'each'})
 const order=await h.command('purchase.create',{reference:'synthetic-mallet-7',supplier:'synthetic-mallet-8',shipTo:'synthetic-mallet-9',expectedAt:'2026-12-01T12:00:00Z',taxCents:100,freightCents:200,lines:[{itemId:item.id,quantity:2,unitCents:3500}]})
 const service=await bookingService(h)
 assert.equal((await bookingPost(h,'/book',holdFields(service))).status,303)
 const appointment=(await h.state()).records.appointment[0]
 const client=await mint(h,readScopes)
 const expected={customers:[customer.id],assets:assets.map(a=>a.id),bookings:[appointment.id],repairs:[job.id],parts:[item.id],orders:[order.id]}
 const before={}
 for(const [resource,ids] of Object.entries(expected)){
  const values=await pages(h,client,resource);assert.deepEqual(values.map(r=>r.externalId).sort(),ids.sort());noMoney(values);before[resource]=values
  assert.equal((await read(h,client,resource+'/'+ids[0])).externalId,ids[0])
 }
 assert.equal(before.repairs[0].status,'canceled')
 assert.deepEqual(before.orders[0].lines.map(l=>[l.itemId,l.quantityMilli]),[[item.id,2000]])
 const history=await pages(h,client,'repairs/'+job.id+'/history')
 const events=(await h.state()).records.event.filter(e=>e.jobId===job.id)
 assert.deepEqual(history.map(r=>r.id).sort(),events.map(e=>e.id).sort());assert.ok(history.some(e=>e.kind==='job.book'));assert.ok(history.some(e=>e.kind==='flow.close'));noMoney(history)
 for(const suffix of ['?limit=0','?limit=101','?limit=1.5','?cursor=broken','?limit=1&limit=2'])await read(h,client,'assets'+suffix,400)
 await read(h,client,'repairs/synthetic-mallet-missing/history',404)
 const other=(await booking(h,{asset:assets[1],bayId:'synthetic-mallet-other-bay',startAt:'2026-12-02T12:00:00Z',endAt:'2026-12-02T13:00:00Z'})).job
 const repairPage=await read(h,client,'repairs/'+job.id+'/history?limit=1')
 assert.ok(repairPage.nextCursor)
 await read(h,client,'repairs/'+other.id+'/history?cursor='+repairPage.nextCursor,400)
 before.repairs=await pages(h,client,'repairs')
 const first=await read(h,client,'assets?limit=1')
 await read(h,client,'parts?cursor='+first.nextCursor,400)
 await h.command('asset.update',{...assets[1],version:(await read(h,client,'assets/'+assets[1].id)).version,assetId:assets[1].id,label:'synthetic-mallet-updated'})
 await read(h,client,'assets?cursor='+first.nextCursor,409)
 before.assets=await pages(h,client,'assets')
 const backup=await archive(h)
 assert.ok(!backup[0].tables.some(t=>['mallet_api_clients','mallet_api_requests'].includes(t.name)))
 assert.ok(!JSON.stringify(backup).includes(client.token))
 const fresh=await installation()
 try{
  await restore(fresh,backup)
  await read(fresh,client,'assets',401)
  const replacement=await mint(fresh,readScopes)
  for(const resource of Object.keys(before))assert.deepEqual(await pages(fresh,replacement,resource),before[resource],'Product external identities survive fresh-owner recovery')
  assert.deepEqual(await pages(fresh,replacement,'repairs/'+job.id+'/history'),history)
 }finally{await fresh.close()}
}

const prepare=(h,client,command,input,key,status=200,path='/api/mallet/v1/preparations')=>h.api(path,{command,input},{...access(client),headers:{...access(client).headers,'idempotency-key':key},status})
export async function shopApiRetryJourney(h){
 const {job}=await booking(h),client=await mint(h,prepScopes)
 await h.command('tax.configure',{ratePercent:10,partsTaxable:true,laborTaxable:true})
 const input={jobId:job.id,version:job.version,lines:[{kind:'labor',description:'synthetic-mallet-10',quantity:1,unitCents:12000}]}
 const [a,b]=await Promise.all([prepare(h,client,'estimate.prepare',input,'synthetic-mallet-11'),prepare(h,client,'estimate.prepare',input,'synthetic-mallet-11')])
 assert.deepEqual(a,b);noMoney(a)
 const state=await h.state()
 await h.restart()
 assert.equal(state.records.estimate.length,1);assert.equal(state.records.audit.filter(a=>a.action==='estimate.prepare').length,1)
 assert.deepEqual(await prepare(h,client,'estimate.prepare',{lines:input.lines,version:input.version,jobId:input.jobId},'synthetic-mallet-11',200,'/api/mallet/commands'),a)
 assert.deepEqual(await h.state(),state,'A retry changes no product history')
 const conflict=await prepare(h,client,'estimate.prepare',{...input,lines:[{...input.lines[0],unitCents:13000}]},'synthetic-mallet-11',409)
 assert.equal(conflict.error,'IDEMPOTENCY_CONFLICT');assert.ok(!('details' in conflict))
 const invalid={...input,version:0}
 await prepare(h,client,'estimate.prepare',invalid,'synthetic-mallet-not-consumed',400)
 await prepare(h,client,'dispatch.prepare',input,'synthetic-mallet-11',409)
 let q=(await h.state()).records.estimate[0]
 const revision={estimateId:q.id,version:q.version,revision:1,lines:[{...input.lines[0],unitCents:14000}]}
 assert.equal(a.revision,1)
 const revised=await prepare(h,client,'estimate.revise',revision,'synthetic-mallet-not-consumed');assert.deepEqual(await prepare(h,client,'estimate.revise',revision,'synthetic-mallet-not-consumed'),revised)
 q=(await h.state()).records.estimate[0];assert.equal(q.revisions.length,2);assert.equal(revised.revision,2)
 let current=(await h.state()).records.job.find(j=>j.id===job.id)
 const dispatch={jobId:current.id,version:current.version,bayId:current.bayId,technicianId:current.technicianId,startAt:current.startAt,endAt:current.endAt,reason:'synthetic-mallet-13'}
 const proposed=await prepare(h,client,'dispatch.prepare',dispatch,'synthetic-mallet-13');assert.deepEqual(await prepare(h,client,'dispatch.prepare',dispatch,'synthetic-mallet-13'),proposed)
 assert.equal((await h.state()).records.proposal.length,1)
 for(const command of ['estimate.approve','estimate.authorise','dispatch.approve','invoice.approve','invoice.export','asset.create','payment.record','apiClient.create'])await prepare(h,client,command,{},'synthetic-mallet-denied',403)
 // A separate person performs the existing decisions; API preparation has gained no new verb.
 q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:2})
 q=await h.command('estimate.markSent',{estimateId:q.id,version:q.version,revision:2,method:'printed'})
 q=await h.command('estimate.authorise',{estimateId:q.id,version:q.version,revision:2,lineIds:q.revisions[1].lines.map(l=>l.id),customerName:'synthetic-mallet-1',method:'signed',evidence:'synthetic-mallet-14'})
 current=(await h.state()).records.job.find(j=>j.id===job.id)
 current=await h.command('work.record',{jobId:current.id,version:current.version,lineId:q.revisions[1].lines[0].id,quantity:1})
 await qualityReady(h,current)
 current=await h.command('job.complete',{jobId:current.id,version:current.version})
 const invoiceInput={jobId:current.id,version:current.version},invoice=await prepare(h,client,'invoice.prepare',invoiceInput,'synthetic-mallet-15')
 assert.deepEqual(await prepare(h,client,'invoice.prepare',invoiceInput,'synthetic-mallet-15'),invoice);noMoney(invoice)
 assert.equal((await h.state()).records.invoice.length,1)
 const backup=await archive(h),fresh=await installation()
 try{
  await restore(fresh,backup)
  assert.deepEqual((await fresh.state()).records,(await h.state()).records)
  const db=await fresh.mf.getD1Database('DB')
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM mallet_api_requests').first()).n,0)
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM mallet_api_clients').first()).n,0)
  await prepare(fresh,client,'invoice.prepare',invoiceInput,'synthetic-mallet-15',401)
 }finally{await fresh.close()}
}

export async function shopApiAuthorityJourney(h){
 const {asset,job}=await booking(h),client=await mint(h,['assets:read']),prep=await mint(h,['dispatch:prepare'])
 assert.equal((await read(h,client,'assets/'+asset.id)).id,asset.id)
 for(const resource of ['customers','bookings','repairs','parts','orders'])await read(h,client,resource,403)
 await prepare(h,client,'dispatch.prepare',{jobId:job.id,version:job.version},'synthetic-mallet-16',403)
 await read(h,prep,'assets',403)
 const denied=['/api/mallet/state','/api/mallet/state?download=1','/api/mallet/assets/'+asset.id+'/history.csv','/api/mallet/media/synthetic-mallet-1','/api/mallet/accounts/synthetic-mallet-1/billing','/api/mallet/repairs/'+job.id,'/api/mallet/accounts','/api/mallet/board','/api/mallet/inventory','/api/mallet/purchasing','/api/mallet/reports/sales?format=csv','/api/mallet/reports/profitability','/api/mallet/exports/synthetic-mallet-1','/api/portability/exports','/app','/app/data','/app/assets/'+asset.id,'/api/mallet/security/state','/api/mallet/connectors','/api/mallet/jobs']
 const original=(await h.state()).records
 for(const path of denied){const response=await h.request(path,access(client));assert.equal(response.status,403,path)}
 await h.command('estimate.approve',{}, {...access(prep),status:403})
 await h.command('dispatch.prepare',{jobId:job.id,version:job.version},{...access(client),status:403})
 assert.deepEqual((await h.state()).records,original,'Refused alternate transports write no product data')
 for(const scope of ['finance:read','decisions:write','*'])await h.command('apiClient.create',{label:'synthetic-mallet-17',scopes:[scope]},{status:400})
 await h.command('apiClient.create',{label:'synthetic-mallet-17',scopes:[]},{status:400})
 const member=await h.person('synthetic-mallet-api-member@example.test'),admin=await h.person('synthetic-mallet-api-admin@example.test','admin')
 for(const as of ['',member.cookie,admin.cookie])await h.command('apiClient.create',{label:'synthetic-mallet-17',scopes:['assets:read']},{as,status:as?403:401})
 const db=await h.mf.getD1Database('DB')
 const input={jobId:job.id,version:job.version,bayId:job.bayId,technicianId:job.technicianId,startAt:job.startAt,endAt:job.endAt,reason:'synthetic-mallet-18'}
 await prepare(h,prep,'dispatch.prepare',input,'',400)
 const first=await prepare(h,prep,'dispatch.prepare',input,'synthetic-mallet-18');assert.ok(first.id)
 await h.command('apiClient.revoke',{id:prep.id})
 await prepare(h,prep,'dispatch.prepare',input,'synthetic-mallet-18',401)
 await h.command('apiClient.revoke',{id:client.id})
 await read(h,client,'assets',401)
 const expired=await mint(h,['assets:read'])
 await db.prepare('UPDATE mallet_api_clients SET expires_at=0 WHERE id=?').bind(expired.id).run()
 await read(h,expired,'assets',401)
 const expiredPrep=await mint(h,['dispatch:prepare'])
 await db.prepare('UPDATE mallet_api_clients SET expires_at=0 WHERE id=?').bind(expiredPrep.id).run()
 await prepare(h,expiredPrep,'dispatch.prepare',input,'synthetic-mallet-expired',401)
 const creator=await mint(h,['assets:read']),owner=(await h.state()).actor.id
 await db.prepare('UPDATE oa_operators SET version=version+1 WHERE id=?').bind(owner).run()
 await read(h,creator,'assets',401)
}
