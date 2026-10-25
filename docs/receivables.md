# Commercial receivables and filing preview

The owner opens **Commercial receivables** from a managed customer account. Business and fleet accounts can retain reviewed net terms and a USD credit limit. Each save retains a new approval rather than overwriting history. Account consent and review evidence are required. Assignment checks the latest active approval, the unchanged account, the current owner and the account’s entire approved outstanding balance. Net days run from the UTC assignment date. A fleet assignment additionally requires its PO and the current allowed authorizer matching the invoice’s frozen billing snapshot.

The statement uses existing invoice payments, same-payer deposit allocations, credit notes and completed refunds. Selecting a UTC date ages the current balance; it does not reconstruct a historical balance. Ageing separates current, 1–30, 31–60, 61–90 and 91 or more overdue days, with invoices lacking terms listed separately. An open dispute, zero balance or promise due today or later pauses reminder eligibility. No reminder is sent by this implementation. Each invoice links to its repair and vehicle, with its invoice charge and the interval from booked start to recorded completion. That interval is not a verified off-road measurement.

Terms, disputes, promises and statement reads are private owner operations. Changes use the existing fresh-confirmation gate and require recorded account instructions. Archives retain exact financial evidence and historical actors. A restored source-owner approval cannot authorize a new destination assignment: the destination owner must save a fresh reviewed approval. The open-terms handover gate and consented reminder delivery remain unfinished, so recording terms alone does not authorize release.

The owner opens **Review filing-period tax preview** from certificate custody. The selected range includes both UTC endpoint dates. Cash receipts and captured Stripe receipts contribute proportional original-invoice tax, with cumulative half-up cents so split receipts do not lose or invent a cent. A deposit retains its original receipt date and recognizes invoice tax only when allocated to that invoice. A check or other manual tender requires an immutable record of owner-observed bank clearance; attribution uses the later allocation or observed-clearance date. Recording this evidence never contacts the bank, moves money or claims independent verification. Evidence is recorded against the original deposit when that deposit supplies multiple allocations.

Completed original-tender refunds reverse recorded credit-note tax within recognized collection bounds. Uncleared tender, unfinished refunds, customer-credit transfers and redirected refunds remain named exclusions. A transfer never invents a new cash receipt. The preview explicitly remains incomplete while those attribution questions are unresolved and is not a filed return, legal advice or a decision about legal deposit-tax treatment. Returned-check reversals, named manual tenders, deposit batching, drawer reconciliation and connected books posting remain unfinished under PAY-007 and its dependent clauses.

Private JSON doors use the same native session and owner gate:

- `GET /api/mallet/receivables?accountId=<id>&asOf=2026-10-25`
- `GET /api/mallet/tax/filing?from=2026-10-01&to=2026-10-31`
- Existing `POST /api/mallet/commands` accepts `ar.terms`, `ar.invoice`, `ar.dispute`, `ar.promise` and `tender.clearance`, with the same validation as the native forms.

No customer identity is inferred from matching names or addresses. Actor snapshots in a backup never grant current authority. Future GOV-001 delegated finance roles and GOV-004 finer-role confirmation inherit these gates.
