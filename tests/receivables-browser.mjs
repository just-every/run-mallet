import {handoverInput} from './support/handover-input.mjs'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {publicDoor} from './support/portable-repair.mjs'
import {receivablesFixture} from './support/receivables-journey.mjs'
export async function receivablesBrowser(){
 const h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url')}});let browser
 try{
  h.person=publicDoor(h.origin,h.owner).person
  const {account,i1,i2,invoice:makeInvoice}=await receivablesFixture(h)
  await h.stepUp()
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext(),p=await context.newPage(),errors=[];p.on('pageerror',error=>errors.push(error.message))
  await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const directory=process.env.MALLET_RECEIVABLES_PROOF_DIR??'.cache/receivables-browser';await mkdir(directory,{recursive:true})
  const shot=async(name,width)=>{assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width);assert.equal(await p.locator('button,a').evaluateAll(nodes=>nodes.filter(n=>(n.querySelector('svg,img'))&&!n.textContent.trim()&&!n.getAttribute('data-tooltip')).length),0,'Every icon control has a tooltip');await p.screenshot({path:join(directory,name+'-'+width+'.png'),fullPage:true})}
  const form=(command,invoiceId)=>p.locator((invoiceId?'#ar-'+invoiceId+' ':'')+`form:has(input[name="command"][value="${command}"])`)
  const submit=async(command,fields,{invoiceId,checks=[],selects={}}={})=>{const f=form(command,invoiceId);for(const [name,value]of Object.entries(fields))await f.locator(`[name="${name}"]`).fill(String(value));for(const name of checks)await f.locator(`[name="${name}"]`).check();for(const [name,value]of Object.entries(selects))await f.locator(`[name="${name}"]`).selectOption(value);const pending=p.waitForResponse(r=>new URL(r.url()).pathname==='/app/actions'&&r.request().method()==='POST');await f.getByRole('button').click();assert.equal((await pending).status(),303);await p.waitForLoadState('domcontentloaded')}
  const ledger=h.origin+'/app/receivables?'+new URLSearchParams({accountId:account.id,asOf:'2099-01-02'})
  const check=await h.command('payment.record',{invoiceId:i1.id,version:i1.version,method:'check',amountCents:5000,reference:'synthetic-mallet-native-bank',evidence:'Fleet check observed, not cleared'})
  for(const [index,width]of [1440,390].entries()){
   await p.setViewportSize({width,height:1000});await p.goto(h.origin+'/app/accounts?manage='+account.id);await shot('01-account-entry',width)
   await p.getByRole('link',{name:'Commercial receivables',exact:true}).click();await p.locator('select[name="accountId"]').selectOption(account.id);await p.getByRole('button',{name:'Review statement',exact:true}).click();await shot('02-before-terms',width)
   await submit('ar.terms',{days:30,limitUsd:300,evidence:'Fleet explicitly agreed to owner-reviewed net terms'},{checks:['consent']})
   const invoice=index===0?i1:i2
   await submit('ar.invoice',{po:'synthetic-mallet-native-po-'+width,evidence:'Allowed fleet manager approved this PO; driver has no approval authority'},{invoiceId:invoice.id})
   await p.goto(ledger);assert.match(await p.locator('main').innerText(),/Current account statement/);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/synthetic-mallet-native-po-/);await shot('03-terms-and-statement',width)
   await submit('ar.remind',{evidence:'Owner reviewed the current balance and billing recipient',consentEvidence:'Billing contact explicitly requested this exact balance reminder by email'},{invoiceId:invoice.id,checks:['consent']})
   await p.goto(ledger);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Suppressed in development/);await shot('03b-consented-balance-reminder',width)
   await submit('ar.dispute' ,{evidence:'Fleet disputed the recorded work pending review'},{invoiceId:invoice.id})
   await p.goto(ledger);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Dispute open/);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Chasing paused/);await shot('04-dispute-pauses-chasing',width)
   await submit('ar.promise',{promisedOn:'2099-01-03',amountUsd:10,evidence:'Fleet promised ten dollars on the selected UTC date'},{invoiceId:invoice.id})
   await p.goto(ledger);assert.match(await p.locator('#ar-'+invoice.id).innerText(),/Promised \$10.00 on 2099-01-03/);await shot('05-payment-promise-and-downtime',width)
   await p.goto(h.origin+'/app/tax/custody');await shot('06-tax-custody-entry',width);await p.getByRole('link',{name:'Review filing-period tax preview'}).click()
   await p.goto(h.origin+'/app/tax/filing?from=2000-01-01&to=2099-01-01');assert.match(await p.locator('main').innerText(),/Filing-period preview/);await shot('07-filing-review',width)
   if(index===0){await submit('tender.clearance',{observedOn:check.at.slice(0,10),reference:'synthetic-mallet-bank-native',evidence:'Owner inspected bank clearance of the recorded fleet check'})}
   await p.goto(h.origin+'/app/tax/filing?from=2000-01-01&to=2099-01-01');assert.match(await p.locator('main').innerText(),/collected tax \$4.55/);assert.equal(await form('tender.clearance').count(),0);await shot('08-observed-clearance-preview',width)
   const input=await handoverInput(h,invoice.jobId,account.name),assignment=(await h.state()).records.arInvoice.find(r=>r.invoiceId===invoice.id)
   await p.goto(h.origin+'/app/jobs/'+invoice.jobId+'/return');await shot('09-open-terms-handover',width)
   await submit('flow.collect',{collectorName:account.name,identityEvidence:input.identityEvidence,warrantyAdvice:input.warrantyAdvice},{selects:{termsAssignmentId:assignment.id,comparisonId:input.comparisonId,readingId:input.readingId}})
   assert.match(await p.locator('#handover-receipt').innerText(),/Released on account terms; balance due/);assert.match(await p.locator('#handover-receipt').innerText(),/No payment is recorded by release/);await shot('10-account-terms-receipt',width)
  }
  const replacement=await makeInvoice(3)
  for(const [invoice,jurisdiction]of [[i1,'Native source jurisdiction'],[replacement,'Native replacement jurisdiction']])await h.command('tax.assignJurisdiction',{invoiceId:invoice.id,version:invoice.version,jurisdiction,evidence:'Owner reviewed the invoice jurisdiction for credit attribution'})
  for(const width of [1440,390]){
   const request={invoiceId:i1.id,version:i1.version,lines:[{lineId:i1.lines[0].id,sourceEstimateId:i1.lines[0].sourceEstimateId,sourceRevision:i1.lines[0].sourceRevision,quantity:0.1}],destination:'account-credit',reference:'synthetic-mallet-native-tax-credit-'+width,reason:'Return part of the original repair part',consentEvidence:'Customer explicitly requested same-account credit'}
   const review=await h.command('credit.preview',request),note=await h.command('credit.issue',{...request,review,confirm:'issue-credit'})
   await h.command('credit.apply',{creditNoteId:note.id,invoiceId:replacement.id,version:replacement.version,amountCents:1100,reference:'synthetic-mallet-native-tax-apply-'+width,reason:'Customer instructed replacement repair credit allocation',confirm:'apply-credit'})
   await p.setViewportSize({width,height:1000});await p.goto(h.origin+'/app/tax/filing?from=2000-01-01&to=2099-01-01');await shot('11-credit-source-review',width)
   const f=p.locator('form:has(input[name="command"][value="tax.creditBasis"]):has(input[name="creditNoteId"][value="'+note.id+'"])')
   await f.locator('[name="basisUsd_'+check.id+'"]').fill('11.00');await f.locator('[name="legalBasis"]').fill('Owner reviewed the synthetic jurisdiction treatment; review original tax and recognize destination tax without new cash');await f.locator('[name="evidence"]').fill('Owner matched the cleared original fleet check to the exact credit')
   const pending=p.waitForResponse(r=>new URL(r.url()).pathname==='/app/actions'&&r.request().method()==='POST');await f.getByRole('button',{name:'Record reviewed original tender'}).click();assert.equal((await pending).status(),303);await p.waitForLoadState('domcontentloaded')
   assert.match(await p.locator('main').innerText(),/credit tax adjustment/);assert.equal(await f.count(),0);await shot('12-attributed-credit-adjustment',width)
  }
  assert.deepEqual(errors,[])
 }finally{await browser?.close();await h.close()}
}
