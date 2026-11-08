import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {sponsorAdmission} from './agent-door/sponsor-admission.mjs'

export async function sponsorAdmissionBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 const directory=process.env.MALLET_SCREENSHOTS??'.cache/agent-sponsor-admission'
 await mkdir(directory,{recursive:true})
 try{
  await sponsorAdmission({proof:async({stage,door,sponsors,cases})=>{
   const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'UTC',serviceWorkers:'block'})
   try{
    await context.addCookies(door.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:door.origin})))
    await context.route(door.origin+'/**',async route=>{
     const request=route.request(),response=await door.request(request.url(),{method:request.method(),headers:await request.allHeaders(),redirect:'manual',...(request.postDataBuffer()?{body:request.postDataBuffer()}:{})})
     const headers=Object.fromEntries(response.headers)
     delete headers['content-encoding'];delete headers['content-length'];delete headers['transfer-encoding']
     if(response.headers.getSetCookie().length)headers['set-cookie']=response.headers.getSetCookie().join('\n')
     await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())})
    })
    const page=await context.newPage(),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    const screens=async name=>{
     if(stage!=='refused')return
     for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000})
      await page.screenshot({path:join(directory,`${name}-${width}.png`),fullPage:true})
     }
     await page.setViewportSize({width:1440,height:1000})
    }
    await page.goto(door.origin+'/app/data');await page.reload()
    const access=await page.locator('main').innerText()
    for(const sponsor of sponsors){
     assert.ok(access.includes(sponsor.key.label),'Access inventory retains the issued key identity')
     assert.ok(!access.includes(sponsor.key.token),'Access inventory never reveals an existing credential')
    }
    await screens('preparation-access')
    for(const entry of cases){
     await page.goto(door.origin+'/app/jobs/'+entry.job.id);await page.reload()
     const card=page.locator('section.card').filter({has:page.getByRole('heading',{name:'Estimate & customer authorization',exact:true})})
     const text=await card.innerText()
     assert.ok(text.includes(entry.saved.revisions[0].preparedBy.name),'Retained draft shows the original agent for its native admin sponsor')
     assert.ok(text.includes('synthetic-mallet-970 private brake draft'))
     assert.ok(text.includes('$99.00'),'Rendered total matches the independent exact draft expectation')
     assert.equal(await card.getByRole('button',{name:'Approve estimate',exact:true}).count(),1,'Sponsor revocation never fabricates a native approval')
     assert.equal(await card.getByRole('button',{name:'Record estimate shared',exact:true}).count(),0,'Retained draft has not been shared')
     assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(node=>node.querySelector('svg,img')&&!node.textContent.trim()&&!node.getAttribute('data-tooltip')).length),0)
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Repair readback fits the desktop')
     await screens(`${entry.phase}-${entry.sponsor.change}-retained-draft`)
    }
    assert.deepEqual(errors,[])
   }finally{await context.close()}
  }})
 }finally{await browser.close()}
}
