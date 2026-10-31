import assert from 'node:assert/strict'

const decisionMeta = 'com.runeditrun/decision'
const errorMeta = 'com.runeditrun/error'

export async function auditRows({request, origin, cookie}) {
 const rows = [], cursors = new Set()
 let after = null, pages = 0
 for (;;) {
  assert.ok(pages++ < 100, 'Audit cursors terminate')
  const response = await request(origin + '/agents/api/audit' + (after ? '?after=' + encodeURIComponent(after) : ''), {headers:{Cookie:cookie}})
  assert.equal(response.status, 200, 'Owner can read retained audit pages')
  const page = await response.json()
  assert.equal(page.differs_from_policy, 0, 'Retained decisions reconcile with the policy in force')
  assert.ok(Array.isArray(page.rows))
  for (const row of page.rows) {
   assert.ok(Number.isSafeInteger(row.sequence) && row.sequence > (rows.at(-1)?.sequence ?? 0), 'Audit rows keep their global native order')
   rows.push(row)
  }
  if (page.cursor === null || page.cursor === after) {
   assert.equal(page.rows.length, 0, 'The final cursor has no hidden trailing rows')
   break
  }
  assert.ok(typeof page.cursor === 'string' && !cursors.has(page.cursor), 'Every audit cursor advances')
  assert.equal(Number(page.cursor), rows.at(-1)?.sequence, 'Unfiltered cursor identifies the last retained row')
  cursors.add(page.cursor)
  after = page.cursor
 }
 assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'Audit identities never duplicate across pages')
 return {rows, pages}
}

export function weekStart(at) {
 const start = new Date(at)
 assert.ok(Number.isFinite(start.getTime()))
 start.setUTCHours(0, 0, 0, 0)
 while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() - 1)
 return start.toISOString()
}

export function weeklyCounts(rows, at) {
 const start = Date.parse(weekStart(at)), end = Date.parse(at), counts = new Map()
 for (const row of rows) {
  const time = Date.parse(row.at)
  assert.ok(Number.isFinite(time), 'Every retained call has a timestamp')
  if (time < start || time > end) continue
  for (const {class: kind} of row.classes) {
   const key = kind + ':' + row.decision
   counts.set(key, (counts.get(key) ?? 0) + 1)
  }
 }
 return Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)))
}

export function assertKnownRows(rows, expected) {
 assert.ok(expected.length > 0, 'The audit is checked against real declared-tool calls')
 for (const wanted of expected) {
  const row = rows.find(row => row.id === wanted.id)
  assert.ok(row, 'Retained audit includes the exact call identity')
  for (const field of ['tool', 'decision', 'outcome', 'code']) assert.equal(row[field], wanted[field], 'Recorded ' + field + ' matches the observed call')
  assert.deepEqual(row.classes.map(item => item.class), ['standard'], 'Declared native calls retain their computed class')
 }
}

export function expectedCall(answer, tool, decision, outcome, code = null) {
 assert.equal(answer.status, 200, 'MCP call reaches the declared native tool')
 assert.equal(answer.decision?.disposition, decision, 'The known policy disposition is returned')
 assert.equal(answer.result?.isError ?? false, outcome === 'refused', 'The actual native outcome is observed')
 const error = answer.result?._meta?.[errorMeta]
 assert.equal(typeof error === 'string' ? error : error?.code ?? null, code, 'The native refusal code is exact')
 assert.ok(answer.decision.id)
 return {id:answer.decision.id, tool, decision, outcome, code}
}

const rounds = new Map()
export async function beforeStep(context) {
 if (!['autonomous', 'held'].includes(context.phase)) return
 const {rows} = await auditRows(context)
 rounds.set(context.origin + ':' + context.phase + ':' + context.step.id, rows.at(-1)?.sequence ?? 0)
}

