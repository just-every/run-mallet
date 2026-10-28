import { runtimeBindings, type Bindings } from '../../auth.server'
import { localPreparation } from './people.ts'
import { malletAgentDoor } from './index.ts'
import { originGuard, HttpError } from '../auth'

const preparations: Record<string, string> = {
  'estimate.prepare': 'mallet.estimates.prepare', 'estimate.revise': 'mallet.estimates.revise',
  'dispatch.prepare': 'mallet.dispatch.prepare', 'invoice.prepare': 'mallet.invoices.prepare',
}

/** Preserve the original preparation-key purpose through the same policy/audit pipeline. */
export async function preparationAlias(request: Request, original: Bindings): Promise<Response | null> {
  if (!request.headers.has('authorization') || !new URL(request.url).pathname.startsWith('/api/mallet/')) return null
  const env = runtimeBindings(original), credential = await localPreparation(request, env)
  if (!credential) return null // SDK/device/assistant credentials retain their separate native purpose.
  try { originGuard(request, env, true) }
  catch (error) {
    if (error instanceof HttpError) return Response.json({ code: error.code }, { status: error.status, headers: { 'cache-control': 'no-store' } })
    throw error
  }
  const path = new URL(request.url).pathname
  let name = 'mallet.unsupported.command', args: Record<string, unknown> = {}
  if (path === '/api/mallet/state' && request.method === 'GET') name = 'mallet.repairs.list'
  else if (/^\/api\/mallet\/repairs\/[^/]+$/.test(path) && request.method === 'GET') {
    name = 'mallet.repairs.read'; args = { id: decodeURIComponent(path.split('/').at(-1)!) }
  } else if (path === '/api/mallet/commands' && request.method === 'POST') {
    if (Number(request.headers.get('content-length')) > 1024 * 1024) return Response.json({ code: 'body_too_large' }, { status: 413 })
    const reader = request.body?.getReader(), chunks: Uint8Array[] = []; let size = 0
    if (reader) try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 1024 * 1024) return Response.json({ code: 'body_too_large' }, { status: 413 }); chunks.push(value) }
    } finally { await reader.cancel(); reader.releaseLock() }
    try {
      const bytes = new Uint8Array(size); let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      const body = JSON.parse(new TextDecoder().decode(bytes))
      name = preparations[body.command] ?? name
      args = { ...body.input, idempotency_key: request.headers.get('idempotency-key') ?? crypto.randomUUID() }
    } catch { return Response.json({ code: 'invalid_arguments' }, { status: 400 }) }
  }
  const headers = new Headers(request.headers)
  headers.delete('content-length'); headers.set('content-type', 'application/json'); headers.set('MCP-Protocol-Version', '2026-07-28')
  headers.set('Mcp-Method', 'tools/call'); headers.set('Mcp-Name', name)
  const response = await (await malletAgentDoor(env)).handle(new Request(env.AUTH_ORIGIN + '/mcp', { method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } }) }))
  if (!response) return Response.json({ code: 'door_unavailable' }, { status: 503 })
  const rpc = await response.json() as any
  const refusal = rpc.result?._meta?.['com.runeditrun/error']
  if (!response.ok || refusal || rpc.error || rpc.result?.isError) return Response.json(refusal ?? rpc.error?.data ?? { code: 'agent_refused' }, { status: response.ok ? 403 : response.status, headers: { 'cache-control': 'no-store' } })
  const value = rpc.result?.structuredContent ?? rpc.result
  const state = ['mallet.repairs.list', 'mallet.repairs.read'].includes(name) && rpc.result?.structuredContent
    ? { actor: { id: credential.agent.id.slice('mallet-key:'.length), name: credential.agent.name, role: 'agent' }, ...value }
    : value
  return Response.json(state, { headers: { 'cache-control': 'no-store' } })
}
