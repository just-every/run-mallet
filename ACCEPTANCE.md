# Mallet target acceptance

Generated from CONTRACT.md by `node scripts/contract-docs.mjs write`. The contract owns the full target, acceptance sentences, riders and remaining gaps. This index links each clause to that source and its current proof.

## Published workshop guarantees

**HTTP-001 — Private app boundary.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/http.ts`; `src/mallet/auth.ts`; `tests/mallet.test.mjs`.

**WORKSHOP-001 — Register and visits.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/workshop.ts`; `tests/mallet.test.mjs`; `tests/browser-journey.mjs`.

**ESTIMATE-001 — Exact decision.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/estimates.ts`; `tests/mallet.test.mjs`; `tests/browser-journey.mjs`.

**WORK-001 — Authorized actuals.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/workshop.ts`; `src/mallet/model.ts`; `tests/mallet.test.mjs`.

**INVOICE-001 — One saved export.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/invoices.ts`; `tests/mallet.test.mjs`; `tests/browser-journey.mjs`.

**AGENT-001 — Prepare, then person decides.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/auth.ts`; `src/mallet/model.ts`; `tests/mallet.test.mjs`.

**IMPORT-001 — Reviewed register move.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/imports/service.ts`; `src/mallet/imports/snapshots.ts`; `tests/mallet.test.mjs`.

**DATA-001 — Custody and erasure.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/archive-policy.mjs`; `src/mallet/imports/portability.ts`; `src/mallet/imports/erasure.ts`; `tests/mallet.test.mjs`; `src/mallet/restore/notice.mjs`; `src/mallet/ui/restore.ts`; `tests/restore.test.mjs`.

**PIER-001 — Read only.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#published-workshop-guarantees).

Evidence: `src/mallet/pier.ts`; `src/mallet/http.ts`; `tests/pier-journey.mjs`; `tests/support/real-pier.mjs`.

## Customers, vehicles and intake

**CUS-001 — Customer and fleet accounts.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `tests/mallet.test.mjs`; `tests/support/customers-journey.mjs`; `tests/support/portal-journey.mjs`; `tests/customers-browser.mjs`; `tests/mallet.test.mjs`; `tests/support/portal-journey.mjs`; `tests/customers-browser.mjs`; `tests/customers-browser.mjs`.

**VEH-001 — Vehicle identity and VIN decode.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: No implementation evidence yet.

**VEH-002 — Mileage and service intervals.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `src/mallet/mileage.ts`; `src/mallet/ui/mileage.ts`; `tests/mallet.test.mjs`.

**VEH-003 — CARFAX service history exchange.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: No implementation evidence yet.

**INTAKE-001 — Condition media and custody.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `tests/media.test.mjs`; `tests/intake-browser.mjs`.

**INTAKE-002 — Custom forms and signed shop terms.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `tests/media.test.mjs`; `tests/intake-forms-browser.mjs`.

**INTAKE-003 — Counter and after-hours check-in.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `tests/media.test.mjs`; `tests/support/check-in-journey.mjs`; `tests/check-in-browser.mjs`.

**BOOK-001 — Online appointment booking.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `tests/mallet.test.mjs`; `tests/mallet.test.mjs`.

**BOOK-002 — Resource calendars and waitlist.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `tests/mallet.test.mjs`; `tests/support/calendar-journey.mjs`; `tests/support/waitlist-journey.mjs`; `tests/calendar-browser.mjs`.

**DIAG-001 — Diagnostic findings and private notes.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `src/mallet/diagnostics.ts`; `src/mallet/diagnosis-links.ts`; `src/mallet/ui/diagnostics.ts`; `migrations/core/0021_customer_links.sql`; `tests/support/diagnosis-journey.mjs`; `tests/diagnosis-browser.mjs`.

**ASSET-001 — Bicycle and device repair benches.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#customers-vehicles-and-intake).

Evidence: `tests/mallet.test.mjs`; `tests/support/asset-journey.mjs`; `tests/asset-browser.mjs`.

## Digital inspections and repair quality

**DVI-001 — Configurable digital inspections.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#digital-inspections-and-repair-quality).

Evidence: `src/mallet/inspections.ts`; `src/mallet/inspection-photo.ts`; `src/mallet/inspection-visibility.ts`; `src/mallet/ui/inspections.ts`; `tests/mallet.test.mjs`; `tests/support/inspection-journey.mjs`; `tests/inspection-browser.mjs`; `src/mallet/media/history.ts`; `src/mallet/media/browser-history.ts`.

