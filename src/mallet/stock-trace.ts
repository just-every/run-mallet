import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State,type Row} from './model'
import {amount,moveStock,receiptExists,scan,stockBalance} from './inventory'
import {openJob} from './workshop'
export const traceCommands=['stock.catalog','stock.lot','stock.useLot']
export const lotRemaining=(s:State,lot:Row)=>lot.quantityMilli+rows(s,'stockLotAdjustment').filter(a=>a.lotId===lot.id).reduce((n,a)=>n+a.deltaMilli,0)-rows(s,'stockUse').filter(u=>u.lotId===lot.id).reduce((n,u)=>n+u.quantityMilli,0)
export function traceReport(s:State,query:string):{lots:Row[],uses:Row[]}{
 const q=text(query,'trace search',200,true).toLowerCase(),lots=rows(s,'stockLot').filter(l=>!q||[l.supplier,l.supplierLot,l.serial,l.reference,l.catalog.sku,...l.catalog.crossReferences?.split('\n')??[]].some(v=>String(v??'').toLowerCase().includes(q)))
 const ids=new Set(lots.map(l=>l.id)),uses=rows(s,'stockUse').filter(u=>ids.has(u.lotId)).map(u=>{const job=find(s,'job',u.jobId);return {...u,vehicle:job.asset.label,identifier:job.asset.identifier,customer:job.asset.customerName,repair:job.title}})
 return {lots:lots.map(l=>({...l,remainingMilli:lotRemaining(s,l)})),uses}
}
export const stockTrace:Handler=(c,command,p)=>{
 if(!traceCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only the owner or service advisor records stock traceability.',null,403)
 if(command==='stock.catalog'){
  const item=find(c.s,'stockItem',p.itemId);expectVersion(item,p.version)
  const supersededBy=p.supersededBy?text(p.supersededBy,'replacement part'):null
  if(supersededBy){let next=find(c.s,'stockItem',supersededBy),seen=new Set([item.id]);while(next){if(seen.has(next.id))fail('SUPERSESSION_CYCLE','Supersession cannot contain a cycle.');seen.add(next.id);next=next.supersededBy?find(c.s,'stockItem',next.supersededBy):null as any}}
  const changes={name:text(p.name,'part name'),crossReferences:text(p.crossReferences,'supplier/OEM cross-references',4000,true),fitment:text(p.fitment,'declared vehicle fitment',4000,true),costCents:integer(p.costCents,'unit cost',0,100_000_000),sellCents:integer(p.sellCents,'selling price',0,100_000_000),warranty:text(p.warranty,'warranty terms',4000,true),supersededBy,by:who(c),at:c.now}
  const saved=bump(c.s,'stockItem',item,{...changes,history:[...(item.history??[]),{...item,history:undefined}]});event(c,command,null,item.id,{version:saved.version});return saved
 }
 if(command==='stock.lot'){
  const item=scan(c.s,'stockItem',p.itemBarcode),bin=scan(c.s,'stockBin',p.binBarcode),quantityMilli=amount(p.quantity),serial=text(p.serial,'serial',200,true),reference=text(p.reference,'receiving reference',200)
  if(serial&&(quantityMilli!==1000||rows(c.s,'stockLot').some(l=>l.serial.toLowerCase()===serial.toLowerCase())))fail('SERIAL_CONFLICT','A serial identifies one whole unit and must not already be received.')
  if(receiptExists(c.s,reference)||rows(c.s,'stockLot').some(l=>l.reference===reference))fail('DUPLICATE','This receiving reference was already recorded.')
  const purchaseReceipt=p.purchaseReceiptId?find(c.s,'purchaseReceipt',p.purchaseReceiptId):null,purchase=purchaseReceipt?find(c.s,'purchaseOrder',purchaseReceipt.purchaseId):null
  if(purchaseReceipt&&(purchaseReceipt.itemId!==item.id||purchaseReceipt.binId!==bin.id||purchase!.supplier!==p.supplier||purchase!.lines.find((l:any)=>l.id===purchaseReceipt.lineId)?.unitCents!==p.unitCostCents||rows(c.s,'stockLot').filter(l=>l.purchaseReceiptId===purchaseReceipt.id&&!l.parentLotId).reduce((n,l)=>n+l.quantityMilli,0)+quantityMilli>purchaseReceipt.quantityMilli))fail('LOT_SCOPE','Identify only untraced physically received PO quantities in the same part, bin and supplier.')
  const lot=put(c.s,'stockLot',{itemId:item.id,binId:bin.id,quantityMilli,serial,reference,...(purchaseReceipt?{purchaseReceiptId:purchaseReceipt.id,purchaseId:purchase!.id}:{}),supplier:text(p.supplier,'supplier'),supplierLot:text(p.supplierLot,'supplier lot',200),unitCostCents:integer(p.unitCostCents,'received unit cost',0,100_000_000),evidence:text(p.evidence,'supplier provenance',4000),catalog:structuredClone(item),by:who(c),at:c.now})
  if(purchaseReceipt){event(c,command,null,lot.id,{purchaseReceiptId:purchaseReceipt.id,quantityMilli});return lot}
  const receipt=put(c.s,'stockReceipt',{itemId:item.id,binId:bin.id,reference,expectedMilli:quantityMilli,quantityMilli,shortageMilli:0,lotId:lot.id,reason:lot.evidence,by:who(c),at:c.now})
  moveStock(c,item.id,bin.id,quantityMilli,{kind:'receipt',id:receipt.id,lotId:lot.id},lot.evidence);event(c,command,null,lot.id,{receiptId:receipt.id,quantityMilli});return lot
 }
 const job=openJob(c,p),actual=job.actuals.find((a:any)=>a.id===p.actualId),lot=find(c.s,'stockLot',p.lotId),quantityMilli=amount(p.quantity),reference=text(p.reference,'trace reference',200)
 if(!actual||actual.kind!=='part')fail('NOT_AUTHORISED','Choose recorded customer-authorized part work on this repair.')
 if(rows(c.s,'stockUse').some(u=>u.reference===reference))fail('DUPLICATE','This trace reference is already retained.')
 const used=rows(c.s,'stockUse').filter(u=>u.jobId===job.id&&u.actualId===actual.id).reduce((n,u)=>n+u.quantityMilli,0)
 if(used+quantityMilli>actual.quantityMilli)fail('QUANTITY_EXCEEDED','Lot usage cannot exceed this authorized actual quantity.')
 if(lot.serial&&quantityMilli!==1000)fail('SERIAL_CONFLICT','Consume a serial as one whole unit.')
 if(quantityMilli>lotRemaining(c.s,lot))fail('LOT_SHORTAGE','This lot has insufficient remaining quantity.')
 if(stockBalance(c.s,lot.itemId,lot.binId).availableMilli<quantityMilli)fail('STOCK_SHORTAGE','Release this repair’s reservation before recording lot usage; other repairs’ reserved stock is protected.')
 const costCents=Number((BigInt(quantityMilli)*BigInt(lot.unitCostCents)+500n)/1000n),use=put(c.s,'stockUse',{jobId:job.id,assetId:job.assetId,actualId:actual.id,estimateId:actual.estimateId,revision:actual.revision,lineId:actual.lineId,lotId:lot.id,itemId:lot.itemId,binId:lot.binId,quantityMilli,costCents,unitCostCents:lot.unitCostCents,reference,reason:text(p.reason,'part and lot identification evidence',2000),by:who(c),at:c.now})
 moveStock(c,lot.itemId,lot.binId,-quantityMilli,{kind:'use',id:use.id,lotId:lot.id},use.reason);event(c,command,job.id,use.id,{lotId:lot.id,quantityMilli});return use
}