const known = new Map()
export async function afterStep(context) {
 if (!['autonomous', 'held'].includes(context.phase)) return
 const {rows} = await auditRows(context)
 const after = rounds.get(context.origin + ':' + context.phase + ':' + context.step.id)
 assert.ok(Number.isSafeInteger(after), 'The native step has an independent audit checkpoint')
 const decision = context.phase === 'held' ? 'review' : 'autonomous'
 const matches = rows.filter(row => row.sequence > after && row.tool === context.step.tool && (context.args.idempotency_key === undefined || row.idempotency_key === context.args.idempotency_key))
 assert.ok(matches.length > 0, 'A real declared journey call has its retained audit row')
 const first = matches[0]
 const expected = {id:first.id, tool:context.step.tool, decision, outcome:'done', code:null}
 assertKnownRows(rows, [expected])
 const retained = known.get(context.origin) ?? []
 retained.push(expected)
 known.set(context.origin, retained)
}

export function htmlCounts(html) {
 const entries = [...html.matchAll(/data-agents-count data-class="([^"]+)" data-decision="([^"]+)">(\d+)<\/td>/g)].map(([, kind, decision, count]) => [kind + ':' + decision, Number(count)])
 assert.equal(new Set(entries.map(([key]) => key)).size, entries.length, 'The Agents page renders each pair once')
 return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)))
}

/** Composed into runtime conformance; its tool callback retains the original audit checks. */
export default async function auditCounts(context) {
 const retained = known.get(context.origin) ?? []
 try {
  assert.equal(new Set(retained.map(row => row.tool)).size, 6, 'Both native policy rounds cover the existing six-tool registry')
  assert.ok(retained.some(row => row.decision === 'autonomous') && retained.some(row => row.decision === 'review'))
  const state = async () => {
   const response = await context.request(context.origin + '/api/mallet/state', {headers:{Cookie:context.cookie}})
   assert.equal(response.status, 200)
   return (await response.json()).records
  }
  const before = await state(), repair = before.job[0]
  assert.ok(repair, 'Reads use a populated native workshop')
  const expected = [...retained]
  for (let index = 0; index < 205; index++) {
   const name = index % 2 ? 'mallet.repairs.read' : 'mallet.repairs.list'
   const answer = await context.tool(name, index % 2 ? {id:repair.id} : {})
   expected.push(expectedCall(answer, name, 'autonomous', 'done'))
   assert.ok(answer.result.structuredContent.records.job.some(row => row.id === repair.id), 'Every read sees the real repair')
  }
  const refused = await context.tool('mallet.repairs.read', {id:'synthetic-mallet-audit-missing'})
  expected.push(expectedCall(refused, 'mallet.repairs.read', 'autonomous', 'refused', 'not_found'))
  assert.deepEqual(await state(), before, 'Paged audit qualification reads and refused reads preserve every business record')
  const {rows, pages} = await auditRows(context)
  assert.ok(rows.length > 200 && pages >= 3, 'Known real activity crosses an audit page boundary and reaches its terminal cursor')
  assertKnownRows(rows, expected)
  const response = await context.request(context.origin + '/agents', {headers:{Cookie:context.cookie}})
  assert.equal(response.status, 200)
  const html = await response.text()
  // Use the displayed UTC period so a live conformance run has no midnight race.
  // The browser fixture independently pins and checks the actual calendar week.
  const since = html.match(/id="week-title"[\s\S]*?<time datetime="([^"]+)"/)
  assert.ok(since, 'Agents declares the counted period')
  assert.equal(weekStart(since[1]), since[1], 'The rendered period starts at Monday midnight UTC')
  const end = new Date(Date.parse(since[1]) + 7 * 86400000 - 1).toISOString()
  assert.deepEqual(htmlCounts(html), weeklyCounts(rows, end), 'Every rendered class and decision count reconciles with all audit pages')
  console.log('PROBE BASE-AGENT-009 point-3: six declared tools, autonomous and review outcomes, exact refused read; ' + rows.length + ' ordered unique audit rows over ' + pages + ' pages; weekly Agents counts reconcile; business records unchanged.')
 } finally {
  known.delete(context.origin)
  for (const key of rounds.keys()) if (key.startsWith(context.origin + ':')) rounds.delete(key)
 }
}
