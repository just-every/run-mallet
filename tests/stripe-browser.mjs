import {terminalEdge} from './support/terminal-journey.mjs'
import {terminalBrowserSteps} from './support/terminal-browser-steps.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {readyInvoice} from './support/return-journey.mjs'
import {collectionEdge} from './support/stripe-journey.mjs'
export async function stripeBrowser(){
 const edge=collectionEdge(),readerEdge=terminalEdge();let readerMode=false
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:request=>readerMode?readerEdge.edge(request):edge.edge(request)});let browser
 try{
  await shopSetup(h)
  const reviewer=await publicDoor(h.origin,h.owner).person('synthetic-mallet-821@example.test','admin'),{invoice}=await readyInvoice(h,{reviewer});await h.stepUp()
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('.cache/stripe-browser',{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Payment screen fits '+width);assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0);await page.screenshot({path:'.cache/stripe-browser/'+name+'-'+width+'.png',fullPage:true})}}
  await page.goto(h.origin+'/app/stripe');await shot('01-account');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Check and connect account'}).click();await page.waitForLoadState('domcontentloaded');assert.match(await page.locator('main').innerText(),/Test mode/);await shot('02-connected')
  await page.getByRole('link',{name:'Manage private Stripe key'}).click();await shot('02b-credentials');await page.getByRole('link',{name:'Stripe merchant connection'}).click()
  await page.goto(h.origin+'/app/invoices/'+invoice.id);await page.getByRole('link',{name:'Collect payment with Stripe'}).click();await page.locator('form:has(input[name="command"][value="checkout"])').getByRole('checkbox').check();await page.getByRole('button',{name:'Create hosted checkout'}).click();await page.waitForLoadState('domcontentloaded');assert.equal(await page.getByRole('link',{name:'Open Stripe checkout'}).count(),1);await shot('03-open-checkout')
  edge.paid();const eventId=edge.providerEvent('synthetic-mallet-820');await page.getByLabel('Stripe payment event ID').fill(eventId);await page.getByRole('button',{name:'Reconcile provider event'}).click();await page.waitForLoadState('domcontentloaded');assert.match(await page.locator('main').innerText(),/Outstanding \$0.00/);await shot('04-paid')
  await page.getByRole('button',{name:'Reconcile fee and payout'}).click();await page.waitForLoadState('domcontentloaded');assert.match(await page.locator('main').innerText(),/Fee \$1.10/);await shot('05-fee');readerMode=true;await terminalBrowserSteps({h,page,edge:readerEdge,reviewer,shot});assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
