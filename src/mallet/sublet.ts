// Outsourced work uses exact existing estimate decisions; these records add no second charge.
import {bump,event,expectVersion,fail,find,integer,put,rows,text,who,type Context,type Handler,type Row,type State} from './model'
import {instant,openJob} from './workshop'
import {authorizedCap,estimateForWork} from './supplement-scope'
import {price} from './money'

export const subletCommands=['sublet.record','sublet.addScope','sublet.send','sublet.delay','sublet.bill','sublet.receive'] as const
export const jobSublets=(s:State,jobId:string)=>(s.records.sublet??[]).filter(r=>r.jobId===jobId)
export const subletBill=(r:Row)=>r.bills.at(-1)?.scopeCount===r.scopes.length?r.bills.at(-1):null
export function subletMargin(r:Row){
 const customerCents=r.scopes.reduce((n:number,x:any)=>n+x.charge.subtotalCents,0),salesTaxCents=r.scopes.reduce((n:number,x:any)=>n+x.charge.salesTaxCents,0),quotedCostCents=r.scopes.reduce((n:number,x:any)=>n+x.costCents,0),bill=subletBill(r)
 return {customerCents,salesTaxCents,totalCents:customerCents+salesTaxCents,quotedCostCents,billCents:bill?.costCents??null,marginCents:bill?customerCents-bill.costCents:null,marginPercent:bill&&customerCents?Math.round((customerCents-bill.costCents)*10000/customerCents)/100:null}
}
export function assertSubletsReceived(s:State,job:Row){
 const pending=jobSublets(s,job.id).filter(r=>!r.receipt)
 if(pending.length)fail('SUBLET_CUSTODY','Receive outsourced work back into shop custody before quality clearance, completion, billing or collection.',{subletIds:pending.map(r=>r.id)})
}
export function assertSubletsReady(s:State,job:Row){
 assertSubletsReceived(s,job)
 for(const r of jobSublets(s,job.id)){
  if(!subletBill(r))fail('SUBLET_BILL','Record the supplier bill for all approved sublet scope before completion and billing.',{subletId:r.id})
  for(const scope of r.scopes){
   const used=job.actuals.filter((a:any)=>a.estimateId===scope.estimateId&&a.revision===scope.revision&&a.lineId===scope.lineId).reduce((n:number,a:any)=>n+a.quantityMilli,0)
   if(used!==scope.charge.quantityMilli)fail('SUBLET_WORK','Record the received, authorized outsourced service as actual work before completion.',{subletId:r.id,lineId:scope.lineId})
  }
 }
}
export function subletScopeChoices(s:State,job:Row){
 // A linked service has its own explicit fee tax treatment, frozen by the estimate door.
 const linked=jobSublets(s,job.id).flatMap(r=>r.scopes)
 return (s.records.estimate??[]).filter(q=>q.jobId===job.id&&q.status==='authorised'&&q.revisions.at(-1).approval&&q.authorisation?.revision===q.revisions.at(-1).n).flatMap(q=>q.revisions.at(-1).lines.filter((l:any)=>l.kind==='fee'&&q.authorisation.lineIds.includes(l.id)&&authorizedCap(s,q,l)===l.quantityMilli&&!job.actuals.some((a:any)=>a.estimateId===q.id&&a.revision===q.revisions.at(-1).n&&a.lineId===l.id)&&!linked.some((x:any)=>x.estimateId===q.id&&x.revision===q.revisions.at(-1).n&&x.lineId===l.id)).map((l:any)=>({estimateId:q.id,revision:q.revisions.at(-1).n,lineId:l.id,line:l})))
}
function scope(c:Context,job:Row,p:any){
 const {estimate,rev}=estimateForWork(c.s,job,p),line=rev.lines.find((l:any)=>l.id===p.lineId)
 if(!line||!subletScopeChoices(c.s,job).some(x=>x.estimateId===estimate.id&&x.revision===rev.n&&x.lineId===line.id))fail('SUBLET_SCOPE','Choose an unused, unreplaced, customer-authorized service fee on this repair. Use a separately approved supplement for added scope.')
 return {estimateId:estimate.id,revision:rev.n,lineId:line.id,charge:structuredClone({...line,...price(line)}),approval:structuredClone(rev.approval),customerDecision:structuredClone(estimate.authorisation),costCents:integer(p.costCents,'quoted supplier cost in USD cents'),reason:text(p.reason,'scope reason',2000),by:who(c),at:c.now}
}
const eta=(c:Context,p:any)=>({eta:instant(p.eta,'supplier ETA'),evidence:text(p.evidence,'supplier ETA evidence',2000),reason:text(p.reason,'reason',2000),by:who(c),at:c.now})
function observed(c:Context,value:any,label:string,after?:string){
 const at=instant(value,label)
 if(at>c.now||after&&at<after)fail('INPUT',`${label} must be no later than now and no earlier than the preceding custody handoff.`,null,400)
 return at
}
function save(c:Context,command:string,job:Row,r:Row,changes:any,data:any){
 const next=bump(c.s,'sublet',r,changes)
 bump(c.s,'job',job,{subletRevision:(job.subletRevision??0)+1})
 event(c,command,job.id,r.id,data)
 return next
}
export const sublets:Handler=(c,command,p)=>{
 if(!(subletCommands as readonly string[]).includes(command))return
 const job=openJob(c,p)
 if(command==='sublet.record'){
  const approved=scope(c,job,p),schedule=eta(c,p)
  const supplier=text(p.supplier,'supplier',200),poReference=text(p.poReference,'sublet PO reference',200)
  if(rows(c.s,'sublet').some(r=>r.supplier.toLowerCase()===supplier.toLowerCase()&&r.poReference.toLowerCase()===poReference.toLowerCase()))fail('SUBLET_PO','This supplier PO is already linked to a sublet. Add scope to that record instead.')
  const row=put(c.s,'sublet',{jobId:job.id,supplier,poReference,item:text(p.item,'item in custody',500),scopes:[approved],etaHistory:[schedule],custody:[{kind:'shop',custodian:text(p.custodian,'shop custodian',200),reference:approved.reason,by:who(c),at:c.now}],bills:[],receipt:null})
  bump(c.s,'job',job,{subletRevision:(job.subletRevision??0)+1})
  event(c,command,job.id,row.id,{supplier,poReference,scope:approved});return row
 }
 const r=find(c.s,'sublet',p.subletId);expectVersion(r,p.subletVersion)
 if(r.jobId!==job.id)fail('SUBLET_SCOPE','Use a sublet belonging to this repair.')
 if(command==='sublet.bill'){
  if(!r.custody.some((x:any)=>x.kind==='sent'))fail('SUBLET_CUSTODY','Record the outside handoff before the supplier bill.')
  const reference=text(p.billReference,'supplier invoice number',200),reason=text(p.reason,'bill reason',2000),evidence=text(p.evidence,'supplier bill evidence',2000),costCents=integer(p.costCents,'supplier bill cost in USD cents')
  if(rows(c.s,'sublet').some(x=>x.id!==r.id&&x.supplier.toLowerCase()===r.supplier.toLowerCase()&&x.bills.some((b:any)=>b.reference.toLowerCase()===reference.toLowerCase())))fail('SUBLET_BILL_DUPLICATE','That supplier invoice number is already linked to another sublet.')
  if(subletBill(r)?.reference===reference&&subletBill(r)?.costCents===costCents)fail('SUBLET_BILL_DUPLICATE','This exact supplier bill is already recorded.')
  const bill={n:r.bills.length+1,scopeCount:r.scopes.length,reference,costCents,evidence,reason,by:who(c),at:c.now}
  return save(c,command,job,r,{bills:[...r.bills,bill]},bill)
 }
 if(r.receipt)fail('SUBLET_RECEIVED','The receipt is immutable; book a new sublet for later outsourced work.')
 if(command==='sublet.addScope'){
  const approved=scope(c,job,p)
  return save(c,command,job,r,{scopes:[...r.scopes,approved]},{scope:approved})
 }
 if(command==='sublet.delay'){
  const schedule=eta(c,p)
  if(schedule.eta===r.etaHistory.at(-1).eta)fail('SUBLET_ETA','The supplier ETA has not changed.')
  return save(c,command,job,r,{etaHistory:[...r.etaHistory,schedule]},schedule)
 }
 if(command==='sublet.send'){
  if(r.custody.some((x:any)=>x.kind==='sent'))fail('SUBLET_CUSTODY','This sublet is already in outside custody.')
  const handoff={kind:'sent',custodian:r.supplier,handedTo:text(p.handedTo,'outside receiver',200),reference:text(p.reference,'dispatch reference',2000),observedAt:observed(c,p.observedAt,'outside handoff time'),by:who(c),at:c.now}
  return save(c,command,job,r,{custody:[...r.custody,handoff]},handoff)
 }
 const sent=r.custody.find((x:any)=>x.kind==='sent')
 if(!sent)fail('SUBLET_CUSTODY','Record dispatch into outside custody before receiving it back.')
 const receipt={kind:'received',custodian:text(p.custodian,'receiving shop custodian',200),handedBy:text(p.handedBy,'returning supplier or carrier',200),reference:text(p.reference,'receiving evidence',2000),observedAt:observed(c,p.observedAt,'physical receipt time',sent.observedAt),scopeCount:r.scopes.length,by:who(c),at:c.now}
 return save(c,command,job,r,{receipt,custody:[...r.custody,receipt]},receipt)
}
