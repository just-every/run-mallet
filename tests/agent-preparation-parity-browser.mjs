import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {checkAgentDoor} from '@runeditrun/rer/internal/cli/agent-door.mjs'
import {usePreparationBrowser} from './agent-door/preparation-parity.mjs'

// Browser requests go to the emitted production Worker at its configured hosted
// origin. Only the loopback ingress is bridged; no application route is mocked.
async function personPage(browser,door){
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'UTC',serviceWorkers:'block'})
 await context.addCookies(door.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:door.origin})))
 await context.route(door.origin+'/**',async route=>{
  const request=route.request(),response=await door.request(request.url(),{method:request.method(),headers:await request.allHeaders(),redirect:'manual',...(request.postDataBuffer()?{body:request.postDataBuffer()}:{})})
  const headers=Object.fromEntries(response.headers)
  delete headers['content-encoding'];delete headers['content-length'];delete headers['transfer-encoding']
  if(response.headers.getSetCookie().length)headers['set-cookie']=response.headers.getSetCookie().join('\n')
  await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())})
 })
 return {context,page:await context.newPage()}
}

export async function preparationParityBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 const directory=process.env.MALLET_SCREENSHOTS??'.cache/agent-preparation-parity'
 await mkdir(directory,{recursive:true})
 usePreparationBrowser(async proof=>{
  const native=await personPage(browser,proof.peer.door),agent=await personPage(browser,proof.source),errors=[]
  for(const {page} of [native,agent])page.on('pageerror',error=>errors.push(error.message))
  const {phase,step}=proof.context
  return {
   async prepare(path,command,input){
    const page=native.page
    await page.goto(proof.peer.door.origin+path)
    const form=page.locator('form').filter({has:page.locator(`input[name="command"][value="${command}"]`)}).filter({has:page.locator(`input[name="jobId"][value="${input.jobId}"]`)})
    assert.equal(await form.count(),1,'The owner uses the existing exact-repair form')
    assert.equal(Number(await form.locator('input[name="version"]').inputValue()),input.version)
    if(step.id==='dispatch'){
     for(const field of ['bayId','technicianId'])await form.locator(`select[name="${field}"]`).selectOption(input[field])
     for(const field of ['startAt','endAt','reason'])await form.locator(`input[name="${field}"]`).fill(input[field])
    }
    const submitted=page.waitForResponse(response=>new URL(response.url()).pathname==='/app/actions'&&response.request().method()==='POST')
    await form.getByRole('button',{name:step.id==='dispatch'?'Prepare dispatch move':'Prepare invoice',exact:true}).click()
    assert.equal((await submitted).status(),303,'The native owner form prepares successfully')
    await page.waitForLoadState('domcontentloaded')
   },
   async readback({actual,native:prepared}){
    for(const [label,view,door,row,job] of [['person',native,proof.peer.door,prepared,proof.nativeJob],['agent',agent,proof.source,actual,proof.job]]){
     const {page}=view
     await page.goto(door.origin+'/app/jobs/'+job.id);await page.reload()
     const heading=step.id==='dispatch'?'Prepared dispatch plans':'Handover invoice'
     const panel=page.locator('section.card').filter({has:page.getByRole('heading',{name:heading,exact:true})})
     assert.equal(await panel.count(),1)
     const text=await panel.innerText()
     assert.ok(text.includes(row.preparedBy.name),'Rendered preparation identifies the actual person or agent for person')
     if(step.id==='dispatch'){
      assert.ok(text.includes('Diagnostic bench'));assert.ok(text.includes(row.reason))
      const values=await panel.locator('dd').allTextContents()
      assert.equal(values[0],'Diagnostic bench');assert.equal(values[1],'Synthetic Base 1')
      assert.deepEqual(await panel.locator('time').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('datetime'))),[row.plan.startAt,row.plan.endAt])
      assert.equal(await panel.getByRole('button',{name:'Approve dispatch plan',exact:true}).count(),1,'The dispatch proposal still awaits a person')
     }else{
      assert.equal(await panel.locator('li').count(),2)
      for(const value of ['synthetic-mallet-940 pads','synthetic-mallet-941 adjustment','2 × $25.00','$55.00','0.75 × $120.00','$99.00','revision 2','$154.00'])assert.ok(text.includes(value),'Rendered exact invoice: '+value)
      assert.ok(!text.includes('synthetic-mallet-942 declined service'))
      assert.equal(await panel.getByRole('button',{name:'Approve invoice',exact:true}).count(),1)
      assert.equal(await panel.getByRole('button',{name:'Export invoice once',exact:true}).count(),0)
      assert.equal(await panel.getByRole('link',{name:'Download saved invoice CSV',exact:true}).count(),0)
     }
     assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(node=>node.querySelector('svg,img')&&!node.textContent.trim()&&!node.getAttribute('data-tooltip')).length),0,'Icon-only controls retain their tooltips')
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Preparation screen fits the desktop')
     for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000})
      await page.screenshot({path:join(directory,`${phase}-${step.id}-${label}-${width}.png`),fullPage:true})
     }
    }
    assert.deepEqual(errors,[])
   },
   async close(){await native.context.close();await agent.context.close()},
  }
 })
 try{const result=await checkAgentDoor(process.cwd());assert.equal(result.ok,true,'Production MCP and native preparation parity with browser readback')}
 finally{usePreparationBrowser(undefined);await browser.close()}
}
