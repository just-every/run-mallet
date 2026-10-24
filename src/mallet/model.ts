import {deposits,depositCommands} from './deposits'
import {supplierOrders,supplierOrderCommands} from './supplier-orders'
import {transfers,transferCommands} from './stock-transfers'
import {supplierReturns,rmaCommands} from './supplier-returns'
import {cores,coreCommands} from './cores'
import {replenishment,replenishmentCommands} from './stock-replenishment'
import {invoiceDocuments,documentCommands} from './invoice-documents'
import {diagnosticResults,diagnosticResultCommands} from './diagnostic-results'
import {bookingWaitlist,waitlistCommands} from './booking-waitlist'
import {calendarCapacity,calendarCommands} from './calendar-capacity'
import {checkIns,checkInCommands} from './check-in'
import {credits,creditCommands} from './credits'
import {intakeForms,intakeFormCommands} from './intake-forms'
import {returns,returnCommands} from './returns'
import {warranty,warrantyCommands} from './warranty'
import {payments,paymentCommands} from './payments'
import {intake,intakeCommands} from './intake'
import {stockTrace,traceCommands} from './stock-trace'
import {customers,accountCommands} from './customers'
import {purchasing,purchasingCommands} from './purchasing'
import {inventory,inventoryCommands} from './inventory'
import {sublets,subletCommands} from './sublet'
import {retainStageChanges} from './reports/turnaround'
import {rateProfiles,rateProfileCommands} from './rate-profiles'
import {routing,routingCommands} from './routing'
import {specialParts,specialPartCommands} from './special-parts'
import {promises,promiseCommands,promiseMemberCommands} from './promises'
import {flow,flowCommands} from './flow'
import {time,timeCommands,timeMemberCommands} from './time'
import {payRates,payRateCommands} from './pay-rates'
import {diagnostics,diagnosisCommands,diagnosisMemberCommands} from './diagnostics'
import {approvalLinks,approvalLinkCommands} from './approval-links'
import {approvalChasing,chaseCommands,internalChaseCommands} from './approval-chasing'
import {collaboration,collaborationCommands,collaborationMemberCommands} from './collaboration'
import {pricing,pricingCommands} from './pricing'
import {inspections,inspectionCommands,inspectionMemberCommands} from './inspections'
import { quality, qualityCommands } from './quality'
import { declinedWork } from './declined-work'
import { mileage } from './mileage'
import { workshop } from './workshop'
import { estimates } from './estimates'
import { invoices } from './invoices'
import { tax, taxCommands, migrateSalesTax } from './tax'

import {inspectionReports,reportCommands} from './inspection-reports'
import {bookings,bookingCommands} from './bookings'

