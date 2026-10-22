import {capacityConflicts,resourceFields} from './calendar-capacity'
import {appointmentConflicts} from './bookings'
import {customerBillingSnapshot} from './customers'
import {assertSubletsReady,jobSublets} from './sublet'
import { onCrew } from './collaboration'
import { approval, bump, event, expectVersion, fail, find, put, rows, selfApproval, text, who, type Context, type Handler, type Row, type State } from './model'
import { assertQualityReady } from './quality'
import { quantity } from './money'
import { authorizedCap, estimateForWork } from './supplement-scope'

export function instant(value: unknown, label: string) {
  const raw = text(value, label, 40)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(Date.parse(raw))) fail('INPUT', `${label} must be an ISO timestamp including timezone.`, null, 400)
  const day = new Date(`${raw.slice(0, 10)}T00:00:00Z`)
  if (day.toISOString().slice(0, 10) !== raw.slice(0, 10) || Number(raw.slice(11, 13)) > 23) fail('INPUT', `${label} must contain a valid calendar date and time.`, null, 400)
  return new Date(raw).toISOString()
}
export function slot(p: any) {
  const startAt = instant(p.startAt, 'startAt'), endAt = instant(p.endAt, 'endAt')
  if (endAt <= startAt || Date.parse(endAt) - Date.parse(startAt) > 7 * 86400000) fail('INPUT', 'A booking must end after it starts and last no more than seven days.', null, 400)
  return { ...resourceFields(p), bayId: text(p.bayId, 'bayId', 100), technicianId: text(p.technicianId, 'technicianId', 100), startAt, endAt }
}
export function conflicts(s: State, plan: ReturnType<typeof slot>, exceptJobId?: string, includeAppointments = true) {
  const appointments=includeAppointments?appointmentConflicts(s,plan):[]
  return [...capacityConflicts(s,plan,exceptJobId,undefined,includeAppointments),...appointments.map(a=>({href:'/app/bookings',jobId:a.id,title:'Customer appointment',bayId:a.bayId,technicianId:a.technicianId,startAt:a.startAt,endAt:a.endAt,resources:['appointment']})),...rows(s, 'job').filter(j => j.id !== exceptJobId && !['completed', 'invoiced', 'canceled', 'lost'].includes(j.status) && plan.startAt < j.endAt && plan.endAt > j.startAt && (plan.bayId === j.bayId || plan.technicianId === j.technicianId)).map(j => ({ jobId: j.id, title: j.title, bayId: j.bayId, technicianId: j.technicianId, startAt: j.startAt, endAt: j.endAt, resources: [j.bayId === plan.bayId ? 'bay' : '', j.technicianId === plan.technicianId ? 'technician' : ''].filter(Boolean) }))]
}
function requireFree(c: Context, plan: ReturnType<typeof slot>, jobId?: string) {
  const found = conflicts(c.s, plan, jobId)
  if (found.length) fail('DISPATCH_CONFLICT', 'That bay or technician already has overlapping work.', { conflicts: found })
  return found
}
export function openJob(c: Context, p: any) {
  const job = find(c.s, 'job', p.jobId)
  expectVersion(job, p.version)
  if (job.status !== 'booked' && job.status !== 'working') fail('JOB_STATE', job.closure ? `This repair was ${job.status}; book a new visit instead.` : 'This job is already completed.')
  return job
}
function assetFields(p: any) {
  const customerEmail = text(p.customerEmail, 'customerEmail', 254, true)
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) fail('INPUT', 'Provide a valid customer email.', null, 400)
  return { customerName: text(p.customerName, 'customerName'), customerEmail, label: text(p.label, 'label'), identifier: text(p.identifier, 'identifier', 100) }
}
export const workshop: Handler = (c, command, p) => {
  switch (command) {
    case 'asset.create': {
      const fields = assetFields(p)
      if (rows(c.s, 'asset').some(a => a.identifier.toLowerCase() === fields.identifier.toLowerCase())) fail('DUPLICATE', 'A vehicle with that plate or VIN is already on file.')
      const row = put(c.s, 'asset', { ...fields, visits: [], createdAt: c.now })
      event(c, command, null, row.id, fields)
      return row
    }
    case 'asset.update': {
      const asset = find(c.s, 'asset', p.assetId)
      expectVersion(asset, p.version)
      const fields = assetFields(p)
      if (rows(c.s, 'asset').some(a => a.id !== asset.id && a.identifier.toLowerCase() === fields.identifier.toLowerCase())) fail('DUPLICATE', 'A vehicle with that plate or VIN is already on file.')
      const row = bump(c.s, 'asset', asset, fields)
      event(c, command, null, row.id, { before: assetFields(asset), after: fields })
      return row
    }
    case 'job.book': {
      const asset = find(c.s, 'asset', p.assetId)
      expectVersion(asset, p.version)
      const plan = slot(p)
      requireFree(c, plan)
      const row = put(c.s, 'job', { assetId: asset.id, asset: { customerName: asset.customerName, customerEmail: asset.customerEmail, label: asset.label, identifier: asset.identifier }, title: text(p.title, 'title'), notes: text(p.notes, 'notes', 4000, true), ...plan, status: 'booked', estimateId: null, invoiceId: null, actuals: [], createdAt: c.now, bookedBy: who(c) })
      if(asset.customerAccountId)put(c.s,'customerBilling',{jobId:row.id,snapshot:customerBillingSnapshot(c.s,asset),by:who(c),at:c.now})
      bump(c.s, 'asset', asset, { visits: [...asset.visits, row.id] })
      event(c, command, row.id, row.id, plan)
      return row
    }
    case 'dispatch.prepare': {
      const job = openJob(c, p), plan = slot({...job,...p})
      const row = put(c.s, 'proposal', { jobId: job.id, jobVersion: job.version, plan, reason: text(p.reason, 'reason', 2000), status: 'pending', preparedBy: who(c), preparedAt: c.now, conflictsWhenPrepared: conflicts(c.s, plan, job.id) })
      event(c, command, job.id, row.id, { plan, conflicts: row.conflictsWhenPrepared })
      return row
    }
    case 'dispatch.approve': {
      const proposal = find(c.s, 'proposal', p.proposalId)
      expectVersion(proposal, p.version)
      if (proposal.status !== 'pending') fail('PROPOSAL_STATE', 'This dispatch proposal has already been decided.')
      selfApproval(c, proposal.preparedBy)
      const job = find(c.s, 'job', proposal.jobId)
      expectVersion(job, proposal.jobVersion)
      if (!['booked', 'working'].includes(job.status)) fail('JOB_STATE', 'Completed jobs cannot be dispatched.')
      if (job.actuals.length) fail('WORK_RECORDED', 'A job with recorded work keeps its original assignment.')
      const reviewedConflicts = requireFree(c, proposal.plan, job.id)
      const nextJob = bump(c.s, 'job', job, { ...proposal.plan })
      const row = bump(c.s, 'proposal', proposal, { status: 'approved', approval: { by: who(c), at: c.now, reviewedConflicts }, appliedJobVersion: nextJob.version })
      approval(c, 'proposal', row, proposal.version, proposal.preparedBy)
      event(c, command, job.id, row.id, { before: { bayId: job.bayId, technicianId: job.technicianId, startAt: job.startAt, endAt: job.endAt }, after: proposal.plan, reviewedConflicts })
      return row
    }
    case 'work.record': {
      const job = openJob(c, p)
      if (c.actor.role === 'member' && !onCrew(job, c.actor.id)) fail('FORBIDDEN', 'Technicians record work only on their assigned jobs.', null, 403)
      if (!job.estimateId) fail('NOT_AUTHORISED', 'Approve and record customer authorization before recording work.')
      const { estimate, rev } = estimateForWork(c.s, job, p)
      const lineId = text(p.lineId, 'lineId'), line = rev.lines.find((l: Row) => l.id === lineId)
      if (!line || !estimate.authorisation.lineIds.includes(lineId)) fail('NOT_AUTHORISED', 'The customer did not authorize this line.')
      if (rows(c.s, 'specialPart').some(part => part.jobId === job.id && part.estimateId === estimate.id && part.revision === rev.n && part.lineId === lineId && !part.receipt)) fail('PART_NOT_RECEIVED', 'Receiving staff must confirm actual arrival before this special part is used.')
      if (jobSublets(c.s,job.id).some(r=>!r.receipt&&r.scopes.some((x:any)=>x.estimateId===estimate.id&&x.revision===rev.n&&x.lineId===lineId))) fail('SUBLET_CUSTODY','Receive the outsourced service before recording it as actual work.')
      const quantityMilli = quantity(p.quantity), used = job.actuals.filter((a: any) => a.estimateId === estimate.id && a.revision === rev.n && a.lineId === lineId).reduce((n: number, a: any) => n + a.quantityMilli, 0)
      const cap = authorizedCap(c.s, estimate, line)
      if (used + quantityMilli > cap) fail('QUANTITY_EXCEEDED', 'Actual work cannot exceed the approved, customer authorized quantity.', { lineId, approvedQuantity: cap / 1000, recordedQuantity: used / 1000, remainingQuantity: (cap - used) / 1000 })
      const actual = { id: crypto.randomUUID(), lineId, estimateId: estimate.id, revision: rev.n, kind: line.kind, quantityMilli, quantity: quantityMilli / 1000, note: text(p.note, 'note', 2000, true), by: who(c), at: c.now }
      const row = bump(c.s, 'job', job, { status: 'working', actuals: [...job.actuals, actual] })
      event(c, command, job.id, job.id, actual)
      return row
    }
    case 'job.complete': {
      const job = openJob(c, p)
      if (!job.actuals.length) fail('NO_WORK', 'Record authorized parts or labor before completing this job.')
      assertSubletsReady(c.s,job)
      assertQualityReady(c.s,job)
      const row = bump(c.s, 'job', job, { status: 'completed', completedAt: c.now, completedBy: who(c), completionNote: text(p.note, 'note', 2000, true) })
      event(c, command, row.id, row.id, { note: row.completionNote })
      return row
    }
  }
}

/** The register retains visits, including completed and invoiced jobs, and their audit trail. */
export function assetHistory(s: State, assetId: string) {
  const asset = find(s, 'asset', assetId), jobs = rows(s, 'job').filter(j => j.assetId === asset.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const ids = new Set(jobs.map(j => j.id))
  return { asset, jobs, estimates: rows(s, 'estimate').filter(e => ids.has(e.jobId)), invoices: rows(s, 'invoice').filter(i => ids.has(i.jobId)), events: rows(s, 'event').filter(e => e.assetId === asset.id || ids.has(e.jobId)).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)) }
}
const csvCell = (value: unknown) => { const raw = String(value ?? ''), safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"` }
export function assetHistoryCsv(s: State, assetId: string) {
  const history = assetHistory(s, assetId)
  return [['When', 'Vehicle', 'Identifier', 'Job', 'Event', 'Actor', 'Details'], ...history.events.map(e => [e.at, history.asset.label, history.asset.identifier, e.jobId ?? '', e.kind, e.actor.name, JSON.stringify(e.data)])].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
