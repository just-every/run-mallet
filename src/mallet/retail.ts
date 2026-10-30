import {event,fail,find,integer,put,rows,text,who,type Handler,type State} from './model'
import {moveStock,scan,stockBalance} from './inventory'
import {lotRemaining} from './stock-trace'
import {configuredTax} from './tax'
import {price} from './money'

export const retailCommands=['retail.sell','retail.return']
export function retailReport(s:State){
 const sales=rows(s,'retailSale'),returns=rows(s,'retailReturn')
 return {currency:'USD',basis:'Owner-recorded physical cash only; no bank verification or drawer close.',sales,returns,
  soldCents:sales.reduce((n,r)=>n+r.totalCents,0),returnedCents:returns.reduce((n,r)=>n+r.totalCents,0),
  netCashCents:sales.reduce((n,r)=>n+r.totalCents,0)-returns.reduce((n,r)=>n+r.totalCents,0)}
}
export const retail:Handler=(c,command,p)=>{
 if(!retailCommands.includes(command))return
 if(c.actor.role!=='owner')fail('FORBIDDEN','Only the current owner records counter cash sales and returns.',null,403)
 const reference=text(p.reference,'unique counter reference'),quantity=integer(p.quantity,'whole accessory quantity',1,1000)
 const kind=command==='retail.sell'?'retailSale':'retailReturn'
 const request=command==='retail.sell'?{itemBarcode:text(p.itemBarcode,'accessory barcode',100).toLowerCase(),binBarcode:text(p.binBarcode,'bin barcode',100).toLowerCase(),lotId:text(p.lotId,'lot',200,true),quantity,unitCents:integer(p.unitCents,'unit price in USD cents',0,100_000_000),cashCents:integer(p.cashCents,'cash received in USD cents',0,1_000_000_000)}:
  {saleId:text(p.saleId,'sale receipt'),quantity,reason:text(p.reason,'inspection and cash return evidence',2000),confirm:text(p.confirm,'physical return confirmation')}
 const prior=rows(c.s,kind).find(r=>r.reference===reference)
 if(prior){if(JSON.stringify(prior.request)===JSON.stringify(request))return prior;fail('DUPLICATE','This counter reference already records different facts.')}
 if(command==='retail.sell'){
  const item=scan(c.s,'stockItem',p.itemBarcode),bin=scan(c.s,'stockBin',p.binBarcode),quantityMilli=quantity*1000
  if(bin.location&&bin.location!=='shop')fail('LOCATION_SCOPE','Counter sales currently use the home shop only.',null,403)
  const lot=p.lotId?find(c.s,'stockLot',p.lotId):null
  if(lot&&(lot.itemId!==item.id||lot.binId!==bin.id||lot.serial||lotRemaining(c.s,lot)<quantityMilli))fail('RETAIL_LOT','Choose enough non-serialized stock from this accessory and bin.')
  const untracked=stockBalance(c.s,item.id,bin.id).onHandMilli-rows(c.s,'stockLot').filter(l=>l.itemId===item.id&&l.binId===bin.id).reduce((n,l)=>n+lotRemaining(c.s,l),0)
  if(!lot&&untracked<quantityMilli)fail('RETAIL_LOT','Choose a lot for traced stock; untracked stock is insufficient.')
  const settings=configuredTax(c.s),unitCents=integer(p.unitCents,'unit price in USD cents',0,100_000_000)
  const amounts=price({quantityMilli,unitCents,taxable:settings.partsTaxable,taxRateMillionths:settings.rateMillionths})
  const cashCents=integer(p.cashCents,'cash received in USD cents',amounts.totalCents,1_000_000_000)
  const id=crypto.randomUUID(),movement=moveStock(c,item.id,bin.id,-quantityMilli,{kind:'retailSale',id,lotId:lot?.id??null},'Counter sale '+reference)
  const sale=put(c.s,'retailSale',{reference,request,itemId:item.id,binId:bin.id,lotId:lot?.id??null,description:item.name,sku:item.sku,itemBarcode:item.barcode.toLowerCase(),binBarcode:bin.barcode.toLowerCase(),quantity,quantityMilli,unitCents,taxable:settings.partsTaxable,taxRateMillionths:settings.rateMillionths,...amounts,currency:'USD',cashCents,changeCents:cashCents-amounts.totalCents,movementId:movement.id,by:who(c),at:c.now})
  // Reserve the source identity before persistence; receipts never change later.
  sale.id=id
  event(c,command,null,id,{reference,movementId:movement.id,totalCents:sale.totalCents});return sale
 }
 const sale=find(c.s,'retailSale',p.saleId),returned=rows(c.s,'retailReturn').filter(r=>r.saleId===sale.id).reduce((n,r)=>n+r.quantity,0)
 if(quantity>sale.quantity-returned)fail('EXCESS_RETURN','The return exceeds the original unreturned quantity.')
 if(p.confirm!=='saleable-cash-returned')fail('RETAIL_RETURN','Confirm the inspected accessory is saleable, physically returned and its cash refund recorded.')
 const bin=find(c.s,'stockBin',sale.binId)
 if(bin.location&&bin.location!=='shop')fail('LOCATION_SCOPE','Counter returns currently use the home shop only.',null,403)
 // Cumulative original-tax allocation makes all partial returns sum exactly to the receipt.
 const allocated=(q:number)=>Number((BigInt(sale.salesTaxCents)*BigInt(q)+BigInt(Math.floor(sale.quantity/2)))/BigInt(sale.quantity))
 const subtotalCents=quantity*sale.unitCents,salesTaxCents=allocated(returned+quantity)-allocated(returned),totalCents=subtotalCents+salesTaxCents
 const id=crypto.randomUUID(),movement=moveStock(c,sale.itemId,sale.binId,quantity*1000,{kind:'retailReturn',id,lotId:sale.lotId},'Inspected counter return '+reference)
 const saved=put(c.s,'retailReturn',{reference,request,saleId:sale.id,itemId:sale.itemId,binId:sale.binId,lotId:sale.lotId,quantity,returnedBefore:returned,quantityMilli:quantity*1000,subtotalCents,salesTaxCents,totalCents,currency:'USD',reason:request.reason,movementId:movement.id,by:who(c),at:c.now})
 saved.id=id
 event(c,command,null,id,{reference,saleId:sale.id,movementId:movement.id,totalCents});return saved
}
