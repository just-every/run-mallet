import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { auditRows } from './audit-rows.mjs';
import { accessToken, autonomousPolicy } from './crypto.mjs';
import { createProtocol, errorCode, APPROVAL } from './protocol.mjs';

/** Ordinary members retain their native assignment boundary under signed grants. */
export async function nativeMemberPhase(c, sponsors, initializeAgent, observe) {
 for (const person of sponsors.slice(1)) {
  const prefix = `BASE-AGENT-004.cross-sponsor.${person.label}`;
  const b = createProtocol({ fetch: c.fetch, origin: c.origin, surface: c.surface, signer: c.signer, person,
   business: c.business, consent: randomUUID(), now: c.now, points: c.points, agentId: `rer-conformance-${randomUUID()}`, seq: c.seq, revision: c.revision, listed: c.listed });
  if (initializeAgent) await initializeAgent({ agentId: b.agentId, person });
  await c.adopt(autonomousPolicy());
  await c.prepare(`cross-sponsor:${person.label}`);
  const fixture = c.fixtureValues.crossSponsor;
  if (!fixture?.owner?.job?.id || !fixture?.member?.job?.id) throw new Error('Native member admission requires two owner-created assigned repairs.');
  const check = (name, ok, detail) => c.add(`${prefix}.${name}`, ok, detail ?? name);
  const read = (principal, repair, options) => principal.tool('mallet.repairs.read', { id: repair.job.id }, options);
  const snapshot = async () => (await c.personJson('/api/mallet/state')).records;
  const noPrivate = answer => !JSON.stringify(answer).includes(fixture.owner.job.title) && !JSON.stringify(answer).includes(fixture.owner.asset.identifier);
  await b.mcp('tools/list');
  await c.mcp('tools/list');
  const inventory = await c.personJson('/agents/api/agents');
  const memberAgent = inventory.agents.find(agent => agent.id === b.agentId), ownerAgent = inventory.agents.find(agent => agent.id === c.agentId);
  b.sponsor.id = memberAgent?.sponsor?.id;
  check('binding', ownerAgent?.sponsor?.id === fixture.ownerId && b.sponsor.id === fixture.memberId
   && c.sponsor.id === fixture.ownerId && fixture.memberId !== fixture.ownerId && person.sub !== c.person.sub && b.agentId !== c.agentId,
   'Each signed Business subject must resolve to its exact, distinct native person.');
  const own = await read(b, fixture.member), list = await b.tool('mallet.repairs.list', {});
  check('assigned-read', own.status === 200 && !own.result?.isError && own.result?.structuredContent?.records?.job?.some(job => isDeepStrictEqual(job, fixture.member.job) && job.technicianId === fixture.memberId), 'Member read must return its exact assigned native repair.');
  check('assigned-list', list.result?.structuredContent?.records?.job?.some(job => job.id === fixture.member.job.id)
   && !list.result.structuredContent.records.job.some(job => job.id === fixture.owner.job.id) && noPrivate(list.body), 'Member list must retain its assignment and exclude owner-private records.');
  for (const repair of [fixture.owner, fixture.member]) {
   const permitted = await read(c, repair);
   check(`owner-visible.${repair.job.id}`, !permitted.result?.isError && permitted.result?.structuredContent?.records?.job?.some(job => job.id === repair.job.id), 'Owner oversight must retain both repairs.');
  }
  const beforeRead = await snapshot(), hidden = await read(b, fixture.owner), missing = await b.tool('mallet.repairs.read', { id: randomUUID() });
  check('unassigned-read', hidden.result?.isError && errorCode(hidden) === 'not_found' && hidden.result?.structuredContent === undefined && noPrivate(hidden.body), 'Unassigned repair must refuse without private content.');
  check('missing-equivalent', hidden.status === missing.status && errorCode(hidden) === errorCode(missing) && isDeepStrictEqual(hidden.result?.content, missing.result?.content) && missing.result?.structuredContent === undefined, 'Unassigned and missing native repairs must have identical refusal content.');
  check('read-unchanged', isDeepStrictEqual(beforeRead, await snapshot()), 'Denied read changed native records.');
  const change = repair => ({ jobId: repair.job.id, version: repair.job.version, lines: [{ kind: 'labor', description: 'Inspect wheel alignment', quantity: 1, unitCents: 4500 }], idempotency_key: randomUUID() });
  for (const [label, repair] of [['assigned', fixture.member], ['unassigned', fixture.owner]]) {
   const before = await snapshot(), refused = await b.tool('mallet.estimates.prepare', change(repair));
   check(`prepare-refused.${label}`, refused.result?.isError && errorCode(refused) === 'manager_required' && refused.result?.structuredContent === undefined && noPrivate(refused.body), 'An ordinary member cannot prepare an estimate even with its scope.');
   check(`prepare-unchanged.${label}`, isDeepStrictEqual(before, await snapshot()), 'Denied preparation changed native records.');
  }
  console.log('PROBE BASE-AGENT-004 assignment: member MCP list and read -> exact assigned repair; unassigned read and estimate preparation refused; owner retains both; native records unchanged');
  const held = autonomousPolicy(); held.rules = [{ id: 'all', class: '*', do: 'approval', approver: ['sponsor'], wait: 'PT1H' }];
  await c.adopt(held);
  const beforePending = await snapshot(), pending = await c.tool('mallet.estimates.prepare', change(fixture.owner)), handle = pending.result?._meta?.[APPROVAL];
  check('pending', pending.result?.resultType === 'input_required' && typeof handle?.id === 'string', 'Owner must have a real pending preparation.');
  if (!handle?.id) throw new Error('Owner pending preparation missing.');
  const path = `/agents/api/approvals/${encodeURIComponent(handle.id)}`, view = (await c.personJson(path)).approval;
  const body = JSON.stringify({ revision: view.revision, summary_sha256: view.summary_sha256 });
  for (const [label, invoke] of [
   ['person', (url, init) => b.personRequest(url, init)],
   ['agent', async (url, init = {}) => b.request(url, { ...init, headers: { Origin: c.origin, Authorization: `Bearer ${await accessToken(b)}`, 'Content-Type': 'application/json' } })],
  ]) for (const [action, init] of [['read', {}], ['approve', { method: 'POST', body }]]) {
   const before = await snapshot(), response = await invoke(action === 'read' ? path : `${path}/approve`, init), text = await response.text();
   check(`approval-${label}.${action}`, [403, 404].includes(response.status) && noPrivate(text) && !text.includes(view.summary_sha256), 'Member cannot read or approve the owner preparation.');
   check(`approval-${label}.${action}-unchanged`, isDeepStrictEqual(before, await snapshot()) && isDeepStrictEqual(view, (await c.personJson(path)).approval), 'Refused approval access changed native records or the saved pending preparation.');
  }
  check('pending-no-effect', isDeepStrictEqual(beforePending, await snapshot()) && view.state === 'pending' && view.approvals.length === 0, 'Pending preparation must have no repair effect.');
  if (observe) await observe({ c, b, fixture, approval: { ...view, url: handle.url } });
  await c.decideApproval(pending, 'reject');
  await c.adopt(autonomousPolicy());
  const ownerRead = await read(c, fixture.owner), memberRead = await read(b, fixture.member);
  for (const [label, principal, answer] of [['owner', c, ownerRead], ['member', b, memberRead]]) {
   const rows = (await auditRows(c, { agents: [principal.agentId] })).rows;
   const row = rows.find(row => row.id === answer.decision?.id);
   check(`attribution.${label}`, row?.outcome === 'done' && row.sponsor?.id === principal.sponsor.id && row.agent?.id === principal.agentId
    && row.consent === principal.consent && row.agent.specialist === c.surface.specialist && row.label === `${row.agent.name} for ${row.sponsor.name}`, 'Exact audit decision must retain distinct native sponsor, agent, specialist and consent attribution.');
  }
  console.log('PROBE BASE-AGENT-004 approval-and-attribution: member session and bearer -> private approval read and approval refused; exact native sponsor, agent and consent retained');
  const token = await accessToken(b), beforeRevocation = await snapshot();
  await c.adopt(autonomousPolicy(), { revoked: { agents: [], consents: [b.consent] } });
  for (const attempt of ['next', 'replay']) {
   const refused = await read(b, fixture.member, { token });
   check(`consent-refused.${attempt}`, refused.status === 401 && refused.result === undefined && noPrivate(refused.body), 'Revoking only the member consent must immediately refuse the same credential, including replay.');
  }
  for (const [label, repair] of [['own', fixture.owner], ['member', fixture.member]]) {
   const ownerStill = await read(c, repair);
   check(`owner-retained.${label}`, ownerStill.status === 200 && !ownerStill.result?.isError && ownerStill.result?.structuredContent?.records?.job?.some(job => job.id === repair.job.id), 'Member consent revocation must preserve the first sponsor permitted access to both repairs.');
  }
  const memberSession = await b.personJson('/auth/session');
  check('member-session-retained', memberSession.operator?.id === fixture.memberId && memberSession.operator.role === 'member', 'Consent revocation must not revoke the native person account or session.');
  check('revocation-unchanged', isDeepStrictEqual(beforeRevocation, await snapshot()), 'Consent revocation or refused replay changed native repair records.');
  console.log('PROBE BASE-AGENT-004 consent: signed policy revokes only member originating consent -> next call and replay 401; owner read 200; native member session and repair records unchanged');
 }
}
