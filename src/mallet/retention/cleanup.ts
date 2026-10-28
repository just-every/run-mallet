import {eraseMailboxRecords,type MailboxRecords} from './mailboxes'
import {privateBlockerRecord} from '../repair-blocker-privacy'
import {eraseCoverageContent} from './coverage'
import {eraseReviewFeedback} from './reviews'
import type {Row,State} from '../model'
import {rows} from '../model'
import {write,type CustomerScope} from './store'
import type {ErasurePlan,MediaInventory} from './plans'
import type {Sql} from '../media/types'

export function erasedAsset(asset:Row,at:string):Row{
 return {id:asset.id,version:asset.version+1,label:asset.label,identifier:asset.identifier,visits:asset.visits??[],createdAt:asset.createdAt,customerAccountId:asset.customerAccountId,customerName:'Erased customer',customerEmail:'',driverContactId:null,privacyErasedAt:at,updatedAt:at}
}
export function personalCleanup(state:State,scope:CustomerScope,at:string,mailboxes:MailboxRecords){
 const queries:Sql[]=[],counts={accounts:0,contacts:0,sharedContactsRetained:0}
 for(const a of scope.accounts){
  queries.push(write('customerAccount',{id:a.id,version:a.version+1,name:'Erased customer',kind:a.kind,contactIds:a.contactIds??[],payerId:a.payerId,billingContactId:a.billingContactId,driverId:null,authorizerId:null,taxStatus:a.taxStatus,mergedInto:a.mergedInto??null,history:[],notes:'',payerRevision:(a.payerRevision??1)+1,privacyErasedAt:at,at}));counts.accounts++
 }
 for(const contact of rows(state,'contact').filter(c=>scope.contactIds.has(c.id))){
  if(rows(state,'customerAccount').some(a=>!scope.accountIds.has(a.id)&&a.contactIds?.includes(contact.id))){counts.sharedContactsRetained++;continue}
  queries.push(write('contact',{id:contact.id,version:contact.version+1,name:'Erased customer',email:'',phone:'',communication:'none',notes:'',history:[],privacyErasedAt:at,at}));counts.contacts++
 }
 for(const [kind,records] of Object.entries(state.records))for(const row of records)if(scope.jobIds.has(row.jobId)){
  const next=privateBlockerRecord(kind,row,at)
  if(next!==row)queries.push(write(kind,{...next,version:row.version+1}))
 }
 // Exact customer-merge consent receipts are authorization history. Their
 // historical snapshots remain with other signed decisions, not mutable data.
 queries.push({sql:'DELETE FROM mallet_portal_tokens WHERE account_id IN (SELECT value FROM json_each(?))',params:[JSON.stringify([...scope.accountIds])]})
 for(const r of rows(state,'declinedReview').filter(r=>scope.jobIds.has(r.jobId)))queries.push(write('declinedReview',{...r,version:r.version+1,revisions:[],offers:[],erasedAt:at}))
 queries.push(...eraseMailboxRecords(state,mailboxes,at),...eraseCoverageContent(state,scope,at),...eraseReviewFeedback(state,scope,at))
 return {queries,counts}
}

const mutableMediaKinds=new Set(['inspection','inspectionReport','diagnosis','note','declinedReview'])
/** Remove byte/metadata replicas from mutable diagnostics. Signed, financial
 * and authorization snapshots remain exact and are disclosed on the receipt. */
function withoutMedia(value:any,ids:Set<string>):any{
 if(Array.isArray(value))return value.map(v=>withoutMedia(v,ids)).filter(v=>v!==null)
 if(!value||typeof value!=='object')return value
 if(typeof value.id==='string'&&ids.has(value.id))return null
 return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,withoutMedia(v,ids)]))
}
export function mediaCleanup(state:State,plan:ErasurePlan,inventory:MediaInventory,receiptId:string,at:string){
 const jobs=new Set(plan.mediaJobIds),ids=new Set([...inventory.uploads.filter(u=>jobs.has(u.job_id)).map(u=>u.id),...inventory.findings.filter(f=>jobs.has(f.job_id)).map(f=>f.id)]),scope=JSON.stringify(plan.mediaJobIds)
 const selected="SELECT id FROM mallet_media_uploads WHERE job_id IN (SELECT value FROM json_each(?))"
 const queries:Sql[]=[
  {sql:`DELETE FROM mallet_media_chunks WHERE upload_id IN (${selected})`,params:[scope]},
  {sql:`DELETE FROM mallet_media_upload_clients WHERE upload_id IN (${selected})`,params:[scope]},
  {sql:"DELETE FROM mallet_media_uploads WHERE variant='shared' AND job_id IN (SELECT value FROM json_each(?))",params:[scope]},
  {sql:'DELETE FROM mallet_media_uploads WHERE job_id IN (SELECT value FROM json_each(?))',params:[scope]},
  {sql:'DELETE FROM mallet_media_resolutions WHERE job_id IN (SELECT value FROM json_each(?))',params:[scope]},
  {sql:'DELETE FROM mallet_media_findings WHERE job_id IN (SELECT value FROM json_each(?))',params:[scope]}
 ]
 let metadataRecords=0
 for(const [kind,records]of Object.entries(state.records))for(const row of records){
  if(kind==='job'&&jobs.has(row.id)){
   // Invalidates an upload/carry operation that read its scope before erasure.
   queries.push(write(kind,{...row,version:row.version+1,mediaErasedAt:at,mediaErasureReceiptId:receiptId}));continue
  }
  if(kind==='diagnosisLink'&&jobs.has(row.jobId)){queries.push(write(kind,{...row,version:row.version+1,revokedAt:at,revokedBy:{role:'owner'},erasureReceiptId:receiptId}));continue}
  if(!mutableMediaKinds.has(kind))continue
  const next=withoutMedia(row,ids)
  if(next&&JSON.stringify(next)!==JSON.stringify(row)){queries.push(write(kind,{...next,version:row.version+1,mediaErasureReceiptId:receiptId}));metadataRecords++}
 }
 // Events created by media/inspection observations duplicate metadata. Exact
 // estimate/intake/authorization events are preserved with their source rows.
 for(const row of rows(state,'event').filter(r=>jobs.has(r.jobId)&&/^(inspection\.|diagnosis\.|note\.)/.test(r.kind))){
  const next=withoutMedia(row,ids)
  if(next&&JSON.stringify(next)!==JSON.stringify(row)){queries.push(write('event',{...next,version:row.version+1,mediaErasureReceiptId:receiptId}));metadataRecords++}
 }
 queries.push({sql:'DELETE FROM mallet_customer_links WHERE job_id IN (SELECT value FROM json_each(?))',params:[scope]})
 return {queries,metadataRecords}
}
