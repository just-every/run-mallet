import type { Actor, Authority } from '../auth'
export type { Actor, Authority }
export const CHUNK_BYTES = 64 * 1024
export const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'] as const
export type MediaMime = typeof MIME_TYPES[number]
export type Point = { x: number; y: number }
export type Annotations = { text?: string; strokes?: { color: string; width: number; points: Point[] }[]; labels?: (Point & { text: string })[] }
export type Measurement = { name: string; value: number; unit: string }
export type Observation = { measurements: Measurement[]; recommendation: string; provenance: { kind: 'native' } | { kind: 'imported'; system: string; recordId: string; observer: string } }
export type CarriedFinding = Observation & { id: string; jobId: string; title: string; capturedAt: string; by: Actor; declinedWorkId: string | null }
export type FindingInput = { jobId: string; clientId: string; title: string; capturedAt: string; observation?: Observation; carriedFrom?: CarriedFinding }
export type UploadInput = { findingId: string; clientId: string; variant: 'original' | 'shared'; originalId: string | null; filename: string; mime: MediaMime; size: number; sha256: string; capturedAt: string; annotations: Annotations | null }
export type FindingRow = { id: string; job_id: string; client_id: string; title: string; captured_at: string; created_at: string; actor_json: string; request_json: string }
export type UploadRow = { id: string; finding_id: string; job_id: string; variant: 'original' | 'shared'; original_id: string | null; filename: string; mime: MediaMime; size: number; sha256: string; captured_at: string; received_at: string; actor_json: string; annotations_json: string | null; request_json: string; complete: number; completed_at: string | null }
export type ChunkRow = { ordinal: number; sha256: string; byte_length: number; base64: string }
export type Scope = { jobId: string; revision: number; actor: Actor; authority: Authority }
export type Sql = { sql: string; params?: any[] }
export const contentUrl = (id: string) => `/api/mallet/media/uploads/${encodeURIComponent(id)}/content`
export function findingView(row: FindingRow) { const input = JSON.parse(row.request_json); return { observation: input.observation ?? null, carriedFrom: input.carriedFrom ?? null, id: row.id, jobId: row.job_id, title: row.title, capturedAt: row.captured_at, createdAt: row.created_at, by: JSON.parse(row.actor_json) } }
export function uploadView(row: UploadRow) { return { id: row.id, findingId: row.finding_id, variant: row.variant, originalId: row.original_id, filename: row.filename, mime: row.mime, size: row.size, sha256: row.sha256, capturedAt: row.captured_at, receivedAt: row.received_at, completedAt: row.completed_at, by: JSON.parse(row.actor_json), annotations: row.annotations_json ? JSON.parse(row.annotations_json) : null, complete: row.complete === 1, contentUrl: row.complete ? contentUrl(row.id) : null } }
