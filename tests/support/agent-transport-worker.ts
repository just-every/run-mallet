import worker from '../dev-worker'
import { agentResponse } from '../../src/mallet/agent-door/index.ts'
import { preparationAlias } from '../../src/mallet/agent-door/legacy.ts'
import { rejectedResponse } from '../../src/base/rejected-response'

// Keep the production agent handlers ahead of native authentication, as in
// src/server.ts. The existing harness supplies real native sessions and D1.
export default {
 async fetch(request: Request, env: any, execution: ExecutionContext) {
  return rejectedResponse(request, await agentResponse(request, env)
   ?? await preparationAlias(request, env) ?? await worker.fetch(request, env, execution))
 },
}
