import assert from 'node:assert/strict'
import { preparePrompts } from './prompts.mjs'
import { randomUUID } from 'node:crypto'

export function personDoor({ request, origin, cookie }) {
 return async (path, body) => {
  const response = await request(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
   headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  assert.equal(response.status, 200, 'native classification fixture request')
  return response.json()
 }
}

/** Separate person-created repairs keep the refusal independent of a consumed agent draft. */
export async function revisionFixtures(context) {
 const json = personDoor(context), command = (command, input) => json('/api/mallet/commands', { command, input })
 const technicianId = (await json('/auth/session')).operator.id
 const day = context.phase === 'autonomous' ? '08' : '09'
 const estimates = []
 for (const [index, frozen] of [true, false].entries()) {
  const label = `synthetic-mallet-classification-${context.phase}-${frozen ? 'frozen' : 'draft'}`
  const asset = await command('asset.create', { customerName: label, label: 'Workshop bicycle', identifier: randomUUID() })
  const hour = index === 0 ? '09' : '11', end = index === 0 ? '10' : '12'
  const job = await command('job.book', { assetId: asset.id, version: asset.version, title: label, technicianId, bayId: label,
   startAt: `2029-01-${day}T${hour}:00:00Z`, endAt: `2029-01-${day}T${end}:00:00Z` })
  let estimate = await command('estimate.prepare', { jobId: job.id, version: job.version,
   lines: [{ kind: 'labor', description: 'Original brake inspection', quantity: 1, unitCents: 1700 }] })
  if (frozen) {
   estimate = await command('estimate.approve', { estimateId: estimate.id, version: estimate.version, revision: 1 })
   estimate = await command('estimate.markSent', { estimateId: estimate.id, version: estimate.version, revision: 1, method: 'printed' })
   estimate = await command('estimate.authorise', { estimateId: estimate.id, version: estimate.version, revision: 1,
    lineIds: estimate.revisions[0].lines.map(line => line.id), customerName: label, method: 'signed', evidence: 'Synthetic customer signed the exact printed original brake inspection.' })
  }
  estimates.push(estimate)
 }
 return { frozen: estimates[0], draft: estimates[1] }
}

/** A new native repair keeps replay admission independent of consumed drafts. */
export default async function prepare(context) {
 const { phase, request, origin, cookie } = context
 try { if (phase === 'autonomous') await preparePrompts(context) } catch (error) { console.error('Prompt preparation assertion:', error.message); throw error }
 if (phase !== 'replay') return { values: {} }
 const json = async (path, body) => {
  const response = await request(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
   headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  assert.equal(response.status, 200, 'native replay fixture request')
  return response.json()
 }
 const command = (command, input) => json('/api/mallet/commands', { command, input })
 const technicianId = (await json('/auth/session')).operator.id
 const asset = await command('asset.create', { customerName: 'Cedar Replay Workshop', customerEmail: '', label: 'Commuter bicycle', identifier: 'REPLAY-ADMISSION' })
 await command('job.book', { assetId: asset.id, version: asset.version, title: 'Replay admission brake estimate', technicianId, bayId: 'Replay bench', startAt: '2028-12-10T09:00:00Z', endAt: '2028-12-10T10:00:00Z' })
 return { values: {} }
}
