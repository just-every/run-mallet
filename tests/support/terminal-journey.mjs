import {localPeople,localSignIn} from './local-people.mjs'
import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {readyInvoice} from './return-journey.mjs'

// The only fake is Stripe's network edge; application routes, authority and durable records stay real.
export function terminalEdge(){
 const calls=[],objects=new Map(),intents=new Map();let sequence=950,lostPrepare=false,lostSend=false,lostCancel=false,wrongAccount=false,pi
 const reader={id:'synthetic-mallet-940',object:'terminal.reader',device_type:'simulated_wisepos_e',livemode:false,location:'synthetic-mallet-941',status:'online',label:'synthetic-mallet-942',serial_number:'synthetic-mallet-943',action:null}
 const edge=async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');assert.equal(request.headers.get('authorization'),'Bearer synthetic-mallet-800')
  const fields=request.method==='POST'?new URLSearchParams(await request.text()):null
  calls.push({path:url.pathname,method:request.method,fields:fields?Object.fromEntries(fields):null,key:request.headers.get('idempotency-key')})
  if(url.pathname==='/v1/account')return Response.json({id:wrongAccount?'synthetic-mallet-949':'synthetic-mallet-801',country:'US',default_currency:'usd',charges_enabled:true,payouts_enabled:true})
  if(url.pathname==='/v1/balance')return Response.json({livemode:false})
  if(url.pathname==='/v1/payment_intents'&&fields){
   assert.equal(fields.get('payment_method_types[0]'),'card_present');assert.equal(fields.get('capture_method'),'automatic');assert.equal(fields.get('currency'),'usd')
   const metadata=Object.fromEntries(['mallet_invoice_id','mallet_invoice_revision','mallet_checkout_id'].map(k=>[k,fields.get('metadata['+k+']')]))
   pi={id:'synthetic-mallet-'+(++sequence),object:'payment_intent',amount:Number(fields.get('amount')),amount_received:0,currency:'usd',capture_method:'automatic',payment_method_types:['card_present'],status:'requires_payment_method',livemode:false,metadata,latest_charge:null}
   intents.set(pi.id,pi)
   return lostPrepare?Response.json({error:{code:'synthetic-mallet-944'}},{status:503}):Response.json(pi)
  }
  const intentMatch=url.pathname.match(/^\/v1\/payment_intents\/([^/]+)(\/cancel)?$/)
  if(intentMatch){
   const intent=intents.get(intentMatch[1]);assert.ok(intent,'An existing provider payment is retrieved')
   if(intentMatch[2]){assert.ok(fields);assert.notEqual(intent.status,'succeeded');intent.status='canceled';return lostCancel?Response.json({error:{code:'synthetic-mallet-945'}},{status:503}):Response.json(intent)}
   return Response.json(intent)
  }
  if(url.pathname==='/v1/terminal/readers/'+reader.id)return Response.json(reader)
  if(url.pathname==='/v1/terminal/readers/'+reader.id+'/process_payment_intent'){
   const intent=intents.get(fields.get('payment_intent'));assert.ok(intent);assert.equal(intent.status,'requires_payment_method')
   reader.action={type:'process_payment_intent',status:'in_progress',process_payment_intent:{payment_intent:intent.id},failure_code:null,failure_message:null}
   return lostSend?Response.json({error:{code:'synthetic-mallet-946'}},{status:503}):Response.json(reader)
  }
  if(url.pathname==='/v1/terminal/readers/'+reader.id+'/cancel_action'){
   reader.action=null
   return lostCancel?Response.json({error:{code:'synthetic-mallet-947'}},{status:503}):Response.json(reader)
  }
  if(url.pathname==='/v1/balance_transactions')return Response.json({data:[pi.latest_charge.balance_transaction],has_more:false})
  const value=objects.get(url.pathname.split('/').at(-1))
  return value?Response.json(value):Response.json({error:{code:'synthetic-mallet-948'}},{status:404})
 }
 return {edge,calls,objects,reader,get pi(){return pi},setLostPrepare(value){lostPrepare=value},setLostSend(value){lostSend=value},setLostCancel(value){lostCancel=value},setWrongAccount(value){wrongAccount=value},providerEvent(id,type='payment_intent.succeeded'){
  objects.set(id,{id,object:'event',type,livemode:false,created:Math.floor(Date.now()/1000),data:{object:structuredClone(pi)}});return id
 },paid(){
  pi.status='succeeded';pi.amount_received=pi.amount
  pi.latest_charge={id:'synthetic-mallet-970',object:'charge',payment_intent:pi.id,paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount:pi.amount,payment_method_details:{type:'card_present',card_present:{brand:'visa',last4:'4242'}},balance_transaction:{id:'synthetic-mallet-971',object:'balance_transaction',source:'synthetic-mallet-970',type:'charge',currency:'usd',amount:pi.amount,fee:110,net:pi.amount-110,available_on:Math.floor(Date.now()/1000)+86400}}
  reader.action.status='succeeded'
 }}
}

