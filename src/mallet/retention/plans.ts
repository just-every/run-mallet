import {createHash} from 'node:crypto'
import type {Bindings} from '../../auth.server'
import {choice,fail,rows,text,type Row} from '../model'
import {commit,customerScope,held,retainedNotice,type CustomerScope,type Snapshot} from './store'
import type {Sql} from '../media/types'

export type MediaInventory={findings:any[];uploads:any[];chunks:{upload_id:string;ordinal:number;byte_length:number}[];resolutions:any[]}
export type ErasurePlan={customerId:string;mode:'erase'|'retention';mediaJobIds:string[];personal:boolean;importAssetIds:string[];counts:{findings:number;uploads:number;incompleteUploads:number;chunks:number;bytes:number;resolutions:number;personalProfiles:number;importProfiles:number};held:{id:string;scope:string;jobId:string|null}[];retained:string;fingerprint:string}
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
export async function mediaInventory(env:Bindings,scope:CustomerScope):Promise<MediaInventory>{
 const ids=JSON.stringify([...scope.jobIds]),[findings,uploads,chunks,resolutions]=await env.DB.batch([
  env.DB.prepare('SELECT * FROM mallet_media_findings WHERE job_id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(ids),
  env.DB.prepare('SELECT * FROM mallet_media_uploads WHERE job_id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(ids),
  env.DB.prepare('SELECT c.upload_id,c.ordinal,c.byte_length FROM mallet_media_chunks c JOIN mallet_media_uploads u ON u.id=c.upload_id WHERE u.job_id IN (SELECT value FROM json_each(?)) ORDER BY c.upload_id,c.ordinal').bind(ids),
  env.DB.prepare('SELECT * FROM mallet_media_resolutions WHERE job_id IN (SELECT value FROM json_each(?)) ORDER BY finding_id').bind(ids)
 ])
 return {findings:findings.results,uploads:uploads.results,chunks:chunks.results,resolutions:resolutions.results} as MediaInventory
}
function oldEnough(row:Row,days:number|null,now:string){
 if(days===null)return false
 const observed=row.completedAt??row.at??row.updatedAt??row.createdAt
 return typeof observed==='string'&&Number.isFinite(Date.parse(observed))&&Date.parse(observed)<=Date.parse(now)-days*86400000
}
export async function plan(env:Bindings,grant:Sql,snap:Snapshot,input:any,mode:'erase'|'retention',now:string){
 const scope=customerScope(snap.state,text(input.customerId,'customerId')),inventory=await mediaInventory(env,scope),policy=rows(snap.state,'retentionPolicy')[0]
 const categories=input.categories===undefined?['media','personal','import']:input.categories
 if(!Array.isArray(categories)||!categories.length||categories.length>3)fail('INPUT','Choose media, personal and/or import data.',null,400)
 const selected=new Set(categories.map(v=>choice(v,['media','personal','import'] as const,'erasure category')))
 if(mode==='retention'&&!policy)fail('RETENTION_POLICY','Set an explicit manual retention policy before running retention.')
 // Active repairs remain outside age-based retention. Unknown dates never expire.
 const mediaJobIds=selected.has('media')?scope.jobs.filter(j=>!held(snap.state,scope,'media',j.id).length&&(mode==='erase'||['completed','invoiced'].includes(j.status)&&oldEnough(j,policy.mediaDays,now))).map(j=>j.id):[]
 // Originals can contain several customers. Until an exact artifact hold map
 // exists, any import/all hold conservatively protects shared import custody.
 const account=scope.accounts.find(a=>a.id===scope.customerId)!,importBlocked=rows(snap.state,'retentionHold').some(h=>!h.releasedAt&&['import','all'].includes(h.scope))
 const personal=selected.has('personal')&&!account.privacyErasedAt&&!held(snap.state,scope,'personal').length&&!importBlocked&&(mode==='erase'||oldEnough(account,policy.personalDays,now)&&scope.jobs.every(j=>['completed','invoiced'].includes(j.status)))
 // Native profiles and their import custody are one privacy unit. A hold on
 // either preserves both; a media-only request never withdraws source custody.
 const importAssetIds=personal&&selected.has('import')?scope.assets.filter(a=>!a.privacyErasedAt).map(a=>a.id):[]
 if(personal&&!selected.has('import'))fail('IMPORT_CUSTODY','Select import custody with personal profiles so retained originals cannot resurrect erased values.',null,400)
 const jobIds=new Set(mediaJobIds),uploads=inventory.uploads.filter(u=>jobIds.has(u.job_id)),uploadIds=new Set(uploads.map(u=>u.id)),chunks=inventory.chunks.filter(c=>uploadIds.has(c.upload_id))
 const value={customerId:scope.customerId,mode,mediaJobIds,personal,importAssetIds,counts:{findings:inventory.findings.filter(f=>jobIds.has(f.job_id)).length,uploads:uploads.length,incompleteUploads:uploads.filter(u=>!u.complete).length,chunks:chunks.length,bytes:chunks.reduce((n,c)=>n+c.byte_length,0),resolutions:inventory.resolutions.filter(r=>jobIds.has(r.job_id)).length,personalProfiles:personal?scope.accounts.length+rows(snap.state,'contact').filter(c=>scope.contactIds.has(c.id)&&!rows(snap.state,'customerAccount').some(a=>!scope.accountIds.has(a.id)&&a.contactIds?.includes(c.id))).length+scope.assets.length:0,importProfiles:importAssetIds.length},held:rows(snap.state,'retentionHold').filter(h=>!h.releasedAt&&(!h.customerId||scope.accountIds.has(h.customerId))&&(!h.jobId||scope.jobIds.has(h.jobId))).map(h=>({id:h.id,scope:h.scope,jobId:h.jobId??null})),retained:retainedNotice}
 await commit(env,grant,[],snap)
 return {scope,inventory,value:{...value,fingerprint:digest({value,stateVersion:snap.state.version,mediaVersion:snap.mediaVersion,policyVersion:policy?.version??null})} as ErasurePlan}
}
