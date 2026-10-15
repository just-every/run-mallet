import { retireD1ImportCustody, type D1Database, type Json } from '../../modules/import-kit/src/d1/index.ts'
import { guard } from '../../modules/import-kit/src/d1/database.ts'
import { authorize, destination, importContext } from './context.ts'
import { assetTargets } from './targets.ts'
import { reject, type EraseIntegration, type ImportActor, type ImportAuthority } from './types.ts'

/** Server-only: parent supplies native cleanup and portability's redaction
 * checkpoint. All effects, custody withdrawal and the receipt commit together. */
export async function erase(db: D1Database, actor: ImportActor, assetId: string, authority: ImportAuthority, integration: EraseIntegration) {
  await authorize(db, actor, authority)
  if (actor.role !== 'owner') reject('FORBIDDEN', 'Only the owner can erase an unused asset.', 403)
  if (typeof assetId !== 'string' || !assetId || assetId.length > 200) reject('IMPORT_ASSET_ID', 'Supply an asset ID.', 400)
  if (!integration || !Array.isArray(integration.nativeStatements) || !Array.isArray(integration.checkpoint) || !integration.checkpoint.length)
    reject('IMPORT_ERASURE_FENCE', 'Native cleanup SQL and a portability redaction checkpoint are required.')
  const context = importContext(db, actor, authority)
  // The public handler's role decision is repeated inside every atomic fence.
  const predicate = context.authorization.predicate
  context.authorization.predicate = (action, target) => {
    const grant = predicate(action, target)
    return { sql: `(${grant.sql}) AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`, params: [...grant.params ?? [], actor.id] }
  }
  const row = await assetTargets.read(db, destination, 'asset', assetId)
  if (!row) reject('NOT_FOUND', 'That asset does not exist.', 404)
  const visits = (row.value as Record<string, Json>).visits
  if (!Array.isArray(visits) || visits.length) reject('ASSET_IN_USE', 'Assets with visits retain their service and financial history and cannot be erased.')
  const imported = await db.prepare("SELECT id FROM mallet_import_revisions WHERE kind='asset' AND id=?").bind(assetId).first()
  if (!imported) {
    // An ordinary native asset has no kit custody to rewrite. Its deletion still
    // carries the same portability checkpoint, so an older archive is refused.
    const receiptId=crypto.randomUUID(),grant=context.authorization.predicate('undo',destination)
    const statements=[guard(grant),guard(assetTargets.matches(row,destination,'asset',assetId)),...integration.nativeStatements,...assetTargets.remove(destination,'asset',assetId),...integration.checkpoint,
      {sql:'INSERT INTO ik_d1_erasure_journal VALUES(?,?,?,?,?,?,?)',params:[receiptId,destination,new Date().toISOString(),1,0,0,JSON.stringify([{store:'mallet_records',rows:1}])]}]
    await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.params??[])))
    return {receiptId,phase:'complete',recordsErased:1}
  }
  context.originalErasurePolicy = 'withdraw-affected-artifacts'
  return retireD1ImportCustody({ target: { kind: 'asset', id: assetId } }, [
    guard(assetTargets.matches(row, destination, 'asset', assetId)),
    ...integration.nativeStatements,
    ...assetTargets.remove(destination, 'asset', assetId),
  ], context, integration.checkpoint)
}
