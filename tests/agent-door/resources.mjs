import assert from 'node:assert/strict'
import { totpCode } from '../support/second-factor.mjs'

const readers = new Map()
const families = { assets: 'asset', jobs: 'job', estimates: 'estimate', invoices: 'invoice' }
const kinds = new Set([...Object.values(families), 'proposal', 'approval', 'export', 'taxSettings'])
const untrusted = 'com.runeditrun/untrusted'

export function nativeJson({ request, origin, cookie }) {
 return async (path, body, method = body === undefined ? 'GET' : 'POST') => {
  const response = await request(origin + path, { method, redirect: 'manual', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
   ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  assert.equal(response.status, 200, `Native resource witness ${path} succeeds`)
  return response.json()
 }
}

export function resourceClient({ request, origin, token }) {
 let id = 0
 return async (method, params = {}) => {
  const response = await request(origin + '/mcp', { method: 'POST', headers: { Origin: origin, Accept: 'application/json', 'Content-Type': 'application/json',
   'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': method,
   ...(method === 'resources/read' ? { 'Mcp-Name': params.uri } : {}),
   ...(method === 'tools/call' ? { 'Mcp-Name': params.name } : {}),
   ...(token ? { Authorization: `Bearer ${token}` } : {}) },
   body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }) })
  return { status: response.status, body: await response.json() }
 }
}

export function content(answer, label) {
 assert.equal(answer.status, 200, label)
 assert.equal(answer.body.error, undefined, label)
 assert.equal(answer.body.result.contents.length, 1, label)
 const record = answer.body.result.contents[0]
 assert.equal(record._meta?.[untrusted], true, label + ' marks customer text untrusted')
 assert.equal(record.mimeType, 'application/json', label)
 return JSON.parse(record.text)
}

// Compare retained native records, rather than deriving expectations from a tool result.
export function preparationRecord(value) {
 if (Array.isArray(value)) return value.map(preparationRecord)
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !['fleet', 'billing', 'sublets'].includes(key)).map(([key, item]) => [key, preparationRecord(item)]))
 return value
}

async function reader(context) {
 if (readers.has(context.origin)) return readers.get(context.origin)
 const native = nativeJson(context)
 const begun = await native('/api/mallet/security/totp/begin', {})
 await native('/api/mallet/security/totp/confirm', { code: totpCode(begun.secret) })
 const key = await native('/api/mallet/commands', { command: 'agent.create', input: { label: 'synthetic-mallet-resource-reader' } })
 const value = { native, key, mcp: resourceClient({ ...context, token: key.token }) }
 readers.set(context.origin, value)
 return value
}

