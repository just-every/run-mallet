import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {creditAccountFixture,creditInvoice,creditInput,issueCredit} from './support/refunds-journey.mjs'
import {portalMail} from './support/portal-journey.mjs'
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
  await shot('01-owner-register-and-contact-form')
  for(const [name,phone,email] of [['Dana Driver','(614) 555-0101','driver@example.test'],['Ari Authorizer','614-555-0102','authorizer@example.test'],['Pat Payer','614-555-0103','payer@example.test']])await fill(form('contact.save','Create contact'),{name,phone,email,communication:'none',notes:'Declared preference, no automatic send'},'Create contact')
  const contacts=(await h.state()).records.contact,one=name=>contacts.find(c=>c.name===name),driver=one('Dana Driver'),authorizer=one('Ari Authorizer'),payer=one('Pat Payer')
  const create=async(name,kind,ids,payerId,authorizerId='')=>{const f=form('customer.save','Create account');for(const id of ids)await f.locator(`input[name="contactIds"][value="${id}"]`).check();await fill(f,{name,kind,payerId,billingContactId:payerId,driverId:driver.id,authorizerId,taxStatus:'unknown',notes:'Owner reviewed household or fleet relationships'},'Create account')}
  await create('Dana Household','household',[driver.id],driver.id)
  await create('Cedar Fleet','fleet',[driver.id,authorizer.id,payer.id],payer.id,authorizer.id)
  await create('Cedar Fleet duplicate','fleet',[driver.id,authorizer.id,payer.id],payer.id,authorizer.id)
  let accounts=(await h.state()).records.customerAccount,fleet=accounts.find(c=>c.name==='Cedar Fleet'),duplicate=accounts.find(c=>c.name==='Cedar Fleet duplicate')
  const section=id=>p.locator('#account-'+id),assetA=await h.command('asset.create',{...assetInput('fleet-a'),identifier:'OH-CEDAR-17'}),assetB=await h.command('asset.create',{...assetInput('fleet-b'),identifier:'OH-CEDAR-18'})
  await p.goto(h.origin+'/app/accounts');await shot('02-household-and-fleet-roles')
  await section(fleet.id).locator('summary').filter({hasText:/^Update account and roles$/}).click();await fill(section(fleet.id).locator('form:has(input[value="customer.save"])'),{notes:'Admin confirmed fleet roles at intake'},'Save account');fleet=(await h.state()).records.customerAccount.find(a=>a.id===fleet.id)
  for(const [account,asset]of [[fleet,assetA],[duplicate,assetB]]){const card=section(account.id);await card.locator('summary').filter({hasText:/^Link a vehicle$/}).click();await fill(card.locator('form:has(input[value="customer.linkAsset"])'),{assetSource:JSON.stringify({id:asset.id,version:asset.version}),driverId:driver.id,reason:'Owner checked customer request'},'Link vehicle')}
  await shot('03-linked-fleet-vehicle',section(fleet.id));await fill(section(fleet.id).locator('form:has(input[value="customer.driver"])'),{driverId:authorizer.id,reason:'Fleet assigned replacement driver'},'Change driver')
  assert.ok((await section(fleet.id).innerText()).includes('Driver Ari Authorizer'));await shot('04-driver-change',section(fleet.id))
  const merge=form('customer.mergePreview','Preview merge');await fill(merge,{sourceRef:duplicate.id+'@'+duplicate.version,targetRef:fleet.id+'@'+fleet.version,reason:'Customer confirmed duplicate',identityEvidence:'Company registration matches synthetic-mallet-21',consentEvidence:'Explicit signed instruction synthetic-mallet-20'},'Preview merge')
  assert.ok((await p.locator('main').innerText()).includes('Pat Payer'));await shot('05a-merge-survivor-preview');await p.getByRole('button',{name:'Confirm merge',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  assert.equal(await section(duplicate.id).count(),0);assert.ok((await section(fleet.id).innerText()).includes('OH-CEDAR-18'))
  await section(fleet.id).locator('summary').filter({hasText:/^Source and merge history$/}).click();await shot('05-duplicate-source-history',section(fleet.id))
  for(const query of ['Cedar','6145550101','OH-CEDAR-18']){await p.getByLabel('Search accounts by name, phone or plate',{exact:true}).fill(query);await p.getByRole('button',{name:'Search accounts',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok(await section(fleet.id).count());await shot('06-search-'+query)}
  const linked=(await h.state()).records.asset.find(a=>a.id===assetA.id),{job}=await booking(h,{asset:linked})
  const q=await authorise(h,await estimate(h,job));let current=(await h.state()).records.job.find(j=>j.id===job.id)
  current=await h.command('work.record',{jobId:job.id,version:current.version,lineId:q.revisions[0].lines[0].id,quantity:2});await qualityReady(h,current)
  current=await h.command('job.complete',{jobId:job.id,version:current.version});let invoice=await h.command('invoice.prepare',{jobId:job.id,version:current.version})
  invoice=await h.command('invoice.approve',{invoiceId:invoice.id,version:invoice.version});await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:100,method:'cash',reference:'synthetic-mallet-23',evidence:'Counter tender'})
  const customerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),customer=await customerContext.newPage()
  const customerShot=async(name)=>{for(const width of [1440,390]){await customer.setViewportSize({width,height:1000});assert.ok(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await customer.locator('main').screenshot({path:join(directory,name+'-'+width+'.png')})}}
  const customerLogin=async(email)=>{const before=h.messages.length;await customer.goto(h.origin+'/portal');await customer.getByLabel('Your email',{exact:true}).fill(email);await customer.getByRole('checkbox').check();await customer.getByRole('button',{name:'Send sign-in email',exact:true}).click();await customer.waitForLoadState('domcontentloaded');await customerShot('07a-signin-requested');const message=await portalMail(h,email,'Cedar Fleet',before);const url=message.text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0];await customer.goto(url);await customer.reload();assert.ok(!(await customer.locator('main').innerText()).includes(invoice.number));await customerShot('07b-confirm-customer-signin');await customer.getByRole('button',{name:'Confirm sign-in',exact:true}).click();await customer.waitForLoadState('domcontentloaded')}
  await customer.goto(h.origin+'/portal');await customerShot('07-customer-signin')
  await customerLogin(payer.email);assert.ok((await customer.locator('main').innerText()).includes(invoice.number));assert.ok((await customer.locator('main').innerText()).includes('Staff-recorded tender'));await customerShot('08-payer-billing-statement')
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
  await customerLogin(authorizer.email);assert.ok((await customer.locator('main').innerText()).includes('Billing unavailable'));await customerShot('11-authorizer-denied');await customerContext.close()
  const records=(await h.state()).records;assert.equal(records.customerMerge.length,1);assert.equal(records.asset.filter(a=>a.customerAccountId===fleet.id).length,2);assert.equal(records.customerAccount.find(a=>a.id===fleet.id).payerId,payer.id);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}