**DVI-002 — Photo and video inspection evidence.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#digital-inspections-and-repair-quality).

Evidence: `src/mallet/media/http.ts`; `src/mallet/media/service.ts`; `src/mallet/ui/media.ts`; `public/app/media.css`; `migrations/core/0019_inspection_media.sql`; `tests/media.test.mjs`; `tests/media-browser.mjs`.

**DVI-003 — Customer inspection presentation.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#digital-inspections-and-repair-quality).

Evidence: `tests/mallet.test.mjs`.

**DVI-004 — Inspection history comparison.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#digital-inspections-and-repair-quality).

Evidence: `src/mallet/media/history.ts`; `src/mallet/media/validation.ts`; `src/mallet/media/browser-history.ts`; `src/mallet/ui/media.ts`; `migrations/core/0020_inspection_resolution.sql`; `tests/media.test.mjs`; `tests/inspection-history-browser.mjs`.

**QUALITY-001 — Completion tests and return clearance.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#digital-inspections-and-repair-quality).

Evidence: `src/mallet/quality.ts`; `src/mallet/ui/quality.ts`; `src/mallet/workshop.ts`; `tests/mallet.test.mjs`; `tests/support/quality-journey.mjs`; `tests/quality-browser.mjs`; `tests/support/portable-repair.mjs`.

**DIAG-002 — Specialist diagnostics connections.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#digital-inspections-and-repair-quality).

Evidence: `tests/mallet.test.mjs`; `tests/support/diagnostic-results-journey.mjs`; `tests/diagnostic-results-browser.mjs`; `docs/diagnostic-results.md`.

**DIAG-003 — OEM service information and recall context.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#digital-inspections-and-repair-quality).

Evidence: No implementation evidence yet.

## Estimates and customer authorization

**EST-001 — Parts and labor pricing.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: `tests/mallet.test.mjs`; `tests/support/estimate-pricing-journey.mjs`; `tests/estimate-pricing-browser.mjs`.

**EST-002 — Canned jobs and pricing matrices.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: `src/mallet/pricing.ts`; `src/mallet/inspections.ts`; `src/mallet/ui/pricing.ts`; `tests/mallet.test.mjs`; `tests/support/pricing-journey.mjs`; `tests/pricing-browser.mjs`.

**EST-003 — Customer approval and decline by link.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: `src/mallet/approval-links.ts`; `src/mallet/approval-door.ts`; `src/mallet/ui/approval.ts`; `migrations/core/0022_approval_links.sql`; `tests/support/approval-journey.mjs`; `tests/approval-browser.mjs`.

**EST-004 — Supplemental approval on the same repair.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: `src/mallet/estimates.ts`; `src/mallet/supplement-scope.ts`; `src/mallet/workshop.ts`; `src/mallet/invoices.ts`; `src/mallet/ui/estimates.ts`; `tests/mallet.test.mjs`; `tests/support/supplement-journey.mjs`; `tests/supplement-browser.mjs`.

**EST-005 — Declined work register.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: `src/mallet/declined-work.ts`; `src/mallet/ui/declined-work.ts`; `tests/mallet.test.mjs`.

**GUIDE-001 — MOTOR labor times.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: No implementation evidence yet.

**GUIDE-002 — ALLDATA labor and procedures.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: No implementation evidence yet.

**GUIDE-003 — ProDemand estimating and maintenance.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: No implementation evidence yet.

**EST-006 — Estimate expiry and approval chasing.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#estimates-and-customer-authorization).

Evidence: `src/mallet/approval-chasing.ts`; `src/mallet/approval-door.ts`; `src/mallet/approval-links.ts`; `src/mallet/ui/chasing.ts`; `migrations/core/0023_approval_reminders.sql`; `tests/support/chase-journey.mjs`; `tests/approval-browser.mjs`.

## Workshop execution and technician work

**FLOW-001 — Live repair and technician boards.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `src/mallet/flow.ts`; `src/mallet/ui/board.ts`; `src/mallet/ui/flow.ts`; `tests/support/flow-journey.mjs`; `tests/flow-browser.mjs`.

**FLOW-002 — Promise times and capacity.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `src/mallet/promises.ts`; `src/mallet/promise-zone.ts`; `src/mallet/promise-door.ts`; `src/mallet/ui/promises.ts`; `src/mallet/http.ts`; `tests/support/promise-journey.mjs`; `tests/promise-browser.mjs`.

