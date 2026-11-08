import {find,rows,type State,type Row} from './model'
const normalized=(value:string)=>value.trim().replace(/\s+/g,' ').toLowerCase()
const sameLot=(a:Row,b:Row)=>a.lot&&b.lot&&a.lot.itemId===b.lot.itemId&&normalized(a.lot.supplier)===normalized(b.lot.supplier)&&!!a.lot.supplierLot&&a.lot.supplierLot===b.lot.supplierLot
export function warrantyPacket(s:State,id:string){
 const anchor=find(s,'warranty',id)
 const candidates=rows(s,'warranty').filter(w=>w.id===anchor.id||sameLot(anchor,w)).sort((a,b)=>a.id.localeCompare(b.id))
 const evidence=candidates.map(w=>{
  const diagnoses=rows(s,'diagnosis').filter(d=>[w.originalJobId,w.jobId].includes(d.jobId)),jobs=rows(s,'job').filter(j=>[w.originalJobId,w.jobId].includes(j.id)),rmas=rows(s,'stockRma').filter(r=>r.warrantyId===w.id||r.stockUseId===w.installed?.id),credits=rows(s,'stockSupplierCredit').filter(c=>c.sourceKind==='stockRma'&&rmas.some(r=>r.id===c.sourceId))
  const sources=[{kind:'warranty',id:w.id,version:w.version},...diagnoses.map(d=>({kind:'diagnosis',id:d.id,version:d.version})),...jobs.map(j=>({kind:'job',id:j.id,version:j.version})),...rmas.map(r=>({kind:'stockRma',id:r.id,version:r.version})),...credits.map(r=>({kind:'stockSupplierCredit',id:r.id,version:r.version}))]
  const rejected=(anchor.patternReviews??[]).filter((r:any)=>r.candidateId===w.id).at(-1)?.decision==='rejected'
  return {id:w.id,version:w.version,originalJobId:w.originalJobId,jobId:w.jobId,invoiceNumber:w.originalInvoice.number,identifier:w.identifier,failure:w.failure,failureAt:w.failureAt,mileage:w.mileage,unit:w.unit,installed:w.installed,lot:w.lot,decision:w.decision,costs:w.costs,claims:w.claims,diagnoses:diagnoses.map(d=>({id:d.id,jobId:d.jobId,revision:d.revisions.at(-1)})),labor:jobs.map(j=>({jobId:j.id,label:j.id===w.originalJobId?'Original repair':'Rework repair',actuals:j.actuals.map((a:any)=>({...a,description:rows(s,'estimate').find(q=>q.id===a.estimateId)?.revisions.find((r:any)=>r.n===a.revision)?.lines.find((l:any)=>l.id===a.lineId)?.description??'Recorded work'}))})),rmas,credits,sources,rejected,matches:!rejected&&normalized(w.failure)===normalized(anchor.failure)}
 })
 const matched=evidence.filter(w=>w.matches),repeat=new Set(matched.map(w=>w.originalJobId)).size>=2
 return {anchorId:anchor.id,repeat,method:'Exact normalized symptom and same catalog item, supplier and marked lot; distinct original repairs. Correlation only.',warning:'Technicians determine cause and safety. Managers approve claims and corrective actions. No diagnosis, clearance or supplier submission is performed.',members:matched.map(w=>w.id),evidence,reviews:anchor.patternReviews??[],actions:anchor.patternActions??[],sourceKey:JSON.stringify(evidence.flatMap(w=>w.sources))}
}
