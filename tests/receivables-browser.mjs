import {handoverInput} from './support/handover-input.mjs'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation,archive,restore} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {receivablesFixture,balanceFailureFixture,balanceRecoveryMail} from './support/receivables-journey.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
export async function receivablesBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  h.person=publicDoor(h.origin,h.owner).person
  const {account,driver,manager,control,i1,i2,invoice:makeInvoice}=await receivablesFixture(h)
  await h.stepUp()
  browser=await chromium.launch({headless:true,...(process.env.MALLET_CHROMIUM?{executablePath:process.env.MALLET_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({ignoreHTTPSErrors:true}),p=await context.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message))
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const directory=process.env.MALLET_RECEIVABLES_PROOF_DIR??'.cache/receivables-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,width)=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>(n.querySelector('svg,img'))&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Every icon control has a tooltip');await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}
  const form=(command,invoiceId)=>p.locator((invoiceId?'#ar-'+invoiceId+' ':'')+`form:has(input[name="command"][value="${command}"])`)
  const submit=async(command,fields,{invoiceId,checks=[],selects={}}={})=>{const f=form(command,invoiceId);for(const [name,value]of Object.entries(fields))await f.locator(`[name="${name}"]`).fill(String(value));for(const name of checks)await f.locator(`[name="${name}"]`).check();for(const [name,value]of Object.entries(selects))await f.locator(`[name="${name}"]`).selectOption(value);const pending=p.waitForResponse(r=>new URL(r.url()).pathname==='/app/actions'&&r.request().method()==='POST');await f.getByRole('button').click();assert.equal((await pending).status(),303);await p.waitForLoadState('domcontentloaded')}
  const ledger=h.origin+'/app/receivables?'+new URLSearchParams({accountId:account.id,asOf:'2099-01-02'})
  const check=await h.command('payment.record',{invoiceId:i1.id,version:i1.version,method:'check',amountCents:5000,reference:'synthetic-mallet-native-bank',evidence:'Fleet check observed, not cleared'})
  for(const [index,width]of [1440,390].entries()){
   await p.setViewportSize({width,height:1000})
   let job=(await h.state()).records.job.find(j=>j.id===control.job.id),quote=await h.command('estimate.prepare',{jobId:job.id,version:job.version,supplement:true,reason:'Fleet requested incremental native scope',lines:[{kind:'labor',description:'Native fleet supplement '+width,quantity:1,unitCents:100}]})
   quote=await h.command('estimate.approve',{estimateId:quote.id,version:quote.version,revision:1});quote=await h.command('estimate.markSent',{estimateId:quote.id,version:quote.version,revision:1,method:'phone'})
   manager.version=(await h.command('contact.save',{...manager,contactId:manager.id,notes:'synthetic-mallet-'+(50+index)})).version
   await p.goto(h.origin+'/app/jobs/'+job.id)
   const quoteCard=p.locator('section').filter({has:p.locator('form:has(input[value="estimate.approve"]):has(input[value="'+quote.id+'"])')})
   assert.equal(await p.locator('form:has(input[value="estimate.authorise"]):has(input[value="'+quote.id+'"])').count(),0,'A changed authorizer requires fresh approval before customer authority')
   await quoteCard.scrollIntoViewIfNeeded();await shot('00-voided-fleet-approval',width)
   await quoteCard.getByRole('button',{name:'Approve estimate',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   const share=p.locator('form:has(input[value="estimate.markSent"]):has(input[value="'+quote.id+'"])');await share.locator('[name="channel"]').selectOption('phone');await share.getByRole('button',{name:'Record estimate shared',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   const authorization=p.locator('form:has(input[value="estimate.authorise"]):has(input[value="'+quote.id+'"])')
   await authorization.locator('[name="lineIds"]').check();await authorization.locator('[name="customerName"]').fill(manager.name);await authorization.locator('[name="po"]').fill('synthetic-mallet-native-repair-po-'+width);await authorization.locator('[name="fleetEvidence"]').fill('Owner reviewed exact fleet manager approval against this PO');await authorization.locator('[name="evidence"]').fill('Fleet manager phone instruction for these exact lines')
   await authorization.scrollIntoViewIfNeeded();await shot('00-fleet-repair-authority-form',width);await authorization.screenshot({path:join(directory,'00-authority-fields-'+width+'.png')})
   await authorization.getByRole('button',{name:'Record customer authorization',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),new RegExp('synthetic-mallet-native-repair-po-'+width));await shot('00b-fleet-authority-recorded',width)
   await p.goto(h.origin+'/app/accounts?manage='+account.id);await shot('01-account-entry',width)
   await p.getByRole('link',{name:'Commercial receivables',exact:true}).click();await p.locator('select[name="accountId"]').selectOption(account.id);await p.getByRole('button',{name:'Review statement',exact:true}).click();await shot('02-before-terms',width)
   await submit('ar.terms',{days:30,limitUsd:300,evidence:'Fleet explicitly agreed to owner-reviewed net terms'},{checks:['consent']})
   const invoice=index===0?i1:i2
   await submit('ar.invoice',{po:'synthetic-mallet-native-po-'+width,evidence:'Allowed fleet manager approved this PO; driver has no approval authority'},{invoiceId:invoice.id})
   await p.goto(ledger);assert.match(await p.locator('main').innerText(),/Current account statement/);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/synthetic-mallet-native-po-/);await shot('03-terms-and-statement',width)
   await p.goto(h.origin+'/app/invoices/'+invoice.id)
   await p.getByLabel('Unique issue reference',{exact:true}).fill('synthetic-mallet-term-native-'+width);await p.locator('[name="warrantyTerms"]').fill('Fleet accounts reviewed shop warranty terms');await p.getByRole('button',{name:'Issue exact invoice copy',exact:true}).click();await p.waitForLoadState('domcontentloaded')
   assert.match(await p.locator('main').innerText(),/Commercial terms: net 30 days/);assert.match(await p.locator('main').innerText(),new RegExp('synthetic-mallet-native-po-'+width))
   await p.getByLabel('Email consent evidence',{exact:true}).fill('Fleet accounts explicitly requested this exact term invoice');await p.getByRole('checkbox',{name:'Customer explicitly requested this invoice by email',exact:true}).check();await p.getByRole('button',{name:'Email exact invoice copy',exact:true}).click();await p.waitForLoadState('domcontentloaded');assert.match(await p.locator('main').innerText(),/Saved in development; not sent/);await shot('03a-term-invoice-handoff',width)
   await p.goto(ledger)
   await submit('ar.remind',{evidence:'Owner reviewed the current balance and billing recipient',consentEvidence:'Billing contact explicitly requested this exact balance reminder by email'},{invoiceId:invoice.id,checks:['consent']})
   await p.goto(ledger);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Suppressed in development/);await shot('03b-consented-balance-reminder',width)
   const reminderDay=new Date(Date.now()+3*86400000).toISOString().slice(0,10)
   await submit('outreach.schedule',{dueAt:reminderDay+'T15:00:00Z',expiresAt:reminderDay+'T18:00:00Z',timeZone:'UTC',allowedStart:9,allowedEnd:18,consentEvidence:'Billing contact requested one scheduled balance email'},{invoiceId:invoice.id,checks:['consent']})
   await p.goto(ledger);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Scheduled balance reminder/);await shot('03c-scheduled-balance-reminder',width)
   await submit('outreach.stop',{reason:'Billing contact canceled this scheduled request'},{invoiceId:invoice.id})

   await submit('ar.dispute' ,{evidence:'Fleet disputed the recorded work pending review'},{invoiceId:invoice.id})
   await p.goto(ledger);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Dispute open/);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Chasing paused/);await shot('04-dispute-pauses-chasing',width)
   await submit('ar.promise',{promisedOn:'2099-01-03',amountUsd:10,evidence:'Fleet promised ten dollars on the selected UTC date'},{invoiceId:invoice.id})
   await p.goto(ledger);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Promised \$10.00 on 2099-01-03/);await shot('05-payment-promise-and-downtime',width)
   await p.goto(h.origin+'/app/tax/custody');await shot('06-tax-custody-entry',width);await p.getByRole('link',{name:'Review filing-period tax preview'}).click()
   await p.goto(h.origin+'/app/tax/filing?from=2000-01-01&to=2099-01-01');assert.match(await p.locator('main').innerText(),/Filing-period preview/);await shot('07-filing-review',width)
   if(index===0){await submit('tender.clearance',{observedOn:check.at.slice(0,10),reference:'synthetic-mallet-bank-native',evidence:'Owner inspected bank clearance of the recorded fleet check'})}
   await p.goto(h.origin+'/app/tax/filing?from=2000-01-01&to=2099-01-01');assert.match(await p.locator('main').innerText(),/collected tax \$4.55/);assert.equal(await form('tender.clearance').count(),0);await shot('08-observed-clearance-preview',width)
   await p.goto(ledger)
   assert.equal(await p.locator('#ar-'+invoice.id+' [data-recorded-custody]').getAttribute('data-recorded-custody'),'unknown','A booked interval is not a custody receipt')
   for(const [n,capturedAt]of ['2026-09-29T07:00:00Z','2026-09-30T07:15:00Z'].entries()){
    await p.goto(h.origin+'/app/jobs/'+invoice.jobId+'/intake')
    await submit('intake.record',{capturedAt,damage:'Fleet driver documented the left door condition before this visit',itemLines:'key | Fleet van key | 1',lockHandling:'Driver retains unlock material',signedBy:driver.name},{checks:['consent'],selects:{phase:'before'}})
    await p.goto(ledger)
    assert.equal(await p.locator('#ar-'+invoice.id+' [data-recorded-custody]').getAttribute('data-recorded-custody'),n===0?'open':'unknown','Open or competing custody sources stay honest')
   }
   const intake=(await h.state()).records.intake.filter(r=>r.jobId===invoice.jobId).sort((a,b)=>a.n-b.n).at(-1)
   const input=await handoverInput(h,invoice.jobId,account.name,{intake}),assignment=(await h.state()).records.arInvoice.find(r=>r.invoiceId===invoice.id)
   await p.goto(h.origin+'/app/jobs/'+invoice.jobId+'/return');await shot('09-open-terms-handover',width)
   await submit('flow.collect',{collectorName:account.name,identityEvidence:input.identityEvidence,warrantyAdvice:input.warrantyAdvice},{selects:{termsAssignmentId:assignment.id,comparisonId:input.comparisonId,readingId:input.readingId}})
   assert.match(await p.locator('#handover-receipt').innerText(),/Released on account terms; balance due/);assert.match(await p.locator('#handover-receipt').innerText(),/No payment is recorded by release/);await shot('10-account-terms-receipt',width)
   const beforeRead=await h.state(),mailBeforeRead=h.messages.length,receipt=beforeRead.records.handover.find(r=>r.invoiceId===invoice.id)
   await p.goto(ledger)
   const evidence=p.locator('#ar-'+invoice.id+' [data-recorded-custody]')
   assert.equal(await evidence.getAttribute('data-recorded-custody'),'recorded');assert.match(await evidence.innerText(),/not verified off-road downtime/)
   await evidence.getByText('Inspect custody and invoice sources',{exact:true}).click()
   const text=await evidence.innerText();for(const id of [intake.id,receipt.id,receipt.comparison.id,invoice.id])assert.ok(text.includes(id),'Statement exposes exact source '+id)
   assert.match(text,/Frozen invoice charge \$110.00/);assert.match(text,/revision 1/)
   assert.deepEqual(await evidence.locator('time').evaluateAll(nodes=>nodes.map(n=>n.dateTime)),[intake.capturedAt,receipt.at,intake.capturedAt,intake.at,receipt.comparison.at,receipt.at])
   await shot('10a-recorded-custody-sources',width)
   await evidence.getByRole('link',{name:'Signed before-condition intake',exact:true}).click()
   assert.equal(new URL(p.url()).hash,'#intake-'+intake.id);assert.match(await p.locator('#intake-'+intake.id).innerText(),/Fleet van key/);await shot('10b-exact-intake-source',width)
   await p.goto(ledger);await evidence.getByText('Inspect custody and invoice sources',{exact:true}).click()
   await evidence.getByRole('link',{name:'Signed checklist comparison',exact:true}).click();assert.equal(new URL(p.url()).hash,'#comparison-'+receipt.comparison.id);assert.match(await p.locator('#comparison-'+receipt.comparison.id).innerText(),/Fleet van key: 1 of 1 returned/)
   await p.goto(ledger);await evidence.getByText('Inspect custody and invoice sources',{exact:true}).click()
   await evidence.getByRole('link',{name:'Documented handover',exact:true}).click();assert.match(await p.locator('#handover-receipt').innerText(),new RegExp(assignment.dueOn))
   await p.goto(ledger);await evidence.getByText('Inspect custody and invoice sources',{exact:true}).click()
   await evidence.getByRole('link',{name:'Frozen invoice charge $110.00',exact:true}).click();assert.equal(new URL(p.url()).pathname,'/app/invoices/'+invoice.id);assert.match(await p.locator('main').innerText(),/Van repair part/)
   assert.deepEqual(await h.state(),beforeRead,'Source drill-through changes no approval, payment or balance');assert.equal(h.messages.length,mailBeforeRead)

  }
  const replacement=await makeInvoice(3)
  for(const [invoice,jurisdiction]of [[i1,'Native source jurisdiction'],[replacement,'Native replacement jurisdiction']])await h.command('tax.assignJurisdiction',{invoiceId:invoice.id,version:invoice.version,jurisdiction,evidence:'Owner reviewed the invoice jurisdiction for credit attribution'})
  for(const width of [1440,390]){
   const request={invoiceId:i1.id,version:i1.version,lines:[{lineId:i1.lines[0].id,sourceEstimateId:i1.lines[0].sourceEstimateId,sourceRevision:i1.lines[0].sourceRevision,quantity:0.1}],destination:'account-credit',reference:'synthetic-mallet-native-tax-credit-'+width,reason:'Return part of the original repair part',consentEvidence:'Customer explicitly requested same-account credit'}
   const review=await h.command('credit.preview',request),note=await h.command('credit.issue',{...request,review,confirm:'issue-credit'})
   await h.command('credit.apply',{creditNoteId:note.id,invoiceId:replacement.id,version:replacement.version,amountCents:1100,reference:'synthetic-mallet-native-tax-apply-'+width,reason:'Customer instructed replacement repair credit allocation',confirm:'apply-credit'})
   await p.setViewportSize({width,height:1000})
   await p.goto(h.origin+'/app/tax/filing?from=2000-01-01&to=2099-01-01');await shot('11-credit-source-review',width)
   const f=p.locator('form:has(input[name="command"][value="tax.creditBasis"]):has(input[name="creditNoteId"][value="'+note.id+'"])')
   await f.locator('[name="basisUsd_'+check.id+'"]').fill('11.00');await f.locator('[name="legalBasis"]').fill('Owner reviewed the synthetic jurisdiction treatment; review original tax and recognize destination tax without new cash');await f.locator('[name="evidence"]').fill('Owner matched the cleared original fleet check to the exact credit')
   const pending=p.waitForResponse(r=>new URL(r.url()).pathname==='/app/actions'&&r.request().method()==='POST');await f.getByRole('button',{name:'Record reviewed original tender'}).click();assert.equal((await pending).status(),303);await p.waitForLoadState('domcontentloaded')
   assert.match(await p.locator('main').innerText(),/credit tax adjustment/);assert.equal(await f.count(),0);await shot('12-attributed-credit-adjustment',width)
  }
  const query='/api/mallet/receivables?'+new URLSearchParams({accountId:account.id,asOf:'2099-01-02'}),expected=await h.api(query),fresh=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}})
  try{
   await restore(fresh,await archive(h));await shopSetup(fresh);assert.deepEqual(await fresh.api(query),expected,'Fresh-owner recovery retains identical custody and frozen invoice projections')
   await context.addCookies(fresh.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:fresh.origin})))
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:1000});await p.goto(fresh.origin+'/app/receivables?'+new URLSearchParams({accountId:account.id,asOf:'2099-01-02'}))
    const evidence=p.locator('#ar-'+i2.id+' [data-recorded-custody]');assert.equal(await evidence.getAttribute('data-recorded-custody'),'recorded');await evidence.getByText('Inspect custody and invoice sources',{exact:true}).click()
    const source=expected.invoices.find(i=>i.invoiceId===i2.id).recordedCustody
    for(const id of [source.intake.id,source.comparison.id,source.handover.id,i2.id])assert.ok((await evidence.innerText()).includes(id))
    await shot('13-recovered-custody-sources',width)
   }
  }finally{await fresh.close()}
  await balanceRecoveryBrowser(browser,directory)
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}

