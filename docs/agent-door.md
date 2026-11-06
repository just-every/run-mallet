Mallet's shared agent door is `/mcp`, using MCP 2026-07-28 or 2025-11-25.
`/agents` shows company policy, Pause, activity, approvals and reviews.
The declared capabilities are tools, resources, policy, pause, audit, idempotency and prompts.
Events and subscriptions are undeclared and return
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
class facts count proposed lines or the one dispatch or invoice. Mutations retain
native versions, resolved native targets and server summaries. Caller classes,
approval claims and imported instructions never grant authority. No provider
cost, spend authority or unsupported reversal is registered.

Public preparation resources use `workshop:read` and the same current native
authority as the adopted read tools. The templates are `mallet://assets/{id}`,
`mallet://repairs/{id}`, `mallet://jobs/{id}`, `mallet://estimates/{id}` and
`mallet://invoices/{id}`. Jobs return the retained job; repairs return its
version-fenced preparation graph, including exact dispatch proposal identities
and versions. A preparation link reads the retained outcome, never an applied
dispatch or a person's approval. Resource reads use the company policy, including
standard review, and carry the untrusted marker. Missing and restricted records
are indistinguishable. Every read rechecks the sponsoring person and native key. Preparation reads
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

## Service advisor preparation prompts

The public `/docs/agents` page is generated from the adopted runtime registry.
It lists the same six tools with their descriptions, scopes, computed classes
and preparation boundaries. It contains no repair or credential data.

MCP prompt listing offers one job per preparation command, named
`mallet.estimates.prepare`, `mallet.estimates.revise`,
`mallet.dispatch.prepare` and `mallet.invoices.prepare`.
Retrieve one by name to receive a preparation plan derived from the actual
registry, including both permitted read tools and each tool's scope and classes.
Retrieval takes no business input and executes no action. Caller arguments are
not inserted into the plan.

Follow the plan by discovering the input schema, reading the current repair,
and supplying only evidenced inputs with the current revision and an idempotency
key. Read back the exact persisted draft. Under autonomous policy preparation
completes; under held standard-review policy it completes with a retained review.
Neither policy decides the native draft. A separate person must decide dispatch,
customer consent, sending and any promise change. Physical evidence and provider
outcomes are never inferred. GOV-001 and SHOP-001 limits and the queued-egress
fence remain in force.

`tests/agent-door/prompts.mjs` extends the existing runtime conformance journey.
It retrieves every plan, independently compares its descriptions, scopes and
classes with the runtime tool catalogue, and checks that successful and refused
retrieval preserve business records. It follows dispatch preparation under both
policies, reads back its exact pending plan and native attribution, checks the
unchanged repair and reads attributable activity and held review through the
person doors. The emitted documentation and activity pages are shown at 1440
and 390; browser assertions run at 1440. Revoked preparation credentials cannot
list or retrieve prompts. These checks run in the existing runtime Verify shard.

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
Customers, inspections, parts, orders and audit resource families, complete
two-role UI parity, file-byte budget qualification and resource refresh remain
unproved. Original media bytes are not served. Retained invoice CSV text
remains preparation data under the existing read authority; this adoption does
not qualify file-byte budgets.
Multi-sponsor, timed and queued execution, second-host
operation and full owner administration remain unproved. The broader ct
SURFACE-001–005 target and its complete repair-week journey remain open.

The native conformance journey in `tests/agent-door/resources.mjs` compares
preparation links with independently read native state under both autonomous
and held-standard-review policies. It checks dispatch proposals separately
from current dispatch, untrusted markers, missing records and revoked keys.
