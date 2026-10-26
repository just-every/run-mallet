import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {profitabilityJourney,profitPath} from './support/profitability-journey.mjs'
export async function profitabilityBrowser(){
 const h=await installation({network:true,assets:true});let browser
 try{
  const f=await profitabilityJourney(h,{recovery:false})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Chicago',locale:'en-US'})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
  await mkdir('.cache/profitability-browser',{recursive:true})
  const shot=async(name,target=page.locator('main'))=>{
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(requestAnimationFrame))
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow '+name+' '+width)
    assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Icon-only controls have tooltips')
    await page.screenshot({path:'.cache/profitability-browser/'+name+'-'+width+'.png',fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
  await page.goto(h.origin+'/app/jobs');await shot('01-repair-orders')
  await page.getByRole('link',{name:'Repair profitability',exact:true}).click()
  await page.getByLabel('From (UTC date)',{exact:true}).fill(f.original.createdAt.slice(0,10));await page.getByLabel('To (UTC date, inclusive)',{exact:true}).fill(f.original.createdAt.slice(0,10));await page.getByRole('button',{name:'Show report',exact:true}).click()
  await page.waitForLoadState('domcontentloaded');assert.match(await page.locator('main').innerText(),/\$189\.50/);await shot('02-profitability-report')
  const original=page.locator('#profit-'+f.original.id)
  assert.match(await original.innerText(),/\$260\.00[\s\S]*\$214\.50[\s\S]*\$189\.50/)
  await original.getByText('Source cost events',{exact:true}).click();await shot('03-original-cost-events',original)
  assert.match(await original.innerText(),/part-use · \$60\.00[\s\S]*saleable-return · -\$15\.00[\s\S]*core-credit · -\$12\.00[\s\S]*sublet-bill · \$90\.00[\s\S]*labor-timer · \$60\.00/)
  await original.getByText('Retained source detail',{exact:true}).last().click();await shot('04-loaded-timer-source',original)
  await page.getByText('By supplier',{exact:true}).click();await shot('05-supplier-comparison',page.getByText('By supplier',{exact:true}))
  const comeback=page.locator('#profit-'+f.comeback.id);await comeback.getByText('Source cost events',{exact:true}).click();await shot('06-comeback-cost-events',comeback)
  assert.match(await comeback.innerText(),/warranty-cost · \$15\.00[\s\S]*warranty-cost · \$20\.00[\s\S]*warranty-recovery · -\$10\.00/)
  await page.getByRole('link',{name:'Loaded labor cost settings',exact:true}).click()
  const settings=page.locator('#cost-'+f.owner.id);await settings.getByLabel('Loaded hourly cost (USD)',{exact:true}).fill('50');await settings.getByLabel('Effective from (UTC date)',{exact:true}).fill('2026-01-01');await settings.getByLabel('Loaded cost basis and reason',{exact:true}).fill('Updated owner-declared loaded wage and benefits basis')
  await shot('07-loaded-cost-settings',settings);await settings.getByRole('button',{name:'Save loaded cost',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  assert.match(await settings.innerText(),/\$50\.00 per hour from 2026-01-01/);await shot('08-saved-cost-history',settings)
  const changed=await h.api(profitPath+f.query);assert.equal(changed.realized.grossProfitCents,17450);assert.equal(changed.repairs.find(r=>r.jobId===f.original.id).estimated.grossProfitCents,26000)
  await page.goto(h.origin+'/app/reports/profitability'+f.query);assert.match(await page.locator('main').innerText(),/\$174\.50/);await shot('09-recomputed-report')
  await page.goto(h.origin+'/app/reports/profitability?from=2000-01-01&to=2000-01-01');assert.match(await page.locator('main').innerText(),/No repairs booked/);await shot('10-empty-period')
  const denied=await browser.newContext({viewport:{width:1440,height:1000}});await denied.addCookies(f.advisor.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const advisor=await denied.newPage()
  for(const width of [1440,390]){await advisor.setViewportSize({width,height:1000});assert.equal((await advisor.goto(h.origin+'/app/reports/profitability'+f.query)).status(),403);await advisor.screenshot({path:'.cache/profitability-browser/11-advisor-refused-'+width+'.png',fullPage:true})}
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
