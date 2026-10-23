import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Context,type Handler,type State,type Row} from './model'
import {amount,moveStock} from './inventory'
import {lotRemaining} from './stock-trace'
export const transferCommands=['stock.location','stock.transferRequest','stock.transferApprove','stock.transferDispatch','stock.transferReceive','stock.transferCorrect']
function receiveLot(c:Context,transfer:Row,line:any,quantityMilli:number,sourceId:string,binId:string){
 if(!quantityMilli)return null
 const snapshot=line.lot,lot=put(c.s,'stockLot',{...snapshot,id:undefined,version:undefined,binId,quantityMilli,parentLotId:snapshot.id,rootLotId:snapshot.rootLotId??snapshot.id,transferId:transfer.id,reference:'Transfer '+sourceId,by:who(c),at:c.now})
 moveStock(c,line.itemId,binId,quantityMilli,{kind:'transferReceipt',id:sourceId,transferId:transfer.id,lotId:lot.id},'Transfer custody received');return lot.id
}
export function transferReport(s:State):Row[]{return rows(s,'stockTransfer').map(t=>{
 const exceptions=rows(s,'stockTransferException').filter(e=>e.transferId===t.id)
 return {...t,exceptions,lines:t.lines.map((l:any)=>{
  const receipt=t.receipt?.lines.find((r:any)=>r.lineId===l.id),missing=exceptions.filter(e=>e.lineId===l.id&&e.kind==='shortage'&&!e.correction).reduce((n,e)=>n+e.quantityMilli,0),damaged=exceptions.filter(e=>e.lineId===l.id&&e.kind==='damaged'&&!e.correction).reduce((n,e)=>n+e.quantityMilli,0)
  return {...l,inTransitMilli:t.status==='in-transit'?l.quantityMilli:t.receipt?missing:0,receivedMilli:(receipt?.receivedMilli??0)+exceptions.filter(e=>e.lineId===l.id&&e.correction?.outcome==='received').reduce((n,e)=>n+e.quantityMilli,0),quarantinedMilli:damaged}
 })}
})}
export const transfers:Handler=(c,command,p)=>{
 if(!transferCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only owner and admin operators manage transfer custody.',null,403)
 if(command==='stock.location'){
  const bin=find(c.s,'stockBin',p.binId);expectVersion(bin,p.version)
  const saved=bump(c.s,'stockBin',bin,{location:text(p.location,'shop/location label'),by:who(c),at:c.now});event(c,command,null,bin.id,{location:saved.location});return saved
 }
 if(command==='stock.transferRequest'){
  const destination=find(c.s,'stockBin',p.destinationBinId),reference=text(p.reference,'transfer reference')
  if(rows(c.s,'stockTransfer').some(t=>t.reference.toLowerCase()===reference.toLowerCase()))fail('DUPLICATE','That transfer reference already exists.')
  if(!Array.isArray(p.lines)||!p.lines.length||p.lines.length>50)fail('INPUT','Choose 1–50 traced transfer lines.',null,400)
  const seen=new Set(),lines=p.lines.map((value:any)=>{
   const lot=find(c.s,'stockLot',value.lotId),quantityMilli=amount(value.quantity)
   if(seen.has(lot.id)||lot.binId===destination.id||lot.serial&&quantityMilli!==1000||lotRemaining(c.s,lot)<quantityMilli)fail('TRANSFER_SCOPE','Choose available whole serials or lot quantities once, at a different sending location.')
   seen.add(lot.id);return {id:crypto.randomUUID(),lotId:lot.id,itemId:lot.itemId,quantityMilli,unitCostCents:lot.unitCostCents,lot:structuredClone(lot)}
  }),source=find(c.s,'stockBin',lines[0].lot.binId)
  if(lines.some((l:any)=>l.lot.binId!==source.id))fail('TRANSFER_SCOPE','All transfer lines must leave the same sending bin.')
  const row=put(c.s,'stockTransfer',{reference,sourceBinId:source.id,destinationBinId:destination.id,source:structuredClone(source),destination:structuredClone(destination),lines,reason:text(p.reason,'transfer request reason',2000),status:'requested',approval:null,dispatch:null,receipt:null,by:who(c),at:c.now})
  event(c,command,null,row.id,{sourceBinId:source.id,destinationBinId:destination.id});return row
 }
 const transfer=find(c.s,'stockTransfer',p.transferId);expectVersion(transfer,p.version)
 const save=(change:any)=>{const next=bump(c.s,'stockTransfer',transfer,change);event(c,command,null,transfer.id,change);return next}
 if(command==='stock.transferApprove'){
  if(transfer.status!=='requested')fail('TRANSFER_STATE','Approve only the exact requested transfer once.')
  return save({status:'approved',approval:{lines:structuredClone(transfer.lines),source:transfer.source,destination:transfer.destination,reason:text(p.reason,'transfer approval reason',2000),by:who(c),at:c.now}})
 }
 if(command==='stock.transferDispatch'){
  if(transfer.status!=='approved')fail('TRANSFER_STATE','Dispatch only a person-approved transfer once.')
  const evidence=text(p.evidence,'dispatch custody evidence',4000)
  for(const line of transfer.lines){const lot=find(c.s,'stockLot',line.lotId);if(lot.binId!==transfer.sourceBinId||lotRemaining(c.s,lot)<line.quantityMilli)fail('TRANSFER_STALE','Sending lot custody changed. Do not dispatch unavailable stock.')
   moveStock(c,line.itemId,transfer.sourceBinId,-line.quantityMilli,{kind:'transferDispatch',id:transfer.id,lotId:lot.id},evidence)
   put(c.s,'stockLotAdjustment',{lotId:lot.id,transferId:transfer.id,deltaMilli:-line.quantityMilli,reason:evidence,by:who(c),at:c.now})
  }
  return save({status:'in-transit',dispatch:{evidence,by:who(c),at:c.now}})
 }
 if(command==='stock.transferReceive'){
  if(transfer.status!=='in-transit'||transfer.receipt)fail('TRANSFER_STATE','Receive a dispatched transfer once, with every line including shortages.')
  if(!Array.isArray(p.lines)||p.lines.length!==transfer.lines.length)fail('INPUT','Record every dispatched line once.',null,400)
  const seen=new Set(),lines=p.lines.map((value:any)=>{
   const line=transfer.lines.find((l:any)=>l.id===value.lineId),receivedMilli=amount(value.received,'received quantity',true),damagedMilli=amount(value.damaged,'damaged quantity',true)
   if(!line||seen.has(line.id)||receivedMilli+damagedMilli>line.quantityMilli||line.lot.serial&&![receivedMilli,damagedMilli].every(n=>n===0||n===1000))fail('TRANSFER_RECEIPT','Receipt cannot duplicate lines, exceed dispatched stock or split a serial.')
   seen.add(line.id);return {lineId:line.id,receivedMilli,damagedMilli,shortageMilli:line.quantityMilli-receivedMilli-damagedMilli}
  }),evidence=text(p.evidence,'receipt condition/custody evidence',4000)
  for(const receipt of lines){const line=transfer.lines.find((l:any)=>l.id===receipt.lineId)
   receiveLot(c,transfer,line,receipt.receivedMilli,transfer.id+':'+line.id,transfer.destinationBinId)
   for(const [kind,quantityMilli]of [['shortage',receipt.shortageMilli],['damaged',receipt.damagedMilli]] as const)if(quantityMilli)put(c.s,'stockTransferException',{transferId:transfer.id,lineId:line.id,lotId:line.lotId,itemId:line.itemId,kind,quantityMilli,unitCostCents:line.unitCostCents,correction:null,evidence,by:who(c),at:c.now})
  }
  return save({status:lines.some((l:any)=>l.shortageMilli||l.damagedMilli)?'exception':'received',receipt:{lines,evidence,by:who(c),at:c.now}})
 }
 const exception=find(c.s,'stockTransferException',p.exceptionId)
 if(exception.transferId!==transfer.id||exception.correction)fail('TRANSFER_STATE','Correct one unresolved exception belonging to this transfer once.')
 const outcome=choice(p.outcome,['received','returned','lost','destroyed'],'approved correction'),reason=text(p.reason,'correction approval reason',2000),evidence=text(p.evidence,'correction custody evidence',4000),line=transfer.lines.find((l:any)=>l.id===exception.lineId)
 if(exception.kind==='damaged'&&outcome==='lost'||exception.kind==='shortage'&&outcome==='destroyed')fail('TRANSFER_STATE','Use lost for missing stock or destroyed for physically held damaged stock.')
 if(outcome==='received')receiveLot(c,transfer,line,exception.quantityMilli,exception.id,transfer.destinationBinId)
 if(outcome==='returned'){
  put(c.s,'stockLotAdjustment',{lotId:line.lotId,transferId:transfer.id,deltaMilli:exception.quantityMilli,reason,by:who(c),at:c.now})
  moveStock(c,line.itemId,transfer.sourceBinId,exception.quantityMilli,{kind:'transferReturn',id:exception.id,lotId:line.lotId},reason)
 }
 const correction={outcome,quantityMilli:exception.quantityMilli,reason,evidence,approvedBy:who(c),at:c.now};bump(c.s,'stockTransferException',exception,{correction})
 return save({status:rows(c.s,'stockTransferException').some(e=>e.transferId===transfer.id&&!e.correction)?'exception':'received',corrections:[...(transfer.corrections??[]),{exceptionId:exception.id,...correction}]})
}
