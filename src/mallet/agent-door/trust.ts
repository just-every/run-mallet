import type { Trust } from '../../modules/agent-door/index.ts'
import type { Bindings } from '../../auth.server'

/** Business trust for signed agent policy and access tokens; null while this installation is unpaired. */
export function trust(env: Bindings): Trust | null {
  const issuer = env.RER_OWNER_CLAIM_ISSUER, installationId = env.RER_OWNER_CLAIM_INSTALLATION_ID
  if (![issuer, installationId, env.RER_OWNER_CLAIM_PUBLIC_KEYS].some(Boolean)) return null
  if (!issuer || !installationId || !env.RER_OWNER_CLAIM_PUBLIC_KEYS) throw new Error('Incomplete agent door trust')
  return { issuer, installationId, appOrigin: env.AUTH_ORIGIN, publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS) }
}
