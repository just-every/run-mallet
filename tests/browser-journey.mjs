import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'

export async function browserJourney(openUrl,{directory='.cache/browser',fixtures='tests/fixtures/repairshopr'}={}) {
 await mkdir(directory,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--disable-gpu','--use-mock-keychain','--password-store=basic']})
 let stage='open app'
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  await page.goto(openUrl)
  await page.waitForURL(url=>['/setup','/app'].includes(url.pathname))
  if(new URL(page.url()).pathname==='/setup') {await page.getByLabel('Sales tax rate (%)').fill('10');await page.getByLabel('Labor is taxable').check();await page.getByRole('checkbox',{name:'I confirm this owner account is ready to use.'}).check();await page.getByRole('button',{name:'Finish setup'}).click()}
  await page.waitForURL('**/app')
  const origin=new URL(page.url()).origin
  const shot=async name=>{
   stage=name
   for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Page fits its viewport')
    await page.screenshot({path:join(directory,`${name}-${width}.png`),fullPage:true,...(name==='21-key-created'?{mask:[page.locator('pre')]}:{})})
   }
  }
  const click=async name=>{await page.getByRole('button',{name,exact:true}).click();await page.waitForLoadState('domcontentloaded')}
  await shot('01-board')
  await page.getByRole('link',{name:'New repair order'}).first().click();await page.waitForURL(url=>url.pathname==='/app/customers')
  await page.getByLabel('Customer name',{exact:true}).fill('Northside Cycles')
  await page.getByLabel('Customer email').fill('service@northside.example')
  await page.getByLabel('Vehicle or device').fill('2019 Trek FX 3')
  await page.getByLabel('Plate, VIN or serial').fill('TREK-FX3-2019')
  await click('Add vehicle');const assetUrl=page.url();await shot('02-asset')
  await page.getByLabel('Repair request').fill('Brake pads and safety inspection')
  await page.getByLabel('Bay',{exact:true}).fill('Bay 2')
  await page.locator('select[name=technicianId]').selectOption({index:0})
  await page.getByLabel('Start (with timezone)').fill('2026-10-19T09:00:00+10:00')
  await page.getByLabel('End (with timezone)').fill('2026-10-19T11:00:00+10:00')
  await click('Book visit');const jobUrl=page.url();await shot('03-booked')
  await page.getByLabel('Part description').fill('Shimano B05S brake pads')
  await page.getByLabel('Part unit price (before tax)').fill('32.50')
  await page.getByLabel('Labor description').fill('Replace pads, adjust brakes and safety inspection')
  await page.getByLabel('Labor hours').fill('1.5')
  await page.getByLabel('Labor rate (per hour, before tax)').fill('110.00')
  await page.getByLabel('Notes',{exact:true}).fill('Customer requested an estimate before starting.')
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
  await click('Complete repair');await shot('10-completed')
  await click('Prepare invoice');await shot('11-invoice-draft')
  await click('Approve invoice');await shot('12-invoice-approved')
  await click('Export invoice once');await shot('13-invoice-exported')
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download saved invoice CSV'}).click()])
  await download.saveAs(join(directory,'invoice.csv'))
  assert.match(await readFile(join(directory,'invoice.csv'),'utf8'),/35.75/)
  await page.goto(assetUrl);await shot('14-service-history')
  await page.getByLabel('Repair request').fill('Follow-up wheel alignment')
  await page.getByLabel('Start (with timezone)').fill('2026-11-02T09:00:00+10:00')
  await page.getByLabel('End (with timezone)').fill('2026-11-02T10:00:00+10:00')
  await click('Book visit');await page.goto(assetUrl);assert.equal(await page.locator('.list li').count(),2);await shot('15-repeat-visit')
  const state=await (await page.request.get(origin+'/api/mallet/state')).json(),followup=state.records.job.find(j=>j.title==='Follow-up wheel alignment')
  const send=async(command,input,headers={})=>{const response=await page.request.post(origin+'/api/mallet/commands',{headers:{Origin:origin,...headers},data:{command,input}});assert.equal(response.status(),200);return response.json()}
  const preparation=await send('agent.create',{label:'Dispatch assistant'})
  await send('dispatch.prepare',{jobId:followup.id,version:followup.version,bayId:'Bay 3',technicianId:'Jordan Lee',startAt:'2026-11-03T09:00:00+10:00',endAt:'2026-11-03T10:00:00+10:00',reason:'Use the alignment stand after the wheel arrives'},{Authorization:'Bearer '+preparation.token})
  await page.goto(origin+'/app/jobs/'+followup.id);await shot('15-dispatch-proposed')
  await click('Approve dispatch plan');await shot('15-dispatch-approved')
  await send('agent.revoke',{id:preparation.id})
  await page.goto(origin+'/app/move-in');await shot('16-move-in')
  await page.getByLabel('Customers response JSON').fill(await readFile(join(fixtures,'customers.json'),'utf8'))
  await page.getByLabel('Customer assets response JSON').fill(await readFile(join(fixtures,'assets.json'),'utf8'))
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
  await page.getByLabel('Vehicle or device').fill('Unbooked inspection request')
  await page.getByLabel('Plate, VIN or serial').fill('UNUSED-INTAKE')
  await click('Add vehicle');await shot('22-unused-asset')
  await page.getByLabel('Type ERASE to confirm').fill('ERASE');await click('Erase unused asset')
  assert.equal(await page.getByRole('link',{name:'Unbooked inspection request'}).count(),0)
  await shot('23-erased-register')
  console.log('Browser repair, partial authorisation, invoice, history, import/undo, backup, key revocation and erasure journey passed at 1440 and 390.')
 }catch(error){throw new Error(`Browser journey failed at ${stage}: ${String(error.message).replace(/https?:\/\/\S+/g,'[private URL]').slice(0,1200)}`)}finally{await browser.close()}
}
if(process.argv[1]===import.meta.filename) {
 const open=await readFile('.rer/local/open-url','utf8')
 await browserJourney(open.trim(),{directory:process.env.MALLET_SCREENSHOTS??'.cache/browser'})
}
