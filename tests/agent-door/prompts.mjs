import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { totpCode } from '../support/second-factor.mjs'

const installations = new Map()
const writes = ['mallet.dispatch.prepare', 'mallet.estimates.prepare', 'mallet.estimates.revise', 'mallet.invoices.prepare']
const reads = ['mallet.repairs.list', 'mallet.repairs.read']
const stateOf = state => ({ version: state.version, records: state.records, events: state.events })

const personJson = async (c, path, body) => {
  const response = await c.request(c.origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
    headers: { Origin: c.origin, Cookie: c.cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  assert.equal(response.status, 200, `Native prompt journey: ${path}`)
  return response.json()
}
const rpc = async (c, method, params = {}, credential = installations.get(c.origin).token) => {
  const response = await c.request(c.origin + '/mcp', { method: 'POST', headers: {
    Origin: c.origin, Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json',
    'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': method,
    ...(params.name ? { 'Mcp-Name': params.name } : {}),
  }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }) })
  return { status: response.status, body: await response.json() }
}
const planOf = answer => {
  assert.equal(answer.status, 200)
  assert.ok(!answer.body.error, 'Prompt retrieval succeeds under the current policy')
  const message = answer.body.result.messages[0]
  assert.equal(message.role, 'user')
  assert.equal(message.content.type, 'text')
  const match = message.content.text.match(/```json\s*([\s\S]*?)```/)
  assert.ok(match, 'Prompt gives the agent a registered preparation plan')
  return { text: message.content.text, plan: JSON.parse(match[1]) }
}

/** Native setup is shared with the standard conformance phases, never fixture SQL. */
export async function preparePrompts(c) {
  if (!['autonomous', 'held'].includes(c.phase)) return
  if (!installations.has(c.origin)) {
    const factor = await personJson(c, '/api/mallet/security/totp/begin', {})
    await personJson(c, '/api/mallet/security/totp/confirm', { code: totpCode(factor.secret) })
    const key = await personJson(c, '/api/mallet/commands', { command: 'agent.create', input: { label: 'Synthetic Mallet prompt reader' } })
    installations.set(c.origin, { token: key.token, keyId: key.id, phases: new Set() })
  }
  const before = stateOf(await personJson(c, '/api/mallet/state'))
  const discover = await rpc(c, 'server/discover'), listing = await rpc(c, 'prompts/list'), again = await rpc(c, 'prompts/list')
  assert.ok(discover.body.result.capabilities.prompts)
  assert.ok(discover.body.result.instructions.includes(c.origin + '/docs/agents'))
  for (const name of writes) assert.ok(discover.body.result.instructions.includes(name))
  assert.deepEqual(listing, again, 'Prompt listing is deterministic')
  assert.deepEqual(listing.body.result.prompts.map(prompt => prompt.name), writes)
  const tools = (await rpc(c, 'tools/list')).body.result.tools
  const describe = tool => ({ name: tool.name, title: tool.title, description: tool.description,
    scope: tool._meta['com.runeditrun/scope'], classes: tool._meta['com.runeditrun/classes'], readOnly: tool.annotations.readOnlyHint })
  for (const prompt of listing.body.result.prompts) {
    const { plan } = planOf(await rpc(c, 'prompts/get', { name: prompt.name }))
    assert.deepEqual(plan.preparation, describe(tools.find(tool => tool.name === prompt.name)), 'Prompt preparation matches independently discovered registry metadata')
    assert.deepEqual(plan.reads.map(tool => tool.name).sort(), reads)
    for (const read of plan.reads) assert.deepEqual(read, describe(tools.find(tool => tool.name === read.name)))
    assert.ok(prompt.description.includes(plan.preparation.scope) && plan.preparation.classes.every(cls => prompt.description.includes(cls)))
  }
  const missing = await rpc(c, 'prompts/get', { name: 'mallet.unknown' })
  assert.equal(missing.body.error.code, -32602)
  const malformed = await rpc(c, 'prompts/get', { name: writes[0], arguments: { approved: true } })
  assert.equal(malformed.body.error.code, -32602)
  assert.deepEqual(stateOf(await personJson(c, '/api/mallet/state')), before, 'Listing, retrieval and refused retrieval preserve all business records')
  console.log(`PROBE BASE-AGENT-013 prompts-${c.phase}: MCP discovery, four retrieved plans and registry comparison -> exact tools, scopes and classes; business records unchanged`)
}

async function before(c) {
  if (c.phase === 'held' && c.step.id === 'list') await preparePrompts(c)
  if (c.step.id !== 'dispatch' || !['autonomous', 'held'].includes(c.phase)) return
  const { plan } = planOf(await rpc(c, 'prompts/get', { name: c.step.tool }))
  assert.equal(c.step.tool, plan.preparation.name)
  assert.equal(plan.preparation.readOnly, false)
  const reader = plan.reads.find(read => read.name === 'mallet.repairs.read')
  const repair = await c.tool(reader.name, { id: c.args.jobId })
  const current = repair.result.structuredContent.records.job.find(row => row.id === c.args.jobId)
  assert.equal(c.args.version, current.version, 'Prompt followed the current repair read')
  installations.get(c.origin).before = structuredClone(current)
}

