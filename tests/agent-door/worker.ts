import native from '../worker'
import { rejectedResponse } from '../../src/base/rejected-response'
import { agentResponse } from '../../src/mallet/agent-door/index.ts'
import { businessSettings } from '../../src/mallet/business.ts'
import { runtimeBindings } from '../../src/auth.server'

// The production agent and signed settings doors, followed by the native workshop.
export default { ...native, async fetch(request: Request, env: any, execution: ExecutionContext) {
  const settings = ['/api/rer/business-settings', '/rer-business-logo', '/rer-business.css'].includes(new URL(request.url).pathname)
    ? await (await businessSettings(runtimeBindings(env))).handle(request) : null
  const response = settings ?? await agentResponse(request, env)
  return response ? rejectedResponse(request, response) : native.fetch(request, env, execution)
} }