async function balanceRecoveryBrowser(browser,directory){
 const h=await installation({network:true,secureNetwork:true,assets:true,mailService:balanceRecoveryMail()}),context=await browser.newContext({ignoreHTTPSErrors:true}),p=await context.newPage()
 const errors=[];p.on('pageerror',error=>errors.push(error.message))
 const cookies=async source=>context.addCookies(source.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:source.origin})))
 const shot=async name=>{const width=p.viewportSize().width;assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Balance review fits '+width);assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>n.querySelector('svg,img')&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0);await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}
 const resolve=async(id,evidence)=>{const f=p.locator('#balance-review-'+id+' form');await f.getByLabel('Human resolution and evidence reference',{exact:true}).fill(evidence);await f.getByRole('checkbox').check();const pending=p.waitForResponse(r=>new URL(r.url()).pathname==='/app/actions'&&r.request().method()==='POST');await f.getByRole('button',{name:'Record human resolution',exact:true}).click();assert.equal((await pending).status(),303);await p.waitForLoadState('domcontentloaded')}
 try{
  const {account,failed,interrupted,at}=await balanceFailureFixture(h),reviewsPath='/api/mallet/receivables/recovery?accountId='+account.id,ledger='/app/receivables?accountId='+account.id
  const before=await h.state(),messages=h.messages.length,statement=await h.api('/api/mallet/receivables?accountId='+account.id+'&asOf=2099-01-02')
  await cookies(h);await p.setViewportSize({width:1440,height:1000});await p.goto(h.origin+ledger)
  assert.equal(await p.locator('#balance-email-review').count(),0,'Recovery is an on-demand review')
  await p.getByRole('link',{name:'Review failed balance emails',exact:true}).click()
  for(const schedule of [failed,interrupted]){
   const row=p.locator('#balance-review-'+schedule.id)
   assert.match(await row.innerText(),/Needs owner review/);assert.ok((await row.innerText()).includes('Original outcome: '+schedule.status))
   await row.getByText('Inspect exact balance email references',{exact:true}).click()
   const text=await row.innerText();for(const id of [schedule.id,schedule.subjectId,schedule.assignmentId,schedule.termsId])assert.ok(text.includes(id),'Native review cites '+id)
   assert.ok(text.includes('version '+schedule.version));assert.ok(text.includes(schedule.provider));assert.match(text,/Delivery is not verified; no automatic retry/)
  }
  assert.deepEqual(await h.state(),before,'Opening a review changes no business records');assert.equal(h.messages.length,messages)
  for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await shot('14-balance-failure-review')}
  await p.setViewportSize({width:1440,height:1000})
  const evidence='Owner reviewed rejected mail and contacted fleet accounts personally; synthetic-mallet-908; delivery remains unverified'
  await resolve(failed.id,evidence)
  const resolved=p.locator('#balance-review-'+failed.id),remaining=p.locator('#balance-review-'+interrupted.id)
  assert.match(await resolved.innerText(),/Review recorded/);assert.match(await resolved.innerText(),/Original outcome: failed/);assert.ok((await resolved.innerText()).includes(evidence));assert.equal(await resolved.locator('form').count(),0);assert.match(await remaining.innerText(),/Original outcome: uncertain/)
  const reviews=await h.api(reviewsPath),receipt=reviews.find(r=>r.scheduleId===failed.id).resolution
  assert.equal(receipt.by.id,before.actor.id);assert.equal(receipt.evidence,evidence)
  assert.match(await p.locator('#ar-'+failed.subjectId).innerText(),/Human review recorded; original outcome and uncertainty retained/);assert.doesNotMatch(await p.locator('#ar-'+failed.subjectId).innerText(),/Staff review required/)
  assert.deepEqual((await h.state()).records.outreach,before.records.outreach);assert.deepEqual(await h.api('/api/mallet/receivables?accountId='+account.id+'&asOf=2099-01-02'),statement)
  for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await shot('15-balance-resolution-recorded')}
  await h.restart();await h.cron(at('15:15'));assert.equal(h.messages.length,messages)
  const fresh=await installation({network:true,secureNetwork:true,assets:true,mailService:balanceRecoveryMail()})
  try{
   await restore(fresh,await archive(h));await shopSetup(fresh);assert.deepEqual(await fresh.api(reviewsPath),reviews)
   await cookies(fresh);await fresh.stepUp();await p.setViewportSize({width:1440,height:1000});await p.goto(fresh.origin+ledger+'&recovery=balance')
   assert.ok((await p.locator('#balance-review-'+failed.id).innerText()).includes(evidence))
   await resolve(interrupted.id,'Fresh destination owner reviewed the interrupted handoff; synthetic-mallet-909; original delivery remains uncertain')
   const row=p.locator('#balance-review-'+interrupted.id);assert.match(await row.innerText(),/Review recorded/);assert.match(await row.innerText(),/Original outcome: uncertain/)
   const resolution=(await fresh.api(reviewsPath)).find(r=>r.scheduleId===interrupted.id).resolution
   assert.equal(resolution.by.id,(await fresh.state()).actor.id);assert.notEqual(resolution.by.id,receipt.by.id)
   for(const width of [1440,390]){await p.setViewportSize({width,height:1000});await shot('16-recovered-balance-review')}
   await fresh.restart();await fresh.cron(at('15:30'));assert.equal(fresh.messages.length,0,'Resolution after recovery cannot send another email');assert.deepEqual((await fresh.state()).records.outreach,before.records.outreach)
  }finally{await fresh.close()}
  assert.deepEqual(errors,[])
 }finally{await context.close();await h.close()}
}
