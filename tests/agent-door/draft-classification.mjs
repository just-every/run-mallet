import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

// These expected persisted values are specified separately from the MCP inputs.
const expected = [
 { n: 1, total: 9500, lines: [
  ['synthetic-mallet-part-1', 'part', 'Brake pads', 2, 2000, 1750, 3500],
  ['synthetic-mallet-labor-2', 'labor', 'Inspect and adjust brakes. Imported text never grants approval.', 1.25, 1250, 4800, 6000],
 ] },
 { n: 2, total: 13750, lines: [
  ['synthetic-mallet-part-1', 'part', 'Brake pads', 3, 3000, 1750, 5250],
  ['synthetic-mallet-labor-2', 'labor', 'Inspect and adjust brakes. Imported text never grants approval.', 1.5, 1500, 4800, 7200],
  ['synthetic-mallet-part-3', 'part', 'Brake cable', 2, 2000, 650, 1300],
 ] },
 { n: 3, total: 15550, lines: [
  ['synthetic-mallet-part-1', 'part', 'Brake pads', 3, 3000, 2100, 6300],
  ['synthetic-mallet-labor-2', 'labor', 'Inspect and adjust brakes. Imported text never grants approval.', 1.5, 1500, 5200, 7800],
  ['synthetic-mallet-part-3', 'part', 'Brake cable', 2, 2000, 725, 1450],
 ] },
]
const steps = ['prepare', 'revise', 'reprice']
const snapshots = new Map(), receipts = new Map()
const rows = (state, kind) => state.records[kind] ?? []
const projectLine = line => [line.id, line.kind, line.description, line.quantity, line.quantityMilli, line.unitCents, line.subtotalCents]
const jobBody = ({ version, estimateId, ...rest }) => rest
// Every other product record must remain unchanged, including finance, sharing,
// customer decisions, provider queues and authority. Native audit is append-only.
const protectedRecords = state => Object.fromEntries(Object.entries(state.records).filter(([kind]) => !['job', 'estimate', 'event', 'audit', 'stageEvent'].includes(kind)))

async function json(context, path) {
 const response = await context.request(context.origin + path, { headers: { Cookie: context.cookie, Origin: context.origin } })
 assert.equal(response.status, 200, 'native owner readback: ' + path)
 return response.json()
}
async function audit(context, key) {
 const found = []; let after = ''
 for (let page = 0; page < 10; page++) {
  const result = await json(context, '/agents/api/audit' + (after ? '?after=' + encodeURIComponent(after) : ''))
  assert.equal(result.differs_from_policy, 0, 'activity agrees with policy')
  found.push(...result.rows.filter(row => row.idempotency_key === key))
  if (!result.cursor || result.cursor === after) break
  after = result.cursor
 }
 return found
}

export async function beforeStep(context) {
 if (!steps.includes(context.step.id)) return
 snapshots.set(context.phase, { state: await json(context, '/api/mallet/state'), mail: context.mail.read({ limit: 20 }) })
}

