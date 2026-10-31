import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { personDoor, revisionFixtures } from './fixtures.mjs'

const completed = new Set()
const revisionLines = () => [
 { kind: 'labor', description: 'Synthetic two-hour cable adjustment', quantity: 2, unitCents: 2300 },
 { kind: 'part', description: 'Synthetic replacement brake cable', quantity: 3, unitCents: 700 },
]

async function auditRows(json) {
 const rows = []
 let after = '0'
 for (let page = 0; page < 100; page++) {
  const result = await json('/agents/api/audit?' + new URLSearchParams({ after }))
  assert.equal(result.differs_from_policy, 0)
  rows.push(...result.rows)
  if (result.cursor === null || result.cursor === after) return rows
  after = result.cursor
 }
 assert.fail('Classification audit pagination must terminate')
}

/** A native business refusal must retain independently expected computed facts. */
export async function afterStep(context) {
 const { phase, step, tool } = context
 if (!['autonomous', 'held'].includes(phase) || step.id !== 'revise') return
 const json = personDoor(context), { frozen, draft } = await revisionFixtures(context)
 const disposition = phase === 'held' ? 'review' : 'autonomous'
 const revision = (await json('/agents/api/state')).policy.revision
 assert.ok(Number.isSafeInteger(revision) && revision > 0)
 const classes = [{ class: 'standard', facts: { measure: 2 } }]
 const rules = [{ class: 'standard', rule: phase === 'held' ? 'standard' : 'all', do: disposition }]
 const decisionClasses = [{ ...classes[0], ...rules[0] }]
 const beforeReviews = (await json('/agents/api/reviews')).reviews
 const before = await json('/api/mallet/state')
 assert.deepEqual(before.records.estimate.find(row => row.id === frozen.id), frozen)
 assert.equal(frozen.status, 'authorised')
 assert.equal(frozen.authorisation.revision, 1)
 const key = randomUUID()
 const refused = await tool('mallet.estimates.revise', { estimateId: frozen.id, version: frozen.version,
  revision: frozen.revisions.at(-1).n, lines: revisionLines(), notes: 'Synthetic exact two-line revision', idempotency_key: key })
 assert.deepEqual(await json('/api/mallet/state'), before,
  'Refusal immediately preserves estimates, customer decisions, work, invoices and successful business events')
 assert.equal(refused.status, 200)
 assert.equal(refused.result.isError, true)
 assert.equal(refused.result._meta['com.runeditrun/error'].code, 'estimate_frozen')
 assert.equal(refused.decision.disposition, disposition)
 assert.equal(refused.decision.revision, revision)
 assert.deepEqual(refused.decision.classes, decisionClasses)
 assert.equal(refused.result._meta['com.runeditrun/review'], undefined)
 assert.deepEqual((await json('/agents/api/reviews')).reviews, beforeReviews, 'A refusal never enters the completed review feed')
 const matching = (await auditRows(json)).filter(row => row.id === refused.decision.id)
 assert.equal(matching.length, 1)
 const [row] = matching
 assert.equal(row.tool, 'mallet.estimates.revise')
 assert.deepEqual(row.resource, { kind: 'estimate', id: frozen.id })
 assert.equal(row.idempotency_key, key)
 assert.equal(row.outcome, 'refused')
 assert.equal(row.code, 'estimate_frozen')
 assert.deepEqual(row.classes, classes)
 assert.equal(row.revision, revision)
 assert.equal(row.decision, disposition)
 assert.deepEqual(row.rules, rules)
 assert.equal(row.review, null)
 const activity = await context.request(context.origin + '/agents', { headers: { Cookie: context.cookie } })
 assert.equal(activity.status, 200)
 assert.match(await activity.text(), /Refused: estimate frozen/)

 const success = await tool('mallet.estimates.revise', { estimateId: draft.id, version: draft.version,
  revision: draft.revisions.at(-1).n, lines: revisionLines(), notes: 'Synthetic exact two-line revision', idempotency_key: randomUUID() })
 assert.equal(success.status, 200)
 assert.ok(!success.result.isError)
 assert.equal(success.decision.revision, revision)
 assert.equal(success.decision.disposition, disposition)
 assert.deepEqual(success.decision.classes, decisionClasses)
 const result = success.result.structuredContent
 assert.equal(result.id, draft.id)
 assert.equal(result.version, draft.version + 1)
 assert.equal(result.status, 'draft')
 assert.equal(result.authorisation, null)
 assert.equal(result.revisions.length, 2)
 assert.deepEqual(result.revisions[0], draft.revisions[0])
 assert.equal(result.revisions[1].n, 2)
 assert.equal(result.revisions[1].notes, 'Synthetic exact two-line revision')
 assert.deepEqual(result.revisions[1].lines.map(({ kind, description, quantityMilli, unitCents }) => ({ kind, description, quantityMilli, unitCents })), [
  { kind: 'labor', description: 'Synthetic two-hour cable adjustment', quantityMilli: 2000, unitCents: 2300 },
  { kind: 'part', description: 'Synthetic replacement brake cable', quantityMilli: 3000, unitCents: 700 },
 ])
 assert.equal(result.revisions[1].totals.totalCents, 6700)
 const after = await json('/api/mallet/state')
 assert.deepEqual(after.records.estimate.find(row => row.id === draft.id), result, 'The separate draft persists the exact requested revision')
 assert.deepEqual(after.records.estimate.find(row => row.id === frozen.id), frozen, 'The success control leaves the customer-authorized estimate unchanged')
 if (phase === 'held') {
  const review = success.result._meta['com.runeditrun/review']
  assert.ok(review?.id)
  assert.ok((await json('/agents/api/reviews')).reviews.some(row => row.id === review.id && row.decision_id === success.decision.id))
 }
 completed.add(phase)
 console.log(`PROBE BASE-AGENT-006 point-6 ${phase}: native customer authorization then two-line mallet.estimates.revise -> estimate_frozen, standard measure 2, policy revision ${revision}, refused audit, no review or native changes; separate draft persisted exact two-line revision totaling 6700 cents.`)
}

export default async function refusedClassification() {
 assert.deepEqual([...completed].sort(), ['autonomous', 'held'], 'Both mandatory policy phases must qualify the native refusal')
}
