import assert from 'node:assert/strict'

/** Native records are created by the owner, including each member assignment. */
export default async function prepare({ phase, request, origin, cookie }) {
 if (phase !== 'replay' && !phase.startsWith('cross-sponsor:')) return { values: {} }
 const json = async (path, body) => {
  const response = await request(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
   headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  assert.equal(response.status, 200, 'native agent fixture request')
  return response.json()
 }
 const command = (command, input) => json('/api/mallet/commands', { command, input })
 const owner = (await json('/auth/session')).operator
 if (phase === 'replay') {
  const asset = await command('asset.create', { customerName: 'Cedar Replay Workshop', label: 'Commuter bicycle', identifier: 'REPLAY-ADMISSION' })
  await command('job.book', { assetId: asset.id, version: asset.version, title: 'Replay admission brake estimate', technicianId: owner.id, bayId: 'Replay bench', startAt: '2028-12-10T09:00:00Z', endAt: '2028-12-10T10:00:00Z' })
  return { values: {} }
 }
 const label = phase.slice('cross-sponsor:'.length)
 const people = (await json('/auth/operators')).operators
 const member = people.find(person => person.displayName === label)
 assert.equal(member?.role, 'member')
 assert.equal(member?.status, 'active')
 const create = async (technicianId, title, identifier, day) => {
  const asset = await command('asset.create', { customerName: title + ' customer', label: title + ' bicycle', identifier })
  const job = await command('job.book', { assetId: asset.id, version: asset.version, title, technicianId, bayId: title + ' bench',
   startAt: `2028-12-${day}T09:00:00Z`, endAt: `2028-12-${day}T10:00:00Z` })
  return { job, asset }
 }
 const ownerRepair = await create(owner.id, 'Private owner brake assessment', 'SYNTHETIC-MALLET-OWNER', 11)
 const memberRepair = await create(member.id, 'Assigned member wheel assessment', 'SYNTHETIC-MALLET-MEMBER', 12)
 return { values: { crossSponsor: { owner: ownerRepair, member: memberRepair, ownerId: owner.id, memberId: member.id } } }
}
