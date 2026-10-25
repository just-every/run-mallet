import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'
import {readyInvoice} from './return-journey.mjs'
export function collectionEdge(){
 const calls=[],objects=new Map();let session,pi,unavailable=false,wrongAccount=false,lostResponse=false,sequence=0
 const account={id:'synthetic-mallet-801',country:'US',default_currency:'usd',charges_enabled:true,payouts_enabled:true}
 const edge=async request=>{
  const url=new URL(request.url);assert.equal(url.hostname,'api.stripe.com');assert.equal(request.headers.get('authorization'),'Bearer synthetic-mallet-800');calls.push({path:url.pathname,method:request.method})
  if(url.pathname==='/v1/account')return Response.json(wrongAccount?{...account,id:'synthetic-mallet-899'}:account)
  if(url.pathname==='/v1/balance')return Response.json({livemode:false})
  if(unavailable)return Response.json({error:{code:'synthetic-mallet-898'}},{status:503})
  if(url.pathname==='/v1/checkout/sessions'&&request.method==='POST'){
   const p=new URLSearchParams(await request.text()),metadata=Object.fromEntries(['mallet_invoice_id','mallet_invoice_revision','mallet_checkout_id'].map(k=>[k,p.get('metadata['+k+']')]))
   assert.equal(p.get('mode'),'payment');assert.equal(p.get('payment_intent_data[metadata][mallet_invoice_id]'),metadata.mallet_invoice_id)
   sequence++;session={id:'synthetic-mallet-'+(802+sequence*10),status:'open',url:'https://checkout.stripe.com/synthetic-mallet-802',livemode:false,client_reference_id:p.get('client_reference_id'),metadata,amount_total:Number(p.get('line_items[0][price_data][unit_amount]')),currency:'usd',expires_at:Math.floor(Date.now()/1000)+1800,payment_intent:'synthetic-mallet-'+(803+sequence*10)}
   pi={id:session.payment_intent,status:'processing',metadata,amount:session.amount_total,amount_received:0,currency:'usd',livemode:false,latest_charge:null}
   return lostResponse?Response.json({error:{code:'synthetic-mallet-896'}},{status:503}):Response.json(session)
  }
  if(url.pathname==='/v1/checkout/sessions/'+session?.id)return Response.json(session)
  if(url.pathname==='/v1/checkout/sessions/'+session?.id+'/expire'){session.status='expired';return Response.json(session)}
  if(url.pathname==='/v1/payment_intents/'+pi?.id)return Response.json(pi)
  if(url.pathname==='/v1/balance_transactions')return Response.json({data:[pi.latest_charge.balance_transaction],has_more:false})
  return Response.json(objects.get(url.pathname.split('/').at(-1))??{error:{code:'synthetic-mallet-897'}})
 }
 const providerEvent=(id,type='payment_intent.succeeded')=>{objects.set(id,{id,type,livemode:false,data:{object:structuredClone(pi)}});return id}
 return {edge,calls,objects,get session(){return session},get pi(){return pi},setLostResponse(v){lostResponse=v},setUnavailable(v){unavailable=v},setWrongAccount(v){wrongAccount=v},providerEvent,paid(){
  pi.status='succeeded';pi.amount_received=pi.amount;session.status='complete';session.payment_status='paid'
  pi.latest_charge={id:'synthetic-mallet-804',paid:true,captured:true,disputed:false,refunded:false,amount_refunded:0,currency:'usd',amount:pi.amount,balance_transaction:{id:'synthetic-mallet-805',source:'synthetic-mallet-804',type:'charge',currency:'usd',amount:pi.amount,fee:110,net:pi.amount-110,available_on:Math.floor(Date.now()/1000)+86400}}
 }}
}
export async function stripeJourney(h,edge){
 const api=(action,input,options)=>h.api('/api/mallet/stripe/'+action,input,options)
 const {invoice}=await readyInvoice(h),admin=await h.person('synthetic-mallet-806@example.test','admin')
 for(const options of [{as:'',status:401},{as:admin.cookie,status:403},{headers:{origin:'https://other.test'},status:403}])await api('connect',{consent:true},options)
 assert.equal(edge.calls.length,0,'Denied doors never call Stripe')
 await h.command('stripe.connect',{accountId:'synthetic-mallet-807'},{status:404})
 const connection=await api('connect',{consent:true});assert.equal(connection.accountId,'synthetic-mallet-801');assert.equal(connection.livemode,false)
 const input={invoiceId:invoice.id,version:invoice.version,method:'card',operationId:'synthetic-mallet-808',consent:true}
 await api('checkout',{...input,consent:false},{status:400})
 await api('checkout',{...input,version:invoice.version-1},{status:409})
 const checkout=await api('checkout',input);assert.equal(checkout.status,'open');assert.equal(checkout.amountCents,invoice.totals.totalCents)
 assert.equal((await api('checkout',input)).id,checkout.id)
 assert.equal(edge.calls.filter(r=>r.method==='POST').length,1,'The operation is sent to Stripe once')
 await api('checkout',{...input,operationId:'synthetic-mallet-809'},{status:409})
 let response=await h.request('/app/stripe/checkout/'+checkout.id);assert.equal(response.status,303);assert.equal(response.headers.get('location'),edge.session.url)
 edge.setWrongAccount(true);await h.api('/api/mallet/stripe/checkout',input,{status:409});edge.setWrongAccount(false)
 const pendingId=edge.providerEvent('synthetic-mallet-810','payment_intent.processing')
 const pending=await api('event',{eventId:pendingId});assert.equal(pending.status,'processing');assert.equal((await h.state()).records.payment?.length??0,0)
 edge.paid();const eventId=edge.providerEvent('synthetic-mallet-811'),confirmed=await api('event',{eventId})
 assert.equal(confirmed.status,'succeeded');assert.ok(confirmed.paymentId)
 assert.equal((await api('event',{eventId})).id,confirmed.id)
 const outOfOrder=edge.providerEvent('synthetic-mallet-812','payment_intent.processing');await api('event',{eventId:outOfOrder})
 assert.equal((await h.state()).records.payment.filter(p=>p.invoiceId===invoice.id).length,1,'Duplicate and old events retain one allocation from the current processor state')
 const payoutId='synthetic-mallet-813';edge.objects.set(payoutId,{id:payoutId,currency:'usd',livemode:false,automatic:true,status:'paid',amount:edge.pi.latest_charge.balance_transaction.net,arrival_date:Math.floor(Date.now()/1000)})
 const settled=await api('settlement',{checkoutId:checkout.id,payoutId});assert.equal(settled.grossCents,invoice.totals.totalCents);assert.equal(settled.feeCents,110);assert.equal(settled.netCents,invoice.totals.totalCents-110);assert.equal(settled.payoutId,payoutId)
 assert.equal((await api('settlement',{checkoutId:checkout.id,payoutId})).id,settled.id)
 const hidden=(await h.state({as:admin.cookie})).records;assert.equal(hidden.stripeCheckout,undefined);assert.ok(!hidden.event.some(e=>e.kind.startsWith('stripe.')))
 assert.deepEqual((await h.state()).records.invoice.find(i=>i.id===invoice.id),invoice,'Issued invoice remains immutable')
 const backup=await archive(h);assert.ok(!JSON.stringify(backup).includes('synthetic-mallet-800'));assert.ok(!JSON.stringify(backup).includes('https://checkout.stripe.com'))
 const fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-814@example.test',AUTH_LOCAL:'true',STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
 try{
  await restore(fresh,backup)
  const restored=await fresh.state();for(const kind of ['stripeConnection','stripeCheckout','stripeEvent','stripeSettlement','payment'])assert.deepEqual(restored.records[kind],(await h.state()).records[kind])
  const calls=edge.calls.length;await fresh.api('/api/mallet/stripe/event',{eventId},{status:409});assert.equal(edge.calls.length,calls,'Recovery needs a new owner connection before provider access')
  await fresh.api('/api/mallet/stripe/connect',{consent:true})
  assert.equal((await fresh.api('/api/mallet/stripe/event',{eventId})).id,confirmed.id,'The fresh owner can explicitly reconnect the same merchant and reconcile existing history without a new payment')
 }finally{await fresh.close()}
 return {invoice,checkout,settled}
}