async function after(c) {
  if (c.step.id !== 'dispatch' || !['autonomous', 'held'].includes(c.phase)) return
  const state = await personJson(c, '/api/mallet/state'), saved = state.records.proposal.find(row => row.id === c.result.id)
  assert.ok(saved, 'Prompt produces a persisted draft')
  assert.equal(saved.jobId, c.args.jobId)
  assert.equal(saved.jobVersion, c.args.version)
  assert.equal(saved.status, 'pending')
  assert.equal(saved.reason, c.args.reason)
  assert.deepEqual(saved.plan, {
    ...Object.fromEntries(['liftId', 'loanerId', 'requiredSkill'].map(key => [key, installations.get(c.origin).before[key]])),
    ...Object.fromEntries(['bayId', 'technicianId', 'startAt', 'endAt'].map(key => [key, c.args[key]])),
  }, 'Exact persisted slot retains the original resource constraints')
  assert.deepEqual(state.records.job.find(row => row.id === c.args.jobId), installations.get(c.origin).before, 'Preparing a dispatch never applies its proposed promise or assignment')
  assert.ok(saved.preparedBy.attribution.agent.id && saved.preparedBy.attribution.for.id && saved.preparedBy.name.includes(' for '), 'Persisted attribution identifies agent and sponsoring person')
  const rows = []; let cursor
  for (let page = 0; page < 20; page++) {
    const audit = await personJson(c, '/agents/api/audit' + (cursor ? `?after=${cursor}` : ''))
    rows.push(...audit.rows)
    if (!audit.cursor || audit.cursor === cursor) break
    cursor = audit.cursor
  }
  const activity = rows.find(row => row.tool === c.step.tool && row.outcome === 'done' && row.idempotency_key === c.args.idempotency_key)
  assert.ok(activity, 'Attributable activity is readable through the person door')
  assert.equal(activity.agent.id, saved.preparedBy.attribution.agent.id)
  assert.equal(activity.sponsor.id, saved.preparedBy.attribution.for.id)
  assert.equal(activity.decision, c.phase === 'held' ? 'review' : 'autonomous')
  if (c.phase === 'held') {
    assert.ok(activity.review?.id, 'Held standard preparation retains its review')
    const reviews = await personJson(c, '/agents/api/reviews')
    assert.equal(reviews.reviews.find(review => review.id === activity.review.id)?.tool, c.step.tool)
  }
  installations.get(c.origin).phases.add(c.phase)
  console.log(`PROBE BASE-AGENT-013 dispatch-${c.phase}: retrieved prompt -> exact pending proposal, unchanged repair and attributable ${activity.decision} activity`)
}

/** Browser requests are sent to the same disposable emitted Worker as MCP. */
async function promptScreens(c) {
  const context = installations.get(c.origin)
  assert.deepEqual([...context.phases].sort(), ['autonomous', 'held'])
  const directory = process.env.RER_PROOF_DIR || await mkdtemp(join(tmpdir(), 'mallet-prompts-'))
  await mkdir(directory, { recursive: true })
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CI ? undefined : '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    for (const width of [1440, 390]) {
      const browserContext = await browser.newContext({ viewport: { width, height: 1000 } })
      try {
        await browserContext.route('**/*', async route => {
          const request = route.request()
          assert.equal(new URL(request.url()).origin, c.origin)
          const response = await c.request(request.url(), { method: request.method(), redirect: 'manual', headers: { ...request.headers(), Cookie: c.cookie }, ...(request.postData() ? { body: request.postData() } : {}) })
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) })
        })
        const page = await browserContext.newPage()
        const response = await page.goto(c.origin + '/docs/agents')
        if (width === 1440) {
          assert.equal(response.status(), 200)
          assert.deepEqual(await page.locator('[data-prompt-name]').evaluateAll(nodes => nodes.map(node => node.dataset.promptName)), writes)
          assert.deepEqual((await page.locator('[data-tool-name]').evaluateAll(nodes => nodes.map(node => node.dataset.toolName))).sort(), [...writes, ...reads].sort())
          assert.ok(await page.locator('body').evaluate(node => node.scrollWidth <= innerWidth), 'Docs fit the viewport')
          assert.ok(await page.locator('p, li, dd, a').evaluateAll(nodes => nodes.every(node => parseFloat(getComputedStyle(node).fontSize) >= 13)), 'Readable documentation text')
        }
        await page.screenshot({ path: join(directory, `preparation-docs-${width}.png`), fullPage: true })
        await page.goto(c.origin + '/agents')
        if (width === 1440) assert.ok((await page.locator('body').innerText()).includes('Synthetic Base 1'), 'Person activity shows native attribution')
        await page.screenshot({ path: join(directory, `preparation-activity-${width}.png`), fullPage: true })
      } finally { await browserContext.close() }
    }
  } finally { await browser.close() }
  await personJson(c, '/api/mallet/commands', { command: 'agent.revoke', input: { id: context.keyId } })
  const before = stateOf(await personJson(c, '/api/mallet/state'))
  assert.equal((await rpc(c, 'prompts/list')).status, 401)
  assert.equal((await rpc(c, 'prompts/get', { name: writes[0] })).status, 401)
  assert.deepEqual(stateOf(await personJson(c, '/api/mallet/state')), before, 'Revoked prompt reads preserve business records')
  console.log('PROBE BASE-AGENT-013 docs: emitted docs and native activity -> readable browser proof at 1440 and 390; revoked prompt access refused without business changes')
}

const checked = fn => async context => {
  try { await fn(context) } catch (error) { console.error('Prompt journey assertion:', error.message); throw error }
}
export const beforeStep = checked(before)
export const afterStep = checked(after)
export default checked(promptScreens)
