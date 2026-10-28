# Company agents in Mallet

Mallet's shared agent door is `/mcp`. It provides discovery, tools, repair
resources and subscriptions. `/agents` shows the signed company policy,
Pause, preparation activity, approvals and reviews. A company policy chooses
whether a supported call runs, waits for approval, enters review or is refused.
Native authorization and exact repair versions still apply.

The current shared registry covers preparation, rather than completion of a
repair week:

| Tool | Scope | Class | Native action | Clauses |
| --- | --- | --- | --- | --- |
| `mallet.estimates.prepare` | `estimate:prepare` | standard | `estimate.prepare` | AGENT-001, ESTIMATE-001 |
| `mallet.estimates.revise` | `estimate:revise` | standard | `estimate.revise` | AGENT-001, ESTIMATE-001 |
| `mallet.dispatch.prepare` | `dispatch:prepare` | standard | `dispatch.prepare` | AGENT-001, WORKSHOP-001 |
| `mallet.invoices.prepare` | `invoice:prepare` | standard | `invoice.prepare` | AGENT-001, INVOICE-001 |
| `mallet.repairs.list` | `workshop:read` | standard | Current native preparation view | AGENT-001, WORKSHOP-001 |
| `mallet.repairs.read` | `workshop:read` | standard | Indexed native repair graph | AGENT-001, WORKSHOP-001 |
| `mallet.events.list` | `events:read` | standard | Shared door events | BASE-AGENT-010 |

Draft prices create no payment, published price or commitment. Class facts count
the proposed lines, or the one proposed dispatch/invoice. Mutations retain native
versions and server summaries. An agent-supplied class, approval claim or imported
instruction cannot change authority. There is no registered provider cost or spend.
No reversal is offered for a draft without an existing native reversal.

Resources are `mallet://assets/{id}`, `mallet://repairs/{id}`,
`mallet://jobs/{id}`, `mallet://estimates/{id}` and `mallet://invoices/{id}`.
They use the native preparation projection. Missing and restricted records have
the same response. Imported and customer text remains untrusted; credentials,
private diagnostic notes and original media are outside that projection.
Members retain their native assigned-repair boundary. Service-specific staff
grants and enterprise-provider identities are refused until their additional
native admission can be represented; the door cannot substitute for that proof.

Signed Business settings bind the Business owner ID to the original native setup
owner and teammate IDs to managed native operator IDs. Owner remains owner,
Business admin maps to native admin and policy editor, and member maps to native
member without a policy role. A local promotion does not make a Business editor.
Email does not choose or move the binding. Unknown and inactive sponsors fail
admission. Approval and attribution retain native IDs after address changes.

Original preparation keys can also use the shared door with only their original
four mutation scopes and preparation reads. Their existing REST preparation and
state URLs are compatibility adapters into this same policy pipeline. They now
require the owner to answer the standalone policy, or the company to adopt its
signed policy. Requests with an `Idempotency-Key` retain one result; reuse with
changed arguments conflicts. `/mcp` mutations require `idempotency_key` and can
supply `expected_revision`. SDK and separately scoped assistant credentials
retain their own native purposes; they are not converted into Business tokens.

An agent prepares as `<agent> for <person>`. Native drafts and timeline events
retain both IDs and any named policy approvers. A policy approval of preparation
is distinct from approving an estimate, authorizing customer work or exporting
an invoice. Those native decisions continue to require their existing evidence.

The import door, installation and backups, physical printer/scanner work, device
capture, and licensed source connectors retain their own doors. The current
registry does not claim payments, ordering, communications, access changes,
erasure, physical safety clearance or the broader planned service-advisor jobs.

## Queued-work adoption limit

Runtime source is copied from Base commit
`d555e789cffb744a9f83d76ebe42a2e3bdd7a055`. In that API `ToolContext` does not
carry the authenticated consent, and embedded `invoke` accepts only a person and
agent. Mallet cannot safely carry a queued action's original consent into its
native outbox and recheck that consent at delivery using this public API.
A caller-provided consent field would not establish the binding. Queued agent
execution remains unadopted until Base exposes an authenticated continuation
context and a policy-checked execution path retaining that consent.

The production build's declared journey uses the existing setup-token
`/auth/bootstrap`, completes the normal first-run form and creates fixtures
through native workshop commands. It does not write fixture SQL or call the
signed owner-claim endpoint with a raw setup token. Preparation tools reach no
outbound provider, so this declaration has no network-edge module. The existing
native providers and scoped assistant sends are outside this adopted subset.

The complete declared journey is currently blocked at independent quality
clearance for its invoice fixture. The native technician's own quality decision
is correctly refused; a real independent admin invitation remains `invited`.
The pinned initializer receives only same-origin requests, while the isolated
mail edge exposes neither captured invitation delivery to that initializer nor
an authenticated mailbox continuation. The invitation therefore cannot be
consumed through the supplied lifecycle hooks. The normal verification command
fails rather than inventing a reviewer session, inserting an identity or
weakening the two-person safety requirement.
