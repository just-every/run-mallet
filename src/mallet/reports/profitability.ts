import {fail,rows,type Row,type State} from '../model'
import {price} from '../money'
import {authorizedCap,jobEstimates} from '../supplement-scope'
import {period} from './technicians'
import {lineKey,repairCosts} from './profit-sources'
import {allocate,margin,round,sum,type ProfitLine,type SupplierShare} from './profit-money'
import {costRateHistory} from './cost-rates'

function repairProfit(s:State,job:Row,now:string){
 const sublets=rows(s,'sublet').filter(r=>r.jobId===job.id),invoice=rows(s,'invoice').find(i=>i.jobId===job.id&&['approved','exported'].includes(i.status)&&i.approval)
 const credits=invoice?rows(s,'creditNote').filter(n=>n.invoiceId===invoice.id):[]
 const lines:ProfitLine[]=jobEstimates(s,job).flatMap(q=>{
  const rev=q.revisions.find((r:any)=>r.n===q.authorisation?.revision)
  if(!rev)return []
  return rev.lines.filter((l:any)=>q.authorisation.lineIds.includes(l.id)).map((l:any)=>{
   const quantityMilli=authorizedCap(s,q,l),scope=sublets.flatMap(r=>r.scopes).find((x:any)=>x.estimateId===q.id&&x.revision===rev.n&&x.lineId===l.id)
   const billed=invoice?.lines.filter((i:any)=>i.id===l.id&&i.sourceEstimateId===q.id&&i.sourceRevision===rev.n)??[]
   const credited=credits.flatMap(n=>n.lines).filter((i:any)=>i.lineId===l.id&&i.sourceEstimateId===q.id&&i.sourceRevision===rev.n)
   const uses=rows(s,'stockUse').filter(u=>u.jobId===job.id&&u.estimateId===q.id&&u.revision===rev.n&&u.lineId===l.id)
   const suppliers=new Set<string>(uses.map(u=>rows(s,'stockLot').find(lot=>lot.id===u.lotId)?.supplier).filter(Boolean))
   for(const sublet of sublets)if(sublet.scopes.some((x:any)=>x.estimateId===q.id&&x.revision===rev.n&&x.lineId===l.id))suppliers.add(sublet.supplier)
   const core=rows(s,'stockCore').find(c=>c.jobId===job.id&&c.lineId===l.id)
   if(core)suppliers.add(core.supplier)
   const supplier=suppliers.size===1?[...suppliers][0] as string:l.kind==='labor'?'No supplier':'Unattributed sales'
   const shares=new Map<string,SupplierShare>(),share=(supplier:string)=>{if(!shares.has(supplier))shares.set(supplier,{supplier,estimatedWeight:0,realizedWeight:0,stockUseIds:[]});return shares.get(supplier)!}
   if(l.kind==='part'&&!scope){
    for(const use of uses){const b=share(rows(s,'stockLot').find(lot=>lot.id===use.lotId)?.supplier??'Unattributed sales');b.estimatedWeight+=use.quantityMilli;b.realizedWeight+=use.quantityMilli-sum((use.returns??[]).map((r:any)=>r.quantityMilli));b.stockUseIds.push(use.id)}
    const realizedQuantity=sum(billed.map((i:any)=>i.quantityMilli))-sum(credited.map((i:any)=>i.quantityMilli))
    share('Unattributed sales').estimatedWeight+=Math.max(0,quantityMilli-sum([...shares.values()].map(b=>b.estimatedWeight)))
    share('Unattributed sales').realizedWeight+=Math.max(0,realizedQuantity-sum([...shares.values()].map(b=>b.realizedWeight)))
   }else{const b=share(supplier);b.estimatedWeight=1;b.realizedWeight=1}
   const supplierShares=[...shares.values()].filter(b=>b.estimatedWeight||b.realizedWeight).sort((a,b)=>a.supplier.localeCompare(b.supplier))
   if(!supplierShares.length)supplierShares.push({supplier,estimatedWeight:1,realizedWeight:1,stockUseIds:[]})
   const servicePackage=rev.inspectionSource?.pricedRecipe??null,service=servicePackage?servicePackage.snapshot.name+' · revision '+servicePackage.revision:l.description
   return {key:lineKey(q.id,rev.n,l.id),estimateId:q.id,revision:rev.n,lineId:l.id,description:l.description,service,servicePackage,category:scope?'sublet':l.kind,supplier,supplierShares,quantityMilli,
    estimatedRevenueCents:price({...l,quantityMilli}).subtotalCents,estimatedCostCents:scope?scope.costCents:l.costCents===undefined?(l.kind==='fee'?0:null):round(l.costCents*quantityMilli,1000),
    realizedRevenueCents:sum(billed.map((i:any)=>i.subtotalCents))-sum(credited.map((i:any)=>i.subtotalCents))}
  })
 })
 const costs=repairCosts(s,job,lines,now),estimatedMissing=lines.filter(l=>l.quantityMilli>0&&l.estimatedCostCents===null).map(l=>'Missing estimated cost for '+l.description)
 const estimated=margin(sum(lines.map(l=>l.estimatedRevenueCents)),estimatedMissing.length?null:sum(lines.map(l=>l.estimatedCostCents??0)))
 const realized=margin(sum(lines.map(l=>l.realizedRevenueCents)),costs.missing.length?null:sum(costs.events.map(e=>e.amountCents)))
 // An unapproved invoice cannot establish realized revenue or profit.
 if(!invoice){realized.grossProfitCents=null;realized.marginBps=null}
 return {jobId:job.id,jobUrl:'/app/jobs/'+encodeURIComponent(job.id),title:job.title,createdAt:job.createdAt,completedAt:job.completedAt??null,technicianId:job.technicianId,advisor:job.bookedBy,invoice:invoice?{id:invoice.id,number:invoice.number,status:invoice.status}:null,
  estimated,realized,estimatedMissing,missing:[...costs.missing,...(!invoice?['No approved invoice']:[])],lines,costEvents:costs.events,
  credits:credits.map(n=>({id:n.id,at:n.at,subtotalCents:n.totals.subtotalCents,lines:n.lines,refunds:rows(s,'refund').filter(r=>r.creditNoteId===n.id).map(r=>({id:r.id,status:r.redirect?.status??r.status,amountCents:r.amountCents}))}))}
}
type Repair=ReturnType<typeof repairProfit>
function groups(repairs:Repair[],dimension:'category'|'technician'|'advisor'|'service'|'supplier'){
 const buckets=new Map<string,{estimatedRevenue:number;estimatedCost:number;realizedRevenue:number;cost:number;estimatedMissing:boolean;missing:boolean;jobIds:Set<string>}>()
 const bucket=(key:string)=>{if(!buckets.has(key))buckets.set(key,{estimatedRevenue:0,estimatedCost:0,realizedRevenue:0,cost:0,estimatedMissing:false,missing:false,jobIds:new Set()});return buckets.get(key)!}
 for(const r of repairs){
  const key=(l:{category:string;description?:string;service?:string;technicianId?:string;supplier?:string})=>dimension==='advisor'?(r.advisor?.id??'Unknown advisor'):dimension==='technician'?(l.technicianId??r.technicianId):dimension==='category'?l.category:dimension==='service'?(l.service??l.description??'Unallocated'):l.supplier??'Unattributed sales'
  for(const line of r.lines){
   const shares=dimension==='supplier'?line.supplierShares:[{supplier:key(line),estimatedWeight:1,realizedWeight:1}]
   const estimatedSales=allocate(line.estimatedRevenueCents,shares.map(s=>s.estimatedWeight)),estimatedCosts=allocate(line.estimatedCostCents??0,shares.map(s=>s.estimatedWeight)),realizedSales=allocate(line.realizedRevenueCents,shares.map(s=>s.realizedWeight))
   shares.forEach((share,i)=>{const b=bucket(share.supplier);b.estimatedRevenue+=estimatedSales[i];b.estimatedCost+=estimatedCosts[i];b.realizedRevenue+=realizedSales[i];b.estimatedMissing ||= line.estimatedCostCents===null&&line.quantityMilli>0;b.missing ||= r.missing.length>0;b.jobIds.add(r.jobId)})
  }
  for(const e of r.costEvents){const b=bucket(key(e));b.cost+=e.amountCents;b.missing ||= r.missing.length>0;b.jobIds.add(r.jobId)}
 }
 return [...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([key,b])=>({key,estimated:margin(b.estimatedRevenue,b.estimatedMissing?null:b.estimatedCost),realized:margin(b.realizedRevenue,b.missing?null:b.cost),jobIds:[...b.jobIds]}))
}
export function profitabilityReport(s:State,params:URLSearchParams,now=new Date().toISOString()){
 for(const key of params.keys())if(!['from','to','format'].includes(key)||params.getAll(key).length!==1)fail('INPUT','Unsupported or repeated profitability filter.',null,400)
 for(const key of ['from','to']){const value=params.get(key);if(value!==null&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))fail('INPUT','Choose real UTC calendar dates.',null,400)}
 const range=period(params.get('from'),params.get('to'),now)
 const repairs=rows(s,'job').filter(j=>j.createdAt>=range.from&&j.createdAt<new Date(range.endMs).toISOString()).map(j=>repairProfit(s,j,now))
 const warrantyAdjusted=repairs.map(r=>{
  const cases=rows(s,'warranty').filter(w=>w.originalJobId===r.jobId),ids=[...new Set(cases.map(w=>w.jobId))]
  const comebacks=ids.map(id=>{const j=rows(s,'job').find(j=>j.id===id)!;return repairProfit(s,j,now)})
  const netReworkCostCents=comebacks.some(c=>c.realized.costCents===null)?null:sum(comebacks.map(c=>(c.realized.costCents??0)-c.realized.revenueCents))
  return {jobId:r.jobId,comebackJobIds:ids,netReworkCostCents,grossProfitCents:r.realized.grossProfitCents===null||netReworkCostCents===null?null:r.realized.grossProfitCents-netReworkCostCents}
 })
 const incomplete=repairs.some(r=>r.missing.length>0),estimatedIncomplete=repairs.some(r=>r.estimatedMissing.length>0)
 return {schema:'mallet-profitability-v1',currency:'USD',period:{from:range.from,to:range.to,timeZone:'UTC'},location:'installation',
  definitions:{cohort:'Repairs booked in inclusive UTC dates. Current retained outcomes and later adjustments are included as of this read. Draft invoices do not establish realized profit.',estimated:'Current customer-authorized scope after accepted replacements. Discounted pretax revenue less explicit unit cost snapshots; sublet quoted scope costs are totals. Missing costs are unavailable, never zero.',realized:'Approved invoice pretax lines less issued credit notes once, regardless of refund completion. Costs are consumed lot cents plus reconciled purchase freight and supplier tax allocated by received value and net consumed quantities, less cumulative saleable returns and reconciled supplier credits, current sublet bills and stopped job timers at owner-declared loaded hourly cost on timer start date. Loaded cost includes the owner-declared burden; payroll wages and idle attendance are separate.',allocation:'Advisor is the booking recorder. Non-timer values use the current lead technician; timed costs use the timer owner. Service uses the retained priced package revision when present, otherwise the exact line description. Supplier costs retain their supplier. Part sales and estimated costs are apportioned by linked consumed quantities; realized sales use quantities net of saleable returns. Untraced quantities remain unattributed. Sublet and core sales use their linked supplier.',warranty:'Explicit warranty costs replace stock and timer costs for their actual quantities. Only recorded credited claim outcomes reduce cost. Original-repair adjusted profit includes linked comeback net cost; cohort totals count each repair once. Unreconciled overlapping RMA and warranty recoveries make cost unavailable.',limitations:'Single installation only; location comparison requires SHOP-001. No cash settlement, accounting posting or migrated-history completeness is claimed. Unmatched purchase bills make purchase-linked costs unavailable. Package attribution requires a retained priced package snapshot; missing historical links are never inferred.'},
  estimated:margin(sum(repairs.map(r=>r.estimated.revenueCents)),estimatedIncomplete?null:sum(repairs.map(r=>r.estimated.costCents??0))),realized:margin(sum(repairs.map(r=>r.realized.revenueCents)),incomplete?null:sum(repairs.map(r=>r.realized.costCents??0))),repairs,warrantyAdjusted,rateHistory:costRateHistory(s),
  groups:Object.fromEntries((['category','technician','advisor','service','supplier'] as const).map(d=>[d,groups(repairs,d)]))}
}
export type ProfitabilityReport=ReturnType<typeof profitabilityReport>