export async function stripeStoppedJourney(h,edge){
 const api=(action,input,options)=>h.api('/api/mallet/stripe/'+action,input,options),{invoice}=await readyInvoice(h)
 await api('connect',{consent:true})
 const input={invoiceId:invoice.id,version:invoice.version,method:'card',operationId:'synthetic-mallet-830',consent:true}
 const open=await api('checkout',input),expired=await api('expire',{checkoutId:open.id});assert.equal(expired.status,'expired')
 assert.equal((await api('expire',{checkoutId:open.id})).id,expired.id)
 assert.equal(edge.calls.filter(c=>c.method==='POST'&&c.path.endsWith('/expire')).length,1,'Expiration is not repeated after Stripe confirms it')
 edge.setLostResponse(true)
 await api('checkout',{...input,operationId:'synthetic-mallet-831'},{status:502})
 const before=edge.calls.filter(c=>c.method==='POST').length,uncertain=await api('checkout',{...input,operationId:'synthetic-mallet-831'})
 assert.equal(uncertain.status,'uncertain');assert.equal(edge.calls.filter(c=>c.method==='POST').length,before,'An uncertain checkout creation is not retried')
 await api('checkout',{...input,operationId:'synthetic-mallet-832'},{status:409})
 assert.equal((await h.state()).records.payment?.length??0,0,'Open, expired and uncertain sessions allocate no money')
 const html=await (await h.request('/app/invoices/'+invoice.id+'/payment')).text();assert.match(html,/handoff is uncertain/)
 edge.setLostResponse(false)
 const recovered=await api('session',{checkoutId:uncertain.id,sessionId:edge.session.id});assert.equal(recovered.status,'open');assert.equal(edge.calls.filter(c=>c.method==='POST').length,before,'Inspecting a lost response only reads the existing provider session')
 await api('expire',{checkoutId:uncertain.id});assert.equal((await h.state()).records.payment?.length??0,0)
}
