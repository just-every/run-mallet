import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {installation,booking,estimate,authorise} from './harness.mjs'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function mediaBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}}),directory='.cache/media-browser'
 let browser
 try{
  await mkdir(directory,{recursive:true})
  const headers={Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'}
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers,body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const actor=(await h.state()).actor
  const asset=await h.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V EX',identifier:'OH-JKV-4471'})
  const {job}=await booking(h,{asset,technicianId:actor.id,bayId:'Bay 2',startAt:'2026-10-01T09:00:00-04:00',endAt:'2026-10-01T11:00:00-04:00'})
  let quote=await estimate(h,job);quote=await authorise(h,quote,[quote.revisions[0].lines[0].id]);let current=(await h.state()).records.job.find(j=>j.id===job.id)
  const reading=await h.command('reading.record',{jobId:job.id,version:current.version,stage:'intake',value:60000,observedAt:'2026-10-01T09:00:00-04:00'})
  await h.command('decline.record',{estimateId:quote.id,version:quote.version,lineId:quote.revisions[0].lines[1].id,readingId:reading.id,reason:'Customer defers brake labor',evidence:'Signed paper estimate; inspection evidence on this visit',dueValue:67000})

  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US',hasTouch:true})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const shot=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{window.scrollTo(0,0);return new Promise(requestAnimationFrame)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'DVI-002: page fits '+width);await page.screenshot({path:directory+'/'+name+'-'+width+'.png',fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
  await page.goto(h.origin+'/app/jobs/'+job.id);await shot('01-repair-door')
  await page.getByRole('link',{name:'Inspection photos & video'}).click()
  await page.getByText('No inspection evidence saved for this repair yet.').waitFor();await shot('02-empty-capture')
  await page.getByText('Create a finding',{exact:true}).click()
  await page.getByLabel('Finding title').fill('Front brake pad wear')
  await page.getByLabel('Technician-reported capture time').fill('2026-10-01T09:15')
  await page.getByRole('button',{name:'Create finding',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Finding saved'}).waitFor()
  await page.getByLabel('Capture photo').setInputFiles('tests/fixtures/dvi/front-brake.png')
  const canvas=page.locator('canvas');await canvas.waitFor({state:'visible'});await page.locator('[data-file-name]').filter({hasText:'front-brake.png'}).waitFor()
  const bounds=await canvas.boundingBox();assert.ok(bounds)
  await page.mouse.move(bounds.x+bounds.width*.25,bounds.y+bounds.height*.4);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.65,bounds.y+bounds.height*.6,{steps:8});await page.mouse.up()
  await page.setViewportSize({width:390,height:1000});await canvas.scrollIntoViewIfNeeded();const touchBox=await canvas.boundingBox();const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchBox.x+touchBox.width*.3,y:touchBox.y+touchBox.height*.3}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchBox.x+touchBox.width*.6,y:touchBox.y+touchBox.height*.5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('Annotation (private)').fill('Pad wear about 2 mm; technician measurement')
  await shot('03-marked-photo')
  let interrupted=false
  await page.route('**/chunks/1',async route=>{if(!interrupted){interrupted=true;await route.abort('connectionreset')}else await route.continue()})
  await page.getByRole('button',{name:'Save to repair order',exact:true}).click()
  await page.getByRole('button',{name:'Resume upload',exact:true}).waitFor()
  assert.ok(interrupted,'DVI-002: real multipart upload was interrupted after a confirmed chunk')
  let findings=(await h.api('/api/mallet/media/findings?jobId='+job.id)).findings
  assert.equal(findings.length,1);assert.equal(findings[0].media.length,1);assert.equal(findings[0].media[0].complete,false)
  const incomplete=findings[0].media[0],progress=await h.api('/api/mallet/media/uploads/'+incomplete.id)
  assert.deepEqual(progress.received,[0]);await shot('04-interrupted')
  await page.getByRole('button',{name:'Resume upload',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Saved original and prepared shared version.'}).waitFor();await shot('05-saved-photo')
  findings=(await h.api('/api/mallet/media/findings?jobId='+job.id)).findings
  assert.equal(findings.length,1);assert.equal(findings[0].media.length,2)
  const original=findings[0].media.find(m=>m.variant==='original'),shared=findings[0].media.find(m=>m.variant==='shared')
  assert.equal(original.id,incomplete.id);assert.ok(shared.annotations.strokes.length);assert.match(shared.annotations.text,/2 mm/)
  const originalBytes=Buffer.from(await (await h.request(original.contentUrl)).arrayBuffer())
  assert.equal(digest(originalBytes),digest(await readFile('tests/fixtures/dvi/front-brake.png')))
  assert.ok(shared.size<original.size,'DVI-002: annotated JPEG is compressed relative to this source photo')
  assert.equal(await page.locator('.media-version img').evaluate(img=>img.complete&&img.naturalWidth>0),true)
  const markedPixel=await page.locator('.media-version img').evaluate(img=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [...ctx.getImageData(Math.floor(c.width*.45),Math.floor(c.height*.5),1,1).data]});assert.ok(markedPixel[0]>150&&markedPixel[1]<100&&markedPixel[2]<100,'DVI-002: saved shared JPEG contains the red markup pixels')
  assert.equal(findings[0].by.id,actor.id);assert.equal(findings[0].capturedAt,'2026-10-01T13:15:00.000Z');assert.notEqual(original.receivedAt,original.capturedAt)
  // Produce a genuine short compressed browser recording as test media; the
  // public camera/file door uploads it without replacing application code.
  const video=await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d'),stream=c.captureStream(12),parts=[];
   const recorder=new MediaRecorder(stream,{mimeType:'video/webm',videoBitsPerSecond:250000});
   const done=new Promise(resolve=>{recorder.ondataavailable=e=>parts.push(e.data);recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(parts,{type:'video/webm'}).arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);resolve(btoa(binary))}});
   recorder.start();for(let i=0;i<12;i++){ctx.fillStyle='#283747';ctx.fillRect(0,0,640,360);ctx.fillStyle='#d5d8dc';ctx.beginPath();ctx.arc(320,180,120,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c62828';ctx.fillRect(200+i*4,80,30,200);await new Promise(r=>setTimeout(r,80))}recorder.stop();stream.getTracks().forEach(t=>t.stop());return done;
  })
  await page.getByLabel('Choose photo or video').setInputFiles({name:'brake-rotation.webm',mimeType:'video/webm',buffer:Buffer.from(video,'base64')})
  await page.locator('[data-file-name]').filter({hasText:'brake-rotation.webm'}).waitFor()
  await page.getByLabel('Annotation (private)').fill('Rotor rotation shown in this short clip')
  await page.getByRole('button',{name:'Save to repair order',exact:true}).click()
  await page.getByRole('status').filter({hasText:'Saved original and prepared shared version.'}).waitFor()
  await page.locator('.media-version video').waitFor()
  await page.locator('.media-version video').evaluate(async video=>{await video.play()})
  await page.waitForFunction(()=>document.querySelector('.media-version video')?.currentTime>0)
  await shot('06-saved-video')
  findings=(await h.api('/api/mallet/media/findings?jobId='+job.id)).findings
  assert.equal(findings.length,1);assert.equal(findings[0].media.length,4);assert.ok(findings[0].media.every(m=>m.complete));assert.equal(findings[0].media.find(m=>m.variant==='shared'&&m.mime==='video/webm').annotations.text,'Rotor rotation shown in this short clip')
  await page.reload();await page.locator('.media-version video').waitFor();await shot('07-reopened-finding')
  const observed=(await h.state()).records.asset.find(a=>a.id===asset.id);const next=await h.command('job.book',{assetId:asset.id,version:observed.version,title:'Follow-up brake inspection',technicianId:actor.id,bayId:'Bay 2',startAt:'2026-11-02T09:00:00-05:00',endAt:'2026-11-02T10:00:00-05:00'});await page.goto(h.origin+'/app/jobs/'+next.id);await shot('08-declined-register');await page.getByRole('link',{name:'Inspection evidence from original visit'}).click();await page.locator('.media-version video').waitFor();await shot('09-declined-photo-retained');
  assert.equal((await h.api('/api/mallet/media/findings?jobId='+job.id)).findings[0].media.length,4,'EST-005 + DVI-002: next visit retains original photo/video beside prior declined price');
  const remembered=await page.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('mallet.media.')));for(const [,value] of remembered)assert.match(value,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,'DVI-002: browser remembers only opaque ids, never finding text or bytes');
  assert.deepEqual(errors,[],'DVI-002: capture page has no browser errors')
 }finally{await browser?.close();await h.close()}
}