/** The existing conformance phases exercise every preparation and its retained links. */
export async function afterStep(context) {
 const { phase, step, result } = context
 if (!['autonomous', 'held'].includes(phase)) return
 const { native, mcp } = await reader(context)
 const state = await native('/api/mallet/state')
 const disposition = phase === 'held' ? 'review' : 'autonomous'
 const read = async uri => {
  const answer = await mcp('resources/read', { uri })
  assert.equal(answer.body.result?._meta?.['com.runeditrun/decision']?.disposition, disposition, 'Resource uses the current conformance policy')
  return content(answer, 'Retained resource readback')
 }
 if (['prepare', 'revise', 'invoice'].includes(step.id)) {
  const family = step.id === 'invoice' ? 'invoices' : 'estimates', kind = families[family]
  const expected = state.records[kind].find(row => row.id === result.id)
  assert.ok(expected, 'The native state independently retains the prepared record')
  assert.deepEqual(await read(`mallet://${family}/${result.id}`), preparationRecord(expected), 'The link reads the exact retained native record and version')
  assert.equal(expected.version, result.version)
  assert.match(JSON.stringify(expected.preparedBy ?? expected.revisions.at(-1).preparedBy), / for /, 'Native readback retains agent attribution')
  if (step.id === 'invoice') {
   const approved = await native('/api/mallet/commands', { command: 'invoice.approve', input: { invoiceId: expected.id, version: expected.version, revision: expected.revision } })
   const exported = await native('/api/mallet/commands', { command: 'invoice.export', input: { invoiceId: approved.id, version: approved.version } })
   const saved = await native('/api/mallet/state')
   assert.deepEqual(await read(`mallet://invoices/${expected.id}`), preparationRecord(saved.records.invoice.find(row => row.id === expected.id)), 'The original preparation link reflects the exact retained invoice after a native decision')
   const graph = await read(`mallet://repairs/${expected.jobId}`)
   assert.deepEqual(graph.records.export.find(row => row.id === exported.id), preparationRecord(saved.records.export.find(row => row.id === exported.id)), 'Repair resource readback retains the existing native export text and identity')
   assert.equal(graph.records.export.find(row => row.id === exported.id).csv, exported.csv)
   console.log(`PROBE BASE-AGENT-003 retained-invoice-export-${phase}: native person approval and export -> original preparation link reads current invoice and exact retained CSV record`)
  }
 }
 if (step.id === 'dispatch' || step.id === 'read') {
  const id = step.id === 'dispatch' ? result.jobId : context.args.id
  const graph = await read(`mallet://repairs/${id}`)
  const nativeJob = state.records.job.find(row => row.id === id)
  assert.deepEqual(graph.records.job.find(row => row.id === id), preparationRecord(nativeJob))
  for (const [kind, rows] of Object.entries(graph.records)) {
   assert.ok(kinds.has(kind), 'Only adopted preparation records are returned')
   for (const row of rows) assert.deepEqual(row, preparationRecord(state.records[kind].find(saved => saved.id === row.id)), 'Every graph record matches independent native state')
  }
  assert.deepEqual(await read(`mallet://jobs/${id}`), preparationRecord(nativeJob))
  assert.deepEqual(await read(`mallet://assets/${nativeJob.assetId}`), preparationRecord(state.records.asset.find(row => row.id === nativeJob.assetId)))
  if (step.id === 'dispatch') {
   const saved = state.records.proposal.find(row => row.id === result.id)
   assert.ok(saved, 'Dispatch created a native proposal')
   assert.deepEqual(graph.records.proposal.find(row => row.id === saved.id), saved, 'Repair link retains the exact proposal identity and version')
   assert.equal(saved.version, result.version)
   assert.equal(saved.jobVersion, nativeJob.version)
   assert.equal(saved.status, 'pending', 'Resource readback does not apply the proposal')
   assert.notEqual(saved.plan.bayId, nativeJob.bayId, 'The proposed plan remains separate from current dispatch')
  }
 }
 console.log(`PROBE BASE-AGENT-003 retained-${step.id}-${phase}: MCP resource read -> exact native identity, version, untrusted marker and ${disposition} decision`)
}

/** Finishes the same runtime journey with refusal and revocation, without content. */
async function resources(context) {
 const { native, mcp, key } = await reader(context)
 const state = await native('/api/mallet/state'), job = state.records.job[0]
 assert.ok(job, 'Resource refusals use populated native records')
 const templates = await mcp('resources/templates/list'), repeated = await mcp('resources/templates/list')
 assert.deepEqual(templates.body.result, repeated.body.result, 'Resource catalogue is deterministic')
 assert.equal(templates.body.result.cacheScope, 'private')
 assert.ok(Number.isFinite(templates.body.result.ttlMs))
 for (const family of ['assets', 'repairs', 'jobs', 'estimates', 'invoices']) {
  const answer = await mcp('resources/read', { uri: `mallet://${family}/synthetic-mallet-missing` })
  assert.equal(answer.body.error.data.code, 'resource_unavailable')
  assert.equal(answer.body.result, undefined, 'Missing resources disclose no content')
 }
 const malformed = await mcp('resources/read', { uri: 'mallet://assets/%ZZ' })
 assert.equal(malformed.body.error.data.code, 'resource_unavailable')
 const before = await native('/api/mallet/state')
 const anonymous = await resourceClient(context)('resources/read', { uri: `mallet://repairs/${job.id}` })
 assert.equal(anonymous.status, 401)
 assert.equal(anonymous.body.result, undefined)
 await native('/api/mallet/commands', { command: 'agent.revoke', input: { id: key.id } })
 const afterRevocation = await native('/api/mallet/state')
 for (const [kind, rows] of Object.entries(before.records)) if (kind !== 'audit') assert.deepEqual(afterRevocation.records[kind], rows, 'Explicit key revocation changes no business records')
 const revoked = await mcp('resources/read', { uri: `mallet://repairs/${job.id}` })
 assert.equal(revoked.status, 401)
 assert.equal(revoked.body.result, undefined, 'Revoked native credentials disclose no resource content')
 assert.deepEqual((await native('/api/mallet/state')).records, afterRevocation.records, 'Refused reads preserve every business record')
 console.log('PROBE BASE-AGENT-003 refusals: missing and malformed IDs, anonymous and revoked native key -> no content and unchanged business state')
 readers.delete(context.origin)
}

export default async function resourceJourney(context) {
 try { await resources(context) }
 catch (error) { console.error('Resource refusal journey:', error.message.split('\n', 1)[0]); throw error }
}
