import {bump,choice,event,expectVersion,fail,find,put,rows,text,who,type Handler,type State,type Row} from './model'
import {amount,moveStock} from './inventory'
import {lotRemaining} from './stock-trace'
import {supplierCredits,recordSupplierCredit} from './supplier-credits'
import {integer} from './model'
export const rmaCommands=['stock.rmaOpen','stock.rmaAuthorize','stock.rmaShip','stock.rmaDispose','stock.rmaCredit']
export function rmaReport(s:State):Row[]{return rows(s,'stockRma').map(r=>{
 const credits=supplierCredits(s,'stockRma',r.id),creditCents=credits.reduce((n,x)=>n+x.amountCents,0),warranty=r.warrantyId?find(s,'warranty',r.warrantyId):null,reworkCostCents=warranty?warranty.costs.reduce((n:number,x:any)=>n+x.amountCents,0):0
 return {...r,credits,creditCents,creditExposureCents:r.expectedCreditCents-creditCents,quarantinedMilli:r.quantityMilli-(r.shipment?.quantityMilli??0)-(r.disposition?.quantityMilli??0),reworkCostCents,netWarrantyCostCents:reworkCostCents-creditCents}
})}
export const supplierReturns:Handler=(c,command,p)=>{
 if(!rmaCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only owner and admin operators manage supplier returns.',null,403)
 if(command==='stock.rmaOpen'){
  const lot=find(c.s,'stockLot',p.lotId),quantityMilli=amount(p.quantity),use=p.stockUseId?find(c.s,'stockUse',p.stockUseId):null,kind=choice(p.kind,['faulty','unused','warranty'],'return reason category')
  if(lot.serial&&quantityMilli!==1000)fail('SERIAL_CONFLICT','Return a complete serialized unit.')
  if(!lot.purchaseId)fail('RMA_SOURCE','Identify this lot against its original PO goods receipt before a supplier return.')
  if(use&&(use.lotId!==lot.id||quantityMilli+rows(c.s,'stockRma').filter(r=>r.stockUseId===use.id).reduce((n,r)=>n+r.quantityMilli,0)>use.quantityMilli))fail('RMA_SCOPE','Return only the remaining installed quantity from this exact lot and repair.')
  if(!use&&quantityMilli>lotRemaining(c.s,lot))fail('LOT_SHORTAGE','Return only available lot quantities; consumed parts require their original repair trace.')
  const warranty=p.warrantyId?find(c.s,'warranty',p.warrantyId):null
  if(warranty&&(!use||warranty.installed?.id!==use.id||warranty.originalJobId!==use.jobId||warranty.decision?.outcome!=='covered'))fail('RMA_WARRANTY','Choose approved warranty rework for this exact installed part.')
  const reference=text(p.reference,'supplier return reference')
  if(rows(c.s,'stockRma').some(r=>r.reference.toLowerCase()===reference.toLowerCase()))fail('DUPLICATE','That return reference already exists.')
  const row=put(c.s,'stockRma',{reference,kind,itemId:lot.itemId,binId:lot.binId,lotId:lot.id,purchaseId:lot.purchaseId,purchaseReceiptId:lot.purchaseReceiptId,stockUseId:use?.id??null,jobId:use?.jobId??null,warrantyId:warranty?.id??null,quantityMilli,supplier:lot.supplier,serial:lot.serial,supplierLot:lot.supplierLot,unitCostCents:lot.unitCostCents,originalCostCents:Number((BigInt(quantityMilli)*BigInt(lot.unitCostCents)+500n)/1000n),expectedCreditCents:integer(p.expectedCreditCents,'expected supplier credit cents',0,100_000_000),reason:text(p.reason,'supplier return reason',2000),removalEvidence:text(p.evidence,'physical removal and quarantine evidence',4000),authorization:null,shipment:null,disposition:null,by:who(c),at:c.now,label:'Physical quarantine; unavailable for sale. No supplier authorization, shipment or credit is inferred.'})
  if(!use){put(c.s,'stockLotAdjustment',{lotId:lot.id,rmaId:row.id,deltaMilli:-quantityMilli,by:who(c),at:c.now,reason:row.reason});moveStock(c,lot.itemId,lot.binId,-quantityMilli,{kind:'quarantine',id:row.id,lotId:lot.id},row.reason)}
  event(c,command,row.jobId,row.id,{quantityMilli,stockUseId:use?.id??null});return row
 }
 const rma=find(c.s,'stockRma',p.rmaId)
 if(command==='stock.rmaCredit'){
  if(!rma.shipment)fail('RMA_STATE','Retain physical shipment before reconciling supplier credit.')
  return recordSupplierCredit(c,'stockRma',rma,p)
 }
 expectVersion(rma,p.version)
 const save=(change:any)=>{const next=bump(c.s,'stockRma',rma,change);event(c,command,rma.jobId,rma.id,change);return next}
 if(command==='stock.rmaAuthorize'){
  if(rma.authorization)fail('RMA_STATE','Retain the original supplier authorization; do not overwrite it.')
  return save({authorization:{number:text(p.number,'supplier RMA number'),label:text(p.label,'supplier return label reference',2000),evidence:text(p.evidence,'external supplier authorization evidence',4000),by:who(c),at:c.now}})
 }
 if(command==='stock.rmaShip'){
  if(!rma.authorization||rma.shipment||rma.disposition)fail('RMA_STATE','Authorize the RMA before a single whole return shipment; disposed stock cannot ship.')
  return save({shipment:{quantityMilli:rma.quantityMilli,carrier:text(p.carrier,'carrier'),tracking:text(p.tracking,'tracking reference'),evidence:text(p.evidence,'physical shipment evidence',4000),by:who(c),at:c.now}})
 }
 if(rma.shipment||rma.disposition)fail('RMA_STATE','This quarantine already has a final custody disposition.')
 const outcome=choice(p.outcome,['destroyed','restocked'],'quarantine disposition'),reason=text(p.reason,'disposition reason',2000)
 // A removed installed failure can never become available stock by a flag.
 if(outcome==='restocked'&&rma.stockUseId)fail('RMA_STATE','A failed installed part cannot return to saleable stock. Retain or destroy it, or ship an authorized RMA.')
 if(outcome==='restocked'){
  put(c.s,'stockLotAdjustment',{lotId:rma.lotId,rmaId:rma.id,deltaMilli:rma.quantityMilli,by:who(c),at:c.now,reason})
  moveStock(c,rma.itemId,rma.binId,rma.quantityMilli,{kind:'quarantineRelease',id:rma.id,lotId:rma.lotId},reason)
 }
 return save({disposition:{outcome,quantityMilli:rma.quantityMilli,reason,evidence:text(p.evidence,'disposition inspection or destruction evidence',4000),by:who(c),at:c.now}})
}
