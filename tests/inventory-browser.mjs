import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {publicDoor} from './support/portable-repair.mjs'
import {installation} from './harness.mjs'
import {assertInventoryReconciliation} from './support/inventory-journey.mjs'
import {totpCode} from './support/second-factor.mjs'
export async function inventoryBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const directory=process.env.MALLET_INVENTORY_PROOF_DIR??'.cache/inventory-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(c,fields,button)=>{const f=form(c);for(const [name,value]of Object.entries(fields))await f.locator(`[name="${name}"]`).fill(String(value));await f.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/inventory');if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.waitForLoadState('domcontentloaded');await p.goto(h.origin+'/app/inventory')}await shot('01-empty-and-receiving-forms')
  await fill('stock.item',{sku:'synthetic-mallet-1',barcode:'synthetic-mallet-2',name:'Brake pads',unit:'each'},'Register part')
  await fill('stock.bin',{code:'Shelf A',barcode:'synthetic-mallet-3'},'Register bin')
  const scans={itemBarcode:'synthetic-mallet-2',binBarcode:'synthetic-mallet-3'}
  const receive={...scans,expectedQuantity:10,quantity:9,reference:'synthetic-mallet-4',reason:'One unit missing'},stateBefore=await h.state(),{id,name,role}=stateBefore.actor,actor={id,name,role}
  const item=stateBefore.records.stockItem.find(i=>i.sku==='synthetic-mallet-1'),bin=stateBefore.records.stockBin.find(b=>b.barcode==='synthetic-mallet-3')
  assert.equal(item.barcode,scans.itemBarcode);assert.equal(item.name,'Brake pads');assert.equal(bin.code,'Shelf A')
  await fill('stock.receive',receive,'Receive stock')
  let report=await h.api('/api/mallet/inventory')
  const expected={item,bin,receiptId:report.receipts[0]?.id,receiver:actor,receiptNote:receive.reason}
  assert.equal(expected.receiptId,(await h.state()).records.stockReceipt[0].id)
  assertInventoryReconciliation(report,expected)
  await fill('stock.receive',receive,'Receive stock')
  assert.match(await p.locator('main').innerText(),/This receiving reference is already retained/);await p.goto(h.origin+'/app/inventory')
  assert.deepEqual(await h.api('/api/mallet/inventory'),report,'Duplicate native shipment preserves receiving, variance and ledger reports')
  assert.ok((await p.locator('main').innerText()).includes('Labeled 10 · Received 9 · Shortage 1'));await shot('02-shipment-shortage-and-ledger')
  await p.getByRole('link',{name:'Start a blind or cycle count'}).click();assert.ok(!(await p.locator('main').innerText()).includes('On hand 9'));await shot('03-blind-count')
  await fill('stock.count',{...scans,quantity:8,reason:'Physical count confirmed shortage'},'Submit count')
  assert.ok((await p.locator('main').innerText()).includes('On hand 9'));await shot('04-variance-awaiting-approval')
  const pending=await h.api('/api/mallet/inventory'),countId=pending.counts[0].id
  assert.equal(pending.counts[0].approval,null);assert.deepEqual(pending.movements,report.movements,'Submitting a native count proposes no movement')
  const approvedAfter=Date.now()
  await fill('stock.approveCount',{reason:'Recount confirmed one missing'},'Approve variance')
  report=await h.api('/api/mallet/inventory')
  assertInventoryReconciliation(report,{...expected,countId,counter:actor,countNote:'Physical count confirmed shortage',approver:actor,approvalReason:'Recount confirmed one missing'})
  assert.ok(Date.parse(report.counts[0].approval.at)>=approvedAfter&&Date.parse(report.counts[0].approval.at)<=Date.now())
  await h.command('stock.approveCount',{countId,version:report.counts[0].version,reason:'Cannot apply twice'},{status:409})
  assert.deepEqual(await h.api('/api/mallet/inventory'),report,'Duplicate native approval preserves receiving, variance and ledger reports')
  await fill('stock.receive',receive,'Receive stock')
  assert.match(await p.locator('main').innerText(),/This receiving reference is already retained/)
  assert.deepEqual(await h.api('/api/mallet/inventory'),report,'Duplicate native shipment after approval preserves both populated reports and movements')
  await p.goto(h.origin+'/app/inventory')
  const reconciliation=await p.locator('main').innerText()
  for(const evidence of ['Brake pads · Shelf A','Labeled 10 · Received 9 · Shortage 1','blind count 8 · Expected 9 · Variance -1','Physical count confirmed shortage','Adjustment approved · Recount confirmed one missing','Brake pads · Shelf A · 9 · One unit missing','Brake pads · Shelf A · -1 · Recount confirmed one missing',actor.name])assert.ok(reconciliation.includes(evidence),'Rendered reconciliation retains '+evidence)
  assert.ok((await p.locator('main').innerText()).includes('On hand 8'));assert.ok((await p.locator('main').innerText()).includes('Adjustment approved'));await shot('05-reconciled-stock-and-variance')
  // Exercise the new public command doors, then inspect their actual native balances at both widths.
  const {stockConsumptionJourney}=await import('./support/stock-consumption-journey.mjs');await stockConsumptionJourney(h)
  await p.goto(h.origin+'/app/inventory');assert.match(await p.locator('main').innerText(),/Committed atomically with authorized work/);await shot('06-consumed-returned-and-canceled-reservations')
  h.person=publicDoor(h.origin,h.owner).person
  const {depositsJourney}=await import('./support/deposits-journey.mjs');await depositsJourney(h)
  const state=await h.state(),paidInvoice=state.records.invoice.find(i=>state.records.payment.filter(r=>r.invoiceId===i.id).reduce((n,r)=>n+r.amountCents,0)===i.totals.totalCents),allocation=state.records.payment.find(r=>r.depositId&&r.invoiceId===paidInvoice.id)
  await p.goto(h.origin+'/app/jobs/'+allocation.jobId);assert.match(await p.locator('main').innerText(),/Balance due \$0\.00/);await shot('07-deposit-allocated-and-split-remainder')
  await p.locator('details').evaluateAll(sections=>sections.forEach(section=>section.open=true))
  for(const control of await p.locator('button,a[role="button"]').all())assert.ok((await control.innerText()).trim(),'Control audit: '+await control.evaluate(el=>JSON.stringify({html:el.outerHTML,text:el.textContent,display:getComputedStyle(el).display,hiddenAncestor:!!el.closest('[hidden],details:not([open])')})))
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}

