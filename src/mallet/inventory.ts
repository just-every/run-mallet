import {lotRemaining} from './stock-trace'
// Stock is an append-only quantity ledger. Counts propose changes; approval never rewrites a receipt.
import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type Handler,type State} from './model'
export const inventoryCommands=['stock.item','stock.bin','stock.receive','stock.reserve','stock.release','stock.count','stock.approveCount']
export function amount(value:unknown,label='quantity',zero=false){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||(!zero&&value===0)||Math.abs(value*1000-Math.round(value*1000))>0.000001)fail('INPUT',`${label} must be positive with at most three decimal places.`,null,400)
 return integer(Math.round(value*1000),label,zero?0:1,1_000_000_000)
}
export function stockBalance(s:State,itemId:string,binId:string){
 const onHandMilli=rows(s,'stockMovement').filter(x=>x.itemId===itemId&&x.binId===binId).reduce((n,x)=>n+x.deltaMilli,0)
 const reservedMilli=rows(s,'stockReservation').filter(x=>x.itemId===itemId&&x.binId===binId&&!x.release).reduce((n,x)=>n+x.quantityMilli,0)
 return {itemId,binId,onHandMilli,reservedMilli,availableMilli:onHandMilli-reservedMilli}
}
export function stockReport(s:State){return {balances:[...rows(s,'stockItem')].sort((a,b)=>a.sku.localeCompare(b.sku)).flatMap(item=>[...rows(s,'stockBin')].sort((a,b)=>a.code.localeCompare(b.code)).map(bin=>({...stockBalance(s,item.id,bin.id),sku:item.sku,item:item.name,bin:bin.code}))),receipts:rows(s,'stockReceipt'),counts:rows(s,'stockCount'),movements:rows(s,'stockMovement'),reservations:rows(s,'stockReservation')}}
export function scan(s:State,kind:'stockItem'|'stockBin',barcode:unknown){const code=text(barcode,'scanned barcode',100),row=rows(s,kind).find(x=>x.barcode.toLowerCase()===code.toLowerCase());if(!row)fail('NOT_FOUND',`Unknown ${kind==='stockItem'?'part':'bin'} barcode.`,null,404);return row}
export function moveStock(c:Context,itemId:string,binId:string,deltaMilli:number,source:any,reason:string){
 const balance=stockBalance(c.s,itemId,binId)
 if(balance.onHandMilli+deltaMilli<balance.reservedMilli)fail('STOCK_SHORTAGE','This movement would make stock negative or consume reserved stock.')
 return put(c.s,'stockMovement',{itemId,binId,deltaMilli,source,reason,by:who(c),at:c.now})
}
export function reserveStock(c:Context,itemId:string,binId:string,jobId:string,quantityMilli:number,source:any){
 const job=find(c.s,'job',jobId)
 if(!['booked','working'].includes(job.status))fail('JOB_STATE','Reserve stock only for an open repair.')
 if(stockBalance(c.s,itemId,binId).availableMilli<quantityMilli)fail('STOCK_SHORTAGE','There is not enough available stock in this bin.')
 return put(c.s,'stockReservation',{itemId,binId,jobId,quantityMilli,source,by:who(c),at:c.now,release:null})
}
export const inventory:Handler=(c,command,p)=>{
 if(!inventoryCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or service advisor manages stock.',null,403)
 if(command==='stock.item'||command==='stock.bin'){
  const kind=command==='stock.item'?'stockItem':'stockBin',barcode=text(p.barcode,'barcode',100),code=text(kind==='stockItem'?p.sku:p.code,kind==='stockItem'?'SKU':'bin code',100)
  if(rows(c.s,kind).some(x=>x.barcode.toLowerCase()===barcode.toLowerCase()||String(x.sku??x.code).toLowerCase()===code.toLowerCase()))fail('DUPLICATE','That code or barcode is already registered.')
  const row=put(c.s,kind,{barcode,...(kind==='stockItem'?{sku:code,name:text(p.name,'part name'),unit:text(p.unit,'unit',40)}:{code}),by:who(c),at:c.now});event(c,command,null,row.id,{});return row
 }
 if(command==='stock.release'){
  const r=find(c.s,'stockReservation',p.reservationId);expectVersion(r,p.version)
  if(r.release)fail('ALREADY_RELEASED','This reservation was already released.')
  const saved=bump(c.s,'stockReservation',r,{release:{by:who(c),at:c.now,reason:text(p.reason,'reason',2000)}});event(c,command,r.jobId,r.id,saved.release);return saved
 }
 if(command==='stock.approveCount'){
  const count=find(c.s,'stockCount',p.countId);expectVersion(count,p.version)
  if(count.approval)fail('ALREADY_APPROVED','This count adjustment was already approved.')
  const balance=stockBalance(c.s,count.itemId,count.binId)
  if(rows(c.s,'stockMovement').filter(x=>x.itemId===count.itemId&&x.binId===count.binId).length!==count.movementCount)fail('STALE_COUNT','Stock moved after this count. Count again before approving.')
  const reason=text(p.reason,'approval reason',2000),deltaMilli=count.countedMilli-count.expectedMilli
  const lots=rows(c.s,'stockLot').filter(l=>l.itemId===count.itemId&&l.binId===count.binId),lot=p.lotId?lots.find(l=>l.id===p.lotId):null
  if(p.lotId&&!lot)fail('LOT_SCOPE','Choose a lot in this part and bin.')
  if(lot){const remaining=lotRemaining(c.s,lot)+deltaMilli;if(remaining<0||lot.serial&&![0,1000].includes(remaining))fail('LOT_SHORTAGE','The count variance is not valid for that lot or serial.')}
  else if(balance.onHandMilli-lots.reduce((n,l)=>n+lotRemaining(c.s,l),0)+deltaMilli<0)fail('LOT_REQUIRED','Choose the affected lot before approving this stock variance.')
  if(lot)put(c.s,'stockLotAdjustment',{lotId:lot.id,countId:count.id,deltaMilli,by:who(c),at:c.now,reason})
  const movement=moveStock(c,count.itemId,count.binId,deltaMilli,{kind:'count',id:count.id},reason)
  const saved=bump(c.s,'stockCount',count,{approval:{by:who(c),at:c.now,reason,movementId:movement.id},varianceMilli:deltaMilli})
  event(c,command,null,count.id,{varianceMilli:deltaMilli,reason});return saved
 }
 const item=scan(c.s,'stockItem',p.itemBarcode),bin=scan(c.s,'stockBin',p.binBarcode)
 if(command==='stock.reserve'){
  const reference=text(p.reference,'reservation reference',200)
  if(rows(c.s,'stockReservation').some(x=>x.reference===reference))fail('DUPLICATE','This reservation reference is already retained.')
  const row=reserveStock(c,item.id,bin.id,text(p.jobId,'repair'),amount(p.quantity),{kind:'manual',reference});row.reference=reference;event(c,command,row.jobId,row.id,{quantityMilli:row.quantityMilli});return row
 }
 if(command==='stock.receive'){
  const reference=text(p.reference,'receiving reference',200)
  if(rows(c.s,'stockReceipt').some(x=>x.reference===reference))fail('DUPLICATE','This receiving reference is already retained. Do not receive twice.')
  const expectedMilli=amount(p.expectedQuantity,'labeled quantity'),quantityMilli=amount(p.quantity,'received quantity',true)
  const receipt=put(c.s,'stockReceipt',{itemId:item.id,binId:bin.id,reference,expectedMilli,quantityMilli,shortageMilli:expectedMilli-quantityMilli,reason:text(p.reason,'receiving note',2000),by:who(c),at:c.now})
  moveStock(c,item.id,bin.id,quantityMilli,{kind:'receipt',id:receipt.id},receipt.reason);event(c,command,null,receipt.id,{quantityMilli});return receipt
 }
 const count=put(c.s,'stockCount',{itemId:item.id,binId:bin.id,mode:choice(p.mode,['blind','cycle'],'count mode'),countedMilli:amount(p.quantity,'counted quantity',true),expectedMilli:stockBalance(c.s,item.id,bin.id).onHandMilli,movementCount:rows(c.s,'stockMovement').filter(x=>x.itemId===item.id&&x.binId===bin.id).length,reason:text(p.reason,'count note',2000),by:who(c),at:c.now,approval:null})
 event(c,command,null,count.id,{countedMilli:count.countedMilli});return count
}