export async function terminalJourney(h,edge){
 h.person=localPeople(h)
 await shopSetup(h)
 const api=(action,input,options)=>h.api('/api/mallet/stripe/'+action,input,options),{invoice}=await readyInvoice(h)
 const admin=await h.person('synthetic-mallet-980@example.test','admin'),member=await h.person('synthetic-mallet-981@example.test'),key=await h.command('agent.create',{label:'Reader authority refused'})
 const input={invoiceId:invoice.id,version:invoice.version,operationId:'synthetic-mallet-982',amountCents:1,consent:true}
 const denied=[{as:'',status:401},{as:admin.cookie,status:403},{as:member.cookie,status:403},{as:'',headers:{authorization:'Bearer '+key.token},status:403},{headers:{origin:'https://synthetic-mallet-983.test'},status:403}]
 for(const action of ['terminal-prepare','terminal-send','terminal-reconcile','terminal-cancel'])for(const options of denied)await api(action,input,options)
 // A native owner session without a fresh factor is refused before provider access.
 const fresh=await localSignIn(h,'owner');assert.equal(fresh.id,(await h.state()).actor.id)
 assert.equal((await api('terminal-prepare',input,{as:fresh.cookie,status:403})).error,'step_up_required')
 assert.equal(edge.calls.length,0,'Refused transports never reach Stripe')
 await h.command('stripe.terminalClaim',input,{status:404});await h.command('stripe.terminalOutcome',input,{status:404})
 await api('connect',{consent:true})
 await api('terminal-prepare',{...input,consent:false},{status:400})
 await api('terminal-prepare',{...input,version:invoice.version-1},{status:409})
 const checkout=await api('terminal-prepare',input)
 assert.equal(checkout.method,'card_present');assert.equal(checkout.status,'open');assert.equal(checkout.amountCents,invoice.totals.totalCents)
 assert.equal(edge.pi.amount,invoice.totals.totalCents,'The server ignores a browser-supplied amount')
 assert.equal((await api('terminal-prepare',input)).id,checkout.id)
 assert.equal(edge.calls.filter(c=>c.path==='/v1/payment_intents'&&c.method==='POST').length,1)
 const send={checkoutId:checkout.id,readerId:edge.reader.id}
 const device=edge.reader.device_type;edge.reader.device_type='stripe_m2';await api('terminal-send',send,{status:409});edge.reader.device_type=device
 edge.reader.livemode=true;await api('terminal-send',send,{status:409});edge.reader.livemode=false
 edge.setWrongAccount(true);await api('terminal-send',send,{status:409});edge.setWrongAccount(false)
 const race=await Promise.all([1,2].map(()=>h.request('/api/mallet/stripe/terminal-send',{method:'POST',body:send})))
 assert.ok(race.some(r=>r.status===200));assert.ok(race.every(r=>[200,409].includes(r.status)))
 const action=await api('terminal-send',send);assert.equal(action.status,'in_progress')
 assert.equal(edge.calls.filter(c=>c.path.endsWith('/process_payment_intent')&&c.method==='POST').length,1,'Replay and concurrent calls initiate the reader once')
 await api('terminal-prepare',{...input,operationId:'synthetic-mallet-984'},{status:409})
 await h.command('payment.record',{invoiceId:invoice.id,version:invoice.version,method:'cash',amountCents:1,reference:'synthetic-mallet-985',evidence:'Owner attempted alternate tender while the reader is active'},{status:409})
 assert.equal((await h.state()).records.payment?.length??0,0,'Reader acknowledgment allocates no funds')
 await h.restart();const postCount=edge.calls.filter(c=>c.method==='POST').length
 await api('terminal-reconcile',{checkoutId:checkout.id})
 assert.equal(edge.calls.filter(c=>c.method==='POST').length,postCount,'Reader reconciliation only retrieves existing provider objects')
 edge.paid();await api('terminal-reconcile',{checkoutId:checkout.id})
 assert.equal((await h.state()).records.payment?.length??0,0,'Even a succeeded reader and PaymentIntent need the authenticated event door')
 const eventId=edge.providerEvent('synthetic-mallet-986'),observed=await api('event',{eventId})
 assert.equal(observed.status,'succeeded');assert.ok(observed.paymentId)
 assert.equal((await api('event',{eventId})).id,observed.id)
 await api('event',{eventId:edge.providerEvent('synthetic-mallet-987','payment_intent.processing')})
 assert.equal((await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id).length,1)
 await api('terminal-cancel',{checkoutId:checkout.id},{status:409})
 const settlement=await api('settlement',{checkoutId:checkout.id});assert.equal(settlement.grossCents,invoice.totals.totalCents);assert.equal(settlement.feeCents,110);assert.equal(settlement.netCents,invoice.totals.totalCents-110)
 const hidden=(await h.state({as:admin.cookie})).records;assert.equal(hidden.stripeReaderAction,undefined);assert.ok(!hidden.event.some(e=>e.kind.startsWith('stripe.terminal')))
 assert.deepEqual((await h.state()).records.invoice.find(r=>r.id===invoice.id),invoice)
 const backup=await archive(h),restored=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-988@example.test',AUTH_LOCAL:'true',STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
 try{
  await restore(restored,backup);assert.deepEqual((await restored.state()).records.stripeReaderAction,(await h.state()).records.stripeReaderAction)
  const before=edge.calls.length;await restored.api('/api/mallet/stripe/terminal-reconcile',{checkoutId:checkout.id},{status:409});assert.equal(edge.calls.length,before,'Restored history stays inert until the new owner reconnects')
 }finally{await restored.close()}
 return {invoice,checkout,action,settlement}
}

