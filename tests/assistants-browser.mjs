import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,booking} from './harness.mjs'
import {receptionistFixture,asKey,grantInput} from './support/assistant-journey.mjs'
export async function assistantsBrowser(){
 const h=await installation({network:true,secureNetwork:true,assets:true});let browser
 try{
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true}),p=await context.newPage(),dir=process.env.MALLET_ASSISTANT_PROOF_DIR??'.cache/assistants-browser';await mkdir(dir,{recursive:true});p.setDefaultTimeout(10000)
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  await p.setViewportSize({width:1440,height:1000})
  const shot=async name=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await p.screenshot({path:join(dir,name+'-'+width+'.png'),fullPage:true})}await p.setViewportSize({width:1440,height:1000})}
  await p.goto(h.origin+'/setup');await p.getByLabel('Sales tax rate (%)',{exact:true}).fill('7.5');await p.getByLabel('I confirm this owner account is ready to use.').check();await p.getByRole('button',{name:'Finish setup'}).click();await p.waitForURL('**/app')
  const f=await receptionistFixture(h);await h.stepUp();await p.goto(h.origin+'/app/data');await p.getByRole('link',{name:'Assistant settings',exact:true}).click();await shot('01-scoped-settings')
  const create=p.locator('form').filter({has:p.getByRole('button',{name:'Create scoped key'})})
  await create.getByLabel('Allowed data and action').selectOption(JSON.stringify({kind:'receptionist',subjectId:f.service.id}));await create.getByLabel('Assistant label').fill('Front counter assistant');await create.getByLabel('Grant reason').fill('Owner permits appointment intake only');await create.getByRole('checkbox').check();await create.getByRole('button').click();await p.waitForURL('**/app/actions')
  assert.match(await p.locator('main').innerText(),/Zero spend/)
  // The one-time key screen is intentionally excluded from screenshots.
  const token=await p.locator('main pre').innerText(),auth=asKey(token)
  const result=await h.command('assistant.intake',f.input,auth),help=await h.command('assistant.escalate',{reason:'Customer asks an advisor to discuss brake symptoms'},auth)
  const {job}=await booking(h),d=await h.command('diagnosis.record',{jobId:job.id,version:job.version,complaint:'  Brake   noise at 40 mph. ',measurements:[{name:'Rotor thickness',value:23.7,unit:'mm'}]})
  const polish=await h.command('assistant.grant',grantInput('polish',job.id));await h.command('assistant.polish',{diagnosisId:d.id,version:d.version},asKey(polish.token))
  const sendGrant=await h.command('assistant.grant',grantInput('send',result.appointment.id)),send=await h.command('assistant.queue',{},asKey(sendGrant.token))
  await p.goto(h.origin+'/app/settings/assistants');await p.getByText('Raw technician evidence',{exact:true}).click();await p.getByText('Proposed note edit',{exact:true}).click()
  assert.match(await p.locator('main').innerText(),/Brake   noise at 40 mph/);assert.match(await p.locator('main').innerText(),/Brake noise at 40 mph/);assert.match(await p.locator('main').innerText(),/23.7/);assert.match(await p.locator('main').innerText(),/Customer asks an advisor/)
  assert.equal(await p.locator('button,a[href]').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none'&&!n.textContent.trim()).length),0,'All controls on the changed screen have visible words')
  await shot('02-intake-notes-email-review')
  const review=p.locator('form').filter({has:p.getByRole('button',{name:'Approve exact email'})});await review.getByRole('checkbox').check();await review.getByRole('button').click();await p.waitForURL('**/app/settings/assistants')
  const grantCard=p.locator('article').filter({has:p.getByRole('heading',{name:'synthetic-mallet-assistant · send',exact:true})});await grantCard.getByLabel('Revocation reason').fill('Owner withdraws queued send authority');await grantCard.getByRole('button',{name:'Revoke grant'}).click();await p.waitForURL('**/app/settings/assistants')
  const before=h.messages.length;await h.command('assistant.send',{sendId:send.id,version:2},{...asKey(sendGrant.token),status:401});assert.equal(h.messages.length,before)
  const resolve=p.locator('form').filter({has:p.getByRole('button',{name:'Record resolution'})});await resolve.getByLabel('Human resolution').fill('Owner spoke with customer; no repair authorization granted');await resolve.getByRole('button').click();await p.waitForURL('**/app/settings/assistants')
  assert.match(await p.locator('main').innerText(),/stopped/);assert.match(await p.locator('main').innerText(),/Resolved: Owner spoke with customer/);assert.ok((await h.state()).records.assistantEscalation.find(x=>x.id===help.id).resolution)
  await shot('03-revocation-and-human-resolution')
 }finally{await browser?.close();await h.close()}
}
