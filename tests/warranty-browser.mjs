import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {warrantyOriginal,noChargeWork} from './support/warranty-journey.mjs'
export async function warrantyBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=10&partsTaxable=yes&laborTaxable=yes'});assert.equal(setup.status,303)
  const f=await warrantyOriginal(h),original=JSON.stringify(f.invoice)
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext();await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C19_PROOF_DIR??'.cache/warranty-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  const form=c=>p.locator(`form:has(input[name="command"][value="${c}"])`),fill=async(target,fields,button)=>{for(const [name,value]of Object.entries(fields)){const el=target.locator(`[name="${name}"]`);if(await el.evaluate(e=>e.tagName)==='SELECT')await el.selectOption(String(value));else await el.fill(String(value))}await target.getByRole('button',{name:button,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/jobs/'+f.job.id);await p.getByRole('link',{name:'Warranty & comeback work',exact:true}).click();await shot('warranty-01-original')
  await fill(form('payment.record'),{method:'cash',reference:'synthetic-mallet-85',evidence:'Cash counted against original invoice'},'Record tender evidence')
  await fill(form('warranty.terms'),{terms:'Shop-declared 12 months and 100000 absolute miles; installed pad and no-charge replacement labor'},'Save warranty terms')
  await p.getByText('Open a linked comeback',{exact:true}).click();const use=(await h.state()).records.stockUse.find(u=>u.jobId===f.job.id)
  await fill(form('warranty.open'),{failure:'Same squeal; failed pad bonding',mileage:65000,stockUseId:use.id},'Open rework repair')
  assert.ok((await p.locator('main').innerText()).includes('Within saved time and mileage bounds'));await shot('warranty-02-linked-rework')
  await fill(form('warranty.decide'),{outcome:'covered',responsibility:'supplier',reason:'Supplier-marked pad failed within saved terms; shop approves no-charge work'},'Record coverage decision')
  let w=(await h.state()).records.warranty[0];const job=await noChargeWork(h,w);await p.reload()
  for(const [i,a]of job.actuals.entries())await fill(form('warranty.cost'),{actualId:a.id,amountUsd:i?20:15,evidence:i?'Actual replacement labor cost':'Replacement pad cost'},'Record rework cost')
  await fill(form('warranty.claim'),{claimant:'Cedar Parts',reference:'synthetic-mallet-86',amountUsd:35,evidence:'Reviewed cost and installed lot evidence'},'Approve claim record')
  assert.ok((await p.locator('main').innerText()).includes('not submitted by Mallet'));await shot('warranty-03-approved-cost-and-claim')
  for(const status of ['submitted','accepted','credited'])await fill(form('warranty.claimOutcome'),{status,creditUsd:30,evidence:'External supplier '+status+' confirmation'},'Record external claim evidence')
  assert.ok((await p.locator('main').innerText()).includes('net comeback cost $5.00'));await shot('warranty-04-credit-and-net-cost')
  assert.equal(JSON.stringify((await h.state()).records.invoice.find(i=>i.id===f.invoice.id)),original);assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