export async function terminalStoppedJourney(h,edge){
 h.person=localPeople(h)
 await shopSetup(h)
 const api=(action,input,options)=>h.api('/api/mallet/stripe/'+action,input,options),{invoice}=await readyInvoice(h)
 await api('connect',{consent:true})
 const input={invoiceId:invoice.id,version:invoice.version,operationId:'synthetic-mallet-990',consent:true}
 edge.setLostPrepare(true);await api('terminal-prepare',input,{status:502});edge.setLostPrepare(false)
 await h.restart();let posts=edge.calls.filter(c=>c.method==='POST').length
 const uncertain=await api('terminal-prepare',input);assert.equal(uncertain.status,'uncertain');assert.equal(edge.calls.filter(c=>c.method==='POST').length,posts)
 const prepared=await api('terminal-reconcile',{checkoutId:uncertain.id,paymentIntentId:edge.pi.id});assert.equal(prepared.status,'open');assert.equal(edge.calls.filter(c=>c.method==='POST').length,posts)
 edge.setLostSend(true);const send={checkoutId:prepared.id,readerId:edge.reader.id};await api('terminal-send',send,{status:502});edge.setLostSend(false)
 await h.restart();posts=edge.calls.filter(c=>c.method==='POST').length
 assert.equal((await api('terminal-send',send)).status,'uncertain');assert.equal(edge.calls.filter(c=>c.method==='POST').length,posts)
 await api('terminal-reconcile',{checkoutId:prepared.id});assert.equal(edge.calls.filter(c=>c.method==='POST').length,posts)
 edge.setLostCancel(true);await api('terminal-cancel',send,{status:502});edge.setLostCancel(false)
 await api('terminal-reconcile',{checkoutId:prepared.id})
 const canceled=await api('terminal-cancel',send);assert.equal(canceled.status,'expired')
 posts=edge.calls.filter(c=>c.method==='POST').length;await api('terminal-cancel',send);assert.equal(edge.calls.filter(c=>c.method==='POST').length,posts)
 assert.equal(edge.calls.filter(c=>c.path.endsWith('/cancel_action')).length,1);assert.equal(edge.calls.filter(c=>c.path.endsWith('/cancel')).length,1)
 assert.equal((await h.state()).records.payment?.length??0,0,'Uncertain and canceled collection allocate no funds')
 return {invoice,checkout:canceled}
}