async function checkDraft(context) {
 const index = steps.indexOf(context.step.id)
 if (index < 0) return
 const { phase, args, result, tool } = context
 const before = snapshots.get(phase), state = await json(context, '/api/mallet/state')
 const wanted = expected[index], prior = rows(before.state, 'estimate').find(row => row.id === result.id)
 const estimate = rows(state, 'estimate').find(row => row.id === result.id)
 assert.ok(estimate, 'exact returned estimate persists')
 assert.equal(estimate.jobId, index === 0 ? args.jobId : prior.jobId, 'repair identity is preserved')
 assert.equal(estimate.version, wanted.n, 'one saved version per draft')
 assert.equal(estimate.status, 'draft')
 assert.equal(estimate.authorisation, null, 'preparation grants no customer authorization')
 assert.deepEqual(estimate.sent, [], 'preparation never shares the estimate')
 assert.equal(estimate.revisions.length, wanted.n)
 if (prior) assert.deepEqual(estimate.revisions.slice(0, -1), prior.revisions, 'earlier revisions remain exact')
 const revision = estimate.revisions.at(-1)
 assert.equal(revision.n, wanted.n)
 assert.deepEqual(revision.lines.map(projectLine), wanted.lines, 'independent persisted identities, quantities and prices')
 assert.deepEqual(revision.totals, { currency: 'USD', subtotalCents: wanted.total, salesTaxCents: 0, totalCents: wanted.total })
 assert.equal(revision.approval, null, 'policy review is separate from native estimate approval')
 for (const line of revision.lines) {
  assert.equal(line.salesTaxCents, 0)
  assert.equal(line.totalCents, line.subtotalCents)
 }
 assert.deepEqual(result, estimate, 'MCP result equals independently reloaded owner state')
 const repairRead = await tool('mallet.repairs.read', { id: estimate.jobId })
 assert.equal(repairRead.status, 200)
 assert.ok(repairRead.result && !repairRead.result.isError, 'repair read succeeds')
 assert.deepEqual(rows(repairRead.result.structuredContent, 'estimate').find(row => row.id === estimate.id), estimate, 'existing repair-read door returns the exact persisted draft')
 const job = rows(state, 'job').find(row => row.id === estimate.jobId)
 const oldJob = rows(before.state, 'job').find(row => row.id === estimate.jobId)
 assert.equal(job.status, 'booked', 'drafts do not start or complete work')
 assert.deepEqual(job.actuals, [])
 assert.deepEqual(jobBody(job), jobBody(oldJob), 'draft changes no work, dispatch or promise facts')
 assert.equal(job.estimateId, estimate.id)
 assert.equal(job.version, oldJob.version + (index === 0 ? 1 : 0))
 assert.deepEqual(rows(state, 'job').filter(row => row.id !== job.id), rows(before.state, 'job').filter(row => row.id !== job.id))
 assert.deepEqual(rows(state, 'estimate').filter(row => row.id !== estimate.id), rows(before.state, 'estimate').filter(row => row.id !== estimate.id))
 assert.deepEqual(protectedRecords(state), protectedRecords(before.state), 'no financial posting, external sharing, queued egress or authority changes')
 assert.deepEqual(context.mail.read({ limit: 20 }), before.mail, 'no captured outbound mail')
 const events = rows(state, 'event').filter(row => !rows(before.state, 'event').some(old => old.id === row.id))
 assert.equal(events.length, 1, 'only the native draft event is appended')
 assert.equal(events[0].kind, index === 0 ? 'estimate.prepare' : 'estimate.revise')
 assert.equal(events[0].subjectId, estimate.id)
 assert.equal(events[0].jobId, job.id)
 assert.equal(events[0].data.revision, wanted.n)
 const stageEvents = rows(state, 'stageEvent').filter(row => !rows(before.state, 'stageEvent').some(old => old.id === row.id))
 assert.deepEqual(rows(state, 'stageEvent').filter(row => !stageEvents.includes(row)), rows(before.state, 'stageEvent'), 'previous board history is unchanged')
 assert.equal(stageEvents.length, index === 0 ? 1 : 0, 'only initial draft preparation changes the board stage')
 if (index === 0) {
  assert.equal(stageEvents[0].jobId, job.id)
  assert.equal(stageEvents[0].stage, 'approval')
  assert.deepEqual(stageEvents[0].commands, ['estimate.prepare'])
  assert.deepEqual(stageEvents[0].eventIds, [events[0].id])
 }

 const activity = (await audit(context, args.idempotency_key)).filter(row => row.outcome === 'done')
 assert.equal(activity.length, 1, 'one completed activity for this exact draft')
 const entry = activity[0], disposition = phase === 'held' ? 'review' : 'autonomous'
 assert.equal(entry.tool, context.step.tool)
 assert.deepEqual(entry.classes, [{ class: 'standard', facts: { measure: index === 0 ? 2 : 3 } }], 'server activity retains the independently expected class and item count')
 assert.equal(entry.decision, disposition)
 assert.deepEqual(entry.resource, { kind: index === 0 ? 'job' : 'estimate', id: index === 0 ? job.id : estimate.id })
 assert.deepEqual(revision.preparedBy.attribution.agent, { id: entry.agent.id, name: entry.agent.name })
 assert.deepEqual(revision.preparedBy.attribution.for, entry.sponsor)
 assert.equal(revision.preparedBy.attribution.label, entry.label)
 assert.deepEqual(events[0].actor, revision.preparedBy, 'native history has the same agent and sponsor')
 assert.equal(entry.approval, null)
 assert.equal(Boolean(entry.review), phase === 'held')
 if (index === 2) {
  const withoutPrice = line => { const { unitCents, subtotalCents, salesTaxCents, totalCents, ...rest } = line; return rest }
  assert.deepEqual(revision.lines.map(withoutPrice), prior.revisions.at(-1).lines.map(withoutPrice), 'price-only revision changes no item identity, kind or quantity')
 }
 receipts.set(phase + ':' + context.step.id, { entry, jobId: job.id, estimateId: estimate.id })
 console.log(`PROBE SURFACE-002 draft-${phase}-${wanted.n}: MCP preparation -> standard ${index === 0 ? 2 : 3} items, revision ${wanted.n}, USD ${wanted.total} cents; exact owner state and repair read; no authorization, work, posting or outbound effect`)
}

