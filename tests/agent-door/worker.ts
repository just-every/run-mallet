import native from '../worker'
import { businessSettings } from '../../src/mallet/business.ts'
import { rejectedResponse } from '../../src/base/rejected-response'
import { runtimeBindings } from '../../src/auth.server'

// Mount signed settings before the native worker, which also serves the production agent door.
export default { ...native, async fetch(request: Request, env: any, execution: ExecutionContext) {
  const settings = ['/api/rer/business-settings', '/rer-business-logo', '/rer-business.css'].includes(new URL(request.url).pathname)
    ? await (await businessSettings(runtimeBindings(env))).handle(request) : null
  return settings ? rejectedResponse(request, settings) : native.fetch(request, env, execution)
} }
