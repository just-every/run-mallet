import {rows,type Row,type State} from '../model'
import {timeRange} from '../time'
import {subletBill} from '../sublet'
import {costRateOn} from './cost-rates'
import {allocate,round,sum,type CostEvent,type ProfitLine} from './profit-money'
const HOUR=3_600_000
export const lineKey=(q:string,n:number,l:string)=>JSON.stringify([q,n,l])

/** Every amount points to retained native custody. Unknown amounts never become zero costs. */
export function repairCosts(s:State,job:Row,lines:ProfitLine[],now:string){
 const events:CostEvent[]=[],missing:string[]=[],recordedWarranty=rows(s,'warranty').filter(w=>w.jobId===job.id).flatMap(w=>w.costs.map((cost:any)=>({...cost,warrantyId:w.id})))
 const manualIds=new Set(recordedWarranty.map(c=>c.actualId))
 for(const warranty of rows(s,'warranty').filter(w=>w.jobId===job.id)){
  const credited=warranty.claims.some((c:any)=>c.history.some((o:any)=>o.status==='credited'))
  if(credited&&rows(s,'stockRma').some(r=>r.warrantyId===warranty.id&&rows(s,'stockSupplierCredit').some(c=>c.sourceKind==='stockRma'&&c.sourceId===r.id)))missing.push('Reconcile overlapping RMA and warranty recovery '+warranty.id)
 }
 const lineFor=(actual:any)=>lines.find(l=>l.key===lineKey(actual.estimateId,actual.revision,actual.lineId))
 const add=(kind:string,sourceId:string,at:string,amountCents:number,line:ProfitLine|undefined,detail:any,more:Partial<CostEvent>={})=>events.push({kind,sourceId,at,amountCents,category:line?.category??'labor',service:line?.description??'Unallocated job time',supplier:'No supplier',technicianId:job.technicianId,detail,...more})
 const uses=rows(s,'stockUse').filter(u=>u.jobId===job.id)
 for(const actual of job.actuals.filter((a:any)=>a.kind==='part')){
  const line=lineFor(actual),traced=uses.filter(u=>u.actualId===actual.id)
  if(!manualIds.has(actual.id)&&sum(traced.map(u=>u.quantityMilli))!==actual.quantityMilli)missing.push('Uncosted part actual '+actual.id)
 }
 for(const use of uses){
  if(manualIds.has(use.actualId))continue
  const line=lines.find(l=>l.key===lineKey(use.estimateId,use.revision,use.lineId)),lot=rows(s,'stockLot').find(l=>l.id===use.lotId)
  add('part-use',use.id,use.at,use.costCents,line,{lotId:use.lotId,unitCostCents:use.unitCostCents,quantityMilli:use.quantityMilli,receiptReference:lot?.reference,purchaseReceiptId:lot?.purchaseReceiptId},{supplier:lot?.supplier??'Unknown supplier'})
  let returned=0,prior=0
  for(const r of use.returns??[]){returned+=r.quantityMilli;const cost=round(use.costCents*returned,use.quantityMilli);add('saleable-return',r.movementId,r.at,-(cost-prior),line,{stockUseId:use.id,reference:r.reference,quantityMilli:r.quantityMilli},{supplier:lot?.supplier??'Unknown supplier'});prior=cost}
 }
 for(const credit of rows(s,'stockSupplierCredit')){
  const source=rows(s,credit.sourceKind).find(r=>r.id===credit.sourceId),use=source?.stockUseId?uses.find(u=>u.id===source.stockUseId):null
  if(!use)continue
  const line=lines.find(l=>l.key===lineKey(use.estimateId,use.revision,use.lineId))
  add(credit.sourceKind==='stockCore'?'core-credit':'supplier-return-credit',credit.id,credit.at,-credit.amountCents,line,{sourceKind:credit.sourceKind,sourceId:credit.sourceId,stockUseId:use.id,reference:credit.reference},{supplier:credit.supplier})
 }
 for(const sublet of rows(s,'sublet').filter(r=>r.jobId===job.id)){
  const bill=subletBill(sublet)
  if(!bill){missing.push('Missing current sublet bill '+sublet.id);continue}
  const shares=allocate(bill.costCents,sublet.scopes.map((x:any)=>x.charge.quantityMilli))
  sublet.scopes.forEach((scope:any,i:number)=>add('sublet-bill',sublet.id,bill.at,shares[i],lines.find(l=>l.key===lineKey(scope.estimateId,scope.revision,scope.lineId)),{billRevision:bill.n,reference:bill.reference,scopeIndex:i,costCents:bill.costCents},{category:'sublet',supplier:sublet.supplier}))
 }
 const laborActuals=job.actuals.filter((a:any)=>a.kind==='labor'),laborLines=lines.filter(l=>l.category==='labor')
 const timers=rows(s,'timeEntry').filter(t=>t.jobId===job.id&&t.kind==='job')
 if(laborActuals.some((a:any)=>!manualIds.has(a.id))&&!timers.length)missing.push('Labor work without job timer evidence')
 for(const timer of timers){
  const range=timeRange(timer),end=range.endAt??now,ms=Math.max(0,Date.parse(end)-Date.parse(range.startAt)),rate=costRateOn(s,timer.ownerId,range.startAt.slice(0,10))
  if(!range.endAt)missing.push('Running labor timer '+timer.id)
  if(!rate){missing.push('No loaded cost rate for timer '+timer.id);continue}
  const cost=round(ms*rate.centsPerHour,HOUR),weights=laborLines.map(l=>sum(laborActuals.filter((a:any)=>lineFor(a)?.key===l.key).map((a:any)=>a.quantityMilli))),shares=allocate(cost,weights)
  if(!sum(weights)){add('labor-timer',timer.id,end,cost,undefined,{ms,rate,revisions:timer.revisions,category:timer.category},{technicianId:timer.ownerId});continue}
  laborLines.forEach((line,i)=>{
   const actuals=laborActuals.filter((a:any)=>lineFor(a)?.key===line.key),covered=actuals.filter((a:any)=>manualIds.has(a.id)),coveredQuantity=sum(covered.map((a:any)=>a.quantityMilli)),quantity=sum(actuals.map((a:any)=>a.quantityMilli))
   const retained=shares[i]-round(shares[i]*coveredQuantity,quantity)
   if(coveredQuantity<quantity)add('labor-timer',timer.id,end,retained,line,{ms,rate,revisions:timer.revisions,category:timer.category,allocatedCents:shares[i],warrantyRecordedCentsExcluded:shares[i]-retained},{technicianId:timer.ownerId})
  })
 }
 for(const cost of recordedWarranty){const actual=job.actuals.find((a:any)=>a.id===cost.actualId);add('warranty-cost',cost.id,cost.at,cost.amountCents,lineFor(actual),{warrantyId:cost.warrantyId,actualId:cost.actualId,evidence:cost.evidence})}
 for(const warranty of rows(s,'warranty').filter(w=>w.jobId===job.id))for(const claim of warranty.claims)for(const outcome of claim.history.filter((o:any)=>o.status==='credited'))add('warranty-recovery',claim.id,outcome.at,-outcome.creditCents,undefined,{warrantyId:warranty.id,reference:claim.reference,evidence:outcome.evidence},{category:'warranty',service:'Warranty recovery',supplier:claim.claimant})
 return {events,missing}
}
