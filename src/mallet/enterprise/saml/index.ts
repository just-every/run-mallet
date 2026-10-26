import {Buffer} from 'node:buffer'
import {SAML, ValidateInResponseTo, generateServiceProviderMetadata, type CacheProvider} from '@node-saml/node-saml'
import {digest, HttpError} from '../../auth'
import {inspectAssertion, inspectResponse} from './assertion'
import {bindingCookieName, browserBinding, exactHost, invalidAssertion, readAssertionPost, safeReturnTo, validateProvider} from './http'
import {consumedRequestCache, consumeTransaction, requestCache} from './transactions'
import {clockSkewMs, transactionLifetimeMs, type SamlEnvironment, type SamlIdentity, type SamlProvider} from './types'

export type {SamlProvider, SamlEnvironment, SamlIdentity} from './types'
export {clearBindingCookie} from './http'

const nameIdFormat = 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent'
const random = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32)))

function protocol(p: SamlProvider, cacheProvider: CacheProvider) {
  return new SAML({
    issuer: p.audience,
    audience: p.audience,
    entryPoint: p.ssoUrl,
    callbackUrl: p.acsUrl,
    idpIssuer: p.issuer,
    idpCert: p.certificate,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: transactionLifetimeMs,
    maxAssertionAgeMs: transactionLifetimeMs,
    acceptedClockSkewMs: clockSkewMs,
    identifierFormat: nameIdFormat,
    allowCreate: false,
    disableRequestedAuthnContext: true,
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    generateUniqueId: () => '_' + random().toString('hex'),
    cacheProvider,
  })
}

export async function authorizationRequest(env: SamlEnvironment, p: SamlProvider, request: Request, returnTo: string): Promise<Response> {
  validateProvider(p)
  exactHost(request, new URL(p.acsUrl))
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
  if (request.headers.get('origin') !== new URL(p.acsUrl).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, 'invalid_origin')
  const binding = random().toString('base64url')
  const saml = protocol(p, requestCache(env, p, await digest(binding), safeReturnTo(returnTo, p.acsUrl)))
  const location = await saml.getAuthorizeUrlAsync('', undefined, {})
  return new Response(null, {status: 303, headers: {
    location,
    'set-cookie': `${bindingCookieName(p)}=${binding}; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=${transactionLifetimeMs / 1000}`,
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  }})
}

export async function consumeAssertion(env: SamlEnvironment, p: SamlProvider, request: Request): Promise<SamlIdentity> {
  validateProvider(p)
  exactHost(request, new URL(p.acsUrl))
  if (request.url !== p.acsUrl) throw new HttpError(403, 'invalid_saml_destination')
  const binding = browserBinding(request, p)
  const {encoded, xml} = await readAssertionPost(request)
  const requestId = inspectResponse(xml, p, Date.now())
  const transaction = await consumeTransaction(env, p, requestId, binding)
  try {
    const {profile, loggedOut} = await protocol(p, consumedRequestCache(requestId, transaction)).validatePostResponseAsync({SAMLResponse: encoded})
    if (loggedOut || !profile || typeof profile.getAssertionXml !== 'function') return invalidAssertion()
    const identity = inspectAssertion(profile.getAssertionXml(), p, requestId, Date.now())
    return {...identity, requestId, returnTo: safeReturnTo(transaction.return_to, p.acsUrl)}
  } catch {return invalidAssertion()}
}

export function metadata(p: SamlProvider): string {
  validateProvider(p)
  return generateServiceProviderMetadata({issuer: p.audience, callbackUrl: p.acsUrl, identifierFormat: nameIdFormat, wantAssertionsSigned: true})
}
