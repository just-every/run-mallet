import assert from 'node:assert/strict'
import {join} from 'node:path'
import axe from 'axe-core'
import {archive, restore, installation} from '../harness.mjs'
import {auditRows, expectedCall, assertKnownRows} from './audit-counts.mjs'

const meta = 'com.runeditrun/'
export function nativeAuditClient(h, key) {
 let id = 0
 return async (name, args, options = {}) => {
  const response = await h.request('/mcp', {method:'POST',as:'',headers:{Authorization:'Bearer ' + key.token,Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name},body:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:args,...options,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{elicitation:{url:{}}},'io.modelcontextprotocol/clientInfo':{name:'synthetic-mallet-audit',version:'1'}}}}})
  const body = await response.json()
  return {status:response.status,result:body.result,decision:body.result?._meta?.[meta + 'decision'],error:body.error}
 }
}

async function accessible(page) {
 await page.evaluate(axe.source)
 const result = await page.evaluate(async () => {
  const {violations} = await window.axe.run(document)
  return violations.filter(item => ['serious','critical'].includes(item.impact)).map(item => ({id:item.id,impact:item.impact,nodes:item.nodes.map(node => node.target)}))
 })
 assert.deepEqual(result, [], 'The populated native Agents screen has no serious or critical axe findings')
}

