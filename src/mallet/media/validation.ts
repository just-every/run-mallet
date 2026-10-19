import { createHash } from 'node:crypto'
import { choice, fail, integer, object, text } from '../model'
import { MIME_TYPES, type Annotations, type FindingInput, type Observation, type MediaMime, type Point, type UploadInput } from './types'
export function uuid(value: unknown, label: string): string {
 const result = text(value, label, 36)
 if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result)) fail('INPUT', `${label} must be a UUID.`, null, 400)
 return result.toLowerCase()
}
export function identifier(value: unknown, label: string): string { return text(value, label, 100) }
export function timestamp(value: unknown): string {
 const result = text(value, 'capturedAt', 40)
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) fail('INPUT', 'capturedAt must be an ISO timestamp with a timezone.', null, 400)
 const [year, month, day] = result.slice(0, 10).split('-').map(Number)
 const calendar = new Date(0); calendar.setUTCFullYear(year, month - 1, day)
 if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) fail('INPUT', 'capturedAt must contain a valid calendar date.', null, 400)
 if (new Date(result.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==result.slice(0,10) || Number(result.slice(11,13))>23) fail('INPUT', 'capturedAt must contain a valid calendar date and time.', null, 400)
 return new Date(result).toISOString()
}
export function hash(value: unknown): string {
 if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) fail('INPUT', 'sha256 must contain 64 hexadecimal characters.', null, 400)
 return value.toLowerCase()
}
function unit(value: unknown, label: string): number {
 if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) fail('INPUT', `${label} must be from 0 to 1.`, null, 400)
 return value
}
function point(value: unknown): Point { const p = object(value, 'point'); return { x: unit(p.x, 'x'), y: unit(p.y, 'y') } }
function list(value: unknown, max: number, label: string): any[] {
 if (!Array.isArray(value) || value.length > max) fail('INPUT', `${label} must be a list with at most ${max} items.`, null, 400)
 return value
}
export function annotations(value: unknown): Annotations | null {
 if (value === undefined || value === null) return null
 const input = object(value, 'annotations'), result: Annotations = {}; let count = 0
 if (Object.keys(input).some(key => !['text', 'strokes', 'labels'].includes(key))) fail('INPUT', 'Unknown annotation field.', null, 400)
 if (input.text !== undefined) result.text = text(input.text, 'annotation text', 2000)
 if (input.strokes !== undefined) result.strokes = list(input.strokes, 100, 'strokes').map(value => {
  const stroke = object(value, 'stroke'), color = text(stroke.color, 'color', 7).toLowerCase(), width = unit(stroke.width, 'width')
  if (!/^#[a-f0-9]{6}$/.test(color) || width === 0 || width > 0.1) fail('INPUT', 'Use a hex stroke color and normalized width greater than 0 and at most 0.1.', null, 400)
  const points = list(stroke.points, 1000, 'points').map(point); count += points.length
  if (points.length < 2 || count > 10000) fail('INPUT', 'Strokes need at least two points and at most 10000 total points.', null, 400)
  return { color, width, points }
 })
 if (input.labels !== undefined) result.labels = list(input.labels, 100, 'labels').map(value => { const label = object(value, 'label'); return { ...point(label), text: text(label.text, 'label text', 200) } })
 return Object.keys(result).length ? result : null
}
export function observation(value: unknown): Observation {
 const p = object(value, 'observation'), provenance = object(p.provenance ?? { kind: 'native' }, 'provenance')
 const measurements = list(p.measurements ?? [], 30, 'measurements').map(value => {
  const m = object(value, 'measurement')
  if (typeof m.value !== 'number' || !Number.isFinite(m.value) || Math.abs(m.value) > 1e9) fail('INPUT', 'Measurement must be a finite number within one billion.', null, 400)
  return { name: text(m.name, 'measurement name', 100), value: m.value, unit: text(m.unit, 'measurement unit', 30) }
 })
 if (new Set(measurements.map(m => m.name.toLowerCase()+'\0'+m.unit)).size !== measurements.length) fail('INPUT', 'Measurement names and units must be distinct.', null, 400)
 return { measurements, recommendation: text(p.recommendation, 'unresolved recommendation', 2000, true), provenance: provenance.kind === 'native' ? { kind: 'native' } : {
  kind: choice(provenance.kind, ['imported'] as const, 'provenance'), system: text(provenance.system, 'source system', 100), recordId: text(provenance.recordId, 'source record id', 200), observer: text(provenance.observer, 'source observer', 200)
 } }
}
export function findingInput(value: unknown): FindingInput {
 const p = object(value)
 return { jobId: identifier(p.jobId, 'jobId'), clientId: uuid(p.clientId, 'clientId'), title: text(p.title, 'title', 200), capturedAt: timestamp(p.capturedAt), ...(p.observation !== undefined ? { observation: observation(p.observation) } : {}) }
}
export function uploadInput(value: unknown): UploadInput {
 const p = object(value), variant = choice(p.variant, ['original', 'shared'] as const, 'variant'), mime = choice(p.mime, MIME_TYPES, 'mime'), notes = annotations(p.annotations)
 const filename = text(p.filename, 'filename', 180)
 if (/[\r\n\\/\u0000-\u001f\u007f]/.test(filename)) fail('INPUT', 'filename must be a plain filename.', null, 400)
 try { encodeURIComponent(filename) } catch { fail('INPUT', 'filename must contain valid Unicode.', null, 400) }
 if (variant === 'original' && (p.originalId != null || notes !== null)) fail('INPUT', 'Originals cannot refer to another original or contain annotations.', null, 400)
 return { findingId: identifier(p.findingId, 'findingId'), clientId: uuid(p.clientId, 'clientId'), variant, originalId: variant === 'shared' ? identifier(p.originalId, 'originalId') : null, filename, mime, size: integer(p.size, 'size', 1, mime.startsWith('image/') ? 8 * 1024 * 1024 : 32 * 1024 * 1024), sha256: hash(p.sha256), capturedAt: timestamp(p.capturedAt), annotations: notes }
}
export function decodeChunk(value: unknown, expectedLength: number): { bytes: Uint8Array; base64: string; sha256: string } {
 const p = object(value), sha256 = hash(p.sha256)
 if (typeof p.base64 !== 'string' || p.base64.length !== 4 * Math.ceil(expectedLength / 3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(p.base64)) fail('INPUT', 'Chunk must contain canonical base64 of the expected length.', null, 400)
 const bytes = Uint8Array.from(atob(p.base64), x => x.charCodeAt(0))
 if (bytes.length !== expectedLength || btoa(String.fromCharCode(...bytes)) !== p.base64) fail('INPUT', 'Incorrect chunk length or base64.', null, 400)
 if (createHash('sha256').update(bytes).digest('hex') !== sha256) fail('MEDIA_HASH', 'Chunk digest does not match its bytes.', null, 400)
 return { bytes, base64: p.base64, sha256 }
}
export function sniff(bytes: Uint8Array, mime: MediaMime): boolean {
 const starts = (...expected: number[]) => expected.every((n, i) => bytes[i] === n), ascii = (offset: number, value: string) => [...value].every((c, i) => bytes[offset + i] === c.charCodeAt(0))
 if (mime === 'image/jpeg') return starts(0xff, 0xd8, 0xff)
 if (mime === 'image/png') return starts(137, 80, 78, 71, 13, 10, 26, 10)
 if (mime === 'image/webp') return ascii(0, 'RIFF') && ascii(8, 'WEBP')
 if (mime === 'video/mp4') return ascii(4, 'ftyp') && bytes.length >= 12
 return starts(0x1a, 0x45, 0xdf, 0xa3)
}
