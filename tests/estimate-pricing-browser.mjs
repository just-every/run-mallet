import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation,booking,authorise} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {qualityReady} from './support/quality-ready.mjs'

export async function estimatePricingBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  const setup=await fetch(h.origin+'/setup',{method:'POST',redirect:'manual',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes&ratePercent=7.5&partsTaxable=yes'});assert.equal(setup.status,303)
  const {job}=await booking(h)
  await h.command('tax.configure',{ratePercent:7.5,partsTaxable:true,laborTaxable:false})
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US'})
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message))
  await mkdir('.cache/estimate-pricing-browser',{recursive:true})
  const shot=async(name,target)=>{for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await target.scrollIntoViewIfNeeded();await p.evaluate(()=>new Promise(requestAnimationFrame));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'EST-001 no clipped actions: '+name+' '+width);await target.screenshot({path:`.cache/estimate-pricing-browser/${name}-${width}.png`})}await p.setViewportSize({width:1440,height:1000})}
  const form=command=>p.locator(`form:has(input[name="command"][value="${command}"])`).first()
  const submit=async(f,label)=>{await f.getByRole('button',{name:label,exact:true}).click();await p.waitForLoadState('domcontentloaded')}
  await p.goto(h.origin+'/app/jobs');await p.getByText('Create a rate profile',{exact:true}).click()
  let f=form('rateProfile.save')
  await f.getByLabel('Profile name',{exact:true}).fill('Metro fleet');await f.locator('select[name=kind]').selectOption('fleet');await f.getByLabel('Labor hourly rate (USD)',{exact:true}).fill('100');await f.getByLabel('Reason for this revision',{exact:true}).fill('Fleet agreement signed at counter')
  await shot('01-rate-profile-form',p.locator('#rate-profiles'));await submit(f,'Create rate profile')
  assert.equal((await h.state()).records.rateProfile[0].revisions[0].laborRateCents,10000)
  await shot('02-saved-profile',p.locator('#rate-profiles'))
  await p.goto(h.origin+'/app/jobs/'+job.id);f=form('estimate.prepare')
  for(const [label,value] of [['Part description','Brake pads'],['Part quantity','2'],['Part unit price (before tax)','50'],['Labor description','Brake replacement'],['Labor hours','2.5'],['Labor rate (per hour, before tax)','150']])await f.getByLabel(label,{exact:true}).fill(value)
  const profile=(await h.state()).records.rateProfile[0]
  await f.locator('select[name=rateProfileSource]').selectOption(JSON.stringify({id:profile.id,version:profile.version}))
  await f.getByText('Cost, discounts and fee',{exact:true}).click()
  for(const [label,value] of [['Part unit cost (USD)','30'],['Discount per part unit (USD)','5'],['Discount per labor hour (USD)','10'],['Fee description','Disposal'],['Fee before tax (USD)','12.50']])await f.getByLabel(label,{exact:true}).fill(value)
  await f.locator('select[name=feeTaxable]').selectOption('yes')
  await shot('03-mixed-estimate-form',f);await submit(f,'Prepare estimate')
  const panel=p.locator('section.card').filter({has:p.getByRole('heading',{name:'Estimate & customer authorization',exact:true})})
  assert.match(await panel.innerText(),/Metro fleet[\s\S]*\$45\.00[\s\S]*\$90\.00[\s\S]*\$12\.50[\s\S]*\$335\.19/)
  await shot('04-priced-estimate',panel)
  await p.goto(h.origin+'/app?ro='+job.id);assert.match(await p.locator('#ro').innerText(),/2 × \$45\.00[\s\S]*2.5 × \$90\.00/);await shot('07-board-estimate',p.locator('#ro'))
  let q=(await h.state()).records.estimate[0]
  const print=await context.newPage();await print.goto(h.origin+'/app/estimates/'+q.id+'/print');assert.match(await print.locator('main').innerText(),/\$45\.00[\s\S]*\$90\.00[\s\S]*\$335\.19/)
  for(const width of [1440,390]){await print.setViewportSize({width,height:1000});await print.screenshot({path:`.cache/estimate-pricing-browser/05-print-${width}.png`})}await print.close()
  q=await h.command('estimate.approve',{estimateId:q.id,version:q.version,revision:1})
  const link=await h.command('approvalLink.create',{estimateId:q.id,version:q.version,revision:1,days:7})
  const customer=await context.newPage();await customer.goto(link.url)
  const customerText=await customer.locator('main').innerText();for(const amount of ['$45.00','$90.00','$335.19'])assert.ok(customerText.includes(amount),'EST-001 customer sees exact discounted price '+amount)
  assert.doesNotMatch(await customer.locator('main').innerText(),/Unit cost/)
  for(const width of [1440,390]){await customer.setViewportSize({width,height:1000});await customer.screenshot({path:`.cache/estimate-pricing-browser/08-customer-approval-${width}.png`,fullPage:true})}
  q=(await h.state()).records.estimate[0]
  for(const line of q.revisions[0].lines)await customer.locator(`select[name="line-${line.id}"]`).selectOption('approve')
  await customer.getByLabel('Your full name',{exact:true}).fill('Cedar Fleet Manager');await customer.locator('input[name="consent"]').check();await customer.getByRole('button',{name:'Sign and submit decision',exact:true}).click();await customer.waitForLoadState('domcontentloaded')
  assert.match(await customer.locator('main').innerText(),/Approved total \$335\.19/)
  for(const width of [1440,390]){await customer.setViewportSize({width,height:1000});await customer.screenshot({path:`.cache/estimate-pricing-browser/09-customer-receipt-${width}.png`,fullPage:true})}
  await customer.close();q=(await h.state()).records.estimate[0]
  const receipt=await h.api('/api/mallet/approval-receipts/'+link.id)
  assert.equal(receipt.receipt.approved[0].unitCents,4500,'EST-001 / EST-003 exact signed receipt retains discounted unit price')
  for(const line of q.revisions[0].lines){const j=(await h.state()).records.job[0];await h.command('work.record',{jobId:job.id,version:j.version,lineId:line.id,quantity:line.quantity})}
  let j=(await h.state()).records.job[0];await qualityReady(h,j,{reviewer:await publicDoor(h.origin,h.owner).person('independent-pricing-reviewer@example.test','admin')});j=(await h.state()).records.job[0];j=await h.command('job.complete',{jobId:job.id,version:j.version})
  await h.command('invoice.prepare',{jobId:job.id,version:j.version})
  await p.goto(h.origin+'/app/jobs/'+job.id)
  const invoice=p.locator('section.card').filter({has:p.getByRole('heading',{name:'Handover invoice',exact:true})})
  assert.match(await invoice.innerText(),/\$45\.00[\s\S]*\$90\.00[\s\S]*\$335\.19/)
  await shot('06-invoice',invoice)
  await p.goto(h.origin+'/app/jobs');await p.getByText('Metro fleet · fleet · $100.00 per hour · revision 1',{exact:true}).click()
  const edit=form('rateProfile.save');await edit.getByLabel('Labor hourly rate (USD)',{exact:true}).fill('110');await edit.getByLabel('Reason for this revision',{exact:true}).fill('Next-period fleet agreement')
  await shot('10-rate-revision-form',edit);await submit(edit,'Save rate revision')
  await p.getByText('Metro fleet · fleet · $110.00 per hour · revision 2',{exact:true}).click();await p.getByText('Rate history',{exact:true}).click()
  await shot('11-rate-history',p.locator('#rate-profiles'))
  assert.equal((await h.state()).records.estimate[0].revisions[0].rateProfile.snapshot.laborRateCents,10000,'EST-001 native rate edit keeps the accepted profile snapshot')
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
