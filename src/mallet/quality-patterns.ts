import {createHash} from 'node:crypto'
import {bump,choice,event,expectVersion,fail,find,integer,put,rows,text,who,type Handler,type State,type Row} from './model'
import {warranty,warrantyClaimable} from './warranty'
export const patternCommands=['pattern.prepare','pattern.review','pattern.approve']
const normalized=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
const key=(w:Row)=>JSON.stringify([w.installed?.itemId,normalized(w.lot?.supplier??''),normalized(w.lot?.supplierLot??w.lot?.serial??'')])
function facts(s:State,w:Row){
 const original=find(s,'job',w.originalJobId),rework=find(s,'job',w.jobId),rmas=rows(s,'stockRma').filter(r=>r.stockUseId===w.installed?.id),ids=new Set(rmas.map(r=>r.id)),jobs=new Set([original.id,rework.id])
 const supplierCredits=rows(s,'stockSupplierCredit').filter(r=>r.sourceKind==='stockRma'&&ids.has(r.sourceId)),claimableCents=warrantyClaimable(s,w)
 return {claimableCents,warranty:structuredClone(w),original:structuredClone(original),rework:structuredClone(rework),installed:w.installed?structuredClone(find(s,'stockUse',w.installed.id)):null,lot:w.lot?structuredClone(find(s,'stockLot',w.lot.id)):null,measurements:structuredClone(rows(s,'quality').filter(r=>jobs.has(r.jobId))),diagnoses:structuredClone(rows(s,'diagnosis').filter(r=>jobs.has(r.jobId))),labor:structuredClone(rows(s,'timeEntry').filter(r=>jobs.has(r.jobId))),rmas:structuredClone(rmas),supplierCredits:structuredClone(supplierCredits)}
}
const candidates=(s:State,w:Row)=>rows(s,'warranty').filter(x=>x.installed&&key(x)===key(w)).sort((a,b)=>a.id.localeCompare(b.id)).map(x=>facts(s,x))
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function patternReport(s:State){
 const traced=rows(s,'warranty').filter(w=>w.installed&&w.lot),clusters:any[]=[],seen=new Set<string>()
 for(const w of traced){
  const signature=key(w)+normalized(w.failure);if(seen.has(signature))continue;seen.add(signature)
  const related=candidates(s,w),matching=related.filter(f=>normalized(f.warranty.failure)===normalized(w.failure))
  if(new Set(matching.map(f=>f.warranty.originalJobId)).size<2)continue
  clusters.push({seedId:w.id,symptom:w.failure,supplier:w.lot.supplier,supplierLot:w.lot.supplierLot,itemId:w.installed.itemId,matchingIds:matching.map(f=>f.warranty.id),relatedIds:related.filter(f=>!matching.includes(f)).map(f=>f.warranty.id),cases:related})
 }
 return {clusters,packets:rows(s,'qualityPattern'),boundary:'Evidence association only. Technicians determine cause and safety. No diagnosis, clearance, outbound claim or corrective action is automatic.'}
}
export const qualityPatterns:Handler=(c,command,p)=>{
 if(!patternCommands.includes(command))return
 if(!['owner','admin'].includes(c.actor.role))fail('FORBIDDEN','An owner or authorized manager must review quality patterns.',null,403)
 if(command==='pattern.prepare'){
  const cluster=patternReport(c.s).clusters.find(x=>x.seedId===p.warrantyId||x.matchingIds.includes(p.warrantyId))
  if(!cluster)fail('PATTERN_CLUSTER','Two distinct original repairs with the same recorded symptom and installed supplier lot are required.')
  const row=put(c.s,'qualityPattern',{seedId:cluster.seedId,symptom:cluster.symptom,supplier:cluster.supplier,supplierLot:cluster.supplierLot,cases:cluster.cases,fingerprint:digest(cluster.cases),reviews:[],approval:null,by:who(c),at:c.now})
  event(c,command,null,row.id,{warrantyIds:cluster.cases.map((x:any)=>x.warranty.id)});return row
 }
 const packet=find(c.s,'qualityPattern',p.packetId);expectVersion(packet,p.version)
 if(packet.approval)fail('PATTERN_FINAL','Approved packets retain their exact evidence and cannot be changed.')
 const seed=find(c.s,'warranty',packet.seedId)
 if(digest(candidates(c.s,seed))!==packet.fingerprint)fail('PATTERN_STALE','Source evidence changed. Prepare and review a new packet; the old packet remains in history.')
 if(command==='pattern.review'){
  if(!packet.cases.some((x:any)=>x.warranty.id===p.warrantyId))fail('PATTERN_SCOPE','Review only an association cited by this packet.')
  const review={warrantyId:p.warrantyId,outcome:choice(p.outcome,['include','reject'],'association decision'),reason:text(p.reason,'association evidence',2000),by:who(c),at:c.now}
  const row=bump(c.s,'qualityPattern',packet,{reviews:[...packet.reviews,review]});event(c,command,null,row.id,review);return row
 }
 if(c.actor.role!=='owner'&&c.actor.staffRole!=='manager')fail('FORBIDDEN','Only the current owner or delegated manager approves a supplier claim.',null,403)
 const selected=packet.cases.filter((f:any)=>packet.reviews.findLast((r:any)=>r.warrantyId===f.warranty.id)?.outcome==='include')
 if(packet.cases.some((f:any)=>!packet.reviews.some((r:any)=>r.warrantyId===f.warranty.id))||new Set(selected.map((f:any)=>f.warranty.originalJobId)).size<2)fail('PATTERN_REVIEW','Review every candidate and retain at least two distinct original repairs before claim approval.')
 const amounts=selected.map((f:any)=>{const w=find(c.s,'warranty',f.warranty.id);if(w.decision?.outcome!=='covered'||w.decision.responsibility!=='supplier')fail('PATTERN_COVERAGE','Each included case needs an explicit supplier-responsibility coverage decision.');return {w,amountCents:facts(c.s,w).claimableCents}})
 const amountCents=amounts.reduce((n:number,x:any)=>n+x.amountCents,0)
 if(amounts.some((x:any)=>x.amountCents<=0)||integer(p.amountCents,'reviewed total claim cents',1)!==amountCents||p.confirm!==true)fail('PATTERN_CLAIM','Explicitly confirm the exact remaining recorded rework costs for every included case.')
 const reference=text(p.reference,'supplier claim reference',150),reason=text(p.reason,'manager approval evidence',2000),claims=[]
 for(const {w,amountCents} of amounts){const saved=warranty(c,'warranty.claim',{warrantyId:w.id,version:w.version,claimant:packet.supplier,reference:reference+'-'+w.id,amountCents,evidence:reason+'; cited quality packet '+packet.id});claims.push({warrantyId:w.id,claimId:saved.claims.at(-1).id,amountCents})}
 const approval={reference,reason,amountCents,claims,by:who(c),at:c.now,label:'Approved claim records only; not submitted by Mallet. No diagnosis or safety clearance.'}
 const row=bump(c.s,'qualityPattern',packet,{approval});event(c,command,null,row.id,approval);return row
}
