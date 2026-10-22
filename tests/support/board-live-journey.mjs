import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {performance} from 'node:perf_hooks'
import {chromium} from '@playwright/test'
import {installation,booking} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'

/** Two native staff sessions: a service advisor changes actual repair records
 * while the owner keeps an unsaved board filter and selected repair panel. */
export async function boardLiveJourney(){
 const h=await installation({network:true,assets:true,secureNetwork:true});let browser
 try{
  await shopSetup(h)
  const advisor=await h.person('synthetic-mallet-201@example.test','admin'),evidence=[],timings=[],errors=[]
  const prepareInitial=async(start=0,end=12)=>{for(let i=start;i<end;i++){
   const asset=await h.command('asset.create',{customerName:['Dana Brooks','Harbor Plumbing','Lee Chen','Rivera Fleet'][i%4],customerEmail:'synthetic-mallet-'+(210+i)+'@example.test',label:['2019 Honda CR-V','2021 Ford Transit','2020 Toyota Corolla'][i%3],identifier:'synthetic-mallet-'+(230+i)})
   const hour=String(8+i).padStart(2,'0');await booking(h,{asset,bayId:'Bay '+(i%3+1),startAt:`2026-11-01T${hour}:00:00Z`,endAt:`2026-11-01T${hour}:45:00Z`})
  }
  }
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const ownerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000},timezoneId:'America/New_York'}),peerContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  const signIn=async(context,cookie)=>context.addCookies(cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  await signIn(ownerContext,h.owner);await signIn(peerContext,advisor.cookie)
  const owner=await ownerContext.newPage(),peer=await peerContext.newPage()
  for(const p of [owner,peer]){p.on('pageerror',error=>errors.push(error.message));p.on('response',response=>{const path=new URL(response.url()).pathname;if(['/app','/api/mallet/board-revision'].includes(path)){const timing=response.headers()['server-timing'];if(timing)timings.push({path,status:response.status(),serverTiming:timing})}})}
  await owner.goto(h.origin+'/app');assert.equal(await owner.locator('.empty-board').count(),1)
  const initialDocument=await owner.evaluateHandle(()=>document)
  await prepareInitial(0,1);const firstCommit=performance.now();await owner.locator('#board .ro').first().waitFor({timeout:1900});assert.ok(performance.now()-firstCommit<2000)
  assert.ok(await owner.evaluate(previous=>document===previous,initialDocument),'An empty board receives its first repair without reloading')
  await initialDocument.dispose();await prepareInitial(1,12)
  const directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/ops-board-live';await mkdir(directory,{recursive:true})
  const stage=async(id,wanted,committedAt)=>{
   await owner.waitForFunction(({id,wanted})=>[...document.querySelectorAll('#board .ro')].some(a=>a.getAttribute('href')?.includes('ro='+id)&&a.dataset.stage===wanted),{id,wanted},{timeout:1900})
   const elapsedMs=performance.now()-committedAt;evidence.push({width:(await owner.viewportSize()).width,stage:wanted,elapsedMs});assert.ok(elapsedMs<=2000,`Peer stage ${wanted} appeared after ${elapsedMs.toFixed(1)} ms`)
  }
  const submit=async(button)=>{let committedAt;const listener=response=>{if(new URL(response.url()).pathname==='/app/actions'&&response.request().method()==='POST')committedAt=performance.now()};peer.on('response',listener);try{await button.click();await peer.waitForLoadState('domcontentloaded');assert.ok(committedAt,'The native staff action reached its server commit');return committedAt}finally{peer.off('response',listener)}}
  const preserved=async()=>{
   assert.deepEqual(await owner.evaluate(()=>({form:window.boardForm===document.querySelector('.board-filters'),aside:window.selectedPanel===document.querySelector('#ro'),input:window.filterInput===document.querySelector('.board-filters [name=q]'),value:window.filterInput.value,focused:document.activeElement===window.filterInput,start:window.filterInput.selectionStart,end:window.filterInput.selectionEnd,left:document.querySelector('#board').scrollLeft})),{form:true,aside:true,input:true,value:'Draft search stays here',focused:true,start:6,end:12,left:await owner.evaluate(()=>window.boardLeft)})
  }
  for(const [index,width]of [1440,390].entries()){
   await owner.setViewportSize({width,height:1000})
   const asset=await h.command('asset.create',{customerName:index?'Harbor Plumbing':'Dana Brooks',customerEmail:'synthetic-mallet-'+(250+index)+'@example.test',label:index?'2021 Ford Transit':'2019 Honda CR-V',identifier:'synthetic-mallet-'+(252+index)})
   const {job}=await booking(h,{asset,technicianId:advisor.id,bayId:'Bay '+(index+4),startAt:`2026-11-0${index+2}T09:00:00Z`,endAt:`2026-11-0${index+2}T11:00:00Z`})
   await owner.goto(h.origin+'/app?ro='+job.id)
   assert.equal(await owner.locator('meta[http-equiv=refresh]').count(),0,'The board never reloads an active draft')
   await owner.waitForFunction(()=>document.querySelector('#board')?.dataset.boardVersion)
   await owner.evaluate(()=>{window.boardForm=document.querySelector('.board-filters');window.selectedPanel=document.querySelector('#ro');window.filterInput=document.querySelector('.board-filters [name=q]');window.filterInput.value='Draft search stays here';window.filterInput.focus();window.filterInput.setSelectionRange(6,12);const board=document.querySelector('#board');board.scrollLeft=240;window.boardLeft=board.scrollLeft;window.pageIdentity={}})
   const pageIdentity=await owner.evaluateHandle(()=>window.pageIdentity)
   await peer.goto(h.origin+'/app/jobs/'+job.id)
   await peer.locator('#diagnosis summary').filter({hasText:'Record diagnosis'}).click()
   const diagnosis=peer.locator('form:has(input[name=command][value="diagnosis.record"])').filter({has:peer.getByRole('button',{name:'Save diagnosis',exact:true})})
   await diagnosis.getByLabel('Complaint (customer concern)',{exact:true}).fill(index?'Vehicle pulls left while braking':'Brake pedal pulses on the highway')
   await diagnosis.getByLabel('Test method',{exact:true}).fill('Road test and visual inspection performed in the service bay')
   let committedAt=await submit(diagnosis.getByRole('button',{name:'Save diagnosis',exact:true}));await stage(job.id,'diagnosis',committedAt);await preserved()
   const estimate=peer.locator('form:has(input[name=command][value="estimate.prepare"])')
   for(const [name,value]of Object.entries({partDescription:'Front brake pads',partPrice:'62.50',laborDescription:'Replace pads and inspect rotors',laborQuantity:'1.5',laborPrice:'110'}))await estimate.locator(`[name=${name}]`).fill(value)
   committedAt=await submit(estimate.getByRole('button',{name:'Prepare estimate',exact:true}));await stage(job.id,'approval',committedAt);await preserved()
   await submit(peer.getByRole('button',{name:'Approve estimate',exact:true}))
   await peer.getByLabel('Handoff note',{exact:true}).fill('Printed estimate reviewed at the counter')
   await submit(peer.getByRole('button',{name:'Record estimate shared',exact:true}))
   for(const checkbox of await peer.locator('input[name=lineIds]').all())await checkbox.check()
   await peer.getByLabel('Authorization evidence / reference',{exact:true}).fill('Customer signed the exact printed scope at the counter')
   await owner.evaluate(id=>{const link=[...document.querySelectorAll('#board .ro')].find(a=>a.getAttribute('href')?.includes('ro='+id));link.focus({preventScroll:true});window.focusedBoardHref=link.getAttribute('href')},job.id)
   committedAt=await submit(peer.getByRole('button',{name:'Record customer authorization',exact:true}));await stage(job.id,'work',committedAt)
   assert.equal(await owner.evaluate(()=>document.activeElement.getAttribute('href')===window.focusedBoardHref),true,'A focused card keeps focus when it moves between stage columns')
   await owner.evaluate(()=>{window.filterInput.focus({preventScroll:true});window.filterInput.setSelectionRange(6,12)});await preserved()
   // A focused board card is replaced in place as another person changes its
   // priority; its equivalent link receives focus without moving the board.
   await owner.evaluate(id=>{const link=[...document.querySelectorAll('#board .ro')].find(a=>a.getAttribute('href')?.includes('ro='+id));link.focus({preventScroll:true});window.focusedBoardHref=link.getAttribute('href')},job.id)
   await peer.locator('summary').filter({hasText:/^Change priority$/}).click()
   const priority=peer.locator('form:has(input[name=command][value="flow.priority"])')
   await priority.locator('select[name=priority]').selectOption('high');await priority.getByLabel('Why',{exact:true}).fill('Customer needs the vehicle for the afternoon service call')
   committedAt=await submit(priority.getByRole('button',{name:'Save priority',exact:true}))
   await owner.waitForFunction(id=>[...document.querySelectorAll('#board .ro.high')].some(a=>a.getAttribute('href')?.includes('ro='+id)),job.id,{timeout:1900})
   assert.ok(performance.now()-committedAt<=2000)
   assert.equal(await owner.evaluate(()=>document.activeElement.getAttribute('href')===window.focusedBoardHref),true,'A focused board card keeps focus after replacement')
   await owner.evaluate(()=>{window.filterInput.focus({preventScroll:true});window.filterInput.setSelectionRange(6,12)})
   await preserved()
   assert.ok(await owner.evaluate(handle=>window.pageIdentity===handle,pageIdentity),'Live changes retain the same document')
   assert.ok(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The existing board fits '+width)
   await owner.screenshot({path:join(directory,'board-peer-stage-'+width+'.png'),fullPage:true});await owner.screenshot({path:join(directory,'board-peer-viewport-'+width+'.png')})
   {
    await ownerContext.setOffline(true);await owner.locator('[data-board-live-status]').waitFor({state:'visible',timeout:6000});await preserved();await owner.screenshot({path:join(directory,'board-updates-offline-'+width+'.png')})
    await ownerContext.setOffline(false);await owner.locator('[data-board-live-status]').waitFor({state:'detached',timeout:6000});await preserved()
   }
   await owner.locator('#board .stage-work').screenshot({path:join(directory,'board-peer-work-'+width+'.png')});await pageIdentity.dispose()
  }
  assert.deepEqual(errors,[],'No browser script errors')
  await writeFile(join(directory,'board-live-timing.json'),JSON.stringify({dataset:{initialOpenRepairs:12,peerRepairs:2},peerVisibility:evidence,serverTiming:timings},null,2)+'\n')
  return {directory,evidence,serverTiming:timings}
 }finally{await browser?.close();await h.close()}
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))boardLiveJourney().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error);process.exitCode=1})
