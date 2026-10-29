import assert from 'node:assert/strict'

/** Native setup-token bootstrap and real workshop fixtures, through production requests only. */
export default async function initialize({ request, origin, token, displayName, reviewers }) {
 const bootstrap = await request(origin + '/auth/bootstrap', { method: 'POST', redirect: 'manual',
  headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ token, displayName, returnTo: '/setup' }) })
 assert.equal(bootstrap.status, 303, 'native setup-token bootstrap')
 console.log('Native setup-token bootstrap: HTTP 303')
 const cookie = bootstrap.headers.getSetCookie().map(value => value.split(';', 1)[0]).join('; ')
 const call = async (path, body) => {
  const response = await request(origin + path, { method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
   headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const result = await response.json()
  if (response.status !== 200) console.error('Native fixture refusal:', path, body?.command ?? '', response.status, result.error ?? result.code ?? 'unknown')
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(result)}`)
  return result
 }
 const setup = await request(origin + '/setup', { method: 'POST', redirect: 'manual', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ confirm: 'yes', displayName, ratePercent: '0', partsTaxable: 'on', laborTaxable: 'on' }) })
 assert.equal(setup.status, 303, 'native first-run setup')
 console.log('Native first-run setup: HTTP 303')
 await setup.body?.cancel()
 const command = (command, input) => call('/api/mallet/commands', { command, input })
 const reviewer = await reviewers.initialize('quality', { cookie })
 const technicianId = (await call('/auth/session')).operator.id
 for (let i = 0; i < 4; i++) {
  const asset = await command('asset.create', { customerName: `Cedar Workshop ${i}`, customerEmail: `cedar-${i}@example.invalid`, label: 'Shop bicycle', identifier: `AGENT-${i}` })
  let job = await command('job.book', { assetId: asset.id, version: asset.version, title: i < 2 ? 'Prepare brake estimate' : 'Completed brake repair', technicianId, bayId: `Bay ${i + 1}`,
   startAt: `2028-11-${10 + i}T09:00:00Z`, endAt: `2028-11-${10 + i}T10:00:00Z` })
  if (i < 2) continue
  let estimate = await command('estimate.prepare', { jobId: job.id, version: job.version, lines: [{ kind: 'labor', description: 'Adjust brakes', quantity: 1, unitCents: 4500 }] })
  estimate = await command('estimate.approve', { estimateId: estimate.id, version: estimate.version, revision: 1 })
  estimate = await command('estimate.markSent', { estimateId: estimate.id, version: estimate.version, revision: 1, method: 'printed' })
  estimate = await command('estimate.authorise', { estimateId: estimate.id, version: estimate.version, revision: 1, lineIds: estimate.revisions[0].lines.map(line => line.id), customerName: `Cedar Workshop ${i}`, method: 'signed', evidence: 'Customer signed the exact printed estimate; synthetic fixture' })
  job = (await call('/api/mallet/state')).records.job.find(row => row.id === job.id)
  job = await command('work.record', { jobId: job.id, version: job.version, estimateId: estimate.id, revision: 1, lineId: estimate.revisions[0].lines[0].id, quantity: 1, note: 'Physical work recorded by the named owner in this synthetic fixture' })
  let quality = await command('quality.configure', { jobId: job.id, version: job.version, qualityVersion: 0, reason: 'Native pre/post checks for the synthetic physical-work fixture', items: [
   { label: 'Pre-work condition', stage: 'pre', required: true, critical: false },
   { label: 'Post-work brake function', stage: 'post', required: true, critical: true },
  ] })
  for (const item of quality.revisions.at(-1).items) quality = await command('quality.record', { jobId: job.id, version: job.version, qualityVersion: quality.version, itemId: item.id, outcome: 'pass', note: 'Qualified named technician recorded this synthetic check' })
  quality = await command('quality.signTechnician', { jobId: job.id, version: job.version, qualityVersion: quality.version, qualification: 'Synthetic qualified repair technician', note: 'Synthetic physical-work fixture; actuals and checks inspected' })
  const samePerson = await request(origin + '/api/mallet/commands', { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ command: 'quality.signQuality', input: { jobId: job.id, version: job.version, qualityVersion: quality.version, qualification: 'Synthetic qualified reviewer', note: 'Must refuse the same technician', safetyDecision: 'safe' } }) })
  assert.equal(samePerson.status, 403)
  assert.equal((await samePerson.json()).error, 'INDEPENDENT_QUALITY')
  const independent = await request(origin + '/api/mallet/commands', { method: 'POST', headers: { Origin: origin, Cookie: reviewer.cookie, 'Content-Type': 'application/json' },
   body: JSON.stringify({ command: 'quality.signQuality', input: { jobId: job.id, version: job.version, qualityVersion: quality.version, qualification: 'Synthetic independent qualified reviewer', note: 'Independent physical-work fixture review', safetyDecision: 'safe' } }) })
  assert.equal(independent.status, 200, 'independent native quality clearance')
  await independent.body?.cancel()
  console.log('Native quality witness: same-person 403 INDEPENDENT_QUALITY; independently invited and confirmed reviewer cleared the repair through the production command.')
  await command('job.complete', { jobId: job.id, version: job.version })
 }
 console.log('Native owner lifecycle: setup-token /auth/bootstrap; first-run tax and four real workshop fixtures created through public doors.')
 return bootstrap
}
