import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking,archive,restore} from './harness.mjs'
import {creditAccountFixture,creditInvoice} from './support/refunds-journey.mjs'
import {grantInput,mediaAuditJourney,auditCsvEntries,payrollFixture} from './support/governance-journey.mjs'
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
  for(const role of ['manager','purchaser','cashier','accountant'])await h.command('staff.grant',grantInput(people[role].id,role,0,role==='cashier'?{collectionCents:500}:{}))
  const {job}=await booking(h),item=await h.command('stock.item',{sku:'synthetic-mallet-browser',name:'Browser part',unit:'each',barcode:'synthetic-mallet-browser-item'}),bin=await h.command('stock.bin',{code:'Browser bin',barcode:'synthetic-mallet-browser-bin'})
  await use(people.advisor.cookie);await p.goto(h.origin+'/app');await p.waitForURL('**/app/staff');await shot('staff-02-advisor')
  await advisorIntakeBrowser(h,p,{shot,person:people.advisor,technician:people.manager})
  const fill=async discount=>{await p.locator('select[name="staffJob"]').selectOption({label:job.title});await p.getByLabel('Part description',{exact:true}).fill('Discounted repair part');await p.getByLabel('Part price in USD',{exact:true}).fill('10');await p.getByLabel('Part discount in USD',{exact:true}).fill(discount);await p.getByLabel('Labor description',{exact:true}).fill('Repair labor');await p.getByLabel('Labor price in USD',{exact:true}).fill('1')}
  await fill('0.51');const before=(await h.state()).records;await p.getByRole('button',{name:'Prepare estimate',exact:true}).click();assert.match(await p.locator('main').innerText(),/could not be completed/);assert.deepEqual((await h.state()).records,before);await shot('staff-03-discount-refused')
  await p.goto(h.origin+'/app/staff');await fill('0.50');await p.getByRole('button',{name:'Prepare estimate',exact:true}).click();await p.waitForURL('**/app/staff');const quote=(await h.state()).records.estimate.find(q=>q.jobId===job.id);assert.equal(quote.revisions[0].preparedBy.staffRole,'advisor')
  await use(people.manager.cookie);await p.goto(h.origin+'/app/staff');await shot('staff-04-manager-handoff');await p.getByRole('button',{name:'Approve exact estimate'}).click();await p.waitForURL('**/app/staff');assert.equal((await h.state()).records.estimate.find(q=>q.id===quote.id).status,'approved')
  await advisorCommunicationBrowser(h,p,{use,shot,person:people.advisor,quote})
  await use(people.purchaser.cookie);await p.goto(h.origin+'/app/staff');await p.getByLabel('Scanned item barcode').fill(item.barcode);await p.getByLabel('Scanned bin barcode').fill(bin.barcode);await p.getByLabel('Counted quantity').fill('2');await p.getByLabel('Count reason',{exact:true}).fill('Physical count');await p.getByRole('button',{name:'Record stock count'}).click();await p.waitForURL('**/app/staff');await p.getByLabel('Correction reason').fill('Reviewed count');await shot('staff-05-purchaser-correction');await p.getByRole('button',{name:'Approve correction'}).click();await p.waitForURL('**/app/staff');assert.ok((await h.state()).records.stockCount[0].approval)
  const purchase=await purchaserBrowser(h,p,{use,shot,person:people.purchaser,item,bin,job})
  const {account}=await creditAccountFixture(h),{invoice}=await creditInvoice(h,account,'7');await h.stepUp(people.cashier.cookie)
  await use(people.cashier.cookie);await p.goto(h.origin+'/app/staff');await p.locator('select[name="staffInvoice"]').selectOption({label:invoice.number});await p.getByLabel('Amount (USD)').fill('5.41');await p.getByLabel('Tender reference').fill('synthetic-mallet-browser-tender');await p.getByLabel('Staff evidence').fill('Cash counted by cashier');await shot('staff-06-cashier-tender');const tenderBefore=(await h.state()).records;await p.getByRole('button',{name:'Record tender'}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/exceeds your delegated collection limit/);assert.deepEqual((await h.state()).records,tenderBefore);await shot('staff-finance-00-collection-refused');await h.command('staff.grant',grantInput(people.cashier.id,'cashier',1,{collectionCents:541}));await p.goto(h.origin+'/app/staff');await p.locator('select[name="staffInvoice"]').selectOption({label:invoice.number});await p.getByLabel('Amount (USD)').fill('5.41');await p.getByLabel('Tender reference').fill('synthetic-mallet-browser-tender');await p.getByLabel('Staff evidence').fill('Cash counted by cashier');await p.getByRole('button',{name:'Record tender'}).click();await p.waitForURL('**/app/staff');assert.equal((await h.state()).records.payment.at(-1).by.staffRole,'cashier')
  await cashierFinanceBrowser(h,p,{use,shot,person:people.cashier,invoice})
  await use(people.accountant.cookie);await p.goto(h.origin+'/app/staff');await shot('staff-07-accountant-read');const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download permitted records'}).click()]);assert.equal(download.suggestedFilename(),'mallet-staff.json');await download.cancel();assert.equal(await p.getByRole('button').count(),0)
  await p.locator('#finance-'+invoice.id+' summary').click();const financeText=await p.locator('#finance-'+invoice.id).innerText();assert.ok(financeText.includes('$1.09'));assert.ok(financeText.includes('$4.32'));assert.ok(financeText.includes('Staff-recorded manual refund'));await shot('staff-finance-05-accountant-reconciliation')
  const report=await h.api('/api/mallet/staff/finance',undefined,{as:people.accountant.cookie});assert.deepEqual(report.invoices.find(i=>i.invoiceId===invoice.id).refunds[0].history.map(r=>r.status),['refunded'])
  for(const format of ['JSON','CSV']){const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download reconciliation '+format}).click()]);const content=await readFile(await file.path(),'utf8');assert.equal(file.suggestedFilename(),'mallet-reconciliation.'+format.toLowerCase());if(format==='JSON')assert.deepEqual(JSON.parse(content),report);else assert.ok(content.includes('541","109","432","541","109","0","432","0","0","0'));await file.delete()}
  await accountantPayrollBrowser(h,p,{use,shot,person:people.accountant})
  await h.command('staff.revoke',grantInput(people.accountant.id,'accountant',3));const financeDenied=await p.request.get(h.origin+'/api/mallet/staff/finance?format=csv');assert.equal(financeDenied.status(),403)
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
  const backup=await archive(h),fresh=await installation({network:true,secureNetwork:true,assets:true,bindings:{OWNER_EMAIL:['synthetic-mallet-browser-recovery','example.test'].join('@')}})
  try{const retained=(await h.state()).records;await restore(fresh,backup);for(const kind of ['purchaseOrder','purchaseReceipt','purchaseBill','stockReservation','stockMovement','invoice','payment','creditNote','refund','payRate','timeEntry','timeCorrection'])assert.deepEqual((await fresh.state()).records[kind],retained[kind],'Fresh owner recovers '+kind);await fresh.api('/api/mallet/staff/state?download=1',undefined,{as:people.purchaser.cookie,status:401});await fresh.command('purchase.receive',purchase.captured,{as:people.purchaser.cookie,status:401});assert.equal(await (await fresh.mf.getD1Database('DB')).prepare('SELECT count(*) AS n FROM mallet_staff_grants').first('n'),0);await fresh.api('/api/mallet/staff/payroll?format=csv',undefined,{as:people.accountant.cookie,status:401});await fresh.api('/api/mallet/staff/finance?format=json',undefined,{as:people.cashier.cookie,status:401});await fresh.api('/api/mallet/audit',undefined,{as:h.owner,status:401});await mediaScreen(fresh,'audit-04-fresh-owner-media')}finally{await fresh.close()}

 }finally{await browser?.close();await h.close()}
}

