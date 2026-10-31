import assert from 'node:assert/strict'
import { randomBytes, randomUUID, webcrypto } from 'node:crypto'
import { HOSTED_ORIGIN, serveHosted } from '@runeditrun/rer/internal/cli/hosted-output.mjs'
import { verificationSponsors } from '@runeditrun/rer/internal/cli/agent-sponsors.mjs'
import { verificationReviewers } from '@runeditrun/rer/internal/cli/agent-reviewers.mjs'
import { createCapturedMail } from '@runeditrun/rer/internal/cli/agent-mail.mjs'
import { createAgentConformanceNetwork } from '@runeditrun/rer/internal/cli/agent-network.mjs'
import { seconds, signJws } from '../../src/modules/agent-door/conformance/crypto.mjs'

/** Use the pinned verifier's disposable installation and sponsor lifecycle APIs.
 * Each declared sponsor gets only its own accepted network-edge invitation. */
export async function memberInstallation(root, surface, run) {
 const declaration = surface.verification.nativeMember
 const memberEmail = ['synthetic-mallet-2', 'example.invalid'].join('@')
 const principals = await verificationSponsors(root, { ...surface.verification, sponsors: [
  { label: 'owner' }, { ...declaration, email: memberEmail, role: 'member' },
 ] })
 const owner = principals[0], member = principals[1], token = randomBytes(32).toString('hex')
 const issuer = `https://synthetic-mallet-${randomUUID()}.invalid`, installationId = randomUUID(), kid = randomUUID(), business = 'rer-agent-conformance'
 const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
 const { kty, crv, x, y } = await webcrypto.subtle.exportKey('jwk', keys.publicKey)
 const publicKeys = { [kid]: { kty, crv, x, y, kid, alg: 'ES256', use: 'sig' } }
 const signer = { issuer, installationId, kid, privateKey: keys.privateKey }
 const network = await createAgentConformanceNetwork(root, surface.verification.network, { email: owner.email })
 const mail = createCapturedMail(member.email), reviewers = await verificationReviewers(root, surface.verification.reviewers, owner.email)
 let hosted
 try {
  hosted = await serveHosted(root, { bindings: {
   RER_OWNER_CLAIM_ISSUER: issuer, RER_OWNER_CLAIM_INSTALLATION_ID: installationId, RER_OWNER_CLAIM_APP_ORIGIN: HOSTED_ORIGIN,
   RER_OWNER_CLAIM_PUBLIC_KEYS: JSON.stringify(publicKeys),
   RER_BUSINESS_TRUST: JSON.stringify({ v: 1, issuer, audience: HOSTED_ORIGIN, subject: installationId, email: owner.email, keys: publicKeys }),
   OWNER_EMAIL: owner.email, SETUP_TOKEN: token,
  }, outboundService: async request => {
   const memberCopy = request.clone(), reviewerCopy = reviewers.observes(request) ? request.clone() : null
   const response = await network.fetch(request)
   if (response.ok) await mail.capture(memberCopy)
   else await memberCopy.body?.cancel()
   if (reviewerCopy) await reviewers.capture(reviewerCopy, response.clone())
   return response
  } })
  const origin = hosted.origin
  const request = (absolute, init = {}) => {
   const url = new URL(absolute)
   assert.equal(url.origin, origin, 'native conformance stays inside the disposable installation')
   return hosted.fetch(url.href.slice(origin.length + 1), { ...init, signal: AbortSignal.timeout(30_000), headers: Object.fromEntries(new Headers(init.headers)) })
  }
  const bootstrap = await owner.initialize({ request, origin, email: owner.email, sub: owner.sub, token, displayName: 'Cedar Workshop Owner',
   reviewers: { initialize: (label, session) => reviewers.initialize(label, session, { request, origin }) }, mail: network.mail, fixtures: network.fixtures, database: hosted.database })
  const session = response => {
   assert.equal(response.status, 303)
   const cookie = response.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
   assert.ok(cookie)
   return cookie
  }
  const sponsors = [{ ...owner, cookie: session(bootstrap) }]
  await bootstrap.body?.cancel()
  const iat = seconds()
  const settings = await signJws(keys.privateKey, kid, 'rer-business-settings+jwt', {
   v: 1, iss: issuer, aud: origin, sub: installationId, business, email: owner.email, owner_id: owner.sub,
   jti: randomUUID(), iat, exp: iat + 300, rev: 1, values: {}, logo: null,
   team: [{ id: member.sub, email: member.email, name: member.label, role: member.role, invite: 1 }],
  })
  const paired = await request(origin + '/api/rer/business-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) })
  assert.equal(paired.status, 200)
  assert.equal((await paired.json()).rev, 1)
  const claim = await signJws(keys.privateKey, kid, 'rer-owner-claim+jwt', { v: 1, iss: issuer, aud: origin, installationId, email: member.email, jti: randomUUID(), iat, exp: iat + 300 })
  const joined = await member.initialize({ request, origin, ...member, owner: sponsors[0], token, claim: { mode: 'signed', path: '/auth/owner-claim', token: claim },
   displayName: member.label, database: hosted.database, mail: { read: options => mail.read(options) }, returnTo: '/app' })
  sponsors.push({ ...member, cookie: session(joined) })
  await joined.body?.cancel()
  assert.ok(reviewers.points().every(point => point.ok), 'independent native reviewer lifecycle')
  return await run({ request, origin, signer, business, sponsors, database: hosted.database })
 } finally {
  mail.close(); reviewers.close()
  try { await hosted?.close() } finally { await network.close() }
 }
}
