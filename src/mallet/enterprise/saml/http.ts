import {Buffer} from 'node:buffer'
import {X509Certificate} from 'node:crypto'
import {HttpError} from '../../auth'
import {maxPostBytes, type SamlProvider} from './types'

export const invalidAssertion = (): never => {throw new HttpError(400, 'invalid_saml_assertion')}

export function validateProvider(p: SamlProvider) {
  try {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(p.id)) throw new Error()
    for (const value of [p.issuer, p.audience]) {
      if (!value || value.length > 2048 || value.trim() !== value || /[\u0000-\u0020]/.test(value)) throw new Error()
      new URL(value)
    }
    for (const value of [p.ssoUrl, p.acsUrl]) {
      const url = new URL(value)
      if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.href !== value) throw new Error()
    }
    if (new URL(p.acsUrl).search) throw new Error()
    if (!/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----\s*$/.test(p.certificate) ||
        p.certificate.split('-----BEGIN CERTIFICATE-----').length !== 2) throw new Error()
    const cert = new X509Certificate(p.certificate)
    if (cert.publicKey.asymmetricKeyType !== 'rsa' || (cert.publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw new Error()
  } catch {throw new HttpError(503, 'invalid_saml_configuration')}
}

export function exactHost(request: Request, expected: URL) {
  const url = new URL(request.url)
  if (url.origin !== expected.origin || (request.headers.has('host') && request.headers.get('host')!.toLowerCase() !== expected.host.toLowerCase())) {
    throw new HttpError(403, 'invalid_host')
  }
}

export function safeReturnTo(returnTo: string, acsUrl: string) {
  if (typeof returnTo !== 'string' || returnTo.length > 2048 || !returnTo.startsWith('/') ||
      returnTo.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(returnTo)) throw new HttpError(400, 'invalid_return_to')
  const url = new URL(returnTo, acsUrl)
  if (url.origin !== new URL(acsUrl).origin) throw new HttpError(400, 'invalid_return_to')
  return url.pathname + url.search + url.hash
}

export const bindingCookieName = (p: SamlProvider) => '__Host-mallet-saml-' + p.id
export const clearBindingCookie = (p: SamlProvider) => `${bindingCookieName(p)}=; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=0`

export function browserBinding(request: Request, p: SamlProvider) {
  const name = bindingCookieName(p)
  const values = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(name + '='))
  if (values.length !== 1) return invalidAssertion()
  const value = values[0].slice(name.length + 1)
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) return invalidAssertion()
  return value
}

export async function readAssertionPost(request: Request) {
  if (request.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
  if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')) {
    throw new HttpError(415, 'invalid_saml_content_type')
  }
  const length = request.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > maxPostBytes)) throw new HttpError(413, 'body_too_large')
  if (!request.body) return invalidAssertion()
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxPostBytes) {await reader.cancel(); throw new HttpError(413, 'body_too_large')}
      chunks.push(value)
    }
  } finally {reader.releaseLock()}
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength}
  try {
    const fields = new URLSearchParams(new TextDecoder('utf-8', {fatal: true}).decode(bytes))
    if (fields.getAll('SAMLResponse').length !== 1 || fields.getAll('RelayState').length > 1 ||
        [...fields.keys()].some(key => !['SAMLResponse', 'RelayState'].includes(key))) return invalidAssertion()
    const encoded = fields.get('SAMLResponse')!
    if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return invalidAssertion()
    const decoded = Buffer.from(encoded, 'base64')
    if (decoded.toString('base64') !== encoded) return invalidAssertion()
    return {encoded, xml: new TextDecoder('utf-8', {fatal: true}).decode(decoded)}
  } catch (error) {
    if (error instanceof HttpError) throw error
    return invalidAssertion()
  }
}
