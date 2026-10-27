import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {createServer} from 'node:http'
import {installation,archive,restore} from '../harness.mjs'
export const signing='synthetic-mallet-woocommerce-signature'
const reader=Buffer.from('synthetic-mallet-reader:synthetic-mallet-reader-secret').toString('base64')
export async function wooFixture(options={}){
 const live=process.env.MALLET_WOO_ORIGIN,origin=live??'https://woocommerce.example.test',sku='synthetic-mallet-'+randomUUID(),calls=[]
 let product={id:41,type:'simple',sku,variations:[]},order={id:51,status:'processing',currency:'USD',transaction_id:'synthetic-mallet-payment-61',payment_method:'bacs',date_paid_gmt:'2026-10-27T12:00:00',total:'50.00',line_items:[{id:71,product_id:41,quantity:2,total:'50.00'}]},refunds=[]
 const api=async(path,body)=>{
  const response=await fetch(origin+'/wp-json/wc/v3/'+path,{method:body?'POST':'GET',headers:{authorization:'Basic '+Buffer.from('synthetic-mallet-consumer:synthetic-mallet-secret').toString('base64'),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
  const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value
 }
 if(live){product=await api('products',{name:sku,type:'simple',sku,regular_price:'25.00',manage_stock:true,stock_quantity:10});order=await api('orders',{status:'processing',currency:'USD',payment_method:'bacs',transaction_id:'synthetic-mallet-payment-61',set_paid:true,line_items:[{product_id:product.id,quantity:2}]})}
 const h=await installation({...options,outboundService:async request=>{
  calls.push({method:request.method,path:new URL(request.url).pathname,auth:request.headers.get('authorization')})
  assert.equal(request.headers.get('authorization'),'Basic '+reader)
  if(live){const response=await fetch(request.url,{headers:request.headers});return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers})}
  const path=new URL(request.url).pathname
  return Response.json(path.includes('/products/')?product:path.endsWith('/refunds')?refunds:order)
 }})
 const item=await h.command('stock.item',{sku,name:'Accessory',unit:'each',barcode:sku}),bin=await h.command('stock.bin',{code:'Counter',barcode:'synthetic-mallet-bin'})
 await h.command('stock.receive',{itemBarcode:sku,binBarcode:bin.barcode,expectedQuantity:10,quantity:10,reference:'synthetic-mallet-receipt',reason:'Opening physical count'})
 await h.stepUp()
 for(const [name,credential] of [['WOO_API_AUTH',reader],['WOO_WEBHOOK_SECRET',signing]])await h.command('connector.save',{connector:'woocommerce',name,credential,acknowledge:1})
 await h.command('woocommerce.enable',{origin,authority:'mallet',acknowledge:1})
 const map=()=>h.command('woocommerce.map',{productId:product.id,itemId:item.id,binId:bin.id})
 const event=async(payload=order,key=signing,topic='order.updated')=>h.request('/api/mallet/woocommerce/events',{method:'POST',as:'',body:payload,headers:{'x-wc-webhook-topic':topic,'x-wc-webhook-signature':createHmac('sha256',key).update(JSON.stringify(payload)).digest('base64')}})
 const refund=async()=>{
  if(live){const r=await api('orders/'+order.id+'/refunds',{amount:'25.00',reason:'Returned one accessory',api_refund:false,restock_items:true,line_items:[{id:order.line_items[0].id,quantity:1,refund_total:25}]});refunds=[r];order=await api('orders/'+order.id)}
  else refunds=[{id:81,amount:'25.00',line_items:[{quantity:-1,total:'-25.00',meta_data:[{key:'_refunded_item_id',value:order.line_items[0].id}]}]}]
  return refunds[0]
 }
 return {h,origin,live,api,item,bin,product,get order(){return order},get refunds(){return refunds},calls,map,event,refund,changeOrder(change){Object.assign(order,change)}}
}
export async function woocommerceJourney(){
 const f=await wooFixture(),{h}=f;let server,webhook
 try{
  const member=await h.person('synthetic-mallet-woo-member@example.test'),admin=await h.person('synthetic-mallet-woo-admin@example.test','admin')
  for(const as of ['',member.cookie,admin.cookie])await h.command('woocommerce.map',{productId:f.product.id,itemId:f.item.id,binId:f.bin.id},{as,status:as?403:401})
  await h.command('woo.observe',{}, {status:404});await h.api('/api/mallet/woocommerce',undefined,{as:member.cookie,status:403})
  if(!f.live){const sku=f.product.sku;f.product.sku='synthetic-mallet-wrong';await h.command('woocommerce.map',{productId:f.product.id,itemId:f.item.id,binId:f.bin.id},{status:409});f.product.sku=sku}
  await f.map();await f.map().then(()=>assert.fail('duplicate mapping'),e=>assert.match(e.message,/409|already mapped/))
  let received=0;const deliveries=[]
  const providerDelivery=async count=>{
   // WordPress can flush its REST response before its shutdown webhook runs.
   const deadline=Date.now()+15000
   while(received<count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50))
   assert.ok(received>=count,'WooCommerce itself delivered signed observation '+count)
  }
  if(f.live){
   server=createServer(async(req,res)=>{const parts=[];for await(const part of req)parts.push(part);const raw=Buffer.concat(parts);if(raw.toString().startsWith('webhook_id=')){res.writeHead(200).end();return}try{const response=await h.mf.dispatchFetch(h.origin+'/api/mallet/woocommerce/events',{method:'POST',headers:req.headers,body:raw});const result=await response.text();if(response.ok){deliveries.push({headers:req.headers,body:raw});received++}else console.log('WooCommerce delivery refusal: '+response.status+' '+result);res.writeHead(response.status).end(result)}catch{res.writeHead(500).end()}})
   await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve))
   const gateway=process.env.MALLET_WOO_GATEWAY??'172.18.0.1';webhook=await f.api('webhooks',{name:'synthetic-mallet-round-trip',topic:'order.updated',delivery_url:'http://'+gateway+':'+server.address().port,secret:signing,status:'active'})
   assert.equal(webhook.status,'active');assert.equal(webhook.topic,'order.updated');assert.ok(webhook.hooks.length>0)
   // Complete the actual paid order to produce a provider order.updated event.
   const updated=await f.api('orders/'+f.order.id,{status:'completed'});assert.equal(updated.status,'completed');await providerDelivery(1)
   assert.equal((await f.api('products/'+f.product.id)).stock_quantity,8,'Provider stock independently matches the paid order')
  }
  const before=f.calls.length;assert.equal((await f.event(f.order,'synthetic-mallet-wrong')).status,401);assert.equal(f.calls.length,before)
  assert.equal((await f.event()).status,200)
  if(!f.live){f.order.line_items[0].quantity=3;assert.equal((await f.event()).status,409);f.order.line_items[0].quantity=2}
  const snapshot=await h.api('/api/mallet/woocommerce');assert.equal(snapshot.orders.length,1);assert.equal(snapshot.balances[0].onHandMilli,8000);assert.equal(snapshot.orders[0].providerId,f.order.id);assert.equal(snapshot.orders[0].status,f.live?'completed':'processing');assert.equal(snapshot.orders[0].paymentMethod,'bacs');assert.equal(snapshot.orders[0].totalCents,5000);assert.equal(snapshot.orders[0].transactionId,'synthetic-mallet-payment-61');assert.deepEqual((await h.state()).records.payment??[],[])
  if(f.live){const replay=await h.mf.dispatchFetch(h.origin+'/api/mallet/woocommerce/events',{method:'POST',...deliveries[0]});assert.equal(replay.status,200,'Replay the exact provider delivery bytes and signature');assert.equal((await replay.json()).replayed,true)}
  assert.equal((await f.event()).status,200);assert.equal((await h.api('/api/mallet/woocommerce')).balances[0].onHandMilli,8000)
  await h.restart();assert.equal((await f.event()).status,200);assert.equal((await h.api('/api/mallet/woocommerce')).balances[0].onHandMilli,8000,'Durable provider identity survives a runtime restart')
  const refund=await f.refund();assert.equal(refund.amount,'25.00')
  if(f.live){await providerDelivery(2);assert.equal((await f.api('products/'+f.product.id)).stock_quantity,9,'Provider stock independently matches the actual line refund')}
  assert.equal((await f.event({id:f.order.id,status:'pending',line_items:[]})).status,200,'Old event payload re-reads current provider facts')
  if(f.live)assert.equal((await h.mf.dispatchFetch(h.origin+'/api/mallet/woocommerce/events',{method:'POST',...deliveries[0]})).status,200,'A late original provider delivery cannot roll the refund back')
  let view=await h.api('/api/mallet/woocommerce');assert.equal(view.refunds.length,1);assert.equal(view.refunds[0].providerId,refund.id);assert.equal(view.refunds[0].orderId,f.order.id);assert.equal(view.refunds[0].receipt.amountCents,2500);assert.equal(view.refunds[0].receipt.lines[0].lineId,f.order.line_items[0].id);assert.equal(view.refunds[0].receipt.lines[0].quantity,1);assert.equal(view.refunds[0].receipt.lines[0].totalCents,2500);assert.equal(view.balances[0].onHandMilli,8000,'Refund alone never proves returned goods')
  await h.command('woocommerce.reconcile',{orderId:f.order.id,restockRefundIds:String(refund.id)});await h.command('woocommerce.reconcile',{orderId:f.order.id,restockRefundIds:String(refund.id)})
  view=await h.api('/api/mallet/woocommerce');assert.equal(view.orders.length,1);assert.equal(view.refunds.length,1);assert.equal(view.balances[0].onHandMilli,9000);assert.equal(view.orders[0].transactionId,'synthetic-mallet-payment-61');assert.deepEqual((await h.state()).records.payment??[],[])
  await h.command('woocommerce.reconcile',{orderId:f.order.id,restockRefundIds:'99999999'},{status:409})
  await (await h.mf.getD1Database('DB')).prepare('UPDATE mallet_session_proofs SET step_up_until=0').run();const denied=await h.request('/api/mallet/commands',{method:'POST',body:{command:'woocommerce.reconcile',input:{orderId:f.order.id,restockRefundIds:String(refund.id)}}});assert.equal(denied.status,403);await h.stepUp()
  const state=await h.state({as:admin.cookie});assert.ok(!Object.keys(state.records).some(k=>k.startsWith('woo')))
  const saved=await archive(h),serialized=JSON.stringify(saved);assert.ok(!serialized.includes(signing));assert.ok(!serialized.includes(reader));assert.ok(!saved[0].tables.some(t=>t.name==='mallet_woo_authority'))
  const target=await installation();try{await restore(target,saved);const recovered=await target.api('/api/mallet/woocommerce');assert.deepEqual(recovered.orders,view.orders);assert.deepEqual(recovered.refunds,view.refunds);assert.deepEqual(recovered.mappings,view.mappings);assert.deepEqual(recovered.balances,view.balances);assert.equal(recovered.connection,null);assert.deepEqual((await target.api('/api/mallet/connectors')).secrets,[]);await target.command('woocommerce.reconcile',{orderId:f.order.id},{status:409})}finally{await target.close()}
  await h.command('woocommerce.disable');await h.command('woocommerce.enable',{origin:f.origin,authority:'mallet',acknowledge:1});assert.equal((await f.event()).status,200);assert.equal((await h.api('/api/mallet/woocommerce')).balances[0].onHandMilli,9000,'Re-enabling the same provider never repeats stock')
  await h.command('connector.revoke',{connector:'woocommerce',name:'WOO_API_AUTH'});const calls=f.calls.length;assert.equal((await f.event()).status,503);await h.command('woocommerce.reconcile',{orderId:f.order.id},{status:503});assert.equal(f.calls.length,calls)
  await h.command('woocommerce.disable');assert.equal((await f.event()).status,409)
  console.log('WooCommerce receipt: '+JSON.stringify({mode:f.live?'actual disposable installation':'network edge',order:f.order.id,refund:refund.id,orders:1,refunds:1,stockMilli:9000,signedProviderDeliveries:received,counterPayments:0}))
 }finally{
  if(webhook)await f.api('webhooks/'+webhook.id,{status:'disabled'}).catch(()=>{})
  if(server)await new Promise(resolve=>server.close(resolve));await h.close()
 }
}
