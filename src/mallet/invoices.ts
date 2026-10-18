import { approval, bump, event, expectVersion, fail, find, put, rows, selfApproval, who, type Context, type Handler, type Row } from './model'
import { price, totals, type Line } from './money'
import { current } from './estimates'

/** Invoice preparation freezes precisely the authorised estimate prices and actual quantities. */
function suggested(c: Context, job: Row) {
  const estimate = find(c.s, 'estimate', job.estimateId), rev = current(estimate)
  if (!rev.approval || !estimate.authorisation || estimate.authorisation.revision !== rev.n) fail('NOT_AUTHORISED', 'This job needs an approved, customer authorized estimate.')
  const priced: Line[] = []
  for (const line of rev.lines as Line[]) {
    const actuals = job.actuals.filter((a: any) => a.lineId === line.id)
    if (!actuals.length) continue
    if (!estimate.authorisation.lineIds.includes(line.id) || actuals.some((a: any) => a.estimateId !== estimate.id || a.revision !== rev.n)) fail('WORK_AUTHORITY', 'Recorded work does not belong to the approved, authorized revision.')
    const quantityMilli = actuals.reduce((sum: number, a: any) => sum + a.quantityMilli, 0)
    if (!Number.isSafeInteger(quantityMilli) || quantityMilli <= 0 || quantityMilli > line.quantityMilli) fail('WORK_AUTHORITY', 'Recorded work exceeds the customer authorized quantity.')
    const billed = { ...line, quantityMilli, quantity: quantityMilli / 1000 }
    priced.push({ ...billed, ...price(billed) })
  }
  if (!priced.length || job.actuals.some((a: any) => !priced.some(l => l.id === a.lineId))) fail('WORK_AUTHORITY', 'Every invoice line must come from authorized actual work.')
  return { estimateId: estimate.id, estimateRevision: rev.n, estimateApproval: rev.approval, customerAuthorisation: structuredClone(estimate.authorisation), lines: priced, totals: totals(priced) }
}
const csvCell = (value: unknown) => { const raw = String(value ?? ''), safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"` }
export const exportColumns = ['InvoiceNumber', 'CustomerName', 'CustomerEmail', 'Asset', 'Identifier', 'JobId', 'EstimateRevision', 'Description', 'Kind', 'Quantity', 'UnitUSD', 'SubtotalUSD', 'SalesTaxUSD', 'TotalUSD', 'Currency']
const dollars = (value: number) => `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
function csv(invoice: Row) {
  return [exportColumns, ...invoice.lines.map((line: Line) => [invoice.number, invoice.customer.customerName, invoice.customer.customerEmail, invoice.customer.label, invoice.customer.identifier, invoice.jobId, invoice.estimateRevision, line.description, line.kind, line.quantity, dollars(line.unitCents), dollars(line.subtotalCents), dollars(line.salesTaxCents), dollars(line.totalCents), 'USD'])].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
export const invoices: Handler = (c, command, p) => {
  switch (command) {
    case 'invoice.prepare': {
      const job = find(c.s, 'job', p.jobId)
      expectVersion(job, p.version)
      if (job.status !== 'completed') fail('JOB_STATE', 'Complete the job before preparing its invoice.')
      if (job.invoiceId || rows(c.s, 'invoice').some(i => i.jobId === job.id)) fail('DUPLICATE', 'This job already has an immutable invoice.')
      if ('lines' in p || 'totals' in p || 'totalCents' in p) fail('INPUT', 'Invoice prices and quantities come from authorized actual work.', null, 400)
      const snapshot = suggested(c, job)
      const row = put(c.s, 'invoice', { ...snapshot, number: `M-${String(rows(c.s, 'invoice').length + 1).padStart(6, '0')}`, jobId: job.id, jobVersion: job.version, customer: structuredClone(job.asset), actuals: structuredClone(job.actuals), status: 'draft', revision: 1, preparedBy: who(c), preparedAt: c.now, approval: null, exportId: null })
      bump(c.s, 'job', job, { invoiceId: row.id })
      event(c, command, job.id, row.id, { revision: 1, totals: row.totals, estimateId: row.estimateId, estimateRevision: row.estimateRevision })
      return row
    }
    case 'invoice.approve': {
      const invoice = find(c.s, 'invoice', p.invoiceId)
      expectVersion(invoice, p.version)
      if (invoice.status !== 'draft') fail('INVOICE_STATE', 'Only a draft invoice can be approved.')
      if (p.revision !== undefined && p.revision !== invoice.revision) fail('REVISION', 'Approve the exact invoice revision.', { current: invoice.revision })
      selfApproval(c, invoice.preparedBy)
      const row = bump(c.s, 'invoice', invoice, { status: 'approved', approval: { by: who(c), at: c.now, revision: invoice.revision, totals: invoice.totals } })
      approval(c, 'invoice', row, row.revision, row.preparedBy)
      event(c, command, row.jobId, row.id, { revision: row.revision, totals: row.totals })
      return row
    }
    case 'invoice.export': {
      const invoice = find(c.s, 'invoice', p.invoiceId)
      // A repeated export request is a retrieval of the original journal entry,
      // including when the caller holds the version from before the first export.
      if (invoice.exportId) {
        if (p.version !== invoice.version && p.version !== invoice.version - 1) expectVersion(invoice, p.version)
        selfApproval(c, invoice.preparedBy)
        return find(c.s, 'export', invoice.exportId)
      }
      expectVersion(invoice, p.version)
      if (invoice.status !== 'approved' || !invoice.approval) fail('NOT_APPROVED', 'A person must approve the exact invoice before export.')
      selfApproval(c, invoice.preparedBy)
      const exported = put(c.s, 'export', { invoiceId: invoice.id, invoiceRevision: invoice.revision, invoiceVersion: invoice.version, number: invoice.number, format: 'mallet-invoice-csv', currency: 'USD', totals: structuredClone(invoice.totals), lines: structuredClone(invoice.lines), csv: csv(invoice), by: who(c), at: c.now })
      bump(c.s, 'invoice', invoice, { status: 'exported', exportId: exported.id, exportedAt: c.now })
      const job = find(c.s, 'job', invoice.jobId)
      bump(c.s, 'job', job, { status: 'invoiced' })
      event(c, command, invoice.jobId, invoice.id, { exportId: exported.id, revision: invoice.revision, totals: invoice.totals })
      return exported
    }
  }
}
