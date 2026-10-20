import { fail } from '../model'
import type { Actor, Authority, FindingRow, Scope, Sql, UploadRow } from './types'

const statement = (db: D1Database, query: Sql) => db.prepare(query.sql).bind(...(query.params ?? []))
export const assertion = (sql: string, params: any[] = []): Sql => ({ sql: `INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${sql}) THEN 1 ELSE 0 END`, params })
function nativeGuard(authority: Authority): Sql {
 if (!authority?.sql || !Array.isArray(authority.params)) fail('FORBIDDEN', 'A current native session is required.', null, 403)
 return assertion(authority.sql, authority.params)
}
function assignment(actor: Actor): { sql: string; params: any[] } {
 if (!['owner', 'admin', 'member'].includes(actor.role)) fail('FORBIDDEN', 'Agents cannot access inspection media.', null, 403)
 return actor.role === 'member' ? { sql: "(json_extract(j.value,'$.technicianId')=? OR EXISTS(SELECT 1 FROM json_each(j.value,'$.helpers') WHERE json_each.value=?))", params: [actor.id, actor.id] } : { sql: '1=1', params: [] }
}
async function batch(db: D1Database, queries: Sql[]): Promise<D1Result[]> {
 try { return await db.batch(queries.map(query => statement(db, query))) }
 catch (error) {
  if (/CHECK constraint failed.*(?:mallet_assert|ok)/i.test(String(error))) fail('CONCURRENT_CHANGE', 'The media, job assignment or session changed. Refresh before continuing.')
  throw error
 }
}
export function scopeAssertion(scope: Scope): Sql {
 const grant = assignment(scope.actor)
 return assertion(`EXISTS(SELECT 1 FROM mallet_records j WHERE j.kind='job' AND j.id=? AND j.revision=? AND ${grant.sql})`, [scope.jobId, scope.revision, ...grant.params])
}
export async function guarded(db: D1Database, scope: Scope, queries: Sql[]): Promise<D1Result[]> {
 const results = await batch(db, [nativeGuard(scope.authority), scopeAssertion(scope), ...queries, { sql: 'DELETE FROM mallet_assert' }])
 return results.slice(2, -1)
}
async function locate<T>(db: D1Database, actor: Actor, authority: Authority, table: 'job' | 'finding' | 'upload', id: string): Promise<{ scope: Scope; row: T }> {
 const grant = assignment(actor)
 const source = table === 'job' ? 'mallet_records j' : `${table === 'finding' ? 'mallet_media_findings' : 'mallet_media_uploads'} m JOIN mallet_records j ON j.kind='job' AND j.id=m.job_id`
 const columns = table === 'job' ? 'j.value' : 'm.*'
 const query: Sql = { sql: `SELECT ${columns},j.id AS scoped_job_id,j.revision AS job_revision FROM ${source} WHERE j.kind='job' AND ${table === 'job' ? 'j' : 'm'}.id=? AND ${grant.sql}`, params: [id, ...grant.params] }
 const results = await batch(db, [nativeGuard(authority), query, { sql: 'DELETE FROM mallet_assert' }])
 const row = results[1].results?.[0] as (T & { scoped_job_id: string; job_revision: number }) | undefined
 if (!row) fail('NOT_FOUND', 'That job or inspection media is unavailable.', null, 404)
 return { scope: { jobId: row.scoped_job_id, revision: row.job_revision, actor, authority }, row }
}
export async function jobScope(db: D1Database, actor: Actor, authority: Authority, id: string): Promise<Scope> { return (await locate(db, actor, authority, 'job', id)).scope }
export const findingScope = (db: D1Database, actor: Actor, authority: Authority, id: string) => locate<FindingRow>(db, actor, authority, 'finding', id)
export const uploadScope = (db: D1Database, actor: Actor, authority: Authority, id: string) => locate<UploadRow>(db, actor, authority, 'upload', id)
export async function readRows<T>(db: D1Database, scope: Scope, sql: string, params: any[] = []): Promise<T[]> {
 const result = await guarded(db, scope, [{ sql, params }])
 return result[0].results as T[]
}
export async function getUpload(db: D1Database, scope: Scope, id: string): Promise<UploadRow> {
 const rows = await readRows<UploadRow>(db, scope, 'SELECT * FROM mallet_media_uploads WHERE id=? AND job_id=?', [id, scope.jobId])
 if (!rows[0]) fail('NOT_FOUND', 'That upload is unavailable.', null, 404)
 return rows[0]
}
