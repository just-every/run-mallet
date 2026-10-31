import assert from 'node:assert/strict'
import { preparePrompts } from './prompts.mjs'

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
 const asset = await command('asset.create', { customerName: 'Cedar Replay Workshop', customerEmail: 'replay@example.invalid', label: 'Commuter bicycle', identifier: 'REPLAY-ADMISSION' })
 await command('job.book', { assetId: asset.id, version: asset.version, title: 'Replay admission brake estimate', technicianId, bayId: 'Replay bench', startAt: '2028-12-10T09:00:00Z', endAt: '2028-12-10T10:00:00Z' })
 return { values: {} }
}
