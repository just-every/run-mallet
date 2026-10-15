import { fail } from './model'

export type PierConfig = { PIER_ORIGIN?: string; PIER_SESSION?: string; AUTH_LOCAL?: string }
/** Read-only integration: inventory and allocation remain in the connected Pier installation. */
export async function catalogue(env: PierConfig) {
  if (!env.PIER_ORIGIN || !env.PIER_SESSION) fail('PIER_UNAVAILABLE', 'Connect Pier before browsing its parts catalogue.', null, 503)
  let url: URL
  try { url = new URL(env.PIER_ORIGIN) } catch { return fail('PIER_UNAVAILABLE', 'Configure a valid Pier origin.', null, 503) }
  if (url.origin !== env.PIER_ORIGIN || url.username || url.password || url.protocol !== 'https:' && !(env.AUTH_LOCAL === 'true' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail('PIER_UNAVAILABLE', 'Pier needs an HTTPS origin; local loopback HTTP is allowed in local mode.', null, 503)
  let response: Response
  try { response = await fetch(url.origin + '/api/pier/state', { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { cookie: env.PIER_SESSION, origin: url.origin, accept: 'application/json' } }) } catch { return fail('PIER_UNAVAILABLE', 'Pier did not answer. No stock was changed.', null, 503) }
  if (!response.ok) fail('PIER_UNAVAILABLE', response.status === 401 || response.status === 403 ? 'The Pier connection needs a current authorised session.' : 'Pier refused the catalogue request.', null, 503)
  let state: any
  try { state = await response.json() } catch { return fail('PIER_RESPONSE', 'Pier returned invalid JSON.', null, 502) }
  if (!Array.isArray(state?.items)) fail('PIER_RESPONSE', 'Pier returned an incomplete catalogue.', null, 502)
  const items = state.items.filter((item: any) => item?.archived !== true).map((item: any) => {
    if (!item || typeof item.id !== 'string' || typeof item.sku !== 'string' || typeof item.name !== 'string' || typeof item.unit !== 'string') fail('PIER_RESPONSE', 'Pier returned an invalid catalogue item.', null, 502)
    return { id: item.id, sku: item.sku, name: item.name, unit: item.unit }
  })
  return { items, observedAt: new Date().toISOString(), source: 'Pier' }
}
