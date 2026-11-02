import type {CacheProvider} from '@node-saml/node-saml'
import {digest} from '../../auth'
import {invalidAssertion} from './http'
import {transactionLifetimeMs, type SamlEnvironment, type SamlProvider, type SamlTransaction} from './types'

export function requestCache(env: SamlEnvironment, p: SamlProvider, bindingHash: string, returnTo: string): CacheProvider {
  return {
    async saveAsync(key, value) {
      const createdAt = Date.parse(value)
      if (!Number.isFinite(createdAt)) throw new Error('Invalid SAML request timestamp')
      await env.DB.prepare('DELETE FROM mallet_saml_transactions WHERE expires_at<=?').bind(Date.now()).run()
      await env.DB.prepare('INSERT INTO mallet_saml_transactions(request_id,provider,binding_hash,return_to,expires_at) VALUES(?,?,?,?,?)')
        .bind(await digest(key), p.id, bindingHash, returnTo, createdAt + transactionLifetimeMs).run()
      return {value, createdAt}
    },
    async getAsync() {return null},
    async removeAsync() {return null},
  }
}

export async function consumeTransaction(env: SamlEnvironment, p: SamlProvider, requestId: string, binding: string) {
  // DELETE RETURNING is one D1 operation: concurrent deliveries cannot both claim this row.
  const transaction = await env.DB.prepare('DELETE FROM mallet_saml_transactions WHERE request_id=? AND provider=? AND binding_hash=? AND expires_at>? RETURNING return_to,expires_at')
    .bind(await digest(requestId), p.id, await digest(binding), Date.now()).first<SamlTransaction>()
  if (!transaction) return invalidAssertion()
  return transaction
}

export function consumedRequestCache(requestId: string, transaction: SamlTransaction): CacheProvider {
  // The durable ID has already been consumed. Only this invocation can validate against it;
  // the library's further reads and removal operate on that exclusively owned transaction.
  let available = true
  const value = new Date(transaction.expires_at - transactionLifetimeMs).toISOString()
  return {
    async saveAsync() {throw new Error('Cannot create SAML requests during assertion validation')},
    async getAsync(key) {return available && key === requestId ? value : null},
    async removeAsync(key) {
      if (!available || key !== requestId) return null
      available = false
      return value
    },
  }
}