export type Row = { id: string; version: number; [key: string]: any }
export type Actor = { id: string; name: string; role: 'owner' | 'admin' | 'member' | 'agent' | 'customer' | 'system' }
export type State = { version: number; records: Record<string, Row[]> }
export type Context = { s: State; actor: Actor; now: string }
export type Handler = (c: Context, command: string, p: any) => any
type Statement = { bind(...values: any[]): Statement; all(): Promise<any> }
export type Database = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<any[]> }
export class MalletError extends Error {
  constructor(public code: string, message: string, public status = 409, public details: any = null) { super(message); this.name = 'MalletError' }
}
export function fail(code: string, message: string, details: any = null, status = 409): never { throw new MalletError(code, message, status, details) }
export function object(value: any, label = 'payload'): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INPUT', `${label} must be an object.`, null, 400)
  return value
}
export function text(value: unknown, label: string, max = 200, optional = false): string {
  if (optional && (value === undefined || value === null || value === '')) return ''
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail('INPUT', `${label} must contain 1–${max} characters.`, null, 400)
  return value.trim()
}
export function integer(value: unknown, label: string, min = 0, max = 1_000_000_000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail('INPUT', `${label} must be an integer from ${min} to ${max}.`, null, 400)
  return value
}
export function choice<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value as T)) fail('INPUT', `Choose ${label}: ${allowed.join(', ')}.`, null, 400)
  return value as T
}
export const rows = (s: State, kind: string): Row[] => s.records[kind] ?? (s.records[kind] = [])
export function find(s: State, kind: string, id: unknown): Row {
  const found = rows(s, kind).find(row => row.id === text(id, `${kind}Id`))
  if (!found) fail('NOT_FOUND', `That ${kind} does not exist.`, null, 404)
  return found
}
export function expectVersion(row: Row, version: unknown) {
  integer(version, 'version', 1, Number.MAX_SAFE_INTEGER)
  if (row.version !== version) fail('VERSION', 'This record changed. Refresh before continuing.', { id: row.id, current: row.version })
}
export const who = (c: Context) => ({ id: c.actor.id, name: c.actor.name, role: c.actor.role })
export function put(s: State, kind: string, value: Record<string, any>): Row {
  const row = { ...value, id: crypto.randomUUID(), version: 1 } as Row
  rows(s, kind).push(row)
  return row
}
export function bump(s: State, kind: string, row: Row, changes: Record<string, any>): Row {
  const next = { ...row, ...changes, id: row.id, version: row.version + 1 }
  rows(s, kind)[rows(s, kind).findIndex(x => x.id === row.id)] = next
  return next
}
export function event(c: Context, kind: string, jobId: string | null, subjectId: string, data: any) {
  return put(c.s, 'event', { kind, jobId, assetId: jobId ? find(c.s, 'job', jobId).assetId : kind.startsWith('asset.') ? subjectId : null, subjectId, at: c.now, actor: who(c), data })
}
export function selfApproval(c: Context, preparedBy: { id: string; role: string }) {
  if (preparedBy.role === 'agent' && preparedBy.id === c.actor.id) fail('SELF_APPROVAL', 'Another person must decide work prepared by this agent identity.')
}
export function approval(c: Context, kind: string, row: Row, revision: number, preparedBy: any) {
  return put(c.s, 'approval', { subjectKind: kind, subjectId: row.id, revision, subjectVersion: row.version, preparedBy, approvedBy: who(c), decision: 'approved', at: c.now })
}
const agentCommands = new Set(['estimate.prepare', 'estimate.revise', 'invoice.prepare', 'dispatch.prepare'])
const customerCommands = ['booking.hold','booking.confirm','booking.cancel','booking.reschedule','booking.outcome','checkin.submit','estimate.customerDecide', 'chaseOptOut.customer','intakeForm.customerSave','intakeForm.copyClaim','intakeForm.copyOutcome','intakeForm.copyAccess'], systemCommands = ['routing.sweep', 'approvalChase.sweep', 'approvalChase.outcome']
const commands = new Set([...depositCommands,...taxCommands,...documentCommands,...diagnosticResultCommands,...supplierOrderCommands,...transferCommands,...rmaCommands,...coreCommands,...replenishmentCommands,...waitlistCommands,...calendarCommands,...reportCommands,...bookingCommands,...checkInCommands,...creditCommands,...intakeFormCommands,...returnCommands,...warrantyCommands,...paymentCommands,...intakeCommands,...traceCommands,...accountCommands,...purchasingCommands,...inventoryCommands,...subletCommands,...rateProfileCommands,...routingCommands,...specialPartCommands,...flowCommands,...promiseCommands,...approvalLinkCommands,...chaseCommands,...internalChaseCommands,...collaborationCommands,...timeCommands,...payRateCommands,...diagnosisCommands,...pricingCommands,...inspectionCommands,...qualityCommands,'decline.record', 'decline.reprice', 'reading.record', 'serviceInterval.save', 'tax.configure', 'asset.create', 'asset.update', 'job.book', 'job.complete', 'work.record', 'estimate.prepare', 'estimate.revise', 'estimate.approve', 'estimate.markSent', 'estimate.authorise', 'invoice.prepare', 'invoice.approve', 'invoice.export', 'dispatch.prepare', 'dispatch.approve'])
export function reduce(s: State, actor: Actor, command: string, payload: any, now = new Date().toISOString()): any {
  object(actor, 'actor'); text(actor.id, 'actor.id'); text(actor.name, 'actor.name'); choice(actor.role, ['owner', 'admin', 'member', 'agent', 'customer', 'system'], 'role')
  // A customer link actor exists only to record its own decision or opt-out; the scheduler only runs reminders.
  if ((actor.role === 'customer') !== customerCommands.includes(command) || (actor.role === 'system') !== systemCommands.includes(command)) fail('FORBIDDEN', 'This role cannot perform that command.', null, 403)
  if (!commands.has(command)) fail('COMMAND', 'Unknown Mallet command.', null, 400)
  if (actor.role === 'agent' && !agentCommands.has(command) || actor.role === 'member' && ![...collaborationMemberCommands,...promiseMemberCommands,...timeMemberCommands,...diagnosisMemberCommands,...inspectionMemberCommands,'work.record','quality.record','quality.correct','quality.signTechnician'].includes(command)) fail('FORBIDDEN', 'This role cannot perform that command.', null, 403)
  migrateSalesTax(s)
  const c = { s, actor, now }, p = object(payload), eventCount = rows(s,'event').length
  for (const handler of [deposits,invoiceDocuments,diagnosticResults,supplierOrders,transfers,supplierReturns,cores,replenishment,bookingWaitlist,calendarCapacity,inspectionReports,bookings,checkIns,credits,intakeForms,returns,warranty,payments,intake,stockTrace,customers,purchasing,inventory,sublets,rateProfiles,routing,specialParts,flow, promises, approvalLinks, approvalChasing, collaboration, time, payRates, diagnostics, pricing, tax, workshop, mileage, estimates, declinedWork, invoices, quality, inspections]) {
    const result = handler(c, command, p)
    if (result !== undefined) { retainStageChanges(c,rows(s,'event').slice(eventCount)); return result }
  }
  return fail('COMMAND', 'Unknown Mallet command.', null, 400)
}
export async function load(db: Database, normalize = true): Promise<State> {
  const [meta, values] = await db.batch([db.prepare('SELECT version FROM mallet_meta WHERE id=1'), db.prepare('SELECT kind,value FROM mallet_records ORDER BY kind,id')])
  const version = meta.results?.[0]?.version
  if (!Number.isSafeInteger(version)) fail('STORAGE', 'Mallet migrations have not been applied.', null, 503)
  const s: State = { version, records: {} }
  for (const value of values.results ?? []) rows(s, value.kind).push(JSON.parse(value.value))
  if (normalize) migrateSalesTax(s)
  return s
}
export async function execute(db: Database, actor: Actor, command: string, payload: any, authority?: { sql: string; params: any[] }, now?: string): Promise<any> {
  const s = await load(db, false), before = new Map<string, string>()
  for (const [kind, values] of Object.entries(s.records)) for (const row of values) before.set(`${kind}:${row.id}`, JSON.stringify(row))
  const result = reduce(s, actor, command, payload, now)
  const statements = [db.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN version=? THEN 1 ELSE 0 END FROM mallet_meta WHERE id=1').bind(s.version)]
  if (authority) statements.push(db.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params))
  for (const [kind, values] of Object.entries(s.records)) for (const row of values) {
    const value = JSON.stringify(row)
    if (before.get(`${kind}:${row.id}`) !== value) statements.push(db.prepare('INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,value=excluded.value').bind(kind, row.id, row.version, value))
  }
  statements.push(db.prepare('DELETE FROM mallet_assert'))
  try { await db.batch(statements) } catch (error) {
    if (/CHECK constraint failed.*(?:mallet_assert|ok)/i.test(String(error))) fail('CONCURRENT_CHANGE', 'Data or session authority changed. Refresh before continuing.')
    throw error
  }
  return result
}
