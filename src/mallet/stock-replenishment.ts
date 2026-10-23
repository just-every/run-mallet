import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State,type Row} from './model'
import {amount,stockBalance} from './inventory'
import {purchaseStatus,purchasing} from './purchasing'
import {instant} from './workshop'
export const replenishmentCommands=['stock.replenishment','stock.replenish']
// Unlocated legacy orders are allocated once, in stable bin order. Repair POs are
// already demand-specific and must not subsidize general stock replenishment.
export function replenishmentReport(s:State,excludePurchaseId?:string):Row[]{
 const policies=[...rows(s,'stockReplenishment')].sort((a,b)=>a.binId.localeCompare(b.binId)||a.id.localeCompare(b.id)),unlocated=new Map<string,number>()
 const incoming=new Map<string,number>()
 for(const po of rows(s,'purchaseOrder')){
  if(po.id===excludePurchaseId||po.closed||po.status==='superseded'||!po.approval&&!po.replenishmentId)continue
  for(const line of purchaseStatus(s,po).lines){if(line.jobId)continue;const key=po.binId?line.itemId+'\0'+po.binId:line.itemId,map=po.binId?incoming:unlocated;map.set(key,(map.get(key)??0)+line.backorderMilli)}
 }
 return policies.map(policy=>{
  const balance=stockBalance(s,policy.itemId,policy.binId),legacy=Math.min(unlocated.get(policy.itemId)??0,Math.max(0,policy.maxMilli+policy.demandMilli-balance.availableMilli))
  unlocated.set(policy.itemId,(unlocated.get(policy.itemId)??0)-legacy)
  const openOrderMilli=(incoming.get(policy.itemId+'\0'+policy.binId)??0)+legacy,projectedMilli=balance.availableMilli+openOrderMilli-policy.demandMilli,low=projectedMilli<policy.minMilli
  return {...policy,...balance,openOrderMilli,projectedMilli,low,suggestedMilli:low?Math.max(0,policy.maxMilli-projectedMilli):0}
 })
}
export function assertReplenishment(s:State,po:Row){
 if(!po.replenishmentId)return
 const current=replenishmentReport(s,po.id).find(r=>r.id===po.replenishmentId)
 if(!current||current.version!==po.policyVersion||current.suggestedMilli!==po.lines[0].quantityMilli||!current.suggestedMilli)fail('STALE_REPLENISHMENT','Stock, demand, policy or outstanding orders changed. Run replenishment and review the refreshed draft.')
}
export const replenishment:Handler=(c,command,p)=>{
 if(!replenishmentCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','Only owner and admin operators manage replenishment.',null,403)
 if(command==='stock.replenishment'){
  const item=find(c.s,'stockItem',p.itemId),bin=find(c.s,'stockBin',p.binId),existing=rows(c.s,'stockReplenishment').find(r=>r.itemId===item.id&&r.binId===bin.id)
  if(existing)expectVersion(existing,p.version)
  const minMilli=amount(p.minimum,'minimum',true),maxMilli=amount(p.maximum,'maximum'),demandMilli=amount(p.demand,'additional unreserved demand',true)
  if(minMilli>maxMilli)fail('INPUT','Maximum must be at least minimum.',null,400)
  const value={itemId:item.id,binId:bin.id,minMilli,maxMilli,demandMilli,supplier:text(p.supplier,'preferred supplier'),unitCents:integer(p.unitCents,'unit cost',0,100_000_000),shipTo:text(p.shipTo,'ship-to',2000),expectedAt:instant(p.expectedAt,'expected date'),by:who(c),at:c.now}
  const saved=existing?bump(c.s,'stockReplenishment',existing,{...value,history:[...(existing.history??[]),{...existing,history:undefined}]}):put(c.s,'stockReplenishment',value)
  event(c,command,null,saved.id,{minMilli,maxMilli,demandMilli});return saved
 }
 const results=[]
 for(const policy of [...rows(c.s,'stockReplenishment')].sort((a,b)=>a.binId.localeCompare(b.binId)||a.id.localeCompare(b.id))){
  const draft=rows(c.s,'purchaseOrder').find(po=>po.replenishmentId===policy.id&&po.status==='draft'),need=replenishmentReport(c.s,draft?.id).find(r=>r.id===policy.id)!
  if(!need.suggestedMilli){if(draft)bump(c.s,'purchaseOrder',draft,{status:'superseded'});continue}
  if(draft&&draft.policyVersion===policy.version&&draft.lines[0].quantityMilli===need.suggestedMilli){results.push(draft);continue}
  if(draft)bump(c.s,'purchaseOrder',draft,{status:'superseded'})
  const po=purchasing(c,'purchase.create',{reference:'Replenishment '+crypto.randomUUID(),supplier:policy.supplier,shipTo:policy.shipTo,expectedAt:policy.expectedAt,taxCents:0,freightCents:0,binId:policy.binId,lines:[{itemId:policy.itemId,quantity:need.suggestedMilli/1000,unitCents:policy.unitCents}]})
  po.replenishmentId=policy.id;po.policyVersion=policy.version;po.calculation={availableMilli:need.availableMilli,openOrderMilli:need.openOrderMilli,demandMilli:need.demandMilli,minMilli:need.minMilli,maxMilli:need.maxMilli}
  results.push(po)
 }
 event(c,command,null,c.actor.id,{draftIds:results.map(r=>r.id)});return {drafts:results,placed:false}
}
