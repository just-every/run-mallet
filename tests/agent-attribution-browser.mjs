import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import { installation, booking } from './harness.mjs'
import { autonomousPolicy, heldPolicy } from '../src/modules/agent-door/conformance/crypto.mjs'
import { nativeDoor, preparedAttribution, approvedAttribution } from './agent-door/native-attribution.mjs'

export async function agentAttributionBrowser() {
 const h = await installation({ network: true, secureNetwork: true, assets: true, localhost: true }); let browser
 try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
   args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] })
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } })
  await context.addCookies(h.owner.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: h.origin })))
  const page = await context.newPage()
  await page.goto(h.origin + '/setup'); await page.getByLabel('Sales tax rate (%)', { exact: true }).fill('0')
  await page.getByLabel('I confirm this owner account is ready to use.').check()
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click(); await page.waitForURL('**/app')
  const door = nativeDoor({ request: (url, options) => h.request(new URL(url).pathname, { method: options.method, as: h.owner,
   headers: options.headers, ...(options.body === undefined ? {} : { body: JSON.parse(options.body) }) }), origin: h.origin, cookie: h.owner })
  const directory = process.env.MALLET_ATTRIBUTION_PROOF_DIR ?? '.cache/agent-attribution-browser'
  await mkdir(directory, { recursive: true })
  const key = await h.command('agent.create', { label: 'synthetic-mallet-811' }), owner = (await h.state()).actor
  const agent = { as: '', headers: { authorization: `Bearer ${key.token}` } }
  const tool = async (name, args) => {
   const response = await h.request('/mcp', { method: 'POST', ...agent, headers: { ...agent.headers, 'mcp-protocol-version': '2025-11-25' },
    body: { jsonrpc: '2.0', id: randomUUID(), method: 'tools/call', params: { name, arguments: args } } })
   assert.equal(response.status, 200); const answer = await response.json()
   assert.ok(!answer.error && !answer.result.isError, JSON.stringify(answer.error ?? answer.result?._meta))
   return answer.result
  }
  const shot = async (phase, name, card) => {
   if (!process.env.MALLET_ATTRIBUTION_PROOF_DIR) return
   for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await card.screenshot({ path: join(directory, `${phase}-${name}-${width}.png`) })
   }
   await page.setViewportSize({ width: 1440, height: 1000 })
  }
  for (const [index, phase] of ['autonomous', 'held'].entries()) {
   const policy = phase === 'autonomous' ? autonomousPolicy() : heldPolicy()
   const configured = await h.request('/agents/api/policy', { method: 'PUT', body: { document: policy } })
   assert.equal(configured.status, 200)
   const asset = await h.command('asset.create', { customerName: 'synthetic-mallet-812', customerEmail: ['synthetic-mallet-812', 'example.invalid'].join('@'), label: 'Shop bicycle', identifier: `synthetic-mallet-${813 + index}` })
   const { job } = await booking(h, { asset, startAt: `2028-11-${10 + index}T09:00:00Z`, endAt: `2028-11-${10 + index}T10:00:00Z`, bayId: `synthetic-mallet-${815 + index}` })
   const firstLines = [{ kind: 'labor', description: 'Inspect brakes', quantity: 1, unitCents: 4500 }]
   const first = await tool('mallet.estimates.prepare', { jobId: job.id, version: job.version, lines: firstLines, idempotency_key: randomUUID(), expected_revision: job.version })
   await preparedAttribution(door, first.structuredContent)
   const input = { estimateId: first.structuredContent.id, version: 1, revision: 1,
    lines: [{ kind: 'labor', description: 'Inspect and adjust brakes', quantity: 2, unitCents: 4500 }], notes: 'Separate exact revision requires a person decision', idempotency_key: randomUUID(), expected_revision: 1 }
   const revised = await tool('mallet.estimates.revise', input), saved = revised.structuredContent
   await preparedAttribution(door, saved, first.structuredContent.revisions[0])
   const beforeReplay = (await h.state()).records
   assert.deepEqual((await tool('mallet.estimates.revise', input)).structuredContent, saved)
   assert.deepEqual((await h.state()).records, beforeReplay, 'MCP replay preserves both exact revisions')
   const approval = { estimateId: saved.id, version: saved.version, revision: 2 }
   const refuse = async (input, options, status) => {
    const before = (await h.state()).records
    await h.command('estimate.approve', input, { ...options, status })
    assert.deepEqual((await h.state()).records, before, 'Refused approval cannot impersonate a person or create any business effect')
   }
   await refuse(approval, agent, 403)
   await refuse({ ...approval, revision: 1 }, {}, 409)
   const member = await h.person(['synthetic-mallet-' + (817 + index), 'example.invalid'].join('@'))
   await refuse(approval, { as: member.cookie }, 403)
   await page.goto(h.origin + '/app/jobs/' + job.id)
   const card = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'Estimate & customer authorization', exact: true }) })
   const preparedBy = `${key.label} for ${owner.name}`
   assert.ok((await card.innerText()).includes(`Prepared by ${preparedBy}`), 'Estimate card identifies agent and sponsoring person')
   assert.ok(!(await card.innerText()).includes('Approved by'), 'Draft has no fabricated human approval')
   await shot(phase, 'draft', card)
   const beforeApproval = await h.state()
   await card.getByRole('button', { name: 'Approve estimate', exact: true }).click(); await page.waitForLoadState('domcontentloaded'); await page.reload()
   await approvedAttribution(door, beforeApproval, saved)
   const text = await card.innerText()
   assert.ok(text.includes(`Prepared by ${preparedBy}`)); assert.ok(text.includes(`Approved by ${owner.name}`))
   assert.equal(await card.getByRole('button', { name: 'Approve estimate', exact: true }).count(), 0)
   assert.equal(await card.getByRole('button', { name: 'Record estimate shared', exact: true }).count(), 1)
   const attribution = card.locator('[data-estimate-attribution]')
   assert.ok((await attribution.locator('p').evaluateAll(nodes => nodes.map(node => parseFloat(getComputedStyle(node).fontSize)))).every(size => size >= 13))
   await shot(phase, 'approved', card)
   await refuse(approval, {}, 409)
   const untouched = (await h.state()).records
   await tool('mallet.estimates.revise', input)
   assert.deepEqual((await h.state()).records, untouched, 'Preparation replay after approval cannot overwrite the person decision')
   const reviews = await h.api('/agents/api/reviews'), matching = reviews.reviews.filter(row => row.tool === 'mallet.estimates.revise')
   assert.equal(matching.length, phase === 'held' ? 1 : 0, 'Standard review remains distinct from native owner approval')
   console.log(`PROBE BASE-AGENT-008 point-5 ${phase}: MCP prepare and revise, native owner form -> exact agent preparer and person approval; original revision retained; denied actors and replay unchanged; no customer authorization, work, sharing or money effect.`)
  }
  await h.command('agent.revoke', { id: key.id })
  const beforeRevoked = (await h.state()).records
  await h.request('/mcp', { method: 'POST', ...agent, headers: { ...agent.headers, 'mcp-protocol-version': '2025-11-25' }, body: { jsonrpc: '2.0', id: randomUUID(), method: 'tools/call', params: { name: 'mallet.repairs.list', arguments: {} } } }).then(response => assert.equal(response.status, 401))
  assert.deepEqual((await h.state()).records, beforeRevoked)
 } finally { await browser?.close(); await h.close() }
}
