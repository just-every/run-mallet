import assert from 'node:assert/strict'
import {archive,installation,restore} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {readyInvoice} from './return-journey.mjs'
import {collectionEdge} from './stripe-journey.mjs'
import {localPeople} from './local-people.mjs'

/** Synthetic Stripe network boundary; all application state uses native doors. */
export function stripeReturnsEdge(){
 const edge=collectionEdge(1000),original=edge.edge,paid=edge.paid
 let dispute
 edge.edge=async request=>{
  const url=new URL(request.url)
  if(url.pathname.startsWith('/v1/disputes/')||url.pathname.startsWith('/v1/charges/')||url.pathname.startsWith('/v1/balance_transactions/'))assert.equal(request.method,'GET')
  return original(request)
 }
 edge.paid=()=>{
  paid();edge.pi.payment_method_types=['us_bank_account']
  Object.assign(edge.pi.latest_charge,{payment_intent:edge.pi.id,livemode:false,payment_method_details:{type:'us_bank_account'}})
  edge.objects.set(edge.pi.latest_charge.id,edge.pi.latest_charge)
 }
 edge.beginReturn=amount=>{
  edge.pi.latest_charge.disputed=true
  dispute={id:'synthetic-mallet-950',object:'dispute',charge:edge.pi.latest_charge.id,payment_intent:edge.pi.id,amount,currency:'usd',livemode:false,status:'lost',reason:'bank_cannot_process',balance_transactions:[]}
  edge.objects.set(dispute.id,dispute);return dispute
 }
 edge.disputeEvent=(id,type='charge.dispute.created')=>{
  edge.objects.set(id,{id,type,livemode:false,created:1,data:{object:structuredClone(dispute)}});return id
 }
 edge.withdraw=amount=>{
  const bt={id:'synthetic-mallet-951',source:dispute.id,type:'adjustment',currency:'usd',amount:-amount,fee:1500,net:-amount-1500,created:2,available_on:3}
  dispute.balance_transactions=[bt];edge.objects.set(bt.id,bt);return bt
 }
 edge.reinstate=amount=>{
  dispute.status='won'
  const bt={id:'synthetic-mallet-952',source:dispute.id,type:'adjustment',currency:'usd',amount,fee:0,net:amount,created:4,available_on:5}
  dispute.balance_transactions.push(bt);edge.objects.set(bt.id,bt);return bt
 }
 Object.defineProperty(edge,'dispute',{get:()=>dispute})
 return edge
}

