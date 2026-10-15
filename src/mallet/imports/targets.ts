import { canonicalJson, type D1Sql, type D1TargetAdapter, type Json, type TargetRow } from '../../modules/import-kit/src/d1/index.ts'
import { destination } from './context.ts'
import { reject } from './types.ts'
import { guard } from '../../modules/import-kit/src/d1/database.ts'

const sql = (sql: string, ...params: any[]): D1Sql => ({ sql, params })
const columns = `r.id,r.revision,r.value,m.import_revision,m.native_revision`
const from = `mallet_records r LEFT JOIN mallet_import_revisions m ON m.kind=r.kind AND m.id=r.id`
const revision = `CASE WHEN m.native_revision=r.revision THEN m.import_revision ELSE 'native:'||r.revision END`
type NativeRow = { id: string; revision: number; value: string; import_revision: string | null; native_revision: number | null }

function scope(target: string, kind = 'asset') {
  if (target !== destination || kind !== 'asset') reject('IMPORT_SCOPE', 'Unsupported import destination or record kind.')
}
function decode(row: NativeRow): TargetRow {
  return {
    destination, targetKind: 'asset', targetId: row.id,
    revision: row.native_revision === row.revision && row.import_revision ? row.import_revision : `native:${row.revision}`,
    value: JSON.parse(row.value),
  }
}
function nativeVersion(row: TargetRow): number {
  const value = row.value as Record<string, Json>
  if (!value || value.id !== row.targetId || !Number.isSafeInteger(value.version) || (value.version as number) < 1)
    reject('IMPORT_ASSET', 'An imported asset must have its native ID and numeric version.')
  canonicalJson(value)
  return value.version as number
}

export const assetTargets: D1TargetAdapter = {
  async read(db, target, kind, id) {
    scope(target, kind)
    const row = await db.prepare(`SELECT ${columns} FROM ${from} WHERE r.kind='asset' AND r.id=?`)
      .bind(id).first<NativeRow>()
    return row ? decode(row) : undefined
  },
  matches(row, target, kind, id) {
    scope(target, kind)
    if (!row) return sql(`NOT EXISTS(SELECT 1 FROM mallet_records WHERE kind='asset' AND id=?) AND NOT EXISTS(SELECT 1 FROM mallet_import_revisions WHERE kind='asset' AND id=?)`, id, id)
    // Exact value bytes cover all native fields, including same-version edits.
    // The separate marker translates Kit's opaque revision into a native integer.
    return sql(`EXISTS(SELECT 1 FROM ${from} WHERE r.kind='asset' AND r.id=? AND r.revision=? AND ${revision}=? AND r.value=?)`,
      id, nativeVersion(row), row.revision, JSON.stringify(row.value))
  },
  write(row) {
    scope(row.destination, row.targetKind)
    const version = nativeVersion(row)
    return [
      guard(sql(`NOT EXISTS(SELECT 1 FROM mallet_records WHERE kind='asset' AND id<>? AND lower(json_extract(value,'$.identifier'))=lower(?))`, row.targetId, (row.value as Record<string, Json>).identifier)),
      sql(`INSERT INTO mallet_records(kind,id,revision,value) VALUES('asset',?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,value=excluded.value`, row.targetId, version, JSON.stringify(row.value)),
      sql(`INSERT INTO mallet_import_revisions(kind,id,import_revision,native_revision) VALUES('asset',?,?,?) ON CONFLICT(kind,id) DO UPDATE SET import_revision=excluded.import_revision,native_revision=excluded.native_revision`, row.targetId, row.revision, version),
    ]
  },
  remove(target, kind, id) {
    scope(target, kind)
    return [sql(`DELETE FROM mallet_import_revisions WHERE kind='asset' AND id=?`, id), sql(`DELETE FROM mallet_records WHERE kind='asset' AND id=?`, id)]
  },
  async list(db, target) {
    scope(target)
    const rows = await db.prepare(`SELECT ${columns} FROM ${from} WHERE r.kind='asset' ORDER BY r.id`).all<NativeRow>()
    return rows.results.map(decode)
  },
  matchesCount(count, target) {
    scope(target)
    return sql(`(SELECT COUNT(*) FROM mallet_records WHERE kind='asset')=?`, count)
  },
}
