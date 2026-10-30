import {qualityReady} from './support/quality-ready.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {csvRecords} from './support/report-csv.mjs'

const counterAsset={customerName:'Northside Cycles',customerEmail:['synthetic-mallet-1','example.test'].join('@'),label:'2019 Trek FX 3',identifier:'TREK-FX3-2019'}
async function counterRegistration(page,click) {
 await page.getByRole('link',{name:'New repair order'}).first().click();await page.waitForURL(url=>url.pathname==='/app/customers')
 await page.getByLabel('Customer name',{exact:true}).fill(counterAsset.customerName)
 await page.getByLabel('Customer email').fill(counterAsset.customerEmail)
 await page.getByLabel('Vehicle',{exact:true}).fill(counterAsset.label)
 await page.getByLabel('Plate or VIN').fill(counterAsset.identifier)
 await click('Add vehicle');await page.reload()
 const assetUrl=page.url(),assetId=new URL(assetUrl).pathname.split('/').at(-1)
 const response=await page.request.get(new URL('/api/mallet/state',assetUrl).href);assert.equal(response.status(),200)
 const state=await response.json(),asset=state.records.asset.find(a=>a.id===assetId)
 assert.ok(asset,'Counter registration persists the asset reached by the form redirect')
 assert.deepEqual(Object.fromEntries(Object.keys(counterAsset).map(key=>[key,asset[key]])),counterAsset,'Saved customer, vehicle and identifier match the entered counter fields')
 assert.equal(asset.assetType,'vehicle');assert.equal(asset.version,1);assert.deepEqual(asset.visits,[])
 for(const [label,key] of [['Customer name','customerName'],['Customer email','customerEmail'],['Vehicle','label'],['Plate or VIN','identifier']])assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),counterAsset[key],'Reloaded asset editor retains '+label)
 return {assetUrl,assetId,technicianId:state.actor.id}
}
async function counterVisit(page,click,{title,bayId,technicianId,startAt,endAt}) {
 await page.getByLabel('Repair request').fill(title)
 await page.getByLabel('Bay',{exact:true}).fill(bayId)
 await page.locator('select[name=technicianId]').selectOption(technicianId)
 await page.getByLabel('Start (with timezone)').fill(startAt)
 await page.getByLabel('End (with timezone)').fill(endAt)
 await click('Book visit');await page.waitForURL(url=>url.pathname.startsWith('/app/jobs/'))
 const id=new URL(page.url()).pathname.split('/').at(-1),state=await (await page.request.get(new URL('/api/mallet/state',page.url()).href)).json(),job=state.records.job.find(j=>j.id===id)
 assert.ok(job,'Counter booking persists its own visit')
 assert.deepEqual({title:job.title,bayId:job.bayId,technicianId:job.technicianId,startAt:job.startAt,endAt:job.endAt},{title,bayId,technicianId,startAt:new Date(startAt).toISOString(),endAt:new Date(endAt).toISOString()})
 assert.deepEqual(job.asset,{...counterAsset,assetType:'vehicle',specifications:{}},'Booking freezes the registered customer and vehicle')
 return job
}
async function counterHistory(page,assetUrl,visits,directory) {
 await page.goto(assetUrl);await page.reload()
 const state=await (await page.request.get(new URL('/api/mallet/state',assetUrl).href)).json(),assetId=new URL(assetUrl).pathname.split('/').at(-1),asset=state.records.asset.find(a=>a.id===assetId)
 assert.deepEqual([...asset.visits].sort(),visits.map(j=>j.id).sort(),'Register retains both exact native visit identities')
 assert.equal(await page.locator('.list li').count(),2)
 for(const visit of visits)assert.equal(await page.locator(`.list a[href="/app/jobs/${visit.id}"]`).getByText(visit.title,{exact:true}).count(),1,'Rendered history links the exact visit')
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download service history CSV'}).click()])
 const path=join(directory,'service-history.csv');await download.saveAs(path)
 const bookings=csvRecords(await readFile(path,'utf8')).filter(row=>row.Event==='job.book')
 assert.deepEqual(bookings.map(row=>row.Job).sort(),visits.map(j=>j.id).sort(),'Downloaded history contains both exact native bookings')
 for(const visit of visits){const row=bookings.find(row=>row.Job===visit.id);assert.equal(row.Asset,counterAsset.label);assert.equal(row.Identifier,counterAsset.identifier);assert.equal(JSON.parse(row.Details).technicianId,visit.technicianId)}
}

