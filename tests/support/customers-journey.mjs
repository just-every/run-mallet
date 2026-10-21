import assert from 'node:assert/strict'
import {assetInput,booking,estimate,authorise,archive,restore,installation} from '../harness.mjs'
import {qualityReady} from './quality-ready.mjs'
export async function customersFixture(h){
 const contact=async(name,phone,email)=>h.command('contact.save',{name,phone,email,communication:'none',notes:'Customer declared preference; no outbound consent recorded'})
 const driver=await contact('Dana Driver','(614) 555-0101','driver@example.test'),authorizer=await contact('Ari Authorizer','614-555-0102','authorizer@example.test'),payer=await contact('Pat Payer','614-555-0103','payer@example.test')
 const input={name:'Cedar Fleet',kind:'fleet',contactIds:[driver.id,authorizer.id,payer.id],driverId:driver.id,authorizerId:authorizer.id,payerId:payer.id,billingContactId:payer.id,taxStatus:'unknown',notes:'Fleet billing reviewed by owner'}
 return {driver,authorizer,payer,input}
}
export async function customersJourney(h){
 const {driver,authorizer,payer,input}=await customersFixture(h),admin=await h.person('customer-advisor@example.test','admin'),member=await h.person('customer-technician@example.test'),key=await h.command('agent.create',{label:'Customer boundary'}),agent={as:'',headers:{authorization:'Bearer '+key.token}}
 const before=(await h.state()).records
 for(const cmd of ['contact.save','customer.save','customer.linkAsset','customer.driver','customer.merge'])for(const opts of [{as:'',status:401},{as:admin.cookie,status:403},{as:member.cookie,status:403},{...agent,status:403},{headers:{origin:'https://elsewhere.test'},status:403}])await h.command(cmd,input,opts)
 await h.command('contact.save',{name:'Invalid',email:'not-email',phone:'',communication:'email'},{status:400});await h.command('customer.save',{...input,payerId:'synthetic-mallet-unknown'},{status:409})
 assert.deepEqual((await h.state()).records,before)
 let account=await h.command('customer.save',input),duplicate=await h.command('customer.save',{...input,name:'Cedar Fleet duplicate'}),household=await h.command('customer.save',{...input,name:'Dana Household',kind:'household',contactIds:[driver.id],payerId:driver.id,billingContactId:driver.id,authorizerId:null})
 assert.equal(account.contactIds.length,3);assert.equal(account.payerId,payer.id);assert.equal(account.authorizerId,authorizer.id)
 let a=await h.command('asset.create',{...assetInput('fleet-a'),identifier:'OH-CEDAR-17'}),b=await h.command('asset.create',{...assetInput('fleet-b'),identifier:'OH-CEDAR-18'})
 const link=async(asset,target)=>h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:target.id,customerVersion:target.version,reason:'Owner checked customer instructions'})
 a=await link(a,account);b=await link(b,duplicate)
 assert.equal(a.customerAccountId,account.id);assert.equal(a.driverContactId,driver.id);assert.equal(b.customerAccountId,duplicate.id)
 for(const query of ['cedar','6145550101','OH-CEDAR-17','Driver'])assert.ok((await h.api('/api/mallet/accounts?q='+encodeURIComponent(query))).some(c=>c.id===account.id),'CUS-001 search '+query)
 assert.equal((await h.api('/api/mallet/accounts?q=synthetic-mallet-no-match')).length,0)
 const {job}=await booking(h,{asset:a});a=(await h.state()).records.asset.find(v=>v.id===a.id)
 const q=await authorise(h,await estimate(h,job));let current=(await h.state()).records.job.find(j=>j.id===job.id)
 current=await h.command('work.record',{jobId:job.id,version:current.version,lineId:q.revisions[0].lines[0].id,quantity:2})
 await qualityReady(h,current);current=await h.command('job.complete',{jobId:job.id,version:current.version})
 let invoice=await h.command('invoice.prepare',{jobId:job.id,version:current.version},{as:admin.cookie});assert.equal(invoice.billing,undefined,'New billing identities stay out of advisor command responses pending policy')
 invoice=(await h.state()).records.invoice.find(i=>i.jobId===job.id);assert.equal(invoice.billing.payer.id,payer.id);assert.equal(invoice.billing.driver.id,driver.id);assert.equal(invoice.billing.authorizer.id,authorizer.id)
 invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version});const exported=await h.command('invoice.export',{invoiceId:invoice.id,version:invoice.version}),saved=(await h.state()).records.invoice.find(i=>i.id===invoice.id),csv=await (await h.request('/api/mallet/exports/'+exported.id)).text()
 a=await h.command('customer.driver',{assetId:a.id,version:a.version,customerId:account.id,customerVersion:account.version,driverId:authorizer.id,reason:'Fleet confirmed replacement driver'})
 await h.command('customer.driver',{assetId:a.id,version:a.version,customerId:household.id,customerVersion:household.version,driverId:driver.id,reason:'Wrong account'},{status:409})
 const oldContact=structuredClone(payer),changed=await h.command('contact.save',{contactId:payer.id,version:payer.version,name:'Pat Payer updated',phone:'6145550199',email:'updated-payer@example.test',communication:'email',notes:'Declared email preference; no automatic message sent'})
 assert.equal(changed.history[0].name,oldContact.name)
 const source=structuredClone(duplicate),target=structuredClone(account)
 await h.command('customer.merge',{sourceId:duplicate.id,sourceVersion:duplicate.version,targetId:account.id,targetVersion:99,reason:'Stale',consentEvidence:'Customer instruction'},{status:409})
 await h.command('customer.merge',{sourceId:household.id,sourceVersion:household.version,targetId:account.id,targetVersion:account.version,reason:'Different kind',consentEvidence:'Not duplicates'},{status:409})
 const merge=await h.command('customer.merge',{sourceId:duplicate.id,sourceVersion:duplicate.version,targetId:account.id,targetVersion:account.version,reason:'Duplicate record confirmed by customer',consentEvidence:'Owner reviewed signed customer instruction synthetic-mallet-20'})
 assert.deepEqual(merge.sourceSnapshot,source);assert.deepEqual(merge.targetSnapshot,target)
 const state=await h.state();account=state.records.customerAccount.find(c=>c.id===account.id);duplicate=state.records.customerAccount.find(c=>c.id===duplicate.id)
 assert.equal(duplicate.mergedInto,account.id);assert.equal(state.records.asset.find(v=>v.id===b.id).customerAccountId,account.id);assert.equal(account.payerId,payer.id);assert.equal(account.driverId,driver.id);assert.equal(state.records.asset.find(v=>v.id===a.id).driverContactId,authorizer.id)
 assert.equal((await h.api('/api/mallet/accounts?q=duplicate'))[0].id,account.id)
 await h.command('customer.save',{...input,customerId:duplicate.id,version:duplicate.version},{status:409})
 assert.deepEqual(state.records.invoice.find(i=>i.id===saved.id),saved,'CUS-001 changing contacts, driver and merging leaves old invoice snapshots exact')
 assert.equal(await (await h.request('/api/mallet/exports/'+exported.id)).text(),csv)
 const bills=await h.api('/api/mallet/accounts/'+account.id+'/billing');assert.deepEqual(bills,[saved]);assert.equal(bills[0].billing.payer.email,oldContact.email)
 for(const opts of [{as:admin.cookie},{as:member.cookie},agent]){
  await h.api('/api/mallet/accounts',undefined,{...opts,status:403});await h.api('/api/mallet/accounts/'+account.id+'/billing',undefined,{...opts,status:403});assert.equal((await h.request('/app/accounts',opts)).status,403)
  const scoped=await h.state(opts);for(const kind of ['contact','customerAccount','customerMerge','customerBilling'])assert.equal(scoped.records[kind],undefined);assert.ok(!scoped.records.invoice?.some(i=>i.billing));assert.ok(!scoped.records.event?.some(e=>e.kind.startsWith('customer.')||e.kind.startsWith('contact.')))
 }
 const final=(await h.state()).records,fresh=await installation({bindings:{OWNER_EMAIL:'customer-recovery@example.test'}})
 try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records,final);assert.deepEqual(await fresh.api('/api/mallet/accounts/'+account.id+'/billing'),bills);assert.notEqual((await fresh.state()).actor.id,state.actor.id);await fresh.state({as:h.owner,status:401});await fresh.state({...agent,status:401});await fresh.command('customer.save',{...input,customerId:account.id,version:account.version,name:'Fresh owner reviewed fleet'})}finally{await fresh.close()}
}