export async function depositsBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  h.person=publicDoor(h.origin,h.owner).person
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext(),p=await context.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message))
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const directory=process.env.MALLET_DEPOSITS_PROOF_DIR??'.cache/deposits-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,width)=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon controls have tooltips');await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}
  await p.goto(h.origin+'/app/security?stepUp=1&returnTo=%2Fapp%2Fdeposits')
  for(const width of [1440,390]){
   await p.setViewportSize({width,height:1000});assert.match(await p.locator('main').innerText(),/Add and confirm your own second factor/)
   assert.equal(await p.getByRole('link',{name:'Sign in to confirm'}).count(),0);await p.getByRole('button',{name:'Set up an authenticator app'}).waitFor();await shot('00-deposit-factor-enrolment',width)
  }
  const {depositsJourney}=await import('./support/deposits-journey.mjs'),fixtures=await depositsJourney(h),{account,repair,invoice}=fixtures
  const admin=await h.person('native-deposit-admin@example.test','admin')
  assert.equal((await h.request('/app/deposits?accountId='+account.id,{as:admin.cookie})).status,403)
  const anonymous=await h.request('/app/deposits?accountId='+account.id,{as:''});assert.ok([303,401].includes(anonymous.status))
  const form=(command,deposit)=>p.locator((deposit?'#deposit-'+deposit+' ':'')+`form:has(input[name="command"][value="${command}"])`)
  const submit=async(command,fields,{deposit,selects={},status=200}={})=>{
   const f=form(command,deposit)
   for(const [name,value]of Object.entries(fields))await f.locator(`[name="${name}"]`).fill(String(value))
   for(const [name,value]of Object.entries(selects))await f.locator(`[name="${name}"]`).selectOption(value)
   await f.locator('[name="confirm"]').check()
   const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/app/actions'&&r.request().method()==='POST')
   await f.getByRole('button').click();assert.equal((await response).status(),status===200?303:status);await p.waitForLoadState('domcontentloaded')
  }
  const denied=await browser.newContext();await denied.addCookies(admin.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const deniedPage=await denied.newPage()
  for(const width of [1440,390]){
   await deniedPage.setViewportSize({width,height:1000});assert.equal((await deniedPage.goto(h.origin+'/app/deposits?accountId='+account.id)).status(),403)
   assert.ok(await deniedPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await deniedPage.screenshot({path:join(directory,'00-non-owner-refused-'+width+'.png'),fullPage:true})
  }
  await denied.close()
  const url=h.origin+'/app/deposits?accountId='+account.id,db=await h.mf.getD1Database('DB'),{secret}=await h.stepUp()
  const refusedCustody=async(command,fields,options,width)=>{
   const before=JSON.stringify((await h.state()).records)
   await db.prepare('UPDATE mallet_session_proofs SET step_up_until=0').run()
   await submit(command,fields,options)
   assert.equal(new URL(p.url()).pathname,'/app/security');assert.equal(new URL(p.url()).searchParams.get('returnTo'),new URL(url).pathname+new URL(url).search)
   assert.match(await p.locator('main').innerText(),/Confirm again/);await shot(command+'-stale-factor',width)
   await db.prepare('UPDATE mallet_factors SET last_step=NULL').run()
   await p.getByLabel('Six-digit code').fill(totpCode(secret));await p.getByRole('button',{name:'Confirm with authenticator app'}).click();await p.waitForURL(url)
   assert.equal(JSON.stringify((await h.state()).records),before,'Factor confirmation never repeats a deposit action automatically')
   await form(command,options?.deposit).locator('[name="evidence"]').evaluate(n=>n.removeAttribute('required'))
   await submit(command,{...fields,evidence:''},{...options,status:400})
   assert.equal(JSON.stringify((await h.state()).records),before,'Missing customer instruction refuses native '+command)
   assert.match(await p.locator('main').innerText(),/customer instruction and observed tender evidence must contain/)
   await shot(command+'-missing-instruction',width);await p.goto(url)
  }
  for(const [index,width]of [1440,390].entries()){
   await p.setViewportSize({width,height:1000})
   await p.goto(h.origin+'/app/accounts?manage='+account.id);await shot('01-account-entry',width)
   await p.getByRole('link',{name:'Deposits & customer credit',exact:true}).click()
   await p.locator('select[name="accountId"]').selectOption(account.id);await p.getByRole('button',{name:'Review deposits',exact:true}).click()
   const first=await repair(4+index*3),second=await repair(5+index*3),canceled=await repair(6+index*3)
   await p.goto(url)
   const prefix='synthetic-mallet-native-'+width
   const beforeInvalid=JSON.stringify((await h.state()).records)
   for(const fields of [{amountUsd:'0.001',confirm:'record-deposit'},{amountUsd:'1',confirm:''}]){const response=await p.request.post(h.origin+'/app/actions',{headers:{origin:h.origin},form:{command:'deposit.record',accountId:account.id,method:'cash',reference:prefix+'-invalid',evidence:'Invalid input must not record tender',...fields},maxRedirects:0});assert.ok([400,409].includes(response.status()))}
   assert.equal(JSON.stringify((await h.state()).records),beforeInvalid)
   await refusedCustody('deposit.record',{amountUsd:'30.25',reference:prefix+'-refused-record',evidence:'Customer instruction for a pre-order cash deposit'},{selects:{method:'cash',jobId:first.id}},width)
   await submit('deposit.record',{amountUsd:'30.25',reference:prefix+'-restricted',evidence:'Customer requested a pre-order deposit; counted original cash observed'},{selects:{method:'cash',jobId:first.id}})
   let state=await h.state(),restricted=state.records.deposit.find(d=>d.reference===prefix+'-restricted')
   assert.match(await p.locator('#deposit-'+restricted.id).innerText(),/Mallet did not verify funds/);assert.doesNotMatch(await p.locator('#deposit-'+restricted.id).innerText(),/confirmed/i)
   assert.equal(restricted.amountCents,3025);assert.equal(state.records.invoice.some(i=>i.jobId===first.id),false,'Native deposit is recorded before work and invoice')
   assert.equal(await form('deposit.refund',restricted.id).count(),0,'Open restricted repair has no refund action');await shot('02-pre-order-deposit',width)
   const i1=await invoice(first),i2=await invoice(second)
   await p.goto(url)
   await refusedCustody('deposit.allocate',{amountUsd:'30.25',reference:prefix+'-refused-allocation',evidence:'Customer instructed deposit allocation'},{deposit:restricted.id,selects:{invoiceSource:JSON.stringify({id:i1.id,version:i1.version})}},width)
   await submit('deposit.allocate',{amountUsd:'30.25',reference:prefix+'-allocation',evidence:'Customer instructed application of existing deposit to this final invoice'},{deposit:restricted.id,selects:{invoiceSource:JSON.stringify({id:i1.id,version:i1.version})}})
   await submit('deposit.record',{amountUsd:'100.00',reference:prefix+'-account-credit',evidence:'Counted cash retained as unallocated credit on customer instruction'})
   state=await h.state();const credit=state.records.deposit.find(d=>d.reference===prefix+'-account-credit')
   assert.equal(credit.balance.unallocatedCents,10000);assert.match(await p.locator('#deposit-'+credit.id).innerText(),/Mallet did not verify funds/);assert.doesNotMatch(await p.locator('#deposit-'+credit.id).innerText(),/confirmed/i);await shot('03-unallocated-customer-credit',width)
   for(const [i,n]of [[i1,1],[i2,2]])await submit('deposit.allocate',{amountUsd:'50',reference:prefix+'-split-'+n,evidence:'Customer instructed split of this single receipt across these two invoices'},{deposit:credit.id,selects:{invoiceSource:JSON.stringify({id:i.id,version:i.version})}})
   state=await h.state();assert.deepEqual(state.records.deposit.find(d=>d.id===credit.id).balance,{receivedCents:10000,allocatedCents:10000,refundedCents:0,unallocatedCents:0})
   assert.equal(state.records.payment.filter(p=>p.invoiceId===i1.id).reduce((n,p)=>n+p.amountCents,0),8025);await shot('04-split-credit-final-balances',width)
   await submit('deposit.record',{amountUsd:'30',reference:prefix+'-cancel',evidence:'Customer instructed restricted deposit; original paper check observed'},{selects:{method:'check',jobId:canceled.id}})
   state=await h.state();const unused=state.records.deposit.find(d=>d.reference===prefix+'-cancel')
   await h.command('flow.close',{jobId:canceled.id,version:canceled.version,outcome:'canceled',reason:'Customer canceled before parts ordering'})
   await p.goto(url)
   await refusedCustody('deposit.refund',{amountUsd:'30',reference:prefix+'-refused-refund',evidence:'Customer requested original-tender refund'},{deposit:unused.id},width)
   await submit('deposit.refund',{amountUsd:'30',reference:prefix+'-refund',evidence:'Customer canceled and instructed original check refund; owner observed it outside Mallet'},{deposit:unused.id})
   state=await h.state();assert.deepEqual(state.records.deposit.find(d=>d.id===unused.id).balance,{receivedCents:3000,allocatedCents:0,refundedCents:3000,unallocatedCents:0})
   assert.match(await p.locator('#deposit-'+unused.id).innerText(),/Mallet did not move or verify money/);await shot('05-canceled-deposit-refund',width)
   await submit('deposit.record',{amountUsd:'1',reference:prefix+'-bounded',evidence:'Customer instruction; one dollar observed'})
   state=await h.state();const bounded=state.records.deposit.find(d=>d.reference===prefix+'-bounded'),before=JSON.stringify(state.records)
   const f=form('deposit.allocate',bounded.id);await f.locator('[name="amountUsd"]').evaluate(n=>n.removeAttribute('max'))
   await submit('deposit.allocate',{amountUsd:'1.01',reference:prefix+'-too-much',evidence:'Attempted over-allocation is refused without writes'},{deposit:bounded.id,selects:{invoiceSource:JSON.stringify({id:i2.id,version:i2.version})},status:409})
   assert.equal(JSON.stringify((await h.state()).records),before);assert.match(await p.locator('main').innerText(),/exceeds available deposit/);await shot('06-over-allocation-refused',width)
   await p.goto(url)
   const other=(await h.state()).records.deposit.find(d=>d.reference==='synthetic-mallet-deposit-other')
   await form('deposit.allocate',bounded.id).locator('[name="depositId"]').evaluate((n,id)=>n.value=id,other.id)
   await submit('deposit.allocate',{amountUsd:'1',reference:prefix+'-wrong-payer',evidence:'A payer cannot redirect another customer’s deposit'},{deposit:bounded.id,selects:{invoiceSource:JSON.stringify({id:i2.id,version:i2.version})},status:409})
   assert.equal(JSON.stringify((await h.state()).records),before);assert.match(await p.locator('main').innerText(),/same payer/);await shot('07-cross-payer-refused',width)

  }
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}

export async function stockConsumptionBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const {shopSetup}=await import('./support/diagnosis-journey.mjs'),{booking,authorise}=await import('./harness.mjs')
  await shopSetup(h);await h.command('tax.configure',{ratePercent:0,partsTaxable:false,laborTaxable:false})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext(),p=await context.newPage()
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const directory=process.env.MALLET_STOCK_PROOF_DIR??'.cache/stock-consumption-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,width)=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon controls have tooltips');await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}
  const form=command=>p.locator(`form:has(input[name="command"][value="${command}"])`)
  const submit=async(command,fields,selects={},status=303)=>{const f=form(command);for(const [name,value]of Object.entries(fields))await f.locator(`[name="${name}"]`).fill(String(value));for(const [name,value]of Object.entries(selects))await f.locator(`[name="${name}"]`).selectOption(value);const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/app/actions'&&r.request().method()==='POST');await f.getByRole('button').click();assert.equal((await response).status(),status);await p.waitForLoadState('domcontentloaded')}
  for(const [index,width]of [1440,390].entries()){
   await p.setViewportSize({width,height:1000});const prefix='synthetic-mallet-native-stock-'+width
   const asset=await h.command('asset.create',{customerName:'Native stock customer',customerEmail:'stock@example.test',label:'Native stock repair '+width,identifier:prefix}),{job}=await booking(h,{asset,bayId:'Stock '+width,startAt:`2026-12-0${index+1}T09:00:00Z`,endAt:`2026-12-0${index+1}T10:00:00Z`})
   await authorise(h,await h.command('estimate.prepare',{jobId:job.id,version:job.version,lines:[{kind:'part',description:'Reserved replacement',quantity:1,unitCents:10000}]}))
   const item=await h.command('stock.item',{sku:prefix,barcode:prefix+'-part',name:'Native replacement '+width,unit:'each'}),bin=await h.command('stock.bin',{code:'Native shelf '+width,barcode:prefix+'-bin'}),scans={itemBarcode:item.barcode,binBarcode:bin.barcode}
   const lot=await h.command('stock.lot',{...scans,quantity:1,reference:prefix+'-receipt',supplier:'Synthetic supplier',supplierLot:prefix+'-lot',unitCostCents:4321,evidence:'Physical lot received with supplier evidence'})
   await p.goto(h.origin+'/app/inventory')
   await submit('stock.reserve',{...scans,quantity:1,reference:prefix+'-reservation'},{jobId:job.id})
   let state=await h.state();const reservation=state.records.stockReservation.find(r=>r.jobId===job.id)
   await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByText('Consume reserved stock with this part',{exact:true}).click();await shot('01-reserved-work-form',width)
   const fields={quantity:1,stockReference:prefix+'-use',stockEvidence:'Installed from this exact reserved physical lot'},selected={reservationId:reservation.id,lotId:lot.id}
   await submit('work.record',{...fields,quantity:0.5},selected,409)
   state=await h.state();assert.equal(state.records.job.find(j=>j.id===job.id).actuals.length,0);assert.equal(state.records.stockUse?.length??0,index)
   await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByText('Consume reserved stock with this part',{exact:true}).click();await submit('work.record',fields,selected)
   state=await h.state();const use=state.records.stockUse.find(u=>u.jobId===job.id)
   assert.equal(use.costCents,4321);assert.equal(state.records.job.find(j=>j.id===job.id).actuals.length,1);assert.equal(state.records.stockReservation.find(r=>r.id===reservation.id).release.kind,'consumed');await shot('02-work-and-stock-committed',width)
   await p.goto(h.origin+'/app/inventory');const section=p.locator('#stock-use-'+use.id);await section.getByText('Record inspected saleable return',{exact:true}).click();await section.locator('[name="confirm"]').check()
   await submit('stock.returnUse',{quantity:2,reference:prefix+'-return',reason:'Removed and inspected saleable; physically returned to original shelf'}, {},409)
   assert.equal((await h.state()).records.stockUse.find(u=>u.id===use.id).returns?.length??0,0)
   await p.goto(h.origin+'/app/inventory');await p.locator('#stock-use-'+use.id).getByText('Record inspected saleable return',{exact:true}).click();await form('stock.returnUse').locator('[name="confirm"]').check()
   await submit('stock.returnUse',{quantity:1,reference:prefix+'-return',reason:'Removed and inspected saleable; physically returned to original shelf'})
   state=await h.state();assert.equal(state.records.stockUse.find(u=>u.id===use.id).returns.length,1);assert.equal(state.records.job.find(j=>j.id===job.id).actuals.length,1);assert.equal(state.records.stockMovement.filter(m=>m.itemId===item.id).reduce((n,m)=>n+m.deltaMilli,0),1000);await shot('03-recorded-saleable-return',width)
   const canceled=(await booking(h,{asset:await h.command('asset.create',{customerName:'Cancel customer',customerEmail:'cancel@example.test',label:'Canceled repair '+width,identifier:prefix+'-cancel'}),bayId:'Cancel '+width,startAt:`2026-12-0${index+3}T09:00:00Z`,endAt:`2026-12-0${index+3}T10:00:00Z`})).job
   await p.goto(h.origin+'/app/inventory')
   await submit('stock.reserve',{...scans,quantity:1,reference:prefix+'-cancel-reservation'},{jobId:canceled.id})
   await p.goto(h.origin+'/app/jobs/'+canceled.id);await p.getByText('Cancel or mark lost',{exact:true}).click();await submit('flow.close',{reason:'Customer canceled before installation'},{outcome:'canceled'})
   state=await h.state();assert.equal(state.records.stockReservation.find(r=>r.jobId===canceled.id).release.kind,'cancellation');await shot('04-canceled-repair',width)
   await p.goto(h.origin+'/app/inventory');await shot('05-released-reservation-and-stock',width)
  }
 }finally{await browser?.close();await h.close()}
}
