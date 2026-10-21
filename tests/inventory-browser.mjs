import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
export async function inventoryBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const directory=process.env.MALLET_INVENTORY_PROOF_DIR??'.cache/inventory-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' no overflow at '+width);await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(c,fields,button)=>{const f=form(c);for(const [name,value]of Object.entries(fields))await f.locator(`[name="${name}"]`).fill(String(value));await f.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/inventory');await shot('01-empty-and-receiving-forms')
  await fill('stock.item',{sku:'synthetic-mallet-1',barcode:'synthetic-mallet-2',name:'Brake pads',unit:'each'},'Register part')
  await fill('stock.bin',{code:'Shelf A',barcode:'synthetic-mallet-3'},'Register bin')
  const scans={itemBarcode:'synthetic-mallet-2',binBarcode:'synthetic-mallet-3'}
  await fill('stock.receive',{...scans,expectedQuantity:10,quantity:9,reference:'synthetic-mallet-4',reason:'One unit missing'},'Receive stock')
  assert.ok((await p.locator('main').innerText()).includes('Labeled 10 · Received 9 · Shortage 1'));await shot('02-shipment-shortage-and-ledger')
  await p.getByRole('link',{name:'Start a blind or cycle count'}).click();assert.ok(!(await p.locator('main').innerText()).includes('On hand 9'));await shot('03-blind-count')
  await fill('stock.count',{...scans,quantity:8,reason:'Physical count confirmed shortage'},'Submit count')
  assert.ok((await p.locator('main').innerText()).includes('On hand 9'));await shot('04-variance-awaiting-approval')
  await fill('stock.approveCount',{reason:'Recount confirmed one missing'},'Approve variance')
  assert.ok((await p.locator('main').innerText()).includes('On hand 8'));assert.ok((await p.locator('main').innerText()).includes('Adjustment approved'));await shot('05-reconciled-stock-and-variance')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
