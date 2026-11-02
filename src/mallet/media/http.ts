import { createHash } from 'node:crypto'
import type { Bindings } from '../../auth.server'
import { originGuard, type Actor, type Authority } from '../auth'
import { fail } from '../model'
import { inspectionHistory, carryFinding, resolveFinding } from './history'
import { CHUNK_BYTES, type ChunkRow } from './types'
import { findingInput, identifier, uploadInput, uuid } from './validation'
import { chunkBytes, chunkPage, completeUpload, createFinding, createUpload, listFindings, uploadScope, uploadStatus, writeChunk } from './service'

const privateHeaders = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }
const json = (value: unknown) => Response.json(value, { headers: privateHeaders })
async function body(request: Request, limit = 1024 * 1024): Promise<unknown> {
 if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) fail('INPUT', 'Use application/json.', null, 415)
 const declared = request.headers.get('content-length')
 if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) fail('MEDIA_BODY', 'The request body is too large.', null, 413)
 const reader = request.body?.getReader()
 if (!reader) fail('INPUT', 'A JSON body is required.', null, 400)
 const parts: Uint8Array[] = []; let length = 0
 try {
  for (;;) {
   const { value, done } = await reader.read()
   if (done) break
   length += value.length
   if (length > limit) fail('MEDIA_BODY', 'The request body is too large.', null, 413)
   parts.push(value)
  }
 } finally { await reader.cancel(); reader.releaseLock() }
 const bytes = new Uint8Array(length); let offset = 0
 for (const part of parts) { bytes.set(part, offset); offset += part.length }
 try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
 catch { return fail('INPUT', 'The request must contain valid JSON.', null, 400) }
}
function byteRange(header: string | null, size: number): { start: number; end: number; partial: boolean } | null {
 if (header === null) return { start: 0, end: size - 1, partial: false }
 const match = /^bytes=(\d*)-(\d*)$/.exec(header)
 if (!match || (!match[1] && !match[2])) return null
 let start: number, end: number
 if (!match[1]) {
  const suffix = Number(match[2])
  if (!Number.isSafeInteger(suffix) || suffix <= 0) return null
  start = Math.max(0, size - suffix); end = size - 1
 } else {
  start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null
  end = Math.min(end, size - 1)
 }
 return { start, end, partial: true }
}
async function content(request: Request, env: Bindings, actor: Actor, authority: Authority, id: string): Promise<Response> {
 const { scope, row } = await uploadScope(env.DB, actor, authority, id)
 if (!row.complete) fail('MEDIA_INCOMPLETE', 'This media has not finished uploading.')
 return streamMedia(request,row,(first,last)=>chunkPage(env.DB,scope,id,first,last))
}
export async function streamMedia(request:Request,row:import('./types').UploadRow,readPage:(first:number,last:number)=>Promise<ChunkRow[]>):Promise<Response>{
 const range = byteRange(request.headers.get('range'), row.size)
 if (!range) return new Response(null, { status: 416, headers: { ...privateHeaders, 'content-range': `bytes */${row.size}`, 'accept-ranges': 'bytes' } })
 const fallback = row.filename.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/"/g, '_') || 'inspection-media'
 const headers = new Headers({ ...privateHeaders, 'content-type': row.mime, 'content-length': String(range.end - range.start + 1), 'accept-ranges': 'bytes', 'content-disposition': `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`, 'content-security-policy': "default-src 'none'; sandbox" })
 if (range.partial) headers.set('content-range', `bytes ${range.start}-${range.end}/${row.size}`)
 if (request.method === 'HEAD') return new Response(null, { status: range.partial ? 206 : 200, headers })
 let ordinal = Math.floor(range.start / CHUNK_BYTES), page: ChunkRow[] = [], cancelled = false
 const last = Math.floor(range.end / CHUNK_BYTES)
 const stream = new ReadableStream<Uint8Array>({
  async pull(controller) {
   try {
    if (cancelled) return
    if (ordinal > last) { controller.close(); return }
    if (!page.length) page = await readPage(ordinal, Math.min(last, ordinal + 11))
    if (cancelled) return
    const chunk = page.shift()
    if (!chunk || chunk.ordinal !== ordinal) fail('MEDIA_STORAGE', 'The stored media is incomplete.', null, 500)
    const bytes = chunkBytes(chunk)
    if (bytes.length !== Math.min(CHUNK_BYTES, row.size - ordinal * CHUNK_BYTES) || bytes.length !== chunk.byte_length || createHash('sha256').update(bytes).digest('hex') !== chunk.sha256) fail('MEDIA_STORAGE', 'The stored media failed its integrity check.', null, 500)
    const offset = ordinal * CHUNK_BYTES, start = Math.max(0, range.start - offset), end = Math.min(bytes.length, range.end - offset + 1)
    controller.enqueue(bytes.subarray(start, end)); ordinal++
    if (ordinal > last) { page = []; controller.close() }
   } catch (error) { page = []; controller.error(error) }
  },
  cancel() { cancelled = true; page = [] }
 })
 return new Response(stream, { status: range.partial ? 206 : 200, headers })
}

/** The parent supplies native identity and catches MalletError for consistent API failures. */
export async function mediaResponse(request: Request, env: Bindings, actor: Actor, authority: Authority): Promise<Response> {
 if (!['owner', 'admin', 'member'].includes(actor.role)) fail('FORBIDDEN', 'Agents cannot access inspection media.', null, 403)
 originGuard(request, env)
 const url = new URL(request.url), path = url.pathname
 if (path === '/api/mallet/media/history' && request.method === 'GET') return json(await inspectionHistory(env.DB, actor, authority, identifier(url.searchParams.get('jobId'), 'jobId')))
 if (path === '/api/mallet/media/carry' && request.method === 'POST') return json(await carryFinding(env.DB, actor, authority, await body(request)))
 const resolution = /^\/api\/mallet\/media\/findings\/([^/]+)\/resolve$/.exec(path)
 if (resolution && request.method === 'POST') return json(await resolveFinding(env.DB, actor, authority, identifier(resolution[1], 'findingId'), await body(request)))
 if (path === '/api/mallet/media/findings') {
  if (request.method === 'POST') return json(await createFinding(env.DB, actor, authority, findingInput(await body(request))))
  if (request.method === 'GET') return json(await listFindings(env.DB, actor, authority, identifier(url.searchParams.get('jobId'), 'jobId')))
  return fail('METHOD', 'Use GET or POST for findings.', null, 405)
 }
 if (path === '/api/mallet/media/uploads') {
  if (request.method !== 'POST') return fail('METHOD', 'Use POST to start an upload.', null, 405)
  return json(await createUpload(env.DB, actor, authority, uploadInput(await body(request))))
 }
 const match = /^\/api\/mallet\/media\/uploads\/([^/]+)(?:\/(complete|content|chunks\/([0-9]+)))?$/.exec(path)
 if (!match) return fail('NOT_FOUND', 'Unknown inspection media route.', null, 404)
 const id = uuid(match[1], 'uploadId'), action = match[2]
 if (action === 'content' && ['GET', 'HEAD'].includes(request.method)) return content(request, env, actor, authority, id)
 if (action === 'complete' && request.method === 'POST') return json(await completeUpload(env.DB, actor, authority, id))
 if (match[3] !== undefined && request.method === 'PUT') return json(await writeChunk(env.DB, actor, authority, id, Number(match[3]), await body(request, 96 * 1024)))
 if (!action && request.method === 'GET') return json(await uploadStatus(env.DB, actor, authority, id))
 return fail('METHOD', 'Unsupported method for this media route.', null, 405)
}
