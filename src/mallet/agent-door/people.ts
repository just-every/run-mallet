import { operatorAuthPeople, type Person, type ToolContext, ToolRefusal } from '../../modules/agent-door/index.ts'
import { authConfig, operatorAuth, type Bindings } from '../../auth.server'
import { identity, digest, type Actor, type Authority } from '../auth'

/** A Business address never selects a native account. All bindings come from signed settings. */
export function nativePeople(env: Bindings) {
  const policyRoles = new Map<string, 'owner' | 'editor' | null>()
  const native = operatorAuthPeople({ db: env.DB, allowList: authConfig(env).allowList,
    session: async request => {
      try {
        await identity(request, env)
        return (await operatorAuth(env)).getSession(request)
      } catch { return null }
    },
  })
  const admissible = async (person: Person | null) => {
    // These identities require provider-bound native sessions. A Business bearer
    // cannot assert that a native SSO session or second factor has been proved.
    if (!person?.active) return person
    const excluded = await env.DB.prepare('SELECT 1 FROM mallet_enterprise_users WHERE id=? UNION ALL SELECT 1 FROM mallet_staff_grants WHERE operator_id=?').bind(person.id, person.id).first()
    const role = env.RER_OWNER_CLAIM_PUBLIC_KEYS ? (await member(person))?.role ?? null : person.role === 'owner' ? 'owner' : person.role === 'admin' ? 'editor' : null
    policyRoles.set(person.id, role)
    return excluded ? { ...person, active: false } : person
  }
  const ownerBinding = async () => env.DB.prepare('SELECT b.claim_id AS id FROM oa_bootstrap b WHERE b.singleton=1').first<{ id: string }>()
  const member = async (person: Person) => {
    const settings = await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{ owner_id: string | null }>()
    if (settings?.owner_id && (await ownerBinding())?.id === person.id) return person.role === 'owner' ? { id: settings.owner_id, role: 'owner' as const } : null
    const row = await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state<>'conflict' AND business_id IS NOT NULL").bind(person.id).first<{ business_id: string; business_role: string }>()
    return row ? { id: row.business_id, role: row.business_role === 'admin' ? 'editor' as const : null } : null
  }
  return { ...native, person: async (id: string) => admissible(await native.person(id)),
    async sponsor({ sub }: { sub: string }) {
      const settings = await env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{ owner_id: string | null }>()
      if (settings?.owner_id === sub) {
        const owner = await ownerBinding(), person = owner ? await native.person(owner.id) : null
        return person?.role === 'owner' ? admissible(person) : null
      }
      return admissible(await native.sponsor({ sub }))
    },
    businessMember: member,
    session: async (request: Request) => admissible(await native.session(request)),
    businessRole: (person: Person) => policyRoles.get(person.id) ?? null }
}

const preparationScopes = ['estimate:prepare', 'estimate:revise', 'dispatch:prepare', 'invoice:prepare', 'workshop:read']

/** Only the original preparation keys enter this adapter; SDK and assistant keys retain their own scopes. */
export async function localPreparation(request: Request, env: Bindings) {
  const bearer = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)
  if (!bearer) return null
  const row = await env.DB.prepare(`SELECT k.id,k.label,k.created_by FROM mallet_agent_keys k JOIN oa_operators o ON o.id=k.created_by
    WHERE k.token_hash=? AND k.revoked_at IS NULL AND k.expires_at>(julianday('now')-2440587.5)*86400000
    AND o.status='active' AND o.version=k.creator_version AND o.role IN ('owner','admin')`)
    .bind(await digest(bearer[1])).first<{ id: string; label: string; created_by: string }>()
  return row ? { sponsor: { id: row.created_by }, agent: { id: `mallet-key:${row.id}`, name: row.label, specialist: 'service advisor' }, clientId: `mallet-key:${row.id}`, scopes: preparationScopes } : null
}

export async function nativeAuthority(ctx: Pick<ToolContext, 'db' | 'person' | 'agent'>): Promise<Authority> {
  const person = await ctx.db.prepare("SELECT id,version,role FROM oa_operators WHERE id=? AND status='active'")
    .bind(ctx.person.id).first<{ id: string; version: number; role: string }>()
  if (!person || person.role !== ctx.person.role) throw new ToolRefusal('sponsor_unavailable')
  const base = { sql: "EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND version=? AND role=? AND status='active') AND NOT EXISTS(SELECT 1 FROM mallet_enterprise_users WHERE id=?) AND NOT EXISTS(SELECT 1 FROM mallet_staff_grants WHERE operator_id=?)",
    params: [person.id, person.version, person.role, person.id, person.id] as unknown[] }
  if (!ctx.agent.id.startsWith('mallet-key:')) return base
  return { sql: `(${base.sql}) AND EXISTS(SELECT 1 FROM mallet_agent_keys k JOIN oa_operators o ON o.id=k.created_by
    WHERE k.id=? AND k.created_by=? AND k.revoked_at IS NULL AND k.expires_at>(julianday('now')-2440587.5)*86400000
    AND o.version=k.creator_version AND o.status='active' AND o.role IN ('owner','admin'))`,
    params: [...base.params, ctx.agent.id.slice('mallet-key:'.length), person.id] }
}

export function preparationActor(ctx: ToolContext): Actor {
  if (!['owner', 'admin'].includes(ctx.person.role)) throw new ToolRefusal('manager_required')
  return { id: ctx.agent.id, name: ctx.actor.label, role: 'agent', attribution: ctx.actor, policyApprovers: ctx.approvers.map(person => ({ ...person })) }
}
