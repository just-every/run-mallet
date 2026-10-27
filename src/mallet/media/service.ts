import { createHash } from 'node:crypto'
import { fail, integer } from '../model'
import type { Actor, Authority, ChunkRow, FindingInput, FindingRow, Scope, Sql, UploadInput, UploadRow } from './types'
import { CHUNK_BYTES, contentUrl, findingView, uploadView } from './types'
import { assertion, scopeAssertion, findingScope, getUpload, guarded, mediaReceipt, jobScope, readRows, uploadScope } from './storage'
import { decodeChunk, sniff } from './validation'

export async function createFinding(db: D1Database, actor: Actor, authority: Authority, input: FindingInput, guardScopes: Scope[] = [], assertions: Sql[] = []) {
 const scope = await jobScope(db, actor, authority, input.jobId), request = JSON.stringify(input), id = crypto.randomUUID()
 const existing = await readRows<FindingRow>(db, scope, 'SELECT * FROM mallet_media_findings WHERE job_id=? AND client_id=?', [input.jobId, input.clientId])
 if (existing[0] && existing[0].request_json !== request) fail('MEDIA_REPLAY', 'This finding clientId was already used for different data.')
 const result = await guarded(db, scope, [
  ...guardScopes.map(scopeAssertion), ...assertions,
  { sql: 'INSERT OR IGNORE INTO mallet_media_findings(id,job_id,client_id,title,captured_at,created_at,actor_json,request_json) VALUES(?,?,?,?,?,?,?,?)', params: [id, input.jobId, input.clientId, input.title, input.capturedAt, new Date().toISOString(), JSON.stringify(actor), request] },
  mediaReceipt(scope, input.carriedFrom ? 'media.finding.carried' : 'media.finding.created', [{ kind: 'mediaFinding', id, beforeRevision: null, afterRevision: 1 }], ['finding:' + id, ...(input.carriedFrom ? ['source-finding:' + input.carriedFrom.id, 'source-job:' + input.carriedFrom.jobId, ...(input.carriedFrom.declinedWorkId ? ['declinedWork:' + input.carriedFrom.declinedWorkId] : [])] : [])]),
  assertion('EXISTS(SELECT 1 FROM mallet_media_findings WHERE job_id=? AND client_id=? AND request_json=?)', [input.jobId, input.clientId, request]),
  { sql: 'SELECT * FROM mallet_media_findings WHERE job_id=? AND client_id=?', params: [input.jobId, input.clientId] }
 ])
 return findingView(result.at(-1)!.results[0] as FindingRow)
}
export async function listFindings(db: D1Database, actor: Actor, authority: Authority, jobId: string) {
 const scope = await jobScope(db, actor, authority, jobId)
 const result = await guarded(db, scope, [
  { sql: 'SELECT * FROM mallet_media_findings WHERE job_id=? ORDER BY created_at,id', params: [jobId] },
  { sql: 'SELECT * FROM mallet_media_uploads WHERE job_id=? ORDER BY received_at,id', params: [jobId] }
 ])
 const media = result[1].results as UploadRow[]
 return { findings: (result[0].results as FindingRow[]).map(finding => ({ ...findingView(finding), media: media.filter(row => row.finding_id === finding.id).map(uploadView) })) }
}
export async function progress(db: D1Database, scope: Scope, upload: UploadRow) {
 const current = await getUpload(db, scope, upload.id)
 const chunks = await readRows<{ ordinal: number }>(db, scope, 'SELECT ordinal FROM mallet_media_chunks WHERE upload_id=? ORDER BY ordinal', [upload.id])
 return { ...uploadView(current), uploadId: current.id, chunkBytes: CHUNK_BYTES, received: chunks.map(chunk => chunk.ordinal) }
}
export async function createUpload(db: D1Database, actor: Actor, authority: Authority, input: UploadInput) {
 const { scope } = await findingScope(db, actor, authority, input.findingId)
 // Client ids are aliases; bytes and immutable metadata are deduplicated together.
 const { clientId, ...metadata } = input, request = JSON.stringify(metadata)
 const candidates = await readRows<UploadRow>(db, scope, `SELECT DISTINCT u.* FROM mallet_media_uploads u LEFT JOIN mallet_media_upload_clients c ON c.upload_id=u.id WHERE u.finding_id=? AND (c.client_id=? OR (u.variant=? AND u.sha256=?))`, [input.findingId, clientId, input.variant, input.sha256])
 if (candidates.some(row => row.request_json !== request)) fail('MEDIA_REPLAY', 'This clientId or content hash was already used for different media metadata.')
 if (input.originalId) {
  const original = await readRows<UploadRow>(db, scope, "SELECT * FROM mallet_media_uploads WHERE id=? AND finding_id=? AND variant='original' AND complete=1", [input.originalId, input.findingId])
  if (!original.length) fail('MEDIA_ORIGINAL', 'A shared variant must reference a completed original in this finding.', null, 400)
 }
 const exact = [input.findingId, input.variant, input.sha256], id = crypto.randomUUID()
 const queries = [
  ...(input.originalId ? [assertion("EXISTS(SELECT 1 FROM mallet_media_uploads WHERE id=? AND finding_id=? AND variant='original' AND complete=1)", [input.originalId, input.findingId])] : []),
  { sql: 'INSERT OR IGNORE INTO mallet_media_uploads(id,finding_id,job_id,variant,original_id,filename,mime,size,sha256,captured_at,received_at,actor_json,annotations_json,request_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', params: [id, input.findingId, scope.jobId, input.variant, input.originalId, input.filename, input.mime, input.size, input.sha256, input.capturedAt, new Date().toISOString(), JSON.stringify(actor), input.annotations ? JSON.stringify(input.annotations) : null, request] },
  mediaReceipt(scope, 'media.upload.created', [{ kind: 'mediaUpload', id, beforeRevision: null, afterRevision: 1 }], ['finding:' + input.findingId, 'upload:' + id]),
  assertion('EXISTS(SELECT 1 FROM mallet_media_uploads WHERE finding_id=? AND variant=? AND sha256=? AND request_json=?)', [...exact, request]),
  { sql: 'INSERT OR IGNORE INTO mallet_media_upload_clients(finding_id,client_id,upload_id) SELECT ?,?,id FROM mallet_media_uploads WHERE finding_id=? AND variant=? AND sha256=?', params: [input.findingId, clientId, ...exact] },
  assertion('EXISTS(SELECT 1 FROM mallet_media_upload_clients c JOIN mallet_media_uploads u ON u.id=c.upload_id WHERE c.finding_id=? AND c.client_id=? AND u.request_json=?)', [input.findingId, clientId, request]),
  { sql: 'SELECT * FROM mallet_media_uploads WHERE finding_id=? AND variant=? AND sha256=?', params: exact }
 ]
 const result = await guarded(db, scope, queries)
 return progress(db, scope, result.at(-1)!.results[0] as UploadRow)
}
export async function uploadStatus(db: D1Database, actor: Actor, authority: Authority, id: string) {
 const { scope, row } = await uploadScope(db, actor, authority, id)
 return progress(db, scope, row)
}
export async function writeChunk(db: D1Database, actor: Actor, authority: Authority, id: string, ordinal: number, input: unknown) {
 const { scope, row } = await uploadScope(db, actor, authority, id)
 integer(ordinal, 'chunk index', 0, Math.ceil(row.size / CHUNK_BYTES) - 1)
 const expected = Math.min(CHUNK_BYTES, row.size - ordinal * CHUNK_BYTES), chunk = decodeChunk(input, expected)
 const prior = await readRows<ChunkRow>(db, scope, 'SELECT ordinal,sha256,byte_length,base64 FROM mallet_media_chunks WHERE upload_id=? AND ordinal=?', [id, ordinal])
 if (prior[0] && (prior[0].sha256 !== chunk.sha256 || prior[0].base64 !== chunk.base64 || prior[0].byte_length !== expected)) fail('MEDIA_CHUNK_REPLAY', 'This chunk offset already contains different bytes.')
 if (row.complete && !prior.length) fail('MEDIA_IMMUTABLE', 'Completed media is immutable.')
 await guarded(db, scope, [
  { sql: 'INSERT OR IGNORE INTO mallet_media_chunks(upload_id,ordinal,sha256,byte_length,base64) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM mallet_media_uploads WHERE id=? AND complete=0)', params: [id, ordinal, chunk.sha256, expected, chunk.base64, id] },
  mediaReceipt(scope, 'media.chunk.received', [{ kind: 'mediaChunk', id: id + ':' + ordinal, beforeRevision: null, afterRevision: 1 }], ['finding:' + row.finding_id, 'upload:' + id, 'chunk:' + ordinal]),
  assertion('EXISTS(SELECT 1 FROM mallet_media_chunks WHERE upload_id=? AND ordinal=? AND sha256=? AND byte_length=? AND base64=?)', [id, ordinal, chunk.sha256, expected, chunk.base64])
 ])
 return progress(db, scope, row)
}
/** Reads at most 1 MiB of encoded storage per page, never the complete video. */
export async function chunkPage(db: D1Database, scope: Scope, id: string, first: number, last: number): Promise<ChunkRow[]> {
 return readRows<ChunkRow>(db, scope, 'SELECT ordinal,sha256,byte_length,base64 FROM mallet_media_chunks WHERE upload_id=? AND ordinal>=? AND ordinal<=? ORDER BY ordinal LIMIT 12', [id, first, last])
}
export function chunkBytes(chunk: ChunkRow): Uint8Array { return Uint8Array.from(atob(chunk.base64), c => c.charCodeAt(0)) }
export async function completeUpload(db: D1Database, actor: Actor, authority: Authority, id: string) {
 const { scope, row } = await uploadScope(db, actor, authority, id)
 if (row.complete) return progress(db, scope, row)
 const count = Math.ceil(row.size / CHUNK_BYTES), digest = createHash('sha256'); let ordinal = 0, total = 0
 while (ordinal < count) {
  const page = await chunkPage(db, scope, id, ordinal, Math.min(count - 1, ordinal + 11))
  if (!page.length) fail('MEDIA_INCOMPLETE', 'Upload all chunks before completing this media.')
  for (const chunk of page) {
   if (chunk.ordinal !== ordinal) fail('MEDIA_INCOMPLETE', 'Upload all chunks before completing this media.')
   const bytes = chunkBytes(chunk), expected = Math.min(CHUNK_BYTES, row.size - ordinal * CHUNK_BYTES)
   if (bytes.length !== expected || chunk.byte_length !== expected || createHash('sha256').update(bytes).digest('hex') !== chunk.sha256) fail('MEDIA_HASH', 'A stored chunk does not match its expected length and digest.')
   if (ordinal === 0 && !sniff(bytes, row.mime)) fail('MEDIA_TYPE', 'The file signature does not match the declared media type.', null, 415)
   digest.update(bytes); total += bytes.length; ordinal++
  }
 }
 if (total !== row.size || digest.digest('hex') !== row.sha256) fail('MEDIA_HASH', 'The complete media does not match its declared size and SHA-256.')
 await guarded(db, scope, [
  assertion('(SELECT COUNT(*) FROM mallet_media_chunks WHERE upload_id=?)=? AND (SELECT COALESCE(SUM(byte_length),0) FROM mallet_media_chunks WHERE upload_id=?)=?', [id, count, id, row.size]),
  { sql: 'UPDATE mallet_media_uploads SET complete=1,completed_at=?,revision=revision+1 WHERE id=? AND complete=0 AND revision=?', params: [new Date().toISOString(), id, row.revision] },
  mediaReceipt(scope, 'media.upload.completed', [{ kind: 'mediaUpload', id, beforeRevision: row.revision, afterRevision: row.revision + 1 }], ['finding:' + row.finding_id, 'upload:' + id]),
  assertion('EXISTS(SELECT 1 FROM mallet_media_uploads WHERE id=? AND complete=1)', [id])
 ])
 return progress(db, scope, row)
}
export { uploadScope, contentUrl }
