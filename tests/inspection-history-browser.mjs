import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir,readFile} from 'node:fs/promises'
import {randomUUID,createHash} from 'node:crypto'
import {installation,booking,estimate,authorise} from './harness.mjs'
export async function inspectionHistoryBrowser(){
 const h=await installation({network:true,assets:true,bindings:{AUTH_LOCAL:'true'}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:h.origin,Cookie:h.owner,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const actor=(await h.state()).actor,asset=await h.command('asset.create',{customerName:'Dana Brooks',customerEmail:'dana@example.test',label:'2019 Honda CR-V EX',identifier:'OH-JKV-4471'})
  const {job}=await booking(h,{asset,technicianId:actor.id,startAt:'2026-09-01T09:00:00-04:00',endAt:'2026-09-01T10:00:00-04:00'})
  let quote=await estimate(h,job);quote=await authorise(h,quote,[])
  const current=(await h.state()).records.job.find(j=>j.id===job.id),reading=await h.command('reading.record',{jobId:job.id,version:current.version,stage:'intake',value:60000,observedAt:'2026-09-01T09:00:00-04:00'})
  await h.command('decline.record',{estimateId:quote.id,version:quote.version,lineId:quote.revisions[0].lines[0].id,readingId:reading.id,reason:'Customer defers front pads',evidence:'Signed paper estimate CB-20',dueValue:65000})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/New_York',locale:'en-US'})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  const directory='.cache/inspection-history-browser';await mkdir(directory,{recursive:true})
  const shot=async name=>{for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{window.scrollTo(0,0);return new Promise(requestAnimationFrame)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'DVI-004 fits '+width);await page.screenshot({path:directory+'/'+name+'-'+width+'.png',fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
  const create=async(title,value,date)=>{
   await page.locator('details:has([data-create])').first().evaluate(d=>{d.open=true})
   await page.getByLabel('Finding title',{exact:true}).fill(title);await page.getByLabel('Technician-reported capture time').fill(date)
   await page.getByLabel('Measurement 1 name',{exact:true}).fill('Front pad thickness');await page.getByLabel('Measurement 1 value',{exact:true}).fill(String(value));await page.getByLabel('Measurement 1 unit',{exact:true}).fill('mm');await page.getByLabel('Unresolved recommendation',{exact:true}).fill('Replace front pads')
   await page.getByRole('button',{name:'Create finding',exact:true}).click();await page.getByRole('status').filter({hasText:'Finding saved.'}).waitFor()
  }
  await page.goto(h.origin+'/app/jobs/'+job.id+'/media');await page.getByText('No inspection evidence saved for this repair yet.').waitFor()
  await create('Front brake pads',3,'2026-09-01T09:10');const source=(await h.api('/api/mallet/media/findings?jobId='+job.id)).findings[0]
  const photo=await readFile('tests/fixtures/dvi/front-brake.png'),hash=b=>createHash('sha256').update(b).digest('hex')
  let upload=await h.api('/api/mallet/media/uploads',{findingId:source.id,clientId:randomUUID(),variant:'original',filename:'prior-brake.png',mime:'image/png',size:photo.length,sha256:hash(photo),capturedAt:source.capturedAt})
  for(let i=0;i<Math.ceil(photo.length/65536);i++){const chunk=photo.subarray(i*65536,(i+1)*65536);await h.api('/api/mallet/media/uploads/'+upload.id+'/chunks/'+i,{sha256:hash(chunk),base64:chunk.toString('base64')},{method:'PUT'})}await h.api('/api/mallet/media/uploads/'+upload.id+'/complete',{})
  await h.api('/api/mallet/media/findings',{jobId:job.id,clientId:randomUUID(),title:'Prior workshop report',capturedAt:'2026-08-01T09:00:00Z',observation:{measurements:[{name:'Front pad thickness',value:4,unit:'mm'}],recommendation:'Monitor',provenance:{kind:'imported',system:'Previous shop report',recordId:'BR-18',observer:'Pat, prior technician'}}})
  await page.reload();await page.getByText('4 mm',{exact:false}).first().waitFor();await shot('01-prior-native-imported')
  const next=(await booking(h,{asset:(await h.state()).records.asset.find(a=>a.id===asset.id),technicianId:actor.id,startAt:'2026-10-01T09:00:00-04:00',endAt:'2026-10-01T10:00:00-04:00'})).job
  await page.goto(h.origin+'/app/jobs/'+next.id);await page.getByRole('link',{name:'Inspection photos & video'}).click();await page.getByText('No inspection evidence saved for this repair yet.').waitFor()
  await create('Front brake pads recheck',2,'2026-10-01T09:10');await page.locator('[data-inspection-history]').getByText('Front pad thickness: 2 mm',{exact:true}).waitFor();await page.getByLabel('Capture photo').setInputFiles('tests/fixtures/dvi/front-brake.png');await page.locator('canvas').waitFor({state:'visible'});await page.getByLabel('Annotation (private)').fill('Current recheck: measured 2 mm');await page.getByRole('button',{name:'Save to repair order',exact:true}).click();await page.getByRole('status').filter({hasText:'Saved original and prepared shared version.'}).waitFor();await shot('02-comparison')
  const entry=page.locator('[data-history-finding="'+source.id+'"]');await entry.getByLabel('Declined decision for Front brake pads').selectOption({index:1});await entry.getByRole('button',{name:'Carry recommendation to this inspection'}).click()
  await page.getByRole('status').filter({hasText:'Recommendation carried.'}).waitFor();await shot('03-carried-decline')
  const carried=(await h.api('/api/mallet/media/findings?jobId='+next.id)).findings.find(f=>f.carriedFrom);assert.equal(carried.carriedFrom.capturedAt,source.capturedAt);assert.equal(carried.carriedFrom.by.id,actor.id);assert.ok(carried.carriedFrom.declinedWorkId)
  const link=page.locator('[data-history-finding="'+source.id+'"]').getByRole('link',{name:'Open historical original photo/video'});await link.click();await page.waitForFunction(()=>document.querySelector('[data-original-preview]')?.complete&&document.querySelector('[data-original-preview]')?.naturalWidth>0,{},{timeout:10000,polling:100}).catch(async error=>{await page.screenshot({path:directory+'/original-failed.png'});throw error});assert.equal(await page.locator('[data-original-preview]').evaluate(img=>img.complete&&img.naturalWidth>0),true);await shot('04-original-image')
  await page.goto(h.origin+'/app/jobs/'+next.id+'/media');await page.locator('[data-history-finding="'+source.id+'"]').getByLabel('Resolution reason for Front brake pads').fill('Replaced after separately authorized work')
  await page.locator('[data-history-finding="'+source.id+'"]').getByRole('button',{name:'Resolve recommendation'}).click();await page.getByRole('status').filter({hasText:'Resolution saved separately'}).waitFor();await shot('05-resolved-history')
  assert.deepEqual(errors,[],'DVI-004 browser errors');assert.equal((await h.state()).records.job.find(j=>j.id===next.id).estimateId,null)
 }finally{await browser?.close();await h.close()}
}
