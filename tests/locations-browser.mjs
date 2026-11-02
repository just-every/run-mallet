import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {locationFixture} from './support/locations-journey.mjs'
const cookies=(h,cookie)=>cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin}))
export async function locationsBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),p=await context.newPage(),dir=process.env.MALLET_LOCATION_PROOF_DIR??'.cache/locations-browser';await mkdir(dir,{recursive:true});p.setDefaultTimeout(8000)
  const use=async cookie=>{await context.clearCookies();await context.addCookies(cookies(h,cookie))}
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  await use(h.owner);await p.goto(h.origin+'/setup');await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('7.25');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup'}).click();await p.waitForURL('**/app')
  const f=await locationFixture(h),manager=await h.person('synthetic-mallet-location-browser@example.test');await h.stepUp();await p.goto(h.origin+'/app/staff-access')
  const grant=p.locator('section.card').filter({has:p.getByRole('heading',{name:'synthetic-mallet-location-browser',exact:true})}).locator('form').first()
  await grant.getByLabel('Staff role').selectOption('manager');await grant.locator('select[name="location"]').selectOption(f.a.id);await grant.getByLabel('Discount limit (%)').fill('5');await grant.getByLabel('Spend limit (USD)').fill('100');await grant.getByLabel('Delegation reason').fill('Manager for California only');await grant.getByLabel('I approve these exact rights and limits.').check();await grant.getByRole('button',{name:'Save staff grant'}).click();await p.waitForURL('**/app/staff-access')
  assert.equal(await grant.locator('select[name="location"]').inputValue(),f.a.id);await shot('01-owner-location-grant')
  await use(manager.cookie);await p.goto(h.origin+'/app/staff');assert.match(await p.locator('main').innerText(),/CA brake service/);assert.doesNotMatch(await p.locator('main').innerText(),/TX brake service/);assert.equal(await p.locator('select[name="staffJob"] option').count(),1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0);await shot('02-manager-own-location')
  const denied=await h.command('estimate.prepare',{jobId:f.second.job.id,version:f.second.job.version,lines:[]},{as:manager.cookie,status:403});assert.equal(denied.error,'LOCATION_SCOPE')
 }finally{await browser?.close();await h.close()}
}
