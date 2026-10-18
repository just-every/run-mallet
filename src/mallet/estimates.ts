import { approval, bump, choice, event, expectVersion, fail, find, integer, put, selfApproval, text, who, type Context, type Handler, type Row } from './model'
import { lines, totals } from './money'
import { openJob } from './workshop'
import { configuredTax } from './tax'

export const current = (estimate: Row) => estimate.revisions[estimate.revisions.length - 1]
function revision(c: Context, p: any, n: number) {
  const priced = lines(p.lines, configuredTax(c.s))
  return { n, lines: priced, totals: totals(priced), notes: text(p.notes, 'notes', 4000, true), preparedBy: who(c), preparedAt: c.now, approval: null }
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
      if (job.estimateId) fail('DUPLICATE', 'This job already has an estimate. Revise that estimate.')
      const row = put(c.s, 'estimate', { jobId: job.id, status: 'draft', revisions: [revision(c, p, 1)], sent: [], authorisation: null, createdAt: c.now })
      bump(c.s, 'job', job, { estimateId: row.id })
      event(c, command, job.id, row.id, { revision: 1, totals: current(row).totals })
      return row
    }
    case 'estimate.revise': {
      const { estimate, rev } = exact(c, p)
      if (estimate.authorisation) fail('ESTIMATE_FROZEN', 'A customer authorized estimate is immutable. Book a new visit for additional work.')
      const job = find(c.s, 'job', estimate.jobId)
      if (!['booked', 'working'].includes(job.status)) fail('JOB_STATE', 'Completed jobs cannot have new estimates.')
      const next = revision(c, p, rev.n + 1)
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
      if (!Array.isArray(p.lineIds) || !p.lineIds.length || p.lineIds.length > rev.lines.length) fail('INPUT', 'Select at least one authorized estimate line.', null, 400)
      const lineIds = p.lineIds.map((id: unknown) => text(id, 'lineId'))
      if (new Set(lineIds).size !== lineIds.length || lineIds.some((id: string) => !rev.lines.some((l: Row) => l.id === id))) fail('INPUT', 'Authorized lines must be unique lines on this exact revision.', null, 400)
      const authorisation = { revision: rev.n, lineIds, customerName: text(p.customerName, 'customerName'), method: choice(p.method, ['signed', 'email reply', 'phone', 'in person'] as const, 'authorization method'), evidence: text(p.evidence, 'evidence', 4000), recordedBy: who(c), at: c.now, totals: totals(rev.lines.filter((l: Row) => lineIds.includes(l.id))) }
      const row = bump(c.s, 'estimate', estimate, { status: 'authorised', authorisation })
      event(c, command, row.jobId, row.id, authorisation)
      return row
    }
  }
}
