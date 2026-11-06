import worker from '../worker'
import { agentResponse } from '../../src/mallet/agent-door/index.ts'
import { rejectedResponse } from '../../src/base/rejected-response'

// Use the production agent dispatcher ahead of native session-only app routes,
// as src/server.ts does. All tools retain the real native services and D1.
export default {
 async fetch(request: Request, env: any, execution: ExecutionContext) {
  const agent = await agentResponse(request, env)
  return agent ? rejectedResponse(request, agent) : worker.fetch(request, env, execution)
 },
}
