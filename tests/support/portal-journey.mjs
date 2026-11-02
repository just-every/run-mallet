import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {installation} from '../harness.mjs'
export async function portalPost(h,path,values,{as='',...options}={}){
 return h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(as?{cookie:as}:{}),...options.headers},body:new URLSearchParams(values).toString()})
}
export async function portalMail(h,email,accountName,after=0){
 for(let n=0;n<250;n++){
  const message=h.messages.slice(after).findLast(m=>JSON.stringify(m.to).includes(email)&&m.text.includes(accountName)&&m.subject==='Your Mallet customer account sign-in')
  if(message)return message
  await delay(20)
 }
 assert.fail('Customer requested email did not reach mail edge')
}
export async function portalSignIn(h,email,accountName){
 const before=h.messages.length
 const response=await portalPost(h,'/portal/signin',{email,consent:'yes'});assert.equal(response.status,200)
 const message=await portalMail(h,email,accountName,before)
 const url=message.text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0],path=new URL(url).pathname
 const login=await portalPost(h,path,{confirm:'yes'});assert.equal(login.status,303,await login.text())
 return {cookie:login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '),path}
}
export async function payerDoorJourney(h,{account,household,driver,authorizer,payer,input,invoice}){
 const read=async(cookie,status=200)=>h.api('/api/mallet/portal/billing',undefined,{as:cookie,status})
 await read('',403);await read(h.owner,403)
 const payerLogin=await portalSignIn(h,payer.email,account.name),view=await read(payerLogin.cookie)
 assert.equal(view.account.id,account.id);assert.ok(view.invoices.some(i=>i.id===invoice.id));assert.ok(!JSON.stringify(view).includes('notes'));assert.ok(!JSON.stringify(view).includes('recordedBy'))
 assert.equal(view.balanceCents,invoice.totals.totalCents-100)
 assert.deepEqual(view.invoices[0].payments.map(p=>[p.amountCents,p.method,p.verified]),[[100,'cash',false]])
 const replay=await portalPost(h,payerLogin.path,{confirm:'yes'});assert.equal(replay.status,403)
 const driverLogin=await portalSignIn(h,driver.email,account.name),authorizerLogin=await portalSignIn(h,authorizer.email,account.name)
 await read(driverLogin.cookie,403);await read(authorizerLogin.cookie,403)
 assert.equal((await h.request('/portal/billing',{as:driverLogin.cookie})).status,403)
 assert.equal((await h.request('/api/mallet/accounts/'+account.id+'/billing',{as:payerLogin.cookie})).status,401)
 assert.equal((await h.request('/api/mallet/portal/billing/'+household.id,{as:payerLogin.cookie})).status,404)
 assert.equal((await h.request('/api/mallet/state',{as:payerLogin.cookie})).status,401)
 await read(payerLogin.cookie+'; '+payerLogin.cookie,403)
 const db=await h.mf.getD1Database('DB')
 const householdLogin=await portalSignIn(h,driver.email,household.name),own=await read(householdLogin.cookie)
 assert.equal(own.account.id,household.id);assert.equal(own.invoices.length,0,'Another account invoice IDs grant no billing access')
 await db.prepare("UPDATE mallet_portal_tokens SET expires_at=0 WHERE kind='session' AND account_id=?").bind(household.id).run();await read(householdLogin.cookie,403)
 const beforeExpiry=h.messages.length
 await portalPost(h,'/portal/signin',{email:payer.email,consent:'yes'})
 const expired=(await portalMail(h,payer.email,account.name,beforeExpiry)).text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0]
 await db.prepare("UPDATE mallet_portal_tokens SET expires_at=0 WHERE kind='link'").run();assert.equal((await portalPost(h,new URL(expired).pathname,{confirm:'yes'})).status,403)
 const changed=await h.command('customer.save',{...input,customerId:account.id,version:account.version,payerId:authorizer.id,billingContactId:authorizer.id})
 await read(payerLogin.cookie,403);await read(authorizerLogin.cookie,403)
 const replacement=await portalSignIn(h,authorizer.email,account.name);assert.equal((await read(replacement.cookie)).invoices[0].id,invoice.id)
 // Returning to the prior payer never revives an earlier session or link.
 const returned=await h.command('customer.save',{...input,customerId:account.id,version:changed.version})
 await read(payerLogin.cookie,403)
 const before=h.messages.length
 const badOrigin=await portalPost(h,'/portal/signin',{email:payer.email,consent:'yes'},{headers:{origin:'https://elsewhere.test'}});assert.equal(badOrigin.status,403)
 assert.equal((await portalPost(h,'/portal/signin',{email:payer.email})).status,400);assert.equal(h.messages.length,before)
 return {account:returned,payerCookie:payerLogin.cookie}
}

