import {fleetApproval} from './fleet-authority'
import {resolveRateProfile} from './rate-profiles'
import { approval, bump, choice, event, expectVersion, fail, find, integer, put, selfApproval, text, who, type Context, type Handler, type Row } from './model'
import { lines, totals } from './money'
import { openJob } from './workshop'
import { configuredTax } from './tax'
import { jobEstimates, normalizeReplacements, validateReplacements } from './supplement-scope'

export const current = (estimate: Row) => estimate.revisions[estimate.revisions.length - 1]
function revision(c: Context, p: any, n: number, job: Row) {
  const rateProfile = resolveRateProfile(c, p)
  const raw = rateProfile && Array.isArray(p.lines) ? p.lines.map((line:any)=>line.kind==='labor'||line.kind==='labour'?{...line,unitCents:rateProfile.snapshot.laborRateCents}:line) : p.lines
  const priced = normalizeReplacements(c, job, raw, lines(raw, configuredTax(c.s,job.asset.assetType)))
  validateReplacements(c, job, priced, p.estimateId)
  return { n, ...(rateProfile?{rateProfile}:{}), lines: priced, totals: totals(priced), notes: text(p.notes, 'notes', 4000, true), preparedBy: who(c), preparedAt: c.now, approval: null }
}
function exact(c: Context, p: any) {
  const estimate = find(c.s, 'estimate', p.estimateId)
  expectVersion(estimate, p.version)
  const rev = current(estimate)
  if (integer(p.revision, 'revision', 1) !== rev.n) fail('REVISION', 'Use the exact current estimate revision.', { current: rev.n })
  return { estimate, rev }
}
export const estimates: Handler = (c, command, p) => {
  switch (command) {
    case 'estimate.prepare': {
      const job = openJob(c, p)
      if (job.estimateId && p.supplement !== true) fail('DUPLICATE', 'This job already has an estimate. Revise it or explicitly prepare a supplement.')
      if (!job.estimateId && p.supplement === true) fail('ESTIMATE_REQUIRED', 'Prepare the original estimate before adding a supplement.')
      if (job.estimateId && !find(c.s, 'estimate', job.estimateId).authorisation) fail('NOT_AUTHORISED', 'Record the original customer decision before preparing incremental scope.')
      const supplemental = job.estimateId ? { supplementOf: job.estimateId, reason: text(p.reason, 'supplement reason', 2000), sequence: jobEstimates(c.s, job).length } : {}
      const row = put(c.s, 'estimate', { jobId: job.id, ...supplemental, status: 'draft', revisions: [revision(c, p, 1, job)], sent: [], authorisation: null, createdAt: c.now })
      bump(c.s, 'job', job, job.estimateId ? {} : { estimateId: row.id })
      event(c, command, job.id, row.id, { revision: 1, totals: current(row).totals })
      return row
    }
    case 'estimate.revise': {
      const { estimate, rev } = exact(c, p)
      if (estimate.authorisation) fail('ESTIMATE_FROZEN', 'A customer authorized estimate is immutable. Prepare a separate supplement on this repair for additional work or a prospective price change.')
      const job = find(c.s, 'job', estimate.jobId)
      if (!['booked', 'working'].includes(job.status)) fail('JOB_STATE', 'Completed jobs cannot have new estimates.')
      const next = revision(c, p, rev.n + 1, job)
      const row = bump(c.s, 'estimate', estimate, { status: 'draft', revisions: [...estimate.revisions, next] })
      event(c, command, job.id, row.id, { revision: next.n, totals: next.totals })
      return row
    }
    case 'estimate.approve': {
      const { estimate, rev } = exact(c, p)
      if (estimate.status !== 'draft') fail('ESTIMATE_STATE', 'Only a draft estimate can be approved.')
      selfApproval(c, rev.preparedBy)
      const row = bump(c.s, 'estimate', estimate, { status: 'approved', revisions: [...estimate.revisions.slice(0, -1), { ...rev, approval: { by: who(c), at: c.now } }] })
      approval(c, 'estimate', row, rev.n, rev.preparedBy)
      event(c, command, row.jobId, row.id, { revision: rev.n, totals: rev.totals })
      return row
    }
    case 'estimate.markSent': {
      const { estimate, rev } = exact(c, p)
      if (!rev.approval || !['approved', 'sent'].includes(estimate.status)) fail('NOT_APPROVED', 'A person must approve this exact estimate revision before it is shared.')
      selfApproval(c, rev.preparedBy)
      const share = { revision: rev.n, method: choice(p.method, ['email', 'printed', 'phone', 'in person', 'manual share'] as const, 'share method'), note: text(p.note, 'note', 1000, true), recordedBy: who(c), at: c.now, deliveryConfirmed: false }
      const row = bump(c.s, 'estimate', estimate, { status: 'sent', sent: [...estimate.sent, share] })
      event(c, command, row.jobId, row.id, share)
      return row
    }
    case 'estimate.authorise': {
      const { estimate, rev } = exact(c, p)
      if (!rev.approval || estimate.status !== 'sent' || !estimate.sent.some((s: any) => s.revision === rev.n)) fail('NOT_SENT', 'Record sharing the approved exact estimate revision before customer authorization.')
      selfApproval(c, rev.preparedBy)
      if (!Array.isArray(p.lineIds) || p.lineIds.length > rev.lines.length) fail('INPUT', 'Select the exact authorized lines; select none if all work is declined.', null, 400)
      const lineIds = p.lineIds.map((id: unknown) => text(id, 'lineId'))
      if (new Set(lineIds).size !== lineIds.length || lineIds.some((id: string) => !rev.lines.some((l: Row) => l.id === id))) fail('INPUT', 'Authorized lines must be unique lines on this exact revision.', null, 400)
      const job = find(c.s, 'job', estimate.jobId)
      if (!['booked', 'working'].includes(job.status)) fail('JOB_STATE', 'A completed repair cannot acquire new work authority.')
      validateReplacements(c, job, rev.lines.filter((l: Row) => lineIds.includes(l.id)), estimate.id)
      const fleet=fleetApproval(c,job,p)
      const authorisation = { ...(fleet?{fleet}:{}),revision: rev.n, lineIds, customerName: text(p.customerName, 'customerName'), method: choice(p.method, ['signed', 'email reply', 'phone', 'in person', 'other'] as const, 'authorization method'), evidence: text(p.evidence, 'evidence', 4000), recordedBy: who(c), at: c.now, totals: totals(rev.lines.filter((l: Row) => lineIds.includes(l.id))) }
      const row = bump(c.s, 'estimate', estimate, { status: lineIds.length ? 'authorised' : 'declined', authorisation })
      event(c, command, row.jobId, row.id, authorisation)
      return row
    }
  }
}
