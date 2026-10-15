import { Buffer } from 'node:buffer'
import { canonicalJson, sha256, type ImportMapping, type ImportPlan, type Json, type SourceArtifact, type SourceBundle, type SourceRecord } from '../../modules/import-kit/src/d1/index.ts'
import { sourceIdentity } from '../../modules/import-kit/src/provenance/identity.ts'
import { destination, mappingVersion, namespace } from './context.ts'
import { reject, type SnapshotInput, type SnapshotObject, type SourceLink } from './types.ts'

export const kitName = 'RepairShopr customer and asset snapshots'
export const missingCreatedAt = '1970-01-01T00:00:00.000Z'
export const snapshotLimits = { records: 100, bytes: 128 * 1024, recordBytes: 16 * 1024 } as const
export const assetId = (id: string) => `rs-${sha256(canonicalJson([namespace, 'asset', id])).slice(0, 32)}`

function object(value: unknown, label: string): SnapshotObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) reject('IMPORT_SHAPE', `${label} must be a JSON object.`, 400)
  return value as SnapshotObject
}
function id(value: Json | undefined, label: string): string {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    reject('IMPORT_SOURCE_ID', `${label} must be a positive safe integer.`, 400)
  return String(value)
}
function text(value: Json | undefined, label: string, max: number): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f]/.test(value))
    reject('IMPORT_FIELD', `${label} must be text of at most ${max} characters.`, 400)
  return value.trim()
}
function required(value: string, label: string): string {
  if (!value) reject('IMPORT_FIELD', `${label} is required.`, 400)
  return value
}
function createdAt(value: Json | undefined): string {
  if (value === undefined || value === null || value === '') return missingCreatedAt
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))
      || new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10))
    reject('IMPORT_DATE', 'Asset created_at must be an ISO date when supplied.', 400)
  return new Date(value).toISOString()
}
function customerName(customer: SnapshotObject): string {
  return required(text(customer.business_name, 'customer business_name', 200)
    || text(customer.fullname, 'customer fullname', 200)
    || [text(customer.firstname, 'customer firstname', 100), text(customer.lastname, 'customer lastname', 100)].filter(Boolean).join(' '), 'Customer name')
}
function customerEmail(value: Json | undefined): string {
  const email = text(value, 'customer email', 254)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) reject('IMPORT_FIELD', 'A supplied customer email must be valid.', 400)
  return email
}
function unmapped(payload: SnapshotObject, consumed: readonly string[]) {
  return Object.keys(payload).filter(field => !consumed.includes(field)).map(field => ({ field, reason: 'Retained in source custody; no native register field.' }))
}

function snapshot(value: object, kind: 'customer' | 'asset', key: 'customers' | 'assets') {
  const root = object(value, `${key} snapshot`)
  // Validate before serialization: undefined, nonfinite values and non-JSON
  // objects must never disappear from an apparently exact original.
  canonicalJson(root)
  const rows = root[key]
  if (!Array.isArray(rows)) reject('IMPORT_SHAPE', `Use the documented {${key}:[...]} response wrapper.`, 400)
  const name = `repairshopr-${key}.json`, bytes = Buffer.from(JSON.stringify(root), 'utf8')
  if (bytes.length > snapshotLimits.bytes) reject('IMPORT_LIMIT', 'Snapshots exceed the bounded move-in size.', 400)
  const artifact: SourceArtifact = { name, sha256: sha256(bytes), size: bytes.length, original: { status: 'available', base64: bytes.toString('base64') } }
  const records = rows.map((row, index): SourceRecord => {
    const payload = object(row, `${key}[${index}]`)
    if (Buffer.byteLength(canonicalJson(payload)) > snapshotLimits.recordBytes) reject('IMPORT_LIMIT', 'A source record exceeds the bounded move-in size.', 400)
    return { namespace, kind, sourceId: id(payload.id, `${kind}.id`), payload, payloadHash: sha256(canonicalJson(payload)), artifactHash: artifact.sha256, location: { artifact: name, pointer: `/${key}/${index}`, row: index + 1 } }
  })
  return { root, records, artifact }
}

