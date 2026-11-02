// A separate held-key ACH probe so card refusal cannot hide bank-method eligibility.
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {localPeople} from './support/local-people.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {readyInvoice} from './support/return-journey.mjs'
import {liveStripe,archiveCheckoutCatalog} from './support/stripe-live.mjs'
const secret=process.env.STRIPE_SECRET_KEY
if(!secret)throw Error('Injector must supply the test key')
const result={mode:'test',ach:'not-run',collectionAndReturn:'not-proved',cleanup:[]}
let h,browser,stage='start'
const stripe=async(path,fields)=>{
 const response=await fetch('https://api.stripe.com/v1'+path,{method:fields?'POST':'GET',headers:{authorization:'Bearer '+secret,...(fields?{'content-type':'application/x-www-form-urlencoded'}:{})},...(fields?{body:new URLSearchParams(fields)}:{})})
 if(!response.ok)throw Error('Stripe cleanup refused');return response.json()
}
try{
 h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:secret},outboundService:liveStripe(result)})
 h.person=localPeople(h);await shopSetup(h);const {invoice}=await readyInvoice(h);await h.stepUp()
 const api=async(action,input)=>{const response=await h.request('/api/mallet/stripe/'+action,{method:'POST',body:input});return {response,value:await response.json()}}
 stage='connect';const connected=await api('connect',{consent:true});assert.equal(connected.response.status,200);assert.equal(connected.value.livemode,false);assert.equal(connected.value.currency,'usd')
 stage='ach-checkout';const {response,value}=await api('checkout',{invoiceId:invoice.id,version:invoice.version,method:'us_bank_account',operationId:crypto.randomUUID(),consent:true})
 if(response.status===502&&value.error==='STRIPE_PROVIDER'&&value.details?.status===400){result.ach='account-refused-hosted-ACH';result.providerCode=value.details.code??null}
 else{
  assert.equal(response.status,200);result.ach='hosted-session-created';result.sessionId=value.sessionId
  const open=await h.request('/app/stripe/checkout/'+value.id);assert.equal(open.status,303)
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext(),page=await context.newPage();await page.goto(open.headers.get('location'));await page.waitForLoadState('domcontentloaded')
  await mkdir('.cache/stripe-ach-sandbox',{recursive:true});for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:'.cache/stripe-ach-sandbox/entry-'+width+'.png',fullPage:true})}
  result.controls={inputs:await page.locator('input').evaluateAll(nodes=>nodes.map(n=>({name:n.name,type:n.type}))),buttons:(await page.getByRole('button').allTextContents()).slice(0,20)}
 }
}catch(error){result.failure={stage,code:error.code??error.name};process.exitCode=1}
finally{
 for(const id of new Set(result.createdSessionIds??[]))try{const session=await stripe('/checkout/sessions/'+encodeURIComponent(id));if(session.status==='open'){await stripe('/checkout/sessions/'+encodeURIComponent(id)+'/expire',{});result.cleanup.push('open ACH session expired')}await archiveCheckoutCatalog(stripe,id,result)}catch{result.cleanup.push('ACH session cleanup requires inspection');process.exitCode=1}
 await browser?.close();await h?.close();console.log(JSON.stringify(result))
}