async function savedInvoiceReadback(page,jobUrl,directory) {
 const origin=new URL(jobUrl).origin,jobId=new URL(jobUrl).pathname.split('/').at(-1)
 const state=async()=>{const response=await page.request.get(origin+'/api/mallet/state');assert.equal(response.status(),200);return response.json()}
 const before=await state(),job=before.records.job.find(j=>j.id===jobId),invoice=before.records.invoice.find(i=>i.id===job.invoiceId),quote=before.records.estimate.find(q=>q.id===job.estimateId)
 const expected={id:quote.revisions[0].lines[0].id,kind:'part',description:'Shimano B05S brake pads',quantity:1,quantityMilli:1000,unitCents:3250,subtotalCents:3250,salesTaxCents:325,totalCents:3575,sourceEstimateId:quote.id,sourceRevision:1}
 const fields=line=>Object.fromEntries(Object.keys(expected).map(key=>[key,line[key]]))
 assert.deepEqual(invoice.lines.map(fields),[expected],'Native invoice contains exact authorized actual quantity, price, tax and source revision')
 assert.equal(invoice.actuals.length,1);assert.equal(invoice.actuals[0].estimateId,quote.id);assert.equal(invoice.actuals[0].revision,1);assert.equal(invoice.actuals[0].lineId,expected.id);assert.equal(invoice.actuals[0].quantityMilli,1000)
 const actor={id:before.actor.id,name:before.actor.name,role:before.actor.role},approval=before.records.approval.find(a=>a.subjectKind==='invoice'&&a.subjectId===invoice.id)
 assert.deepEqual(invoice.approval.by,actor);assert.equal(invoice.approval.revision,1);assert.deepEqual(approval.approvedBy,actor);assert.equal(approval.revision,1)
 const saved=before.records.export.find(e=>e.id===invoice.exportId)
 assert.deepEqual(saved.lines.map(fields),[expected])
 const csv=await readFile(join(directory,'invoice.csv'),'utf8')
 assert.equal(csv,saved.csv)
 assert.deepEqual(csvRecords(csv),[{InvoiceNumber:invoice.number,CustomerName:counterAsset.customerName,CustomerEmail:counterAsset.customerEmail,Vehicle:counterAsset.label,Identifier:counterAsset.identifier,JobId:jobId,EstimateRevision:'1',Description:'Shimano B05S brake pads',Kind:'part',Quantity:'1',UnitUSD:'32.50',SubtotalUSD:'32.50',SalesTaxUSD:'3.25',TotalUSD:'35.75',Currency:'USD',EstimateId:quote.id}])
 for(const version of [invoice.version,invoice.version-1]){
  const response=await page.request.post(origin+'/api/mallet/commands',{headers:{Origin:origin},data:{command:'invoice.export',input:{invoiceId:invoice.id,version}}})
  assert.equal(response.status(),200);assert.deepEqual(await response.json(),saved,'Current and preceding versions retrieve the original export')
 }
 const after=await state();assert.deepEqual(after.records.invoice,before.records.invoice);assert.deepEqual(after.records.export,before.records.export);assert.deepEqual(after.records.approval,before.records.approval);assert.equal(after.records.export.filter(e=>e.invoiceId===invoice.id).length,1)
 await page.reload()
 const panel=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Invoice',exact:true})})
 assert.ok((await panel.innerText()).includes('Shimano B05S brake pads'));assert.ok((await panel.innerText()).includes('$35.75'));assert.ok((await panel.innerText()).includes('Approved by '+actor.name))
}

async function counterInvoice(page,click,shot,jobUrl,qualityDoor,directory) {
 const origin=new URL(jobUrl).origin
  const estimateForm=page.locator('form').filter({has:page.getByRole('button',{name:'Prepare estimate',exact:true})})
  await estimateForm.getByLabel('Part description').fill('Shimano B05S brake pads')
  await estimateForm.getByLabel('Part unit price (before tax)').fill('32.50')
  await estimateForm.getByLabel('Labor description').fill('Replace pads, adjust brakes and safety inspection')
  await estimateForm.getByLabel('Labor hours').fill('1.5')
  await estimateForm.getByLabel('Labor rate (per hour, before tax)').fill('110.00')
  await estimateForm.getByLabel('Notes',{exact:true}).fill('Customer requested an estimate before starting.')
  await click('Prepare estimate');await shot('04-estimate-draft')
  await click('Approve estimate');await shot('05-estimate-approved')
  const print=await page.getByRole('link',{name:'Open printable estimate'}).getAttribute('href')
  await page.goto(origin+print);await shot('06-print-estimate');await page.goto(jobUrl)
  await page.getByLabel('Handoff note').fill('Printed estimate handed to customer at counter')
  await click('Record estimate shared');await shot('07-estimate-shared')
  await page.locator('input[name="lineIds"]').first().check()
  await page.getByLabel('Authorization evidence / reference').fill('Customer signed line 1 only on paper estimate NS-104. Labor deferred.')
  await click('Record customer authorization');await shot('08-partial-authorisation')
  await page.getByLabel('Work note').fill('Pads supplied over the counter. Labor not authorized.')
  await click('Record parts or labor');await shot('09-work-recorded')
  const qualityJob=(await qualityDoor.state()).records.job.find(j=>jobUrl.endsWith('/'+j.id));await qualityReady(qualityDoor,qualityJob);await page.reload();
  await click('Complete repair');await shot('10-completed')
  await click('Prepare invoice');await shot('11-invoice-draft')
  await click('Approve invoice');await shot('12-invoice-approved')
  await click('Export invoice once');await shot('13-invoice-exported')
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download saved invoice CSV'}).click()])
  await download.saveAs(join(directory,'invoice.csv'))
  assert.match(await readFile(join(directory,'invoice.csv'),'utf8'),/35.75/)
  await savedInvoiceReadback(page,jobUrl,directory)
}

