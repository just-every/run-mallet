import { ToolRefusal, type ToolContext, type ToolDefinition, type JsonSchemaObject } from '../../modules/agent-door/index.ts'
import { execute, load, MalletError } from '../model'
import { nativeAuthority, preparationActor } from './people.ts'
import { readRepair, readableState } from './records.ts'
import { webhookFamily } from '../webhooks'

const id = { type: 'string', minLength: 1, maxLength: 200 }
const version = { type: 'integer', minimum: 1 }
const text = { type: 'string', maxLength: 4000 }
const line = { type: 'object', required: ['kind', 'description', 'quantity', 'unitCents'], properties: {
  id, kind: { enum: ['part', 'labor', 'labour'] }, description: { type: 'string', minLength: 1, maxLength: 1000 },
  quantity: { type: 'number', exclusiveMinimum: 0 }, unitCents: { type: 'integer', minimum: 0 },
  unitDiscountCents: { type: 'integer', minimum: 0 },
}, additionalProperties: false }
const lines = { type: 'array', minItems: 1, maxItems: 100, items: line }
const object = (properties: JsonSchemaObject['properties'], required: string[] = []): JsonSchemaObject => ({ type: 'object', properties, required, additionalProperties: false })
const output = { type: 'object', required: ['id', 'version'], properties: { id, version }, additionalProperties: true }
const definitions = [
  { name: 'mallet.estimates.prepare', command: 'estimate.prepare', scope: 'estimate:prepare', kind: 'job', target: 'jobId', resource: 'estimates',
    title: 'Prepare an exact estimate', clauses: ['AGENT-001', 'ESTIMATE-001'], schema: object({ jobId: id, version, lines, notes: text, supplement: { type: 'boolean' }, reason: text }, ['jobId', 'version', 'lines']) },
  { name: 'mallet.estimates.revise', command: 'estimate.revise', scope: 'estimate:revise', kind: 'estimate', target: 'estimateId', resource: 'estimates',
    title: 'Revise a draft estimate', clauses: ['AGENT-001', 'ESTIMATE-001'], schema: object({ estimateId: id, version, revision: version, lines, notes: text }, ['estimateId', 'version', 'revision', 'lines']) },
  { name: 'mallet.dispatch.prepare', command: 'dispatch.prepare', scope: 'dispatch:prepare', kind: 'job', target: 'jobId', resource: 'repairs',
    title: 'Propose a dispatch change', clauses: ['AGENT-001', 'WORKSHOP-001'], schema: object({ jobId: id, version, bayId: id, technicianId: id, startAt: id, endAt: id, reason: text }, ['jobId', 'version', 'bayId', 'technicianId', 'startAt', 'endAt', 'reason']) },
  { name: 'mallet.invoices.prepare', command: 'invoice.prepare', scope: 'invoice:prepare', kind: 'job', target: 'jobId', resource: 'invoices',
    title: 'Prepare an actual-work invoice', clauses: ['AGENT-001', 'INVOICE-001'], schema: object({ jobId: id, version }, ['jobId', 'version']) },
]

async function target(def: typeof definitions[number], args: Record<string, unknown>, ctx: ToolContext) {
  preparationActor(ctx)
  const state = await load(ctx.db)
  const row = state.records[def.kind]?.find(row => row.id === args[def.target])
  if (!row) throw new ToolRefusal('not_found')
  const family = webhookFamily(def.command)
  if (family && state.records.webhookSubscription?.some(subscription => subscription.active && subscription.families.includes(family))) {
    throw new ToolRefusal('queued_effect_not_adopted', 'This preparation would queue a native webhook. Queued webhook execution has not been adopted into the shared Mallet agent door.')
  }
  return row
}

const preparations: ToolDefinition[] = definitions.map(def => ({
  name: def.name, title: def.title, description: `${def.title} through Mallet's native preparation service. A person still decides the resulting draft.`,
  scope: def.scope, readOnly: false, inputSchema: def.schema, outputSchema: output, classes: ['standard'], clauses: def.clauses, untrusted: true,
  async classify(args, ctx) {
    await target(def, args, ctx)
    // Prices are draft proposals; preparing never moves money or shares a record.
    return [{ class: 'standard', facts: { measure: Array.isArray(args.lines) ? args.lines.length : 1 } }]
  },
  async target(args, ctx) { const row = await target(def, args, ctx); return { kind: def.kind, id: row.id } },
  async revision(args, ctx) { return (await target(def, args, ctx)).version },
  async summary(args, ctx) {
    const row = await target(def, args, ctx)
    return { target: { id: row.id, name: String(row.title ?? def.title) },
      items: Array.isArray(args.lines) ? args.lines.map((line: any) => `${line.quantity} × ${line.description}, USD ${line.unitCents} cents per unit`) : [def.title] }
  },
  async run(args, ctx) {
    await target(def, args, ctx)
    const actor = preparationActor(ctx), native = await nativeAuthority(ctx), family = webhookFamily(def.command)
    // Fence the actual native transaction too: a new subscription between
    // classification and persistence must not turn a draft into queued egress.
    const authority = family ? { sql: `(${native.sql}) AND NOT EXISTS(SELECT 1 FROM mallet_records r WHERE r.kind='webhookSubscription'
      AND COALESCE(json_extract(r.value,'$.active'),0) NOT IN (0,'')
      AND (json_type(r.value,'$.families')<>'array' OR EXISTS(SELECT 1 FROM json_each(r.value,'$.families') WHERE value=?)))`, params: [...native.params, family] } : native
    try {
      const result = await execute(ctx.db, actor, def.command, args, authority)
      const uri = `mallet://${def.resource}/${def.command === 'dispatch.prepare' ? result.jobId : result.id}`
      ctx.emit(def.command, uri, { id: result.id, version: result.version })
      return { result, resources: [{ uri, name: def.title }] }
    } catch (error) {
      if (error instanceof MalletError) throw new ToolRefusal(error.code.toLowerCase(), error.message)
      throw error
    }
  },
}))

export const nativeTools: ToolDefinition[] = [...preparations, {
  name: 'mallet.repairs.list', title: 'List visible repairs', description: 'Current native preparation records, with the sponsor’s assigned-repair restrictions.',
  scope: 'workshop:read', readOnly: true, inputSchema: object({ readyFor: { enum: ['estimate', 'invoice'] } }), outputSchema: { type: 'object', required: ['version', 'records'] },
  classes: ['standard'], clauses: ['AGENT-001', 'WORKSHOP-001'], classify: () => [{ class: 'standard', facts: { measure: 1 } }],
  async run(args, ctx) {
    const state = await readableState(ctx)
    if (args.readyFor) state.records.job = (state.records.job ?? []).filter(row => args.readyFor === 'estimate' ? row.status === 'booked' && !row.estimateId : row.status === 'completed' && !row.invoiceId)
    return { result: state }
  }, untrusted: true,
}, {
  name: 'mallet.repairs.read', title: 'Read a repair', description: 'Read the indexed, version-fenced native repair graph. Missing and restricted repairs look identical.',
  scope: 'workshop:read', readOnly: true, inputSchema: object({ id }, ['id']), outputSchema: { type: 'object', required: ['version', 'records'] },
  classes: ['standard'], clauses: ['AGENT-001', 'WORKSHOP-001'], classify: () => [{ class: 'standard', facts: { measure: 1 } }],
  async run(args, ctx) { return { result: await readRepair(args.id as string, ctx), resources: [{ uri: `mallet://repairs/${args.id}`, name: 'Repair' }] } }, untrusted: true,
}]
