// Demo mode's sample workshop (Base DEMO.md): Corella Street Mechanical, a
// four-bay Brisbane workshop with its team, customers' vehicles and ten weeks of
// visits around `now`. It runs once after the owner exists, never fetches, and
// writes fixed ids that a repeat leaves unchanged.
import type { Bindings } from './auth.server'
import { digest } from './mallet/auth'
import { buildWorkshop } from './mallet/demo/build'
import { workshopClock } from './mallet/demo/clock'
import { assistantKey, owner, retiredKey, team } from './mallet/demo/people'

const DAY = 86400000, CHUNK = 90_000

export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }): Promise<void> {
  const db = env.DB
  const ownerRow = await db.prepare("SELECT id,version FROM oa_operators WHERE email=? AND role='owner' AND status='active'").bind(ownerEmail).first<{ id: string; version: number }>()
  if (!ownerRow) throw new Error('The demo owner does not exist yet.')
  const clock = workshopClock(now), records = buildWorkshop(now, ownerRow.id)
  const joined = clock.ms(-60, '09:00')
  // Preparation keys are shown once; nobody holds these, so they only name past work.
  const keys = await Promise.all([[assistantKey, clock.ms(-18, '09:00'), null], [retiredKey, joined, clock.ms(-20, '17:10')]].map(async ([key, created, revoked]: any) => ({ ...key, hash: await digest(crypto.randomUUID() + crypto.randomUUID()), created, expires: created + 30 * DAY, revoked })))
  const chunks: string[] = []
  let chunk: typeof records = [], size = 0
  for (const record of records) {
    if (size + record[3].length > CHUNK && chunk.length) { chunks.push(JSON.stringify(chunk)); chunk = []; size = 0 }
    chunk.push(record); size += record[3].length
  }
  if (chunk.length) chunks.push(JSON.stringify(chunk))
  await db.batch([
    db.prepare('UPDATE oa_operators SET display_name=? WHERE id=?').bind(owner, ownerRow.id),
    // The owner's finished first run: the demo opens on the workshop, not on setup.
    db.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT(singleton) DO NOTHING').bind(ownerRow.id, joined),
    db.prepare(`INSERT INTO oa_operators(id,email,display_name,role,status,created_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.email'),json_extract(value,'$.name'),json_extract(value,'$.role'),json_extract(value,'$.status'),? FROM json_each(?) WHERE true ON CONFLICT DO NOTHING`).bind(joined, JSON.stringify(team)),
    db.prepare(`INSERT INTO mallet_agent_keys(id,token_hash,label,created_by,creator_version,expires_at,revoked_at,created_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.hash'),json_extract(value,'$.label'),?,?,json_extract(value,'$.expires'),json_extract(value,'$.revoked'),json_extract(value,'$.created') FROM json_each(?) WHERE true ON CONFLICT(id) DO NOTHING`).bind(ownerRow.id, ownerRow.version, JSON.stringify(keys)),
    ...chunks.map(json => db.prepare(`INSERT INTO mallet_records(kind,id,revision,value) SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]') FROM json_each(?) WHERE true ON CONFLICT(kind,id) DO NOTHING`).bind(json)),
  ])
}