async function purchaserBrowser(h,p,{use,shot,person,item,bin,job}){
 await p.setViewportSize({width:1440,height:1000})
 assert.equal(await p.getByRole('button',{name:'Prepare two-line PO'}).count(),0,'Purchasing forms require a separate cost right')
 const second=await h.command('stock.item',{sku:'synthetic-mallet-staff-second',name:'Receiving filter',unit:'each',barcode:'synthetic-mallet-staff-second'})
 await h.command('staff.grant',grantInput(person.id,'purchaser',1,{costRight:true}))
 const otherBin=await h.command('stock.bin',{code:'Other shop',barcode:'synthetic-mallet-browser-other-bin'})
 await h.command('stock.location',{binId:otherBin.id,version:otherBin.version,location:'other'})
 const other=await h.command('purchase.create',{reference:'synthetic-mallet-browser-other-po',supplier:'Other supplier private',shipTo:'Other shop',expectedAt:'2026-11-05T09:00:00Z',binId:otherBin.id,taxCents:0,freightCents:0,lines:[{itemId:item.id,quantity:1,unitCents:100}]})
 await p.goto(h.origin+'/app/staff')
 assert.ok(!(await p.locator('main').innerText()).includes(other.reference),'Native purchaser page excludes the other shop PO')
 const form=c=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+c+'"]')})
 const fill=async(c,fields,button)=>{const target=form(c);for(const [name,value]of Object.entries(fields)){const el=target.locator('[name="'+name+'"]');if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
 const input={reference:'synthetic-mallet-delegated-po',supplier:'Synthetic supplier',shipTo:'Receiving counter',expectedAt:'2026-11-05T09:00:00Z',item0:item.id,quantity0:2,cost0:2,job0:job.id,item1:second.id,quantity1:4,cost1:1,taxUsd:1,freightUsd:1}
 let outside=(await h.state()).records
 const otherResponse=await p.request.post(h.origin+'/app/actions',{form:{command:'purchase.approve',purchaseId:other.id,version:String(other.version),reason:'Other location cannot be approved'},headers:{origin:h.origin}})
 assert.equal(otherResponse.status(),403)
 await h.command('purchase.approve',{purchaseId:other.id,version:other.version,reason:'Other location cannot be approved'},{as:person.cookie,status:403})
 assert.deepEqual((await h.state()).records,outside)
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
 assert.ok((await p.locator('main').innerText()).includes('On hand 3 · Reserved 1 · Available 2'),'Purchaser sees physical and reserved stock after partial receiving')
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
 assert.ok((await p.locator('main').innerText()).includes('On hand 4 · Reserved 2 · Available 2'),'Purchaser sees reconciled physical and reserved stock')
 assert.equal(view.stockBalances.find(b=>b.itemId===item.id&&b.binId===bin.id).reservedMilli,2000)
 text=await section().innerText();assert.ok(text.includes('Exception'));assert.ok(text.includes('Matched'));assert.ok(!text.includes('undefined'));await shot('staff-purchase-04-matched-history')
 const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download permitted records'}).click()])
 assert.deepEqual(JSON.parse(await readFile(await download.path(),'utf8')),view);assert.ok(!JSON.stringify(view).includes(other.id));assert.ok(!JSON.stringify(view).includes(otherBin.id));await download.delete();assert.ok(!JSON.stringify(view).includes('Owner retains the supplier original'))
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

async function cashierFinanceBrowser(h,p,{use,shot,person,invoice}){
 const form=command=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+command+'"]')})
 const source=()=>form('credit.preview').filter({has:p.locator('input[name="invoiceId"][value="'+invoice.id+'"]')})
 const request=async quantity=>{
  await p.goto(h.origin+'/app/staff')
  await source().locator('..').locator('summary').click()
  await source().getByLabel('Return quantity',{exact:true}).fill(String(quantity))
  await source().getByLabel('Unique credit reference',{exact:true}).fill('synthetic-mallet-native-credit')
  await source().getByLabel('Return reason',{exact:true}).fill('Customer returned original accessory')
  await source().getByLabel('Customer credit instruction',{exact:true}).fill('Private customer request to return original cash')
  await source().getByRole('button',{name:'Preview staff credit',exact:true}).click();await p.waitForLoadState('domcontentloaded')
 }
 let before=(await h.state()).records
 await request(2);assert.match(await p.locator('main').innerText(),/exceeds your delegated refund limit/);assert.deepEqual((await h.state()).records,before,'Over-limit native credit is refused without writes');await shot('staff-finance-01-limit-refused')
 await request(1);assert.ok((await p.locator('main').innerText()).includes('$1.09'));assert.ok((await p.locator('main').innerText()).includes('original-tender'));assert.deepEqual((await h.state()).records,before,'Preview changes no finance records')
 await form('credit.issue').getByLabel('I approve this exact credit and original destination.').check()
 const captured=await form('credit.issue').evaluate(f=>Object.fromEntries(new FormData(f)))
 await h.command('stock.bin',{code:'Native stale credit fence',barcode:'synthetic-mallet-stale-credit'})
 before=(await h.state()).records
 const stale=await p.request.post(h.origin+'/app/actions',{form:captured,headers:{origin:h.origin}});assert.equal(stale.status(),409);assert.deepEqual((await h.state()).records,before,'A changed state invalidates the exact native review')
 await request(1);await shot('staff-finance-02-exact-review')
 await form('credit.issue').getByLabel('I approve this exact credit and original destination.').check();await form('credit.issue').getByRole('button',{name:'Issue reviewed credit',exact:true}).click();await p.waitForURL('**/app/staff')
 const note=(await h.state()).records.creditNote.find(n=>n.reference==='synthetic-mallet-native-credit');assert.equal(note.totals.totalCents,109);assert.equal(note.by.staffRole,'cashier')
 let refund=(await h.state()).records.refund.find(r=>r.creditNoteId===note.id)
 await form('refund.record').locator('..').locator('summary').click();await form('refund.record').getByLabel('Refund observation reference',{exact:true}).fill('synthetic-mallet-native-refund');await form('refund.record').getByLabel('Observed original-tender evidence',{exact:true}).fill('Private staff counted original cash returned');await form('refund.record').getByLabel('I confirm this original-tender observation.').check()
 const observed=await form('refund.record').evaluate(f=>Object.fromEntries(new FormData(f)))
 await shot('staff-finance-03-original-tender-observation');await form('refund.record').getByRole('button',{name:'Record manual refund',exact:true}).click();await p.waitForURL('**/app/staff')
 refund=(await h.state()).records.refund.find(r=>r.id===refund.id);assert.equal(refund.status,'refunded');assert.equal(refund.history[0].by.id,person.id)
 before=(await h.state()).records
 const replay=await p.request.post(h.origin+'/app/actions',{form:observed,headers:{origin:h.origin},maxRedirects:0});assert.equal(replay.status(),303);assert.deepEqual((await h.state()).records,before,'Observation replay cannot record another refund')
 assert.equal(await form('refund.record').count(),0,'A completed original-tender refund offers no second payment')
 await shot('staff-finance-04-completed')
 await h.command('staff.revoke',grantInput(person.id,'cashier',2));before=(await h.state()).records
 const revoked=await p.request.post(h.origin+'/app/actions',{form:observed,headers:{origin:h.origin}});assert.equal(revoked.status(),403)
 await h.command('refund.record',{refundId:refund.id,version:refund.version,status:'refunded',reference:'synthetic-mallet-revoked-refund',evidence:'Revoked',confirm:'record-refund'},{as:person.cookie,status:403})
 assert.deepEqual((await h.state()).records,before,'A revoked form and API cannot write another observation')
 for(const format of ['json','csv'])assert.equal((await p.request.get(h.origin+'/api/mallet/staff/finance?format='+format)).status(),403)
}