**FLOW-003 — Rules-based routing and escalation.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `src/mallet/routing.ts`; `src/mallet/routing-door.ts`; `docs/routing.md`; `tests/mallet.test.mjs`; `tests/support/routing-journey.mjs`.

**TIME-001 — Employee clock and job timers.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `src/mallet/time.ts`; `src/mallet/ui/time.ts`; `src/mallet/http.ts`; `tests/mallet.test.mjs`; `tests/support/time-journey.mjs`; `tests/time-browser.mjs`.

**FLOW-004 — Technician collaboration and handoff.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `src/mallet/collaboration.ts`; `src/mallet/ui/collaboration.ts`; `src/mallet/http.ts`; `src/mallet/media/storage.ts`; `tests/support/collaboration-journey.mjs`; `tests/collaboration-browser.mjs`.

**WARRANTY-001 — Warranty and comeback work.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `tests/mallet.test.mjs`; `tests/warranty-browser.mjs`.

**RETURN-001 — Paid and documented handover.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `tests/mallet.test.mjs`; `tests/return-browser.mjs`; `tests/support/return-revision.mjs`.

**RETURN-002 — Storage, abandoned property and repair liens.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: No implementation evidence yet.

**FLEET-001 — Fleet and commercial repair workflows.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: `tests/mallet.test.mjs`; `tests/support/receivables-journey.mjs`; `tests/receivables-browser.mjs`.

**FLEET-002 — Fleet billing and statement reconciliation.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#workshop-execution-and-technician-work).

Evidence: No implementation evidence yet.

## Parts, inventory and purchasing

**PART-001 — Shop parts catalog and traceability.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/stock-trace-browser.mjs`.

**PART-002 — Barcode receiving and stock counts.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/inventory-browser.mjs`; `tests/mallet.test.mjs`.

**PART-003 — Repair reservations and consumption.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/support/stock-consumption-journey.mjs`; `tests/inventory-browser.mjs`; `tests/mallet.test.mjs`; `tests/inventory-browser.mjs`.

**BUY-001 — Purchase orders and goods receipts.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/purchasing-browser.mjs`.

**BUY-002 — Supplier stock and approved ordering.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/support/supplier-orders-journey.mjs`; `tests/supplier-orders-browser.mjs`; `docs/supplier-ordering.md`.

**BUY-003 — PartsTech catalog and orders.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: No implementation evidence yet.

**BUY-004 — Nexpart catalog and orders.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: No implementation evidence yet.

**BUY-005 — Worldpac sourcing and orders.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: No implementation evidence yet.

**PART-004 — Core deposits and returns.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/support/cores-journey.mjs`; `tests/cores-browser.mjs`.

**PART-005 — Supplier RMAs and defective parts.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/support/supplier-returns-journey.mjs`; `tests/supplier-returns-browser.mjs`.

**PART-006 — ETA and special-order follow-through.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `src/mallet/special-parts.ts`; `src/mallet/ui/special-parts.ts`; `src/mallet/promises.ts`; `src/mallet/workshop.ts`; `tests/support/special-part-journey.mjs`; `tests/special-part-browser.mjs`.

**PART-007 — Low-stock replenishment.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/support/replenishment-journey.mjs`; `tests/replenishment-browser.mjs`.

**PART-008 — Inter-store transfers.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: `tests/mallet.test.mjs`; `tests/support/transfers-journey.mjs`; `tests/transfers-browser.mjs`.

**BUY-006 — Supplier and warranty compensation reconciliation.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: No implementation evidence yet.

**BUY-007 — MobileSentrix US parts.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: No implementation evidence yet.

**BUY-008 — Injured Gadgets order sync.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#parts-inventory-and-purchasing).

Evidence: No implementation evidence yet.

## US invoicing, payments and accounting

**INV-001 — USD invoices and customer delivery.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/mallet.test.mjs`; `tests/support/invoice-documents-journey.mjs`; `tests/invoice-documents-browser.mjs`; `tests/sales-tax.test.mjs`.

**TAX-001 — US parts and labor sales tax.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `src/mallet/tax.ts`; `src/mallet/money.ts`; `src/mallet/setup.ts`; `migrations/core/0018_sales_tax.sql`; `tests/sales-tax.test.mjs`.

**TAX-002 — Exemptions and shop fees.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/sales-tax.test.mjs`; `tests/support/tax-custody-journey.mjs`; `tests/invoice-documents-browser.mjs`; `tests/mallet.test.mjs`; `tests/support/refunds-journey.mjs`; `tests/sales-tax.test.mjs`; `tests/support/filing-tax-journey.mjs`; `tests/mallet.test.mjs`; `tests/support/refunds-journey.mjs`; `tests/receivables-browser.mjs`.