export async function workshopBrowser() {
 const {installation}=await import('./harness.mjs'),{randomBytes}=await import('node:crypto')
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
 const directory=process.env.MALLET_SCREENSHOTS??'.cache/workshop-browser';let browser
 try {
  await mkdir(directory,{recursive:true})
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York'})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
  const click=async name=>{await page.getByRole('button',{name,exact:true}).click();await page.waitForLoadState('domcontentloaded')}
  const shot=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Workshop fits '+width);await page.screenshot({path:join(directory,`${name}-${width}.png`),fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
  await page.goto(h.origin+'/setup');await page.getByLabel('Sales tax rate (%)').fill('10');await page.getByLabel('Labor is taxable').check();await page.getByRole('checkbox',{name:'I confirm this owner account is ready to use.'}).check();await click('Finish setup')
  const {assetUrl,technicianId}=await counterRegistration(page,click);await shot('01-registered-asset')
  const first=await counterVisit(page,click,{title:'Brake pads and safety inspection',bayId:'Bay 2',technicianId,startAt:'2026-10-19T09:00:00-04:00',endAt:'2026-10-19T11:00:00-04:00'})
  await counterInvoice(page,click,async name=>{if(name==='13-invoice-exported')await shot('03-saved-invoice')},page.url(),h,directory)
  await page.goto(assetUrl)
  const second=await counterVisit(page,click,{title:'Follow-up wheel alignment',bayId:'Bay 3',technicianId,startAt:'2026-11-02T09:00:00-05:00',endAt:'2026-11-02T10:00:00-05:00'})
  await counterHistory(page,assetUrl,[first,second],directory);await shot('02-repeat-visit-history')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}

export async function browserJourney(openUrl,{directory='.cache/browser',fixtures='tests/fixtures/repairshopr',fresh=false,paywall}={}) {
 await mkdir(directory,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--disable-gpu','--use-mock-keychain','--password-store=basic']})
 let stage='open app'
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/New_York'})
  await page.goto(openUrl)
  await page.waitForURL(url=>['/setup','/app'].includes(url.pathname))
  if(fresh){assert.equal(new URL(page.url()).pathname,'/setup','OPEN-001: published install starts at first-run setup');for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(directory,`00-setup-${width}.png`),fullPage:true})}}
  if(new URL(page.url()).pathname==='/setup') {await page.getByLabel('Sales tax rate (%)').fill('10');await page.getByLabel('Labor is taxable').check();await page.getByRole('checkbox',{name:'I confirm this owner account is ready to use.'}).check();await page.getByRole('button',{name:'Finish setup'}).click()}
  await page.waitForURL('**/app')
  const origin=new URL(page.url()).origin
  if(fresh){const state=await (await page.request.get(origin+'/api/mallet/state')).json();for(const [kind,records] of Object.entries(state.records))if(kind!=='taxSettings')assert.equal(records.length,0,`OPEN-001: installed shop starts empty (${kind})`);assert.equal(state.actor.role,'owner','OPEN-001: local buyer owns the installation')}
  const shot=async name=>{
   stage=name
   if(paywall)assert.doesNotMatch(await page.locator('body').innerText(),paywall,'OPEN-001: no Mallet commercial gate on '+name)
   for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Page fits its viewport')
    await page.screenshot({path:join(directory,`${name}-${width}.png`),fullPage:true,...(name==='21-key-created'?{mask:[page.locator('pre')]}:{})})
   }
  }
  const click=async name=>{await page.getByRole('button',{name,exact:true}).click();await page.waitForLoadState('domcontentloaded')}
  await shot('01-board')
  const {assetUrl,technicianId}=await counterRegistration(page,click);await shot('02-asset')
  const firstVisit=await counterVisit(page,click,{title:'Brake pads and safety inspection',bayId:'Bay 2',technicianId,startAt:'2026-10-19T09:00:00-04:00',endAt:'2026-10-19T11:00:00-04:00'}),jobUrl=page.url();await shot('03-booked')
  await counterInvoice(page,click,shot,jobUrl,publicDoor(origin,(await page.context().cookies(origin)).map(c=>c.name+'='+c.value).join('; ')),directory)
  await page.goto(assetUrl);await shot('14-service-history')
  const secondVisit=await counterVisit(page,click,{title:'Follow-up wheel alignment',bayId:'Bay 1',technicianId,startAt:'2026-11-02T09:00:00-05:00',endAt:'2026-11-02T10:00:00-05:00'})
  await counterHistory(page,assetUrl,[firstVisit,secondVisit],directory);await shot('15-repeat-visit')
  const state=await (await page.request.get(origin+'/api/mallet/state')).json(),followup=state.records.job.find(j=>j.title==='Follow-up wheel alignment')
  const send=async(command,input,headers={})=>{const response=await page.request.post(origin+'/api/mallet/commands',{headers:{Origin:origin,...headers},data:{command,input}});assert.equal(response.status(),200);return response.json()}
  const preparation=await send('agent.create',{label:'Dispatch assistant'})
  await send('dispatch.prepare',{jobId:followup.id,version:followup.version,bayId:'Bay 3',technicianId:'Jordan Lee',startAt:'2026-11-03T09:00:00-05:00',endAt:'2026-11-03T10:00:00-05:00',reason:'Use the alignment stand after the wheel arrives'},{Authorization:'Bearer '+preparation.token})
  await page.goto(origin+'/app/jobs/'+followup.id);await shot('15-dispatch-proposed')
  await click('Approve dispatch plan');await shot('15-dispatch-approved')
  await send('agent.revoke',{id:preparation.id})
  await page.goto(origin+'/app/move-in');await shot('16-move-in')
  await page.getByLabel('Customers response JSON').fill(await readFile(join(fixtures,'customers.json'),'utf8'))
  await page.getByLabel('Vehicles response JSON').fill(await readFile(join(fixtures,'assets.json'),'utf8'))
  await click('Dry run — preview changes');await shot('17-import-preview')
  await page.getByRole('checkbox').check();await click('Apply reviewed import');await shot('18-import-journal')
  await click('Undo this import');await shot('19-import-undone')
  await page.goto(origin+'/app/data');await shot('20-data-access')
  const [backup]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download workshop backup'}).click()]);await backup.saveAs(join(directory,'workshop.rer'))
  await page.getByLabel('Agent label').fill('Workshop drafting assistant');await click('Create preparation key')
  // A screenshot of a one-time credential would publish access. Read the end
  // state, then revoke through the private session before taking its safe page.
  assert.equal(await page.getByRole('heading',{name:'Agent key created'}).count(),1)
  await shot('21-key-created')
  await page.goto(origin+'/app/data');await click('Revoke key');await shot('21-key-revoked')
  await page.goto(origin+'/app/customers')
  await page.getByLabel('Customer name',{exact:true}).fill('Unused intake')
  await page.getByLabel('Vehicle').fill('Unbooked inspection request')
  await page.getByLabel('Plate or VIN').fill('UNUSED-INTAKE')
  await click('Add vehicle');await shot('22-unused-asset')
  await page.getByLabel('Type ERASE to confirm').fill('ERASE');await click('Erase unused vehicle')
  assert.equal(await page.getByRole('link',{name:'Unbooked inspection request'}).count(),0)
  await shot('23-erased-register')
  const credentials={origin,cookie:(await page.context().cookies(origin)).map(c=>c.name+'='+c.value).join('; ')}
  console.log('Browser repair, partial authorization, invoice, history, import/undo, backup, key revocation and erasure journey passed at 1440 and 390.')
  return credentials
 }catch(error){throw new Error(`Browser journey failed at ${stage}: ${String(error.message).replace(/https?:\/\/\S+/g,'[private URL]').slice(0,1200)}`)}finally{await browser.close()}
}
if(process.argv[1]===import.meta.filename) {
 const open=await readFile('.rer/local/open-url','utf8')
 await browserJourney(open.trim(),{directory:process.env.MALLET_SCREENSHOTS??'.cache/browser'})
}
