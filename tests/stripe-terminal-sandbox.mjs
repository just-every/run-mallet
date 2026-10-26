import {liveStripe} from './support/stripe-live.mjs'
import {randomBytes} from 'node:crypto'
import {localPeople} from './support/local-people.mjs'
// Real Terminal test helper; credentials enter only from the fleet injector.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
import {installation} from './harness.mjs'
import {shopSetup} from './support/diagnosis-journey.mjs'
import {readyInvoice} from './support/return-journey.mjs'
const secret=process.env.STRIPE_SECRET_KEY
if(!secret)throw Error('Injector must supply STRIPE_SECRET_KEY')
const stripe=async(path,fields,method=fields?'POST':'GET')=>{
 const response=await fetch('https://api.stripe.com/v1'+path,{method,headers:{authorization:'Bearer '+secret,...(fields?{'content-type':'application/x-www-form-urlencoded'}:{})},...(fields?{body:new URLSearchParams(fields)}:{})}),value=await response.json()
 if(!response.ok)throw Object.assign(Error('Stripe refused Terminal sandbox operation'),{code:value.error?.code??String(response.status),providerStatus:response.status})
 return value
}
let h,browser,reader,location,paymentIntentId,stage='account'
const result={mode:'test',terminal:'not-run',fee:'not-run',cleanup:[]}
try{
 const account=await stripe('/account'),balance=await stripe('/balance');assert.equal(account.country,'US');assert.equal(account.default_currency,'usd');assert.equal(balance.livemode,false)
 h=await installation({entry:'tests/dev-worker.ts',network:true,assets:true,bindings:{AUTH_LOCAL:'true',RER_DEV_KEY:randomBytes(32).toString('base64url'),STRIPE_SECRET_KEY:secret},outboundService:liveStripe(result)})
 h.person=localPeople(h);await shopSetup(h);const {invoice}=await readyInvoice(h);await h.stepUp()
 const api=async(action,input)=>{const response=await h.request('/api/mallet/stripe/'+action,{method:'POST',body:input}),value=await response.json();if(!response.ok)throw Object.assign(Error('Native Terminal door refused operation'),{code:value.error,providerCode:value.details?.code,providerStatus:value.details?.status});return value}
 await api('connect',{consent:true})
 stage='temporary-location';location=await stripe('/terminal/locations',{display_name:'Mallet sx-mallet-c-i816 sandbox','address[line1]':'510 Townsend St','address[city]':'San Francisco','address[state]':'CA','address[postal_code]':'94103','address[country]':'US'})
 stage='temporary-reader';reader=await stripe('/terminal/readers',{registration_code:'simulated-wpe',location:location.id,label:'Mallet sx-mallet-c-i816 sandbox'})
 stage='native-reader-prepare';const checkout=await api('terminal-prepare',{invoiceId:invoice.id,version:invoice.version,operationId:crypto.randomUUID(),consent:true});paymentIntentId=checkout.paymentIntentId
 stage='native-reader-send';const sent=await api('terminal-send',{checkoutId:checkout.id,readerId:reader.id});assert.equal(sent.status,'in_progress');assert.equal((await api('terminal-send',{checkoutId:checkout.id,readerId:reader.id})).id,sent.id);assert.equal((await h.state()).records.payment?.length??0,0)
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});const context=await browser.newContext();await context.addCookies(h.owner.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})));const page=await context.newPage();await mkdir('.cache/stripe-terminal-sandbox',{recursive:true})
 const shot=async name=>{await page.goto(h.origin+'/app/invoices/'+invoice.id+'/payment');for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.cache/stripe-terminal-sandbox/'+name+'-'+width+'.png',fullPage:true})}}
 await shot('01-reader-waiting')
 stage='present-simulated-card';await stripe('/test_helpers/terminal/readers/'+encodeURIComponent(reader.id)+'/present_payment_method',{})
 let pi,currentReader
 for(let attempt=0;attempt<10;attempt++){pi=await stripe('/payment_intents/'+encodeURIComponent(paymentIntentId)+'?expand%5B%5D=latest_charge.balance_transaction');currentReader=await stripe('/terminal/readers/'+encodeURIComponent(reader.id));if(pi.status==='succeeded'&&currentReader.action?.status==='succeeded')break;await new Promise(r=>setTimeout(r,2000))}
 assert.equal(pi.status,'succeeded');assert.equal(pi.livemode,false);assert.equal(pi.amount_received,invoice.totals.totalCents);assert.equal(pi.latest_charge.payment_method_details.type,'card_present');assert.equal(currentReader.action.process_payment_intent.payment_intent,paymentIntentId)
 await api('terminal-reconcile',{checkoutId:checkout.id});assert.equal((await h.state()).records.payment?.length??0,0)
 stage='native-event';const events=await stripe('/events?type=payment_intent.succeeded&limit=50'),event=events.data.find(e=>e.data.object.id===paymentIntentId);assert.ok(event)
 const observed=await api('event',{eventId:event.id});assert.equal((await api('event',{eventId:event.id})).id,observed.id);assert.equal((await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id).length,1)
 await shot('02-reader-paid');result.terminal='passed';result.paymentIntentId=paymentIntentId;result.eventId=event.id;result.readerId=reader.id;result.deviceType=reader.device_type;result.amountCents=invoice.totals.totalCents
 stage='native-fee'
 for(let attempt=0;attempt<6;attempt++){try{const r=await api('settlement',{checkoutId:checkout.id});result.fee={balanceTransactionId:r.balanceTransactionId,chargeId:r.chargeId,grossCents:r.grossCents,feeCents:r.feeCents,netCents:r.netCents};break}catch(error){if(error.code!=='STRIPE_SETTLEMENT_PENDING')throw error;await new Promise(r=>setTimeout(r,2000))}}
 await shot('03-reader-fee');stage='complete'
}catch(error){result.failure={stage,code:error.code??error.name,providerCode:error.providerCode??null,providerStatus:error.providerStatus??null};process.exitCode=1}
finally{
 if(reader)try{const r=await stripe('/terminal/readers/'+encodeURIComponent(reader.id));if(r.action?.status==='in_progress')await stripe('/terminal/readers/'+encodeURIComponent(reader.id)+'/cancel_action',{});result.cleanup.push('reader action resolved')}catch{result.cleanup.push('reader action requires inspection');process.exitCode=1}
 if(paymentIntentId)try{const pi=await stripe('/payment_intents/'+encodeURIComponent(paymentIntentId));if(pi.status==='succeeded'){const refund=await stripe('/refunds',{payment_intent:paymentIntentId});result.cleanup.push('test payment refund '+refund.status)}else if(pi.status!=='canceled'){await stripe('/payment_intents/'+encodeURIComponent(paymentIntentId)+'/cancel',{});result.cleanup.push('uncaptured intent canceled')}}catch{result.cleanup.push('payment cleanup requires inspection');process.exitCode=1}
 if(reader)try{await stripe('/terminal/readers/'+encodeURIComponent(reader.id),undefined,'DELETE');result.cleanup.push('temporary reader deleted')}catch{result.cleanup.push('temporary reader cleanup requires inspection');process.exitCode=1}
 if(location)try{await stripe('/terminal/locations/'+encodeURIComponent(location.id),undefined,'DELETE');result.cleanup.push('temporary location deleted')}catch{result.cleanup.push('temporary location cleanup requires inspection');process.exitCode=1}
 await browser?.close();await h?.close();console.log(JSON.stringify(result))
}
