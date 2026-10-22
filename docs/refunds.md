# Refunds, credit notes and exchanges

The current owner uses the authenticated `POST /api/mallet/commands` door.
Every request has `{ "command": "…", "input": { … } }`, the native session
cookie and the installation's Origin. Agents, members and admins cannot approve
these money actions. Delegated finance roles and refund step-up remain GOV-001
and GOV-004 work. ct approved this interim owner-only authority and consent policy on 22 October 2026.

Read current invoices, payments, credit notes and refund histories from
`GET /api/mallet/state`. Invoice numbers, original lines, approved tax snapshots
and saved CSV exports never change. New credit notes have `MC-` numbers.

## Review and issue

Call `credit.preview` with:

- `invoiceId`, its current `version`, and a unique `reference`;
- `lines`: each original `lineId`, `sourceEstimateId`, `sourceRevision` and
  returned `quantity` (at most three decimal places);
- `destination`: `original-tender` with the original `paymentId`, or
  `account-credit` for the invoice's recorded customer account;
- the `reason` and explicit customer `consentEvidence` for that disposition.

Preview creates no business record. Review its source identities, quantities,
USD amounts, tax reversal, original tender or account, and current state version.
Pass that exact response as `review` to `credit.issue`, with the same input and
`confirm: "issue-credit"`. A change to the source, balance or state requires a new
preview. An exact replay of an issued reference returns the saved credit note;
changed instructions under that reference are refused.

Each credit is bounded by the remaining original line quantities and recorded
uncredited tender. An original-tender refund additionally reserves only that
payment's remaining refundable amount. Failed and uncertain refunds keep their
reservation: neither a retry nor another credit can silently spend it. A failed
Stripe refund can move that reservation once through the explicit redirect below.
Account credit cannot be manufactured from an unpaid invoice. Returning a
customer-credit payment creates account credit, never a cash conversion.

Tax reversal uses the original invoice's saved pretax and tax cents. Cumulative
returned quantities are rounded half up to cents, with the previous cumulative
amount subtracted. Splitting a full return therefore reverses the exact original
cents even after the shop changes its tax setting. Issuing a credit note does not
move inventory, alter historical actual work or send money.

## Original-tender outcomes

A note for `original-tender` creates one `refund` row. For cash, check and other
manual tender, `refund.record` requires `refundId`, current `version`, an observed
`status` (`failed`, `disputed` or `refunded`), unique observation `reference`,
`evidence`, and `confirm: "record-refund"`. It records the owner's evidence of the
original-tender outcome; Mallet neither performs nor verifies that transfer.
Completed refunds cannot be paid again. A repeated observation reference cannot
record different facts or create another financial effect.

For a verified Stripe tender, the owner explicitly invokes `refund.submit` with
`refundId`, current `version`, and `confirm: "send-refund"`. The server first
claims the submission durably, then submits one refund to the original payment
intent with a stable idempotency key. No request redirects, background sends or
automatic retries are allowed. Caller-provided success flags cannot record a
Stripe outcome. The response may be pending, uncertain, failed or refunded;
processor success does not assert that the recipient's bank received the funds.

Use `refund.reconcile` with `refundId` and current `version` after an uncertain
outcome. It only reads Stripe, using the saved refund ID or matching the original
payment intent and Mallet refund metadata. Currency, amount and identity must
match. Repeated outcomes cannot duplicate a refund or downgrade a completed one.
If no matching receipt can be found, the refund remains uncertain and reserved;
there is no automatic resubmission or unreserve door. Resolve external provider
exceptions with the merchant before changing the product's policy. A restored
pending submission also needs this read-only reconciliation under fresh owner
credentials; restoring an archive never submits a refund.

## Redirect a failed Stripe refund once

`refund.redirect` requires `refundId`, current `version`, a unique `reference`,
new staff-recorded `consentEvidence`, and `confirm: "redirect-refund"`.
Choose `destination: "account-credit"` with the invoice's same current `accountId`,
or `destination: "manual-tender"` with `method: "cash"`, `"check"` or `"other"`.
Only a processor-confirmed failed or canceled Stripe refund qualifies. Pending,
uncertain, completed, manual or already redirected refunds are refused. Exact
reference/input replay returns the saved record; changed instructions are refused.

The linked outcome moves exactly the failed reservation, never creates another
credit note or changes the invoice. Account credit becomes available on the
original `creditNoteId` and can be applied to another RO of that same account.
Manual tender starts unsubmitted; record its actual outcome with `refund.record`
and new evidence/reference, as above. It never claims Mallet sent money. The
original Stripe outcome/history remains retained; further submit/reconcile calls
are refused. Redirects, observations and allocations survive archive/restore.

## Apply account credit or exchange an accessory

`credit.apply` requires an issued account-credit `creditNoteId`, destination
`invoiceId` and `version`, integer `amountCents`, unique allocation `reference`,
`reason`, and `confirm: "apply-credit"`. The destination must be an approved
invoice in the same current customer account. Neither unspent credit nor the
invoice's remaining balance may be exceeded. Account merges are followed;
names, emails and arbitrary customer IDs never authorize a transfer.

For an accessory exchange, first create and separately authorize the replacement
repair and invoice through the normal workflow. Call `credit.exchange` with the
same fields. It requires a returned part and a replacement part invoice and
records the exchange allocation. Additional money is recorded separately;
credit never authorizes extra work or acts as processor settlement.

Account-credit backing is removed from the original invoice's paid balance when
issued and applied only once to the destination. Cash refunded is also removed
from paid tender. Current payer sessions see the credit-note totals and tax,
refund amount, method and status, and adjusted invoice balances. They do not see
staff reasons, customer instruction evidence or raw processor receipts.
Owner-only record histories and all balances survive archive/restore under
OPS-001; historical actors do not grant destination authority.

Refund authoring is currently a command/API workflow; the customer billing page
shows its results. Signed refund webhooks, native authoring forms, delegated
cashier limits and privileged-action step-up are not implemented. Sales reports
retain their disclosed original-invoice basis, not net-refund or filing totals;
TAX-002 and the financial reporting clauses own those reports. Provider proof
uses controlled network edges; no live money movement or merchant eligibility
is claimed.