**PAY-001 — Stripe card and ACH collection.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `./tests/mallet.test.mjs`; `./tests/support/stripe-journey.mjs`; `./tests/support/terminal-journey.mjs`; `./tests/support/stripe-returns-journey.mjs`; `./tests/stripe-browser.mjs`; `./tests/stripe-sandbox.mjs`; `./tests/stripe-ach-sandbox.mjs`; `./tests/stripe-terminal-sandbox.mjs`.

**PAY-002 — Square counter and online payments.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**PAY-003 — Text-to-pay and mobile wallets.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**PAY-004 — Deposits and split tenders.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/mallet.test.mjs`; `tests/support/deposits-journey.mjs`; `tests/inventory-browser.mjs`; `tests/mallet.test.mjs`; `tests/inventory-browser.mjs`.

**PAY-005 — Refunds exchanges and customer credits.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/mallet.test.mjs`; `tests/support/refunds-journey.mjs`; `tests/customers-browser.mjs`; `docs/refunds.md`; `tests/support/refunds-journey.mjs`; `tests/customers-browser.mjs`.

**PAY-006 — Consumer financing.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**PAY-007 — Paper checks and shop-defined tenders.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/sales-tax.test.mjs`; `tests/support/filing-tax-journey.mjs`; `tests/mallet.test.mjs`; `tests/receivables-browser.mjs`.

**POS-001 — Retail counter and cash drawer.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**AR-001 — Terms statements and payment follow-up.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/mallet.test.mjs`; `tests/support/receivables-journey.mjs`; `tests/receivables-browser.mjs`.

