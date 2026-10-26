import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking} from './harness.mjs'
import {creditAccountFixture,creditInvoice} from './support/refunds-journey.mjs'
import {grantInput} from './support/governance-journey.mjs'
const cookies=(h,cookie)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin}))
export async function governanceBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true}),p=await context.newPage(),dir=process.env.MALLET_GOVERNANCE_PROOF_DIR??'.cache/governance-browser';await mkdir(dir,{recursive:true})
  p.setDefaultTimeout(8000)
  const use=async cookie=>{await context.clearCookies();await context.addCookies(cookies(h,cookie))}
  const shot=async name=>{for(const width of [1440,390]){
   await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
   // Every interactive control on these screens has visible words; no unlabelled icon-only control is introduced.
   const empty=await p.locator('button,a[href]').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&!n.textContent.trim()&&!n.getAttribute('aria-label')).length);assert.equal(empty,0,name+' controls have names')
   await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})
  }}
  await use(h.owner);await p.goto(h.origin+'/setup');await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('7.5');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup'}).click();await p.waitForURL('**/app')
  const people={};for(const role of ['advisor','manager','purchaser','cashier','accountant'])people[role]=await h.person('synthetic-mallet-browser-'+role+'@example.test')
  await h.stepUp();await p.goto(h.origin+'/app/data');await p.getByRole('link',{name:'Staff roles and limits'}).click();await shot('staff-01-owner-settings')
  const grant=p.locator('section.card').filter({has:p.getByRole('heading',{name:'synthetic-mallet-browser-advisor',exact:true})}).locator('form').first()
  await grant.locator('select[name="role"]').selectOption('advisor');await grant.getByLabel('Discount limit (%)').fill('5');await grant.getByLabel('Delegation reason').fill('Owner approved advisor responsibilities');await grant.getByLabel('I approve these exact rights and limits.').check();await grant.getByRole('button',{name:'Save staff grant'}).click();await p.waitForURL('**/app/staff-access')
  for(const role of ['manager','purchaser','cashier','accountant'])await h.command('staff.grant',grantInput(people[role].id,role))
  const {job}=await booking(h),item=await h.command('stock.item',{sku:'synthetic-mallet-browser',name:'Browser part',unit:'each',barcode:'synthetic-mallet-browser-item'}),bin=await h.command('stock.bin',{code:'Browser bin',barcode:'synthetic-mallet-browser-bin'})
  await use(people.advisor.cookie);await p.goto(h.origin+'/app');await p.waitForURL('**/app/staff');await shot('staff-02-advisor')
  const fill=async discount=>{await p.locator('select[name="staffJob"]').selectOption({label:job.title});await p.getByLabel('Part description',{exact:true}).fill('Discounted repair part');await p.getByLabel('Part price in USD',{exact:true}).fill('10');await p.getByLabel('Part discount in USD',{exact:true}).fill(discount);await p.getByLabel('Labor description',{exact:true}).fill('Repair labor');await p.getByLabel('Labor price in USD',{exact:true}).fill('1')}
  await fill('0.51');const before=(await h.state()).records;await p.getByRole('button',{name:'Prepare estimate',exact:true}).click();assert.match(await p.locator('main').innerText(),/could not be completed/);assert.deepEqual((await h.state()).records,before);await shot('staff-03-discount-refused')
  await p.goto(h.origin+'/app/staff');await fill('0.50');await p.getByRole('button',{name:'Prepare estimate',exact:true}).click();await p.waitForURL('**/app/staff');const quote=(await h.state()).records.estimate.find(q=>q.jobId===job.id);assert.equal(quote.revisions[0].preparedBy.staffRole,'advisor')
  await use(people.manager.cookie);await p.goto(h.origin+'/app/staff');await shot('staff-04-manager-handoff');await p.getByRole('button',{name:'Approve exact estimate'}).click();await p.waitForURL('**/app/staff');assert.equal((await h.state()).records.estimate.find(q=>q.id===quote.id).status,'approved')
  await use(people.purchaser.cookie);await p.goto(h.origin+'/app/staff');await p.getByLabel('Scanned item barcode').fill(item.barcode);await p.getByLabel('Scanned bin barcode').fill(bin.barcode);await p.getByLabel('Counted quantity').fill('2');await p.getByLabel('Count reason',{exact:true}).fill('Physical count');await p.getByRole('button',{name:'Record stock count'}).click();await p.waitForURL('**/app/staff');await p.getByLabel('Correction reason').fill('Reviewed count');await shot('staff-05-purchaser-correction');await p.getByRole('button',{name:'Approve correction'}).click();await p.waitForURL('**/app/staff');assert.ok((await h.state()).records.stockCount[0].approval)
  const {account}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account,'7');await h.stepUp(people.cashier.cookie)
  await use(people.cashier.cookie);await p.goto(h.origin+'/app/staff');await p.locator('select[name="staffInvoice"]').selectOption({label:invoice.number});await p.getByLabel('Amount (USD)').fill('5.41');await p.getByLabel('Tender reference').fill('synthetic-mallet-browser-tender');await p.getByLabel('Staff evidence').fill('Cash counted by cashier');await shot('staff-06-cashier-tender');await p.getByRole('button',{name:'Record tender'}).click();await p.waitForURL('**/app/staff');assert.equal((await h.state()).records.payment.at(-1).by.staffRole,'cashier')
  await use(people.accountant.cookie);await p.goto(h.origin+'/app/staff');await shot('staff-07-accountant-read');const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download permitted records'}).click()]);assert.equal(download.suggestedFilename(),'mallet-staff.json');await download.cancel();assert.equal(await p.getByRole('button').count(),0)
  await use(h.owner);await p.goto(h.origin+'/app/audit');await shot('audit-01-history');await p.getByLabel('Exact action').fill('estimate.prepare');await p.getByRole('button',{name:'Search audit'}).click();await p.locator('summary').first().click();await shot('audit-02-filtered-revisions');assert.match(await p.locator('main').innerText(),/advisor/)
  for(const format of ['JSON','CSV']){const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download '+format+' page'}).click()]);assert.equal(file.suggestedFilename(),'mallet-audit.'+format.toLowerCase());await file.cancel()}
  await h.command('staff.revoke',grantInput(people.advisor.id,'advisor',1));await use(people.advisor.cookie);const denied=await p.goto(h.origin+'/app/staff');assert.equal(denied.status(),403);await shot('staff-08-revoked')
 }finally{await browser?.close();await h.close()}
}