export async function stripeReturnsJourney(h,edge){
 assert.ok(edge,'Use stripeReturnsEdge as the installation outboundService.')
 h.person=localPeople(h)
 await shopSetup(h)
 const contact=await h.command('contact.save',{name:'ACH payer',email:'synthetic-mallet-953@example.test',phone:'',communication:'none'})
 const account=await h.command('customer.save',{name:'ACH payer',kind:'person',contactIds:[contact.id],payerId:contact.id,billingContactId:contact.id,taxStatus:'unknown'})
 let asset=await h.command('asset.create',{customerName:'ACH payer',label:'ACH repair vehicle',identifier:'synthetic-mallet-954'})
 asset=await h.command('customer.linkAsset',{assetId:asset.id,version:asset.version,customerId:account.id,customerVersion:account.version,reason:'Owner confirmed the invoice payer'})
 const {invoice}=await readyInvoice(h,{asset}),api=(action,input,options)=>h.api('/api/mallet/stripe/'+action,input,options)
 const invoiceBalance=async(target=h)=>{
  const statement=await target.api('/api/mallet/receivables?accountId='+encodeURIComponent(account.id))
  return statement.invoices.find(i=>i.invoiceId===invoice.id).balance
 }
 const admin=await h.person('synthetic-mallet-955@example.test','admin'),agent=await h.command('agent.create',{label:'No ACH return authority'})
 for(const options of [{as:'',status:401},{as:admin.cookie,status:403},{headers:{origin:'https://other.test'},status:403},{as:'',headers:{authorization:'Bearer '+agent.token},status:403}])await api('return',{eventId:'synthetic-mallet-956'},options)
 await h.command('stripe.returnObserve',{eventId:'synthetic-mallet-956',returnedCents:1},{status:404})
 assert.equal(edge.calls.length,0,'Denied native and forged internal doors never reach Stripe')
 await api('connect',{consent:true})
 const checkout=await api('checkout',{invoiceId:invoice.id,version:invoice.version,method:'us_bank_account',operationId:'synthetic-mallet-957',consent:true})
 edge.paid()
 edge.beginReturn(edge.pi.amount)
 await api('return',{eventId:edge.disputeEvent('synthetic-mallet-965')},{status:409})
 assert.equal((await h.state()).records.payment?.length??0,0,'A dispute cannot fabricate the original payment allocation')
 edge.pi.latest_charge.disputed=false
 const successId=edge.providerEvent('synthetic-mallet-958'),confirmed=await api('event',{eventId:successId})
 const allocated=(await h.state()).records.payment.find(p=>p.id===confirmed.paymentId)
 assert.equal(allocated.amountCents,invoice.totals.totalCents)
 assert.equal((await invoiceBalance()).outstandingCents,0)
 const principal=Math.floor(allocated.amountCents/2),dispute=edge.beginReturn(principal)
 const created=edge.disputeEvent('synthetic-mallet-959')
 const withoutMovement=await api('return',{eventId:created})
 assert.equal(withoutMovement.returnedCents,0,'A lost dispute status alone does not prove returned principal')
 assert.equal((await invoiceBalance()).outstandingCents,0)
 const withdrawal=edge.withdraw(principal),withdrawnId=edge.disputeEvent('synthetic-mallet-960','charge.dispute.funds_withdrawn')
 // Reject malformed current evidence before retaining any funds movement.
 const malformed=structuredClone(withdrawal);withdrawal.net++
 await api('return',{eventId:withdrawnId},{status:409});Object.assign(withdrawal,malformed)
 dispute.balance_transactions.push(structuredClone(withdrawal))
 await api('return',{eventId:withdrawnId},{status:409});dispute.balance_transactions.pop()
 edge.pi.latest_charge.payment_method_details.type='card'
 await api('return',{eventId:withdrawnId},{status:409});edge.pi.latest_charge.payment_method_details.type='us_bank_account'
 dispute.livemode=true;await api('return',{eventId:withdrawnId},{status:409});dispute.livemode=false
 const returned=await api('return',{eventId:withdrawnId})
 assert.equal(returned.paymentId,allocated.id);assert.equal(returned.returnedCents,principal)
 assert.equal(returned.balanceTransactions[0].fee,1500)
 assert.equal(returned.balanceTransactions[0].net,-principal-1500)
 let balance=await invoiceBalance()
 assert.equal(balance.returnedCents,principal);assert.equal(balance.paidCents,allocated.amountCents-principal);assert.equal(balance.outstandingCents,principal)
 assert.deepEqual(await api('return',{eventId:withdrawnId}),returned)
 const oldId=edge.disputeEvent('synthetic-mallet-961','charge.dispute.created')
 edge.objects.get(oldId).data.object.balance_transactions=[]
 const old=await api('return',{eventId:oldId})
 assert.equal(old.returnedCents,principal,'An old event reads the current authenticated dispute rather than its stale payload')
 assert.ok(old.sequence>returned.sequence)
 edge.pi.latest_charge.disputed=false
 await api('event',{eventId:edge.providerEvent('synthetic-mallet-966')})
 assert.equal((await invoiceBalance()).returnedCents,principal,'Refreshing captured success cannot erase separately retained returned principal')
 edge.pi.latest_charge.disputed=true
 let state=await h.state()
 assert.equal(state.records.stripeReturn.filter(r=>r.eventId===withdrawnId).length,1)
 assert.deepEqual(state.records.payment.find(p=>p.id===allocated.id),allocated,'The original captured allocation remains immutable')
 const hidden=(await h.state({as:admin.cookie})).records
 assert.equal(hidden.stripeReturn,undefined);assert.ok(!hidden.event.some(e=>e.kind==='stripe.returnObserve'))
 const backup=await archive(h),calls=edge.calls.length
 const fresh=await installation({bindings:{OWNER_EMAIL:'synthetic-mallet-962@example.test',AUTH_LOCAL:'true',STRIPE_SECRET_KEY:'synthetic-mallet-800'},outboundService:edge.edge})
 try{
  await restore(fresh,backup)
  const restored=await fresh.state()
  assert.deepEqual(restored.records.stripeReturn,state.records.stripeReturn)
  assert.deepEqual(restored.records.payment,state.records.payment)
  const restoredBalance=await invoiceBalance(fresh)
  assert.equal(restoredBalance.returnedCents,principal);assert.equal(restoredBalance.outstandingCents,principal)
  await fresh.api('/api/mallet/stripe/return',{eventId:withdrawnId},{status:409})
  assert.equal(edge.calls.length,calls,'Archive data grants no provider authority to the replacement owner')
 }finally{await fresh.close()}
 const reinstatement=edge.reinstate(principal),reinstatedId=edge.disputeEvent('synthetic-mallet-963','charge.dispute.funds_reinstated')
 // Expandable balance transaction ids are read independently as current objects.
 dispute.balance_transactions=[withdrawal.id,reinstatement.id]
 const reinstated=await api('return',{eventId:reinstatedId})
 assert.equal(reinstated.returnedCents,0)
 balance=await invoiceBalance();assert.equal(balance.returnedCents,0);assert.equal(balance.paidCents,allocated.amountCents);assert.equal(balance.outstandingCents,0)
 await api('return',{eventId:withdrawnId})
 assert.equal((await invoiceBalance()).returnedCents,0,'Replaying an old event never supersedes the later current observation')
 // A success refresh may not erase the independently retained return history.
 edge.pi.latest_charge.disputed=false
 await api('event',{eventId:edge.providerEvent('synthetic-mallet-964')})
 state=await h.state()
 assert.equal(state.records.stripeReturn.filter(r=>r.paymentId===allocated.id).length,4)
 assert.deepEqual(state.records.payment.find(p=>p.id===allocated.id),allocated)
 assert.deepEqual(state.records.invoice.find(i=>i.id===invoice.id),invoice)
 assert.equal(edge.calls.filter(c=>c.method==='POST').length,1,'Return observations never mutate Stripe')
 return {invoice,checkout,returned,reinstated}
}
