import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking} from './harness.mjs'
import {custodyPhoto} from './support/intake-journey.mjs'
export async function intakeBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=0&partsTaxable=yes'});assert.equal(setup.status,303)
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext();await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C19_PROOF_DIR??'.cache/intake-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  for(const [i,label,item,kind]of [[1,'2019 Honda CR-V','Spare key','key'],[2,'Repair tablet','Charger','accessory']]){
   const asset=await h.command('asset.create',{customerName:'Dana Brooks',label,identifier:'synthetic-mallet-'+(72+i)}),{job}=await booking(h,{asset,startAt:`2026-10-${10+i}T09:00:00Z`,endAt:`2026-10-${10+i}T10:00:00Z`}),photo=await custodyPhoto(h,job)
   await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByRole('link',{name:'Condition & custody receipts'}).click();await shot('intake-'+i+'-empty')
   const record=p.locator('form:has(input[value="intake.record"])')
   await record.getByLabel('Damage locations and condition',{exact:true}).fill(i===1?'Left front door dent at lower edge':'Screen uncracked; charger present')
   await record.getByLabel('Custody items',{exact:false}).fill(kind+' | '+item+' | 1')
   await record.getByLabel('Security-lock handling',{exact:false}).fill('Customer unlocks in person; no secret retained')
   await record.locator(`input[name="attachmentIds"][value="${photo.id}"]`).check()
   await record.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await record.locator('[name="consent"]').check();await record.getByRole('button',{name:'Sign custody receipt',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   assert.ok((await p.locator('main').innerText()).includes(item+' × 1'));assert.equal(await p.getByRole('link',{name:'condition.png'}).count(),1);await shot('intake-'+i+'-signed')
   await p.getByText('Compare the actual handover checklist',{exact:true}).click();const compare=p.locator('form:has(input[value="intake.compare"])');await compare.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await compare.locator('[name="consent"]').check();await compare.getByRole('button',{name:'Sign checklist comparison',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok((await p.locator('main').innerText()).includes(item+': 1 of 1 returned · 0 missing'));await shot('intake-'+i+'-compared')
  }
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
