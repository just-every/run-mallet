import assert from 'node:assert/strict'

/** Each policy and replay receives an independently booked native repair. */
export default async function prepare({ phase, request, origin, cookie }) {
 if (!['autonomous', 'held', 'replay'].includes(phase)) return { values: {} }
 const json = async (path, body) => {
  const response = await request(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
   headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  assert.equal(response.status, 200, 'native draft fixture request')
  return response.json()
 }
 const command = (command, input) => json('/api/mallet/commands', { command, input })
 const technicianId = (await json('/auth/session')).operator.id
 const day = { autonomous: 10, held: 11, replay: 12 }[phase]
 const asset = await command('asset.create', { customerName: 'Cedar Draft Workshop', label: 'Commuter bicycle', identifier: `synthetic-mallet-draft-${phase}` })
 const job = await command('job.book', { assetId: asset.id, version: asset.version, title: `Draft classification ${phase}`, technicianId, bayId: `Draft bench ${phase}`, startAt: `2028-12-${day}T09:00:00Z`, endAt: `2028-12-${day}T10:00:00Z` })
 return { values: { draftRepair: { id: job.id, version: job.version } } }
}
