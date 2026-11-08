# Webhook integration API

The current owner manages this API with a native session and a fresh privileged-action confirmation. Agents and other staff have no webhook authority. Native settings and recovery screens are still pending. No endpoint sends until the owner explicitly approves it; the interim authority policy is awaiting contract review.

All routes begin with `/api/mallet/webhooks`. Mutations require JSON and the installation's exact Origin header.

| Method and suffix | Input and result |
| --- | --- |
| GET root | Subscription metadata, delivery envelopes, append-only attempt history, exceptions and per-provider health, including current authority and key version. Endpoint addresses and signing keys are never read back. |
| POST `/subscribe` | `label`, public HTTPS `endpoint`, selected `families`, `consent: true` and `consentEvidence`. Returns an id, key version and a signing key shown once. Query strings, embedded credentials, literal addresses and local names are refused. |
| POST `/rotate` | Subscription `id`. Returns a fresh signing key once; all later attempts use the new version. Configure the consumer before replaying failures caused during rotation. |
| POST `/stop` | Subscription `id`, exact metadata `version` and `reason`. Disables new deliveries and removes endpoint signing authority. |
| POST `/replay` | Delivery `id`, current delivery `version` and `reason`. A terminal delivery gets a new bounded attempt cycle with its original business event identity. Pending or claimed deliveries cannot be replayed. |
| POST `/deliver` | Empty object. Runs one bounded delivery pass and returns diagnostics. The Worker cron also runs the same pass. |

Families are `booking`, `inspection`, `approval`, `parts`, `status`, `invoice` and `payment`. Subscription begins with future business events. The business write and its delivery envelope commit in one database transaction. Failed business writes create no delivery. Each event identifies the source command; consumers decide which transitions they handle. Version 1 exposes identifiers only, with no implied repair, payment or customer-contact authority.

The JSON body has this structure:

```json
{
  "event_id": "synthetic-mallet-1",
  "input": {
    "schema_version": 1,
    "type": "job.book",
    "family": "booking",
    "subject_id": "synthetic-mallet-2",
    "job_id": "synthetic-mallet-2",
    "occurred_at": "2026-10-27T09:00:00.000Z"
  }
}
```

Verify `x-mallet-signature` as lowercase hexadecimal HMAC-SHA256 over the exact body bytes, using the shown signing key as UTF-8 bytes. `x-mallet-key-version` identifies the rotation generation; `x-mallet-event-id` repeats the signed event id. Authenticate before parsing or applying. Atomically insert the event id into a durable unique receiver ledger together with the business effect. Return success for an already applied identical event. Reject a reused id with changed content. Keep the receiver ledger for as long as operator replay remains possible; delivery is at least once, never a promise of universal exactly-once transport.

Crank supports this envelope directly: publish a webhook trigger with `envelope: true`, a `signing_secret` connection holding the Mallet key, and signature settings `preset: hmac`, `header: x-mallet-signature`, `algorithm: sha256`, `encoding: hex`. A workflow can map `trigger.input.subject_id` and `trigger.input.type`. The committed acceptance runs an actual workflow from pinned public Crank source; it requires no hosted Crank account.

Every pass handles at most twenty deliveries, with a ten-second handoff timeout each. An explicit HTTP 429 or server error schedules exponential backoff, with at most three attempts in a cycle. Other HTTP refusals are terminal. Redirects are refused. A timeout or interrupted claim becomes uncertain and does not retry automatically. The owner reviews the receiver's durable ledger before a reasoned replay; a successful HTTP response means receiver acknowledgement, not a claim about downstream work. Response bodies and endpoint credentials never enter diagnostics.

Archives retain subscription labels, approved event families, business identifiers and exact delivery histories. Endpoint URLs, signing keys and send authority are excluded. Restored history cannot be replayed or sent using archived credentials. Configure a new subscription under the destination's current owner for future events. Existing customer-erasure and hold rules govern source business records; these envelopes contain no copied customer fields. Secrets in endpoint paths are private configuration, never portable evidence.
