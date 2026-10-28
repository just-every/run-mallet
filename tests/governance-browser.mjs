import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking,archive,restore} from './harness.mjs'
import {creditAccountFixture,creditInvoice} from './support/refunds-journey.mjs'
import {grantInput,mediaAuditJourney,auditCsvEntries} from './support/governance-journey.mjs'
const cookies=(h,cookie)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin}))
export async function governanceBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true}),p=await context.newPage(),dir=process.env.MALLET_GOVERNANCE_PROOF_DIR??'.cache/governance-browser';await mkdir(dir,{recursive:true})
  p.setDefaultTimeout(8000);await p.setViewportSize({width:1440,height:1000})
  const use=async cookie=>{await context.clearCookies();await context.addCookies(cookies(h,cookie))}
  const shot=async name=>{const original=p.viewportSize();for(const width of [1440,390]){
   await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
   // Every interactive control on these screens has visible words; no unlabelled icon-only control is introduced.
   const empty=await p.locator('button,a[href]').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&!n.textContent.trim()&&!n.getAttribute('aria-label')).length);assert.equal(empty,0,name+' controls have names')
   await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})
  }await p.setViewportSize(original)}
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
  const purchase=await purchaserBrowser(h,p,{use,shot,person:people.purchaser,item,bin,job})
  const {account}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account,'7');await h.stepUp(people.cashier.cookie)
  await use(people.cashier.cookie);await p.goto(h.origin+'/app/staff');await p.locator('select[name="staffInvoice"]').selectOption({label:invoice.number});await p.getByLabel('Amount (USD)').fill('5.41');await p.getByLabel('Tender reference').fill('synthetic-mallet-browser-tender');await p.getByLabel('Staff evidence').fill('Cash counted by cashier');await shot('staff-06-cashier-tender');await p.getByRole('button',{name:'Record tender'}).click();await p.waitForURL('**/app/staff');assert.equal((await h.state()).records.payment.at(-1).by.staffRole,'cashier')
  await use(people.accountant.cookie);await p.goto(h.origin+'/app/staff');await shot('staff-07-accountant-read');const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download permitted records'}).click()]);assert.equal(download.suggestedFilename(),'mallet-staff.json');await download.cancel();assert.equal(await p.getByRole('button').count(),0)
  await use(h.owner);await p.goto(h.origin+'/app/audit');await shot('audit-01-history');await p.getByLabel('Exact action').fill('estimate.prepare');await p.getByRole('button',{name:'Search audit'}).click();await p.locator('summary').first().click();await shot('audit-02-filtered-revisions');assert.match(await p.locator('main').innerText(),/advisor/)
  for(const format of ['JSON','CSV']){const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download '+format+' page'}).click()]);assert.equal(file.suggestedFilename(),'mallet-audit.'+format.toLowerCase());await file.cancel()}
  await h.command('staff.revoke',grantInput(people.advisor.id,'advisor',1));await use(people.advisor.cookie);const denied=await p.goto(h.origin+'/app/staff');assert.equal(denied.status(),403);await shot('staff-08-revoked')
  const media=await mediaAuditJourney(h)
  const mediaScreen=async(target,name)=>{
   await context.clearCookies();await context.addCookies(cookies(target,target.owner))
   const auditUrl=target.origin+'/app/audit?'+new URLSearchParams({q:media.finding.id,actor:media.actorId})
   await p.goto(auditUrl)
   if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('7.5');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup'}).click();await p.waitForURL('**/app');await p.goto(auditUrl)}
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000})
    for(const detail of await p.locator('details').all())if(!await detail.evaluate(node=>node.open))await detail.locator('summary').click()
    const text=await p.locator('main').innerText()
    for(const action of ['media.finding.created','media.finding.carried','media.finding.resolved','media.upload.created','media.chunk.received','media.upload.completed'])assert.ok(text.includes(action),action+' is visible at '+width)
    assert.ok(text.includes(media.finding.id));assert.ok(text.includes(media.upload.id));assert.match(text,/1 → 2/)
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
    const empty=await p.locator('button,a[href]').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&!n.textContent.trim()&&!n.getAttribute('aria-label')).length);assert.equal(empty,0,name+' controls have names at '+width)
    await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})
    for(const format of ['JSON','CSV']){
     const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download '+format+' page'}).click()])
     assert.equal(file.suggestedFilename(),'mallet-audit.'+format.toLowerCase())
     const content=await readFile(await file.path(),'utf8')
     if(format==='JSON')assert.deepEqual(JSON.parse(content).entries,media.entries)
     else assert.deepEqual(auditCsvEntries(content),media.entries.map(({version,...entry})=>entry))
     await file.delete()
    }
   }
  }
  await mediaScreen(h,'audit-03-media-transitions')
  const backup=await archive(h),fresh=await installation({network:true,secureNetwork:true,assets:true,bindings:{OWNER_EMAIL:'synthetic-mallet-browser-recovery@example.test'}})
  try{const retained=(await h.state()).records;await restore(fresh,backup);for(const kind of ['purchaseOrder','purchaseReceipt','purchaseBill','stockReservation','stockMovement'])assert.deepEqual((await fresh.state()).records[kind],retained[kind],'Fresh owner recovers '+kind);await fresh.api('/api/mallet/staff/state?download=1',undefined,{as:people.purchaser.cookie,status:401});await fresh.command('purchase.receive',purchase.captured,{as:people.purchaser.cookie,status:401});assert.equal(await (await fresh.mf.getD1Database('DB')).prepare('SELECT count(*) AS n FROM mallet_staff_grants').first('n'),0);await fresh.api('/api/mallet/audit',undefined,{as:h.owner,status:401});await mediaScreen(fresh,'audit-04-fresh-owner-media')}finally{await fresh.close()}

 }finally{await browser?.close();await h.close()}
}

