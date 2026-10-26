import {DOMParser, type Element, type Node} from '@xmldom/xmldom'
import {invalidAssertion} from './http'
import {clockSkewMs, transactionLifetimeMs, assertionNamespace as A, protocolNamespace as P, signatureNamespace as D} from './types'

export function elements(node: Node): Element[] {
  const result: Element[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) if (child.nodeType === 1) result.push(child as Element)
  return result
}

export function parseXml(xml: string): Element {
  // No DTD, entity declaration, comments or CDATA: both downstream parsers see the same text.
  if (xml.includes('<!')) return invalidAssertion()
  let root: Element
  try {
    const doc = new DOMParser({onError: () => {throw new Error('Invalid XML')}}).parseFromString(xml, 'text/xml')
    if (elements(doc).length !== 1 || !doc.documentElement) return invalidAssertion()
    for (let child = doc.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1 && !(child.nodeType === 3 && !child.nodeValue?.trim()) &&
          !(child.nodeType === 7 && child.nodeName === 'xml' && child === doc.firstChild)) return invalidAssertion()
    }
    root = doc.documentElement
  } catch {return invalidAssertion()}
  const stack = [{node: root, depth: 1}], ids = new Set<string>()
  let count = 0
  while (stack.length) {
    const {node, depth} = stack.pop()!
    if (++count > 8192 || depth > 64) return invalidAssertion()
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes.item(i)!
      if (attr.localName?.toLowerCase() === 'id') {
        if (!attr.value || ids.has(attr.value) || attr.name !== 'ID') return invalidAssertion()
        ids.add(attr.value)
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (child.nodeType !== 1 && child.nodeType !== 3) return invalidAssertion()
    }
    for (const child of elements(node)) stack.push({node: child, depth: depth + 1})
  }
  return root
}

export function requireName(node: Element, ns: string, name: string) {
  if (node.namespaceURI !== ns || node.localName !== name) return invalidAssertion()
}

export function one(node: Element, ns: string, name: string): Element {
  const matches = elements(node).filter(child => child.namespaceURI === ns && child.localName === name)
  if (matches.length !== 1) return invalidAssertion()
  return matches[0]
}

export function allowed(node: Element, names: Record<string, string>) {
  for (const child of elements(node)) if (names[child.localName!] !== child.namespaceURI) return invalidAssertion()
}

export function text(node: Element): string {
  if (elements(node).length || !node.textContent || node.textContent.trim() !== node.textContent) return invalidAssertion()
  return node.textContent
}

export function id(node: Element): string {
  const value = node.getAttribute('ID') ?? ''
  if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,255}$/.test(value)) return invalidAssertion()
  return value
}

export function instant(value: string | null): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return invalidAssertion()
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return invalidAssertion()
  // Date.parse normalizes invalid calendar dates, which must not become valid SAML timestamps.
  if (new Date(ms).toISOString().slice(0, 19) !== value.slice(0, 19)) return invalidAssertion()
  return ms
}

export function recent(node: Element, now: number) {
  const issued = instant(node.getAttribute('IssueInstant'))
  if (issued > now + clockSkewMs || issued <= now - transactionLifetimeMs - clockSkewMs || node.getAttribute('Version') !== '2.0') return invalidAssertion()
}

export function window(node: Element, now: number) {
  const expires = instant(node.getAttribute('NotOnOrAfter'))
  const starts = node.hasAttribute('NotBefore') ? instant(node.getAttribute('NotBefore')) : null
  if (expires <= now - clockSkewMs || (starts !== null && (starts > now + clockSkewMs || starts >= expires))) return invalidAssertion()
}

export function signature(node: Element) {
  const sig = one(node, D, 'Signature')
  allowed(sig, {SignedInfo: D, SignatureValue: D, KeyInfo: D})
  text(one(sig, D, 'SignatureValue'))
  const info = one(sig, D, 'SignedInfo')
  allowed(info, {CanonicalizationMethod: D, SignatureMethod: D, Reference: D})
  const canon = one(info, D, 'CanonicalizationMethod').getAttribute('Algorithm')
  if (!['http://www.w3.org/2001/10/xml-exc-c14n#', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'].includes(canon ?? '')) return invalidAssertion()
  const method = one(info, D, 'SignatureMethod').getAttribute('Algorithm')
  if (!['rsa-sha256', 'rsa-sha384', 'rsa-sha512'].map(suffix => 'http://www.w3.org/2001/04/xmldsig-more#' + suffix).includes(method ?? '')) return invalidAssertion()
  const ref = one(info, D, 'Reference')
  if (ref.getAttribute('URI') !== '#' + id(node)) return invalidAssertion()
  allowed(ref, {Transforms: D, DigestMethod: D, DigestValue: D})
  text(one(ref, D, 'DigestValue'))
  const digest = one(ref, D, 'DigestMethod').getAttribute('Algorithm')
  if (!['http://www.w3.org/2001/04/xmlenc#sha256', 'http://www.w3.org/2001/04/xmldsig-more#sha384', 'http://www.w3.org/2001/04/xmlenc#sha512'].includes(digest ?? '')) return invalidAssertion()
  const transforms = one(ref, D, 'Transforms')
  allowed(transforms, {Transform: D})
  const algorithms = elements(transforms).map(child => child.getAttribute('Algorithm'))
  if (algorithms.length !== 2 || algorithms[0] !== D + 'enveloped-signature' || algorithms[1] !== 'http://www.w3.org/2001/10/xml-exc-c14n#') return invalidAssertion()
  // KeyInfo is only informational: Node-SAML verifies against the configured certificate.
  // Reject remote retrieval and objects anywhere, including those nested under KeyInfo.
  for (const child of Array.from(sig.getElementsByTagName('*'))) {
    if (['RetrievalMethod', 'Object', 'XPath', 'Manifest'].includes(child.localName!)) return invalidAssertion()
  }
}

export function uniqueStructure(root: Element, expected: Record<string, number>) {
  const counts: Record<string, number> = {}
  for (const node of [root, ...Array.from(root.getElementsByTagName('*'))]) {
    const name = node.localName!
    if (name in expected) {
      const namespace = ['Response', 'Status', 'StatusCode'].includes(name) ? P : name === 'Signature' ? D : A
      if (node.namespaceURI !== namespace) return invalidAssertion()
      counts[name] = (counts[name] ?? 0) + 1
    }
    if (['EncryptedAssertion', 'EncryptedID', 'EncryptedAttribute'].includes(name)) return invalidAssertion()
  }
  for (const [name, count] of Object.entries(expected)) if ((counts[name] ?? 0) !== count) return invalidAssertion()
}
