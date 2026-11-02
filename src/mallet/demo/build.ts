// Builds the sample workshop through Mallet's own commands (reduce), so every
// booking, estimate revision, approval, authorisation, actual and invoice obeys
// the same rules as the app. Generated ids are then renamed to fixed ones.
import { reduce, rows, type Actor, type Row, type State } from '../model'
import { current as revision } from '../estimates'
import { shopTime, shopWeekday, workshopClock } from './clock'
import { assets, assistantKey, contacts, owner, retiredKey, team, technician, type Who } from './people'
import { beginDemoQuality, finishDemoQuality } from './quality'
import { current, history, type Line, type Visit } from './jobs'

const MIN = 60000, HOUR = 60 * MIN
export type SeedRecord = [kind: string, id: string, revision: number, value: string]

export function buildWorkshop(now: Date, ownerId: string) {
  const clock = workshopClock(now)
  const s: State = { version: 0, records: {} }
  const person = (i: number): Actor => ({ id: team[i].id, name: team[i].name, role: team[i].role })
  const actors: Record<Who, Actor> = {
    kayla: { id: ownerId, name: owner, role: 'owner' }, ben: person(0), andre: person(1), luis: person(2), mei: person(3), jake: person(4), chris: person(5),
    agent: { id: assistantKey.id, name: assistantKey.label, role: 'agent' }, oldagent: { id: retiredKey.id, name: retiredKey.label, role: 'agent' },
  }
  const run = (who: Who, command: string, payload: any, at: number) => reduce(s, actors[who], command, payload, clock.iso(at))
  const get = (kind: string, id: string) => rows(s, kind).find(row => row.id === id) as Row
  const at = ([day, time]: [number, string]) => clock.ms(day, time)
  const lines = (list: Line[]) => list.map(([kind, description, quantity, dollars]) => ({ kind, description, quantity, unitCents: Math.round(dollars * 100) }))

  // Every asset is registered at the counter shortly before its first booking.
  const visits = [...history].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)).concat(current)
  const booked = (v: Visit, i: number) => clock.ms(v.day - (v.bookedAhead ?? 3), `09:${String((i * 7) % 50).padStart(2, '0')}`)
  // The sample shop explicitly chooses Franklin County's 7.5% sales tax on parts and labor.
  // Configure it before any estimate so sample financial records freeze it.
  run('kayla', 'tax.configure', { ratePercent: 7.5, partsTaxable: true, laborTaxable: true }, Math.min(...visits.map(booked)) - HOUR)
  const assetIds = new Map<string, string>()
  const firstBooking = (key: string) => Math.min(...visits.flatMap((v, i) => v.asset === key ? [booked(v, i)] : []), clock.ms(-2, '16:20'))
  for (const [key, customerName, customerEmail, label, identifier] of [...assets].sort((a, b) => firstBooking(a[0]) - firstBooking(b[0]))) {
    assetIds.set(key, run('ben', 'asset.create', { customerName, customerEmail, label, identifier }, firstBooking(key) - 6 * MIN).id)
  }

  visits.forEach((v, i) => {
    const asset = get('asset', assetIds.get(v.asset)!), start = clock.ms(v.day, v.start), end = start + v.hours * HOUR
    const customer = contacts[asset.customerName] ?? asset.customerName, first = customer.split(' ')[0]
    let tech = v.tech
    const job = () => get('job', jobId)
    const jobId = run(i % 4 ? 'ben' : 'kayla', 'job.book', { assetId: asset.id, version: asset.version, title: v.title, bayId: v.bay, technicianId: technician[tech], startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() }, booked(v, i)).id

    // A dispatch plan for this job: decided ones before any work; a pending one
    // is prepared last, against the job as it now stands.
    const dispatch = (d: NonNullable<Visit['dispatch']>, from: number) => {
      const planStart = clock.ms(d.day, d.start)
      return run(d.by, 'dispatch.prepare', { jobId, version: job().version, bayId: d.bay, technicianId: technician[d.tech], startAt: new Date(planStart).toISOString(), endAt: new Date(planStart + d.hours * HOUR).toISOString(), reason: d.reason.replaceAll('{next}', shopWeekday(planStart)) }, from)
    }
    const d = v.dispatch
    if (d?.approvedBy) {
      const from = clock.ms(v.day - 1, '15:00'), proposal = dispatch(d, from)
      run(d.approvedBy, 'dispatch.approve', { proposalId: proposal.id, version: proposal.version }, from + 20 * MIN)
      tech = d.tech
    }
    progress()
    // The pending plan follows the morning's decisions: prepared at 9:44, after the backorder notice.
    if (d && !d.approvedBy) dispatch(d, clock.ms(0, '09:44'))

    function progress() {
    if (v.stage === 'booked' || !v.lines) return

    const preparedBy = v.preparedBy ?? 'ben', approvedBy = v.approvedBy ?? (preparedBy === 'ben' && i % 3 === 0 ? 'kayla' : 'ben')
    let t = v.estimateAt ? at(v.estimateAt) : start + 30 * MIN
    let estimate = run(preparedBy, 'estimate.prepare', { jobId, version: job().version, lines: lines(v.lines) }, t)
    if (v.stage === 'draft') return
    const share = (n: number) => {
      const method = v.share ?? 'phone'
      const note = { phone: `Read the lines and total to ${first} by phone.`, email: `Emailed the printed estimate to ${asset.customerEmail} from the front desk.`, printed: `Printed estimate handed to ${first} at the counter.`, 'in person': `Went through the estimate with ${first} at drop-off.` }[method]
      estimate = run(approvedBy, 'estimate.approve', { estimateId: estimate.id, version: estimate.version, revision: n }, t += 10 * MIN)
      estimate = run('ben', 'estimate.markSent', { estimateId: estimate.id, version: estimate.version, revision: n, method, note: n > 1 ? `Revision ${n}. ${note}` : note }, t += 5 * MIN)
    }
    share(1)
    if (v.revise) {
      t = v.reviseAt ? at(v.reviseAt) : t + 30 * MIN
      estimate = run('ben', 'estimate.revise', { estimateId: estimate.id, version: estimate.version, revision: 1, lines: lines(v.revise) }, t)
      share(2)
    }
    if (v.stage === 'sent') return

    const rev = revision(estimate), method = v.authorise ?? 'phone'
    t = v.decidedAt ? at(v.decidedAt) : t + 25 * MIN
    const chosen = rev.lines.filter((_: Row, n: number) => !v.decline?.includes(n))
    const yes = chosen.length === rev.lines.length ? `all ${rev.lines.length} lines` : `${chosen.length} of ${rev.lines.length} lines, declined ${rev.lines.filter((l: Row) => !chosen.includes(l)).map((l: Row) => l.description.toLowerCase()).join(', ')}`
    const evidence = {
      phone: `Called ${first} at ${shopTime(t)}: approved ${yes} on revision ${rev.n}. Call noted on the job card.`,
      'email reply': `Email reply from ${asset.customerEmail} at ${shopTime(t)}: "Go ahead" with ${yes}. Filed in the job folder.`,
      'in person': `${first} approved ${yes} at the counter and initialled the job card.`,
      signed: `Signed printed estimate, revision ${rev.n}, ${yes}. Scanned to the job folder.`,
    }[method]
    estimate = run('ben', 'estimate.authorise', { estimateId: estimate.id, version: estimate.version, revision: rev.n, lineIds: chosen.map((l: Row) => l.id), customerName: customer, method, evidence }, t)
    if (v.stage === 'authorised') return

    const work: [number, number][] = v.work ?? chosen.map((l: Row) => [rev.lines.indexOf(l), l.quantity] as [number, number])
    const from = Math.max(start + 15 * MIN, t + 15 * MIN), finished = v.stage === 'working' ? from + work.length * 20 * MIN : end - 10 * MIN
    const step = work.length > 1 ? Math.max(5 * MIN, (finished - from) / (work.length - 1)) : 0
    const quality = v.stage === 'working' ? null : beginDemoQuality(run, job(), tech, from)
    let last = from
    work.forEach(([n, quantity], k) => {
      const line = rev.lines[n]
      last = from + k * (v.stage === 'working' ? 20 * MIN : step)
      run(tech, 'work.record', { jobId, version: job().version, lineId: line.id, quantity, note: line.kind === 'part' ? 'Fitted.' : '' }, last)
    })
    if (v.stage === 'working') return

    t = Math.max(last + 5 * MIN, end - 5 * MIN)
    finishDemoQuality(run, job(), tech, quality!, t)
    run('ben', 'job.complete', { jobId, version: job().version, note: `Road tested. Ready for ${first} to collect.` }, t)
    if (!v.invoice && v.stage !== 'invoiced') return
    let invoice = run(v.invoicedBy ?? 'ben', 'invoice.prepare', { jobId, version: job().version }, t += 10 * MIN)
    if (v.invoice === 'draft') return
    invoice = run('kayla', 'invoice.approve', { invoiceId: invoice.id, version: invoice.version, revision: 1 }, t += 15 * MIN)
    if (v.invoice === 'approved') return
    const collected = Math.max(end + HOUR, t + 30 * MIN)
    // Sample collection goes through the same explicit custody and owner exception gates.
    const handoverAt=collected-10*MIN
    const custody=run('ben','intake.record',{jobId,version:job().version,phase:'before',capturedAt:clock.iso(handoverAt-2*MIN),damage:'Sample condition checklist reviewed with customer; no additional damage noted.',items:[{kind:'key',label:'Vehicle key',quantity:1}],attachments:[],lockHandling:'Customer retains unlock codes; none stored.',signedBy:customer,consent:true},handoverAt-2*MIN)
    const comparison=run('ben','intake.compare',{jobId,version:job().version,intakeId:custody.id,returned:custody.items.map((x:any)=>({itemId:x.id,quantity:x.quantity})),signedBy:customer,consent:true},handoverAt-MIN)
    const reading=run('ben','reading.record',{jobId,version:job().version,stage:'out',value:50000+i*100,unit:'miles',observedAt:clock.iso(handoverAt-MIN)},handoverAt-MIN)
    const delegate=customer===job().asset.customerName?null:run('ben','return.delegate',{jobId,version:job().version,customerName:job().asset.customerName,delegateName:customer,evidence:'Sample business customer authorizes its named contact to collect this repair.',consent:true},handoverAt-MIN)
    const exception=run('kayla','return.override',{jobId,version:job().version,reason:'Sample owner explicitly permits collection without processor-verified settlement. No payment is inferred.'},handoverAt-MIN)
    run('ben', 'flow.collect', { jobId, version: job().version, flowVersion: 0, collectorName: customer, delegateId:delegate?.id,comparisonId:comparison.id,readingId:reading.id,overrideId:exception.id,identityEvidence:'Sample staff check of the named collector; no identity document retained.',warrantyAdvice:'Shop warranty advice supplied; ask the shop for a paper receipt.',settlementVersion:s.version,settlementReceipts:[], note: 'Picked up at the counter under explicit owner exception.' }, handoverAt)
    run('ben', 'invoice.export', { invoiceId: invoice.id, version: invoice.version }, collected)
    }
  })
  return fixedIds(s, new Set([ownerId, ...team.map(p => p.id), assistantKey.id, retiredKey.id]))
}

// Mallet's commands mint random UUIDs. A fixed sequence replaces each one in
// order of first appearance, so a repeated build gives the same ids.
function fixedIds(s: State, keep: Set<string>): SeedRecord[] {
  let x = 0x6d616c6c
  const next = () => { x = (x + 0x6d2b79f5) | 0; let r = Math.imul(x ^ (x >>> 15), 1 | x); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0).toString(16).padStart(8, '0') }
  const ids = new Map<string, string>()
  const fixed = (id: string) => { if (keep.has(id)) return id; let v = ids.get(id); if (!v) { const h = next() + next() + next() + next(); v = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) & 3]}${h.slice(17, 20)}-${h.slice(20, 32)}`; ids.set(id, v) } return v }
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
  return Object.entries(s.records).flatMap(([kind, list]) => list.map(row => {
    const value = JSON.stringify(row).replace(uuid, fixed)
    return [kind, fixed(row.id), row.version, value] as SeedRecord
  }))
}
