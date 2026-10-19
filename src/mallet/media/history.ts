import { fail, object, text } from '../model'
import type { Actor, Authority, FindingRow, Observation } from './types'
import { findingView } from './types'
import { identifier } from './validation'
import { assertion, findingScope, guarded, jobScope, readRows, scopeAssertion } from './storage'
import { createFinding, listFindings } from './service'

type Job = { id: string; assetId: string; startAt: string; title: string; technicianId: string }
async function jobValue(db: D1Database, scope: Awaited<ReturnType<typeof jobScope>>): Promise<Job> {
 const [row] = await readRows<{ value: string }>(db, scope, "SELECT value FROM mallet_records WHERE kind='job' AND id=?", [scope.jobId])
 return JSON.parse(row.value)
}
export async function inspectionHistory(db: D1Database, actor: Actor, authority: Authority, jobId: string) {
 const scope = await jobScope(db, actor, authority, jobId), current = await jobValue(db, scope)
 const jobs = await readRows<{ value: string }>(db, scope, `SELECT value FROM mallet_records WHERE kind='job' AND json_extract(value,'$.assetId')=? AND (id=? OR json_extract(value,'$.startAt')<?) ${actor.role === 'member' ? "AND json_extract(value,'$.technicianId')=?" : ''} ORDER BY json_extract(value,'$.startAt'),id`, [current.assetId, current.id, current.startAt, ...(actor.role === 'member' ? [actor.id] : [])])
 const visits = []
 for (const row of jobs) {
  const job = JSON.parse(row.value) as Job, priorScope = await jobScope(db, actor, authority, job.id)
  const findings = (await listFindings(db, actor, authority, job.id)).findings
  const resolutions = await readRows<any>(db, priorScope, 'SELECT * FROM mallet_media_resolutions WHERE job_id=?', [job.id])
  const declined = await readRows<{ value: string }>(db, priorScope, "SELECT value FROM mallet_records WHERE kind='declinedWork' AND json_extract(value,'$.jobId')=?", [job.id])
  visits.push({ job, findings: findings.map(f => ({ ...f, resolution: resolutions.find(r => r.finding_id === f.id) ?? null })), declined: declined.map(r => JSON.parse(r.value)) })
 }
 return { jobId, assetId: current.assetId, visits }
}
export async function carryFinding(db: D1Database, actor: Actor, authority: Authority, value: unknown) {
 const p = object(value), targetId = identifier(p.jobId, 'jobId'), sourceId = identifier(p.findingId, 'findingId')
 const source = await findingScope(db, actor, authority, sourceId), targetScope = await jobScope(db, actor, authority, targetId)
 const prior = await jobValue(db, source.scope), target = await jobValue(db, targetScope), finding = findingView(source.row)
 if (prior.assetId !== target.assetId || prior.id === target.id || prior.startAt >= target.startAt) fail('INSPECTION_VISIT', 'Carry evidence only to a later visit for the same vehicle.', null, 400)
 if (finding.carriedFrom) fail('INSPECTION_SOURCE', 'Carry the original finding, preserving its original observation and provenance.', null, 400)
 const observation = finding.observation as Observation | null
 if (!observation?.recommendation) fail('INSPECTION_RESOLVED', 'Choose an unresolved recommendation.')
 const declinedWorkId = p.declinedWorkId ? identifier(p.declinedWorkId, 'declinedWorkId') : null
 const guards = [scopeAssertion(source.scope), assertion('NOT EXISTS(SELECT 1 FROM mallet_media_resolutions WHERE finding_id=?)', [sourceId])]
 if (declinedWorkId) guards.push(assertion("EXISTS(SELECT 1 FROM mallet_records WHERE kind='declinedWork' AND id=? AND json_extract(value,'$.jobId')=?)", [declinedWorkId, prior.id]))
 // Both native assignment scopes and the unresolved state are rechecked in the
 // transaction that creates the carry. The source ID is its idempotency key.
 const existing = await readRows<FindingRow>(db, targetScope, 'SELECT * FROM mallet_media_findings WHERE job_id=? AND client_id=?', [target.id, sourceId])
 if (existing.length) {
  const view = findingView(existing[0])
  if (view.carriedFrom?.id !== sourceId || view.carriedFrom.declinedWorkId !== declinedWorkId) fail('MEDIA_REPLAY', 'This carried finding already has different decision evidence.')
  await guarded(db, targetScope, guards)
  return view
 }
 const input = { jobId: target.id, clientId: sourceId, title: finding.title, capturedAt: finding.capturedAt, carriedFrom: { id: sourceId, jobId: prior.id, title: finding.title, capturedAt: finding.capturedAt, by: finding.by, ...observation, declinedWorkId } }
 // createFinding performs its own target guard; the source and resolution
 // assertions below must be in that same write transaction.
 return createFinding(db, actor, authority, input, [source.scope], guards.slice(1))
}
export async function resolveFinding(db: D1Database, actor: Actor, authority: Authority, id: string, value: unknown) {
 const { scope, row } = await findingScope(db, actor, authority, id), p = object(value), reason = text(p.reason, 'resolution reason', 2000)
 if (!findingView(row).observation?.recommendation) fail('INSPECTION_SOURCE', 'Resolve the original recommendation, not a carried reference.')
 const request = JSON.stringify({ reason, by: actor }), now = new Date().toISOString()
 const result = await guarded(db, scope, [
  { sql: 'INSERT OR IGNORE INTO mallet_media_resolutions(finding_id,job_id,reason,actor_json,resolved_at,request_json) VALUES(?,?,?,?,?,?)', params: [id, scope.jobId, reason, JSON.stringify(actor), now, request] },
  assertion('EXISTS(SELECT 1 FROM mallet_media_resolutions WHERE finding_id=? AND request_json=?)', [id, request]),
  { sql: 'SELECT * FROM mallet_media_resolutions WHERE finding_id=?', params: [id] }
 ])
 return result[2].results[0]
}
