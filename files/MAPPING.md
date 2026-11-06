# Complete test and journey mapping

187 registered tests before and after, each selected exactly once. Actual Node CLI selection over all no-op registrations is independently checked in NODE-SELECTION-RECEIPT.json. All test files and helpers remain byte-identical. One duplicate build is removed; source checks, typecheck, runtime, hosted-output, hydration, agent-door and nightly clone journey remain.

| File | Test/journey | Before | After |
| --- | --- | --- | --- |
| tests/mallet.test.mjs | ADV-003: source-cited blockers require actual evidence, exact consent and physical receipt, preserve handlers and recover privately | workshop-core | journeys-3 |
| tests/mallet.test.mjs | native sign-in, CSRF, member isolation and immediate session revocation | workshop-core | core |
| tests/mallet.test.mjs | HTTP-001: populated private doors refuse unsafe requests without business writes | workshop-core | journeys-5 |
| tests/mallet.test.mjs | booking rejects bay and technician collisions and keeps every asset visit | workshop-core | journeys-6 |
| tests/mallet.test.mjs | exact revision, partial authorisation and quantity ceilings protect customer consent | workshop-core | journeys-7 |
| tests/mallet.test.mjs | BASE-AGENT-012: native estimate retries retain one outcome and refuse changed arguments or stale revisions | workshop-core | journeys-2 |
| tests/mallet.test.mjs | agent prepares, person approves, immutable actual-work invoice exports once | workshop-core | journeys-3 |
| tests/mallet.test.mjs | INVOICE-001: exact actual-work lines, approval and both saved export retrieval versions | workshop-core | work-graph-core |
| tests/mallet.test.mjs | INVOICE-001: exact approval history, actual-work rows and saved export retrieval | workshop-core | work-graph-core |
| tests/mallet.test.mjs | dispatch proposal is inert until a person approves current free resources | workshop-core | journeys-5 |
| tests/mallet.test.mjs | RepairShopr dry run, reviewed fingerprint, original custody, replay and undo | workshop-core | journeys-3 |
| tests/mallet.test.mjs | import undo preserves an asset once it has a native repair visit | workshop-core | journeys-4 |
| tests/mallet.test.mjs | OPS-001: complete native archive restores every current record and finishes repair under fresh authority | workshop-core | journeys-6 |
| tests/mallet.test.mjs | DATA-001: native erasure fences known old archives and labels unknown fresh recovery | workshop-core | journeys-6 |
| tests/mallet.test.mjs | VEH-002: visit readings, reasoned corrections, regression warnings and observed service due | workshop-core | work-graph-core |
| tests/mallet.test.mjs | EST-005: decline tires at 60000 miles, retain exact evidence and reprice on the next visit for a fresh decision | workshop-core | journeys-7 |
| tests/mallet.test.mjs | QUALITY-001 / OPS-001: failed brake test blocks ready; corrective work, independent sign-off, reasoned override and immutable restore | workshop-core | work-graph-core |
| tests/mallet.test.mjs | EST-004: separate incremental decisions, prospective price changes, exact actuals/invoice and recovery | workshop-core | core |
| tests/mallet.test.mjs | DVI-001 / DVI-004: exact assigned template, measured/photo outcomes, not-inspected state, canned-job estimate and archive | workshop-core | journeys-4 |
| tests/mallet.test.mjs | EST-002: cost-priced packages, finding overrides, immutable rules and fresh-owner recovery | workshop-core | journeys-2 |
| tests/mallet.test.mjs | TIME-001: two assigned job timers, breaks, approved corrections, isolation and recovery | workshop-core | journeys-5 |
| tests/mallet.test.mjs | REPORT-003 / REPORT-006: sold versus actual hours, recomputed corrections, drill-through, owner-only pay rates and recovery | workshop-core | journeys-4 |
| tests/mallet.test.mjs | DIAG-001: codes, measurements, staff-only notes, reviewed sharing and a read-only customer link | workshop-core | journeys-6 |
| tests/mallet.test.mjs | EST-003: emailed approval link, signed line decision, replay, stale and revoked links and receipt recovery | workshop-core | journeys-7 |
| tests/mallet.test.mjs | EST-006 / EST-007: scheduled reminders chase only the current undecided revision; reply, decision and opt-out stop them; rejected and interrupted sends and silence retain one attributable advisor task | workshop-core | journeys-4 |
| tests/mallet.test.mjs | FLOW-002: delayed required parts, resource/labor plan, advisor promise notices and archive recovery | workshop-core | journeys-6 |
| tests/mallet.test.mjs | FLOW-002: failed/uncertain provider outcome claims one send and remains visible | workshop-core | journeys-6 |
| tests/mallet.test.mjs | FLOW-004 / FLOW-005: helper crew, dependent subtasks, mentioned advisor with media, acknowledged handoff, per-person time and recovery | workshop-core | journeys-6 |
| tests/mallet.test.mjs | FLOW-001 / REPORT-004 / REPORT-006: nine-stage board, measured delays, promises, gated moves, technician, overdue, priority and search filters, canceled and lost retention, recorded collection and recovery | workshop-core | journeys-7 |
| tests/mallet.test.mjs | PART-006: supplier backorder, approved charge, internal advisor changes, actual receipt, invoice once and fresh-owner archive recovery | workshop-core | core |
| tests/mallet.test.mjs | FLOW-003 / OPS-001: deterministic routing, closed-day deadlines, durable escalation and resolution through public doors | workshop-core | journeys-5 |
| tests/mallet.test.mjs | EST-001 / OPS-001: fleet/customer rates, direct costs, fees and discounts freeze through consent, actuals, invoice and recovery | workshop-core | work-graph-core |
| tests/mallet.test.mjs | SUBLET-001 / OPS-001: approved outsourced scope, delayed custody, supplier bills, receiving and quality gates, exact margin and fresh recovery | workshop-core | journeys-5 |
| tests/mallet.test.mjs | PART-002 / OPS-001: barcode receiving, separate balances, blind and cycle variances, approval fences, reports and fresh recovery | workshop-core | journeys-4 |
| tests/mallet.test.mjs | BUY-001 / OPS-001: approved spend, partial receipt, repair allocation, backorder, bill exceptions, closure and fresh recovery | workshop-core | journeys-3 |
| tests/mallet.test.mjs | CUS-001 / OPS-001: owner/admin accounts, previewed merges, payer sessions, frozen invoices and recovery | workshop-core | journeys-6 |
| tests/mallet.test.mjs | PART-001 / OPS-001: declared catalog, two supplier lots, serial identity, exact installed costs, affected repairs, count reconciliation and recovery | workshop-core | journeys-7 |
| tests/mallet.test.mjs | WARRANTY-001 / OPS-001: paid original, linked lot and no-charge comeback, coverage decision, supplier claim and preserved invoice recovery | workshop-core | journeys-2 |
| tests/mallet.test.mjs | RETURN-001 / PAY-004 / OPS-001: failed quality and unpaid gates, processor receipts, exact cash delegate and identity evidence, immutable receipt and recovery | workshop-core | core |
| tests/mallet.test.mjs | PORTAL-001: known and unknown requests answer before mail; address and client limits disclose nothing | workshop-core | journeys-2 |
| tests/mallet.test.mjs | PORTAL-001: confirmation, separate sessions, sign-out and contact changes fence account access | workshop-core | journeys-2 |
| tests/mallet.test.mjs | PAY-005 / PAY-008 / OPS-001: reviewed original-tender refunds, exact tax credits, exchanges, account isolation and recovery | workshop-core | core |
| tests/mallet.test.mjs | PAY-005 / PAY-008: one approved Stripe refund, uncertain recovery and duplicate or failed provider outcomes | workshop-core | core |
| tests/mallet.test.mjs | PAY-005: full original cash, check and other manual refunds preserve issued invoices and zero the balance | workshop-core | core |
| tests/mallet.test.mjs | BOOK-001: final-slot contenders retain one exact confirmation, cancel, reclaim and recover with fresh authority | workshop-core | journeys-5 |
| tests/mallet.test.mjs | BOOK-001: opening windows, skills, duration, lead time and expiring tentative capacity | workshop-core | journeys-5 |
| tests/mallet.test.mjs | DVI-003: reviewed private evidence, exact proposed lines, delivery and read-only view analytics survive recovery | workshop-core | work-graph-core |
| tests/mallet.test.mjs | BOOK-001: failed or uncertain confirmation mail preserves the appointment without an automatic resend | workshop-core | journeys-5 |
| tests/mallet.test.mjs | DVI-003: rejected or uncertain report mail retains one honest attempt without an automatic resend | workshop-core | work-graph-core |
| tests/mallet.test.mjs | BOOK-001: anonymous tentative holds are bounded per source and normalized email | workshop-core | journeys-5 |
| tests/mallet.test.mjs | BOOK-002: qualified resources, absences, recurring DST reservations and dispatch contention recover | workshop-core | journeys-7 |
| tests/mallet.test.mjs | BOOK-002 / BOOK-003: cancellation offers FIFO eligible customers one private bounded reservation | workshop-core | journeys-7 |
| tests/mallet.test.mjs | BOOK-002 / BOOK-003: waitlist offer expiry requires explicit staff advancement | workshop-core | journeys-7 |
| tests/mallet.test.mjs | BOOK-002 / BOOK-003: existing tentative email holds preserve waitlist eligibility | workshop-core | journeys-7 |
| tests/mallet.test.mjs | BOOK-002 / BOOK-003: waitlist offers share the tentative source capacity bound | workshop-core | journeys-7 |
| tests/mallet.test.mjs | BOOK-002 / BOOK-003: failed or uncertain waitlist mail never automatically retries | workshop-core | journeys-7 |
| tests/mallet.test.mjs | PART-007 / OPS-001: consumed stock, location demand, open-order deduction, replay-safe drafts, stale approval and recovery | workshop-core | journeys-5 |
| tests/mallet.test.mjs | PART-004 / OPS-001: separate taxed core deposit, tender, due alerts, returned condition, shipment, adjusted supplier credit and immutable invoice correction | workshop-core | journeys-4 |
| tests/mallet.test.mjs | PART-005 / OPS-001: installed and unused supplier returns, PO provenance, quarantine, authorization, shipment, partial credit and warranty costs survive recovery | workshop-core | journeys-3 |
| tests/mallet.test.mjs | PART-008 / OPS-001: serialized inter-store request, approval, dispatch, shortage/damage custody, exact corrections and recovery | workshop-core | journeys-6 |
| tests/mallet.test.mjs | BUY-002 / OPS-001: supplier comparison, exact cart approval, timed-out submit replay, rejected substitution, cancellation, rejected orders and recovery | workshop-core | journeys-7 |
| tests/mallet.test.mjs | ASSET-001 / OPS-001: typed bicycle, device, equipment and auto repairs retain custody, parts, tax, paid returns and recovery | workshop-core | journeys-2 |
| tests/mallet.test.mjs | DIAG-002 / OPS-001: private Phonecheck result imports retain raw tests, quarantine serial mismatches and recover without shared authority | workshop-core | core |
| tests/mallet.test.mjs | INV-001: exact mixed USD copies, linked corrections, single Base mail handoff and private archive recovery | workshop-core | work-graph-core |
| tests/mallet.test.mjs | PAY-004 / OPS-001: pre-order deposits, cross-invoice allocations, split tender, cancellation refunds and fresh recovery | workshop-core | journeys-5 |
| tests/mallet.test.mjs | PART-003 / OPS-001: atomic reserved lot usage, last-item conflicts, cancellation release, recorded returns and recovery | workshop-core | journeys-4 |
| tests/mallet.test.mjs | AR-001 and FLEET-001: owner-reviewed terms, credit limits, fleet authorizer, check allocation, disputes, promises and private recovered statements | workshop-core | journeys-3 |
| tests/mallet.test.mjs | GOV-002: private searchable audit retains decisions after revocation and fresh-owner recovery | workshop-core | journeys-3 |
| tests/mallet.test.mjs | GOV-001: owner-only grants bound staff commands, private projections, handoffs and revoked authority | workshop-core | journeys-6 |
| tests/mallet.test.mjs | Stripe public doors treat inherited handler names as unknown without exposing bindings | workshop-core | core |
| tests/mallet.test.mjs | PAY-001: owner checkout, authenticated event replay, exact fee and payout membership and inert recovery | workshop-core | journeys-4 |
| tests/mallet.test.mjs | PAY-001: explicit expiration and uncertain checkout stay stopped without allocating money | workshop-core | journeys-4 |
| tests/mallet.test.mjs | PAY-001: owner reader collection, authenticated payment and exact replay survive recovery | workshop-core | journeys-4 |
| tests/mallet.test.mjs | PAY-001: uncertain reader initiation and cancellation reconcile without outbound replay | workshop-core | journeys-4 |
| tests/mallet.test.mjs | PAY-001: authenticated ACH returns and reinstatement preserve captured payments across replay and recovery | workshop-core | journeys-4 |
| tests/mallet.test.mjs | AUTO-001: appointment email quiet hours across DST, replacement, cancellation, failure and inert recovery | workshop-core | journeys-7 |
| tests/mallet.test.mjs | AUTO-004: approved refreshed quote, observed mileage, explicit stop and repeat decline preserve decisions | workshop-core | journeys-4 |
| tests/mallet.test.mjs | GOV-003: explicit provider sign-in, SCIM employment revocation and repair attribution survive recovery | workshop-core | journeys-7 |
| tests/mallet.test.mjs | GOV-003: signed SAML admission, employment revocation and repair attribution survive recovery | workshop-core | journeys-7 |
| tests/mallet.test.mjs | AUTO-005: paid collection permits one consented review handoff with private and inert recovery | workshop-core | journeys-5 |
| tests/mallet.test.mjs | AUTO-005: poor private feedback keeps the public invitation and creates an owner task with erasure and recovery | workshop-core | journeys-5 |
| tests/mallet.test.mjs | AUTO-002: approved stage email sends once, uncollected pickup reaches the owner and recovery is inert | workshop-core | journeys-2 |
| tests/mallet.test.mjs | AUTO-002: quiet hours, changed repairs, failed contact, withdrawal and collection stop unsafe notices | workshop-core | journeys-2 |
| tests/mallet.test.mjs | API-002: signed business outbox, bounded delivery, rotation, replay and inert recovery | workshop-core | core |
| tests/mallet.test.mjs | API-002: pinned public Crank workflow receives signed events and applies replay once | workshop-core | core |
| tests/mallet.test.mjs | ADV-008: separate scoped authority refuses unsafe roles, channels, spending, expiry and preparation-key expansion | workshop-core | journeys-6 |
| tests/mallet.test.mjs | ADV-008: disclosed receptionist captures requested intake, reserves actual capacity and escalates to a person | workshop-core | journeys-6 |
| tests/mallet.test.mjs | ADV-008: every note proposal preserves raw technician evidence and measured facts without publication | workshop-core | journeys-6 |
| tests/mallet.test.mjs | ADV-008: exact human email review, queued revocation, single handoff and inert archive recovery | workshop-core | journeys-6 |
| tests/mallet.test.mjs | ADV-008: failed or uncertain appointment email survives restart without an automatic retry and reaches human recovery | workshop-core | journeys-6 |
| tests/mallet.test.mjs | API-001: versioned resource pages, retained repair history and stable identities recover without credentials | workshop-core | journeys-3 |
| tests/mallet.test.mjs | API-001: scoped preparation retries are atomic across transports and preserve each existing person decision | workshop-core | journeys-3 |
| tests/mallet.test.mjs | API-001: missing scopes, alternate transports and expired or revoked authority fail closed | workshop-core | journeys-3 |
| tests/mallet.test.mjs | ADV-005: cited declined-work review preserves decisions, refuses stale or unsafe preparation and recovers erased history | workshop-core | journeys-2 |
| tests/mallet.test.mjs | RETURN-002: reviewed CA and TX storage versions, notice clocks, disposal refusal, payment release and private recovery | workshop-core | core |
| tests/mallet.test.mjs | agent preparation resources retain exact outcomes and enforce current native authority with attributable browser readback | workshop-core | journeys-3 |
| tests/demo.test.mjs | QUALITY-001: demo opens on a lived-in workshop whose prepared work a person can decide, and sends nothing | workshop-core | journeys-2 |
| tests/mallet.test.mjs | BASE-AGENT-002: native forms and MCP preparation parity under both policies at 1440 and 390 | workshop-browser | core |
| tests/mallet.test.mjs | BASE-AGENT-005: native admin sponsor changes revoke preparation and cached reads at 1440 and 390 | workshop-browser | core |
| tests/mallet.test.mjs | BASE-AGENT-008: exact agent preparation and distinct native owner approval at 1440 | workshop-browser | journeys-2 |
| tests/mallet.test.mjs | BASE-AGENT-011: native Pause fences all six tools and legacy routes, owner work and bearer resume at 1440 and 390 | workshop-browser | core |
| tests/mallet.test.mjs | ADV-003: native blocker packet, handlers and proposal review at 1440 and 390 | workshop-browser | journeys-3 |
| tests/mallet.test.mjs | WORKSHOP-001 and INVOICE-001: native registration, repeat visits and exact saved invoice at 1440 and 390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | INVOICE-001: native invoice and downloaded CSV readback at 1440 and 390 | workshop-browser | work-graph-core |
| tests/mallet.test.mjs | QUALITY-001: counter/technician failed test, corrective work and independent Ready clearance at 1440/390 | workshop-browser | work-graph-core |
| tests/mallet.test.mjs | DVI-001: native template/recipe/assignment and technician inspection at 1440/390 | workshop-browser | journeys-4 |
| tests/mallet.test.mjs | EST-002: native matrix/package editors and reasoned override at 1440 and 390 | workshop-browser | journeys-2 |
| tests/mallet.test.mjs | TIME-001: native clocks, reasoned correction decisions and actual board time at 1440/390 | workshop-browser | journeys-5 |
| tests/mallet.test.mjs | REPORT-003: native technician report, rate form and role views at 1440/390 | workshop-browser | journeys-4 |
| tests/mallet.test.mjs | DIAG-001: native diagnosis form, advisor sharing and customer link at 1440/390 | workshop-browser | journeys-6 |
| tests/mallet.test.mjs | EST-003: customer approves and declines lines on a phone with a signed receipt at 390/1440 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | EST-006 / EST-007: native chase policy, reminder history, customer opt-out and uncertain-task resolution at 1440/390 | workshop-browser | journeys-4 |
| tests/mallet.test.mjs | FLOW-002: revised pickup promise and customer notice through native forms at 1440/390 | workshop-browser | journeys-6 |
| tests/mallet.test.mjs | FLOW-004 / FLOW-005: native helper, dependent subtasks, mention and acknowledged handoff at 1440/390 | workshop-browser | journeys-6 |
| tests/mallet.test.mjs | FLOW-001: native board filters, priority, cancel and recorded collection at 1440/390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | PART-006: approved special order, retained delay, advisor review and physical receipt through native forms at 1440/390 | workshop-browser | core |
| tests/mallet.test.mjs | EST-001: rate profile and discounted mixed estimate through native forms at 1440/390 | workshop-browser | work-graph-core |
| tests/mallet.test.mjs | SUBLET-001: outside handoff, delay, added-scope decision, supplier bill, receipt, quality and margin through native forms at 1440/390 | workshop-browser | journeys-5 |
| tests/mallet.test.mjs | PART-002: scan shipment and bins, approve shortage and reconcile through native forms at 1440/390 | workshop-browser | journeys-4 |
| tests/mallet.test.mjs | BUY-001: two-line spend approval, partial receiving, backorder and changed bill exception through native forms at 1440/390 | workshop-browser | journeys-3 |
| tests/mallet.test.mjs | CUS-001: admin intake, merge preview and payer-only account billing through native forms at 1440/390 | workshop-browser | journeys-6 |
| tests/mallet.test.mjs | PART-001: maintain catalog, receive two lots, identify installation and find only affected vehicles at 1440/390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | WARRANTY-001: original invoice, linked rework, no-charge costs and supplier claim at 1440/390 | workshop-browser | journeys-2 |
| tests/mallet.test.mjs | RETURN-001: failed quality and unpaid refusal, processor confirmation, exact cash delegate receipt, recovery and owner exception at 1440/390 | workshop-browser | core |
| tests/mallet.test.mjs | PAY-005 / PAY-008: payer refund privacy, current-payer refusal and credit statements at 1440 and 390 | workshop-browser | core |
| tests/mallet.test.mjs | BOOK-001: embedded service selection, final-slot contention and released capacity at 1440 and 390 | workshop-browser | journeys-5 |
| tests/mallet.test.mjs | DVI-003: advisor review, email, mobile video and proposed repair at 1440 and 390 | workshop-browser | work-graph-core |
| tests/mallet.test.mjs | BOOK-002 / BOOK-003: native day week resources and cancellation offers at 1440 and 390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | PART-007: low stock, repeated preparation and exact cart approval at 1440/390 | workshop-browser | journeys-5 |
| tests/mallet.test.mjs | PART-004: core deposit, expiry alert, shipment and adjusted credit correction at 1440/390 | workshop-browser | journeys-4 |
| tests/mallet.test.mjs | PART-005: remove failed part, authorize RMA, ship and reconcile partial credit at 1440/390 | workshop-browser | journeys-3 |
| tests/mallet.test.mjs | PART-008: serialized inter-store transfer received short and approved correction at 1440/390 | workshop-browser | journeys-6 |
| tests/mallet.test.mjs | BUY-002: compare suppliers, approve cart, reconcile timeout, reject substitution and inspect cancellation/rejection at 1440/390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | ASSET-001: typed intake, bench booking and paid return through native forms at 1440/390 | workshop-browser | journeys-2 |
| tests/mallet.test.mjs | DIAG-002: native private result import, mismatch and raw evidence at 1440/390 | workshop-browser | core |
| tests/mallet.test.mjs | INV-001: owner issues, prints, emails and corrects invoice copies through native forms at 1440 and 390 | workshop-browser | work-graph-core |
| tests/mallet.test.mjs | PAY-004: owner records pre-order deposits, allocates customer credit and refunds canceled deposits through native forms at 1440 and 390 | workshop-browser | journeys-5 |
| tests/mallet.test.mjs | PART-003: reserved work, inspected stock returns and cancellation release through native forms at 1440 and 390 | workshop-browser | journeys-4 |
| tests/mallet.test.mjs | AR-001, FLEET-001 and TAX-002: native terms, fleet PO, disputed statement, promise and observed-clearance preview at 1440 and 390 | workshop-browser | journeys-3 |
| tests/mallet.test.mjs | GOV-001 and GOV-002: owner grants, bounded staff handoff and private audit search and downloads at 1440 and 390 | workshop-browser | journeys-6 |
| tests/mallet.test.mjs | PAY-001: native merchant connection, invoice checkout and fee reconciliation at 1440 and 390 | workshop-browser | journeys-4 |
| tests/mallet.test.mjs | AUTO-001 and AUTO-004: owner schedules and stops email through native forms at 1440 and 390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | GOV-003: owner provisions and revokes a technician through native settings at 1440 and 390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | GOV-003: signed SAML browser admission and old-session refusal at 1440 and 390 | workshop-browser | journeys-7 |
| tests/mallet.test.mjs | AUTO-005: owner request, customer feedback and completed-repair task through native forms at 1440 and 390 | workshop-browser | journeys-5 |
| tests/mallet.test.mjs | AUTO-002: owner reviews status email, failed contact and pickup follow-up through native forms at 1440 and 390 | workshop-browser | journeys-2 |
| tests/mallet.test.mjs | ADV-008: owner scopes, reviews and revokes assistant work with human handoff at 1440 and 390 | workshop-browser | journeys-6 |
| tests/mallet.test.mjs | ADV-005: owner reviews later mileage, replacement inspection and advisory history at 1440 and 390 | workshop-browser | journeys-2 |
| tests/mallet.test.mjs | RETURN-002: native storage rules, notices, legal refusal and released ledger at 1440 and 390 | workshop-browser | core |
| tests/sales-tax.test.mjs | shop setup, taxability, frozen Dana invoice and USD CSV use per-line sales tax | sales-tax | core |
| tests/sales-tax.test.mjs | pre-US records migrate without changing amounts and request unknown shop rate | sales-tax | core |
| tests/sales-tax.test.mjs | TAX-002: private certificate dates and declared jurisdiction tax reverse exact issued credits without repricing | sales-tax | journeys-3 |
| tests/sales-tax.test.mjs | TAX-002: owner retains an expired certificate and declares invoice jurisdiction through native forms at 1440 and 390 | sales-tax | journeys-5 |
| tests/sales-tax.test.mjs | TAX-002: dedicated filing-period deposit attribution, observed check clearance, exact partial receipt cents and completed refund recovery | sales-tax | journeys-3 |
| tests/pier-journey.mjs | PIER-001: real Pier catalog, observation, revocation and credential rotation never move source stock | pier | journeys-4 |
| tests/media.test.mjs | DVI-002 and OPS-001: private original and shared custody, interrupted upload, exact replay, assignment and revocation and full archive recovery | media | journeys-2 |
| tests/media.test.mjs | DVI-002: phone/tablet markup, compression, visible interruption/resume, original/shared photo and playable video | media | journeys-2 |
| tests/media.test.mjs | DVI-004 / OPS-001: compare same-asset measurements/images, imported provenance, declined carry without new tests/consent, resolution and exact restore | media | journeys-2 |
| tests/media.test.mjs | DVI-004: second-visit comparison, imported source, declined carry and resolved history on desktop and phone | media | journeys-2 |
| tests/media.test.mjs | INTAKE-001 / INTAKE-004 / OPS-001: signed condition and custody, exact checklist comparison, private temporary secrets and fresh-owner recovery | media | journeys-2 |
| tests/media.test.mjs | INTAKE-001: vehicle and device signed custody and actual checklist comparison at 1440/390 | media | journeys-2 |
| tests/media.test.mjs | INTAKE-002 / OPS-001: two templates, retained required-field draft, original signed terms and exact delivered copy with recovery | media | journeys-2 |
| tests/media.test.mjs | INTAKE-002: publish two templates, retain phone draft and retrieve original signed copy after terms change at 1440/390 | media | journeys-2 |
| tests/media.test.mjs | INTAKE-003 / OPS-001: private after-hours request, exact diagnostic consent, advisor-confirmed match, duplicate refusal and recovery | media | journeys-2 |
| tests/media.test.mjs | INTAKE-003: after-hours customer request, counter match and diagnostic-only booking at 1440/390 | media | journeys-2 |
| tests/restore.test.mjs | DATA-001: fresh restore asks for the latest journal before acceptance and labels missing evidence honestly | restore | journeys-6 |
| tests/sales-report.test.mjs | REPORT-001 / REPORT-007: known native repairs reconcile sales and decisions, download sources and recover without new authority | sales-report | journeys-7 |
| tests/sales-report.test.mjs | REPORT-001 / REPORT-007: local calendar boundaries, empty ratios, filter refusal and native report authority | sales-report | journeys-7 |
| tests/sales-report.test.mjs | REPORT-002: higher purchase cost, discounted repair, loaded labor and comeback reconcile margins and recover sources | sales-report | journeys-7 |
| tests/sales-report.test.mjs | REPORT-002: incomplete costs stay unavailable and private reports refuse unauthorized or invalid requests | sales-report | journeys-7 |
| tests/sales-report.test.mjs | REPORT-002: native cost settings, margins, comparisons and source events at 1440 and 390 | sales-report | journeys-7 |
| tests/mallet.test.mjs | GOV-004: authenticator app, passkey and recovery-code sign-in with replay, clone, origin and guessing fences | security | journeys-5 |
| tests/mallet.test.mjs | GOV-004: owner-required policy, lost-device reset and deployment owner recovery | security | journeys-5 |
| tests/mallet.test.mjs | GOV-004: refunds, agent keys, erasure and custody reveals need a fresh second factor and refusals write nothing | security | journeys-5 |
| tests/mallet.test.mjs | GOV-004 / GOV-007: stolen, revoked and expired customer links look unknown on every door, misses are paced and no link grants payer authority | security | journeys-5 |
| tests/mallet.test.mjs | GOV-004 / GOV-005: authenticator app, passkey, sign-in confirmation, step-up and sealed connector credentials through native forms at 1440/390 | security | journeys-5 |
| tests/mallet.test.mjs | GOV-005: sealed provider secrets rotate and revoke behind a fresh proof, webhooks prove their origin, and no secret reaches a response, archive, audit row or log | security | work-graph-core |
| tests/mallet.test.mjs | GOV-006: explicit holds, customer erasure, import custody and manual retention survive fresh-owner recovery without resurrecting media | retention | work-graph-core |
| tests/mallet.test.mjs | GOV-006: owner reviews financial and media holds, erases eligible photos and releases a hold for manual retention at 1440/390 | retention | work-graph-core |
| tests/mallet.test.mjs | OPS-002 / OPS-003: durable reminder jobs bound concurrent handoffs to four, survive restart and expose owner recovery | operations-core | work-graph-core |
| tests/mallet.test.mjs | OPS-002: account search is paged, indexed, exact across aliases and Unicode, and survives restore | operations-core | work-graph-core |
| tests/mallet.test.mjs | OPS-002 / OPS-003: approved provider GET jobs survive restart, require explicit replay and deduplicate payment evidence | operations-core | work-graph-core |
| tests/mallet.test.mjs | OPS-002: core RO reads keep lines, inspections and decisions with current crew authority and exact recovery | operations-core | work-graph-core |
| tests/mallet.test.mjs | OPS-002 / OPS-003: owner queues, inspects and recovers background jobs through native forms at 1440/390 | operations-browser | work-graph-core |
| tests/mallet.test.mjs | OPS-002: staff search phone and plate and page native account results at 1440/390 | operations-browser | work-graph-core |
| tests/mallet.test.mjs | OPS-002: native peer boards update stages and priority while preserving drafts and focus at 1440/390 | operations-browser | work-graph-core |
| tests/mallet.test.mjs | OPS-002: native capacity import verifies record and media graphs before publishing | operations-import | work-graph-core |

| Command/journey | Before | After |
| --- | --- | --- |
| pnpm run check --profile first-party | source | core |
| node scripts/contract-docs.mjs check | source | core |
| pnpm run typecheck | typecheck | core |
| pnpm run build | runtime | core |
| pnpm run test:runtime | runtime | core |
| pnpm run build | workshop-browser | core |
| node tests/clone-journey.mjs | clone-journey | clone-journey |
