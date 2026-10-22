import {bump,event,expectVersion,fail,find,integer,object,put,rows,text,who,type Handler,type Row,type State} from './model'
import {amount,moveStock,receiptExists,reserveStock,scan} from './inventory'
import {instant} from './workshop'
export const purchasingCommands=['purchase.create','purchase.approve','purchase.receive','purchase.bill','purchase.shortClose','purchase.close']
const cents=(v:unknown,label:string)=>integer(v,label,0,100_000_000)
const lineCost=(line:any)=>Math.round(line.quantityMilli*line.unitCents/1000)
export function purchaseStatus(s:State,po:Row){
 const receipts=rows(s,'purchaseReceipt').filter(r=>r.purchaseId===po.id),bills=rows(s,'purchaseBill').filter(b=>b.purchaseId===po.id).sort((a,b)=>a.sequence-b.sequence)
 const lines=po.lines.map((line:any)=>{
  const receivedMilli=receipts.filter(r=>r.lineId===line.id).reduce((n,r)=>n+r.quantityMilli,0),shortClosedMilli=po.shortClose?.lines.find((l:any)=>l.lineId===line.id)?.shortClosedMilli??0,effectiveQuantityMilli=line.quantityMilli-shortClosedMilli
  return {...line,receivedMilli,shortClosedMilli,effectiveQuantityMilli,backorderMilli:effectiveQuantityMilli-receivedMilli}
 })
 return {lines,receipts,bills,currentBill:bills.at(-1)??null,fullyReceived:lines.every((l:any)=>l.receivedMilli===l.quantityMilli),fullyResolved:lines.every((l:any)=>l.backorderMilli===0)}
}
export const purchasing:Handler=(c,command,p)=>{
 if(!purchasingCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only owner and admin operators manage purchase orders.',null,403)
 if(command==='purchase.create'){
  if(!Array.isArray(p.lines)||!p.lines.length||p.lines.length>50)fail('INPUT','A purchase order needs 1–50 lines.',null,400)
  const lines=p.lines.map((v:any)=>{
   object(v,'PO line');const item=find(c.s,'stockItem',v.itemId),jobId=v.jobId?text(v.jobId,'waiting repair'):null
   if(jobId&&!['booked','working'].includes(find(c.s,'job',jobId).status))fail('JOB_STATE','Purchase repair demand only for an open repair.')
   return {id:crypto.randomUUID(),itemId:item.id,sku:item.sku,name:item.name,unit:item.unit,quantityMilli:amount(v.quantity),unitCents:cents(v.unitCents,'unit cost'),jobId}
  })
  const reference=text(p.reference,'PO reference',200)
  if(rows(c.s,'purchaseOrder').some(r=>r.reference.toLowerCase()===reference.toLowerCase()))fail('DUPLICATE','That PO reference already exists.')
  const taxCents=cents(p.taxCents,'supplier tax'),freightCents=cents(p.freightCents,'freight'),subtotalCents=lines.reduce((n:number,l:any)=>n+lineCost(l),0),totalCents=integer(subtotalCents+taxCents+freightCents,'total spend',0,1_000_000_000)
  const po=put(c.s,'purchaseOrder',{reference,supplier:text(p.supplier,'supplier'),shipTo:text(p.shipTo,'ship-to address',2000),expectedAt:instant(p.expectedAt,'expected date'),lines,subtotalCents,taxCents,freightCents,totalCents,status:'draft',approval:null,closed:null,by:who(c),at:c.now})
  event(c,command,null,po.id,{totalCents});return po
 }
 const po=find(c.s,'purchaseOrder',p.purchaseId);expectVersion(po,p.version)
 if(po.closed)fail('PO_CLOSED','This purchase order is closed; its evidence is immutable.')
 if(command==='purchase.approve'){
  if(po.status!=='draft')fail('ALREADY_APPROVED','This spend is already approved.')
  const reason=text(p.reason,'spend approval reason',2000),saved=bump(c.s,'purchaseOrder',po,{status:'approved',approval:{by:who(c),at:c.now,totalCents:po.totalCents,lines:structuredClone(po.lines),taxCents:po.taxCents,freightCents:po.freightCents,shipTo:po.shipTo,expectedAt:po.expectedAt,reason}})
  event(c,command,null,po.id,{totalCents:po.totalCents,reason});return saved
 }
 if(!po.approval)fail('NOT_APPROVED','Approve the exact PO spend before receiving or matching bills.')
 const status=purchaseStatus(c.s,po)
 if(command==='purchase.shortClose'){
  if(po.shortClose)fail('SHORT_CLOSED','Remaining quantities were already short-closed; the recorded decision is immutable.')
  if(status.fullyResolved)fail('NO_BACKORDER','There is no outstanding quantity to short-close.')
  const shortClose={id:crypto.randomUUID(),by:who(c),at:c.now,reason:text(p.reason,'short-close reason',2000),purchaseVersion:po.version,approval:structuredClone(po.approval),receiptIds:status.receipts.map(r=>r.id),lines:status.lines.map((l:any)=>({lineId:l.id,itemId:l.itemId,orderedMilli:l.quantityMilli,receivedMilli:l.receivedMilli,shortClosedMilli:l.backorderMilli}))}
  const saved=bump(c.s,'purchaseOrder',po,{status:'short-closed',shortClose});event(c,command,null,po.id,shortClose);return saved
 }
 if(command==='purchase.receive'){
  const line=status.lines.find((l:any)=>l.id===p.lineId)
  if(!line)fail('INPUT','Choose a line on this purchase order.',null,400)
  const item=scan(c.s,'stockItem',p.itemBarcode),bin=scan(c.s,'stockBin',p.binBarcode),quantityMilli=amount(p.quantity),reference=text(p.reference,'goods receipt reference',200)
  if(item.id!==line.itemId)fail('WRONG_PART','The scanned part does not match this PO line.')
  if(quantityMilli>line.backorderMilli)fail('OVER_RECEIPT','Receive only the outstanding quantity; surplus needs a separately approved PO.')
  if(receiptExists(c.s,reference))fail('DUPLICATE','That goods receipt is already retained.')
  const receipt=put(c.s,'purchaseReceipt',{purchaseId:po.id,lineId:line.id,itemId:line.itemId,binId:bin.id,quantityMilli,reference,by:who(c),at:c.now})
  moveStock(c,line.itemId,bin.id,quantityMilli,{kind:'purchaseReceipt',id:receipt.id,purchaseId:po.id},reference)
  if(line.jobId)reserveStock(c,line.itemId,bin.id,line.jobId,quantityMilli,{kind:'purchaseReceipt',id:receipt.id,purchaseId:po.id})
  bump(c.s,'purchaseOrder',po,{status:'receiving'});event(c,command,line.jobId,po.id,{receiptId:receipt.id,quantityMilli});return receipt
 }
 if(command==='purchase.bill'){
  if(!Array.isArray(p.lines)||p.lines.length!==po.lines.length)fail('INPUT','Record every supplier bill line, including zero quantity for omitted goods.',null,400)
  const seen=new Set(),lines=p.lines.map((v:any)=>{
   object(v,'bill line');const source=po.lines.find((l:any)=>l.id===v.lineId)
   if(!source||seen.has(v.lineId))fail('INPUT','Bill lines must identify each PO line exactly once.',null,400)
   seen.add(v.lineId);return {lineId:source.id,itemId:source.itemId,quantityMilli:amount(v.quantity,'billed quantity',true),unitCents:cents(v.unitCents,'billed unit cost')}
  }),taxCents=cents(p.taxCents,'bill tax'),freightCents=cents(p.freightCents,'bill freight'),exceptions:string[]=[]
  for(const line of lines){const source=status.lines.find((l:any)=>l.id===line.lineId);if(line.quantityMilli!==source.effectiveQuantityMilli||line.quantityMilli!==source.receivedMilli)exceptions.push(source.name+': billed, approved less short-closed, and received quantities differ');if(line.unitCents!==source.unitCents)exceptions.push(source.name+': billed unit cost differs from approved spend')}
  if(taxCents!==po.taxCents)exceptions.push('Supplier tax differs from approved spend')
  if(freightCents!==po.freightCents)exceptions.push('Freight differs from approved spend')
  const totalCents=integer(lines.reduce((n:number,l:any)=>n+lineCost(l),0)+taxCents+freightCents,'bill total',0,1_000_000_000)
  const bill=put(c.s,'purchaseBill',{purchaseId:po.id,sequence:status.bills.length+1,invoiceNumber:text(p.invoiceNumber,'supplier invoice number',200),lines,taxCents,freightCents,totalCents,exceptions,matched:exceptions.length===0,receiptIds:status.receipts.map(r=>r.id),shortCloseId:po.shortClose?.id??null,evidence:text(p.evidence,'supplier bill evidence',4000),by:who(c),at:c.now})
  bump(c.s,'purchaseOrder',po,{status:bill.matched?'matched':'exception'});event(c,command,null,po.id,{billId:bill.id,matched:bill.matched,exceptions});return bill
 }
 if(!status.fullyResolved)fail('BACKORDER','Outstanding backorders must be received or explicitly short-closed with a reason by owner and admin operators before closure.')
 if(!status.currentBill?.matched||status.currentBill.receiptIds.length!==status.receipts.length||(status.currentBill.shortCloseId??null)!==(po.shortClose?.id??null))fail('BILL_EXCEPTION','Match the current supplier bill to approved costs, tax/freight and all receipts after any short-close before closure.')
 const closed={by:who(c),at:c.now,billId:status.currentBill.id,reason:text(p.reason,'closure reason',2000)}
 const saved=bump(c.s,'purchaseOrder',po,{status:'closed',closed});event(c,command,null,po.id,closed);return saved
}
