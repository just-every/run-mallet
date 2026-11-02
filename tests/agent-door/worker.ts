import workshop from '../worker.ts'
import {agentResponse} from '../../src/mallet/agent-door/index.ts'
import {rejectedResponse} from '../../src/base/rejected-response'

// The production dispatcher enters the shared agent door before the workshop.
export default {
 async fetch(request: Request, env: any, execution: ExecutionContext) {
  const response = await agentResponse(request, env)
  return response ? rejectedResponse(request, response) : workshop.fetch(request, env, execution)
 },
}