async function purchaserBrowser(h,p,{use,shot,person,item,bin,job}){
 await p.setViewportSize({width:1440,height:1000})
 assert.equal(await p.getByRole('button',{name:'Prepare two-line PO'}).count(),0,'Purchasing forms require a separate cost right')
 const second=await h.command('stock.item',{sku:'synthetic-mallet-staff-second',name:'Receiving filter',unit:'each',barcode:'synthetic-mallet-staff-second'})
 await h.command('staff.grant',grantInput(person.id,'purchaser',1,{costRight:true}))
 await p.goto(h.origin+'/app/staff')
 const form=c=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+c+'"]')})
 const fill=async(c,fields,button)=>{const target=form(c);for(const [name,value]of Object.entries(fields)){const el=target.locator('[name="'+name+'"]');if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
 const input={reference:'synthetic-mallet-delegated-po',supplier:'Synthetic supplier',shipTo:'Receiving counter',expectedAt:'2026-11-05T09:00:00Z',item0:item.id,quantity0:2,cost0:2,job0:job.id,item1:second.id,quantity1:4,cost1:1,taxUsd:1,freightUsd:1}
 await shot('staff-purchase-01-form')
 let before=(await h.state()).records
 await fill('purchase.create',{...input,cost0:2.01},'Prepare two-line PO')
 assert.match(await p.locator('main').innerText(),/exceeds your delegated spend limit/);assert.deepEqual((await h.state()).records,before)
 await p.goto(h.origin+'/app/staff');await fill('purchase.create',input,'Prepare two-line PO')
 let po=(await h.state()).records.purchaseOrder.find(r=>r.reference===input.reference)
 assert.equal(po.totalCents,1000);assert.equal(po.by.staffRole,'purchaser')
 await fill('purchase.approve',{reason:'Exact spend within the owner grant'},'Approve spend')
 po=(await h.state()).records.purchaseOrder.find(r=>r.id===po.id);assert.equal(po.approval.totalCents,1000);assert.equal(po.approval.by.id,person.id)
 const section=()=>p.locator('#po-'+po.id)
 const receive=async(line,part,quantity,reference)=>{await section().getByText('Receive goods',{exact:true}).click();await fill('purchase.receive',{lineId:po.lines[line].id,itemBarcode:part.barcode,binBarcode:bin.barcode,quantity,reference},'Receive PO goods')}
 await receive(0,item,1,'synthetic-mallet-delegated-receipt-1')
 let text=await section().innerText();assert.ok(text.includes('Received 1 · Backorder 1'));assert.ok(text.includes('Reserved on receipt for waiting repair'));assert.equal(await section().locator('a[href^="/app/jobs/"]').count(),0)
 let view=await h.api('/api/mallet/staff/state',undefined,{as:person.cookie})
 assert.equal(view.records.stockReservation.find(r=>r.source.purchaseId===po.id).quantityMilli,1000)
 assert.equal(view.records.stockMovement.filter(r=>r.source.purchaseId===po.id).reduce((n,r)=>n+r.deltaMilli,0),1000)
 await shot('staff-purchase-02-partial-receipt')
 await section().getByText('Record supplier bill',{exact:true}).click()
 before=(await h.state()).records
 await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-delegated-bill',billQuantity0:2,billCost0:2.01,billQuantity1:4,billCost1:1,evidence:'Owner retains the supplier original'},'Match supplier bill')
 assert.match(await p.locator('main').innerText(),/exceeds your delegated spend limit/);assert.deepEqual((await h.state()).records,before,'Over-limit supplier bill cannot change any records')
 await p.goto(h.origin+'/app/staff');await section().getByText('Record supplier bill',{exact:true}).click()
 await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-delegated-bill',billQuantity0:2,billCost0:1.99,billQuantity1:4,billCost1:1,evidence:'Owner retains the supplier original'},'Match supplier bill')
 text=await section().innerText();assert.ok(text.includes('Exception'));assert.ok(text.includes('unit cost differs'));assert.ok(text.includes('quantities differ'))
 await shot('staff-purchase-03-bill-exception')
 before=(await h.state()).records
 await fill('purchase.close',{reason:'Unreceived goods and exceptions must refuse'},'Close matched PO')
 assert.match(await p.locator('main').innerText(),/Outstanding backorders/);assert.deepEqual((await h.state()).records,before)
 await p.goto(h.origin+'/app/staff')
 // Capture a real native receive form, then prove that its old revision cannot replay a physical receipt.
 await section().getByText('Receive goods',{exact:true}).click()
 const receiveForm=form('purchase.receive')
 for(const [name,value]of Object.entries({lineId:po.lines[0].id,itemBarcode:item.barcode,binBarcode:bin.barcode,quantity:'1',reference:'synthetic-mallet-delegated-receipt-2'})){const el=receiveForm.locator('[name="'+name+'"]');if(name==='lineId')await el.selectOption(value);else await el.fill(value)}
 const captured=await receiveForm.evaluate(f=>Object.fromEntries(new FormData(f)))
 await receiveForm.getByRole('button',{name:'Receive PO goods',exact:true}).click();await p.waitForLoadState('domcontentloaded')
 before=(await h.state()).records
 let response=await p.request.post(h.origin+'/app/actions',{form:captured,headers:{origin:h.origin}})
 assert.equal(response.status(),409);assert.deepEqual((await h.state()).records,before,'A stale native receipt changes no stock, reservations or audit history')
 await receive(1,second,4,'synthetic-mallet-delegated-receipt-3')
 await section().getByText('Record supplier bill',{exact:true}).click()
 await fill('purchase.bill',{invoiceNumber:'synthetic-mallet-delegated-bill',evidence:'Corrected supplier quantities and approved costs'},'Match supplier bill')
 view=await h.api('/api/mallet/staff/state',undefined,{as:person.cookie})
 assert.deepEqual(view.records.purchaseBill.filter(b=>b.purchaseId===po.id).sort((a,b)=>a.sequence-b.sequence).map(b=>[b.sequence,b.matched,b.totalCents]),[[1,false,998],[2,true,1000]])
 assert.equal(view.records.purchaseReceipt.filter(r=>r.purchaseId===po.id).reduce((n,r)=>n+r.quantityMilli,0),6000)
 assert.equal(view.records.stockReservation.filter(r=>r.source.purchaseId===po.id).reduce((n,r)=>n+r.quantityMilli,0),2000)
 const inventory=await h.api('/api/mallet/inventory')
 const balances=inventory.balances.filter(b=>b.binId===bin.id&&[item.id,second.id].includes(b.itemId))
 assert.equal(balances.find(b=>b.itemId===item.id).onHandMilli,4000);assert.equal(balances.find(b=>b.itemId===item.id).reservedMilli,2000);assert.equal(balances.find(b=>b.itemId===item.id).availableMilli,2000)
 assert.equal(balances.find(b=>b.itemId===second.id).onHandMilli,4000)
 text=await section().innerText();assert.ok(text.includes('Exception'));assert.ok(text.includes('Matched'));assert.ok(!text.includes('undefined'));await shot('staff-purchase-04-matched-history')
 const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download permitted records'}).click()])
 assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')),view);await download.delete();assert.ok(!JSON.stringify(view).includes('Owner retains the supplier original'))
 await fill('purchase.close',{reason:'Physical goods and corrected bill reconcile'},'Close matched PO')
 assert.equal((await h.state()).records.purchaseOrder.find(r=>r.id===po.id).status,'closed');assert.equal(await form('purchase.receive').count(),0)
 await shot('staff-purchase-05-closed')
 // Revocation applies to both a captured form and the equivalent direct command.
 await h.command('staff.revoke',grantInput(person.id,'purchaser',2))
 before=(await h.state()).records
 response=await p.request.post(h.origin+'/app/actions',{form:captured,headers:{origin:h.origin}})
 assert.equal(response.status(),403)
 await h.command('purchase.receive',{purchaseId:po.id,version:po.version,lineId:po.lines[0].id,itemBarcode:item.barcode,binBarcode:bin.barcode,quantity:1,reference:'synthetic-mallet-revoked-receipt'},{as:person.cookie,status:403})
 for(const path of ['/app/staff','/api/mallet/staff/state?download=1'])assert.equal((await h.request(path,{as:person.cookie})).status,403)
 assert.deepEqual((await h.state()).records,before,'Revoked forms, commands and downloads grant no authority')
 const denied=await p.goto(h.origin+'/app/staff');assert.equal(denied.status(),403);await shot('staff-purchase-06-revoked')
 await h.command('staff.grant',grantInput(person.id,'purchaser',3,{costRight:false}))
 await p.goto(h.origin+'/app/staff');assert.equal(await form('purchase.create').count(),0)
 const hidden=await h.api('/api/mallet/staff/state',undefined,{as:person.cookie});assert.equal(hidden.records.purchaseBill,undefined);assert.equal(hidden.records.purchaseOrder,undefined)
 const privateResponse=await h.request('/api/mallet/staff/state?download=1',{as:person.cookie});assert.deepEqual(await privateResponse.json(),hidden)
 const retained=(await h.state()).records;await h.command('purchase.bill',{purchaseId:po.id,version:po.version},{as:person.cookie,status:403});assert.deepEqual((await h.state()).records,retained)
 return {captured}
}