**AR-002 — Scheduled and automated balance-reminder sequences.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/mallet.test.mjs`; `tests/support/receivables-journey.mjs`; `tests/receivables-browser.mjs`.

**BILL-001 — Recurring service agreements.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**BOOKS-001 — QuickBooks Online two-way sync.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**BOOKS-002 — Xero two-way sync.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**BOOKS-003 — Cost and cash postings to the books.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**MONEY-001 — Payment disputes and settlement close.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: No implementation evidence yet.

**SUBLET-001 — Sublet work and outsourced services.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#us-invoicing-payments-and-accounting).

Evidence: `tests/mallet.test.mjs`; `tests/sublet-browser.mjs`; `tests/support/sublet-journey.mjs`.

## Customer communication and follow-up

**MSG-001 — Two-way repair SMS with Twilio.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: No implementation evidence yet.

**MSG-002 — Gmail repair conversations.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: No implementation evidence yet.

**MSG-003 — Microsoft 365 Outlook conversations.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: No implementation evidence yet.

**PORTAL-001 — Customer repair portal.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: `tests/mallet.test.mjs`; `tests/customers-browser.mjs`; `tests/support/portal-journey.mjs`; `tests/mallet.test.mjs`; `tests/support/portal-journey.mjs`; `tests/customers-browser.mjs`; `tests/customers-browser.mjs`.

**AUTO-001 — Appointment confirmation and reminders.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: `tests/mallet.test.mjs`; `tests/support/outreach-journey.mjs`; `tests/outreach-browser.mjs`; `tests/outreach-browser.mjs`.

**AUTO-002 — Status and pickup notifications.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: `tests/mallet.test.mjs`; `tests/support/status-notices-journey.mjs`; `tests/status-notices-browser.mjs`.

**AUTO-003 — Time and mileage service reminders.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: No implementation evidence yet.

**AUTO-004 — Declined-work follow-up.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: `tests/mallet.test.mjs`; `tests/support/outreach-journey.mjs`; `tests/outreach-browser.mjs`; `tests/support/outreach-journey.mjs`; `tests/outreach-browser.mjs`.

**AUTO-005 — Review and satisfaction requests.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: `tests/mallet.test.mjs`; `tests/support/reviews-journey.mjs`; `tests/reviews-browser.mjs`.

**AUTO-006 — Warranty and contract renewal follow-up.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: `tests/mallet.test.mjs`; `tests/support/coverage-follow-up-journey.mjs`; `tests/warranty-browser.mjs`; `tests/coverage-follow-up-browser.mjs`.

**MSG-004 — Communication controls and searchable history.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#customer-communication-and-follow-up).

Evidence: No implementation evidence yet.

## Reporting and multi-shop management

**REPORT-001 — ARO car count and sales funnel.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#reporting-and-multi-shop-management).

Evidence: `tests/sales-report.test.mjs`; `tests/mallet.test.mjs`; `tests/support/return-journey.mjs`.

**REPORT-002 — Repair and parts profitability.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#reporting-and-multi-shop-management).

Evidence: `tests/sales-report.test.mjs`; `tests/support/profitability-journey.mjs`; `tests/profitability-browser.mjs`; `tests/sales-report.test.mjs`; `tests/support/profitability-journey.mjs`.

**REPORT-003 — Technician efficiency and productivity.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#reporting-and-multi-shop-management).

Evidence: `src/mallet/reports/technicians.ts`; `src/mallet/pay-rates.ts`; `src/mallet/ui/reports.ts`; `src/mallet/http.ts`; `tests/support/report-journey.mjs`; `tests/report-browser.mjs`.

**REPORT-004 — Turnaround and customer promises.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#reporting-and-multi-shop-management).

Evidence: `tests/mallet.test.mjs`; `tests/support/flow-journey.mjs`; `tests/support/booking-journey.mjs`; `tests/support/inspection-report-journey.mjs`; `tests/support/warranty-journey.mjs`; `tests/report-browser.mjs`.

**REPORT-005 — Daily financial and inventory close.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#reporting-and-multi-shop-management).

Evidence: No implementation evidence yet.

**REPORT-006 — Scheduled reports and portable data.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#reporting-and-multi-shop-management).

Evidence: `tests/mallet.test.mjs`; `tests/support/report-journey.mjs`; `tests/support/report-xlsx.mjs`; `tests/support/flow-journey.mjs`; `tests/report-browser.mjs`.

**SHOP-001 — Multiple shops and location controls.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#reporting-and-multi-shop-management).

Evidence: No implementation evidence yet.

## Connected tools and mobility

**HARDWARE-001 — Labels receipts and scanners.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**CAL-001 — Google Calendar scheduling.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**CAL-002 — Microsoft 365 Calendar scheduling.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**OEM-001 — Apple GSX authorized repairs.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**OEM-002 — Samsung GSPN authorized repairs.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**SHIP-001 — ShipStation mail-in and return logistics.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**STORE-001 — Shopify storefront connection.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**STORE-002 — WooCommerce storefront connection.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

**API-001 — Documented shop API.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: `src/mallet/api/resources.ts`; `src/mallet/api/commands.ts`; `src/mallet/api/clients.ts`; `tests/support/shop-api-journey.mjs`; `tests/mallet.test.mjs`; `docs/shop-api.md`.

**API-002 — Webhooks and visible integration recovery.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: `tests/mallet.test.mjs`; `tests/support/webhook-journey.mjs`; `tests/support/real-crank.mjs`; `docs/webhooks.md`.

**MOBILE-001 — Responsive staff and customer work.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: `src/mallet/ui/common.ts`; `tests/browser-journey.mjs`.

**MOBILE-002 — Native iOS and Android workshop apps.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#connected-tools-and-mobility).

Evidence: No implementation evidence yet.

## Move-in and continuity from incumbent systems

**MOVE-001 — Tekmetric move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-002 — Shopmonkey move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-003 — Mitchell 1 Manager SE move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-004 — Shop-Ware move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-005 — AutoLeap move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-006 — RepairDesk move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-007 — Orderry move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-008 — Fixably move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-009 — RepairShopr full repair history.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: `src/mallet/imports/snapshots.ts`; `src/mallet/imports/service.ts`; `tests/mallet.test.mjs`.

**MOVE-010 — Reviewed safe migration and resumability.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: `src/mallet/imports/service.ts`; `src/mallet/imports/context.ts`; `tests/mallet.test.mjs`.

**MOVE-011 — Historical reports and opening balances.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-012 — Open work and controlled cutover.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

**MOVE-013 — Shop setup and inventory move-in.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#move-in-and-continuity-from-incumbent-systems).

Evidence: No implementation evidence yet.

## Tires and broader automotive operations

**TIRE-001 — Tire fitment pricing and sourcing.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#tires-and-broader-automotive-operations).

Evidence: No implementation evidence yet.

**TIRE-002 — DOT tire registration and traceability.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#tires-and-broader-automotive-operations).

Evidence: No implementation evidence yet.

## Roles, security and operating guarantees

**GOV-001 — Job-specific staff rights.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `tests/mallet.test.mjs`; `tests/support/governance-journey.mjs`; `tests/governance-browser.mjs`.

**GOV-002 — Approvals audit and accountable changes.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `tests/mallet.test.mjs`; `tests/support/governance-journey.mjs`; `tests/governance-browser.mjs`; `tests/support/governance-journey.mjs`; `tests/media.test.mjs`; `tests/mallet.test.mjs`; `tests/support/provider-jobs-journey.mjs`; `tests/retention-browser.mjs`; `tests/support/governance-journey.mjs`; `tests/governance-browser.mjs`.

**GOV-003 — Enterprise sign-on and provisioning.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `tests/mallet.test.mjs`; `tests/support/enterprise-journey.mjs`; `tests/support/saml-journey.mjs`; `tests/enterprise-browser.mjs`; `tests/enterprise-saml-browser.mjs`; `docs/enterprise-identity.md`.

**GOV-004 — Strong authentication and customer link protection.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `tests/mallet.test.mjs`; `tests/support/strong-auth-journey.mjs`; `tests/support/link-protection-journey.mjs`; `tests/security-browser.mjs`; `src/mallet/strong-auth/`; `src/mallet/ui/security.ts`; `docs/security.md`.

**GOV-005 — Provider credentials and attachment custody.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `tests/mallet.test.mjs`; `tests/support/connector-journey.mjs`; `tests/support/inspection-report-journey.mjs`; `tests/media.test.mjs`; `tests/security-browser.mjs`; `src/mallet/connectors/`; `src/mallet/strong-auth/secret-box.ts`; `src/mallet/auth.ts`; `src/mallet/pier.ts`; `src/mallet/archive-policy.mjs`; `docs/connectors.md`.

**GOV-006 — Retention erasure and legal holds.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `tests/mallet.test.mjs`; `tests/support/retention-journey.mjs`; `tests/retention-browser.mjs`.

**OPS-001 — Owner-run deployment and complete portability.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `docs/operations.md`; `src/mallet/archive-policy.mjs`; `src/mallet/http.ts`; `tests/clone-journey.mjs`; `tests/browser-journey.mjs`; `tests/mallet.test.mjs`; `tests/support/portable-repair.mjs`; `tests/media.test.mjs`.

**OPS-002 — Fast counter work and dependable background jobs.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#roles-security-and-operating-guarantees).

Evidence: `tests/mallet.test.mjs`; `tests/support/capacity-import-journey.mjs`; `tests/support/search-journey.mjs`; `tests/search-browser.mjs`; `tests/support/repair-read-journey.mjs`; `tests/support/jobs-journey.mjs`; `tests/support/provider-jobs-journey.mjs`; `tests/jobs-browser.mjs`; `tests/support/board-live-journey.mjs`; `docs/background-jobs.md`; `docs/performance.md`; `scripts/capacity/README.md`.

## Open source and installation

**OPEN-001 — Free and open source under the MIT license, run by one command.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#open-source-and-installation).

Evidence: `LICENSE`; `rer-project.json`; `tests/clone-journey.mjs`; `tests/open-source-journey.mjs`; `tests/browser-journey.mjs`.

## Push further with a service-advisor agent

**ADV-001 — Inspection evidence to priced estimate.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: `src/mallet/estimates.ts`; `src/mallet/model.ts`; `tests/mallet.test.mjs`.

**ADV-002 — Approved customer conversations.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: No implementation evidence yet.

**ADV-003 — Resolve the next repair blocker.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: `src/mallet/workshop.ts`; `src/mallet/estimates.ts`; `tests/mallet.test.mjs`.

**ADV-004 — Source parts and keep promise times current.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: No implementation evidence yet.

**ADV-005 — Bring declined work back at the right mileage.** Status: **missing**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: No implementation evidence yet.

**ADV-006 — Detect comeback and supplier quality patterns.** Status: **done**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: `tests/mallet.test.mjs`; `tests/support/warranty-pattern-journey.mjs`; `tests/support/warranty-journey.mjs`; `tests/support/supplier-returns-journey.mjs`; `tests/warranty-browser.mjs`; `tests/mallet.test.mjs`; `tests/support/warranty-pattern-journey.mjs`.

**ADV-007 — Reconcile repair pickup payment and profit.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: `src/mallet/invoices.ts`; `tests/mallet.test.mjs`.

**ADV-008 — Bounded agent authority and receptionist handoff.** Status: **partial**. [Target, acceptance and remaining work](./CONTRACT.md#push-further-with-a-service-advisor-agent).

Evidence: `tests/mallet.test.mjs`; `tests/support/assistant-journey.mjs`; `tests/assistants-browser.mjs`.
