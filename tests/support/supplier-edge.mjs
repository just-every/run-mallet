import assert from 'node:assert/strict'
export function supplierEdge(){
 const calls=[],orders=new Map(),actions=new Set();let mode='timeout',quoteMode='normal'
 const origin='https://supplier.example.test',key='synthetic-mallet-200'
 const offers=quantityMilli=>['Cedar Parts','Maple Parts'].map((supplierName,n)=>({quoteId:'synthetic-mallet-'+(201+n),supplierId:'synthetic-mallet-'+(203+n),supplierName,grade:n?'Remanufactured':'OE-equivalent',compatible:quoteMode!=='incompatible',availableMilli:quoteMode==='short'?0:10000,quantityMilli,unitCents:n?900:1000,freightCents:n?500:200,taxCents:n?90:100,currency:'USD',observedAt:new Date().toISOString(),cutoffAt:new Date(Date.now()+(quoteMode==='expired'?-3600000:3600000)).toISOString(),etaAt:new Date(Date.now()+3*3600000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}))
 const fetch=async request=>{
 const url=new URL(request.url);assert.equal(url.origin,origin);assert.equal(request.headers.get('authorization'),'Bearer '+key)
 const body=request.method==='POST'?await request.json():null;calls.push({path:url.pathname,query:Object.fromEntries(url.searchParams),method:request.method,body,key:request.headers.get('idempotency-key')})
 if(url.pathname==='/v1/quotes')return Response.json({offers:offers(Number(url.searchParams.get('quantity_milli')))})
 if(url.pathname==='/v1/orders'&&request.method==='POST'){
  assert.equal(request.headers.get('idempotency-key'),'mallet-supplier-order-'+body.clientReference)
  if(!orders.has(body.clientReference))orders.set(body.clientReference,{...body,orderId:'synthetic-mallet-'+(210+orders.size),status:mode==='reject'?'rejected':'acknowledged'})
  if(mode==='timeout')return new Response(null,{status:504})
  return Response.json(orders.get(body.clientReference))
 }
 const match=url.pathname.match(/^\/v1\/orders\/([^/]+)(\/actions)?$/);assert.ok(match)
 const order=orders.get(decodeURIComponent(match[1]));if(!order)return new Response(null,{status:404})
 if(match[2]){
  assert.equal(request.headers.get('idempotency-key'),'mallet-supplier-action-'+body.actionId)
  if(!actions.has(body.actionId)){actions.add(body.actionId);order.actionId=body.actionId;if(body.action==='cancel')order.status='cancelled';else{assert.equal(body.action,'reject-substitution');assert.equal(body.proposalId,order.proposal.id);delete order.proposal;order.status='acknowledged'}}
 }
 if(mode==='mismatch')return Response.json({...order,totalCents:order.totalCents+1})
 if(mode==='secret-echo')return Response.json({...order,ignored:key})
 return Response.json(order)
 }
 return {origin,key,fetch,calls,orders,actions,set mode(v){mode=v},set quoteMode(v){quoteMode=v},substitute(reference){const order=orders.get(reference);order.status='substitution';order.proposal={id:'synthetic-mallet-220',sku:'synthetic-mallet-221',grade:'Different grade',unitCents:5000}}}
}
