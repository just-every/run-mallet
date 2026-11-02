import {invalidAssertion} from './http'
import {assertionNamespace as A, protocolNamespace as P, signatureNamespace as D, clockSkewMs, type SamlProvider} from './types'
import {allowed, elements, id, instant, one, parseXml, recent, requireName, signature, text, uniqueStructure, window} from './xml'

const shape = {Assertion: 1, Subject: 1, NameID: 1, SubjectConfirmation: 1, SubjectConfirmationData: 1, Conditions: 1, AuthnStatement: 1}

export function inspectAssertion(xml: string, p: SamlProvider, requestId: string, now: number) {
  const assertion = parseXml(xml)
  requireName(assertion, A, 'Assertion')
  uniqueStructure(assertion, {...shape, Response: 0, Issuer: 1, Signature: 1})
  allowed(assertion, {Issuer: A, Signature: D, Subject: A, Conditions: A, AuthnStatement: A, AttributeStatement: A})
  id(assertion)
  recent(assertion, now)
  signature(assertion)
  if (text(one(assertion, A, 'Issuer')) !== p.issuer) return invalidAssertion()
  const subject = one(assertion, A, 'Subject')
  allowed(subject, {NameID: A, SubjectConfirmation: A})
  const name = one(subject, A, 'NameID'), value = text(name)
  if (value.length > 1024 || /[\u0000-\u001f\u007f]/.test(value) ||
      (name.hasAttribute('NameQualifier') && name.getAttribute('NameQualifier') !== p.issuer) ||
      (name.hasAttribute('SPNameQualifier') && name.getAttribute('SPNameQualifier') !== p.audience)) return invalidAssertion()
  const confirmation = one(subject, A, 'SubjectConfirmation')
  allowed(confirmation, {SubjectConfirmationData: A})
  if (confirmation.getAttribute('Method') !== 'urn:oasis:names:tc:SAML:2.0:cm:bearer') return invalidAssertion()
  const data = one(confirmation, A, 'SubjectConfirmationData')
  if (elements(data).length || data.getAttribute('InResponseTo') !== requestId || data.getAttribute('Recipient') !== p.acsUrl) return invalidAssertion()
  window(data, now)
  const conditions = one(assertion, A, 'Conditions')
  allowed(conditions, {AudienceRestriction: A, OneTimeUse: A})
  window(conditions, now)
  const restrictions = elements(conditions).filter(node => node.localName === 'AudienceRestriction')
  if (!restrictions.length) return invalidAssertion()
  for (const restriction of restrictions) {
    allowed(restriction, {Audience: A})
    const audiences = elements(restriction)
    if (!audiences.length || !audiences.some(node => text(node) === p.audience)) return invalidAssertion()
  }
  const authn = one(assertion, A, 'AuthnStatement')
  if (instant(authn.getAttribute('AuthnInstant')) > now + clockSkewMs ||
      (authn.hasAttribute('SessionNotOnOrAfter') && instant(authn.getAttribute('SessionNotOnOrAfter')) <= now - clockSkewMs)) return invalidAssertion()
  // Deliberately read no attributes, email, roles, groups or session claims.
  return {issuer: p.issuer, subject: value}
}

export function inspectResponse(xml: string, p: SamlProvider, now: number) {
  const response = parseXml(xml)
  requireName(response, P, 'Response')
  uniqueStructure(response, {...shape, Response: 1, Issuer: 2, Signature: 2, Status: 1, StatusCode: 1})
  allowed(response, {Issuer: A, Signature: D, Status: P, Assertion: A})
  id(response)
  recent(response, now)
  signature(response)
  if (text(one(response, A, 'Issuer')) !== p.issuer || response.getAttribute('Destination') !== p.acsUrl) return invalidAssertion()
  const status = one(response, P, 'Status')
  allowed(status, {StatusCode: P, StatusMessage: P})
  const code = one(status, P, 'StatusCode')
  if (elements(code).length || code.getAttribute('Value') !== 'urn:oasis:names:tc:SAML:2.0:status:Success') return invalidAssertion()
  const requestId = response.getAttribute('InResponseTo') ?? ''
  if (!/^_[a-f0-9]{64}$/.test(requestId)) return invalidAssertion()
  // Structural checks before consuming the browser-bound transaction. Trust is only granted
  // after Node-SAML verifies both signatures and the verified assertion is checked again.
  inspectAssertion(one(response, A, 'Assertion').toString(), p, requestId, now)
  return requestId
}
