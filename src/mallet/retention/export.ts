import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {text,rows} from '../model'
import {commit,customerScope,write,type Snapshot} from './store'
import {mediaInventory} from './plans'
import {importJournals} from './import-custody'
import {customerJobHistory} from './job-history'
import type {Sql} from '../media/types'

export async function customerExport(env:Bindings,actor:Actor,authority:Authority,grant:Sql,snap:Snapshot,input:any){
 const scope=customerScope(snap.state,text(input.customerId,'customerId')),media=await mediaInventory(env,scope),imports=await importJournals(env,actor,authority,scope.assetIds)
 const owned=new Set([...scope.accountIds,...scope.contactIds,...scope.assetIds,...scope.jobIds])
 const records:Record<string,any[]>={}
 // Follow explicit ownership references only. A price template used by this
 // customer is shop configuration, not an owned record.
 for(let pass=0;pass<3;pass++)for(const [kind,values]of Object.entries(snap.state.records))for(const row of values){
  if(owned.has(row.id)||['customerId','accountId','assetId','jobId','invoiceId','estimateId','subjectId','declinedWorkId','declinedConsentId','reportId','intakeId','linkId','refundId','creditNoteId'].some(k=>owned.has(row[k]))){owned.add(row.id);(records[kind]??=[]);if(!records[kind].some(r=>r.id===row.id))records[kind].push(row)}
 }
 const uploadIds=JSON.stringify(media.uploads.map(u=>u.id)),chunks=(await env.DB.prepare('SELECT * FROM mallet_media_chunks WHERE upload_id IN (SELECT value FROM json_each(?)) ORDER BY upload_id,ordinal').bind(uploadIds).all()).results
 const background=await customerJobHistory(env.DB,scope.jobIds,new Set((records.invoice??[]).map(i=>i.id)))
 const receipt={id:crypto.randomUUID(),version:1,action:'customer.export',customerId:scope.customerId,at:new Date().toISOString(),by:actor,counts:{records:Object.values(records).reduce((n,r)=>n+r.length,0),findings:media.findings.length,uploads:media.uploads.length,chunks:chunks.length,importJournals:imports.length,jobs:background.jobs.length,jobRecoveries:background.recoveries.length}}
 await commit(env,grant,[write('retentionReceipt',receipt)],snap)
 return {format:'mallet-customer-export-v1',customerId:scope.customerId,records,media:{...media,chunks},imports,background,receipt,notice:'Private owner export. Import originals are exact shared source artifacts and may also contain other customers; review before giving any copy to a customer. No credentials, sessions or temporary unlock material are included. This is a customer data package, not an installation restore archive.'}
}
