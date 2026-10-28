import { createBusinessSettings } from '../modules/business-settings/index.ts'
import type { BusinessManifest } from '../modules/business-settings/types.ts'
import { createOperatorAuth } from '../modules/operator-auth/index.mjs'
import { authConfig, type Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { enterpriseHooks } from './enterprise/session'
import { enterpriseProviders } from './enterprise/config'

export const business: BusinessManifest = {
  settings: 1, values: ['display_name'], team: { roles: { admin: 'admin', member: 'member' } },
}

/** Reconcile Business identities through the existing native invitation/account service. */
export async function businessSettings(env: Bindings) {
  const auth = createOperatorAuth({
    db: env.DB, config: { ...authConfig(env), providers: await enterpriseProviders(env), OIDC_TRANSACTION_SECRET: env.OIDC_TRANSACTION_SECRET },
    hooks: enterpriseHooks(env), mailSender: operatorMail(env),
    clientIp: request => request.headers.get('CF-Connecting-IP') ?? '',
  })
  return createBusinessSettings({ db: env.DB, trust: env.RER_BUSINESS_TRUST, business, team: auth.businessTeam })
}
