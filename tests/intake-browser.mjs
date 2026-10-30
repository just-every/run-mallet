import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking,archive,restore} from './harness.mjs'
import {custodyPhoto,custodyMedia} from './support/intake-journey.mjs'
export async function intakeBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=0&partsTaxable=yes'});assert.equal(setup.status,303)
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']});const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const dir=process.env.MALLET_C19_PROOF_DIR??'.cache/intake-browser';await mkdir(dir,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}

  const media=[],visits=[],consent='I acknowledge this exact condition and custody checklist and agree to sign and receive this receipt electronically. Ask the shop for a paper copy.'
  const state=async()=>{const response=await context.request.get(h.origin+'/api/mallet/state',{headers:{Origin:h.origin}});assert.equal(response.status(),200);return response.json()}
  const actor=(await h.state()).actor,recorder={id:actor.id,name:actor.name,role:'owner'}
  const photoDigest=createHash('sha256').update(await readFile('tests/fixtures/dvi/front-brake.png')).digest('hex')
  const checkReceipt=(receipt,{job,phase,damage,items,attachment,capturedAt,lockHandling,started,finished})=>{
   assert.ok(receipt,'Saved '+phase+' receipt exists')
   assert.equal(receipt.jobId,job.id);assert.equal(receipt.assetId,job.assetId);assert.deepEqual(receipt.asset,job.asset)
   assert.equal(receipt.phase,phase);assert.equal(receipt.damage,damage);assert.equal(receipt.lockHandling,lockHandling)
   assert.equal(receipt.capturedAt,capturedAt)
   assert.ok(receipt.at>=started&&receipt.at<=finished,'Recorder time belongs to the signing action')
   assert.deepEqual(receipt.by,recorder)
   assert.deepEqual(receipt.signature,{name:'Dana Brooks',consent,identityVerified:false,by:recorder,at:receipt.at})
   assert.deepEqual(receipt.items.map(({kind,label,quantity})=>({kind,label,quantity})),items)
   assert.equal(new Set(receipt.items.map(x=>x.id)).size,items.length)
   assert.ok(receipt.items.every(x=>typeof x.id==='string'&&x.id.length>0))
   assert.deepEqual(receipt.attachments,[{id:attachment.id,jobId:job.id,findingId:attachment.findingId,variant:'original',filename:attachment.filename,mime:attachment.mime,sha256:attachment.sha256,capturedAt:attachment.capturedAt,by:attachment.by}])
  }
  const rendered=async(page,receipt)=>{
   const panel=page.locator('#intake-'+receipt.id)
   assert.equal(await panel.count(),1)
   assert.equal(await panel.getByText(receipt.damage,{exact:true}).count(),1)
   assert.equal(await panel.getByText('Lock handling: '+receipt.lockHandling,{exact:true}).count(),1)
   for(const item of receipt.items)assert.equal(await panel.getByText(item.kind+': '+item.label+' × '+item.quantity,{exact:true}).count(),1)
   assert.ok((await panel.innerText()).includes('recorded '))
   assert.ok((await panel.innerText()).includes('by '+recorder.name))
   assert.ok((await panel.innerText()).includes('Acknowledged by Dana Brooks'))
   assert.equal(await panel.locator('p').filter({hasText:consent}).count(),1)
   assert.deepEqual(await panel.locator('time').evaluateAll(times=>times.map(t=>t.getAttribute('datetime'))),[receipt.capturedAt,receipt.at,...receipt.attachments.map(m=>m.capturedAt),receipt.signature.at])
   for(const attachment of receipt.attachments)assert.equal(await panel.getByRole('link',{name:attachment.filename,exact:true}).getAttribute('href'),'/app/jobs/'+receipt.jobId+'/media/view/'+attachment.id)
   assert.equal(await page.getByRole('link',{name:'Back to repair',exact:true}).getAttribute('href'),'/app/jobs/'+receipt.jobId)
   assert.ok((await page.locator('main').innerText()).includes(receipt.asset.label+' · '+receipt.asset.identifier))
   assert.match(await page.locator('main').innerText(),/Mallet does not verify the signer's identity/)
  }
  const {customersFixture}=await import('./support/customers-journey.mjs'),{input}=await customersFixture(h),account=await h.command('customer.save',input)
  for(const [i,label,item,kind]of [[1,'2019 Honda CR-V','Spare key','key'],[2,'Repair tablet','Charger','accessory']]){
   let asset=await h.command('asset.create',{customerName:'Dana Brooks',label,identifier:'synthetic-mallet-'+(72+i)});asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Customer confirms custody account'});const {job}=await booking(h,{asset,startAt:`2026-10-${10+i}T09:00:00Z`,endAt:`2026-10-${10+i}T10:00:00Z`}),photo=await custodyPhoto(h,job)
   assert.equal(photo.sha256,photoDigest);media.push(photo)
   const damage=i===1?'Left front door dent at lower edge':'Screen uncracked; charger present',capturedAt='2026-10-01T08:0'+i+':00.000Z',lockHandling='Customer unlocks in person; no secret retained'
   await p.goto(h.origin+'/app/jobs/'+job.id);await p.getByRole('link',{name:'Condition & custody receipts'}).click();await shot('intake-'+i+'-empty')
   const record=p.locator('form:has(input[value="intake.record"])')
   await record.getByLabel('Observed at (with timezone)',{exact:true}).fill(capturedAt)
   await record.getByLabel('Damage locations and condition',{exact:true}).fill(damage)
   await record.getByLabel('Custody items',{exact:false}).fill(kind+' | '+item+' | 1')
   await record.getByLabel('Security-lock handling',{exact:false}).fill(lockHandling)
   await record.locator(`input[name="attachmentIds"][value="${photo.id}"]`).check()
   const started=new Date().toISOString()
   await record.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await record.locator('[name="consent"]').check();await record.getByRole('button',{name:'Sign custody receipt',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   const finished=new Date().toISOString();await p.reload()
   const beforeReceipts=(await state()).records.intake.filter(r=>r.jobId===job.id);assert.equal(beforeReceipts.length,1)
   const before=beforeReceipts[0]
   checkReceipt(before,{job,phase:'before',damage,items:[{kind,label:item,quantity:1}],attachment:photo,capturedAt,lockHandling,started,finished})
   await rendered(p,before)
   assert.ok((await p.locator('main').innerText()).includes(item+' × 1'));assert.equal(await p.getByRole('link',{name:'condition.png'}).count(),1);await shot('intake-'+i+'-signed')
   const encoded=await p.evaluate(async()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(10),parts=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const done=new Promise(resolve=>{recorder.ondataavailable=e=>parts.push(e.data);recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(parts).arrayBuffer());resolve(btoa(String.fromCharCode(...bytes)))}});recorder.start();for(let frame=0;frame<5;frame++){ctx.fillStyle=frame%2?'#2874a6':'#c0392b';ctx.fillRect(0,0,32,32);await new Promise(r=>setTimeout(r,100))}recorder.stop();stream.getTracks().forEach(t=>t.stop());return done})
   const video=await custodyMedia(h,job,Buffer.from(encoded,'base64'),'after-condition.webm','video/webm','After condition — observed handover');assert.equal(video.sha256,createHash('sha256').update(Buffer.from(encoded,'base64')).digest('hex'));media.push(video);await p.reload()
   const afterCapturedAt='2026-10-02T09:0'+i+':00.000Z',afterStarted=new Date().toISOString()
   await record.locator('[name="phase"]').selectOption('after');await record.getByLabel('Observed at (with timezone)',{exact:true}).fill(afterCapturedAt);await record.getByLabel('Damage locations and condition',{exact:true}).fill('Original condition unchanged after repair');await record.getByLabel('Security-lock handling',{exact:false}).fill('Customer retains unlock material');await record.locator(`input[name="attachmentIds"][value="${video.id}"]`).check();await record.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await record.locator('[name="consent"]').check();await record.getByRole('button',{name:'Sign custody receipt',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   const afterFinished=new Date().toISOString();await p.reload()
   const afterState=await state(),afterReceipts=afterState.records.intake.filter(r=>r.jobId===job.id);assert.equal(afterReceipts.length,2)
   assert.deepEqual(afterReceipts.find(r=>r.id===before.id),before,'After-condition signing preserves the complete original receipt')
   const after=afterReceipts.find(r=>r.phase==='after')
   checkReceipt(after,{job,phase:'after',damage:'Original condition unchanged after repair',items:[],attachment:video,capturedAt:afterCapturedAt,lockHandling:'Customer retains unlock material',started:afterStarted,finished:afterFinished})
   await rendered(p,before);await rendered(p,after);await shot('intake-'+i+'-after-video')
   await p.getByRole('link',{name:'after-condition.webm',exact:true}).click();await p.locator('video').evaluate(async v=>{await v.play();v.pause()});await shot('intake-'+i+'-playable-after-video');await p.goto(h.origin+'/app/jobs/'+job.id+'/intake')
   const vault=p.locator('form:has(input[value="intake.secretStore"])')
   await vault.getByLabel('Unlock purpose',{exact:true}).fill('Unlock for agreed diagnosis')
   await vault.getByLabel('Temporary unlock secret',{exact:true}).fill('synthetic-mallet-'+(80+i))
   await vault.locator('[name="consent"]').check();await vault.getByRole('button',{name:'Store temporary secret'}).click();await p.waitForLoadState('domcontentloaded');await shot('intake-'+i+'-private-vault')
   await h.stepUp() // GOV-004: revealing custody material needs a fresh second factor
   const reveal=p.locator('form:has(input[value="intake.secretReveal"])');await reveal.getByLabel('Reason for access').fill('Perform customer-authorized diagnosis');await reveal.getByRole('button',{name:'Reveal once'}).click();await p.waitForLoadState('domcontentloaded');assert.equal(await p.locator('main pre').innerText(),'synthetic-mallet-'+(80+i));await p.getByRole('link',{name:'Return to custody'}).click()
   const erase=p.locator('form:has(input[value="intake.secretEraseCustomer"])');await erase.getByLabel('Erasure request reason').fill('Customer requests removal of unlock material');await erase.getByLabel('Type ERASE to destroy all unlock material for this customer').fill('ERASE');await erase.getByRole('button',{name:'Erase customer unlock material'}).click();await p.waitForLoadState('domcontentloaded');assert.equal(await p.locator('form:has(input[value="intake.secretReveal"])').count(),0);await shot('intake-'+i+'-customer-unlock-erased')
   await p.getByText('Compare the actual handover checklist',{exact:true}).click();const compare=p.locator('form:has(input[value="intake.compare"])');await compare.getByLabel('Person acknowledging this checklist').fill('Dana Brooks');await compare.locator('[name="consent"]').check();await compare.getByRole('button',{name:'Sign checklist comparison',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.ok((await p.locator('main').innerText()).includes(item+': 1 of 1 returned · 0 missing'));await p.reload()
   const compared=await state(),comparisons=compared.records.intakeComparison.filter(r=>r.jobId===job.id);assert.equal(comparisons.length,1)
   const comparison=comparisons[0]
   assert.equal(comparison.jobId,job.id);assert.equal(comparison.assetId,job.assetId);assert.equal(comparison.intakeId,before.id)
   assert.deepEqual(comparison.source,before,'Handover retains the original signed checklist and all its fields')
   assert.deepEqual(comparison.returned,before.items.map(x=>({...x,returnedQuantity:1,missingQuantity:0})))
   assert.deepEqual(comparison.signature,{name:'Dana Brooks',consent,identityVerified:false,by:recorder,at:comparison.at})
   assert.deepEqual(comparison.by,recorder)
   for(const receipt of [before,after]){assert.deepEqual(compared.records.intake.find(r=>r.id===receipt.id),receipt);await rendered(p,receipt)}
   assert.ok((await p.locator('#comparison-'+comparison.id).innerText()).includes(item+': 1 of 1 returned · 0 missing'))
   visits.push({i,job,before,after,comparison});await shot('intake-'+i+'-compared')
  }
  const saved=await state(),fresh=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true',OWNER_EMAIL:['synthetic-mallet-intake-recovery','example.test'].join('@')}})
  try{
   await restore(fresh,await archive(h));const recovered=await fresh.state()
   assert.notEqual(recovered.actor.id,actor.id)
   for(const kind of ['intake','intakeComparison'])assert.deepEqual(recovered.records[kind],saved.records[kind])
   await fresh.state({as:h.owner,status:401})
   for(const attachment of media){const response=await fresh.request(attachment.contentUrl);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),attachment.sha256)}
   const recoveredContext=await browser.newContext({viewport:{width:1440,height:1000}})
   try{
    await recoveredContext.addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})))
    const page=await recoveredContext.newPage();page.on('pageerror',e=>errors.push(e.message))
    await page.goto(fresh.origin+'/setup')
    await page.locator('[name="confirm"]').check()
    await page.getByRole('button',{name:'Finish setup',exact:true}).click();await page.waitForLoadState('domcontentloaded')
    for(const {i,job,before,after,comparison} of visits){
     await page.goto(fresh.origin+'/app/jobs/'+job.id+'/intake')
     for(const receipt of [before,after])await rendered(page,receipt)
     assert.ok((await page.locator('#comparison-'+comparison.id).innerText()).includes(comparison.returned[0].label+': 1 of 1 returned · 0 missing'))
     for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Recovered custody fits '+width);await page.screenshot({path:join(dir,'intake-'+i+'-recovered-'+width+'.png'),fullPage:true})}
     await page.setViewportSize({width:1440,height:1000})
    }
   }finally{await recoveredContext.close()}
  }finally{await fresh.close()}
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
