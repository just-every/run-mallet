import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {fail,type Row} from '../model'
import {assetTargets} from '../imports/targets'
import {importContext,destination} from '../imports/context'
import {journal} from '../imports/service'
import {portabilityCheckpoint} from '../imports/portability'
import {retireD1ImportCustody,type D1TargetAdapter} from '../../modules/import-kit/src/d1/index.ts'
import {sqlGuard,type Snapshot} from './store'
import {assertion} from '../media/storage'
import type {Sql} from '../media/types'

/** Kit's target here is the imported *personal profile*, embedded in an asset.
 * The operational stub remains for repair/financial references. Once personal
 * erasure commits, that profile is absent from this adapter and has no revision
 * marker. Kit's erased-target journal prevents future apply/undo resurrection. */
const profiles:D1TargetAdapter={...assetTargets,
 async read(db,target,kind,id){const row=await assetTargets.read(db,target,kind,id);return row&&(row.value as any).privacyErasedAt?undefined:row},
 matches(row,target,kind,id){
  if(row)return assetTargets.matches(row,target,kind,id)
  return {sql:`NOT EXISTS(SELECT 1 FROM mallet_import_revisions WHERE kind='asset' AND id=?) AND NOT EXISTS(SELECT 1 FROM mallet_records WHERE kind='asset' AND id=? AND (json_extract(value,'$.privacyErasedAt') IS NULL OR json_extract(value,'$.customerEmail')<>'' OR json_extract(value,'$.customerName')<>'Erased customer'))`,params:[id,id]}
 }
}

export async function importJournals(env:Bindings,actor:Actor,authority:Authority,assetIds:Set<string>){
 const jobs=await env.DB.prepare('SELECT id FROM ik_jobs WHERE destination=? ORDER BY id').bind(destination).all<{id:string}>(),result=[]
 for(const job of jobs.results){const value=await journal(env.DB,actor,job.id,authority);if(value.links.some(l=>assetIds.has(l.targetId)))result.push(value)}
 return result
}

export async function retireProfile(env:Bindings,actor:Actor,authority:Authority,grant:Sql,snap:Snapshot,asset:Row,next:Row,queries:Sql[]){
 const originals=await importJournals(env,actor,authority,new Set([asset.id])),customerIds=new Set(originals.flatMap(j=>j.links.filter(l=>l.targetId===asset.id).map(l=>l.customerSourceId)))
 const context=importContext(env.DB,actor,authority)
 context.authorization.predicate=()=>grant
 context.storage.targets=profiles
 context.originalErasurePolicy='withdraw-affected-artifacts'
 if(customerIds.size&&originals.some(j=>j.links.some(l=>customerIds.has(l.customerSourceId)&&l.targetId!==asset.id&&!((snap.state.records.asset??[]).some(a=>a.id===l.targetId&&a.customerAccountId===asset.customerAccountId)))))
  fail('IMPORT_CUSTOMER_SCOPE','Link every imported vehicle for this source customer to the same account before personal erasure. Media-only erasure remains available.')
 const checkpoint=await portabilityCheckpoint(env.DB)
 return retireD1ImportCustody({target:{kind:'asset',id:asset.id},related:{
  source:record=>record.namespace===context.namespace&&record.kind==='customer'&&customerIds.has(record.sourceId),
 }},[
  sqlGuard(grant),assertion('EXISTS(SELECT 1 FROM mallet_meta WHERE id=1 AND version=?)',[snap.state.version]),assertion('EXISTS(SELECT 1 FROM mallet_retention_clock WHERE id=1 AND version=?)',[snap.mediaVersion]),
  {sql:"DELETE FROM mallet_import_revisions WHERE kind='asset' AND id=?",params:[asset.id]},
  {sql:"UPDATE mallet_records SET value=?,revision=? WHERE kind='asset' AND id=?",params:[JSON.stringify(next),next.version,asset.id]},...queries,{sql:'DELETE FROM mallet_assert'}
 ],context,checkpoint)
}
