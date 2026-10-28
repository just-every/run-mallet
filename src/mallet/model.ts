import {coverageFollowUp,coverageCommands} from './coverage-follow-up'
import {retail,retailCommands} from './retail'
import {locations,locationCommands,recordLocation} from './locations'
import {storage,storageCommands} from './storage'
import {webhooks,webhookCommands,internalWebhookCommands,retainWebhookEvent} from './webhooks'
import {assistant,assistantCommands} from './assistant'
import {statusNotices,statusNoticeCommands,internalStatusCommands} from './status-notices'
import {costRates,costRateCommands} from './reports/cost-rates'
import {reviews,reviewCommands} from './reviews'
import {outreach,outreachCommands} from './outreach'
import {returnRecords,returnRecordCommands} from './stripe/return-ledger'
import {terminalRecords,terminalRecordCommands} from './stripe/terminal-records'
import {guardCheckoutBalance} from './stripe/balance-guard'
import {stripeRecords,stripeCommands} from './stripe/records'
import {reportFilters,filterCommands} from './reports/filters'
import {taxCreditBasis,taxBasisCommands} from './tax-credit-basis'
import {retainAudit} from './audit'
import {tenderClearance,clearanceCommands} from './tender-clearance'
import {receivables,receivableCommands} from './receivables'
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
import {purchasing,purchasingCommands,purchaseInShop} from './purchasing'
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
export type Actor = { id: string; name: string; role: 'owner' | 'admin' | 'member' | 'agent' | 'customer' | 'system'; staffRole?:string; assistantGrantId?:string }
export type State = { version: number; records: Record<string, Row[]> }
export type Context = { s: State; actor: Actor; now: string }
export type Handler = (c: Context, command: string, p: any) => any
type Statement = { bind(...values: any[]): Statement; all(): Promise<any>; first(): Promise<any> }
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
export const who = (c: Context) => ({ id: c.actor.id, name: c.actor.name, role: c.actor.role,...(c.actor.staffRole?{staffRole:c.actor.staffRole}:{}) })
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
  const saved=put(c.s, 'event', { kind, jobId, assetId: jobId ? find(c.s, 'job', jobId).assetId : kind.startsWith('asset.') ? subjectId : null, subjectId, at: c.now, actor: who(c), data });retainWebhookEvent(c,saved);return saved
}
export function selfApproval(c: Context, preparedBy: { id: string; role: string }) {
  if (preparedBy.role === 'agent' && preparedBy.id === c.actor.id) fail('SELF_APPROVAL', 'Another person must decide work prepared by this agent identity.')
}
export function approval(c: Context, kind: string, row: Row, revision: number, preparedBy: any) {
  return put(c.s, 'approval', { subjectKind: kind, subjectId: row.id, revision, subjectVersion: row.version, preparedBy, approvedBy: who(c), decision: 'approved', at: c.now })
}
const agentCommands = new Set(['estimate.prepare', 'estimate.revise', 'invoice.prepare', 'dispatch.prepare'])
const customerCommands = ['review.respond','review.customerWithdraw','booking.hold','booking.confirm','booking.cancel','booking.reschedule','booking.outcome','checkin.submit','estimate.customerDecide', 'chaseOptOut.customer','intakeForm.customerSave','intakeForm.copyClaim','intakeForm.copyOutcome','intakeForm.copyAccess'], systemCommands = ['coverage.sweep',...internalWebhookCommands,...internalStatusCommands,'review.outcome','outreach.claim','outreach.outcome','reportDelivery.claim','reportDelivery.outcome','ar.reminderOutcome','routing.sweep', 'approvalChase.sweep', 'approvalChase.outcome']
export function reduce(s: State, actor: Actor, command: string, payload: any, now = new Date().toISOString()): any {
  const commands = new Set([...coverageCommands,...retailCommands,...locationCommands,...storageCommands,...assistantCommands,...webhookCommands,...statusNoticeCommands,...costRateCommands,...reviewCommands,...outreachCommands,...returnRecordCommands,...terminalRecordCommands,...stripeCommands,...filterCommands,...taxBasisCommands,...clearanceCommands,...receivableCommands,...depositCommands,...taxCommands,...documentCommands,...diagnosticResultCommands,...supplierOrderCommands,...transferCommands,...rmaCommands,...coreCommands,...replenishmentCommands,...waitlistCommands,...calendarCommands,...reportCommands,...bookingCommands,...checkInCommands,...creditCommands,...intakeFormCommands,...returnCommands,...warrantyCommands,...paymentCommands,...intakeCommands,...traceCommands,...accountCommands,...purchasingCommands,...inventoryCommands,...subletCommands,...rateProfileCommands,...routingCommands,...specialPartCommands,...flowCommands,...promiseCommands,...approvalLinkCommands,...chaseCommands,...internalChaseCommands,...collaborationCommands,...timeCommands,...payRateCommands,...diagnosisCommands,...pricingCommands,...inspectionCommands,...qualityCommands,'decline.record', 'decline.reprice', 'decline.inapplicable', 'reading.record', 'serviceInterval.save', 'tax.configure', 'asset.create', 'asset.update', 'job.book', 'job.complete', 'work.record', 'estimate.prepare', 'estimate.revise', 'estimate.approve', 'estimate.markSent', 'estimate.authorise', 'invoice.prepare', 'invoice.approve', 'invoice.export', 'dispatch.prepare', 'dispatch.approve'])
  object(actor, 'actor'); text(actor.id, 'actor.id'); text(actor.name, 'actor.name'); choice(actor.role, ['owner', 'admin', 'member', 'agent', 'customer', 'system'], 'role')
  // A customer link actor exists only to record its own decision or opt-out; the scheduler only runs reminders.
  if ((actor.role === 'customer') !== customerCommands.includes(command) || (actor.role === 'system') !== systemCommands.includes(command)) fail('FORBIDDEN', 'This role cannot perform that command.', null, 403)
  if (!commands.has(command)) fail('COMMAND', 'Unknown Mallet command.', null, 400)
  if (actor.role === 'agent' && !(actor.assistantGrantId?assistantCommands.includes(command):agentCommands.has(command)) || actor.role === 'member' && ![...filterCommands,...collaborationMemberCommands,...promiseMemberCommands,...timeMemberCommands,...diagnosisMemberCommands,...inspectionMemberCommands,'work.record','quality.record','quality.correct','quality.signTechnician'].includes(command)) fail('FORBIDDEN', 'This role cannot perform that command.', null, 403)
  migrateSalesTax(s)
  const c = { s, actor, now }, p = object(payload), eventCount = rows(s,'event').length
  guardCheckoutBalance(s,command,p)
  for (const handler of [coverageFollowUp,retail,locations,storage,assistant,webhooks,statusNotices,costRates,reviews,outreach,returnRecords,terminalRecords,stripeRecords,reportFilters,taxCreditBasis,tenderClearance,receivables,deposits,invoiceDocuments,diagnosticResults,supplierOrders,transfers,supplierReturns,cores,replenishment,bookingWaitlist,calendarCapacity,inspectionReports,bookings,checkIns,credits,intakeForms,returns,warranty,payments,intake,stockTrace,customers,purchasing,inventory,sublets,rateProfiles,routing,specialParts,flow, promises, approvalLinks, approvalChasing, collaboration, time, payRates, diagnostics, pricing, tax, workshop, mileage, estimates, declinedWork, invoices, quality, inspections]) {
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
export async function execute(db: Database, actor: Actor, command: string, payload: any, authority?: { sql: string; params: any[] }, now?: string, limits?:{spendCents:number;refundCents:number;discountBps:number;location?:string},retry?:{clientId:string;key:string;hash:string;response:(result:any)=>any}): Promise<any> {
  const replay=async()=>{
    if(!retry)return null
    const row=await db.prepare('SELECT request_hash,response FROM mallet_api_requests WHERE client_id=? AND request_key=?').bind(retry.clientId,retry.key).first()
    if(!row)return null
    if(!authority||!await db.prepare('SELECT 1 AS ok WHERE ('+authority.sql+')').bind(...authority.params).first())fail('FORBIDDEN','Current API authority is required for a replay.',null,403)
    if(row.request_hash!==retry.hash)fail('IDEMPOTENCY_CONFLICT','This retry key belongs to a different command or payload.')
    return {value:JSON.parse(row.response)}
  }
  const prior=await replay();if(prior)return prior.value
  const s = await load(db, false), before = new Map<string, string>()
  for (const [kind, values] of Object.entries(s.records)) for (const row of values) before.set(`${kind}:${row.id}`, JSON.stringify(row))
  const at=now??new Date().toISOString()
  if(limits){
    for(const [kind,field] of [['asset','assetId'],['job','jobId'],['estimate','estimateId'],['invoice','invoiceId'],['purchaseOrder','purchaseId'],['stockBin','binId'],['stockCount','countId'],['refund','refundId']]){
      if(!payload[field])continue;const row=find(s,kind,payload[field]);if(recordLocation(s,kind,row)!==(limits.location??'shop'))fail('LOCATION_SCOPE','This record belongs to another location.',null,403)
    }
    if(payload.binBarcode){const bin=rows(s,'stockBin').find(b=>b.barcode.toLowerCase()===String(payload.binBarcode).toLowerCase());if(bin&&recordLocation(s,'stockBin',bin)!==(limits.location??'shop'))fail('LOCATION_SCOPE','This bin belongs to another location.',null,403)}
  }
  if(limits&&(command==='purchase.create'||command.startsWith('purchase.')&&payload.purchaseId)&&!purchaseInShop(s,payload.purchaseId?find(s,'purchaseOrder',payload.purchaseId):{...payload,locationId:limits.location??'shop'},limits.location??'shop'))fail('LOCATION_SCOPE','This purchase includes stock or repair demand outside your shop.',null,403)
  if(limits&&Array.isArray(payload.lines))for(const line of payload.lines)if(line.jobId&&recordLocation(s,'job',find(s,'job',line.jobId))!==(limits.location??'shop'))fail('LOCATION_SCOPE','A purchase line belongs to another location.',null,403)
  if(limits&&command.startsWith('purchase.')&&payload.purchaseId){const purchase=find(s,'purchaseOrder',payload.purchaseId);if(purchase.totalCents>limits.spendCents)fail('SPEND_LIMIT','This purchase exceeds your delegated spend limit.',null,403)}
  const input=limits?{...payload,locationId:limits.location??'shop'}:payload
  let result:any
  try{result=reduce(s,actor,command,input,at)}catch(error){const saved=await replay();if(saved)return saved.value;throw error}
  if(limits)for(const kind of ['asset','job','stockBin','purchaseOrder'])for(const row of rows(s,kind))if(!before.has(`${kind}:${row.id}`))row.locationId=limits.location??'shop'
  if(limits){
    if(command.startsWith('purchase.')&&Number(result.totalCents??0)>limits.spendCents)fail('SPEND_LIMIT','This purchase exceeds your delegated spend limit.',null,403)
    if((command.startsWith('credit.')||command.startsWith('refund.'))&&Number(result.totals?.totalCents??result.amountCents??0)>limits.refundCents)fail('REFUND_LIMIT','This refund exceeds your delegated refund limit.',null,403)
    if(command.startsWith('estimate.')&&result.revisions){for(const line of result.revisions.at(-1).lines)if((line.unitDiscountCents??0)*10000>line.unitCents*limits.discountBps)fail('DISCOUNT_LIMIT','This estimate exceeds your delegated discount limit.',null,403)}
    if(command==='estimate.revise'){const previous=before.get('estimate:'+result.id);if(previous){const old=JSON.parse(previous).revisions[0].lines;for(const line of result.revisions.at(-1).lines){const source=old.find((l:any)=>l.id===line.id);if(!source||(line.unitCents-(line.unitDiscountCents??0))*10000<source.unitCents*(10000-limits.discountBps))fail('DISCOUNT_LIMIT','A revised line needs its original identity and must respect the delegated discount limit.',null,403)}}}
  }
  retainAudit(s,before,{...actor,role:actor.staffRole??actor.role},command,at)
  const statements = [db.prepare('INSERT INTO mallet_assert(ok) SELECT CASE WHEN version=? THEN 1 ELSE 0 END FROM mallet_meta WHERE id=1').bind(s.version)]
  if (authority) statements.push(db.prepare(`INSERT INTO mallet_assert(ok) SELECT CASE WHEN (${authority.sql}) THEN 1 ELSE 0 END`).bind(...authority.params))
  for (const [kind, values] of Object.entries(s.records)) for (const row of values) {
    const value = JSON.stringify(row)
    if (before.get(`${kind}:${row.id}`) !== value) statements.push(db.prepare('INSERT INTO mallet_records(kind,id,revision,value) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,value=excluded.value').bind(kind, row.id, row.version, value))
  }
  const response=retry?retry.response(result):result
  if(retry)statements.push(db.prepare('INSERT INTO mallet_api_requests(client_id,request_key,request_hash,response,created_at) VALUES(?,?,?,?,?)').bind(retry.clientId,retry.key,retry.hash,JSON.stringify(response),Date.now()))
  statements.push(db.prepare('DELETE FROM mallet_assert'))
  try { await db.batch(statements) } catch (error) {
    const saved=await replay();if(saved)return saved.value
    if (/CHECK constraint failed.*(?:mallet_assert|ok)/i.test(String(error))) fail('CONCURRENT_CHANGE', 'Data or session authority changed. Refresh before continuing.')
    throw error
  }
  return response
}
