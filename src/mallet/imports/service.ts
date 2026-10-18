import { resumeD1Import, applyD1ImportBatches, createD1ImportJob, planD1Import, readD1ImportJob, readD1ImportOriginals, undoD1Import, type D1Database } from '../../modules/import-kit/src/d1/index.ts'
import { stored, boundary } from '../../modules/import-kit/src/d1/jobs.ts'
import { readAtomic } from '../../modules/import-kit/src/d1/database.ts'
import { d1RequestContext, type Json } from '../../modules/import-kit/src/d1/index.ts'
import { assetTargets } from './targets.ts'
import { authorize, importContext } from './context.ts'
import { kitName, snapshotSource, sourceLinks } from './snapshots.ts'
import { reject, type ApplyInput, type ImportActor, type ImportAuthority, type ImportJournal, type ImportPreview, type SnapshotInput } from './types.ts'

async function prepare(db: D1Database, actor: ImportActor, input: SnapshotInput, authority: ImportAuthority) {
  await authorize(db, actor, authority)
  const { source, mapping } = snapshotSource(input)
  const context = d1RequestContext(importContext(db, actor, authority))
  const plan = await planD1Import(source, mapping, context)
  const native = await assetTargets.list(context.storage.database, context.destination)
  for (const effect of plan.entries.flatMap(entry => entry.effects)) {
    const identifier = String((effect.value as Record<string, Json>).identifier).toLowerCase()
    if (native.some(row => row.targetId !== effect.targetId && String((row.value as Record<string, Json>).identifier).toLowerCase() === identifier))
      reject('IMPORT_DUPLICATE_IDENTIFIER', 'A vehicle on file already uses an imported plate or VIN.')
  }
  await authorize(context.storage.database, actor, authority)
  return { plan, context }
}

/** SELECT-only, including Base's current-authority fences. */
export async function preview(db: D1Database, actor: ImportActor, input: SnapshotInput, authority: ImportAuthority): Promise<ImportPreview> {
  const { plan } = await prepare(db, actor, input, authority)
  return { name: kitName, fingerprint: plan.fingerprint, counts: plan.counts, diagnostics: plan.diagnostics, links: sourceLinks(plan), plan }
}

/** Repeat the identical approved payload to resume a bounded apply batch. */
export async function apply(db: D1Database, actor: ImportActor, input: ApplyInput, authority: ImportAuthority) {
  if (typeof input?.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(input.fingerprint))
    reject('IMPORT_APPROVAL', 'Supply the exact fingerprint reviewed in preview.', 400)
  const { plan, context } = await prepare(db, actor, input, authority)
  if (plan.fingerprint !== input.fingerprint) reject('IMPORT_REVIEW_CHANGED', 'The snapshots changed. Preview and review the new fingerprint.')
  if (plan.diagnostics.some(item => item.severity === 'error')) reject('IMPORT_DIAGNOSTICS', 'Resolve the preview errors before applying.')
  context.reviewedFingerprint = input.fingerprint
  context.operationKey = `mallet-move-in:${input.fingerprint}`
  const job = await createD1ImportJob(plan, context)
  return applyD1ImportBatches(job.id, context)
}

function jobId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) reject('IMPORT_JOB_ID', 'Supply a valid import job ID.', 400)
}

/** Job, complete fingerprinted plan, mapped/source links and retained originals. */
export async function journal(db: D1Database, actor: ImportActor, id: string, authority: ImportAuthority): Promise<ImportJournal> {
  await authorize(db, actor, authority)
  jobId(id)
  const context = d1RequestContext(importContext(db, actor, authority))
  const job = await readD1ImportJob(id, context)
  const retained = await stored(id, context)
  const originals = await readD1ImportOriginals(id, context)
  // One final snapshot fence binds the public job and the full plan returned
  // here across the independent custody reads above.
  if (job.fingerprint !== retained.job.fingerprint || job.fence !== retained.job.fence)
    reject('IMPORT_JOURNAL_CHANGED', 'The import changed while its journal was being read. Refresh it.')
  const batches = await db.prepare('SELECT action,position,end_position,fence FROM ik_batches WHERE job_id=? ORDER BY fence,position').bind(id).all()
  await readAtomic(context, boundary(retained.job, retained.plan))
  return { job, plan: retained.plan, originals, links: sourceLinks(retained.plan), batches: batches.results }
}

/** Strict reversal: native edits, including a later booking, block removal. */
export async function undo(db: D1Database, actor: ImportActor, id: string, authority: ImportAuthority) {
  await authorize(db, actor, authority)
  jobId(id)
  return undoD1Import(id, importContext(db, actor, authority))
}

/** Continue from retained custody without re-uploading snapshots. */
export async function resume(db:D1Database, actor:ImportActor, id:string, authority:ImportAuthority) {
 await authorize(db,actor,authority);jobId(id)
 return resumeD1Import(id,importContext(db,actor,authority))
}
