import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {creditAccountFixture,creditInvoice,creditInput,issueCredit,cashRefundPrivateText,refundReadSnapshot,secondCashRefund} from './support/refunds-journey.mjs'
import {portalMail,portalSignIn} from './support/portal-journey.mjs'
import {qualityReady} from './support/quality-ready.mjs'
import {chromium} from '@playwright/test'
import {installation,assetInput,booking,estimate,authorise} from './harness.mjs'
export async function customersBrowser(){
 const h=await installation({entry:'tests/worker.ts',network:true,assets:true,secureNetwork:true});let browser
 try{
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  const admin=await h.person('customer-browser-admin@example.test','admin')
  await context.addCookies(admin.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_CUSTOMERS_PROOF_DIR??'.cache/customers-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,target=p.locator('main'))=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await target.screenshot({path:join(directory,name+'-'+width+'.png')})}await p.setViewportSize({width:1440,height:1000})}
  const form=(c,button)=>p.locator(`form:has(input[name="command"][value="${c}"])`).filter({has:p.getByRole('button',{name:button,exact:true})}),fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/accounts');if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.waitForLoadState('domcontentloaded');await p.goto(h.origin+'/app/accounts')}
  await p.getByRole('link',{name:'Manage accounts and contacts',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  await shot('01-owner-register-and-contact-form')
  for(const [name,phone,email] of [['Dana Driver','(614) 555-0101','driver@example.test'],['Ari Authorizer','614-555-0102','authorizer@example.test'],['Pat Payer','614-555-0103','payer@example.test']])await fill(form('contact.save','Create contact'),{name,phone,email,communication:'none',notes:'Declared preference, no automatic send'},'Create contact')
  const contacts=(await h.state()).records.contact,one=name=>contacts.find(c=>c.name===name),driver=one('Dana Driver'),authorizer=one('Ari Authorizer'),payer=one('Pat Payer')
  const create=async(name,kind,ids,payerId,authorizerId='')=>{const f=form('customer.save','Create account');for(const id of ids)await f.locator(`input[name="contactIds"][value="${id}"]`).check();await fill(f,{name,kind,payerId,billingContactId:payerId,driverId:driver.id,authorizerId,taxStatus:'unknown',notes:'Owner reviewed household or fleet relationships'},'Create account')}
  await create('Dana Household','household',[driver.id],driver.id)
  await create('Cedar Fleet','fleet',[driver.id,authorizer.id,payer.id],payer.id,authorizer.id)
  await create('Cedar Fleet duplicate','fleet',[driver.id,authorizer.id,payer.id],payer.id,authorizer.id)
  let accounts=(await h.state()).records.customerAccount,fleet=accounts.find(c=>c.name==='Cedar Fleet'),duplicate=accounts.find(c=>c.name==='Cedar Fleet duplicate')
  const section=id=>p.locator('#account-'+id),assetA=await h.command('asset.create',{...assetInput('fleet-a'),identifier:'OH-CEDAR-17'}),assetB=await h.command('asset.create',{...assetInput('fleet-b'),identifier:'OH-CEDAR-18'})
  await p.goto(h.origin+'/app/accounts');await p.getByRole('link',{name:'Manage accounts and contacts',exact:true}).click();await p.waitForLoadState('domcontentloaded');await shot('02-household-and-fleet-roles')
  await section(fleet.id).locator('summary').filter({hasText:/^Update account and roles$/}).click();await fill(section(fleet.id).locator('form:has(input[value="customer.save"])'),{notes:'Admin confirmed fleet roles at intake'},'Save account');fleet=(await h.state()).records.customerAccount.find(a=>a.id===fleet.id)
  for(const [account,asset]of [[fleet,assetA],[duplicate,assetB]]){const card=section(account.id);await card.locator('summary').filter({hasText:/^Link a vehicle$/}).click();await fill(card.locator('form:has(input[value="customer.linkAsset"])'),{assetSource:JSON.stringify({id:asset.id,version:asset.version}),driverId:driver.id,reason:'Owner checked customer request'},'Link vehicle')}
  await shot('03-linked-fleet-vehicle',section(fleet.id));await fill(section(fleet.id).locator('form:has(input[value="customer.driver"])'),{driverId:payer.id,reason:'Fleet assigned replacement driver'},'Change driver')
  assert.ok((await section(fleet.id).innerText()).includes('Driver Pat Payer'));await shot('04-driver-change',section(fleet.id))
  const merge=form('customer.mergePreview','Preview merge');await fill(merge,{sourceRef:duplicate.id+'@'+duplicate.version,targetRef:fleet.id+'@'+fleet.version,reason:'Customer confirmed duplicate',identityEvidence:'Company registration matches synthetic-mallet-21',consentEvidence:'Explicit signed instruction synthetic-mallet-20'},'Preview merge')
  assert.ok((await p.locator('main').innerText()).includes('Pat Payer'));await shot('05a-merge-survivor-preview');await p.getByRole('button',{name:'Confirm merge',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal(await section(duplicate.id).count(),0);assert.ok((await section(fleet.id).innerText()).includes('OH-CEDAR-18'))
  await section(fleet.id).locator('summary').filter({hasText:/^Source and merge history$/}).click();await shot('05-duplicate-source-history',section(fleet.id))
  for(const query of ['Cedar','6145550101','OH-CEDAR-18']){await p.getByLabel('Search accounts by name, phone or plate',{exact:true}).fill(query);await p.getByRole('button',{name:'Search accounts',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok(await section(fleet.id).count());await shot('06-search-'+query)}
  const linked=(await h.state()).records.asset.find(a=>a.id===assetA.id),{job}=await booking(h,{asset:linked})
  const q=await authorise(h,await estimate(h,job));let current=(await h.state()).records.job.find(j=>j.id===job.id)
  current=await h.command('work.record',{jobId:job.id,version:current.version,lineId:q.revisions[0].lines[0].id,quantity:2});await qualityReady(h,current)
  current=await h.command('job.complete',{jobId:job.id,version:current.version});let invoice=await h.command('invoice.prepare',{jobId:job.id,version:current.version})
  invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version});const tender=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:100,method:'cash',reference:'synthetic-mallet-23',evidence:'Counter tender'})
  const customerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),customer=await customerContext.newPage()
  const customerShot=async(name)=>{for(const width of [1440,390]){await customer.setViewportSize({width,height:1000});assert.ok(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await customer.locator('main').screenshot({path:join(directory,name+'-'+width+'.png')})}}
  const customerLogin=async(email)=>{const before=h.messages.length;await customer.goto(h.origin+'/portal');await customer.getByLabel('Your email',{exact:true}).fill(email);await customer.getByRole('checkbox').check();await customer.getByRole('button',{name:'Send sign-in email',exact:true}).click();await customer.waitForLoadState('domcontentloaded');await customerShot('07a-signin-requested');const message=await portalMail(h,email,'Cedar Fleet',before);const url=message.text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0];await customer.goto(url);await customer.reload();assert.ok(!(await customer.locator('main').innerText()).includes(invoice.number));await customerShot('07b-confirm-customer-signin');await customer.getByRole('button',{name:'Confirm sign-in',exact:true}).click();await customer.waitForLoadState('domcontentloaded')}
  await customer.goto(h.origin+'/portal');await customerShot('07-customer-signin')
  await customerLogin(payer.email);assert.ok((await customer.locator('main').innerText()).includes(invoice.number))
  const statementResponse=await customer.request.get(h.origin+'/api/mallet/portal/billing',{headers:{Origin:h.origin}});assert.equal(statementResponse.status(),200)
  const statement=(await statementResponse.json()).invoices.find(i=>i.id===invoice.id),visibleTender=statement.payments.find(p=>p.method===tender.method&&p.amountCents===tender.amountCents)
  assert.ok(visibleTender);assert.equal(visibleTender.verified,false);assert.equal(statement.paidCents,tender.amountCents);assert.equal(statement.outstandingCents,invoice.totals.totalCents-tender.amountCents);assert.ok((await customer.locator('main').innerText()).includes(visibleTender.label));await customerShot('08-payer-billing-statement')
  await customer.getByRole('button',{name:'Sign out',exact:true}).click();await customer.waitForLoadState('domcontentloaded');await customer.goto(h.origin+'/portal/billing');assert.ok((await customer.locator('main').innerText()).includes('Billing unavailable'));await customerShot('08a-signed-out-denied')
  await customerLogin(payer.email)
  let editedPayer=await h.command('contact.save',{...payer,contactId:payer.id,version:payer.version,email:'changed-payer@example.test'})
  await customer.reload();assert.ok((await customer.locator('main').innerText()).includes('Billing unavailable'));assert.ok(!(await customer.locator('main').innerText()).includes(invoice.number));await customerShot('08b-changed-contact-denied')
  await h.command('contact.save',{...editedPayer,contactId:editedPayer.id,version:editedPayer.version,email:payer.email})
  await customerLogin(payer.email)
  fleet=(await h.state()).records.customerAccount.find(a=>a.id===fleet.id)
  const changed=await h.command('customer.save',{...fleet,customerId:fleet.id,version:fleet.version,payerId:authorizer.id,billingContactId:authorizer.id})
  await customer.reload();assert.ok((await customer.locator('main').innerText()).includes('Billing unavailable'));assert.ok(!(await customer.locator('main').innerText()).includes(invoice.number));await customerShot('09-old-payer-denied')
  await customerLogin(driver.email);assert.ok((await customer.locator('main').innerText()).includes('Billing unavailable'));await customerShot('10-driver-denied')
  await h.command('customer.save',{...changed,customerId:changed.id,version:changed.version,payerId:payer.id,billingContactId:payer.id})
  await customerLogin(authorizer.email);assert.ok((await customer.locator('main').innerText()).includes('Billing unavailable'));await customerShot('11-authorizer-denied')
  const membershipPayer=await h.command('contact.save',{name:'Membership payer',email:'membership-payer@example.test',phone:'',communication:'none',notes:''})
  fleet=(await h.state()).records.customerAccount.find(a=>a.id===fleet.id)
  const membershipAccount=await h.command('customer.save',{...fleet,customerId:fleet.id,version:fleet.version,contactIds:[...fleet.contactIds,membershipPayer.id],payerId:membershipPayer.id,billingContactId:membershipPayer.id})
  await customerLogin(membershipPayer.email);assert.ok((await customer.locator('main').innerText()).includes(invoice.number))
  await h.command('customer.save',{...membershipAccount,customerId:fleet.id,version:membershipAccount.version,contactIds:fleet.contactIds,payerId:payer.id,billingContactId:payer.id})
  await customer.reload();assert.ok((await customer.locator('main').innerText()).includes('Billing unavailable'));assert.ok(!(await customer.locator('main').innerText()).includes(invoice.number));await customerShot('11a-removed-account-member-denied');await customerContext.close()
  const records=(await h.state()).records;assert.equal(records.customerMerge.length,1);assert.equal(records.asset.filter(a=>a.customerAccountId===fleet.id).length,2);assert.equal(records.customerAccount.find(a=>a.id===fleet.id).payerId,payer.id);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}

export async function refundsBrowser(){
 let stripeInvoice;const receipts=[]
 const h=await installation({entry:'tests/worker.ts',network:true,assets:true,secureNetwork:true,bindings:{STRIPE_SECRET_KEY:'synthetic-mallet-190'},outboundService:async request=>{
  const url=new URL(request.url)
  assert.equal(url.hostname,'api.stripe.com')
  if(url.pathname.startsWith('/v1/payment_intents/'))return Response.json({id:'synthetic-mallet-191',metadata:{mallet_invoice_id:stripeInvoice.id},status:'succeeded',currency:'usd',amount_received:541,livemode:true,latest_charge:{paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount:541}})
  assert.equal(request.method,'POST');const form=new URLSearchParams(await request.text()),receipt={id:'synthetic-mallet-'+(192+receipts.length),payment_intent:form.get('payment_intent'),amount:Number(form.get('amount')),currency:'usd',status:'failed',metadata:{mallet_refund_id:form.get('metadata[mallet_refund_id]')}};receipts.push(receipt);return Response.json(receipt)
 }});let browser
 try{
  const {account,contact}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account),replacement=await creditInvoice(h,account,'2')
  const payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:541,method:'cash',reference:'synthetic-mallet-140',evidence:cashRefundPrivateText.paymentEvidence})
  const outsider=await creditAccountFixture(h,'privacy'),other=await creditInvoice(h,outsider.account,'5')
  const otherPayment=await h.command('payment.record',{invoiceId:other.invoice.id,version:other.invoice.version,amountCents:541,method:'cash',reference:'synthetic-mallet-311',evidence:'synthetic-mallet-312 private other account cash'})
  const otherCredit=await issueCredit(h,{...creditInput(other.invoice,otherPayment,'synthetic-mallet-313',other.invoice.lines[1]),reason:'synthetic-mallet-314 private other account return',consentEvidence:'synthetic-mallet-315 private other account instruction'})
  const otherLogin=await portalSignIn(h,outsider.contact.email,outsider.account.name)
  const second=await secondCashRefund(h,account)
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const otherContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  await otherContext.addCookies(otherLogin.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const otherPage=await otherContext.newPage();otherPage.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_CUSTOMERS_PROOF_DIR??'.cache/customers-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,page=p)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await page.locator('main').screenshot({path:join(directory,name+'-'+width+'.png')})}await page.setViewportSize({width:1440,height:1000})}
  await p.goto(h.origin+'/portal');await p.getByLabel('Your email',{exact:true}).fill(contact.email);await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Send sign-in email',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  const message=await portalMail(h,contact.email,account.name),url=message.text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0]
  await p.goto(url);await p.getByRole('button',{name:'Confirm sign-in',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok((await p.locator('main').innerText()).includes(invoice.number))
  const credit=await issueCredit(h,{...creditInput(invoice,payment,'synthetic-mallet-141'),reason:cashRefundPrivateText.reason,consentEvidence:cashRefundPrivateText.consentEvidence});let refund=(await h.state()).records.refund.find(r=>r.creditNoteId===credit.id)
  const privateTexts=[...Object.values(cashRefundPrivateText),'synthetic-mallet-312 private other account cash','synthetic-mallet-314 private other account return','synthetic-mallet-315 private other account instruction']
  const originalPayerCookie=(await context.cookies(h.origin)).map(c=>c.name+'='+c.value).join('; ')
  const usePayer=async(email)=>{const login=await portalSignIn(h,email,account.name);await context.clearCookies();await context.addCookies(login.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));await p.goto(h.origin+'/portal/billing')}
  const checkCashStatement=async(status,refundedCents,paidCents,name)=>{
   const beforeRead=await refundReadSnapshot(h)
   for(const text of [cashRefundPrivateText.reason,cashRefundPrivateText.consentEvidence,cashRefundPrivateText.paymentEvidence,cashRefundPrivateText.secondReason,cashRefundPrivateText.secondConsent,cashRefundPrivateText.secondEvidence,...(status==='unsubmitted'?[]:[cashRefundPrivateText.outcomeEvidence+' '+status])])assert.ok(JSON.stringify(beforeRead.records).includes(text),'Private evidence is populated before payer read')
   const pageResponse=await p.reload();assert.equal(pageResponse.status(),200)
   const html=await pageResponse.text()
   assert.deepEqual(await refundReadSnapshot(h),beforeRead,'Current payer page read independently preserves records and saved exports')
   const response=await p.request.get(h.origin+'/api/mallet/portal/billing');assert.equal(response.status(),200)
   const view=await response.json(),bill=view.invoices.find(i=>i.id===invoice.id),text=await p.locator('main').innerText()
   assert.equal(view.account.id,account.id);assert.deepEqual(bill.refunds,[{amountCents:109,method:'cash',status}])
   assert.equal(bill.refundedCents,refundedCents);assert.equal(bill.paidCents,paidCents);assert.equal(bill.creditedCents,109);assert.equal(bill.outstandingCents,0)
   const secondBill=view.invoices.find(i=>i.id===second.invoice.id)
   assert.deepEqual(secondBill.refunds,[{amountCents:215,method:'cash',status:'refunded'}])
   assert.equal(secondBill.creditedCents,215);assert.equal(secondBill.refundedCents,215);assert.equal(secondBill.paidCents,326);assert.equal(secondBill.outstandingCents,0)
   const secondText=await p.getByRole('heading',{name:second.invoice.number,exact:true}).locator('..').innerText()
   assert.ok(secondText.includes(second.note.number));assert.ok(secondText.includes('Refund $2.15 · cash · refunded · Owner recorded; not verified by Mallet'));assert.ok(secondText.includes('Refunded $2.15'))
   const invoiceText=await p.getByRole('heading',{name:invoice.number,exact:true}).locator('..').innerText()
   assert.ok(text.includes(invoice.number));assert.ok(invoiceText.includes(credit.number));assert.ok(invoiceText.includes('Refund $1.09 · cash · '+status+' · Owner recorded; not verified by Mallet'));assert.ok(invoiceText.includes('Refunded $'+(refundedCents===109?'1.09':'0.00')))
   for(const body of [JSON.stringify(view),text,html])for(const secret of [...privateTexts,other.invoice.id,other.invoice.number,otherCredit.id,otherCredit.number])assert.ok(!body.includes(secret),'Payer billing excludes private and other-account evidence: '+secret)
   assert.deepEqual(await refundReadSnapshot(h),beforeRead,'Current payer browser and API reads immediately preserve records and saved exports')
   const otherView=await h.api('/api/mallet/portal/billing',undefined,{as:otherLogin.cookie})
   assert.equal(otherView.account.id,outsider.account.id);assert.deepEqual(otherView.invoices.find(i=>i.id===other.invoice.id).refunds,[{amountCents:215,method:'cash',status:'unsubmitted'}])
   for(const secret of [...privateTexts,invoice.id,invoice.number,credit.id,credit.number,second.invoice.id,second.invoice.number,second.note.id,second.note.number])assert.ok(!JSON.stringify(otherView).includes(secret))
   assert.deepEqual(await refundReadSnapshot(h),beforeRead,'Other payer API read independently preserves records and saved exports')
   const otherResponse=await otherPage.goto(h.origin+'/portal/billing');assert.equal(otherResponse.status(),200)
   const otherText=await otherPage.locator('main').innerText(),otherHtml=await otherResponse.text()
   assert.ok(otherText.includes(other.invoice.number));assert.ok(otherText.includes(otherCredit.number));assert.ok(otherText.includes('Refund $2.15 · cash · unsubmitted · Owner recorded; not verified by Mallet'));assert.ok(otherText.includes('Refunded $0.00'))
   for(const body of [otherText,otherHtml])for(const secret of [...privateTexts,invoice.id,invoice.number,credit.id,credit.number,second.invoice.id,second.invoice.number,second.note.id,second.note.number])assert.ok(!body.includes(secret),'Other payer page excludes this account and every private narrative')
   assert.deepEqual(await refundReadSnapshot(h),beforeRead,'Other payer browser read independently preserves records and saved exports')
   if(status==='unsubmitted')await shot('12a-other-payer-private-statement',otherPage)
   await shot(name)
   assert.deepEqual(await refundReadSnapshot(h),beforeRead,'Rendered statements and API reads change no business record or saved export bytes')
  }
  const replaceCashPayer=async(status,suffix)=>{
   const next=await h.command('contact.save',{name:'Cash refund browser payer '+suffix,email:['synthetic-mallet-'+suffix,'example.test'].join('@'),phone:'',communication:'none',notes:''})
   const current=(await h.state()).records.customerAccount.find(a=>a.id===account.id)
   await h.command('customer.save',{...current,customerId:account.id,version:current.version,contactIds:[...current.contactIds,next.id],payerId:next.id,billingContactId:next.id})
   const beforeRefusal=await refundReadSnapshot(h)
   const denied=await p.request.get(h.origin+'/api/mallet/portal/billing');assert.equal(denied.status(),403)
   const apiBody=await denied.text()
   for(const secret of [...privateTexts,invoice.id,invoice.number,credit.id,credit.number,second.invoice.id,second.invoice.number,second.note.id,second.note.number,other.invoice.id,other.invoice.number,otherCredit.id,otherCredit.number])assert.ok(!apiBody.includes(secret),'Former payer API response excludes '+status+' refunds')
   assert.deepEqual(await refundReadSnapshot(h),beforeRefusal,'Browser former-payer API refusal preserves records and exports in '+status+' state')
   const deniedPage=await p.reload();assert.equal(deniedPage.status(),403)
   const html=await deniedPage.text(),text=await p.locator('main').innerText();assert.ok(text.includes('Billing unavailable'))
   for(const body of [text,html])for(const secret of [...privateTexts,invoice.id,invoice.number,credit.id,credit.number,second.invoice.id,second.invoice.number,second.note.id,second.note.number,other.invoice.id,other.invoice.number,otherCredit.id,otherCredit.number])assert.ok(!body.includes(secret),'Former payer page excludes '+status+' refunds')
   assert.deepEqual(await refundReadSnapshot(h),beforeRefusal,'Browser former-payer page refusal independently preserves records and exports in '+status+' state')
   await shot('13a-former-cash-payer-'+status)
   await usePayer(next.email)
   await checkCashStatement(status,0,541,'13b-current-cash-payer-'+status)
  }
  await checkCashStatement('unsubmitted',0,541,'12-payer-pending-refund')
  await replaceCashPayer('unsubmitted',340)
  for(const [n,status]of ['failed','disputed','refunded'].entries()){
   refund=await h.command('refund.record',{refundId:refund.id,version:refund.version,status,reference:'synthetic-mallet-'+(142+n),evidence:cashRefundPrivateText.outcomeEvidence+' '+status,confirm:'record-refund'})
   await checkCashStatement(status,status==='refunded'?109:0,status==='refunded'?432:541,'13-payer-refund-'+status)
   if(status!=='refunded')await replaceCashPayer(status,341+n)
  }
  const nextPayer=await h.command('contact.save',{name:'Replacement refund payer',email:['synthetic-mallet-316','example.test'].join('@'),phone:'',communication:'none',notes:''}),currentAccount=(await h.state()).records.customerAccount.find(a=>a.id===account.id)
  const changed=await h.command('customer.save',{...currentAccount,customerId:account.id,version:currentAccount.version,contactIds:[...currentAccount.contactIds,nextPayer.id],payerId:nextPayer.id,billingContactId:nextPayer.id})
  const beforeRefusal=await refundReadSnapshot(h)
  const denied=await p.request.get(h.origin+'/api/mallet/portal/billing');assert.equal(denied.status(),403)
  for(const secret of [...privateTexts,invoice.id,invoice.number,credit.id,credit.number,second.invoice.id,second.invoice.number,second.note.id,second.note.number])assert.ok(!(await denied.text()).includes(secret))
  assert.deepEqual(await refundReadSnapshot(h),beforeRefusal,'Former payer API refusal has no financial effect')
  const deniedPage=await p.reload();assert.equal(deniedPage.status(),403)
  const deniedText=await p.locator('main').innerText();assert.ok(deniedText.includes('Billing unavailable'))
  const deniedHtml=await deniedPage.text()
  for(const body of [deniedText,deniedHtml])for(const secret of [...privateTexts,invoice.id,invoice.number,credit.id,credit.number,second.invoice.id,second.invoice.number,second.note.id,second.note.number,other.invoice.id,other.invoice.number,otherCredit.id,otherCredit.number])assert.ok(!body.includes(secret))
  assert.deepEqual(await refundReadSnapshot(h),beforeRefusal,'Former payer page refusal independently preserves records and saved exports')
  await shot('13a-former-refund-payer-denied')
  assert.deepEqual(await refundReadSnapshot(h),beforeRefusal,'Former payer page refusal has no financial effect')
  await usePayer(nextPayer.email);await checkCashStatement('refunded',109,432,'13b-current-refund-payer')
  Object.assign(account,await h.command('customer.save',{...changed,customerId:account.id,version:changed.version,payerId:contact.id,billingContactId:contact.id}))
  const beforeReplay=await refundReadSnapshot(h)
  for(const path of ['/api/mallet/portal/billing','/portal/billing']){
   const response=await h.request(path,{as:originalPayerCookie});assert.equal(response.status,403)
   const body=await response.text()
   for(const secret of [...privateTexts,invoice.id,invoice.number,credit.id,credit.number,second.invoice.id,second.invoice.number,second.note.id,second.note.number])assert.ok(!body.includes(secret),'Returning the payer role never revives its original browser session')
   assert.deepEqual(await refundReadSnapshot(h),beforeReplay,'Original browser-session replay preserves records and exports at each billing door')
  }
  await usePayer(contact.email)
  const held=await issueCredit(h,creditInput(invoice,null,'synthetic-mallet-145',invoice.lines[0],2));await p.reload();assert.ok((await p.locator('main').innerText()).includes(held.number));assert.ok((await p.locator('main').innerText()).includes('Customer account credit'));await shot('14-payer-account-credit')
  await h.command('credit.exchange',{creditNoteId:held.id,invoiceId:replacement.invoice.id,version:replacement.invoice.version,amountCents:held.totals.totalCents,reference:'synthetic-mallet-146',reason:'Customer selected the separately authorized replacement accessory',confirm:'apply-credit'})
  await p.reload();const text=await p.locator('main').innerText();assert.ok(text.includes('Outstanding balance $3.24'));assert.ok(text.includes('Customer credit allocation; no new cash or processor settlement.'));assert.ok(!text.includes('Customer selected the separately authorized'));await shot('15-payer-exchange-allocation')
  const stripeReplacement=await creditInvoice(h,account,'4')
  ;({invoice:stripeInvoice}=await creditInvoice(h,account,'3'))
  const stripePayment=await h.command('payment.verifyStripe',{invoiceId:stripeInvoice.id,version:stripeInvoice.version,paymentIntentId:'synthetic-mallet-191'})
  const stripeCredit=await issueCredit(h,creditInput(stripeInvoice,stripePayment,'synthetic-mallet-194',stripeInvoice.lines[0],3));let failed=(await h.state()).records.refund.find(r=>r.creditNoteId===stripeCredit.id)
  failed=await h.command('refund.submit',{refundId:failed.id,version:failed.version,confirm:'send-refund'})
  await p.reload();assert.ok((await p.locator('main').innerText()).includes('stripe · failed'));await shot('16-payer-failed-stripe-refund')
  await h.command('refund.redirect',{refundId:failed.id,version:failed.version,destination:'account-credit',accountId:account.id,reference:'synthetic-mallet-195',consentEvidence:'Private new instruction to redirect to customer credit',confirm:'redirect-refund'})
  await h.command('credit.apply',{creditNoteId:stripeCredit.id,invoiceId:stripeReplacement.invoice.id,version:stripeReplacement.invoice.version,amountCents:326,reference:'synthetic-mallet-196',reason:'Private customer instruction for the second repair',confirm:'apply-credit'})
  await p.reload();assert.ok((await p.locator('main').innerText()).includes('account-credit · credited'));assert.ok(!(await p.locator('main').innerText()).includes('Private new instruction'));await shot('17-payer-redirected-credit-applied')
  const manualCredit=await issueCredit(h,creditInput(stripeInvoice,stripePayment,'synthetic-mallet-197',stripeInvoice.lines[1]));let manual=(await h.state()).records.refund.find(r=>r.creditNoteId===manualCredit.id)
  manual=await h.command('refund.submit',{refundId:manual.id,version:manual.version,confirm:'send-refund'})
  manual=await h.command('refund.redirect',{refundId:manual.id,version:manual.version,destination:'manual-tender',method:'cash',reference:'synthetic-mallet-198',consentEvidence:'Private new customer cash instruction',confirm:'redirect-refund'})
  await p.reload();assert.ok((await p.locator('main').innerText()).includes('cash · unsubmitted'));await shot('18-payer-redirected-manual-pending')
  await h.command('refund.record',{refundId:manual.id,version:manual.version,status:'refunded',reference:'synthetic-mallet-199',evidence:'Private owner record of cash handed over',confirm:'record-refund'})
  await p.reload();const recovered=await p.locator('main').innerText();assert.ok(recovered.includes('cash · refunded'));assert.ok(recovered.includes('Refunded $2.15'));assert.ok(recovered.includes('Staff-recorded manual refund'));assert.ok(!recovered.includes('Private'));await shot('19-payer-redirected-manual-refunded')
  assert.deepEqual(errors,[]);await otherContext.close();await context.close()
 }finally{await browser?.close();await h.close()}
}
