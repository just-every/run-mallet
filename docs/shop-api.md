# Shop API version 1

This is a partial API for existing shop records. It does not provide complete
resource or write parity. Inspection, work and finance resources, decision
capabilities and the complete client intake-to-receipt journey remain unbuilt.
The existing AGENT-001 key still has precisely its four preparation commands.

## Create narrowly scoped authority

A current owner uses the existing same-origin command endpoint
`POST /api/mallet/commands` with a native session and fresh privileged-action
confirmation. Send `apiClient.create` with this input:

```json
{
  "label": "Inventory reader",
  "scopes": ["parts:read", "orders:read"],
  "expiresInHours": 24
}
```

The response returns the token once, its client ID, scopes and absolute expiry.
Keep the token in the client's private credential store. Send it in the
`Authorization: Bearer <client token>` header, over HTTPS on the installation's
configured origin. Cross-site requests and mismatched hosts are refused.
There are no default scopes. Unknown scopes, wildcard scopes and empty grants
are refused. Expiry defaults to 24 hours and may be explicitly set to an integer
from 1 through 720 hours. The owner can invalidate it immediately with
`apiClient.revoke` and `{"id":"<client ID>"}` through the same confirmed native
door. Deactivating the issuing owner or changing that owner's authority version
also invalidates the client. Each read, write and retry rechecks current authority.

Conservative interim policy: only a fresh-confirmed current owner may issue or
revoke these installation-local clients. Administrators, delegated operators,
legacy preparation keys and clients cannot manage them. No financial-read or
decision capability exists in this slice. This adopted API authority policy
awaits ct approval; API-001 remains PARTIAL.

## Read resources

Use `GET /api/mallet/v1/<resource>` for a collection and
`GET /api/mallet/v1/<resource>/<id>` for one record.

| Resource | Required scope | Returned slice |
| --- | --- | --- |
| `customers` | `customers:read` | Native account identity, name, kind, contact references and merge target |
| `assets` | `assets:read` | Identity, label, identifier, customer references and contact details, visit references |
| `bookings` | `bookings:read` | Native online appointment identity, customer, service reference, schedule and status |
| `repairs` | `repairs:read` | Native repair identity, asset reference, title, assignment, schedule and status |
| `parts` | `parts:read` | Native stock item identity, SKU, name, barcode and unit |
| `orders` | `orders:read` | Native purchase order identity, supplier, reference, schedule, status and line quantities |

Every record has `id`, `externalId` and `version`. `externalId` is the existing
durable product record ID, unchanged by updates or fresh-owner restoration.
Account merges retain the old identity and name the surviving account. Product
references use these same IDs. Current native sessions of the owner may read
these projections; other session roles and legacy agent keys have no implicit
versioned API scope.

Collection responses contain `data`, `nextCursor` and `snapshotVersion`.
`limit` is an integer from 1 through 100, default 50. Pass `nextCursor` back as
`cursor` on the same collection; null means the end. Pages use a stable ascending
record-ID keyset and include retained canceled and completed records. Repair
events are paged at `GET /api/mallet/v1/repairs/<id>/history` under `repairs:read`;
these expose event identity, kind, repair and subject references and time, never
event payloads. Resource reads deliberately omit money, private notes,
inspection evidence, decision payloads, credentials and raw records. References
do not confer access to their target resources.

Cursors are opaque and bound to the collection, repair history parent and
product snapshot. Any intervening product change returns `409 api_cursor_changed`;
restart the traversal and reconcile by stable external ID. A malformed or
cross-resource cursor returns `400 invalid_api_cursor`. Unsupported query
parameters and repeated query keys are refused. Reads use bounded SQL pages;
they do not materialize the installation's full state.

## Retry preparation safely

`POST /api/mallet/v1/preparations` accepts `{"command":"...","input":{...}}`.
The only supported commands and scopes are:

| Command | Required scope |
| --- | --- |
| `estimate.prepare` | `estimate:prepare` |
| `estimate.revise` | `estimate:revise` |
| `dispatch.prepare` | `dispatch:prepare` |
| `invoice.prepare` | `invoice:prepare` |

Supply the existing AGENT-001 command inputs and their exact product revisions.
Every request requires an `Idempotency-Key` header: 1 through 128 ASCII letters,
digits, dots, underscores, colons or hyphens. The key belongs to that client
across both versioned and legacy command endpoints. The legacy
`POST /api/mallet/commands` accepts these same scoped preparations with the same
required retry key; it is not an alternate source of authority.

The first successful write and its retry receipt commit in one transaction.
Repeating the same command and JSON input returns the original response without
another preparation, revision, event or audit entry, even after a restart.
Object property order is ignored; array order and values remain significant.
Changed input or a different command with the same key returns
`409 IDEMPOTENCY_CONFLICT`. Invalid or failed commands do not consume the key.
A concurrent duplicate returns the successful original result. An unrelated
concurrent product change can still return the ordinary conflict for review.

Preparation responses expose only the resulting ID, external ID, version,
repair reference, status and estimate revision where applicable. They do not
return prices, invoice amounts or decision content. A person must use the
existing native workflow to inspect and decide. Preparing an estimate, dispatch
or invoice never approves, shares, sends, authorizes, exports or pays anything.
All other commands are refused. Missing scopes return `403 api_scope_required`;
missing, expired, revoked or invalidated credentials return 401.

Client credentials cannot use legacy state, single-repair graphs, account
search, boards, reports, media, exports, archives, downloads or native forms.
Those routes refuse the client rather than returning a broader projection.
The existing native session and AGENT-001 contracts remain in place for their
own callers.

## Portability and retained history

The API adds no new product identity mapping: existing product records and
their audit history inherit OPS-001 custody, erasure fences and restoration.
Client tokens, hashes, grants and retry receipts are installation-local and
excluded from archives. A restored installation has its own native owner and
must issue fresh clients; archived actor IDs remain attribution only. Product
data and external IDs survive restoration, but archived credentials cannot read
or replay a write. Retry receipts remain until local reset; this slice adds no
automatic retention or deletion schedule.

Native integration settings and recovery screens, delegated operator rights,
complete sentence-level DONE evidence and ct approval remain held under
API-002. This document makes no provider-delivery or full API parity claim.

