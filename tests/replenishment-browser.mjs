import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {replenishmentFixture} from './support/replenishment-journey.mjs'
export async function replenishmentBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
 const f=await replenishmentFixture(h);browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext()
 await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
 const p=await context.newPage(),directory=process.env.MALLET_REPLENISHMENT_PROOF_DIR??'.cache/replenishment-browser';await mkdir(directory,{recursive:true})
 const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}}
 await p.goto(h.origin+'/app/inventory/replenishment');if(new URL(p.url()).pathname==='/setup'){await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup',exact:true}).click();await p.goto(h.origin+'/app/inventory/replenishment')}
 const form=p.locator('form').filter({has:p.locator('input[name="command"][value="stock.replenishment"]')})
 for(const [key,value]of Object.entries(f.policy)){const el=form.locator('[name="'+key+'"]');if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(value);else await el.fill(String(value))}
 await form.getByRole('button').click();await p.waitForLoadState('domcontentloaded');assert.ok((await p.locator('main').innerText()).includes('Suggested 8'));await shot('01-low-stock-with-outstanding-po')
 await p.getByRole('button',{name:'Prepare replenishment drafts',exact:true}).click();await p.waitForLoadState('domcontentloaded');await p.getByRole('button',{name:'Prepare replenishment drafts',exact:true}).click();await p.waitForLoadState('domcontentloaded')
 assert.equal((await h.state()).records.purchaseOrder.length,2);await shot('02-deducted-reviewable-draft')
 await p.getByRole('link',{name:'Review purchase orders',exact:true}).click();const approval=p.locator('form').filter({has:p.locator('input[name="command"][value="purchase.approve"]')});await approval.locator('[name="reason"]').fill('Review exact replenishment spend');await shot('03-exact-cart-review')
 await approval.getByRole('button',{name:'Approve spend',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.equal((await h.state()).records.purchaseOrder.filter(po=>po.approval).length,2);await shot('04-approved-cart-not-placed')
 }finally{await browser?.close();await h.close()}
}