export function snapshotSource(input: SnapshotInput): { source: SourceBundle; mapping: ImportMapping } {
  object(input, 'import input')
  const customers = snapshot(input.customers, 'customer', 'customers'), assets = snapshot(input.assets, 'asset', 'assets')
  const records = [...customers.records, ...assets.records]
  if (!assets.records.length) reject('IMPORT_EMPTY', 'Supply at least one asset in the asset snapshot.', 400)
  if (records.length > snapshotLimits.records || customers.artifact.size + assets.artifact.size > snapshotLimits.bytes)
    reject('IMPORT_LIMIT', `This kit accepts at most ${snapshotLimits.records} customer and asset records and ${snapshotLimits.bytes} bytes per review.`, 400)
  const byCustomer = new Map<string, SnapshotObject>()
  const seen = new Set<string>()
  for (const record of records) {
    const key = `${record.kind}:${record.sourceId}`
    if (seen.has(key)) reject('IMPORT_DUPLICATE_ID', 'A snapshot contains a duplicate source ID.', 400)
    seen.add(key)
    if (record.kind === 'customer') byCustomer.set(record.sourceId, record.payload as SnapshotObject)
  }
  const identifiers = new Set<string>()
  for (const record of assets.records) {
    const serial = required(text((record.payload as SnapshotObject).asset_serial, 'asset serial', 100), 'Asset serial').toLowerCase()
    if (identifiers.has(serial)) reject('IMPORT_DUPLICATE_IDENTIFIER', 'Two source assets use the same native identifier.', 400)
    identifiers.add(serial)
  }
  const diagnostics: SourceBundle['diagnostics'] = []
  for (const [key, item] of [['customers', customers], ['assets', assets]] as const) {
    const meta = item.root.meta
    if (meta && typeof meta === 'object' && !Array.isArray(meta) && typeof meta.total_pages === 'number' && meta.total_pages > 1)
      diagnostics.push({ severity: 'warning', code: 'PARTIAL_SNAPSHOT', message: `${key} reports multiple pages. Only the supplied page is included.` })
    for (const field of Object.keys(item.root).filter(field => field !== key))
      diagnostics.push({ severity: 'warning', code: 'UNMAPPED_WRAPPER', message: `${key}.${field} is retained in the original snapshot; it has no register mapping.`, field })
  }
  const mapping: ImportMapping = {
    version: mappingVersion,
    map(record) {
      const payload = record.payload as SnapshotObject
      if (record.kind === 'customer') return { effects: [], unmapped: [
        { reason: 'Customer source retained and linked to assets; this kit creates asset register entries only.' },
        ...unmapped(payload, ['id', 'firstname', 'lastname', 'fullname', 'business_name', 'email']),
      ] }
      const customerId = id(payload.customer_id, 'asset.customer_id')
      const customer = byCustomer.get(customerId)
      if (!customer) reject('IMPORT_ORPHAN_ASSET', `Asset ${record.sourceId} refers to customer ${customerId}, which is missing from the customer snapshot.`, 400)
      if (payload.customer && object(payload.customer, 'asset.customer').id !== Number(customerId))
        reject('IMPORT_CUSTOMER_LINK', 'An embedded customer disagrees with asset.customer_id.', 400)
      return {
        effects: [{ targetKind: 'asset', targetId: assetId(record.sourceId), value: {
          id: assetId(record.sourceId), version: 1,
          customerName: customerName(customer), customerEmail: customerEmail(customer.email),
          label: required(text(payload.name, 'asset name', 200), 'Asset name'),
          identifier: required(text(payload.asset_serial, 'asset serial', 100), 'Asset serial'), visits: [], createdAt: createdAt(payload.created_at),
        } }],
        unmapped: unmapped(payload, ['id', 'customer_id', 'name', 'asset_serial', 'created_at']),
      }
    },
  }
  return { source: { records, artifacts: [customers.artifact, assets.artifact], diagnostics }, mapping }
}

export function sourceLinks(plan: ImportPlan): SourceLink[] {
  return plan.entries.filter(entry => !entry.erased && entry.source.kind === 'asset').map(entry => {
    const customerSourceId = String((entry.source.payload as SnapshotObject).customer_id)
    return { assetSourceId: entry.source.sourceId, customerSourceId, targetId: entry.effects[0]?.targetId ?? assetId(entry.source.sourceId),
      assetSourceIdentity: entry.identity, customerSourceIdentity: sourceIdentity(destination, plan.namespace, 'customer', customerSourceId) }
  })
}
