import type { D1Sql, ImportJob, ImportPlan, Json, RetainedOriginal } from '../../modules/import-kit/src/d1/index.ts'

export type ImportActor = { id: string; name: string; role: string }
/** Supplied by the authenticated handler; must consult the current session. */
export type ImportAuthority = { sql: string; params: any[] }
export type SnapshotInput = { customers: object; assets: object }
export type ApplyInput = SnapshotInput & { fingerprint: string }
export type SourceLink = {
  assetSourceId: string; customerSourceId: string; targetId: string
  assetSourceIdentity: string; customerSourceIdentity: string
}
export type ImportPreview = {
  name: string; fingerprint: string; counts: ImportPlan['counts']
  diagnostics: ImportPlan['diagnostics']; links: SourceLink[]; plan: ImportPlan
}
export type ImportJournal = {
  job: ImportJob; plan: ImportPlan; originals: RetainedOriginal[]; links: SourceLink[]; batches: Record<string, any>[]
}
/** Native SQL is server-authored. checkpoint is portability's redaction fence. */
export type EraseIntegration = { nativeStatements: D1Sql[]; checkpoint: D1Sql[] }
export type SnapshotObject = { [key: string]: Json }

export class ImportError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 409) {
    super(message); this.name = 'ImportError'; this.code = code; this.status = status
  }
}
export function reject(code: string, message: string, status = 409): never {
  throw new ImportError(code, message, status)
}
