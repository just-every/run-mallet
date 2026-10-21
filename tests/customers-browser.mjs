import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,assetInput} from './harness.mjs'
export async function customersBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
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
  for(const [account,asset]of [[fleet,assetA],[duplicate,assetB]]){const card=section(account.id);await card.locator('summary').filter({hasText:/^Link a vehicle$/}).click();await fill(card.locator('form:has(input[value="customer.linkAsset"])'),{assetSource:JSON.stringify({id:asset.id,version:asset.version}),driverId:driver.id,reason:'Owner checked customer request'},'Link vehicle')}
  await shot('03-linked-fleet-vehicle',section(fleet.id));await fill(section(fleet.id).locator('form:has(input[value="customer.driver"])'),{driverId:authorizer.id,reason:'Fleet assigned replacement driver'},'Change driver')
  assert.ok((await section(fleet.id).innerText()).includes('Driver Ari Authorizer'));await shot('04-driver-change',section(fleet.id))
  const merge=form('customer.merge','Merge duplicate');await fill(merge,{sourceRef:duplicate.id+'@'+duplicate.version,targetRef:fleet.id+'@'+fleet.version,reason:'Customer confirmed duplicate',consentEvidence:'Explicit signed instruction synthetic-mallet-20'},'Merge duplicate')
  assert.equal(await section(duplicate.id).count(),0);assert.ok((await section(fleet.id).innerText()).includes('OH-CEDAR-18'))
  await section(fleet.id).locator('summary').filter({hasText:/^Source and merge history$/}).click();await shot('05-duplicate-source-history',section(fleet.id))
  for(const query of ['Cedar','6145550101','OH-CEDAR-18']){await p.getByLabel('Search accounts by name, phone or plate',{exact:true}).fill(query);await p.getByRole('button',{name:'Search accounts',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok(await section(fleet.id).count());await shot('06-search-'+query)}
  const records=(await h.state()).records;assert.equal(records.customerMerge.length,1);assert.equal(records.asset.filter(a=>a.customerAccountId===fleet.id).length,2);assert.equal(records.customerAccount.find(a=>a.id===fleet.id).payerId,payer.id);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
