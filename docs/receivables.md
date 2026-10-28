# Commercial receivables and filing preview

The owner opens **Commercial receivables** from a managed customer account. Business and fleet accounts can retain reviewed net terms and a USD credit limit. Each save retains a new approval rather than overwriting history. Account consent and review evidence are required. Assignment checks the latest active approval, the unchanged account, the current owner and the account’s entire approved outstanding balance. Net days run from the UTC assignment date. A fleet assignment additionally requires its PO and the current allowed authorizer matching the invoice’s frozen billing snapshot.

The statement uses existing invoice payments, same-payer deposit allocations, credit notes and completed refunds. Selecting a UTC date ages the current balance; it does not reconstruct a historical balance. Ageing separates current, 1–30, 31–60, 61–90 and 91 or more overdue days, with invoices lacking terms listed separately. An open dispute, zero balance or promise due today or later pauses reminder eligibility. No reminder is sent by this implementation. Each invoice links to its repair and vehicle, with its invoice charge and the interval from booked start to recorded completion. That interval is not a verified off-road measurement.

A separate **Recorded custody evidence** section pairs a documented handover with the exact signed before-condition intake retained in its checklist comparison. It uses that intake’s observed time and the handover’s recording time, never booking or completion as substitutes. The statement exposes the intake, comparison and handover source IDs and revisions, the intake observation and recording times, the comparison and handover recording times, elapsed milliseconds in JSON and rounded hours on screen. Source links open the exact intake and comparison cards and the handover receipt. The frozen invoice link retains its ID, revision and full invoice charge, separately from the current outstanding balance.

Without a documented handover, one usable signed before-condition intake is an open interval with no end or elapsed value. Missing sources, competing intakes without a selecting handover, inconsistent source references, conflicting chronology or multiple handovers remain unknown. A documented handover selects its retained intake rather than a newer unpaired receipt. Sources must belong to the same repair visit and vehicle; another vehicle or a later visit cannot supply an endpoint. Observation, signature and recording are staff-retained evidence, not independent identity verification or verified off-road downtime. Reading or drilling through evidence changes no approval, balance or sending authority. Existing OPS-001 custody recovery retains the same projection under a fresh destination owner; historical actors grant no destination finance authority.

Terms, disputes, promises and statement reads are private owner operations. Changes use the existing fresh-confirmation gate and require recorded account instructions. Archives retain exact financial evidence and historical actors. A restored source-owner approval cannot authorize a new destination assignment: the destination owner must save a fresh reviewed approval. The open-terms handover gate and consented reminder delivery remain unfinished, so recording terms alone does not authorize release.

The owner opens **Review filing-period tax preview** from certificate custody. The selected range includes both UTC endpoint dates. Cash receipts and captured Stripe receipts contribute proportional original-invoice tax, with cumulative half-up cents so split receipts do not lose or invent a cent. A deposit retains its original receipt date and recognizes invoice tax only when allocated to that invoice. A check or other manual tender requires an immutable record of owner-observed bank clearance; attribution uses the later allocation or observed-clearance date. Recording this evidence never contacts the bank, moves money or claims independent verification. Evidence is recorded against the original deposit when that deposit supplies multiple allocations.

Completed original-tender refunds reverse recorded credit-note tax within recognized collection bounds. Uncleared tender, unfinished refunds, customer-credit transfers and redirected refunds remain named exclusions. A transfer never invents a new cash receipt. The preview explicitly remains incomplete while those attribution questions are unresolved and is not a filed return, legal advice or a decision about legal deposit-tax treatment. Returned-check reversals, named manual tenders, deposit batching, drawer reconciliation and connected books posting remain unfinished under PAY-007 and its dependent clauses.

Private JSON doors use the same native session and owner gate:

- `GET /api/mallet/receivables?accountId=<id>&asOf=2026-10-25`
- `GET /api/mallet/tax/filing?from=2026-10-01&to=2026-10-31`
- Existing `POST /api/mallet/commands` accepts `ar.terms`, `ar.invoice`, `ar.dispute`, `ar.promise` and `tender.clearance`, with the same validation as the native forms.

No customer identity is inferred from matching names or addresses. Actor snapshots in a backup never grant current authority. Future GOV-001 delegated finance roles and GOV-004 finer-role confirmation inherit these gates.


## Review a failed scheduled balance email

In Commercial receivables, choose **Review failed balance emails**. With an
account selected, the list shows that account; without one it shows all retained
failed or uncertain scheduled balance emails. Each row preserves the original
provider outcome and exposes the exact schedule version, frozen invoice version
and revision, terms assignment and owner-approval references. Delivery remains
unverified even after a human review is recorded.

Only the current owner can read this review or append its resolution. Record
what happened and an evidence reference, explicitly confirm the displayed
limits, and repeat the action after fresh identity confirmation when requested.
A resolution is one append-only receipt per schedule, attributed to its reviewer
and recording time. Stale references, concurrent closure and replay cannot
replace it. Recording a review changes no balance, schedule, retry eligibility
or sending authority and never sends an email. It does not establish payment or
verified delivery.

`GET /api/mallet/receivables/recovery` supplies the private review list; optional
`accountId` limits it to one retained account. The existing command door accepts
`ar.resolveBalanceReminder` with the exact schedule ID and version, invoice ID
and retained version, assignment ID, approval ID, evidence and explicit
confirmation. The native form supplies those references from the selected row.
Archives retain the exact receipt and outcome history without local send
authority. A fresh destination owner may review unresolved history; archived
approvals and receipts cannot authorize another handoff. Unattended repeated chasing and delegated advisor finance access remain unfinished; see the current AR-002 Gap.


## Plan reviews and approve each email separately

Open **Balance review settings** to save an attributable policy revision with
increasing elapsed-day offsets. Replacing a policy preserves every earlier
revision and the exact policy retained by existing plans. In an invoice's
**Internal balance review sequence**, select a start instant and confirm an
internal review plan. It creates review tasks only: no customer permission,
email approval, standing sending authority or automatic retry. Stop internal
reviews from the same invoice; earlier policy, steps and approvals remain in
history. The current owner must create a fresh plan after recovery.

For a due review step, separately review the current balance and exact message.
Record the customer's agreement to the displayed one-email wording, its time,
capture channel and source reference, then explicitly approve scheduling. The
record identifies the purpose, invoice, account, billing recipient and contact
revision, wording version, customer time, capture actor and time. The owner's
exact approval is retained separately with its message, invoice version, terms,
recipient hours and expiry. These are owner-recorded customer instructions;
Mallet does not independently authenticate a telephone call or entered transcript.

One permission reference approves one schedule for that invoice. A future,
stopped, stale, cross-invoice or already-used review step cannot authorize
another email. Each approved step appends immutable sequence history. A plan
or a previous receipt never supplies permission for the next email.

Failed or uncertain handoffs automatically retain an owner review task with the
original outcome, provider reference and exact invoice and terms sources. The
receivables entry shows the outstanding review count; its on-demand list lets
the current owner append one human resolution. Closing the task preserves the
original outcome and all uncertainty. A further email still needs fresh customer
permission and a separate exact owner approval. It cannot be approved while an
earlier failed or uncertain handoff for that invoice remains unresolved.

Customer erasure immediately stops internal review plans, suppresses pending
balance email and removes its local sending capability even when retained
financial history is held. Archives recover policy, plan, permission, step, task
and resolution evidence; they do not recover outbound authority. Supplying a
later erasure journal refuses replay of an older archive. Full unattended repeated
chasing remains outside RL-101's approved one-email rule, and delegated advisor
finance rights remain GOV-001 work.
