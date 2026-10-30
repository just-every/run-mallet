import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {retailFixture} from './support/retail-journey.mjs'
export async function retailBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const f=await retailFixture(h);await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_RETAIL_PROOF_DIR??'.cache/retail-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await p.screenshot({path:directory+'/'+name+'-'+width+'.png',fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`)
  await p.goto(h.origin+'/app/retail');assert.equal(await p.getByRole('heading',{name:'Retail counter',exact:true}).count(),1)
  await form('retail.sell').getByLabel('Accessory barcode',{exact:true}).fill(f.item.barcode)
  await form('retail.sell').getByLabel('Bin barcode',{exact:true}).fill(f.bin.barcode)
  await form('retail.sell').getByLabel('Quantity',{exact:true}).fill('3')
  await form('retail.sell').getByLabel('Unit price (USD)',{exact:true}).fill('0.99')
  await form('retail.sell').getByLabel('Cash received (USD)',{exact:true}).fill('5.00')
  await shot('01-cash-sale')
  await form('retail.sell').getByRole('button',{name:'Record cash sale',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  let report=await h.api('/api/mallet/retail');assert.deepEqual([report.sales.length,report.netCashCents],[1,319],await p.locator('main').innerText())
  const post=fields=>h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields).toString()})
  const replay=await post({command:'retail.sell',...report.sales[0].request,reference:report.sales[0].reference,unitUsd:'0.99',cashUsd:'5.00'})
  assert.equal(replay.status,303);assert.equal((await h.api('/api/mallet/retail')).netCashCents,319,'Native sale replay records cash once')
  assert.ok((await p.locator('main').innerText()).includes('Change $1.81'))
  await shot('02-immutable-receipt')
  await p.getByText('Record accessory return',{exact:true}).click()
  await form('retail.return').getByLabel('Returned quantity',{exact:true}).fill('1')
  await form('retail.return').getByLabel('Inspection and cash return evidence',{exact:true}).fill('Inspected saleable accessory; handed back $1.06')
  await form('retail.return').locator('[name="confirm"]').check()
  await form('retail.return').getByRole('button',{name:'Record cash return',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  report=await h.api('/api/mallet/retail');assert.deepEqual([report.returns.length,report.netCashCents],[1,213])
  assert.equal((await post({command:'retail.return',...report.returns[0].request,reference:report.returns[0].reference})).status,303)
  assert.equal((await h.api('/api/mallet/retail')).netCashCents,213,'Native return replay records cash once')
  assert.ok((await p.locator('main').innerText()).includes('Cash $1.06'))
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Counter screen fits the assertion width')
  await shot('03-partial-return')
  // Submit the native form directly to prove its server fence exceeds browser validation.
  const response=await h.mf.dispatchFetch(h.origin+'/app/actions',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({command:'retail.return',saleId:report.sales[0].id,quantity:'3',reference:'synthetic-mallet-retail-browser-excess',reason:'Must refuse excess',confirm:'saleable-cash-returned'}).toString()})
  assert.equal(response.status,409);assert.equal((await h.api('/api/mallet/retail')).netCashCents,213)
  await p.setContent(await response.text());await shot('04-excess-return-refused')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
