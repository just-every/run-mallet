import assert from 'node:assert/strict'

const completed = new Map()
export function nativeDoor({ request, origin, cookie }) {
 const fetch = (path, { method = 'GET', body, headers = {} } = {}) => request(origin + path, {
  method, redirect: 'manual', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
 })
 const json = async path => { const response = await fetch(path); assert.equal(response.status, 200, path); return response.json() }
 return { fetch, json, state: () => json('/api/mallet/state') }
}

export async function preparedAttribution(door, result, original) {
 const state = await door.state(), saved = state.records.estimate.find(row => row.id === result.id)
 assert.deepEqual(saved, result, 'Tool output equals independently reloaded native estimate')
 const rev = saved.revisions.at(-1), owner = state.actor
 const { agents } = await door.json('/agents/api/agents'), agent = agents.find(row => row.id === rev.preparedBy.id)
 assert.ok(agent, 'Saved preparer resolves to the native agent inventory')
 assert.deepEqual(agent.sponsor, { id: owner.id, name: owner.name })
 assert.notEqual(agent.id, owner.id, 'Agent and deciding person are distinct identities')
 const attribution = { agent: { id: agent.id, name: agent.name }, for: { id: owner.id, name: owner.name }, label: `${agent.name} for ${owner.name}` }
 assert.deepEqual(rev.preparedBy, { id: agent.id, name: attribution.label, role: 'agent', attribution, policyApprovers: [] })
 assert.equal(rev.approval, null, 'Policy review never substitutes for native estimate approval')
 assert.equal(saved.status, 'draft'); assert.equal(saved.authorisation, null); assert.deepEqual(saved.sent, [])
 assert.equal((state.records.approval ?? []).filter(row => row.subjectId === saved.id).length, 0)
 if (original) assert.deepEqual(saved.revisions[0], original, 'Revision retains the original exact preparation and attribution')
 return { state, saved, rev, owner, agent, attribution }
}

export async function approvedAttribution(door, before, saved) {
 const after = await door.state(), approved = after.records.estimate.find(row => row.id === saved.id)
 const revision = saved.revisions.at(-1), decidingPerson = before.actor
 assert.equal(approved.status, 'approved'); assert.equal(approved.version, saved.version + 1)
 const approval = approved.revisions.at(-1).approval
 assert.deepEqual(approval.by, decidingPerson); assert.ok(Number.isFinite(Date.parse(approval.at)))
 assert.deepEqual(approved.revisions, [...saved.revisions.slice(0, -1), { ...revision, approval }])
 const receipts = after.records.approval.filter(row => row.subjectId === saved.id)
 assert.equal(receipts.length, 1)
 assert.deepEqual(receipts[0], { id: receipts[0].id, version: 1, subjectKind: 'estimate', subjectId: saved.id,
  revision: revision.n, subjectVersion: approved.version, preparedBy: revision.preparedBy,
  approvedBy: decidingPerson, decision: 'approved', at: approval.at })
 assert.equal(approved.authorisation, null); assert.deepEqual(approved.sent, [])
 assert.deepEqual(after.records.estimate.filter(row => row.id !== saved.id), before.records.estimate.filter(row => row.id !== saved.id))
 for (const kind of new Set([...Object.keys(before.records), ...Object.keys(after.records)])) {
  if (!['estimate', 'approval', 'event', 'audit'].includes(kind)) assert.deepEqual(after.records[kind], before.records[kind], `Approval creates no ${kind} effect`)
 }
 const previousEvents = new Set(before.records.event.map(row => row.id))
 assert.deepEqual(after.records.event.filter(row => previousEvents.has(row.id)), before.records.event)
 const events = after.records.event.filter(row => !previousEvents.has(row.id))
 assert.equal(events.length, 1); assert.equal(events[0].kind, 'estimate.approve')
 assert.equal(events[0].subjectId, saved.id); assert.deepEqual(events[0].actor, decidingPerson)
 assert.equal(events[0].data.revision, revision.n)
 const previousAudits = new Set((before.records.audit ?? []).map(row => row.id))
 assert.deepEqual(after.records.audit.filter(row => previousAudits.has(row.id)), before.records.audit ?? [])
 const audits = after.records.audit.filter(row => !previousAudits.has(row.id))
 assert.equal(audits.length, 1); assert.equal(audits[0].action, 'estimate.approve'); assert.deepEqual(audits[0].actor, decidingPerson)
 assert.deepEqual(audits[0].changes.find(row => row.kind === 'estimate'), { kind: 'estimate', id: saved.id, beforeRevision: saved.version, afterRevision: approved.version })
 assert.equal(after.records.approval.length, (before.records.approval ?? []).length + 1)
 return approved
}

export async function afterStep(context) {
 const { phase, step, result, outputs } = context
 if (!['autonomous', 'held'].includes(phase) || !['prepare', 'revise'].includes(step.id)) return
 const door = nativeDoor(context), { state, saved } = await preparedAttribution(door, result, step.id === 'revise' ? outputs.prepare.revisions[0] : undefined)
 if (step.id !== 'revise') return
 const response = await door.fetch('/app/actions', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ command: 'estimate.approve', estimateId: saved.id, version: String(saved.version), revision: '2' }).toString() })
 assert.equal(response.status, 303, 'Signed-in owner approves through the native form action'); await response.body?.cancel()
 await approvedAttribution(door, state, saved)
 const phases = completed.get(context.origin) ?? new Set(); phases.add(phase); completed.set(context.origin, phases)
 console.log(`Native attribution ${phase}: exact agent revisions retained; separate signed-in owner approval; no customer, work, sharing or financial effect.`)
}

export default async function nativeAttribution({ origin }) {
 assert.deepEqual([...completed.get(origin) ?? []].sort(), ['autonomous', 'held'], 'Both mandatory policy phases compare native preparation and approval records')
 completed.delete(origin)
}
