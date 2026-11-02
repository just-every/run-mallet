import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {agentStandardPolicyJourney} from './support/agent-standard-policy-journey.mjs'

export async function agentStandardPolicyBrowser(){
 // Each CI shard owns its checkout. Build the shipped Worker so neither route
 // can pass by testing a simplified HTTP chain that omits the agent dispatcher.
 execFileSync('node_modules/.bin/rer',['build'],{stdio:'pipe',timeout:240000})
 const effects=[]
 const h=await installation({entry:'dist/server/index.js',network:true,secureNetwork:true,assets:true,clock:'2026-10-31T12:00:00Z',outboundService:async request=>{effects.push({method:request.method,host:new URL(request.url).host});throw Error('Unexpected outbound preparation')}})
 let browser
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  const directory=process.env.MALLET_AGENT_POLICY_PROOF_DIR??'.cache/agent-standard-policy'
  await mkdir(directory,{recursive:true})
  const shot=async name=>{
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000})
    await page.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
  const adopt=async document=>{
   await page.goto(h.origin+'/agents')
   await page.locator('[data-policy-editor] > summary').click()
   await page.getByLabel('Policy document',{exact:true}).fill(JSON.stringify(document,null,2))
   const saved=page.waitForResponse(response=>new URL(response.url()).pathname==='/agents/api/policy'&&response.request().method()==='PUT')
   const reloaded=page.waitForNavigation({waitUntil:'domcontentloaded'})
   await page.getByRole('button',{name:'Save policy document',exact:true}).click()
   assert.equal((await saved).status(),200)
   await reloaded
   assert.deepEqual(JSON.parse(await page.getByLabel('Policy document',{exact:true}).inputValue()),document,'Reloaded owner form retains the exact saved policy')
  }
  await agentStandardPolicyJourney(h,{adopt,outbound:()=>effects,observe:async(phase,{fixtures,drafts})=>{
   await page.goto(h.origin+'/agents')
   await page.locator('[data-policy-editor] > summary').click()
   await shot('policy-'+phase)
   for(const [index,f] of fixtures.entries()){
    await page.goto(h.origin+'/app/jobs/'+f.job.id)
    const main=await page.locator('main').innerText()
    if(phase==='blocked')assert.ok(main.includes('No estimate prepared.'),f.door+' repair shows no draft after blocking')
    else{
     for(const line of f.lines){
      const row=page.getByRole('row').filter({hasText:line.description})
      assert.equal(await row.getByRole('cell').nth(1).innerText(),String(line.quantity))
      assert.ok((await row.getByRole('cell').nth(2).innerText()).includes('$'+(line.unitCents/100).toFixed(2)))
     }
     assert.ok(main.includes((f.total/100).toFixed(2)),f.door+' exact draft total is visible')
     assert.ok(main.includes('Revision '+drafts[index].revisions[0].n))
     assert.equal(await page.getByRole('button',{name:'Approve estimate',exact:true}).count(),1,'A person still decides the prepared draft')
    }
    await shot('repair-'+f.door+'-'+phase)
   }
  }})
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