export async function refundsBrowser(){
 const h=await installation({entry:'tests/worker.ts',network:true,assets:true,secureNetwork:true});let browser
 try{
  const {account,contact}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account),replacement=await creditInvoice(h,account,'2')
  const payment=await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,amountCents:invoice.totals.totalCents,method:'cash',reference:'synthetic-mallet-140',evidence:'Original cash tender'})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_CUSTOMERS_PROOF_DIR??'.cache/customers-browser';await mkdir(directory,{recursive:true})
  const shot=async(name)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await p.locator('main').screenshot({path:join(directory,name+'-'+width+'.png')})}}
  await p.goto(h.origin+'/portal');await p.getByLabel('Your email',{exact:true}).fill(contact.email);await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Send sign-in email',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  const message=await portalMail(h,contact.email,account.name),url=message.text.match(/https?:\/\/[^\s<>]+\/portal\/confirm\/[A-Za-z0-9_-]+/)[0]
  await p.goto(url);await p.getByRole('button',{name:'Confirm sign-in',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok((await p.locator('main').innerText()).includes(invoice.number))
  const credit=await issueCredit(h,creditInput(invoice,payment,'synthetic-mallet-141'));let refund=(await h.state()).records.refund.find(r=>r.creditNoteId===credit.id)
  await p.reload();assert.ok((await p.locator('main').innerText()).includes(credit.number));assert.ok((await p.locator('main').innerText()).includes('unsubmitted'));await shot('12-payer-pending-refund')
  for(const [n,status]of ['failed','disputed','refunded'].entries()){
   refund=await h.command('refund.record',{refundId:refund.id,version:refund.version,status,reference:'synthetic-mallet-'+(142+n),evidence:'Owner recorded cash outcome '+status,confirm:'record-refund'})
   await p.reload();assert.ok((await p.locator('main').innerText()).includes(status));assert.ok((await p.locator('main').innerText()).includes('Owner recorded; not verified by Mallet'));await shot('13-payer-refund-'+status)
  }
  const held=await issueCredit(h,creditInput(invoice,null,'synthetic-mallet-145',invoice.lines[0],2));await p.reload();assert.ok((await p.locator('main').innerText()).includes(held.number));assert.ok((await p.locator('main').innerText()).includes('Customer account credit'));await shot('14-payer-account-credit')
  await h.command('credit.exchange',{creditNoteId:held.id,invoiceId:replacement.invoice.id,version:replacement.invoice.version,amountCents:held.totals.totalCents,reference:'synthetic-mallet-146',reason:'Customer selected the separately authorized replacement accessory',confirm:'apply-credit'})
  await p.reload();const text=await p.locator('main').innerText();assert.ok(text.includes('Outstanding balance $3.24'));assert.ok(text.includes('Customer credit allocation; no new cash or processor settlement.'));assert.ok(!text.includes('Customer selected the separately authorized'));await shot('15-payer-exchange-allocation')
  assert.deepEqual(errors,[]);await context.close()
 }finally{await browser?.close();await h.close()}
}