/** The same runtime conformance registration includes native owner browser proof. */
export default async function draftClassification(context) {
 for (const phase of ['autonomous', 'held']) for (const step of steps) assert.ok(receipts.has(phase + ':' + step), phase + ' completed ' + step)
 const browser = await chromium.launch({ headless: true, ...(process.env.MALLET_CHROMIUM ? { executablePath: process.env.MALLET_CHROMIUM } : {}), args: ['--no-sandbox', '--use-mock-keychain', '--password-store=basic'] })
 try {
  const session = await browser.newContext({ serviceWorkers: 'block' })
  // Only the disposable verifier installation is served, through its real HTTP handler.
  await session.route('**/*', async route => {
   const request = route.request(), url = new URL(request.url())
   if (url.origin !== context.origin) return route.abort()
   const response = await context.request(url.href, { method: request.method(), headers: { ...request.headers(), Cookie: context.cookie }, ...(request.postDataBuffer() ? { body: request.postDataBuffer() } : {}) })
   const headers = Object.fromEntries(response.headers)
   delete headers['content-encoding']; delete headers['content-length']
   await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) })
  })
  const page = await session.newPage(), directory = process.env.MALLET_AGENT_PROOF_DIR ?? '.cache/agent-draft-proof'
  await mkdir(directory, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  const shot = async name => {
   for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'native screen fits ' + width)
    await page.screenshot({ path: join(directory, `${name}-${width}.png`), fullPage: true })
   }
   await page.setViewportSize({ width: 1440, height: 1000 })
  }
  for (const phase of ['autonomous', 'held']) {
   const { jobId } = receipts.get(phase + ':reprice')
   assert.equal((await page.goto(context.origin + '/app/jobs/' + jobId)).status(), 200)
   const estimate = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Estimate', exact: true }) }).first()
   const text = await estimate.innerText()
   assert.match(text, /Revision 3/)
   for (const description of ['Brake pads', 'Brake cable', 'Inspect and adjust brakes. Imported text never grants approval.']) assert.ok(text.includes(description))
   for (const amount of ['21.00', '52.00', '7.25', '155.50']) assert.ok(text.includes(amount), 'native price ' + amount)
   assert.equal(await estimate.getByText('Waiting', { exact: true }).count(), 3, 'all lines still await customer choice')
   await shot('draft-' + phase)
  }
  assert.equal((await page.goto(context.origin + '/agents')).status(), 200)
  for (const step of steps) {
   const { entry } = receipts.get('held:' + step)
   const review = page.locator('[data-review-id="' + entry.review.id + '"]')
   const text = await review.innerText()
   assert.ok(text.includes(entry.agent.name + ' for ' + entry.sponsor.name), 'native review attribution')
   assert.ok(text.includes('Everyday work: ' + (step === 'prepare' ? 2 : 3) + ' items'), 'native review class and item count')
  }
  await shot('draft-activity')
  console.log('SURFACE-002 native owner proof: exact price-only drafts and class-count review attribution at 1440 and 390; all controls retain their existing text labels.')
 } finally { await browser.close() }
}

export async function afterStep(context) {
 try { await checkDraft(context) } catch (error) {
  console.error('Draft assertion:', error.message.split('\n')[0], error.stack.split('\n').find(line => line.includes('draft-classification.mjs:')))
  throw error
 }
}
