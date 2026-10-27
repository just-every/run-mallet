import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {patternFixture} from './support/quality-patterns-journey.mjs'
export async function patternBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=10&partsTaxable=yes&laborTaxable=yes'});assert.equal(setup.status,303)
  h.person=publicDoor(h.origin,h.owner).person
  const {f,second,unrelated}=await patternFixture(h)
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM_PATH?{executablePath:process.env.MALLET_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_PATTERN_PROOF_DIR??'.cache/quality-patterns-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})} }
  await p.goto(h.origin+'/app/inventory/trace');await p.getByRole('link',{name:'Supplier quality patterns',exact:true}).click()
  assert.ok((await p.locator('main').innerText()).includes('2 matching cases'));assert.ok((await p.locator('main').innerText()).includes('1 other symptoms'));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const cited=p.locator('details').filter({hasText:'synthetic-mallet-116'}).first();await cited.locator('summary').click();assert.ok((await cited.innerText()).includes('Pad thickness: 4.2 mm'));assert.ok((await cited.innerText()).includes('synthetic-mallet-702'));assert.ok((await cited.innerText()).includes('$5.00'));await shot('01-cluster')
  await p.getByRole('button',{name:'Prepare cited packet',exact:true}).click();await p.waitForLoadState('domcontentloaded')
  for(const [id,outcome]of [[f.warranty.id,'include'],[second.id,'include'],[unrelated.id,'reject']]){
   await p.setViewportSize({width:1440,height:1000})
   const form=p.locator(`[data-case="${id}"] form`);await form.locator('[name="outcome"]').selectOption(outcome);await form.locator('[name="reason"]').fill(outcome==='reject'?'Radio reception is unrelated to failed pad bonding':'Reviewed independent failed pad evidence');await form.getByRole('button',{name:'Record association decision'}).click();await p.waitForLoadState('domcontentloaded')
  }
  assert.match(await p.locator(`[data-case="${unrelated.id}"]`).innerText(),/reject · Radio reception/)
  await shot('02-reviewed-packet')
  await p.setViewportSize({width:1440,height:1000})
  const approve=p.locator('form:has(input[value="pattern.approve"])');await approve.locator('[name="reference"]').fill('synthetic-mallet-708');await approve.locator('[name="reason"]').fill('Owner reviewed exact cited supplier claim costs');await approve.locator('[name="confirm"]').check();await approve.getByRole('button',{name:'Approve supplier claim'}).click();await p.waitForLoadState('domcontentloaded')
  // The native privileged door requests the existing fresh confirmation when necessary.
  if(!(await h.state()).records.qualityPattern[0].approval){await h.stepUp();await p.goto(h.origin+'/app/inventory/quality-patterns');const retry=p.locator('form:has(input[value="pattern.approve"])');await retry.locator('[name="reference"]').fill('synthetic-mallet-708');await retry.locator('[name="reason"]').fill('Owner reviewed exact cited supplier claim costs');await retry.locator('[name="confirm"]').check();await retry.getByRole('button',{name:'Approve supplier claim'}).click();await p.waitForLoadState('domcontentloaded')}
  const packet=(await h.state()).records.qualityPattern[0];assert.equal(packet.approval.amountCents,7000);assert.equal(packet.approval.claims.length,2);assert.ok((await p.locator('main').innerText()).includes('not submitted by Mallet'));assert.ok((await p.locator('main').innerText()).includes('$70.00'));assert.equal(await p.getByRole('button',{name:'Approve supplier claim',exact:true}).count(),0);await shot('03-approved-claim')
  await p.setViewportSize({width:1440,height:1000});await p.goto(h.origin+'/app/jobs/'+f.job.id+'/warranty');assert.equal(await p.getByRole('button',{name:'Approve claim record',exact:true}).count(),0);await shot('04-warranty-claim-balance')
  const manager=await h.person('pattern-native-manager@example.test');await h.command('staff.grant',{operatorId:manager.id,version:0,role:'manager',location:'shop',spendCents:8000,costRight:true,confirm:'grant-staff',reason:'Owner approved reviewed supplier claims'})
  await context.clearCookies();await context.addCookies(manager.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));await p.goto(h.origin+'/app/staff');await shot('05-manager-workspace');await p.setViewportSize({width:1440,height:1000});await p.getByRole('link',{name:'Supplier quality patterns',exact:true}).click();assert.ok((await p.locator('main').innerText()).includes('not submitted by Mallet'))
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