export async function auditLifecycle(h, page, directory, now) {
 const context = {origin:h.origin,cookie:h.owner,request:(url,options) => h.mf.dispatchFetch(url, options)}
 const owner = (await h.state()).actor
 const key = await h.command('agent.create', {label:'Synthetic lifecycle advisor'})
 const other = await h.command('agent.create', {label:'Synthetic separate advisor'})
 const tool = nativeAuditClient(h, key), otherTool = nativeAuditClient(h, other), expected = []
 const call = async (name,args,decision,outcome='done',code=null) => {
  const answer = await tool(name,args)
  expected.push(expectedCall(answer,name,decision,outcome,code))
  return answer
 }
 const policy = async disposition => h.api('/agents/api/policy', {document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'native-lifecycle',class:'*',do:disposition,...(disposition === 'approval' ? {approver:['sponsor'],wait:'P1D'} : {})}],reviewers:['sponsor'],spend:{none:true}}}, {method:'PUT'})
 const job = (await h.state()).records.job[0]
 const args = {jobId:job.id,version:job.version,bayId:'Synthetic review bench',technicianId:job.technicianId,startAt:job.startAt,endAt:job.endAt,reason:'Synthetic reviewed dispatch proposal',idempotency_key:crypto.randomUUID()}
 await policy('review')
 const reviewWrite = await call('mallet.dispatch.prepare',args,'review')
 const reviewRead = await call('mallet.repairs.read',{id:job.id},'review')
 const writeReviewId = reviewWrite.result._meta[meta + 'review'].id
 const readReviewId = reviewRead.result._meta[meta + 'review'].id
 const member = await h.person('synthetic-mallet-77' + String.fromCharCode(64) + 'example.invalid')
 const business = (await h.state()).records
 const snapshot = await auditRows(context)
 const reviews = await h.api('/agents/api/reviews')
 assert.deepEqual(reviews.reviews.map(item => item.decision_id).sort(), snapshot.rows.filter(row => row.decision === 'review' && row.outcome === 'done').map(row => row.id).sort(), 'The review feed contains exactly the completed review decisions, including the earlier fixture')
 assert.deepEqual(reviews.reviews.find(item => item.id === writeReviewId).prepared_by, {agent:key.label,for:owner.name})
 const deniedMark = await h.request('/agents/api/reviews/' + writeReviewId + '/reviewed',{method:'POST',as:member.cookie,body:{}})
 assert.equal(deniedMark.status,403)
 await deniedMark.body?.cancel()
 const bearerMark = await h.request('/agents/api/reviews/' + writeReviewId + '/reviewed',{method:'POST',as:'',headers:{Authorization:'Bearer ' + key.token},body:{}})
 assert.equal(bearerMark.status,403)
 await bearerMark.body?.cancel()
 assert.deepEqual(await h.api('/agents/api/reviews'),reviews,'A member or bearer cannot mark another person’s review')
 assert.deepEqual((await h.state()).records,business,'Denied review actions preserve the actual proposal and every business record')
 await page.setViewportSize({width:1440,height:1000})
 await page.goto(h.origin + '/agents')
 const item = page.locator('[data-review-id="' + writeReviewId + '"]')
 assert.match(await item.innerText(),new RegExp(key.label + ' for ' + owner.name))
 assert.equal(await item.getByRole('button',{name:'Undo',exact:true}).count(),1,'A pending dispatch preparation offers a person-only reversal')
 await accessible(page)
 await item.getByRole('button',{name:'Mark reviewed',exact:true}).focus()
 await Promise.all([page.waitForNavigation(),page.keyboard.press('Enter')])
 const marked = (await h.api('/agents/api/reviews')).reviews.find(item => item.id === writeReviewId)
 assert.equal(marked.state,'reviewed')
 assert.equal(marked.marked_by,owner.id)
 assert.equal(marked.marked_at,now)
 const markedAudit = (await auditRows(context)).rows.find(row => row.id === reviewWrite.decision.id)
 assert.deepEqual(markedAudit.review,{id:writeReviewId,by:owner.id},'The audit resolves the actual signed-in review person')
 await Promise.all([page.waitForNavigation(),page.locator('[data-review-id="' + readReviewId + '"]').getByRole('button',{name:'Flag',exact:true}).click()])
 assert.equal((await h.api('/agents/api/reviews')).reviews.find(item => item.id === readReviewId).state,'flagged')
 const undo = await h.request('/agents/api/reviews/' + readReviewId + '/undo',{method:'POST',body:{}})
 assert.equal(undo.status,409)
 assert.equal((await undo.json()).code,'undo_unavailable')
 assert.deepEqual((await h.state()).records,business,'Review, Flag and an unavailable Undo do not change the retained proposal or repair')
 await h.api('/agents/api/reviews/' + writeReviewId + '/flag',{})
 await page.reload()
 const beforeUndo = (await h.state()).records
 const proposal = beforeUndo.proposal.find(row => row.id === reviewWrite.result.structuredContent.id)
 for (const options of [{as:member.cookie},{as:'',headers:{Authorization:'Bearer ' + key.token}}]) {
  const denied = await h.request('/agents/api/reviews/' + writeReviewId + '/undo',{method:'POST',body:{},...options})
  assert.equal(denied.status,403)
  await denied.body?.cancel()
 }
 assert.deepEqual((await h.state()).records,beforeUndo,'Denied Undo preserves the entire real proposal and repair')
 await page.locator('[data-review-id="' + writeReviewId + '"]').getByRole('button',{name:'Undo',exact:true}).focus()
 await Promise.all([page.waitForNavigation(),page.keyboard.press('Enter')])
 const afterUndo = (await h.state()).records
 const withdrawn = afterUndo.proposal.find(row => row.id === proposal.id)
 assert.equal(withdrawn.status,'withdrawn')
 assert.equal(withdrawn.version,proposal.version + 1)
 assert.deepEqual(withdrawn.plan,proposal.plan)
 assert.deepEqual(withdrawn.preparedBy,proposal.preparedBy)
 assert.equal(withdrawn.withdrawal.by.id,owner.id)
 assert.equal(withdrawn.withdrawal.by.role,'owner')
 assert.equal(withdrawn.withdrawal.at,now)
 for (const kind of ['job','asset','estimate']) assert.deepEqual(afterUndo[kind],beforeUndo[kind],'Undo never changes ' + kind + ' records or their versions')
 const undone = (await h.api('/agents/api/reviews')).reviews.find(item => item.id === writeReviewId)
 assert.equal(undone.state,'undone')
 assert.equal(undone.marked_by,owner.id)
 assert.deepEqual(afterUndo.event.find(row => row.kind === 'dispatch.withdraw').actor,withdrawn.withdrawal.by)
 const undoneReplay = await tool('mallet.dispatch.prepare',args)
 assert.equal(undoneReplay.result.structuredContent.id,proposal.id)
 assert.deepEqual((await h.state()).records,afterUndo,'Replaying the original capture cannot resurrect the withdrawn preparation')
 await h.api('/agents/api/reviews/' + writeReviewId + '/undo',{})
 assert.deepEqual((await h.state()).records,afterUndo,'Repeating Undo has no second effect')
 const duplicate = await h.request('/api/mallet/commands',{method:'POST',body:{command:'dispatch.withdraw',input:{proposalId:withdrawn.id,version:withdrawn.version,reason:'Synthetic duplicate withdrawal'}}})
 assert.equal(duplicate.status,409)
 await duplicate.body?.cancel()
 assert.deepEqual((await h.state()).records,afterUndo,'A direct duplicate withdrawal cannot replace its original evidence')
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:1000})
  await page.goto(h.origin + '/agents')
  if (width === 1440) {
   assert.equal(await page.locator('[data-review-id="' + writeReviewId + '"]').count(),0)
   assert.equal(await page.locator('[data-review-id="' + readReviewId + '"]').getAttribute('data-review-state'),'flagged')
  }
  await page.screenshot({path:join(directory,'review-feed-' + width + '.png'),fullPage:true})
 }
 const fencedWrite = await call('mallet.dispatch.prepare',{...args,bayId:'Synthetic fenced bench',idempotency_key:crypto.randomUUID()},'review')
 const fencedReviewId = fencedWrite.result._meta[meta + 'review'].id
 const subscription = await h.api('/api/mallet/webhooks/subscribe',{label:'Synthetic current status subscriber',endpoint:'https://hooks.mallet-consumer.com/events',families:['status'],consent:true,consentEvidence:'Owner recorded a synthetic status endpoint consent'})
 const fencedBefore = (await h.state()).records
 const fencedReview = await h.api('/agents/api/reviews')
 const fencedUndo = await h.request('/agents/api/reviews/' + fencedReviewId + '/undo',{method:'POST',body:{}})
 assert.equal(fencedUndo.status,409,'Undo cannot introduce a queued effect outside the adopted agent boundary')
 await fencedUndo.body?.cancel()
 assert.deepEqual((await h.state()).records,fencedBefore,'The current queued-effect fence is inside the withdrawal transaction')
 assert.deepEqual(await h.api('/agents/api/reviews'),fencedReview,'A refused reversal remains available for explicit recovery')
 await h.api('/api/mallet/webhooks/stop',{id:subscription.id,version:fencedBefore.webhookSubscription.find(row => row.id === subscription.id).version,reason:'Owner stopped the synthetic endpoint before explicit reversal'})
 await h.api('/agents/api/reviews/' + fencedReviewId + '/undo',{})
 assert.equal((await h.state()).records.proposal.find(row => row.id === fencedWrite.result.structuredContent.id).status,'withdrawn')
 assert.equal((await h.state()).records.webhookDelivery?.length ?? 0,0,'Neither refusal nor the later explicit reversal queued an outbound handoff')
 await policy('approval')
 const pendingArgs = {...args,bayId:'Synthetic approved bench',idempotency_key:crypto.randomUUID()}
 const pendingBefore = (await h.state()).records
 const pending = await call('mallet.dispatch.prepare',pendingArgs,'approval','pending')
 assert.equal(pending.result.resultType,'input_required')
 const approvalId = pending.result._meta[meta + 'approval'].id
 let approval = (await h.api('/agents/api/approvals/' + approvalId)).approval
 assert.equal(approval.state,'pending')
 const approveInput = {revision:approval.revision,summary_sha256:approval.summary_sha256}
 for (const options of [{as:member.cookie},{as:'',headers:{Authorization:'Bearer ' + key.token}}]) {
  const response = await h.request('/agents/api/approvals/' + approvalId + '/approve',{method:'POST',body:approveInput,...options})
  assert.equal(response.status,403)
  await response.body?.cancel()
 }
 assert.deepEqual((await h.api('/agents/api/approvals/' + approvalId)).approval,approval)
 assert.deepEqual((await h.state()).records,pendingBefore,'A pending or refused approval cannot execute the proposal')
 const pendingRow = (await auditRows(context)).rows.find(row => row.id === pending.decision.id)
 assert.equal(pendingRow.outcome,'pending')
 assert.deepEqual(pendingRow.approval,{id:approvalId,by:[]})
 assert.equal(pendingRow.idempotency_key,pendingArgs.idempotency_key)
 assert.deepEqual(pendingRow.resource,{kind:'job',id:job.id})
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:1000})
  await page.goto(h.origin + '/agents/approvals/' + approvalId)
  if (width === 1440) {
   assert.match(await page.locator('main').innerText(),/Synthetic approved bench/)
   await accessible(page)
  }
  await page.screenshot({path:join(directory,'pending-approval-' + width + '.png'),fullPage:true})
 }
 await page.setViewportSize({width:1440,height:1000})
 await page.getByRole('button',{name:'Approve',exact:true}).focus()
 await Promise.all([page.waitForNavigation(),page.keyboard.press('Enter')])
 approval = (await h.api('/agents/api/approvals/' + approvalId)).approval
 assert.equal(approval.state,'executed')
 assert.equal(approval.approvals[0].person,owner.id)
 const actual = (await h.state()).records.proposal.filter(row => row.plan.bayId === pendingArgs.bayId)
 assert.equal(actual.length,1)
 assert.equal(actual[0].jobId,job.id)
 assert.equal(actual[0].preparedBy.id,'mallet-key:' + key.id)
 const approvedBefore = (await h.state()).records
 const replay = await tool('mallet.dispatch.prepare',pendingArgs)
 assert.equal(replay.result.structuredContent.id,actual[0].id)
 assert.deepEqual((await h.state()).records,approvedBefore,'Replaying the approved preparation cannot create a second proposal')
 const approvedProposal = await h.command('dispatch.approve',{proposalId:actual[0].id,version:actual[0].version})
 const beforeRefusedWithdrawal = (await h.state()).records
 const approvedUndo = await h.request('/api/mallet/commands',{method:'POST',body:{command:'dispatch.withdraw',input:{proposalId:approvedProposal.id,version:approvedProposal.version,reason:'Synthetic refusal of an applied dispatch'}}})
 assert.equal(approvedUndo.status,409)
 await approvedUndo.body?.cancel()
 assert.deepEqual((await h.state()).records,beforeRefusedWithdrawal,'An applied dispatch cannot be undone as if it were still a pending proposal')
 await policy('autonomous')
 expectedCall(await otherTool('mallet.repairs.read',{id:job.id}),'mallet.repairs.read','autonomous','done')
 const all = await auditRows(context)
 assertKnownRows(all.rows,expected)
 const originalPending = all.rows.find(row => row.id === pending.decision.id)
 assert.equal(originalPending.outcome,'pending','Completion never rewrites the historical pending outcome')
 assert.deepEqual(originalPending.approval,{id:approvalId,by:[owner.id]})
 const execution = all.rows.find(row => row.decision_id === pending.decision.id)
 assert.ok(execution && execution.id !== originalPending.id)
 assert.equal(execution.outcome,'done')
 assert.deepEqual(execution.approval,{id:approvalId,by:[owner.id]})
 const replayRow = all.rows.find(row => row.id === replay.decision.id)
 assert.equal(replayRow.outcome,'replayed')
 assert.equal(replayRow.replay_of,pending.decision.id)
 for (const filters of [{agent:'mallet-key:' + key.id},{class:'standard'},{class:'money'},{agent:'mallet-key:' + key.id,class:'standard'},{agent:'mallet-key:' + other.id,class:'money'}]) {
  const wanted = all.rows.filter(row => (!filters.agent || row.agent.id === filters.agent) && (!filters.class || row.classes.some(item => item.class === filters.class)))
  assert.deepEqual((await auditRows(context,filters)).rows,wanted,'Every filtered cursor contains exactly the requested retained identities')
  const response = await h.request('/agents/api/audit/export?' + new URLSearchParams(filters))
  assert.equal(response.status,200,'An authorized audit export reaches its public download door')
  assert.match(response.headers.get('content-disposition'),/attachment/)
  assert.match(response.headers.get('content-type'),/application\/x-ndjson/)
  const text = await response.text()
  assert.deepEqual(text.trim() ? text.trim().split('\n').map(line => JSON.parse(line)) : [],wanted,'Export opens as complete ordered rows with every audit field, across the page boundary')
 }
 for (const options of [{as:''},{as:member.cookie},{as:'',headers:{Authorization:'Bearer ' + key.token}}]) {
  const response = await h.request('/agents/api/audit/export',options)
  assert.ok([401,403].includes(response.status))
  const text = await response.text()
  assert.ok(!text.includes(key.label) && !text.includes(actual[0].id),'A denied export discloses no audit identity or native result')
 }
 const inventory = await h.api('/agents/api/agents')
 assert.equal(inventory.agents.find(item => item.id === 'mallet-key:' + key.id).revoked,false)
 await h.api('/agents/api/agents/' + encodeURIComponent('mallet-key:' + key.id) + '/revoke',{})
 const retainedBefore = (await auditRows(context)).rows
 const revokedBusiness = (await h.state()).records
 const denied = await tool('mallet.repairs.read',{id:job.id})
 assert.equal(denied.status,401)
 assert.equal(denied.result,undefined)
 const retained = (await auditRows(context)).rows
 assert.deepEqual(retained.slice(0,retainedBefore.length),retainedBefore,'Removing an admitted agent retains every original row and its name')
 assert.equal(retained.at(-1).outcome,'refused')
 assert.equal(retained.at(-1).code,'unauthenticated')
 assert.equal(retained.at(-1).agent.name,key.label)
 assert.deepEqual((await h.state()).records,revokedBusiness)
 assert.equal((await h.api('/agents/api/agents')).agents.find(item => item.id === 'mallet-key:' + key.id).revoked,true)
 const lines = await archive(h)
 const recovered = await installation({entry:'tests/agent-door/worker.ts',clock:now})
 try {
  await restore(recovered,lines)
  const recoveredState = (await recovered.state()).records
  assert.deepEqual(recoveredState.proposal,revokedBusiness.proposal,'Both the person-withdrawn draft and the separately applied proposal recover with their original attribution')
  assert.deepEqual(recoveredState.job,revokedBusiness.job)
  const restoredAudit = await auditRows({origin:recovered.origin,cookie:recovered.owner,request:(url,options) => recovered.mf.dispatchFetch(url,options)})
  assert.deepEqual(restoredAudit.rows,retained,'A fresh owner recovers the complete original audit without rewriting names or decisions')
  assert.deepEqual((await recovered.api('/agents/api/reviews')).reviews,[],'Recovery does not restore executable review handles')
  assert.deepEqual((await recovered.api('/agents/api/approvals')).approvals,[],'Recovery does not restore pending approval authority')
  const oldKey = await nativeAuditClient(recovered,key)('mallet.repairs.read',{id:job.id})
  assert.equal(oldKey.status,401,'An archived credential cannot read the recovered workshop')
  assert.equal(oldKey.result,undefined)
  assert.deepEqual((await recovered.state()).records.proposal,revokedBusiness.proposal,'Replaying an old capture cannot resurrect a withdrawn proposal in recovery')
 } finally { await recovered.close() }
 const signout = await h.request('/auth/signout',{method:'POST',body:{}})
 assert.equal(signout.status,204)
 const staleSession = await h.request('/agents/api/audit/export')
 assert.equal(staleSession.status,401,'A revoked native session cannot export retained private audit rows')
 const staleBody = await staleSession.text()
 assert.ok(!staleBody.includes(key.label) && !staleBody.includes(actual[0].id))
 console.log('PROBE BASE-AGENT-009 points-1-2-4-5-6-7: native complete write and unset refusal; pending approval, refused non-person decisions, one exact approved effect and inert replay; exact review feed, keyboard Mark reviewed, Flag and reversible dispatch Undo with inert replay; all audit fields exported through every filtered cursor; removed agent retains history and cannot read; populated Agents and approval screen axe has no serious or critical findings; browser proof at 1440 and 390.')
}
