import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {completedInvoice} from './support/retention-journey.mjs'
import {custodyMedia} from './support/intake-journey.mjs'
import {readFile} from 'node:fs/promises'
import {shopSetup} from './support/diagnosis-journey.mjs'

export async function retentionBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  await shopSetup(h)
  const contact=await h.command('contact.save',{name:'Dana Brooks',email:'dana@example.test',phone:'2165550147',communication:'email',notes:''})
  const account=await h.command('customer.save',{name:'Dana Brooks',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''})
  let asset=await h.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V EX',identifier:'OH-4471'})
  asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Dana confirmed her vehicle and customer account'})
  const first=await completedInvoice(h,asset,'2026-10-01T08:00:00Z','2026-10-01T09:00:00Z')
  const second=await completedInvoice(h,(await h.state()).records.asset.find(a=>a.id===asset.id),'2026-10-02T08:00:00Z','2026-10-02T09:00:00Z')
  const bytes=await readFile('tests/fixtures/dvi/front-brake.png'),photo=await custodyMedia(h,first.job,bytes,'front-brake.png','image/png','Front brake before repair'),heldPhoto=await custodyMedia(h,second.job,bytes,'follow-up.png','image/png','Follow-up brake condition')
  await h.stepUp()
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message))
  const dir=process.env.MALLET_RETENTION_PROOF_DIR??'.cache/retention-browser';await mkdir(dir,{recursive:true})
  const shot=async(name,target=p.locator('main'))=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png')})}}
  const command=name=>p.locator(`form:has(input[name="command"][value="${name}"])`)
  await p.goto(h.origin+'/app/data');await shot('retention-01-data-access',p.getByRole('link',{name:'Open retention & erasure'}));await p.getByRole('link',{name:'Open retention & erasure'}).click();await p.waitForLoadState('domcontentloaded');await shot('retention-01-opened');assert.equal((await h.request('/app/retention')).status,200,await p.locator('main').innerText())
  await p.getByLabel('Customer account').selectOption(account.id);await p.getByRole('button',{name:'Open customer retention'}).click();await p.waitForLoadState('domcontentloaded')
  let hold=command('retention.hold');await hold.getByLabel('Hold scope').selectOption('financial');await hold.getByLabel('Hold reference').fill('FIN-2026-104');await hold.getByLabel('Hold reason').fill('Preserve the issued invoice and signed authorization during finance review');await shot('retention-02-financial-hold',hold);await hold.getByRole('button',{name:'Place hold'}).click();await p.waitForLoadState('domcontentloaded')
  hold=command('retention.hold');await hold.getByLabel('Hold scope').selectOption('media');await hold.getByLabel('Repair scope').selectOption(second.job.id);await hold.getByLabel('Hold reference').fill('FOLLOW-UP-22');await hold.getByLabel('Hold reason').fill('Customer requested this follow-up photo be retained for review');await hold.getByRole('button',{name:'Place hold'}).click();await p.waitForLoadState('domcontentloaded');await shot('retention-03-explicit-holds',p.getByRole('heading',{name:'Explicit holds'}).locator('..'))
  const preview=command('retention.preview');await preview.getByRole('button',{name:'Preview eligible data'}).click();await p.waitForLoadState('domcontentloaded');await shot('retention-04-review-candidates',p.getByRole('heading',{name:'Review exact deletion candidates'}).locator('..'))
  let erase=command('customer.erase');await erase.getByLabel('Reason for this action').fill('Customer requested removal of eligible inspection media');await erase.getByLabel('Customer request or retention approval evidence').fill('Dana confirmed at the counter; retain the follow-up photo under its hold');await erase.getByRole('checkbox').check();await erase.getByLabel('Type ERASE',{exact:true}).fill('ERASE');await erase.getByRole('button',{name:'Confirm reviewed action'}).click();await p.waitForLoadState('domcontentloaded');await shot('retention-05-erasure-receipt',p.getByRole('heading',{name:'Retention receipt'}).locator('..'))
  assert.equal((await h.request(photo.contentUrl)).status,404);const heldResponse=await h.request(heldPhoto.contentUrl);assert.equal(heldResponse.status,200);assert.deepEqual(Buffer.from(await heldResponse.arrayBuffer()),bytes)
  assert.equal(await(await h.request('/api/mallet/exports/'+first.exported.id)).text(),first.csv)
  const policy=command('retention.policy');await policy.getByLabel('Media retention (days; blank keeps forever)').fill('0');await policy.getByLabel('Policy reason').fill('Owner-approved manual cleanup of completed repair media after holds are released');await policy.getByRole('checkbox').check();await policy.getByRole('button',{name:'Save manual policy'}).click();await p.waitForLoadState('domcontentloaded');await shot('retention-06-manual-policy',command('retention.policy'))
  const release=p.locator('li').filter({has:p.getByRole('heading',{name:'Inspection media · active',exact:true})}).locator('form')
  await release.getByLabel('Reason for release').fill('Customer and owner completed follow-up review');await release.getByRole('checkbox').check();await release.getByRole('button',{name:'Release hold'}).click();await p.waitForLoadState('domcontentloaded');await shot('retention-07-released-hold',p.getByRole('heading',{name:'Explicit holds'}).locator('..'))
  await command('retention.preview').getByLabel('Action').selectOption('retention');await command('retention.preview').getByRole('button',{name:'Preview eligible data'}).click();await p.waitForLoadState('domcontentloaded')
  const run=command('retention.run');await run.getByLabel('Reason for this action').fill('Apply the reviewed manual media policy after hold release');await run.getByLabel('Customer request or retention approval evidence').fill('Owner approved this exact post-review cleanup');await run.getByRole('checkbox').check();await run.getByLabel('Type RUN RETENTION',{exact:true}).fill('RUN RETENTION');await run.getByRole('button',{name:'Confirm reviewed action'}).click();await p.waitForLoadState('domcontentloaded');await shot('retention-08-retention-receipt',p.getByRole('heading',{name:'Retention receipt'}).locator('..'))
  assert.equal((await h.request(heldPhoto.contentUrl)).status,404);assert.equal((await h.state()).records.retentionReceipt.filter(r=>r.phase==='complete').length,2)
  const download=await Promise.all([p.waitForEvent('download'),command('customer.export').getByRole('button',{name:'Download private customer data'}).click()]);assert.equal(download[0].suggestedFilename(),'customer-data.json')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
