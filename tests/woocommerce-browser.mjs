import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {wooFixture} from './support/woocommerce-journey.mjs'
export async function woocommerceBrowser(){
 const f=await wooFixture({network:true,secureNetwork:true,assets:true}),{h}=f;let browser
 try{
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  const directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/woocommerce-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.getByRole('heading',{name:'WooCommerce',exact:true}).first().scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon controls have tooltips');await page.getByRole('heading',{name:'WooCommerce',exact:true}).first().locator('..').screenshot({path:join(directory,name+'-'+width+'.png')})}await page.setViewportSize({width:1440,height:1000})}
  const form=command=>page.locator('form').filter({has:page.locator('input[name="command"][value="'+command+'"]')})
  await page.goto(h.origin+'/setup');await page.getByLabel('Sales tax rate (%)',{exact:true}).fill('0');await page.getByLabel('I confirm this owner account is ready to use.').check();await page.getByRole('button',{name:'Finish setup',exact:true}).click();await page.waitForLoadState('domcontentloaded');await page.goto(h.origin+'/app/connectors');assert.equal(page.url(),h.origin+'/app/connectors',await page.locator('body').innerText());assert.ok(await form('woocommerce.map').count(),await page.locator('body').innerText())
  await form('woocommerce.map').getByLabel('WooCommerce product ID').fill(String(f.product.id));await form('woocommerce.map').getByRole('button').click();await page.waitForLoadState('domcontentloaded')
  assert.equal((await h.api('/api/mallet/woocommerce')).mappings.length,1)
  await shot('woo-mapped')
  assert.equal((await f.event()).status,200);const refund=await f.refund();assert.equal((await f.event()).status,200)
  await page.reload();await form('woocommerce.reconcile').getByLabel('WooCommerce order ID').fill(String(f.order.id));await form('woocommerce.reconcile').getByLabel('Returned goods: approved refund IDs (optional)').fill(String(refund.id));await form('woocommerce.reconcile').getByRole('button').click();await page.waitForLoadState('domcontentloaded')
  const view=await h.api('/api/mallet/woocommerce');assert.equal(view.balances[0].onHandMilli,9000);assert.equal(view.orders.length,1);assert.equal(view.refunds.length,1)
  assert.ok((await page.locator('main').innerText()).includes('synthetic-mallet-payment-61'));assert.ok((await page.locator('main').innerText()).includes('Refund '+refund.id));assert.deepEqual((await h.state()).records.payment??[],[])
  await shot('woo-refund-reconciled')
  await form('woocommerce.disable').getByRole('button').click();await page.waitForLoadState('domcontentloaded');assert.equal((await h.api('/api/mallet/woocommerce')).connection.enabled,0);assert.equal((await f.event()).status,409);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
