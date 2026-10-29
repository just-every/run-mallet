import {insist,whole} from './finance-values.mjs'
export async function validateWooCommerce({db,records,get,each}){
 const products=new Set(),items=new Set(),orders=new Set(),refunds=new Set()
 for await(const mapping of each('wooMapping')){
  const item=await get('stockItem',mapping.itemId);await get('stockBin',mapping.binId)
  const key=mapping.connectionId+':'+mapping.productId,native=mapping.connectionId+':'+mapping.itemId
  insist(typeof mapping.connectionId==='string'&&whole(mapping.productId,1)&&mapping.sku===item.sku&&mapping.authority==='mallet'&&!products.has(key)&&!items.has(native),'woo_mapping');products.add(key);items.add(native)
 }
 for await(const order of each('wooOrder')){
  const key=order.connectionId+':'+order.providerId
  insist(!orders.has(key)&&whole(order.providerId,1)&&order.currency==='USD'&&whole(order.totalCents)&&typeof order.transactionId==='string'&&typeof order.paymentMethod==='string'&&typeof order.status==='string'&&Array.isArray(order.lines)&&order.lines.length>0&&typeof order.stockApplied==='boolean'&&Array.isArray(order.restockedRefundIds),'woo_order');orders.add(key)
  const observed=[]
  for await(const r of each('wooRefund','orderId',order.providerId))if(r.connectionId===order.connectionId)observed.push(r)
  insist(observed.reduce((n,r)=>n+r.receipt.amountCents,0)<=order.totalCents&&new Set(order.restockedRefundIds).size===order.restockedRefundIds.length&&order.restockedRefundIds.every(id=>observed.some(r=>r.providerId===id)),'woo_refund_sum')
  const seen=new Set()
  for(const line of order.lines){
   insist(whole(line.id,1)&&!seen.has(line.id)&&whole(line.quantity,1)&&whole(line.totalCents)&&products.has(order.connectionId+':'+line.productId)&&whole(order.applied[line.id])&&order.applied[line.id]<=line.quantity*1000,'woo_line');seen.add(line.id)
   const refunded=observed.flatMap(r=>r.receipt.lines).filter(r=>r.lineId===line.id).reduce((n,r)=>n+r.quantity,0),returned=observed.filter(r=>order.restockedRefundIds.includes(r.providerId)).flatMap(r=>r.receipt.lines).filter(r=>r.lineId===line.id).reduce((n,r)=>n+r.quantity,0)
   insist(refunded<=line.quantity&&order.applied[line.id]===(order.stockApplied?(line.quantity-returned)*1000:0),'woo_applied')
   const movement=await db.prepare(`SELECT COALESCE(SUM(json_extract(value,'$.deltaMilli')),0) AS total FROM ${records} WHERE kind='stockMovement' AND json_extract(value,'$.source.kind')='woocommerce' AND json_extract(value,'$.source.id')=? AND json_extract(value,'$.source.lineId')=?`).bind(order.id,line.id).first()
   insist(movement.total===-order.applied[line.id],'woo_stock_sum')
  }
 }
 for await(const refund of each('wooRefund')){
  const key=refund.connectionId+':'+refund.providerId
  insist(!refunds.has(key)&&whole(refund.providerId,1)&&refund.providerId===refund.receipt.providerId&&whole(refund.receipt.amountCents)&&orders.has(refund.connectionId+':'+refund.orderId)&&Array.isArray(refund.receipt.lines),'woo_refund');refunds.add(key)
  const source=await db.prepare(`SELECT value FROM ${records} WHERE kind='wooOrder' AND json_extract(value,'$.connectionId')=? AND json_extract(value,'$.providerId')=?`).bind(refund.connectionId,refund.orderId).first(),order=JSON.parse(source.value)
  for(const line of refund.receipt.lines)insist(whole(line.lineId,1)&&whole(line.quantity,1)&&whole(line.totalCents)&&order.lines.some(l=>l.id===line.lineId&&line.quantity<=l.quantity),'woo_refund_line')
 }
}