async function advisorIntakeBrowser(h,p,{shot,person,technician}){
 const form=command=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+command+'"]')})
 await p.getByText('Register a customer vehicle',{exact:true}).click()
 await form('asset.create').getByLabel('Customer name',{exact:true}).fill('Native advisor customer')
 await form('asset.create').getByLabel('Vehicle',{exact:true}).fill('Native intake vehicle')
 await form('asset.create').getByLabel('Plate or VIN',{exact:true}).fill('synthetic-mallet-native-intake')
 await form('asset.create').getByRole('button',{name:'Register vehicle',exact:true}).click();await p.waitForURL('**/app/staff')
 const asset=(await h.state()).records.asset.find(a=>a.identifier==='synthetic-mallet-native-intake')
 await p.getByText('Book a repair visit',{exact:true}).click()
 assert.equal(await form('job.book').count(),1,await p.locator('main').innerText())
 await form('job.book').locator('select[name="staffAsset"]').selectOption({label:'Native intake vehicle · synthetic-mallet-native-intake'})
 await form('job.book').getByLabel('Repair request',{exact:true}).fill('Advisor native intake')
 await form('job.book').getByLabel('Repair bay',{exact:true}).fill('Native intake bay')
 await form('job.book').locator('select[name="technicianId"]').selectOption(technician.id)
 await form('job.book').getByLabel('Visit starts (with timezone)',{exact:true}).fill('2031-06-02T09:00:00Z')
 await form('job.book').getByLabel('Visit ends (with timezone)',{exact:true}).fill('2031-06-02T10:00:00Z')
 const captured=await form('job.book').evaluate(f=>Object.fromEntries(new FormData(f)))
 await shot('staff-intake-01-booking');await form('job.book').getByRole('button',{name:'Book repair visit',exact:true}).click();await p.waitForURL('**/app/staff')
 const records=(await h.state()).records,job=records.job.find(j=>j.assetId===asset.id)
 assert.equal(job.bookedBy.id,person.id);assert.equal(job.bookedBy.staffRole,'advisor');assert.equal(job.technicianId,technician.id)
 const stale=await p.request.post(h.origin+'/app/actions',{form:captured,headers:{origin:h.origin}});assert.equal(stale.status(),409);assert.deepEqual((await h.state()).records,records,'Captured intake form cannot create another visit')
 const download=await p.request.get(h.origin+'/api/mallet/staff/state?download=1'),view=await download.json();assert.ok(view.records.job.some(j=>j.id===job.id));assert.ok(view.technicians.every(t=>Object.keys(t).sort().join(',')==='id,name'))
 await shot('staff-intake-02-booked')
}

