import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking} from './harness.mjs'
import {assetFixtures,assetInput} from './support/asset-journey.mjs'
import {deviceResult} from './support/diagnostic-results-journey.mjs'
export async function diagnosticResultsBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const asset=await h.command('asset.create',assetInput(assetFixtures[1])),{job}=await booking(h,{asset})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext();await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  const dir=process.env.MALLET_DIAGNOSTIC_PROOF_DIR??'.cache/diagnostic-results-browser';await mkdir(dir,{recursive:true});const panel=p.locator('#provider-results')
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await panel.scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));for(const el of await panel.locator('a,button').all())if(await el.isVisible())assert.ok((await el.innerText()).trim());await panel.screenshot({path:join(dir,name+'-'+width+'.png')})}}
  await p.goto(h.origin+'/app/jobs/'+job.id);await shot('01-import')
  const form=p.locator('form:has(input[name="command"][value="diagnosticResult.importPhonecheck"])')
  await form.locator('[name="raw"]').fill(deviceResult());await form.getByRole('button',{name:'Import private result'}).click();await p.waitForLoadState('domcontentloaded');assert.ok((await panel.innerText()).includes('Identifier matched'));assert.ok((await panel.innerText()).includes('Face ID'));await shot('02-matched')
  await form.locator('[name="raw"]').fill(deviceResult('synthetic-mallet-999'));await form.getByRole('button',{name:'Import private result'}).click();await p.waitForLoadState('domcontentloaded');assert.ok((await panel.innerText()).includes('Quarantined mismatch'));await shot('03-quarantined')
  await panel.getByText('Original result JSON',{exact:true}).first().click();assert.ok((await panel.locator('pre').first().innerText()).includes('source content ran'));await shot('04-original')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
