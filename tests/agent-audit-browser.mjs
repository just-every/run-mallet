import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {installation, booking} from './harness.mjs'
import {auditRows, expectedCall, assertKnownRows, weeklyCounts, weekStart, htmlCounts} from './agent-door/audit-counts.mjs'

export async function agentAuditBrowser() {
 const previous = '2030-01-06T23:59:59.000Z', now = '2030-01-09T12:00:00.000Z', later = '2030-01-14T00:00:00.000Z'
 const h = await installation({entry:'tests/agent-door/worker.ts', clock:previous, network:true, secureNetwork:true, assets:true})
 let browser
 try {
  const setup = await h.mf.dispatchFetch(h.origin + '/setup', {method:'POST', redirect:'manual', headers:{Origin:h.origin, Cookie:h.owner, 'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({confirm:'yes',ratePercent:'0',partsTaxable:'on',laborTaxable:'on'})})
  assert.equal(setup.status, 303)
  await setup.body?.cancel()
  const {job} = await booking(h)
  const key = await h.command('agent.create', {label:'Synthetic audit advisor'})
  const policy = async disposition => {
   const response = await h.request('/agents/api/policy', {method:'PUT', body:{document:{schema:'rer-agent-policy/1',catalogue:'rer-agent-classes/1',rules:[{id:'native-actions',class:'*',do:disposition}],reviewers:['sponsor'],spend:{none:true}}}})
   assert.equal(response.status, 200, await response.text())
  }
  let id = 0
  const trace = '00-' + crypto.randomUUID().replaceAll('-', '') + '-0123456789abcdef-01'
  const tool = async (name, args) => {
   const response = await h.request('/mcp', {method:'POST', as:'', headers:{Authorization:'Bearer ' + key.token,Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2026-07-28','Mcp-Method':'tools/call','Mcp-Name':name},body:{jsonrpc:'2.0',id:++id,method:'tools/call',params:{name,arguments:args,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{elicitation:{url:{}}},'io.modelcontextprotocol/clientInfo':{name:'synthetic-mallet-audit',version:'1'},traceparent:trace}}}})
   const body = await response.json()
   return {status:response.status,result:body.result,decision:body.result?._meta?.['com.runeditrun/decision']}
  }
  const expected = []
  const call = async (name, args, decision, outcome='done', code=null) => {
   const answer = await tool(name, args)
   expected.push(expectedCall(answer, name, decision, outcome, code))
   return answer.result.structuredContent
  }
  const unsetBefore = (await h.state()).records
  await call('mallet.repairs.read', {id:job.id}, 'unset', 'refused', 'policy_unset')
  assert.deepEqual((await h.state()).records, unsetBefore, 'An unanswered policy records the refusal without reading or changing private business records')
  await policy('autonomous')
  await call('mallet.repairs.list', {}, 'autonomous')
  await h.setClock(now)
  const writeKey = crypto.randomUUID()
  const draft = await call('mallet.estimates.prepare', {jobId:job.id,version:job.version,lines:[{kind:'labor',description:'Synthetic audit inspection',quantity:1,unitCents:4500}],idempotency_key:writeKey}, 'autonomous')
  assert.equal((await h.state()).records.estimate.find(row => row.id === draft.id).revisions[0].lines[0].unitCents, 4500)
  const before = (await h.state()).records
  for (let index = 0; index < 205; index++) {
   const records = await call(index % 2 ? 'mallet.repairs.read' : 'mallet.repairs.list', index % 2 ? {id:job.id} : {}, 'autonomous')
   assert.equal(records.records.job.find(row => row.id === job.id).id, job.id)
  }
  await policy('review')
  await call('mallet.repairs.read', {id:job.id}, 'review')
  await policy('blocked')
  await call('mallet.repairs.read', {id:job.id}, 'blocked', 'refused', 'policy_blocked')
  assert.deepEqual((await h.state()).records, before, 'Reads and policy refusal preserve the prepared estimate and every business record')
  await policy('autonomous')
  await h.setClock(later)
  await call('mallet.repairs.list', {}, 'autonomous')
  await h.setClock(now)
  const context = {origin:h.origin,cookie:h.owner,request:(url,options) => h.mf.dispatchFetch(url, options)}
  const {rows, pages} = await auditRows(context)
  assert.ok(rows.length > 200 && pages >= 3)
  assertKnownRows(rows, expected)
  const write = rows.find(row => row.idempotency_key === writeKey)
  const owner = (await h.state()).actor
  assert.deepEqual(write.agent, {id:'mallet-key:' + key.id,name:key.label,specialist:'service advisor'}, 'The native preparation keeps its actual specialist identity')
  assert.equal(write.client_id, 'mallet-key:' + key.id, 'A local credential identifies its client without inventing a Business grant')
  assert.deepEqual(write.sponsor, {id:owner.id,name:owner.name})
  assert.deepEqual(write.resource, {kind:'job',id:job.id})
  assert.deepEqual(write.classes, [{class:'standard',facts:{measure:1}}])
  assert.deepEqual(write.rules, [{class:'standard',rule:'native-actions',do:'autonomous'}])
  assert.equal(write.revision, 1)
  assert.equal(write.operation_id, write.id)
  assert.equal(write.at, now)
  assert.equal(write.door, 'mcp')
  assert.equal(write.trace, trace)
  assert.equal(write.consent, null, 'Preparation keys carry no separate Business consent')
  assert.ok(write.scopes.includes('estimate:prepare'))
  assert.equal(write.approval, null)
  assert.equal(write.review, null)
  assert.equal(write.replay_of, null)
  assert.deepEqual(weeklyCounts(rows, now), {'standard:autonomous':206,'standard:blocked':1,'standard:review':1}, 'The fixture week excludes both adjacent weeks')
  const response = await h.request('/agents')
  assert.equal(response.status, 200)
  assert.deepEqual(htmlCounts(await response.text()), weeklyCounts(rows, now))
  browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  const browserContext = await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true,timezoneId:'Pacific/Honolulu'})
  await browserContext.addCookies(h.owner.split('; ').map(pair => ({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:h.origin})))
  const page = await browserContext.newPage()
  const directory = process.env.MALLET_AGENT_AUDIT_SCREENSHOTS ?? '.cache/browser/agent-audit'
  await mkdir(directory, {recursive:true})
  for (const width of [1440,390]) {
   await page.setViewportSize({width,height:1000})
   assert.equal((await page.goto(h.origin + '/agents')).status(), 200)
   const entries = await page.locator('[data-agents-count]').evaluateAll(nodes => nodes.map(node => [node.dataset.class + ':' + node.dataset.decision, Number(node.textContent)]))
   assert.equal(new Set(entries.map(([pair]) => pair)).size, entries.length)
   assert.deepEqual(Object.fromEntries(entries.sort(([a],[b]) => a.localeCompare(b))), weeklyCounts(rows, now), 'Every rendered weekly count is exact at ' + width)
   assert.equal(await page.locator('section[aria-labelledby="week-title"] time').getAttribute('datetime'), weekStart(now), 'Viewer timezone cannot move the UTC counting window')
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Agents counts fit at ' + width)
   await page.locator('section[aria-labelledby="week-title"]').screenshot({path:join(directory,'weekly-counts-' + width + '.png')})
  }
  assert.deepEqual((await h.state()).records, before, 'Opening audit pages and Agents never alters business records')
  await h.command('agent.revoke', {id:key.id})
  const revokedBefore = (await h.state()).records
  const denied = await tool('mallet.repairs.read', {id:job.id})
  assert.equal(denied.status, 401, 'A revoked preparation key cannot create another private-data read')
  assert.equal(denied.result, undefined, 'Revocation exposes no retained private result')
  const retained = await auditRows(context)
  assert.deepEqual(retained.rows, rows, 'Revocation preserves every original audit row, name and outcome without adding a successful call')
  assert.ok(retained.rows.every(row => row.agent.name === key.label), 'Retained audit names keep the original agent identity')
  assert.deepEqual((await h.state()).records, revokedBefore, 'The revoked read cannot change the business records')
  console.log('PROBE BASE-AGENT-009 point-3-browser: native write, 205 reads, review and blocked refusal; ' + rows.length + ' unique ordered rows; UTC week counts 206 autonomous, 1 review, 1 blocked at 1440 and 390; adjacent weeks excluded; business records unchanged.')
 } finally {
  await browser?.close()
  await h.close()
 }
}
