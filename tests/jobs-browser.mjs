import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {readyInvoice} from './support/return-journey.mjs'
import {jobsClock,reminderMailEdge,reminderConcurrency,reminderLeaseRecovery} from './support/jobs-journey.mjs'

export async function jobsBrowser(){
 let fail=true,browser,calls=0
 const edge=reminderMailEdge()
 const h=await installation({clock:jobsClock,mailService:edge.send,network:true,secureNetwork:true,assets:true,bindings:{STRIPE_SECRET_KEY:'synthetic-mallet-101'},outboundService:async request=>{assert.equal(request.method,'GET');calls++;return Response.json({error:'synthetic-mallet-102'},{status:fail?503:404})}})
 try{
  await shopSetup(h);await readyInvoice(h);await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM_PATH?{executablePath:process.env.MALLET_CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true});await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const directory=process.env.MALLET_OPS_PROOF_DIR??'.cache/ops-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,target=p.locator('main'),fullPage=false)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(fullPage)await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage})}}
  await p.goto(h.origin+'/app/data');await p.getByRole('link',{name:'Open background jobs'}).click();await p.waitForLoadState('domcontentloaded');await shot('jobs-01-open')
  await p.getByLabel('Stripe payment intent identifier').fill('synthetic-mallet-103');await p.getByLabel('Owner approval evidence',{exact:true}).fill('Owner requested a read-only payment check for the issued invoice');await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Queue payment check'}).click();await p.waitForLoadState('domcontentloaded');await shot('jobs-02-pending',p.getByRole('heading',{name:'Recent jobs',exact:true}).locator('..'))
  assert.equal((await h.api('/api/mallet/jobs')).jobs[0].status,'pending');assert.equal(calls,0)
  await h.restart();await h.cron(Date.parse(jobsClock)+1000);await p.reload();await shot('jobs-03-failure',p.getByRole('heading',{name:'Recent jobs',exact:true}).locator('..'));assert.equal(calls,1)
  const recovery=p.locator('form[action="/app/background-jobs/recover"]');await recovery.getByLabel('Recovery action').selectOption('replay');await recovery.getByLabel('Recovery reason').fill('Owner inspected the failed provider request and authorizes a new GET');await recovery.getByLabel('Fresh approval evidence for replay').fill('Read-only recovery approved at the counter');await recovery.getByRole('checkbox').check();await recovery.getByRole('button',{name:'Record recovery'}).click();await p.waitForLoadState('domcontentloaded');await shot('jobs-04-replay',p.getByRole('heading',{name:'Recent jobs',exact:true}).locator('..'))
  fail=false;await h.cron(Date.parse(jobsClock)+2000);await p.reload();assert.equal(calls,2);assert.equal((await h.api('/api/mallet/jobs')).jobs[0].status,'failed')
  const resolve=p.locator('form[action="/app/background-jobs/recover"]');await resolve.getByLabel('Recovery reason').fill('Processor confirmed no matching payment; advisor will review separately');await resolve.getByRole('button',{name:'Record recovery'}).click();await p.waitForLoadState('domcontentloaded');await shot('jobs-05-human-resolution',p.getByRole('heading',{name:'Recent jobs',exact:true}).locator('..'));await shot('jobs-06-history',p.getByRole('heading',{name:'Human recovery history',exact:true}).locator('..'))
  assert.equal((await h.api('/api/mallet/jobs')).jobs[0].status,'resolved');assert.deepEqual(errors,[])
  await reminderConcurrency(h,edge,async({phase,jobs})=>{
   await p.setViewportSize({width:1440,height:1000});await p.reload()
   const queue=p.getByRole('heading',{name:'Queue diagnostics',exact:true}).locator('..')
   if(phase==='backlog'){
    assert.ok((await queue.innerText()).includes('dispatching: 4'))
    assert.ok((await queue.innerText()).includes('pending: 1'))
   }else if(phase==='replenished'){
    assert.ok((await queue.innerText()).includes('dispatching: 4'))
    assert.ok((await queue.innerText()).includes('succeeded: 1'))
    assert.ok(!(await queue.innerText()).includes('pending:'))
   }else assert.ok((await queue.innerText()).includes('succeeded: 5'))
   for(const job of jobs){
    const row=p.locator('li.plain').filter({hasText:job.id})
    assert.equal(await row.getByRole('heading',{name:`Estimate reminder · ${job.status}`,exact:true}).count(),1)
    assert.ok((await row.innerText()).includes(`${job.attempts} attempt`))
    if(job.status==='succeeded')assert.ok((await row.innerText()).includes(`Provider: resend · accepted · ${job.outcome.providerMessageId}`))
   }
   await shot('jobs-07-'+phase,p.locator('main'),true)
  })
  await reminderLeaseRecovery(h,edge,async({phase,job,receipt})=>{
   await p.setViewportSize({width:1440,height:1000});await p.reload()
   const row=p.locator('li.plain').filter({hasText:job.id})
   assert.equal(await row.getByRole('heading',{name:`Estimate reminder · ${phase}`,exact:true}).count(),1)
   assert.ok((await row.innerText()).includes('Provider: unknown · uncertain'))
   assert.ok((await row.innerText()).includes('1 attempt'))
   if(phase==='uncertain')assert.deepEqual(await row.getByLabel('Recovery action').locator('option').evaluateAll(options=>options.map(option=>option.value)),['resolve'],'The native reminder door offers resolution without outbound replay')
   else{
    assert.equal(await row.locator('form').count(),0)
    const history=p.getByRole('heading',{name:'Human recovery history',exact:true}).locator('..')
    assert.ok((await history.innerText()).includes(receipt.reason))
   }
   await shot('jobs-08-'+phase,row,true)
  })
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
