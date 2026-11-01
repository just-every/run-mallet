import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {agentPauseInstallation,agentPauseFixture,pausedAgentCalls,refusedAgentResume,resumedPreparation} from './support/agent-pause-journey.mjs'
import {rateOverrun} from './support/agent-capacity.mjs'
import {businessPairing,businessPause,businessResume,refusedBusinessResume} from './support/agent-business-pause.mjs'
import {otherAgentCredentials,pausedOtherCredentials,resumedOtherCredentials} from './support/agent-pause-credentials.mjs'

export async function agentPauseBrowser(){
 const h=await agentPauseInstallation();let browser
 try{
  const f=await agentPauseFixture(h),others=await otherAgentCredentials(f)
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'UTC',ignoreHTTPSErrors:true})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const directory=process.env.MALLET_SCREENSHOTS??'.cache/agent-pause-browser'
  await mkdir(directory,{recursive:true})
  const shot=async name=>{
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Pause screen fits '+width)
    assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(node=>node.querySelector('svg,img')&&!node.textContent.trim()&&!node.getAttribute('data-tooltip')).length),0,'Icon controls retain tooltips')
    await page.screenshot({path:join(directory,`${name}-${width}.png`),fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
  const toggle=async name=>{
   const response=page.waitForResponse(response=>new URL(response.url()).pathname==='/agents/api/pause'&&response.request().method()==='POST')
   await page.getByRole('button',{name,exact:true}).click()
   assert.equal((await response).status(),200)
  }
  // Browser sessions keep working while agents are paused: the owner's native priority form saves.
  const ownerPriority=async(priority,reason)=>{
   await page.goto(h.origin+'/app/jobs/'+f.dispatch.id)
   const flow=page.locator('#flow')
   await flow.getByText('Change priority',{exact:true}).click()
   await flow.getByLabel('Priority').selectOption(priority)
   await flow.getByLabel('Why',{exact:true}).fill(reason)
   await flow.getByRole('button',{name:'Save priority',exact:true}).click()
   await page.waitForLoadState('domcontentloaded');await page.reload()
   assert.match(await flow.innerText(),new RegExp('Priority: '+priority))
   const saved=(await h.state()).records.flow.find(row=>row.jobId===f.dispatch.id)
   assert.equal(saved.priority,priority);assert.equal(saved.priorityHistory.at(-1).reason,reason)
   assert.equal(saved.priorityHistory.at(-1).by.id,f.owner.id)
   assert.equal((await f.rpc('mallet.repairs.list',{})).result._meta['com.runeditrun/error'].code,'agents_paused')
  }
  await page.goto(h.origin+'/agents')
  await page.getByRole('button',{name:'Pause agents',exact:true}).waitFor()
  const pausedAt=performance.now()
  await toggle('Pause agents')
  await page.getByRole('button',{name:'Resume agents',exact:true}).waitFor()
  assert.match(await page.locator('[data-agents-state]').innerText(),/Agents are paused/)
  await pausedAgentCalls(f,pausedAt)
  await pausedOtherCredentials(f,others,pausedAt,'6 other credentials')
  await refusedAgentResume(f)
  await page.reload();assert.match(await page.locator('[data-agents-state]').innerText(),/Agents are paused/)
  await shot('01-paused')
  await ownerPriority('urgent','synthetic-mallet-1240')
  assert.equal((await h.api('/agents/api/state')).paused.local,true)
  console.log('PROBE BASE-AGENT-011 6 owner session: native repair priority form while paused -> urgent priority retained with exact owner and reason; agents remain paused')
  await shot('02-owner-work')
  await page.goto(h.origin+'/agents');await toggle('Resume agents')
  await page.getByRole('button',{name:'Pause agents',exact:true}).waitFor()
  assert.match(await page.locator('[data-agents-state]').innerText(),/Agents are on/)
  assert.deepEqual((await h.api('/agents/api/state')).paused,{business:false,local:false})
  const draft=await resumedPreparation(f)
  await resumedOtherCredentials(f,others)
  await shot('03-resumed')
  await page.goto(h.origin+'/app/jobs/'+f.prepare.id);await page.reload()
  const estimate=page.locator('section').filter({has:page.getByRole('heading',{name:'Estimate & customer authorization',exact:true})})
  assert.match(await estimate.innerText(),/synthetic-mallet-1102/)
  assert.match(await estimate.innerText(),/1\.25/);assert.match(await estimate.innerText(),/40\.00/)
  assert.equal((await h.state()).records.estimate.filter(row=>row.jobId===f.prepare.id).length,1)
  assert.equal(draft.jobId,f.prepare.id)
  await shot('04-retained-draft')
  await rateOverrun(f)
  // Pause all agents in Business: the same installation, paired, takes Pause from signed company policy.
  const business=await businessPairing(f)
  await page.goto(h.origin+'/agents')
  assert.match(await page.locator('main').innerText(),/Managed in Business/)
  assert.match(await page.locator('[data-agents-state]').innerText(),/Agents are on/)
  const businessPausedAt=await businessPause(f,business)
  await pausedAgentCalls(f,businessPausedAt,'6 Business')
  await pausedOtherCredentials(f,others,businessPausedAt,'6 Business other credentials')
  await refusedBusinessResume(f,business)
  await page.reload()
  assert.match(await page.locator('[data-agents-state]').innerText(),/Agents are paused/)
  assert.match(await page.locator('main').innerText(),/Paused in Business/)
  await shot('05-business-paused')
  await ownerPriority('high','synthetic-mallet-1263')
  assert.equal((await h.api('/agents/api/state')).paused.business,true)
  console.log('PROBE BASE-AGENT-011 6 Business owner session: native repair priority form while Business Pause is active -> high priority retained with exact owner and reason; agents remain paused')
  const invoice=await businessResume(f,business)
  await resumedOtherCredentials(f,others)
  await page.goto(h.origin+'/agents')
  assert.match(await page.locator('[data-agents-state]').innerText(),/Agents are on/)
  assert.doesNotMatch(await page.locator('main').innerText(),/Paused in Business/)
  await shot('06-business-resumed')
  await page.goto(h.origin+'/app/jobs/'+invoice.jobId);await page.reload()
  assert.match(await page.locator('main').innerText(),new RegExp(invoice.number))
  await shot('07-retained-invoice')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
