import type { Bindings } from '../../auth.server'
import type { Authority } from '../auth'
import { trust } from './trust.ts'

/**
 * The shared agent door's Pause as an SQL condition: the owner's local switch, and
 * Business Pause all agents while this installation is paired, as the door reads them.
 * Credentials outside the door carry it into their native write transactions.
 */
export function pauseFence(env: Bindings): Authority {
  const business = trust(env) ? " OR COALESCE(json_extract(envelope,'$.paused'),0)<>0" : ''
  return { sql: `NOT EXISTS(SELECT 1 FROM agent_door_state WHERE id=1 AND (local_paused<>0${business}))`, params: [] }
}

export async function agentsPaused(env: Bindings): Promise<boolean> {
  const fence = pauseFence(env)
  return !await env.DB.prepare(`SELECT 1 WHERE ${fence.sql}`).bind(...fence.params).first()
}
