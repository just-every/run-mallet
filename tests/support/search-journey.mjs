import assert from 'node:assert/strict'
import {installation,archive,restore,assetInput} from '../harness.mjs'

export async function searchJourney(){
 const h=await installation()
 try{
  const member=await h.person('search-member@example.test'),admin=await h.person('search-advisor@example.test','admin')
  await h.api('/api/mallet/accounts?q=test',undefined,{as:member.cookie,status:403})
  let contact=await h.command('contact.save',{name:'Kettle "West" Café',email:'counter-search@example.test',phone:'+1 (602) 555-0199',communication:'none',notes:''})
  const accounts=[]
  for(let i=0;i<51;i++)accounts.push(await h.command('customer.save',{name:'Search cohort '+String(i).padStart(3,'0'),kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''}))
  const search=(q,extra='')=>h.api('/api/mallet/accounts?'+new URLSearchParams({q,...extra}))
  const timed=await h.request('/api/mallet/accounts?q=Search');assert.match(timed.headers.get('server-timing'),/^mallet;dur=\d+(?:\.\d+)?$/);
  const first=await search('Search cohort');assert.equal(first.accounts.length,50);assert.equal(first.total,51);assert.ok(first.nextCursor)
  const last=await search('Search cohort',{cursor:first.nextCursor});assert.equal(last.accounts.length,1);assert.equal(last.nextCursor,null)
  assert.deepEqual([...first.accounts,...last.accounts].map(a=>a.id),accounts.map(a=>a.id))
  for(const q of ['kettle','"west"','café','602555','counter-search'])assert.equal((await search(q)).total,51,'Exact contact match: '+q)
  assert.equal((await h.api('/api/mallet/accounts?q=cohort',undefined,{as:admin.cookie})).accounts.length,50)
  const asset=await h.command('asset.create',{...assetInput('SEARCH-VIN-987654'),label:'Search vehicle unique'})
  await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:accounts[0].id,customerVersion:accounts[0].version,reason:'Customer confirmed this vehicle relationship'})
  assert.equal((await search('VIN-987654')).accounts[0].id,accounts[0].id)
  const preview=await h.command('customer.mergePreview',{sourceId:accounts[0].id,targetId:accounts[1].id,sourceVersion:1,targetVersion:1,reason:'Confirmed duplicate',identityEvidence:'Matching contact reviewed',consentEvidence:'Owner reviewed explicit merge request'})
  await h.command('customer.merge',{sourceId:accounts[0].id,targetId:accounts[1].id,sourceVersion:1,targetVersion:1,previewHash:preview.previewHash,reason:'Confirmed duplicate',identityEvidence:'Matching contact reviewed',consentEvidence:'Owner reviewed explicit merge request'})
  assert.equal((await search('cohort 000')).accounts[0].id,accounts[1].id)
  assert.equal((await search('VIN-987654')).accounts[0].id,accounts[1].id)
  contact=await h.command('contact.save',{contactId:contact.id,version:contact.version,name:'Changed contact',email:'new-search@example.test',phone:'202-555-0111',communication:'none',notes:''})
  assert.equal((await search('602555')).total,0)
  await h.api('/api/mallet/accounts?'+new URLSearchParams({q:'Search cohort',cursor:first.nextCursor}),undefined,{status:409})
  assert.ok(h.logs.some(s=>s.includes('mallet_request')&&s.includes('account-search')),'Worker request logs include a canonical route and server duration')
  const target=await installation()
  try{await restore(target,await archive(h));assert.equal((await target.api('/api/mallet/accounts?q=202555')).total,50);assert.equal((await target.api('/api/mallet/accounts?q=VIN-987654')).accounts[0].id,accounts[1].id)}finally{await target.close()}
 }finally{await h.close()}
}
