# Background jobs

The owner opens **Data & access → Open background jobs** to inspect due counts,
oldest due time, bounded recent outcomes and human recovery history. Managing
jobs requires a current owner session; enqueue and recovery also require fresh
GOV-004 confirmation. No session, provider credential or customer-link token is
stored in a job.

Estimate reminder intents are persisted before the estimate-chase claim. One
business-event key identifies each chase step. A one-minute scheduled invocation
claims at most four jobs concurrently across the installation. Reservations have
a one-minute lease. An expired reservation that never reached dispatch returns
to pending. An expired dispatch becomes uncertain and requires human inspection.
The runner makes at most 25 batches in 45 seconds per sweep; backlog diagnostics
remain visible when more work is due.

A reminder rechecks the current estimate, open repair, link lifetime, opt-out and
reply/decision state immediately before sending. It also requires the original
private link authority, which archives exclude. Restoring business history never
creates a new customer link or sends an old reminder. Issue a new approval link
under fresh staff authority when renewed contact is appropriate. A provider
handoff is saved before its outcome is projected back to the repair. Repeating
that projection cannot resend the email. Failed or uncertain reminders cannot be
replayed; the owner records a reasoned human resolution.

The owner may approve a **read-only Stripe payment check** for an approved or
exported invoice. It makes a GET only. It cannot charge, refund or contact a
customer. The operation identifier binds exact invoice/payment identifiers and
approval evidence. The current approving owner's version is checked before the
request and again when recording verified payment evidence. Existing finance
idempotency prevents duplicate allocations. Failed or uncertain GETs can be
explicitly reapproved, retaining the prior outcome, attempt count and new consent
evidence in recovery history. Restored runnable payment checks are quarantined
as uncertain, even if an archive happens to name a destination owner. Fresh
explicit approval is required to replay them.

Public doors are `GET /api/mallet/jobs`, `POST /api/mallet/jobs/payment-check`
and `POST /api/mallet/jobs/recover`. The native forms expose the same actions.
Diagnostics retain at most 50 recent jobs and recoveries in one response, plus
aggregate status/due counts. Native archives contain jobs, outcomes and recovery
history. Lease fencing is cleared on restore. Historical actors remain inert
attribution.

The declared-capacity five-minute deadlines are not yet proven. See
[performance.md](performance.md) for the remaining OPS-002 work.
