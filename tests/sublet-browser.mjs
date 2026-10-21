import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {at,subletFixture} from './support/sublet-journey.mjs'
import {qualityReady} from './support/quality-ready.mjs'

export async function subletBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const f=await subletFixture(h,{person:publicDoor(h.origin,h.owner).person}),errors=[]
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'})
  await context.addCookies(f.advisor.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage();p.on('pageerror',error=>errors.push(error.message))
  const url=h.origin+'/app/jobs/'+f.job.id,panel=()=>p.locator('#sublets'),form=command=>p.locator(`form:has(input[name="command"][value="${command}"])`)
  const submit=async(target,label)=>{await target.getByRole('button',{name:label,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  const directory=process.env.MALLET_SUBLET_PROOF_DIR??'.cache/sublet-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,target=panel())=>{
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame))
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'SUBLET-001 no horizontal overflow '+name+' at '+width)
    await target.screenshot({path:join(directory,name+'-'+width+'.png')})
   }
   await p.setViewportSize({width:1440,height:1000})
  }
  await p.goto(url)
  await panel().locator('summary').filter({hasText:/^Track\ outsourced\ work$/}).click()
  const create=form('sublet.record'),source=JSON.stringify({estimateId:f.quote.id,revision:1,lineId:f.line.id})
  const options=await create.locator('select[name="source"] option').allTextContents()
  assert.equal(options.length,1);assert.ok(options[0].includes(f.line.description));assert.ok(!options[0].includes(f.declined.description))
  await create.locator('select[name="source"]').selectOption(source)
  for(const [label,value] of [['Supplier',f.input.supplier],['Sublet PO reference',f.input.poReference],['Item in custody',f.input.item],['Shop custodian',f.input.custodian],['Quoted supplier cost (USD)','300.00'],['Supplier ETA (ISO with timezone)',f.input.eta],['Supplier evidence',f.input.evidence],['Reason',f.input.reason]])await create.getByLabel(label,{exact:true}).fill(value)
  await shot('01-approved-sublet-form');await submit(create,'Record approved sublet')
  assert.ok((await panel().innerText()).includes('In shop custody'))
  await panel().locator('summary').filter({hasText:/^Record\ outside\ handoff$/}).click()
  const send=form('sublet.send')
  await send.getByLabel('Outside receiver',{exact:true}).fill('Pat at Cedar Machine Shop')
  await send.getByLabel('Outside handoff time (ISO with timezone)',{exact:true}).fill(at(-2))
  await send.getByLabel('Dispatch reference',{exact:true}).fill('Carrier slip CH-17 acknowledged at outside shop')
  await submit(send,'Record outside handoff')
  assert.ok((await panel().innerText()).includes('In outside custody'))
  await panel().locator('summary').filter({hasText:/^Custody\ history$/}).click();await shot('02-outside-custody')
  await panel().locator('summary').filter({hasText:/^Record\ delayed\ return$/}).click()
  const delay=form('sublet.delay'),eta=at(24),evidence='Supplier call: resurfacer unavailable, return delayed until tomorrow'
  await delay.getByLabel('Supplier ETA (ISO with timezone)',{exact:true}).fill(eta)
  await delay.getByLabel('Supplier evidence',{exact:true}).fill(evidence)
  await delay.getByLabel('Reason',{exact:true}).fill('Counter recorded supplier revised return')
  await submit(delay,'Record delayed return')
  await panel().locator('summary').filter({hasText:/^Supplier\ ETA\ history$/}).click();await shot('03-delayed-return')
  assert.ok((await panel().innerText()).includes(f.input.evidence));assert.ok((await panel().innerText()).includes(evidence))
  await panel().locator('summary').filter({hasText:/^Record\ supplier\ bill$/}).click()
  const bill=form('sublet.bill')
  await bill.getByLabel('Supplier invoice number',{exact:true}).fill('CM-INVOICE-17')
  await bill.getByLabel('Full supplier bill cost (USD)',{exact:true}).fill('310.00')
  await bill.getByLabel('Supplier bill evidence',{exact:true}).fill('Counter retains supplier invoice for cylinder head resurfacing')
  await bill.getByLabel('Reason',{exact:true}).fill('Actual supplier invoice includes handling')
  await submit(bill,'Record supplier bill')
  assert.ok((await panel().innerText()).includes('$190.00'))
  // The existing native estimate approval/customer-decision forms supply added scope.
  const supplement=await h.command('estimate.prepare',{jobId:f.job.id,version:(await f.current()).version,supplement:true,reason:'Supplier found a valve-seat issue',lines:[{kind:'fee',description:'Added valve-seat machining',quantity:1,unitCents:10000,feeTaxable:true}]})
  await p.goto(url)
  const added=()=>p.locator('section.card').filter({has:p.getByRole('heading',{name:'Supplement 1 · incremental scope',exact:true})})
  await submit(added(),'Approve estimate');await submit(added(),'Record estimate shared')
  await added().getByLabel('Added valve-seat machining · $100.00 × 1',{exact:true}).check()
  await added().getByLabel('Customer who authorized',{exact:true}).fill('Elena Torres')
  await added().getByLabel('Authorization evidence / reference',{exact:true}).fill('Customer signed the separately priced valve-seat supplement')
  await submit(added(),'Record customer authorization')
  await panel().locator('summary').filter({hasText:/^Link\ approved\ added\ scope$/}).click()
  const scope=form('sublet.addScope')
  await scope.locator('select[name="source"]').selectOption(JSON.stringify({estimateId:supplement.id,revision:1,lineId:supplement.revisions[0].lines[0].id}))
  await scope.getByLabel('Added quoted supplier cost (USD)',{exact:true}).fill('70.00')
  await scope.getByLabel('Reason',{exact:true}).fill('Separately approved valve-seat work sent to same supplier')
  await shot('04-added-scope-form');await submit(scope,'Link added scope')
  assert.ok((await panel().innerText()).includes('Pending bill for current scope'))
  await panel().locator('summary').filter({hasText:/^Approved\ sublet\ scope$/}).click();await panel().locator('summary').filter({hasText:/^Supplier\ bill\ history$/}).click();await shot('05-scope-needs-current-bill')
  await panel().locator('summary').filter({hasText:/^Record\ supplier\ bill$/}).click()
  await bill.getByLabel('Supplier invoice number',{exact:true}).fill('CM-INVOICE-17')
  await bill.getByLabel('Full supplier bill cost (USD)',{exact:true}).fill('400.00')
  await bill.getByLabel('Supplier bill evidence',{exact:true}).fill('Revised invoice includes resurfacing, added valve-seat work and freight')
  await bill.getByLabel('Reason',{exact:true}).fill('Revised full bill matches both approved scope items')
  await submit(bill,'Record supplier bill')
  await h.command('work.record',{jobId:f.job.id,version:(await f.current()).version,estimateId:f.quote.id,revision:1,lineId:f.labor.id,quantity:2})
  await p.goto(url);await submit(form('job.complete'),'Complete repair')
  assert.ok((await p.locator('main').innerText()).includes('Receive outsourced work back into shop custody'))
  await shot('06-completion-refused-outside',p.locator('main'))
  await p.goto(url);await panel().locator('summary').filter({hasText:/^Receive\ outsourced\ work$/}).click()
  const receive=form('sublet.receive'),reference='Cylinder head CH-17 and both machining operations physically received; return slip CH-17'
  await receive.getByLabel('Shop custodian',{exact:true}).fill('Morgan at receiving bench')
  await receive.getByLabel('Returning supplier or carrier',{exact:true}).fill('Pat via Cedar courier')
  await receive.getByLabel('Physical receipt time (ISO with timezone)',{exact:true}).fill(at(-.25))
  await receive.getByLabel('Receiving evidence',{exact:true}).fill(reference)
  await shot('07-physical-receipt-form');await submit(receive,'Confirm sublet receipt')
  assert.ok((await panel().innerText()).includes('Received at shop'));assert.ok((await panel().innerText()).includes('Repair quality sign-off required'))
  assert.equal(await form('sublet.receive').count(),0);assert.equal(await form('sublet.addScope').count(),0)
  await panel().locator('summary').filter({hasText:/^Custody\ history$/}).click();await panel().locator('summary').filter({hasText:/^Supplier\ bill\ history$/}).click();await shot('08-received-and-reconciled')
  const sublet=(await h.state()).records.sublet.find(x=>x.jobId===f.job.id)
  assert.equal(sublet.scopes.length,2);assert.equal(sublet.bills.length,2);assert.equal(sublet.receipt.reference,reference)
  assert.ok(!(await f.current()).actuals.some(x=>x.kind==='fee'),'SUBLET-001 receipt does not invent billable actuals')
  for(const [quote,line] of [[f.quote,f.line],[supplement,supplement.revisions[0].lines[0]]]){
   const work=form('work.record').filter({has:p.locator(`input[name="estimateId"][value="${quote.id}"]`)})
   await work.locator('select[name="lineId"]').selectOption(line.id)
   await work.getByLabel('Quantity used / hours worked',{exact:true}).fill('1')
   await work.getByLabel('Work note',{exact:true}).fill('Received supplier service matched to the exact approved scope')
   await submit(work,'Record parts or labor')
  }
  await submit(form('job.complete'),'Complete repair')
  assert.ok((await p.locator('main').innerText()).includes('Quality clearance'))
  await shot('09-quality-clearance-required',p.locator('main'))
  await qualityReady(h,await f.current(),{reviewer:f.advisor})
  await p.goto(url);await submit(form('job.complete'),'Complete repair')
  await submit(form('invoice.prepare'),'Prepare invoice');await submit(form('invoice.approve'),'Approve invoice');await submit(form('invoice.export'),'Export invoice once')
  await panel().locator('summary').filter({hasText:/^Approved\ sublet\ scope$/}).click();await panel().locator('summary').filter({hasText:/^Custody\ history$/}).click()
  await shot('10-cleared-final-margin')
  const text=await panel().innerText()
  for(const value of ['$600.00','$7.50','$370.00','$400.00','$200.00','33.33%','Current repair quality clearance recorded',reference])assert.ok(text.includes(value),'SUBLET-001 rendered reconciliation contains '+value)
  const invoice=(await h.state()).records.invoice.find(x=>x.jobId===f.job.id)
  assert.equal(invoice.status,'exported');assert.equal(invoice.totals.totalCents,80750);assert.equal(invoice.lines.filter(x=>x.kind==='fee').length,2)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
