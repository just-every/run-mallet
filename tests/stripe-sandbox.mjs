import {liveStripe,archiveCheckoutCatalog} from './support/stripe-live.mjs'
import {randomBytes} from 'node:crypto'
import {localPeople} from './support/local-people.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
// Held-key proof. Run only through the fleet injector and heavy-slot; never in push Verify.
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {readyInvoice} from './support/return-journey.mjs'
const secret=process.env.STRIPE_SECRET_KEY
if(!secret)throw Error('Injector must supply STRIPE_SECRET_KEY')
const stripe=async(path,fields)=>{
 const response=await fetch('https://api.stripe.com/v1'+path,{method:fields?'POST':'GET',headers:{authorization:'Bearer '+secret,...(fields?{'content-type':'application/x-www-form-urlencoded'}:{})},...(fields?{body:new URLSearchParams(fields)}:{})})
 const value=await response.json()
 if(!response.ok)throw Object.assign(Error('Stripe refused sandbox request'),{code:value.error?.code??String(response.status),providerStatus:response.status})
 return value
}
let h,browser,cardSession,paymentIntentId,stage='start'
const result={mode:'test',currency:'usd',card:'not-run',fee:'not-run',payout:'not-run',cleanup:[]}
try{
 stage='account';const account=await stripe('/account'),balance=await stripe('/balance');assert.equal(account.default_currency,'usd');assert.equal(balance.livemode,false)
 result.account={country:account.country,currency:account.default_currency,chargesEnabled:account.charges_enabled,payoutsEnabled:account.payouts_enabled}
 h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:secret},outboundService:liveStripe(result)})
 const api=async(action,input)=>{
  const response=await h.request('/api/mallet/stripe/'+action,{method:'POST',body:input}),value=await response.json()
  if(!response.ok)throw Object.assign(Error('Native Stripe door refused the operation'),{code:value.error,nativeMessage:value.message,providerStatus:value.details?.status,providerCode:value.details?.code})
  return value
 }
 h.person=localPeople(h);await shopSetup(h)
 const {invoice}=await readyInvoice(h);await h.stepUp();await api('connect',{consent:true})
 stage='card-checkout';cardSession=await api('checkout',{invoiceId:invoice.id,version:invoice.version,method:'card',operationId:crypto.randomUUID(),consent:true})
 result.checkoutId=cardSession.sessionId
 const open=await h.request('/app/stripe/checkout/'+cardSession.id);assert.equal(open.status,303)
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
 stage='hosted-card-entry';await page.goto(open.headers.get('location'));await page.waitForLoadState('domcontentloaded')
 await page.locator('input[type="email"]').fill('synthetic-mallet-816@example.test')
 await page.locator('input[name="cardNumber"]').fill('4242424242424242')
 await page.locator('input[name="cardExpiry"]').fill('12'+String((new Date().getUTCFullYear()+2)%100).padStart(2,'0'))
 await page.locator('input[name="cardCvc"]').fill('123')
 await page.locator('input[name="billingName"]').fill('Synthetic Mallet Owner')
 const country=page.locator('select[name="billingCountry"]');if(await country.count())await country.selectOption('US')
 const zip=page.locator('input[name="billingPostalCode"]');if(await zip.count())await zip.fill('10001')
 stage='hosted-card-submit';await page.getByTestId('hosted-payment-submit-button').click()
 await page.waitForURL(url=>url.origin===new URL(h.origin).origin,{timeout:60000})
 stage='provider-event';const session=await stripe('/checkout/sessions/'+encodeURIComponent(cardSession.sessionId));assert.equal(session.payment_status,'paid');assert.equal(session.livemode,false);paymentIntentId=session.payment_intent
 let event
 for(let attempt=0;attempt<6&&!event;attempt++){
  const events=await stripe('/events?type=payment_intent.succeeded&limit=50');event=events.data.find(e=>e.data.object.id===paymentIntentId)
  if(!event)await new Promise(r=>setTimeout(r,2000))
 }
 assert.ok(event,'Stripe succeeded event must be available')
 const observed=await api('event',{eventId:event.id});assert.equal(observed.status,'succeeded');assert.equal((await api('event',{eventId:event.id})).id,observed.id)
 const completedEvents=await stripe('/events?type=checkout.session.completed&limit=50'),completed=completedEvents.data.find(e=>e.data.object.id===cardSession.sessionId);assert.ok(completed);await api('event',{eventId:completed.id});await api('event',{eventId:event.id});result.completedEventId=completed.id
 const payment=(await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id);assert.equal(payment.length,1);assert.equal(payment[0].amountCents,invoice.totals.totalCents)
 result.card='passed';result.paymentIntentId=paymentIntentId;result.eventId=event.id;result.amountCents=payment[0].amountCents
 stage='settlement';let settlement
 for(let attempt=0;attempt<6&&!settlement;attempt++){
  try{settlement=await api('settlement',{checkoutId:cardSession.id})}catch(error){if(error.code!=='STRIPE_SETTLEMENT_PENDING')throw error;await new Promise(r=>setTimeout(r,2000))}
 }
 assert.ok(settlement,'Stripe must supply the charge balance transaction');assert.equal(settlement.grossCents-settlement.feeCents,settlement.netCents);result.fee={balanceTransactionId:settlement.balanceTransactionId,chargeId:settlement.chargeId,grossCents:settlement.grossCents,feeCents:settlement.feeCents,netCents:settlement.netCents};result.payout='not-proved: account automatic payout receipt unavailable'
 stage='complete'
}catch(error){result.failure={stage,code:error.code??error.name??'sandbox-failed',nativeMessage:error.nativeMessage??null,providerStatus:error.providerStatus??null,providerCode:error.providerCode??null};process.exitCode=1}
finally{
 const intents=new Set([paymentIntentId,...(result.createdPaymentIntentIds??[])].filter(Boolean))
 for(const sessionId of new Set([cardSession?.sessionId,...(result.createdSessionIds??[])].filter(Boolean))){
  try{
   const session=await stripe('/checkout/sessions/'+encodeURIComponent(sessionId))
   if(session.status==='open'){await stripe('/checkout/sessions/'+encodeURIComponent(sessionId)+'/expire',{});result.cleanup.push('open session expired')}
   if(session.payment_intent)intents.add(session.payment_intent)
   await archiveCheckoutCatalog(stripe,sessionId,result)
  }catch{result.cleanup.push('session cleanup requires inspection');process.exitCode=1}
 }
 for(const paymentIntentId of intents){
  try{const pi=await stripe('/payment_intents/'+encodeURIComponent(paymentIntentId));if(pi.status==='succeeded'){const refund=await stripe('/refunds',{payment_intent:paymentIntentId});result.cleanup.push('test payment refund '+refund.status)}else if(!['canceled','succeeded'].includes(pi.status)){result.cleanup.push('unpaid Checkout intent remains in provider history')}}catch{result.cleanup.push('refund cleanup requires inspection');process.exitCode=1}
 }
 await browser?.close();await h?.close()
 console.log(JSON.stringify(result))
}
