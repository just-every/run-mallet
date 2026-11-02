import { fail, integer, object, text, type Context, type Row, type State } from './model'
import type { Line } from './money'

type Replacement = { estimateId: string; revision: number; lineId: string; quantityMilli: number }
type ScopedLine = Line & { replaces?: Replacement }
const current = (estimate: Row) => estimate.revisions.at(-1)
const estimateRows = (s: State): Row[] => s.records.estimate ?? []
const decided = (estimate: Row) => {
  const rev = current(estimate)
  return !!rev?.approval && estimate.authorisation?.revision === rev.n
}

/** The original estimate remains the repair's root; supplements never replace it. */
export function jobEstimates(s: State, job: Row): Row[] {
  const root = estimateRows(s).find(e => e.id === job.estimateId && e.jobId === job.id)
  if (!root) return []
  return [root, ...estimateRows(s).filter(e => e.id !== root.id && e.jobId === job.id && e.supplementOf === root.id).sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))]
}

export function estimateForWork(s: State, job: Row, p: any) {
  const id = p.estimateId === undefined ? job.estimateId : text(p.estimateId, 'estimateId')
  const estimate = jobEstimates(s, job).find(e => e.id === id)
  if (!estimate) fail('NOT_AUTHORISED', 'Choose an estimate belonging to this repair.')
  const rev = current(estimate)
  if (estimate.supplementOf && p.revision === undefined) fail('REVISION', 'Supplemental work must name its exact authorized revision.')
  if (p.revision !== undefined && integer(p.revision, 'revision', 1) !== rev.n) fail('REVISION', 'Use the exact authorized estimate revision.', { current: rev.n })
  if (!decided(estimate)) fail('NOT_AUTHORISED', 'This estimate revision needs person approval and customer authorization before work.')
  return { estimate, rev }
}

function remaining(s: State, estimate: Row, line: ScopedLine, excludeEstimateId?: string): number {
  const rootId = estimate.supplementOf ?? estimate.id
  const revision = current(estimate).n
  let replaced = 0
  for (const other of estimateRows(s)) {
    if (other.id === estimate.id || other.id === excludeEstimateId || other.jobId !== estimate.jobId || (other.id !== rootId && other.supplementOf !== rootId) || !decided(other)) continue
    const authorized = new Set(other.authorisation.lineIds)
    for (const candidate of current(other).lines as ScopedLine[]) {
      const ref = candidate.replaces
      if (authorized.has(candidate.id) && ref?.estimateId === estimate.id && ref.revision === revision && ref.lineId === line.id) replaced += ref.quantityMilli
    }
  }
  if (!Number.isSafeInteger(replaced)) fail('REPLACEMENT_QUANTITY', 'The replacement quantity is too large.')
  return line.quantityMilli - replaced
}

/** An undecided or declined proposal never consumes the original authorization. */
export function authorizedCap(s: State, estimate: Row, line: ScopedLine): number {
  return remaining(s, estimate, line)
}

function replacementTarget(c: Context, job: Row, line: ScopedLine, excludeEstimateId?: string) {
  const ref = object(line.replaces, 'replacement reference')
  const estimateId = text(ref.estimateId, 'replacement estimateId')
  const revision = integer(ref.revision, 'replacement revision', 1)
  const lineId = text(ref.lineId, 'replacement lineId')
  const quantityMilli = integer(ref.quantityMilli, 'replacement quantityMilli', 1, Number.MAX_SAFE_INTEGER)
  if (estimateId === excludeEstimateId) fail('REPLACEMENT_SCOPE', 'A supplement cannot replace its own lines.')
  const estimate = jobEstimates(c.s, job).find(e => e.id === estimateId)
  if (!estimate || !decided(estimate)) fail('REPLACEMENT_SCOPE', 'A replacement must reference previously authorized work on this repair.')
  const rev = current(estimate)
  if (revision !== rev.n) fail('REVISION', 'A replacement must name the exact authorized source revision.', { estimateId, current: rev.n })
  const original = (rev.lines as ScopedLine[]).find(l => l.id === lineId)
  if (!original || !estimate.authorisation.lineIds.includes(lineId)) fail('REPLACEMENT_SCOPE', 'The customer must have authorized the line being replaced.')
  if (original.kind !== line.kind) fail('REPLACEMENT_SCOPE', 'A replacement must keep the original part or labor kind.')
  if (quantityMilli !== line.quantityMilli) fail('REPLACEMENT_QUANTITY', 'The replacement quantity must equal the new line quantity.')
  return { estimate, original, ref: { estimateId, revision, lineId, quantityMilli } }
}

/** Money parsing owns prices; this attaches only normalized scope references. */
export function normalizeReplacements(c: Context, job: Row, rawLines: unknown, priced: Line[]): ScopedLine[] {
  if (!Array.isArray(rawLines) || rawLines.length !== priced.length) fail('INPUT', 'Replacement references must correspond to the priced estimate lines.', null, 400)
  return priced.map((line, index) => {
    const raw = object(rawLines[index], 'estimate line')
    if (raw.replaces === undefined) return { ...line }
    const supplied = object(raw.replaces, 'replacement reference')
    const candidate = { ...line, replaces: { estimateId: text(supplied.estimateId, 'replacement estimateId'), revision: integer(supplied.revision, 'replacement revision', 1), lineId: text(supplied.lineId, 'replacement lineId'), quantityMilli: line.quantityMilli } }
    const { ref } = replacementTarget(c, job, candidate)
    return { ...line, replaces: ref }
  })
}

/** Recheck at authorization: another supplement may have consumed capacity. */
export function validateReplacements(c: Context, job: Row, newLines: ScopedLine[], excludeEstimateId?: string): void {
  const groups = new Map<string, { estimate: Row; original: ScopedLine; ref: Replacement; quantityMilli: number }>()
  for (const line of newLines) {
    if (line.replaces === undefined) continue
    const target = replacementTarget(c, job, line, excludeEstimateId)
    const key = JSON.stringify([target.ref.estimateId, target.ref.revision, target.ref.lineId])
    const group = groups.get(key)
    if (group) group.quantityMilli += target.ref.quantityMilli
    else groups.set(key, { ...target, quantityMilli: target.ref.quantityMilli })
  }
  for (const { estimate, original, ref, quantityMilli } of groups.values()) {
    const actualQuantity = (job.actuals ?? []).filter((a: any) => a.estimateId === ref.estimateId && a.revision === ref.revision && a.lineId === ref.lineId).reduce((sum: number, a: any) => sum + a.quantityMilli, 0)
    const reserved = (c.s.records.sublet??[]).flatMap(r=>r.scopes).filter((x:any)=>x.estimateId===ref.estimateId&&x.revision===ref.revision&&x.lineId===ref.lineId).reduce((n:number,x:any)=>n+x.charge.quantityMilli,0)
    const available = remaining(c.s, estimate, original, excludeEstimateId) - Math.max(actualQuantity,reserved)
    if (!Number.isSafeInteger(quantityMilli) || !Number.isSafeInteger(actualQuantity) || quantityMilli > available) fail('REPLACEMENT_QUANTITY', 'Replacement scope cannot exceed the original authorized quantity still unworked and unreplaced.', { estimateId: ref.estimateId, revision: ref.revision, lineId: ref.lineId, availableQuantity: available / 1000, replacementQuantity: quantityMilli / 1000 })
  }
}
