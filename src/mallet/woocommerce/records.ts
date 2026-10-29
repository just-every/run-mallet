import {bump,event,fail,find,integer,put,rows,text,who,type Handler} from '../model'
import {moveStock} from '../inventory'
export const wooCommands=['woo.mapVerified','woo.observe']
export const wooRecords:Handler=(c,command,p)=>{
 if(!wooCommands.includes(command))return
 if(command==='woo.mapVerified'){
  if(c.actor.role!=='owner')fail('FORBIDDEN','Only the owner maps products.',null,403)
  const item=find(c.s,'stockItem',p.itemId),bin=find(c.s,'stockBin',p.binId)
  if(rows(c.s,'stockLot').some(l=>l.itemId===item.id&&l.binId===bin.id))fail('WOO_LOT','Tracked lots require a separate reviewed allocation.')
  if(item.sku!==p.sku)fail('WOO_SKU','The authenticated product SKU must match the native item.')
  if(rows(c.s,'wooMapping').some(m=>m.connectionId===p.connectionId&&(m.productId===p.productId||m.itemId===item.id)))fail('WOO_MAPPING','This product or native item is already mapped.')
  const row=put(c.s,'wooMapping',{connectionId:text(p.connectionId,'connection'),productId:integer(p.productId,'product',1),itemId:item.id,binId:bin.id,sku:item.sku,authority:'mallet',by:who(c),at:c.now});event(c,command,null,row.id,{productId:row.productId});return row
 }
 if(c.actor.role!=='system')fail('FORBIDDEN','Only an authenticated provider observation may enter.',null,403)
 const old=rows(c.s,'wooOrder').find(o=>o.connectionId===p.connectionId&&o.providerId===p.order.providerId)
 const order=p.order,refunds=p.refunds
 if(old&&JSON.stringify(old.lines)!==JSON.stringify(order.lines))fail('WOO_CONFLICT','Order lines changed after admission. Review in WooCommerce; stock is unchanged.')
 if(old?.transactionId&&old.transactionId!==order.transactionId)fail('WOO_CONFLICT','The payment identifier changed; review the provider order.')
 const mapped=order.lines.map((line:any)=>{const mapping=rows(c.s,'wooMapping').find(m=>m.connectionId===p.connectionId&&m.productId===line.productId);if(!mapping)fail('WOO_UNMAPPED','Map every product before receiving this order.');if(rows(c.s,'stockLot').some(l=>l.itemId===mapping.itemId&&l.binId===mapping.binId))fail('WOO_LOT','Tracked lots need a reviewed allocation.');return {line,mapping}})
 const refunded=(line:any)=>refunds.flatMap((r:any)=>r.lines).filter((r:any)=>r.lineId===line.id).reduce((n:number,r:any)=>n+r.quantity,0)
 for(const {line} of mapped)if(refunded(line)>line.quantity)fail('WOO_REFUND','Refund quantity exceeds the original order.')
 if(refunds.reduce((n:number,r:any)=>n+r.amountCents,0)>order.totalCents)fail('WOO_REFUND','Refund amounts exceed the order total.')
 const priorRefunds=rows(c.s,'wooRefund').filter(r=>r.connectionId===p.connectionId&&r.orderId===order.providerId)
 for(const prior of priorRefunds){const current=refunds.find((r:any)=>r.providerId===prior.providerId);if(!current||JSON.stringify(current)!==JSON.stringify(prior.receipt))fail('WOO_CONFLICT','Retained refund evidence changed or disappeared.')}
 const restocked=[...new Set([...(old?.restockedRefundIds??[]),...(p.restockRefundIds??[])])].sort((a:any,b:any)=>a-b)
 for(const id of restocked)if(!refunds.some((r:any)=>r.providerId===id))fail('WOO_REFUND','Approve only an observed refund identity.')
 const returned=(line:any)=>refunds.filter((r:any)=>restocked.includes(r.providerId)).flatMap((r:any)=>r.lines).filter((r:any)=>r.lineId===line.id).reduce((n:number,r:any)=>n+r.quantity,0)
 const paid=!!old?.stockApplied||!!order.paidAt&&['processing','completed','refunded'].includes(order.status)
 const desired=Object.fromEntries(mapped.map(({line}:any)=>[line.id,paid?(line.quantity-returned(line))*1000:0]))
 const replay=old&&JSON.stringify(old.observation)===JSON.stringify(order)&&JSON.stringify(old.applied)===JSON.stringify(desired)&&priorRefunds.length===refunds.length
 if(replay)return {order:old,replayed:true}
 const row=old?bump(c.s,'wooOrder',old,{...order,observation:order,stockApplied:paid,restockedRefundIds:restocked,applied:desired,observedAt:c.now}):put(c.s,'wooOrder',{...order,connectionId:p.connectionId,observation:order,stockApplied:paid,restockedRefundIds:restocked,applied:desired,observedAt:c.now})
 for(const {line,mapping} of mapped){const delta=(old?.applied?.[line.id]??0)-desired[line.id];if(delta)moveStock(c,mapping.itemId,mapping.binId,delta,{kind:'woocommerce',id:row.id,lineId:line.id},'WooCommerce observed order and line refunds')}
 for(const refund of refunds)if(!priorRefunds.some(r=>r.providerId===refund.providerId))put(c.s,'wooRefund',{connectionId:p.connectionId,orderId:order.providerId,providerId:refund.providerId,receipt:refund,at:c.now})
 event(c,command,null,row.id,{providerId:order.providerId,status:order.status,transactionId:order.transactionId,refundIds:refunds.map((r:any)=>r.providerId)})
 return {order:row,replayed:false}
}
