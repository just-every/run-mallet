import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking,estimate,authorise} from './harness.mjs'
import {traceFixture} from './support/stock-trace-journey.mjs'
export async function traceBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const f=await traceFixture(h),{job:booked}=await booking(h),q=await authorise(h,await estimate(h,booked));let job=(await h.state()).records.job.find(j=>j.id===booked.id);job=await h.command('work.record',{jobId:job.id,version:job.version,lineId:q.revisions[0].lines[0].id,quantity:1})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_TRACE_PROOF_DIR??'.cache/stock-trace-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await p.locator('main').screenshot({path:join(directory,name+'-'+width+'.png')})}await p.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/inventory/trace');if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.waitForLoadState('domcontentloaded');await p.goto(h.origin+'/app/inventory/trace')}
  const catalog=form('stock.catalog').filter({has:p.locator(`input[name="itemId"][value="${f.item.id}"]`)});await catalog.locator('..').locator('summary').click()
  await fill(catalog,{name:f.catalog.name,crossReferences:f.catalog.crossReferences,fitment:f.catalog.fitment,costUsd:10.01,sellUsd:25,warranty:f.catalog.warranty,supersededBy:f.replacement.id},'Save catalog details')
  assert.ok((await p.locator('main').innerText()).includes(f.catalog.fitment));await shot('01-declared-catalog-and-receiving')
  const receive=async(lot,reference)=>fill(form('stock.lot'),{...f.scans,quantity:2,supplier:f.lot.supplier,supplierLot:lot,reference,costUsd:10.01,evidence:'Packing slip and marked supplier lot'},'Receive traceable stock')
  await receive(f.lot.supplierLot,f.lot.reference);await receive('synthetic-mallet-36','synthetic-mallet-37');await shot('02-two-lots-in-one-bin')
  const lot=(await h.state()).records.stockLot.find(l=>l.supplierLot===f.lot.supplierLot)
  await fill(form('stock.useLot'),{actualSource:JSON.stringify({jobId:job.id,version:job.version,actualId:job.actuals[0].id}),lotId:lot.id,quantity:1,reference:'synthetic-mallet-44',reason:'Technician identified installed part from package lot'},'Record installed lot')
  assert.ok((await p.locator('main').innerText()).includes('Used 1 · Cost $10.01'));await shot('03-installed-lot-and-vehicle')
  for(const [query,affected]of [[f.lot.supplierLot,true],['synthetic-mallet-36',false]]){await p.getByLabel('Search supplier lot, serial or SKU',{exact:true}).fill(query);await p.getByRole('button',{name:'Search traceability',exact:true}).click();await p.waitForLoadState('domcontentloaded');const text=await p.locator('main').innerText();assert.equal(text.includes('Used 1 · Cost $10.01'),affected);await shot(affected?'04-affected-repair-only':'05-unconsumed-lot-no-repair')}
  const use=(await h.state()).records.stockUse[0];assert.equal(use.jobId,job.id);assert.equal(use.lotId,lot.id);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
