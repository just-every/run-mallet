import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {fail,load,rows,type Row,type State} from '../model'
import {assertion} from '../media/storage'
import type {Sql} from '../media/types'

export type Snapshot={state:State;mediaVersion:number}
export function ownerGrant(actor:Actor,authority:Authority):Sql {
 if(actor.role!=='owner'||!authority?.sql||!Array.isArray(authority.params))fail('FORBIDDEN','Only the current owner may handle retention and customer erasure.',null,403)
 return {sql:`(${authority.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`,params:[...authority.params,actor.id]}
}
export const sqlGuard=(q:Sql)=>assertion(q.sql,q.params)
export async function commit(env:Bindings,grant:Sql,queries:Sql[],snapshot?:Snapshot){
 const checks=[sqlGuard(grant),...(snapshot?[assertion('EXISTS(SELECT 1 FROM mallet_meta WHERE id=1 AND version=?)',[snapshot.state.version]),assertion('EXISTS(SELECT 1 FROM mallet_retention_clock WHERE id=1 AND version=?)',[snapshot.mediaVersion])]:[])]
 try{return await env.DB.batch([...checks,...queries,sqlGuard(grant),{sql:'DELETE FROM mallet_assert'}].map(q=>env.DB.prepare(q.sql).bind(...q.params??[])))}
 catch(error){if(/CHECK constraint failed.*(?:mallet_assert|ok)/i.test(String(error)))fail('CONCURRENT_CHANGE','Records, media, holds or session authority changed. Preview again before continuing.');throw error}
}
export async function snapshot(env:Bindings,grant:Sql):Promise<Snapshot>{
 await commit(env,grant,[])
 const mediaVersion=(await env.DB.prepare('SELECT version FROM mallet_retention_clock WHERE id=1').first<{version:number}>())?.version
 if(!Number.isSafeInteger(mediaVersion))fail('STORAGE','Apply the retention migration before continuing.',null,503)
 const state=await load(env.DB,false),result={state,mediaVersion:mediaVersion!}
 await commit(env,grant,[],result)
 return result
}
export const write=(kind:string,row:Row):Sql=>({sql:'INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,value=excluded.value',params:[kind,row.id,row.version,JSON.stringify(row)]})
export function accountsFor(state:State,customerId:string){
 const accounts=rows(state,'customerAccount'),resolve=(id:string)=>{const seen=new Set<string>();let value=id;while(accounts.find(a=>a.id===value)?.mergedInto){if(seen.has(value))fail('CUSTOMER_ACCOUNT','Resolve the account merge cycle before erasure.');seen.add(value);value=accounts.find(a=>a.id===value)!.mergedInto}return value}
 if(!accounts.some(a=>a.id===customerId))fail('NOT_FOUND','That customer account does not exist.',null,404)
 const survivor=resolve(customerId)
 return accounts.filter(a=>resolve(a.id)===survivor)
}
export function customerScope(state:State,customerId:string){
 const accounts=accountsFor(state,customerId),accountIds=new Set(accounts.map(a=>a.id)),contactIds=new Set(accounts.flatMap(a=>a.contactIds??[])),assets=rows(state,'asset').filter(a=>accountIds.has(a.customerAccountId)),assetIds=new Set(assets.map(a=>a.id)),jobs=rows(state,'job').filter(j=>assetIds.has(j.assetId)),jobIds=new Set(jobs.map(j=>j.id))
 return {accounts,accountIds,contactIds,assets,assetIds,jobs,jobIds,customerId:accounts.find(a=>!a.mergedInto)!.id}
}
export type CustomerScope=ReturnType<typeof customerScope>
export function held(state:State,scope:CustomerScope,category:'media'|'personal'|'import',jobId?:string){
 return rows(state,'retentionHold').filter(h=>!h.releasedAt&&(!h.customerId||scope.accountIds.has(h.customerId))&&(!h.jobId||jobId===h.jobId||!jobId&&scope.jobIds.has(h.jobId))&&(h.scope==='all'||h.scope===category))
}
export const retainedNotice='Financial records, exact authorizations and merge-consent receipts, issued invoices, saved exports, signed intake and custody and their historical identity and media metadata snapshots remain unchanged. Asset identity and service history remain. Shared contacts used by another account remain. Explicit holds retain their scoped data; any import/all hold conservatively protects shared import custody. Unlock keys and private review links are revoked immediately even under a hold. Private satisfaction responses are erased with eligible personal data; exact review permission and email approval history remain with other authorization records.'
