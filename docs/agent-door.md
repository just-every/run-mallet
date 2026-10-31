Mallet's shared agent door is `/mcp`, using MCP 2026-07-28 or 2025-11-25.
`/agents` shows company policy, Pause, activity, approvals and reviews.
The declared capabilities are tools, policy, pause, audit and idempotency.
Events, public resources, prompts and subscriptions are undeclared and return
`capability_not_declared`; they are not advertised as supported work.
Native authority, current sponsor admission, consent and exact repair versions
apply to every supported call, including retries.

Every supported tool has the server-computed class `standard`.

| Tool and scope | Native action and clauses |
| --- | --- |
| `mallet.estimates.prepare` · `estimate:prepare` | `estimate.prepare` — AGENT-001, ESTIMATE-001 |
| `mallet.estimates.revise` · `estimate:revise` | `estimate.revise` — AGENT-001, ESTIMATE-001 |
| `mallet.dispatch.prepare` · `dispatch:prepare` | `dispatch.prepare` — AGENT-001, WORKSHOP-001 |
| `mallet.invoices.prepare` · `invoice:prepare` | `invoice.prepare` — AGENT-001, INVOICE-001 |
| `mallet.repairs.list` · `workshop:read` | Current native preparation view — AGENT-001, WORKSHOP-001 |
| `mallet.repairs.read` · `workshop:read` | Indexed native repair graph — AGENT-001, WORKSHOP-001 |

Draft prices create no payment, published price or commitment. Server-computed
class facts count proposed lines or the one dispatch/invoice. Mutations retain
native versions, resolved native targets and server summaries. Caller classes,
approval claims and imported instructions never grant authority. No provider
cost or spend authority is registered. A signed-in owner or admin can use the
review feed to undo a pending dispatch preparation. This withdraws only that
proposal, retains the original plan and preparer, and records the person and
reason. It cannot reverse an applied dispatch or stale proposal, alter the
booking, or create queued webhook activity. Repeating Undo or replaying the
original preparation cannot restore a withdrawn proposal.

Internal resource visibility adapters cover assets, repairs, jobs, estimates
and invoices; the public resource capability is undeclared. Preparation reads
exclude credentials, private diagnostic notes and original media. Imported and
customer text is untrusted data. Members retain assigned-repair restrictions.
Service-specific staff grants and enterprise-provider identities are refused
until their additional native admission is supported.

Signed Business settings bind `owner_id` to the original native setup owner
and teammate IDs to managed native operator IDs. Owner maps to owner, Business
admin to native admin and policy editor, and member to native member with no
policy role. Local promotion grants no Business edit role. Email never chooses
or moves the binding. Unknown, inactive and inadmissible sponsors are refused;
existing approvals and attribution retain native IDs after email changes.

Original preparation keys retain only their four mutation scopes and workshop
reads. Their REST preparation and state URLs enter the same policy pipeline.
The owner must answer standalone policy or adopt signed company policy first.
SDK and separately scoped assistant credentials keep their existing purposes.
A failed recognizable Business token cannot fall through to a local key.

MCP mutations require `idempotency_key`; matching replay retains one result,
changed arguments conflict, and `expected_revision` can fence a native revision.
Preparation attribution is `<agent> for <person>`, retaining both identities
and named policy approvers. Approval of a preparation never asserts customer
consent, physical work, native estimate approval or settled payment.

## Retained audit and export

Original preparation keys identify their actual credential client and the
service-advisor specialist in each audit row. The row retains its sponsoring
person, native target, scopes, policy revision and rules, class facts, decision,
outcome, trace and idempotency key. A local preparation key is not a Business
consent grant.

Owners and policy editors read `GET /agents/api/audit`. Optional `agent` and
`class` parameters filter each page; continue with `after` until the cursor
stops advancing, including when a filtered page is empty. Download all matching
rows with `GET /agents/api/audit/export`, using the same filters. The NDJSON
download includes every audit field in sequence order, ends at the export's
initial high-water mark, and checks the current native session on each page.
Members and bearer credentials cannot read these administrative audit doors.

Mark reviewed, Flag and Undo retain the actual signed-in person. Approving a
pending preparation records that person separately from the agent preparer and
preserves the historical pending row. Audit attribution survives fresh-owner
recovery; review handles, executable approvals and credentials do not. Revoking
an agent keeps its original name, rows and outcomes.

## Scope and verification

Runtime source is recorded at Base
`2135c394939f4a737adabdc8003b0e667b31ac5a`; the CLI is released rer 0.2.91.
The normal `rer verify` journey uses setup-token `/auth/bootstrap`, as declared
by `rer-setup.json`, then the real first-run form and workshop commands. Its
independent reviewer accepts a native invitation through `/auth/confirm` using
the verifier's declared, recipient-scoped mail capture. Same-person quality
clearance, invalid confirmation and reused proof remain refused. No fixture SQL,
substituted auth adapter or production verification route is used.

The preparation tools reach no outbound provider. No network module is declared.
When an active webhook would turn a preparation into queued egress, the call
refuses `queued_effect_not_adopted`, with the same fence in the native write
transaction. Base now provides authenticated continuation hooks; integrating
Mallet's queued work remains a seed adoption gap, not a missing Base API.

The import, installation, device, screen and licensed connector doors retain
their native purposes. Payments, ordering, communications, access changes,
erasure, physical safety clearance and the wider planned advisor jobs are
outside this adopted registry. Native API clients and the separately scoped
assistant do not acquire company-agent authority through this adoption.
Multi-sponsor, public record refresh, timed and queued execution, second-host
operation and full owner administration remain unproved. The broader ct
SURFACE-001–005 target and its complete repair-week journey remain open.