async function accountantPayrollBrowser(h,p,{use,shot,person}){
 const {tech,query}=await payrollFixture(h)
 const ownerGrant=async enabled=>{
  await use(h.owner);await h.stepUp();await p.goto(h.origin+'/app/staff-access')
  const target=p.locator('section.card').filter({has:p.getByRole('heading',{name:person.session.operator.displayName,exact:true})}).locator('form').first()
  await target.locator('input[name="payrollRight"]').setChecked(enabled)
  await target.getByLabel('Delegation reason',{exact:true}).fill(enabled?'Separate payroll read authority':'Remove payroll read authority')
  await target.getByLabel('I approve these exact rights and limits.').check()
  await shot(enabled?'staff-payroll-01-grant':'staff-payroll-03-withdraw')
  await target.getByRole('button',{name:'Save staff grant',exact:true}).click();await p.waitForURL('**/app/staff-access')
 }
 await ownerGrant(true);await use(person.cookie);await p.goto(h.origin+'/app/staff?'+query)
 const panel=p.locator('section.card').filter({has:p.getByRole('heading',{name:'Payroll reconciliation',exact:true})})
 await panel.locator('summary').click();const text=await panel.innerText();assert.ok(text.includes('$240.00'));assert.ok(text.includes('Attendance 8 hours'));assert.ok(text.includes('$30.00 per hour'));assert.ok(text.includes('$40.00 per hour'))
 assert.equal(await p.getByRole('button').count(),0,'Payroll read grant adds no write controls');await shot('staff-payroll-02-reconcile')
 const report=await h.api('/api/mallet/staff/payroll?'+query,undefined,{as:person.cookie});assert.equal(report.technicians.find(t=>t.technicianId===tech.id).payCents,24000)
 for(const format of ['JSON','CSV']){const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Download payroll '+format,exact:true}).click()]);const content=await readFile(await file.path(),'utf8');assert.equal(file.suggestedFilename(),'mallet-payroll.'+format.toLowerCase());if(format==='JSON')assert.deepEqual(JSON.parse(content),report);else assert.ok(content.includes('"28800000","0","28800000","24000","0"'));await file.delete()}
 await ownerGrant(false);await use(person.cookie);await p.goto(h.origin+'/app/staff?'+query);assert.equal(await p.getByRole('heading',{name:'Payroll reconciliation',exact:true}).count(),0)
 for(const format of ['json','csv'])assert.equal((await p.request.get(h.origin+'/api/mallet/staff/payroll?'+query+'&format='+format)).status(),403)
}

async function advisorCommunicationBrowser(h,p,{use,shot,person,quote}){
 await use(person.cookie);await p.goto(h.origin+'/app/staff')
 const form=command=>p.locator('form').filter({has:p.locator('input[name="command"][value="'+command+'"]')}).filter({has:p.locator('input[name="estimateId"][value="'+quote.id+'"]')})
 await form('estimate.markSent').locator('select[name="channel"]').selectOption('phone');await form('estimate.markSent').getByLabel('Estimate handoff note',{exact:true}).fill('Advisor explained the exact approved quote by phone')
 const captured=await form('estimate.markSent').evaluate(f=>Object.fromEntries(new FormData(f))),mail=h.messages.length
 await shot('staff-communication-01-manual-handoff');await form('estimate.markSent').getByRole('button',{name:'Record manual estimate handoff',exact:true}).click();await p.waitForURL('**/app/staff')
 let current=(await h.state()).records.estimate.find(q=>q.id===quote.id);assert.equal(current.sent[0].recordedBy.id,person.id);assert.equal(current.sent[0].deliveryConfirmed,false)
 const before=(await h.state()).records,stale=await p.request.post(h.origin+'/app/actions',{form:captured,headers:{origin:h.origin}});assert.equal(stale.status(),409);assert.deepEqual((await h.state()).records,before)
 await form('estimate.authorise').locator('input[name="lineIds"]').first().check();await form('estimate.authorise').getByLabel('Customer giving the decision',{exact:true}).fill('Native customer');await form('estimate.authorise').getByLabel('Exact customer instruction evidence',{exact:true}).fill('Customer explicitly approved only the selected part')
 await shot('staff-communication-02-exact-choice');await form('estimate.authorise').getByRole('button',{name:'Record exact customer decision',exact:true}).click();await p.waitForURL('**/app/staff')
 current=(await h.state()).records.estimate.find(q=>q.id===quote.id);assert.deepEqual(current.authorisation.lineIds,[quote.revisions[0].lines[0].id]);assert.equal(current.authorisation.recordedBy.id,person.id);assert.equal(h.messages.length,mail,'Native manual communications send no provider message');assert.equal(await form('estimate.authorise').count(),0)
 const view=await h.api('/api/mallet/staff/state',undefined,{as:person.cookie});assert.ok(!JSON.stringify(view).includes('Customer explicitly approved only the selected part'));await shot('staff-communication-03-retained-decision')
}
