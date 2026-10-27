# Storage, abandoned property and repair liens

The current owner opens **Storage rule settings** from **Data & access** and
records a new reviewed rule version for California or Texas, separately for a
vehicle or device. Each version retains its effective interval, source URL and
rule text for storage, notices, lien amounts and disposition, plus the legal
reviewer and evidence reference. Later versions do not change an existing case.
No statutory rule values are bundled or certified. Obtain review for the actual
property, transaction, state, notice recipients and legal procedure before use.

Open **Storage & repair lien** on a completed repair with an approved invoice.
Record the evidenced uncollected trigger, agreed daily rate, owner and every
required lienholder or other recipient, title-search evidence and case review.
The current calculator uses complete elapsed 24-hour periods after the reviewed
hour delay, capped by the reviewed maximum storage amount. The tracked lien is
unpaid storage plus the current unpaid repair balance when the rule permits it.
These are tracking calculations, not legal advice, a new invoice or a posting.
Statutory calendar-day rules, conditional procedures and legal sufficiency are
not established by this calculator. Do not use an inapplicable rule version.

Record each notice's exact content or immutable copy reference, required method,
recipient, sent time, delivery-evidence time and delivery reference. Times require
an explicit UTC offset. Notice clocks remain on the repair. Duplicate recipient
evidence cannot restart a clock. Late notices remain visible and block disposal
in this workflow. There is no automatic notice or provider-delivery claim.

Record a storage statement through a chosen past instant to preserve its exact
amount. Record storage tender separately with a unique reference and staff
evidence; Mallet does not verify funds. The existing documented handover still
requires quality, custody, collector and settlement evidence. An active storage
case also requires fresh owner confirmation. Release freezes accrual and the
receipt retains any exact remaining lien explicitly waived with a reason.
Recording storage tender does not settle the repair invoice.

Disposition recording refuses missing notices, late notices and unelapsed
waiting periods. At the end of those periods, the owner must record the legal
review, completed statutory steps, absence of an unresolved objection or stay,
physical disposition evidence and explicit confirmation. Mallet does not perform
a sale, determine legal sufficiency or destroy any repair history. Closed cases
cannot reopen or accept tender. Unmodeled legal procedures require outside review;
this screen does not authorize them.

Private command doors are `storage.rule`, `storage.open`, `storage.notice`,
`storage.accrue`, `storage.payment`, `storage.review` and `storage.dispose` through
`/api/mallet/commands`. Writes require a current native owner session, same-origin
submission and fresh confirmation; case writes bind `jobId`, `caseId` and the
exact case `version`. Monetary command values use whole USD cents. Native forms
accept USD amounts. The command door accepts every required recipient in its
`recipients` array (up to 50); the native opening form has three lienholder rows.

Rules, case snapshots, source references, notices, statements, tender, reviews,
disposition and lien waivers inherit OPS-001 archives and the existing DATA-001
and GOV-006 custody and erasure fences. Legal and financial decision history is
retained; no new retention schedule or automatic deletion is introduced.
Historical actors grant no destination authority. A restored open case refuses
new action until the destination owner creates a current reviewed version of the
same rules and explicitly reaffirms physical custody and legal review. Changed
requirements cannot be silently substituted into the old case.

RETURN-002 remains PARTIAL. The owner-only recording and reviewed-source defaults
await ct approval. The synthetic California and Texas journeys prove mechanics,
not the actual statutes or legal sufficiency. State-rule coverage, conditional
statutory procedures and legally reviewed jurisdiction fixtures remain required.
