import assert from 'node:assert/strict'
import {join} from 'node:path'
import {auditRows, weeklyCounts, htmlCounts} from './audit-counts.mjs'

const meta = 'com.runeditrun/'

/** Reach native refusals and person decisions without granting another action. */
export async function auditApprovalOutcomes(h, tool, key, page, directory, now, accessible) {
 const context = {origin:h.origin,cookie:h.owner,request:(url,options) => h.mf.dispatchFetch(url,options)}
 const owner = (await h.state()).actor, agentId = 'mallet-key:' + key.id
 const job = (await h.state()).records.job[0]
 const scopes = ['estimate:prepare','estimate:revise','dispatch:prepare','invoice:prepare','workshop:read']
 let revision, disposition, clock = now
 const policy = async action => {
  const saved = await h.api('/agents/api/policy',{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'native-outcomes',class:'*',do:action,...(action === 'approval' ? {approver:['sponsor'],wait:'P1D'} : {})}],reviewers:['sponsor'],spend:{none:true}}},{method:'PUT'})
  revision = saved.revision
  disposition = action
 }
 const proposal = label => ({jobId:job.id,version:job.version,bayId:label,technicianId:job.technicianId,startAt:job.startAt,endAt:job.endAt,reason:'Synthetic exact audit outcome',idempotency_key:crypto.randomUUID()})
 const call = async (name,args,{outcome='done',code=null,approval=null,replayOf=null,decided=true}={}) => {
  const before = await auditRows(context)
  const trace = '00-' + crypto.randomUUID().replaceAll('-','') + '-0123456789abcdef-01'
  const answer = await tool(name,args,{trace})
  assert.equal(answer.status,200,'The real declared tool returns its native outcome')
  if (decided) assert.equal(answer.decision.disposition,disposition)
  else assert.equal(answer.decision,null,'Native classification refuses before a policy decision')
  assert.equal(answer.result.isError ?? false,code !== null)
  assert.equal(answer.result._meta[meta + 'error']?.code ?? null,code)
  const after = await auditRows(context)
  const added = after.rows.filter(row => row.sequence > (before.rows.at(-1)?.sequence ?? 0))
  assert.equal(added.length,1,'Each native call retains exactly one new audit identity')
  const row = added[0]
  assert.deepEqual(after.rows.slice(0,before.rows.length),before.rows,'A new call preserves all earlier outcomes')
  assert.ok(row.id)
  if (decided) assert.equal(row.id,answer.decision.id)
  assert.equal(row.operation_id,replayOf ?? row.id)
  assert.equal(row.tool,name)
  assert.equal(row.door,'mcp')
  assert.equal(row.at,clock)
  assert.equal(row.trace,trace,'Each refused or pending call retains its actual trace')
  assert.deepEqual(row.agent,{id:agentId,name:key.label,specialist:'service advisor'})
  assert.deepEqual(row.sponsor,{id:owner.id,name:owner.name})
  assert.equal(row.label,key.label + ' for ' + owner.name)
  assert.equal(row.client_id,agentId)
  assert.equal(row.consent,null,'Local preparation has no invented Business grant')
  assert.deepEqual(row.scopes,scopes)
  assert.deepEqual(row.resource,decided ? {kind:'job',id:job.id} : null)
  assert.deepEqual(row.classes,decided ? [{class:'standard',facts:{measure:1}}] : [])
  assert.deepEqual(row.rules,decided ? [{class:'standard',rule:'native-outcomes',do:disposition}] : [])
  assert.equal(row.revision,revision)
  assert.equal(row.decision,decided ? disposition : 'none')
  assert.equal(row.outcome,outcome)
  assert.equal(row.code,code)
  assert.equal(row.idempotency_key,args.idempotency_key)
  const returnedApproval = answer.result._meta[meta + 'approval']
  assert.deepEqual(row.approval,approval ?? (returnedApproval ? {id:returnedApproval.id,by:[]} : null))
  assert.equal(row.review,null,'A refused native call cannot create a review task')
  assert.equal(row.replay_of,replayOf)
  assert.equal(row.decision_id,null)
  assert.deepEqual(row.ignored_arguments,[])
  return {answer,row,approvalId:returnedApproval?.id}
 }
 const approval = async id => (await h.api('/agents/api/approvals/' + id)).approval
 const decision = async (id,action,status=200) => {
  const saved = await approval(id)
  return h.api('/agents/api/approvals/' + id + '/' + action,{revision:saved.revision,summary_sha256:saved.summary_sha256},{status})
 }
 const executionRow = async (call,code,outcome) => {
  const rows = (await auditRows(context)).rows.filter(row => row.decision_id === call.row.id)
  assert.equal(rows.length,1,'The person-triggered execution has its own retained audit identity')
  const row = rows[0]
  assert.notEqual(row.id,call.row.id)
  assert.equal(row.outcome,outcome)
  assert.equal(row.code,code)
  assert.deepEqual(row.approval,{id:call.approvalId,by:[owner.id]})
  assert.equal(row.operation_id,call.row.id)
  for (const field of ['agent','sponsor','scopes','resource','classes','rules']) assert.deepEqual(row[field],call.row[field],'The execution retains its originating ' + field)
  for (const field of ['tool','door','client_id','consent','revision','decision','idempotency_key']) assert.equal(row[field],call.row[field])
  assert.equal(row.at,clock)
  assert.equal(row.trace,null,'This person request supplies no trace header')
  assert.equal(row.review,null)
  assert.equal(row.replay_of,null)
 }

 await policy('review')
 const refusedBefore = (await h.state()).records, reviewsBefore = await h.api('/agents/api/reviews')
 await call('mallet.invoices.prepare',{jobId:job.id,version:job.version,idempotency_key:crypto.randomUUID()},{outcome:'refused',code:'job_state'})
 assert.deepEqual((await h.state()).records,refusedBefore,'Refused invoice preparation leaves the actual repair and money records unchanged')
 assert.deepEqual(await h.api('/agents/api/reviews'),reviewsBefore,'A policy review disposition does not turn a refused invoice into completed work')

 await policy('approval')
 const rejectedArgs = proposal('Synthetic rejected bench'), rejectedBefore = (await h.state()).records
 const rejected = await call('mallet.dispatch.prepare',rejectedArgs,{outcome:'pending'})
 assert.equal(rejected.answer.result.resultType,'input_required')
 assert.deepEqual((await h.state()).records,rejectedBefore,'Waiting for a person has no preparation effect')
 assert.equal((await decision(rejected.approvalId,'reject')).approval.state,'rejected')
 await call('mallet.dispatch.prepare',rejectedArgs,{outcome:'replayed',code:'approval_rejected',approval:{id:rejected.approvalId,by:[]},replayOf:rejected.row.id})
 assert.deepEqual((await h.state()).records,rejectedBefore,'Rejecting and replaying a real saved call cannot prepare a dispatch')
 assert.deepEqual((await auditRows(context)).rows.find(row => row.id === rejected.row.id),rejected.row,'Rejection does not rewrite the original pending audit outcome')

 const changedArgs = proposal('Synthetic changed-policy bench')
 const changed = await call('mallet.dispatch.prepare',changedArgs,{outcome:'pending'})
 const changedBefore = (await h.state()).records
 await policy('blocked')
 const refused = (await decision(changed.approvalId,'approve')).approval
 assert.equal(refused.state,'refused')
 assert.equal(refused.code,'approval_evidence_changed')
 await executionRow(changed,'approval_evidence_changed','refused')
 assert.deepEqual((await h.state()).records,changedBefore,'An old approval cannot bypass a newer blocking policy')

 await policy('approval')
 const failedArgs = proposal('Synthetic fenced approval bench')
 const failed = await call('mallet.dispatch.prepare',failedArgs,{outcome:'pending'})
 const subscription = await h.api('/api/mallet/webhooks/subscribe',{label:'Synthetic audit outcome subscriber',endpoint:'https://hooks.mallet-consumer.com/events',families:['status'],consent:true,consentEvidence:'Owner recorded a synthetic status endpoint consent'})
 const failedBefore = (await h.state()).records
 const failedApproval = (await decision(failed.approvalId,'approve')).approval
 assert.equal(failedApproval.state,'refused')
 assert.equal(failedApproval.code,'execution_failed')
 await executionRow(failed,'execution_failed','failed')
 assert.deepEqual((await h.state()).records,failedBefore,'The execution fence fails closed without a proposal, delivery or business change')
 await call('mallet.dispatch.prepare',failedArgs,{outcome:'refused',code:'queued_effect_not_adopted',decided:false})
 assert.deepEqual((await h.state()).records,failedBefore,'A replay cannot bypass the newly active outbound fence')
 await h.api('/api/mallet/webhooks/stop',{id:subscription.id,version:failedBefore.webhookSubscription.find(row => row.id === subscription.id).version,reason:'Owner stopped the synthetic subscriber after the fenced execution'})
 const stoppedBefore = (await h.state()).records
 await call('mallet.dispatch.prepare',failedArgs,{outcome:'replayed',code:'execution_failed',approval:{id:failed.approvalId,by:[owner.id]},replayOf:failed.row.id})
 assert.deepEqual((await h.state()).records,stoppedBefore,'Removing the fence cannot revive the saved failed approval or retry its effect')

 const expiredArgs = proposal('Synthetic expired bench'), expiredBefore = (await h.state()).records
 const expired = await call('mallet.dispatch.prepare',expiredArgs,{outcome:'pending'})
 const saved = await approval(expired.approvalId)
 assert.equal(saved.expires_at,new Date(Date.parse(now) + 86400000).toISOString())
 try {
  clock = saved.expires_at
  await h.setClock(clock)
  const response = await decision(expired.approvalId,'approve',409)
  assert.equal(response.code,'approval_expired','The exact native deadline refuses execution')
  assert.equal((await approval(expired.approvalId)).state,'expired')
  await call('mallet.dispatch.prepare',expiredArgs,{outcome:'replayed',code:'approval_expired',approval:{id:expired.approvalId,by:[]},replayOf:expired.row.id})
  assert.deepEqual((await h.state()).records,expiredBefore,'Expiry and a replay cannot create a native proposal')
  assert.deepEqual((await auditRows(context)).rows.find(row => row.id === expired.row.id),expired.row,'Expiry preserves the original pending call')
  assert.equal((await auditRows(context)).rows.filter(row => row.decision_id === expired.row.id).length,0,'An expired person step never starts an execution')
  const rows = (await auditRows(context)).rows
  const rendered = await h.request('/agents')
  assert.deepEqual(htmlCounts(await rendered.text()),weeklyCounts(rows,clock),'Counts include refused and replayed calls after actual person decisions')
  for (const width of [1440,390]) {
   await page.setViewportSize({width,height:1000})
   await page.goto(h.origin + '/agents/approvals/' + expired.approvalId)
   if (width === 1440) {
    assert.match(await page.locator('main').innerText(),/expired/i)
    assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),0)
    await accessible(page)
   }
   await page.screenshot({path:join(directory,'expired-approval-' + width + '.png'),fullPage:true})
  }
 } finally { await h.setClock(now) }
 await policy('autonomous')
 console.log('PROBE BASE-AGENT-009 point-2-outcomes: real invoice preparation under review -> job_state and no business effect or review; exact pending dispatch -> person rejection and inert replay; changed policy -> separately audited execution refused with the real approver; newly enabled webhook -> failed execution and inert replay with zero business changes; exact expiry -> approval_expired, no execution and inert replay; complete local identities, trace, classes, rule, targets and keys retained through every cursor and export.')
}
