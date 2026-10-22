import assert from 'node:assert/strict'
export async function portalPost(h,path,values,{as='',...options}={}){
 return h.mf.dispatchFetch(h.origin+path,{method:'POST',redirect:'manual',headers:{origin:h.origin,'content-type':'application/x-www-form-urlencoded',...(as?{cookie:as}:{}),...options.headers},body:new URLSearchParams(values).toString()})
}
export async function portalSignIn(h,email,accountName){
 const response=await portalPost(h,'/portal/signin',{email,consent:'yes'});assert.equal(response.status,200)
 const message=h.messages.findLast(m=>JSON.stringify(m.to).includes(email)&&m.text.includes(accountName)&&m.subject==='Your Mallet customer account sign-in');assert.ok(message,'Customer requested email reached mail edge')
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
 await portalPost(h,'/portal/signin',{email:payer.email,consent:'yes'})
 const expired=h.messages.findLast(m=>JSON.stringify(m.to).includes(payer.email)).text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0]
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
