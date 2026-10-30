import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking,archive,restore} from './harness.mjs'
import {custodyPhoto,custodyMedia} from './support/intake-journey.mjs'
export async function intakeBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=0&partsTaxable=yes'});assert.equal(setup.status,303)
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:390,height:1000}});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C19_PROOF_DIR??'.cache/intake-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}}
  const videos=[]
  const {customersFixture}=await import('./support/customers-journey.mjs'),{input}=await customersFixture(h),account=await h.command('customer.save',input)
  for(const [i,label,item,kind]of [[1,'2019 Honda CR-V','Spare key','key'],[2,'Repair tablet','Charger','accessory']]){
   let asset=await h.command('asset.create',{customerName:'Dana Brooks',label,identifier:'synthetic-mallet-'+(72+i)});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Customer confirms custody account'});const {job}=await booking(h,{asset,startAt:`2026-10-${10+i}T09:00:00Z`,endAt:`2026-10-${10+i}T10:00:00Z`}),photo=await custodyPhoto(h,job)
   await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByRole('link',{name:'Condition & custody receipts'}).click();await shot('intake-'+i+'-empty')
   const record=p.locator('form:has(input[value="intake.record"])')
   await record.getByLabel('Damage locations and condition',{exact:true}).fill(i===1?'Left front door dent at lower edge':'Screen uncracked; charger present')
   await record.getByLabel('Custody items',{exact:false}).fill(kind+' | '+item+' | 1')
   await record.getByLabel('Security-lock handling',{exact:false}).fill('Customer unlocks in person; no secret retained')
   await record.locator(`input[name="attachmentIds"][value="${photo.id}"]`).check()
   await record.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await record.locator('[name="consent"]').check();await record.getByRole('button',{name:'Sign custody receipt',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   assert.ok((await p.locator('main').innerText()).includes(item+' × 1'));assert.equal(await p.getByRole('link',{name:'condition.png'}).count(),1);await shot('intake-'+i+'-signed')
   const encoded=await p.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(10),parts=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const done=new Promise(resolve=>{recorder.ondataavailable=e=>parts.push(e.data);recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(parts).arrayBuffer());resolve(btoa(String.fromCharCode(...bytes)))}});recorder.start();for(let frame=0;frame<5;frame++){ctx.fillStyle=frame%2?'#2874a6':'#c0392b';ctx.fillRect(0,0,32,32);await new Promise(r=>setTimeout(r,100))}recorder.stop();stream.getTracks().forEach(t=>t.stop());return done})
   const video=await custodyMedia(h,job,Buffer.from(encoded,'base64'),'after-condition.webm','video/webm','After condition — observed handover');videos.push(video);await p.reload()
   await record.locator('[name="phase"]').selectOption('after');await record.getByLabel('Damage locations and condition',{exact:true}).fill('Original condition unchanged after repair');await record.getByLabel('Security-lock handling',{exact:false}).fill('Customer retains unlock material');await record.locator(`input[name="attachmentIds"][value="${video.id}"]`).check();await record.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await record.locator('[name="consent"]').check();await record.getByRole('button',{name:'Sign custody receipt',exact:true}).click();await p.waitForLoadState('domcontentloaded');await shot('intake-'+i+'-after-video')
   await p.getByRole('link',{name:'after-condition.webm',exact:true}).click();await p.locator('video').evaluate(async v=>{await v.play();v.pause()});await shot('intake-'+i+'-playable-after-video');await p.goto(h.origin+'/app/jobs/'+job.id+'/intake')
   const secret=' synthetic-mallet-'+(80+i)+' ',purpose='Unlock for agreed diagnosis',reason='Perform customer-authorized diagnosis'
   const vault=p.locator('form:has(input[value="intake.secretStore"])')
   await vault.getByLabel('Unlock purpose',{exact:true}).fill(purpose)
   await vault.getByLabel('Temporary unlock secret',{exact:true}).fill(secret)
   await vault.locator('[name="consent"]').check();await vault.getByRole('button',{name:'Store temporary secret'}).click();await p.waitForLoadState('domcontentloaded');await p.reload()
   const storedState=await h.state(),owner=storedState.actor,stored=storedState.records.intakeSecretAudit.filter(row=>row.jobId===job.id&&row.action==='intake.secretStore')
   assert.equal(stored.length,1);assert.equal(stored[0].purpose,purpose);assert.equal(stored[0].consent,true);assert.deepEqual(stored[0].by,{id:owner.id,name:owner.name,role:'owner'})
   assert.equal(JSON.stringify(storedState).includes(secret.trim()),false);assert.ok((await p.locator('main').innerText()).includes(purpose));assert.equal(await vault.locator('[name="secret"]').inputValue(),'');assert.equal((await p.content()).includes(secret.trim()),false)
   await shot('intake-'+i+'-private-vault')
   await h.stepUp() // GOV-004: revealing custody material needs a fresh second factor
   const reveal=p.locator('form:has(input[value="intake.secretReveal"])');await reveal.getByLabel('Reason for access').fill(reason);await reveal.getByRole('button',{name:'Reveal once'}).click();await p.waitForLoadState('domcontentloaded');assert.equal(await p.locator('main pre').textContent(),secret);await p.getByRole('link',{name:'Return to custody'}).click();await p.reload()
   const readback=await h.state(),reveals=readback.records.intakeSecretAudit.filter(row=>row.secretId===stored[0].secretId&&row.action==='intake.secretReveal')
   assert.equal(reveals.length,1);assert.equal(reveals[0].reason,reason);assert.deepEqual(reveals[0].by,stored[0].by);assert.ok(reveals[0].at>=stored[0].at)
   assert.equal(JSON.stringify(readback).includes(secret.trim()),false);assert.equal((await p.content()).includes(secret.trim()),false);assert.equal(await vault.locator('[name="secret"]').inputValue(),'')
   const erase=p.locator('form:has(input[value="intake.secretEraseCustomer"])');await erase.getByLabel('Erasure request reason').fill('Customer requests removal of unlock material');await erase.getByLabel('Type ERASE to destroy all unlock material for this customer').fill('ERASE');await erase.getByRole('button',{name:'Erase customer unlock material'}).click();await p.waitForLoadState('domcontentloaded');assert.equal(await p.locator('form:has(input[value="intake.secretReveal"])').count(),0);await shot('intake-'+i+'-customer-unlock-erased')
   await p.getByText('Compare the actual handover checklist',{exact:true}).click();const compare=p.locator('form:has(input[value="intake.compare"])');await compare.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await compare.locator('[name="consent"]').check();await compare.getByRole('button',{name:'Sign checklist comparison',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok((await p.locator('main').innerText()).includes(item+': 1 of 1 returned · 0 missing'));await shot('intake-'+i+'-compared')
  }
  const saved=await h.state(),fresh=await installation({bindings:{OWNER_EMAIL:'intake-video-recovery@example.test'}});try{await restore(fresh,await archive(h));assert.deepEqual((await fresh.state()).records.intake,saved.records.intake);for(const video of videos){const bytes=Buffer.from(await(await fresh.request(video.contentUrl)).arrayBuffer());const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(bytes).digest('hex'),video.sha256)}}finally{await fresh.close()}
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
