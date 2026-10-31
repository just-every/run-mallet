import type { AgentDoor } from '../../modules/agent-door/index.ts'

/** Export the same private person view, rechecking its authority on each page. */
export async function exportAgentAudit(request: Request, door: AgentDoor, db: D1Database): Promise<Response> {
  const url = new URL(request.url)
  url.pathname = '/agents/api/audit'
  url.searchParams.delete('after')
  const page = (after?: string) => {
    const next = new URL(url)
    if (after) next.searchParams.set('after', after)
    return door.handle(new Request(next, { headers: request.headers }))
  }
  const first = await page()
  if (!first?.ok) return first ?? Response.json({code:'not_found'}, {status:404})
  if (request.method !== 'GET') {
    await first.body?.cancel()
    return Response.json({code:'method_not_allowed'}, {status:405,headers:{Allow:'GET'}})
  }
  // New calls after this snapshot belong to the next export, so a busy shop
  // cannot prevent the cursor from finishing.
  const through = (await db.prepare('SELECT COALESCE(MAX(sequence),0) AS sequence FROM agent_door_audit').first<{sequence:number}>())!.sequence
  const encoder = new TextEncoder()
  let response: Response | null = first, after: string | undefined
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        for (;;) {
          response ??= await page(after)
          if (!response?.ok) throw new Error('audit_export_authority_unavailable')
          const result = await response.json() as {rows:Array<{sequence:number}>;cursor:string|null}
          const rows = result.rows.filter(row => row.sequence <= through)
          if (rows.length) controller.enqueue(encoder.encode(rows.map(row => JSON.stringify(row) + '\n').join('')))
          if (result.cursor === null || result.cursor === after || Number(result.cursor) >= through) {
            controller.close()
            return
          }
          if (!Number.isSafeInteger(Number(result.cursor)) || Number(result.cursor) <= Number(after ?? 0)) throw new Error('audit_export_cursor_invalid')
          after = result.cursor
          response = null
          if (rows.length) return
        }
      } catch (error) { controller.error(error) }
    },
    async cancel() { if (!response?.bodyUsed) await response?.body?.cancel() },
  })
  return new Response(stream, {headers:{'content-type':'application/x-ndjson; charset=utf-8','content-disposition':'attachment; filename="agent-audit.ndjson"','cache-control':'no-store','x-content-type-options':'nosniff'}})
}
