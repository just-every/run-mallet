import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {archive,installation,restore} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {assertFindingOrigin,pricingJourney} from './support/pricing-journey.mjs'
export async function pricingBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const {job,quote,recipe,matrix,labor,origin}=await pricingJourney(h,{person:publicDoor(h.origin,h.owner).person})
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic','--no-sandbox']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  await mkdir('.cache/pricing-browser',{recursive:true})
  const shot=async(name,target)=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'EST-002 responsive '+name+' '+width);await page.screenshot({path:`.cache/pricing-browser/${name}-${width}.png`})}await page.setViewportSize({width:1440,height:1000})}
  const readOrigin=async(base,name)=>{
   await page.goto(base+'/app/jobs/'+job.id)
   await page.getByText('Saved service pricing calculation',{exact:true}).click()
   const saved=page.getByRole('region',{name:'Inspection finding origin',exact:true})
   assert.equal(await saved.isVisible(),true,'The saved estimate exposes its finding origin')
   for(const text of [job.id,origin.inspectionId,`version ${origin.inspectionVersion}`,`item ${origin.itemId}`,origin.result.id,origin.result.item.label,origin.mappedRecipe.id,`Mapped package: ${origin.mappedRecipe.snapshot.name} · revision ${origin.mappedRecipe.revision}`,`Priced package: ${origin.pricedRecipe.snapshot.name} · revision ${origin.pricedRecipe.revision}`])assert.ok((await saved.innerText()).includes(text),'Saved finding origin includes '+text)
   const reloaded=await page.request.get(base+'/api/mallet/repairs/'+job.id)
   assert.equal(reloaded.status(),200)
   assertFindingOrigin((await reloaded.json()).records.estimate.find(q=>q.id===quote.id),origin)
   await shot(name,saved)
  }
  await readOrigin(h.origin,'01-frozen-finding-origin')
  await page.goto(h.origin+'/app/jobs/'+job.id)
  await page.getByText('Saved service pricing calculation',{exact:true}).click()
  await shot('01-frozen-finding-price',page.getByText('Saved service pricing calculation',{exact:true}))
  const pricing=page.locator('#pricing');await pricing.getByText('Create a pricing matrix',{exact:true}).click()
  const create=pricing.locator('form').filter({has:page.locator('[name=version][value="0"]')})
  await create.getByLabel('Matrix name',{exact:true}).fill('Diagnostic hourly pricing');await create.locator('[name=kind]').selectOption('labor');await create.getByLabel('Minimum unit price / hourly rate (USD)',{exact:true}).fill('85');await create.getByLabel('Round up to increment (cents)',{exact:true}).fill('100');await create.locator('[name=bandMarkup0]').fill('50');await create.getByLabel('Reason for this revision',{exact:true}).fill('Owner diagnostic labor matrix');await shot('02-matrix-editor',create);await create.getByRole('button',{name:'Create pricing matrix',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  const saved=(await h.state()).records.pricingMatrix.find(m=>m.revisions[0].name==='Diagnostic hourly pricing');assert.ok(saved,'EST-002 native matrix editor saves real rule')
  await page.locator('#inspections').getByText('Reusable service recipes',{exact:true}).click();await page.locator('#inspections').getByText('Create a service recipe',{exact:true}).click()
  const editor=page.locator('form:has([name=command][value="inspectionJob.save"]):has([name=version][value="0"])')
  await editor.getByLabel('Service recipe name',{exact:true}).fill('Oil and filter phone package');await editor.locator('[name=lineDescription0]').fill('Oil filter');await editor.locator('[name=lineCost0]').fill('10');await editor.locator('[name=lineMatrix0]').selectOption(matrix.id);await editor.locator('[name=lineDescription1]').fill('Oil service labor');await editor.locator('[name=lineKind1]').selectOption('labor');await editor.locator('[name=lineCost1]').fill('55');await editor.locator('[name=lineMatrix1]').selectOption(labor.id);await editor.getByLabel('Reason for this recipe revision',{exact:true}).fill('New native package');await shot('03-package-editor',editor);await editor.getByRole('button',{name:'Create service recipe',exact:true}).click();await page.waitForLoadState('domcontentloaded')
  const newRecipe=(await h.state()).records.inspectionJob.find(r=>r.revisions[0].name==='Oil and filter phone package');assert.ok(newRecipe)
  // Use a third real visit so the native package action can prepare its first draft.
  const asset=(await h.state()).records.asset[0],techId=job.technicianId
  const third=await h.command('job.book',{assetId:asset.id,version:asset.version,title:'Oil service phone estimate',technicianId:techId,bayId:'Oil bay',startAt:'2026-12-01T09:00:00Z',endAt:'2026-12-01T10:00:00Z'})
  await page.goto(h.origin+'/app/jobs/'+third.id);await page.getByText('Prepare a service package',{exact:true}).click()
  const prepare=page.locator(`form:has([name=command][value="recipe.prepare"]):has([name=recipeId][value="${newRecipe.id}"])`)
  await prepare.locator('[name=pricingOverride0]').fill('19');await prepare.locator('[name=pricingOverrideReason0]').fill('Owner matching package offer');await shot('04-reasoned-package-override',prepare);await prepare.getByRole('button',{name:'Prepare service package',exact:true}).click();await page.waitForLoadState('domcontentloaded');await page.getByText('Saved service pricing calculation',{exact:true}).click();await shot('05-saved-native-package',page.getByText('Saved service pricing calculation',{exact:true}))
  const final=(await h.state()).records.estimate.find(q=>q.jobId===third.id);assert.equal(final.revisions[0].lines[0].unitCents,1900);assert.equal(final.revisions[0].inspectionSource.pricing[0].override.reason,'Owner matching package offer')
  assert.deepEqual((await h.state()).records.estimate.find(q=>q.id===quote.id),quote,'EST-002 native changes retain old estimate');assert.deepEqual(errors,[])
  await readOrigin(h.origin,'06-origin-after-native-edits')
  const fresh=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
  try{
   await restore(fresh,await archive(h))
   const setup=await fresh.mf.dispatchFetch(fresh.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:fresh.origin,cookie:fresh.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
   assert.notEqual((await fresh.state()).actor.id,(await h.state()).actor.id)
   await fresh.state({as:h.owner,status:401})
   await context.clearCookies()
   await context.addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})))
   await readOrigin(fresh.origin,'07-recovered-finding-origin')
   assert.deepEqual((await fresh.state()).records.estimate.find(q=>q.id===quote.id),quote)
  }finally{await fresh.close()}
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
