import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createProtocol } from '../../src/modules/agent-door/conformance/protocol.mjs'
import { crossSponsorPhase } from '../../src/modules/agent-door/conformance/sponsors.mjs'
import prepare from './fixtures.mjs'
import { memberInstallation } from './installation.mjs'
import { memberScreens } from './screens.mjs'

const surface = JSON.parse(await readFile(new URL('../../agent-surface.json', import.meta.url), 'utf8'))
await memberInstallation(process.cwd(), surface, async ({ request, origin, signer, business, sponsors, database }) => {
 const points = [], person = sponsors[0]
 const c = createProtocol({ fetch: request, origin, surface, signer, business, person, consent: randomUUID(), points,
  agentId: `rer-conformance-${randomUUID()}`, seq: 0, revision: 0, listed: new Map(),
  prepare: args => prepare({ ...args, request, origin, cookie: person.cookie, database }) })
 c.sponsor.id = (await c.personJson('/auth/session')).operator.id
 await crossSponsorPhase(c, sponsors, undefined, memberScreens)
 for (const point of points) console.log(`${point.ok ? 'PASS' : 'FAIL'} ${point.id}${point.ok ? '' : ': ' + point.detail}`)
 assert.ok(points.length > 0 && points.every(point => point.ok), 'native member conformance must execute and pass')
 console.log(`Native multi-sponsor conformance: ${points.length}/${points.length} points passed`)
})
