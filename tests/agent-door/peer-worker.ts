import app from '../worker'
import { preparationAlias } from '../../src/mallet/agent-door/legacy'
import type { Bindings } from '../../src/auth.server'

export default {
 ...app,
 async fetch(request: Request, env: Bindings, execution: ExecutionContext) {
  return await preparationAlias(request, env) ?? app.fetch(request, env, execution)
 },
}
