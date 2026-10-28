import {revokeOutreachAccess} from './outreach'
import {revokeCoverageAccess} from './coverage'
import {revokeReviewAccess} from './reviews'
import type {Bindings} from '../../auth.server'
import type {Actor,Authority} from '../auth'
import {choice,expectVersion,fail,find,integer,object,rows,text,type Row} from '../model'
import {purgeIntakeSecrets} from '../intake-secrets'
import {portabilityCheckpoint} from '../imports/portability'
import {commit,customerScope,ownerGrant,snapshot,write} from './store'
import {plan} from './plans'
import {erasedAsset,mediaCleanup,personalCleanup} from './cleanup'
import {retireProfile} from './import-custody'
import {customerExport} from './export'
import {refuseSecretEcho} from './consent'

export const retentionCommands=['retention.policy','retention.hold','retention.release','retention.preview','retention.run','customer.export','customer.erase']
const policyDays=(value:unknown,label:string)=>value===null?null:integer(value,label,0,36500)
const actorSnapshot=(actor:Actor)=>({id:actor.id,name:actor.name,role:actor.role})

/** Server command door. Parent supplies its native, freshly stepped-up owner
 * authority. No reducer hook, cron, outbound call or automatic deletion exists. */
export async function retentionCommand(env:Bindings,actor:Actor,authority:Authority,command:string,raw:any){
 if(!retentionCommands.includes(command))fail('COMMAND','Unknown retention command.',null,400)
 const p=object(raw),grant=ownerGrant(actor,authority),snap=await snapshot(env,grant),now=new Date().toISOString(),by=actorSnapshot(actor)
 if(!['customer.export','retention.preview'].includes(command))await refuseSecretEcho(env,[p.reason,p.consentEvidence,p.caseReference].filter((v):v is string=>typeof v==='string'))
 if(command==='customer.export')return customerExport(env,actor,authority,grant,snap,p)
 if(command==='retention.policy'){
  const old=rows(snap.state,'retentionPolicy')[0]
  if(old)expectVersion(old,p.version);else if(p.version!==0)fail('VERSION','A new retention policy needs version zero.')
  const row={id:old?.id??'shop',version:(old?.version??0)+1,auditMinimumDays:p.auditMinimumDays===undefined?(old?.auditMinimumDays??null):policyDays(p.auditMinimumDays,'audit minimum retention label days'),mediaDays:policyDays(p.mediaDays,'media retention days'),personalDays:policyDays(p.personalDays,'personal profile retention days'),mode:'manual',financial:'preserve',authorization:'preserve',reason:text(p.reason,'policy reason',2000),at:now,by,history:old?[...(old.history??[]),{...old,history:undefined}]:[]}
  if(p.consent!==true)fail('RETENTION_CONSENT','Explicitly approve this manual retention policy.',null,400)
  await commit(env,grant,[write('retentionPolicy',row)],snap);return row
 }
 if(command==='retention.hold'){
  const customerId=p.customerId?customerScope(snap.state,text(p.customerId,'customerId')).customerId:null,job=p.jobId?find(snap.state,'job',p.jobId):null
  if(job&&customerId&&!customerScope(snap.state,customerId).jobIds.has(job.id))fail('HOLD_SCOPE','The repair must belong to the selected customer.')
  const row={id:crypto.randomUUID(),version:1,scope:choice(p.scope,['financial','media','personal','import','all'],'hold scope'),customerId,jobId:job?.id??null,reason:text(p.reason,'hold reason',2000),caseReference:text(p.caseReference,'hold reference',200),at:now,by,releasedAt:null}
  await commit(env,grant,[write('retentionHold',row)],snap);return row
 }
 if(command==='retention.release'){
  const old=find(snap.state,'retentionHold',p.holdId);expectVersion(old,p.version)
  if(old.releasedAt)fail('HOLD_RELEASED','This hold was already released.')
  if(p.consent!==true)fail('RETENTION_CONSENT','Explicitly approve this hold release.',null,400)
  const row={...old,version:old.version+1,releasedAt:now,releasedBy:by,releaseReason:text(p.reason,'hold release reason',2000)}
  await commit(env,grant,[write('retentionHold',row)],snap);return row
 }
 const mode=command==='customer.erase'?'erase':command==='retention.run'?'retention':choice(p.mode??'erase',['erase','retention'],'preview mode')
 const reviewed=await plan(env,grant,snap,p,mode,now)
 if(command==='retention.preview')return reviewed.value
 if(p.consent!==true||p.confirm!==(mode==='erase'?'ERASE':'RUN RETENTION'))fail('RETENTION_CONSENT','Explicit consent and the exact confirmation phrase are required.',null,400)
 if(p.fingerprint!==reviewed.value.fingerprint)fail('RETENTION_PREVIEW','Preview and approve the exact current retention candidates before deletion.')
 const reason=text(p.reason,'erasure reason',2000),consentEvidence=text(p.consentEvidence,'explicit request or retention approval evidence',2000),id=crypto.randomUUID()
 let receipt:Row={id,version:1,action:command,customerId:reviewed.scope.customerId,at:now,by,reason,consentEvidence,consent:true,fingerprint:reviewed.value.fingerprint,planned:reviewed.value.counts,held:reviewed.value.held,retained:reviewed.value.retained,phase:'started',counts:{unlockKeys:0,importProfiles:0}}
 const outreachRevocations=revokeOutreachAccess(snap.state,reviewed.scope,now,by)
 await commit(env,grant,[...outreachRevocations.queries,...revokeCoverageAccess(reviewed.scope),...revokeReviewAccess(reviewed.scope),write('retentionReceipt',receipt)],snap)
 let unlockKeys=0
 try{
 // A request is durably audited before destroying external keys. The key purge
 // precedes every media/profile/import mutation, even when holds retain them.
 unlockKeys=reviewed.scope.jobIds.size?await purgeIntakeSecrets(env,'job_id IN (SELECT value FROM json_each(?))',[JSON.stringify([...reviewed.scope.jobIds])]):0
 let expectedVersion=snap.state.version+1+outreachRevocations.recordCount
 const expectedMediaVersion=snap.mediaVersion+unlockKeys
 const checkedSnapshot=async()=>{const value=await snapshot(env,grant);if(value.state.version!==expectedVersion||value.mediaVersion!==expectedMediaVersion)fail('CONCURRENT_CHANGE','Records, media, temporary secrets or holds changed after approval. Preview the remaining work.');return value}
 let current=await checkedSnapshot()
 receipt={...receipt,version:receipt.version+1,phase:'keys-purged',counts:{...receipt.counts,unlockKeys}}
 await commit(env,grant,[write('retentionReceipt',receipt)],current)
 expectedVersion++
 current=await checkedSnapshot()
  for(const assetId of reviewed.value.importAssetIds){
   // A newly placed hold is respected at every bounded import mutation; Kit
   // fences the exact observed custody and native snapshots in its own batch.
   const eligible=await plan(env,grant,current,p,mode,now)
   if(!eligible.value.personal)fail('RETENTION_CHANGED','A hold or policy now protects personal/import data. Preview the remaining work.')
   const asset=find(current.state,'asset',assetId),next=erasedAsset(asset,now)
   receipt={...receipt,version:receipt.version+1,phase:'profiles',counts:{...receipt.counts,importProfiles:receipt.counts.importProfiles+1}}
   const retired=await retireProfile(env,actor,authority,grant,current,asset,next,[write('retentionReceipt',receipt)])
   receipt={...receipt,importReceipts:[...(receipt.importReceipts??[]),retired.receiptId],importStores:[...(receipt.importStores??[]),...retired.stores]}
   expectedVersion+=2
   current=await checkedSnapshot()
  }
  const eligible=await plan(env,grant,current,p,mode,now)
  // Never widen the approved set after partial custody retirement.
  const allowed=new Set(eligible.value.mediaJobIds),mediaJobs=reviewed.value.mediaJobIds.filter(j=>allowed.has(j))
  if(mediaJobs.length!==reviewed.value.mediaJobIds.length||reviewed.value.personal&&!eligible.value.personal)fail('RETENTION_CHANGED','A hold or policy changed. Preview the remaining work; destroyed unlock keys stay destroyed.')
  const cleanup=mediaCleanup(current.state,{...reviewed.value,mediaJobIds:mediaJobs},eligible.inventory,id,now),personal=reviewed.value.personal?personalCleanup(current.state,customerScope(current.state,reviewed.scope.customerId),now):{queries:[],counts:{accounts:0,contacts:0,sharedContactsRetained:0}}
  receipt={...receipt,version:receipt.version+1,phase:'complete',completedAt:new Date().toISOString(),counts:{...reviewed.value.counts,...receipt.counts,metadataRecords:cleanup.metadataRecords,...personal.counts}}
  await commit(env,grant,[...await portabilityCheckpoint(env.DB),...cleanup.queries,...personal.queries,write('retentionReceipt',receipt)],current)
  return receipt
 }catch(error){
  // Preserve exact partial progress for the owner. There is no background retry
  // or implicit second consent; a fresh preview is required for remaining work.
  const latest=await snapshot(env,grant),stored=rows(latest.state,'retentionReceipt').find(r=>r.id===id)!
  await commit(env,grant,[write('retentionReceipt',{...stored,version:stored.version+1,phase:'needs-review',counts:{...stored.counts,unlockKeys},...(receipt.importReceipts?{importReceipts:receipt.importReceipts,importStores:receipt.importStores}:{}),failureCode:typeof (error as any)?.code==='string'?(error as any).code:'RETENTION_FAILED',lastAttemptAt:new Date().toISOString()})],latest)
  throw error
 }
}
