import {HttpError,type Actor,type Authority} from '../auth'
import type {Row,State} from '../model'
import {migrateSalesTax} from '../tax'
import {RepairReader} from './repair-reader'
import {repairReferences} from './repair-references'

/** This graph is for a single-RO API, NOT a replacement for jobPage's installation-wide controls or command state. */
export const repairStateScope={
 intendedFor:'single-repair-api',
 limitations:[
  'No installation-wide attendance history, manager correction queue or sold-today totals.',
  'No complete dependency selector, reusable template/pricing catalog or scheduling availability population.',
  'Stock custody references are included; full stock balances and other repairs consuming the same lot are outside this graph.',
  'Media bytes and prior-visit media access require the independently authorized native media doors.',
  'Referenced visits require their own current crew scope; the caller must also apply its normal visible() projection.'
 ]
} as const

/** Indexed, version-fenced root graph. Large graphs fail explicitly rather than returning truncated evidence. */
export async function loadRepairState(db:D1Database,actor:Actor,authority:Authority,jobId:string):Promise<State>{
 if(typeof jobId!=='string'||!jobId.trim()||jobId.length>200)throw new HttpError(400,'invalid_repair')
 const reader=new RepairReader(db,actor,authority,jobId),jobs=new Set<string>(),wantedJobs=new Set([jobId]),references=new Map<string,[string,string]>(),lookedUp=new Set<string>(),lookedUpLots=new Set<string>()
 let scan:{kind:string;row:Row}[]=await reader.read("r.kind='job' AND r.id=?",[jobId])
 const root=reader.state.records.job?.find(row=>row.id===jobId)
 if(!root)throw new HttpError(404,'not_found')
 scan.push(...await reader.read("r.kind IN ('taxSettings','promiseSettings','chasePolicy')"))
 scan.push(...await reader.read("r.kind IN ('reading','serviceInterval','declinedWork','warranty') AND json_extract(r.value,'$.assetId')=?",[root.assetId]))
 // Snapshot relationship data such as original warranty and declined-work decisions remains inert.
 for(;;){
  for(const {row} of scan){const found=repairReferences(row);found.jobs.forEach(id=>wantedJobs.add(id));found.records.forEach(pair=>references.set(pair.join('\x00'),pair))}
  scan=[]
  const nextJobs=[...wantedJobs].filter(id=>!jobs.has(id))
  if(jobs.size+nextJobs.length>128)throw new HttpError(413,'repair_graph_too_large')
  if(nextJobs.length){
   nextJobs.forEach(id=>jobs.add(id))
   scan.push(...await reader.read("r.kind='job' AND r.id IN (SELECT value FROM json_each(?))",[JSON.stringify(nextJobs)]))
   const readable=(reader.state.records.job??[]).filter(j=>nextJobs.includes(j.id)).map(j=>j.id)
   if(readable.length){
    scan.push(...await reader.read("json_extract(r.value,'$.jobId') IN (SELECT value FROM json_each(?))",[JSON.stringify(readable)]))
    scan.push(...await reader.read("r.kind='warranty' AND json_extract(r.value,'$.originalJobId') IN (SELECT value FROM json_each(?))",[JSON.stringify(readable)]))
    ;(await reader.mediaSourceJobs(readable)).forEach(id=>wantedJobs.add(id))
   }
  }
  const next=[...references].filter(([key])=>!lookedUp.has(key))
  for(let i=0;i<next.length;i+=100){const batch=next.slice(i,i+100);batch.forEach(([key])=>lookedUp.add(key));scan.push(...await reader.read("(r.kind,r.id) IN (SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]') FROM json_each(?))",[JSON.stringify(batch.map(([,pair])=>pair))]))}
  const lots=(reader.state.records.stockLot??[]).map(row=>row.id).filter(id=>!lookedUpLots.has(id))
  if(lots.length){lots.forEach(id=>lookedUpLots.add(id));scan.push(...await reader.read("r.kind IN ('stockReceipt','purchaseReceipt','stockLotAdjustment') AND json_extract(r.value,'$.lotId') IN (SELECT value FROM json_each(?))",[JSON.stringify(lots)]))}
  if(!scan.length&&![...wantedJobs].some(id=>!jobs.has(id)))break
 }
 const invoices=(reader.state.records.invoice??[]).map(row=>row.id),reports=(reader.state.records.inspectionReport??[]).map(row=>row.id)
 if(invoices.length)await reader.read("json_extract(r.value,'$.invoiceId') IN (SELECT value FROM json_each(?))",[JSON.stringify(invoices)])
 if(reports.length)await reader.read("r.kind IN ('diagnosisLinkView','inspectionReportDelivery','diagnosisLink') AND json_extract(r.value,'$.reportId') IN (SELECT value FROM json_each(?))",[JSON.stringify(reports)])
 const subjects=['estimate','invoice','proposal'].flatMap(kind=>(reader.state.records[kind]??[]).map(row=>row.id))
 if(subjects.length)await reader.read("r.kind='approval' AND json_extract(r.value,'$.subjectId') IN (SELECT value FROM json_each(?))",[JSON.stringify(subjects)])
 const addresses=[...new Set((reader.state.records.asset??[]).map(row=>String(row.customerEmail??'').toLowerCase()).filter(Boolean))]
 if(addresses.length)await reader.read("r.kind='chaseOptOut' AND lower(json_extract(r.value,'$.email')) IN (SELECT value FROM json_each(?))",[JSON.stringify(addresses)])
 const state=await reader.finish();migrateSalesTax(state);return state
}
