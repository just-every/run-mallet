import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {installation,assetInput} from './harness.mjs'
export async function searchBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  await shopSetup(h)
  const contact=await h.command('contact.save',{name:'Lakeside Fleet Dispatch',email:'dispatch@example.test',phone:'216-555-0147',communication:'none',notes:''}),accounts=[]
  for(let i=0;i<51;i++)accounts.push(await h.command('customer.save',{name:'Lakeside service account '+String(i+1).padStart(2,'0'),kind:'fleet',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown',notes:''}))
  let vehicle=await h.command('asset.create',{...assetInput('OH-4471'),label:'2019 Honda CR-V EX'});vehicle=await h.command('customer.linkAsset',{assetId:vehicle.id,version:vehicle.version,customerId:accounts[0].id,customerVersion:accounts[0].version,reason:'Customer confirmed the fleet vehicle relationship'})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/ops-browser';await mkdir(directory,{recursive:true});const errors=[];p.on('pageerror',e=>errors.push(e.message))
  const shot=async(name)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await p.screenshot({path:join(directory,name+'-'+width+'.png')});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}}
  await p.goto(h.origin+'/app/accounts');await p.getByLabel('Search accounts by name, phone or plate').fill('2165550147');await p.getByRole('button',{name:'Search accounts',exact:true}).click();await p.waitForLoadState('domcontentloaded');await shot('search-01-phone-first-page');assert.equal(await p.locator('[id^="account-"]').count(),50)
  await p.getByRole('link',{name:'Next accounts',exact:true}).click();await p.waitForLoadState('domcontentloaded');await shot('search-02-next-page');assert.equal(await p.locator('[id^="account-"]').count(),1);assert.equal(await p.getByRole('link',{name:'Next accounts',exact:true}).count(),0)
  await p.getByLabel('Search accounts by name, phone or plate').fill('OH-4471');await p.getByRole('button',{name:'Search accounts',exact:true}).click();await p.waitForLoadState('domcontentloaded');await shot('search-03-plate');assert.equal(await p.locator('[id^="account-"]').count(),1);assert.equal(await p.locator('#account-'+accounts[0].id).count(),1);await p.locator('#account-'+accounts[0].id).getByRole('link',{name:'Open account and vehicle details',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.equal(await p.locator('[id^="account-"]').count(),1);assert.ok((await p.locator('#account-'+accounts[0].id).innerText()).includes('2019 Honda CR-V EX'));await shot('search-04-account-management');assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