// A held mail edge makes enumeration latency deterministic: both HTTP responses
// must finish while the provider still has no permission to answer.
export async function portalRequestJourney(){
 let release,providerHeld=true
 const held=new Promise(resolve=>{release=()=>{providerHeld=false;resolve()}})
 const h=await installation({mailService:async()=>{await held;return Response.json({id:'synthetic-mallet-31'})}})
 const observations=[]
 const submit=async(email,client='192.0.2.31')=>{
  const started=performance.now(),response=await h.mf.dispatchFetch(h.origin+'/portal/signin',{method:'POST',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded','cf-connecting-ip':client},body:new URLSearchParams({email,consent:'yes'})})
  const body=await response.text();observations.push({known:email==='known@example.test',elapsedMs:Math.round(performance.now()-started),providerHeld})
  return {status:response.status,headers:[...response.headers].filter(([name])=>!['date','transfer-encoding','content-length'].includes(name)),body}
 }
 let timeout
 try{
  const contact=await h.command('contact.save',{name:'Known customer',email:'known@example.test',phone:'',communication:'none',notes:''})
  await h.command('customer.save',{name:'Customer household',kind:'household',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,driverId:contact.id,taxStatus:'unknown',notes:''})
  const responses=await Promise.race([
   Promise.all([submit('known@example.test'),submit('unknown@example.test')]),
   new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Known and unknown responses must finish before the held mail provider answers')),1500)})
  ]);clearTimeout(timeout)
  assert.deepEqual(responses[0],responses[1],'Known and unknown requests have the same status, headers and complete body')
  assert.equal(responses[0].status,200);assert.ok(observations.every(o=>o.providerHeld),'Neither response waits for the mail provider')
  release()
  for(let n=0;n<2;n++)assert.deepEqual(await submit('known@example.test'),responses[0])
  for(let n=0;n<100&&h.messages.length<3;n++)await delay(20)
  assert.equal(h.messages.length,3,'First three requests each reach the mail edge')
  assert.deepEqual(await submit('known@example.test'),responses[0],'Fourth request has the same public response')
  // The client limit counts unknown requests too; address rotation cannot evade it.
  for(let n=0;n<20;n++)assert.deepEqual(await submit('unknown-'+n+'@example.test','192.0.2.32'),responses[0])
  const second=await h.command('contact.save',{name:'Second customer',email:'second@example.test',phone:'',communication:'none',notes:''})
  await h.command('customer.save',{name:'Second household',kind:'household',contactIds:[second.id],payerId:second.id,billingContactId:second.id,driverId:second.id,taxStatus:'unknown',notes:''})
  assert.deepEqual(await submit('second@example.test','192.0.2.32'),responses[0],'Client-limited request has the same response')
  // A different client can still request the address, proving the two limits are independent.
  assert.deepEqual(await submit('second@example.test','192.0.2.33'),responses[0])
  for(let n=0;n<100&&h.messages.length<4;n++)await delay(20)
  assert.equal(h.messages.length,4,'Fourth address request and twenty-first client request send nothing')
  assert.equal(h.messages.filter(m=>m.to.includes('known@example.test')).length,3)
  assert.equal(h.messages.filter(m=>m.to.includes('second@example.test')).length,1)
  console.log('PORTAL-001 request timing '+JSON.stringify(observations.slice(0,2)))
 }finally{clearTimeout(timeout);release();await h.close()}
}
if(process.argv[1]===import.meta.filename)await portalRequestJourney()

export async function portalSessionJourney(){
 const h=await installation()
 try{
  const contact=await h.command('contact.save',{name:'Portal payer',email:'payer@example.test',phone:'',communication:'none',notes:''})
  const account=await h.command('customer.save',{name:'Portal household',kind:'household',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,driverId:contact.id,taxStatus:'unknown',notes:''})
  const read=(cookie,status=200)=>h.api('/api/mallet/portal/billing',undefined,{as:cookie,status})
  await portalPost(h,'/portal/signin',{email:contact.email,consent:'yes'})
  const message=await portalMail(h,contact.email,account.name),path=new URL(message.text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0]).pathname
  for(const method of ['GET','HEAD','GET']){
   const response=await h.request(path,{method,as:''});assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null,'Opening the link never signs in')
  }
  await read('',403)
  const confirmed=await portalPost(h,path,{confirm:'yes'});assert.equal(confirmed.status,303,'Scanner opens leave the link usable')
  const setCookie=confirmed.headers.getSetCookie()[0];assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);assert.match(setCookie,/Secure/);assert.match(setCookie,/Max-Age=86400/)
  const db=await h.mf.getD1Database('DB'),serverSession=await db.prepare("SELECT created_at,expires_at FROM mallet_portal_tokens WHERE kind='session' AND contact_id=?").bind(contact.id).first()
  assert.equal(serverSession.expires_at-serverSession.created_at,24*60*60*1000,'Server session expiry is exactly 24 hours')
  const first=setCookie.split(';')[0];assert.equal((await read(first)).account.id,account.id)
  const second=await portalSignIn(h,contact.email,account.name);assert.notEqual(first,second.cookie,'Each confirmed request starts a separate session')
  const signedOut=await portalPost(h,'/portal/signout',{}, {as:first});assert.equal(signedOut.status,303);assert.match(signedOut.headers.get('set-cookie'),/Max-Age=0/)
  await read(first,403);assert.equal((await read(second.cookie)).account.id,account.id,'Signing out revokes only that session')
  const updated=await h.command('contact.save',{...contact,contactId:contact.id,version:contact.version,email:'changed-payer@example.test'})
  await read(second.cookie,403)
  const third=await portalSignIn(h,updated.email,account.name);assert.equal((await read(third.cookie)).account.id,account.id)
  // Returning the old email does not revive either earlier contact-version session.
  const reverted=await h.command('contact.save',{...updated,contactId:updated.id,version:updated.version,email:contact.email})
  await read(first,403);await read(second.cookie,403);await read(third.cookie,403)
  const fourth=await portalSignIn(h,reverted.email,account.name);assert.equal((await read(fourth.cookie)).account.id,account.id)
  const replacement=await h.command('contact.save',{name:'New payer',email:'new-payer@example.test',phone:'',communication:'none',notes:''})
  await h.command('customer.save',{...account,customerId:account.id,version:account.version,contactIds:[replacement.id],payerId:replacement.id,billingContactId:replacement.id,driverId:replacement.id})
  await read(fourth.cookie,403)
  assert.equal((await h.request('/portal/billing',{as:fourth.cookie})).status,403,'Removing the signed-in payer ends the browser session')
  // Isolate membership from payer epoch and contact-version fences in persisted state.
  // customer.save also changes the payer; retain its old role/epoch in this edge probe.
  const row=await db.prepare("SELECT value FROM mallet_records WHERE kind='customerAccount' AND id=?").bind(account.id).first(),removed=JSON.parse(row.value)
  removed.payerId=contact.id;removed.payerRevision=account.payerRevision
  await db.prepare("UPDATE mallet_records SET value=? WHERE kind='customerAccount' AND id=?").bind(JSON.stringify(removed),account.id).run()
  await read(fourth.cookie,403)
 }finally{await h.close()}
}
