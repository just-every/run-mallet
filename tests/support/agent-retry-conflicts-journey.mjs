import assert from 'node:assert/strict'
import {run,booking} from '../harness.mjs'
import {shopSetup} from './diagnosis-journey.mjs'
import {autonomousPolicy,heldPolicy} from '../../src/modules/agent-door/conformance/crypto.mjs'

const error=answer=>answer.result?._meta?.['com.runeditrun/error']
const content=answer=>answer.result.structuredContent
const decision=answer=>answer.result._meta['com.runeditrun/decision']
const lines=[{id:'synthetic-mallet-941',kind:'labor',description:'Inspect native brake adjustment',quantity:1.5,unitCents:3200}]
const changed=[{id:'synthetic-mallet-942',kind:'labor',description:'Revised native brake adjustment',quantity:2,unitCents:4100}]

async function retryConflicts(h,document){
 await shopSetup(h)
 await h.api('/agents/api/policy',{document},{method:'PUT'})
 const key=await h.command('agent.create',{label:'synthetic-mallet-943'})
 const agent={as:'',headers:{authorization:'Bearer '+key.token}}
 let rpcId=0
 const send=(name,args)=>h.request('/mcp',{...agent,method:'POST',headers:{...agent.headers,'MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name},body:{jsonrpc:'2.0',id:++rpcId,method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}}})
 const call=async(name,args)=>{const response=await send(name,args);assert.equal(response.status,200);return response.json()}
 const records=async()=>(await h.state()).records
 const audit=async()=>(await h.api('/agents/api/audit')).rows
 const repair=async(suffix,day)=>{
  const asset=await h.command('asset.create',{customerName:'synthetic-mallet-944',customerEmail:'',label:'Native retry bicycle',identifier:'synthetic-mallet-'+suffix})
  return (await booking(h,{asset,bayId:'synthetic-mallet-'+suffix,startAt:day+'T09:00:00Z',endAt:day+'T10:00:00Z'})).job
 }
 const job=await repair('945','2028-11-10')
 const disposition=document.rules.find(rule=>rule.class==='standard')?.do??'autonomous'
 for(const verb of ['prepare','revise']){
  const name='mallet.estimates.'+verb,command='estimate.'+verb
  const before=await records(),prior=before.estimate?.find(row=>row.jobId===job.id)
  const input=verb==='prepare'?{jobId:job.id,version:job.version,lines}:{estimateId:prior.id,version:prior.version,revision:prior.revisions.at(-1).n,lines:changed}
  const args={...input,expected_revision:input.version,idempotency_key:'synthetic-mallet-946-'+verb}
  const response=await send(name,args)
  assert.equal(response.status,200)
  // The transport witness retains the emitted result. The receiving client
  // discards its stream after independent owner readback proves native commit.
  const committed=await records(),saved=committed.estimate.find(row=>row.jobId===job.id)
  const expectedLines=verb==='prepare'?lines:changed,revision=verb==='prepare'?1:2
  assert.equal(committed.estimate.filter(row=>row.jobId===job.id).length,1)
  assert.equal(saved.revisions.length,revision)
  assert.equal(saved.revisions.at(-1).n,revision)
  assert.deepEqual(saved.revisions.at(-1).lines.map(({id,kind,description,quantity,unitCents})=>({id,kind,description,quantity,unitCents})),expectedLines)
  assert.equal(saved.revisions.at(-1).totals.totalCents,verb==='prepare'?4800:8200)
  assert.equal(committed.event.filter(row=>row.kind===command&&row.jobId===job.id).length,1,'One logical native preparation event precedes retry')
  const original=await response.clone().json()
  assert.equal(original.result.isError,false)
  assert.equal(decision(original).disposition,disposition)
  assert.deepEqual(content(original),saved,'Emitted result matches independently retained native draft')
  await response.body.cancel()

  const replayBefore=await records(),replay=await call(name,args)
  assert.notEqual(replay.id,original.id,'A new JSON-RPC id retries the lost response')
  assert.equal(replay.result.isError,false)
  assert.deepEqual(content(replay),content(original),'Retry returns the exact first native outcome')
  assert.deepEqual(replay.result.content,original.result.content,'Text and resource links retain the first outcome')
  assert.deepEqual(replay.result._meta['com.runeditrun/review'],original.result._meta['com.runeditrun/review'],'Replay cannot create another review')
  assert.deepEqual(await records(),replayBefore,'Retry changes no draft, revisions, decisions, events or native audit records')
  const replayAudit=(await audit()).filter(row=>row.idempotency_key===args.idempotency_key)
  assert.deepEqual(replayAudit.map(row=>row.outcome),['done','replayed'])
  assert.equal(replayAudit[1].replay_of,replayAudit[0].id)
  assert.equal(replayAudit[1].operation_id,replayAudit[0].operation_id,'Replay audit belongs to the original logical preparation')

  const conflictBefore=await records()
  const conflict=await call(name,{...args,lines:verb==='prepare'?changed:lines})
  assert.equal(error(conflict).code,'idempotency_conflict')
  assert.deepEqual(await records(),conflictBefore,'Changed-argument reuse changes no business record')

  // Prepare against a fresh repair, or revise with current native arguments:
  // only expected_revision is stale, so a native DUPLICATE or version refusal
  // cannot masquerade as the required shared-door conflict.
  const target=verb==='prepare'?await repair('947','2028-11-11'):saved
  const current=(await records())[verb==='prepare'?'job':'estimate'].find(row=>row.id===target.id)
  const valid=verb==='prepare'?{jobId:current.id,version:current.version,lines}:{estimateId:current.id,version:current.version,revision:current.revisions.at(-1).n,lines}
  const staleArgs={...valid,idempotency_key:'synthetic-mallet-948-'+verb,expected_revision:current.version-1}
  const staleBefore=await records(),stale=await call(name,staleArgs)
  assert.equal(error(stale).code,'revision_conflict')
  assert.equal(error(stale).current_revision,current.version,'Conflict reports the revision independently read by the owner')
  assert.deepEqual(await records(),staleBefore,'Stale-revision refusal changes no business record')
  const refused=(await audit()).filter(row=>row.idempotency_key===args.idempotency_key||row.idempotency_key===staleArgs.idempotency_key)
  assert.deepEqual(refused.map(row=>[row.outcome,row.code]),[['done',null],['replayed',null],['refused','idempotency_conflict'],['refused','revision_conflict']])
  assert.equal(refused.filter(row=>row.outcome==='done').length,1,'Refusal and replay audits are not additional native preparation effects')
  const fresh=await call(name,{...staleArgs,expected_revision:current.version})
  assert.equal(fresh.result.isError,false,'Otherwise identical current inputs succeed with the current expected revision')
  const after=await records(),freshSaved=after.estimate.find(row=>row.id===content(fresh).id)
  assert.deepEqual(freshSaved,content(fresh))
  assert.equal(freshSaved.revisions.length,verb==='prepare'?1:3)
  assert.equal(after.event.filter(row=>row.kind===command&&row.jobId===job.id).length,verb==='prepare'?1:2)
  console.log('PROBE BASE-AGENT-012 '+verb+' ['+disposition+']: /mcp lost response and new RPC id -> exact recorded result, one initial native effect; changed lines -> idempotency_conflict, unchanged records; fresh key and stale expected_revision -> revision_conflict '+current.version+', unchanged records; current revision -> success')
 }
 await h.command('agent.revoke',{id:key.id})
 const beforeRevoke=await records()
 const revoked=await send('mallet.estimates.prepare',{jobId:job.id,version:job.version,lines,expected_revision:job.version,idempotency_key:'synthetic-mallet-946-prepare'})
 assert.equal(revoked.status,401,'Revoked credentials cannot replay retained outcomes')
 assert.equal((await revoked.json()).result,undefined,'Revoked replay discloses no retained native result')
 assert.deepEqual(await records(),beforeRevoke,'Revoked replay changes no business records')
}

export async function agentRetryConflictsJourney(){
 for(const document of [autonomousPolicy(),heldPolicy()])await run(h=>retryConflicts(h,document),{entry:'tests/support/agent-retry-worker.ts'})
}
