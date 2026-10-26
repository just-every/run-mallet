export type SamlProvider = {
  id: string
  label: string
  issuer: string
  ssoUrl: string
  certificate: string
  audience: string
  acsUrl: string
}

export type SamlEnvironment = {DB: D1Database}
export type SamlIdentity = {issuer: string; subject: string; requestId: string; returnTo: string}
export type SamlTransaction = {return_to: string; expires_at: number}

export const transactionLifetimeMs = 600_000
export const clockSkewMs = 60_000
export const maxPostBytes = 256 * 1024
export const assertionNamespace = 'urn:oasis:names:tc:SAML:2.0:assertion'
export const protocolNamespace = 'urn:oasis:names:tc:SAML:2.0:protocol'
export const signatureNamespace = 'http://www.w3.org/2000/09/xmldsig#'
