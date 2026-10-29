# Mallet rulings

The clause states each outcome; this record retains its date, ruler and reasons.

### RL-1 — CUS-001 carried decision

**Date:** 2026-10-22  
**Ruled by:** ct  
**Governs:** CUS-001

**Source record:** Maintain searchable people and business accounts, multiple vehicles/assets, phone/email, billing contacts, communication preferences, tax status, notes and duplicate-safe merge with source history; fleets can have separate driver, authorizer and payer. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Create a household and fleet, merge a duplicate, change a driver and search by name, phone and plate; old invoices retain their snapshots and the payer alone sees fleet billing. Authority (ct 22 Oct 2026). Owner and admin create and edit contacts, accounts, drivers and links. A merge needs owner or admin, the exact versions, a preview of the survivor, a reason and identity-match evidence, and it keeps both source snapshots. GOV-001 sets the finer advisor, manager, cashier and accountant rights. On the customer side, only the account's current payer sees fleet billing (invoices, balances, statements, payments), through a PORTAL-001 account session. Drivers and authorizers see no billing unless they are also the payer. Changing the payer ends the old payer's access at once. Stored roles alone grant nothing. Also (ct 22 Oct 2026): an admin creates a fleet and changes its driver; the payer signs in and sees billing; the driver and authorizer are refused; after the payer changes, the old payer is refused. GOV-001 finer roles are still to come. SMS sign-in links (MSG-001) and portal payment initiation are not built. CUS-001 and PORTAL-001 stay PARTIAL per ct batch-11 D.  The per-address and per-client request limits are disclosed implementation values, not contract policy. Session membership revocation and exact 24-hour server expiry gaps from ct 22 Oct 2026 are now asserted; status remains PARTIAL.

### RL-2 — BOOK-001 carried decision

**Date:** 2026-10-22  
**Ruled by:** ct  
**Governs:** BOOK-001

**Source record:** Customers book, reschedule or cancel services against published opening hours, bay skills, duration, location, lead time and staff capacity; simultaneous last-slot requests cannot overbook and tentative slots have expiry. Published dated opening windows include exact UTC-offset bounds, a location, a skilled bay and active staff member; service duration defines the slot grid and minimum lead time and current active staff are checked again at confirmation and rescheduling. Customer pages and confirmation mail name the snapshotted shop timezone. Bay and staff reservations are shared with staff booking and dispatch. Tentative holds expire after the configured 1–1800 seconds (default 600); a compare-and-swap transaction makes simultaneous last-slot claims exclusive. Customers explicitly request confirmation email and receive a private 256-bit management link, stored only as a hash outside archives, to confirm, reschedule or cancel their own appointment. The public booking door permits at most one unexpired tentative hold per case-normalized email and three per source connection, enforced by the same transaction fence as capacity. Refusals name the email or connection limit and explain confirmation, cancellation or expiry; the source uses a SHA-256 hash of the Cloudflare client address (a shared unknown-source bucket when absent), never a raw address or a form-supplied source. A management link opens and changes only its one appointment, never other bookings, the customer record or vehicle history. No customer register lookup, repair authorization or charge occurs. Owner/admin alone publish availability; mail outcomes distinguish provider handoff, development suppression, failure and uncertainty, and a claimed send is never automatically retried. BOOK-002, AUTO-001 and PORTAL-001 inherit these capacity and private-management boundaries. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Embed a booking form, choose a service on a phone and contend for the last available bay; one confirmed appointment is sent and cancellation frees capacity. None. ct 22 Oct 12:58Z APPROVED AS LANDED; anonymous-source/email bound and appointment-only link rider now proved.

### RL-3 — DVI-003 carried decision

**Date:** 2026-10-22  
**Ruled by:** ct  
**Governs:** DVI-003

**Source record:** Text/email a branded mobile report showing measurements, urgency, technician evidence and an advisor-reviewed plain-language explanation, linked to exact estimate lines; record delivery and views without treating a view as approval. New product data inherits OPS-001 before shipping. Customer delivery must preserve DVI-002 private-original control; a prepared shared variant is never itself delivery. It extends the DIAG-001 customer inspection link (token, expiry, revocation, view receipts and the staff-note boundary) with shared media, delivery and view analytics. Owner/admin explicitly review an immutable report snapshot of current inspection results, urgency, exact measurements, a plain-language explanation, selected completed shared photo/video variants, and selected lines of a current person-approved estimate revision. The report uses the existing hashed 256-bit, 1–30 day, revocable read-only inspection link; every media request and chunk page rechecks link authority and only serves the reviewed shared variants, never originals. Customer pages omit staff identities, notes, costs, contacts and unselected lines. Proposal pages retain their exact revision and label superseded revisions historical. Owner/admin verify the email recipient and record explicit customer permission before one durable send claim; provider handoff, development suppression, failure and uncertainty are distinct from confirmed delivery, with no automatic retry. Signed Resend delivery events are accepted only with the configured installation webhook key, exact retained provider message ID and reviewed recipient; bounded original bytes, timestamp verification and durable event identity checks reject forged, stale, foreign and conflicting events. Deferred, delivered, bounced, suppressed and complaint facts remain separate from submission handoff; older nonterminal events cannot regress a terminal fact. Receipt handling sends nothing and changes no approval; private owner/admin pages show the provider state and last report-view time, and archives preserve the receipts while excluding verification keys. Report views are counted and timestamped without changing any repair, inspection, estimate or approval. MSG-001 inherits these reviewed-report and explicit-send boundaries for SMS; GOV-006 inherits report/media retention without automatic deletion before its policy ships. **Acceptance evidence:** Send an inspection report to a customer phone, play its video and open a proposed repair; a viewed report leaves all approval decisions unchanged. ct 22 Oct 12:58Z APPROVED AS LANDED. Email leg only: SMS stays MSG-001's and report/media retention stays GOV-006's as named Gaps; DVI-003 stays PARTIAL. Resend downstream email delivery is proved at the controlled network edge; SendGrid events whose message ID differs from its submission receipt remain unconfirmed, and Cloudflare queue delivery is not wired.

### RL-4 — FLEET-001 carried decision

**Date:** 2026-10-25  
**Ruled by:** ct  
**Governs:** FLEET-001

**Source record:** Handle fleet purchase-order numbers, driver versus authorizer, credit limits, payer terms, consolidated statements and vehicle downtime; require the fleet’s allowed authorizer and preserve per-vehicle cost history. Owner-approved open terms must open RETURN-001 handover labelled “Released on account terms; balance due <date>”, retaining the exact account approval, invoice and due date. New product data inherits OPS-001 before shipping. The current partial terms door requires an owner-recorded PO and the unchanged billing snapshot’s allowed authorizer matching the current fleet account. This records a staff-reviewed assertion, not automated verification of the fleet manager. Per-vehicle cost means the retained invoice charge; the displayed interval is booked start to recorded completion, not verified off-road downtime. The current repair-decision door requires the current owner to record the unchanged fleet account revision, current allowed authorizer, PO and explicit approval evidence before any lines are authorized; a driver or bearer link cannot grant fleet repair authority. This is a staff-reviewed assertion, not identity verification. Term invoice copies retain their exact term assignment, due date, PO, lines and amounts, and use the existing explicit one-attempt Base mail door to the current unchanged accounts contact with its current email preference; no delivery is claimed. The displayed vehicle interval remains booked start to recorded completion, with no verified off-road claim. **Acceptance evidence:** A driver drops off a fleet van, the fleet manager approves against its PO, accounts receives a term invoice and a statement drills to that van’s downtime/cost. Native terms, credit limits, statements, per-vehicle invoice charges, labelled booked-start to recorded-completion intervals and explicit term-invoice Base mail handoff now ship. ct 25 Oct 20:55Z: FLEET-001 approved PARTIAL as adopted (owner records account, authorizer, PO and approval evidence; driver and bearer cannot authorize). Riders: a change of fleet account or authorizer voids pending approvals; the PO and evidence are required, not optional; new missing row Fleet billing and statement reconciliation (FLEET-002). Existing approved terms custody remains current-owner-only with explicit audited fleet instructions, current account and invoice-authorizer match, no automatic outbound action or restored finance authority. This extends the qualified FLEET-001 inheritance of the ct 25 Oct 17:20Z AR-001 ruling; GOV-001 inherits delegated finance authority. No independent identity verification, email delivery or verified off-road downtime is claimed. The existing receivables API and native journeys prove account and authorizer changes void pending approvals, renewed approval, required PO and evidence, and driver refusal. FLEET-001 remains PARTIAL. Fleet billing and statement reconciliation is tracked separately by FLEET-002.

### RL-5 — INV-001 carried decision

**Date:** 2026-10-23  
**Ruled by:** ct  
**Governs:** INV-001

**Source record:** Issue numbered USD invoices and printable/PDF receipts from authorized actuals, including customer/vehicle/mileage, sold labor, parts, sublet, discounts, fees, tax, deposits and warranty terms; deliver by email/text and retain exact issued versions and legacy history with original cent amounts and tax basis. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Finish a mixed US repair, issue and deliver the invoice, reopen a legacy export and verify each currency and total; corrected invoices reference their original. Email leg implemented; text delivery remains MSG-001, whose Twilio toll-free verification is in review. Financial corrections retain PAY-005 credit notes; issued-copy corrections preserve original financial amounts. Complete mixed sublet and pre-invoice deposit disclosure remain unproved. Standard-font PDF visible glyphs outside ASCII are substituted, with exact Unicode retained in ActualText and HTML and text copies. ct approved mallet-invoice-c30 on 23 Oct with the owner-only issue, private read and explicit audited email-consent default retained; one attempt per copy, no automatic retry, restored issue authority cannot send. INV-001 remains PARTIAL for the named remaining points.

### RL-6 — TAX-002 carried decision

**Date:** 2026-10-25  
**Ruled by:** ct  
**Governs:** TAX-002

**Source record:** Retain exemption or resale certificate, scope and expiry; configure shop supplies, disposal or environmental fees, discounts and legally permitted surcharges with visible basis and consent, and report tax collected by jurisdiction for filing. The owner may explicitly apply an in-date certificate to a new draft revision of its unchanged repair billing account; scope and inclusive UTC dates are checked at application, and earlier decisions and invoices stay frozen. Supplies rules retain discounted pre-tax parts or labor basis, a percentage in basis points, half-up cent rounding and a USD cap. The exact fee and basis are disclosed before recorded customer consent; the resulting draft still requires approval and customer authorization. Raw certificates stay private; issued documents disclose only the applied reference, jurisdiction, scope and dates. New product data inherits OPS-001 before shipping. The current filing-period preview uses inclusive UTC event dates and labels all unresolved credit transfers and redirected refunds for review. Owner-observed clearance is a private original-tender evidence record, not independent bank confirmation. With explicit current-owner original receipt evidence and jurisdiction legal-basis review, direct original-tender account credit reverses its source credit tax on the review UTC date; its destination invoice recognizes tax on the later application or review date, as a credit adjustment without new cash. Unattributed and nested credit sources remain excluded. A completed recorded manual refund after failed-refund redirection reverses the original tax once; incomplete outcomes do not. The legal filing treatment awaits ct approval under mallet-filing-i793. Deposit attribution uses the later invoice allocation or recorded clearance date and retains the original receipt date; no legal deposit-tax treatment or completed return is claimed. **Acceptance evidence:** Apply a fleet exemption and capped supplies fee, expire the certificate and refund a taxed line; invoice disclosures and jurisdiction tax report match the recorded rules. Explicit fleet exemption, configurable discount rules and capped supplies, disposal, environmental and owner-declared permitted surcharge rules are implemented. Cumulative collected-tax reporting now separates recorded cash and captured Stripe receipts from invoice tax, with proportional half-up allocation for partial receipts and exact completed-refund tax reversals. A dedicated inclusive-UTC filing-period preview now attributes cash deposit allocations to their invoice, separately discloses original receipt dates, records owner-observed check and other-tender bank clearance, allocates partial receipt tax with cumulative half-up cents and reverses completed original-tender refund tax. Filing preview exclusions retain their recorded UTC date and omit records after the selected period end; unresolved earlier records remain visible for review. Direct original-tender customer credits and failed-refund redirections now support explicit owner-reviewed original receipt mappings, separate source and destination tax credit adjustments, and completed manual-refund tax reversal. Unattributed or nested customer-credit sources remain excluded; PAY-007 returned-tender reversals remain unbuilt. ct approved the PARTIAL filing-treatment slice on 25 Oct 2026 at 19:03Z: current owner only with fresh confirmation, explicit original receipt evidence and owner-reviewed jurisdiction legal basis; source credit tax reverses on the review UTC date and destination tax is recognized on later application or review. The owner records the legal basis. Mallet gives no tax advice and files nothing. No new cash, automatic transfer, bank verification or legal filing claim is made. US sales-tax rules by state remain a named Gap. Approved observed-clearance and allocation-date semantics: current owner only with fresh confirmation, immutable private bank evidence, no provider verification, no automatic refund, transfer or filing. A deposit is attributed on allocation, or on later observed clearance, with original receipt date retained; this preview does not decide a jurisdiction’s legal deposit-tax rule. Fixed shop fees above the saved USD cap are refused, including previously saved rules; percentage fees use discounted pre-tax parts or labor with half-up cent rounding and a cap. Discounts apply to the remaining unit price after any existing unit discount, round half up to cents before quantity extension, then reduce the percentage fee and tax basis. ct approved the extended fee and discount policy on 24 Oct at 16:25Z: owner-only review of the legal basis, recorded customer consent, half-up rounding of each remaining unit price before quantity extension, tax and percentage fees (USD 0.005 rounds up), refusal of a fixed fee above the saved cap, frozen prior amounts, renewed approval and customer authorization, and no outbound action. A declared permitted surcharge records the owner’s legal basis; Mallet never verifies legal permission. The report labels unassigned jurisdictions, retains invoice-basis totals separately, and discloses unresolved collection attribution; it is not a completed tax return or legal filing advice. ct approved mallet-tax-c30 on 23 Oct; its owner-only private custody and immutable jurisdiction declarations remain. ct approved the c31 exemption and capped supplies application on 24 Oct at 14:50Z: owner-only explicit review, a current scoped certificate for the unchanged billing account, recorded customer consent, renewed approval and customer authorization; raw certificates remain private and prior amounts remain frozen, with no automatic repricing or outbound action. TAX-002 remains PARTIAL for the remaining named gaps.

### RL-7 — PAY-005 carried decision

**Date:** 2026-10-22  
**Ruled by:** ct  
**Governs:** PAY-005

**Source record:** Authorized staff issue partial/full refunds to original tender, credit notes, accessory exchanges and customer credits with reason, tax reversal and provider outcome; restrict amounts to refundable balance and track disputed or failed refunds. New product data inherits OPS-001 before shipping. Refund authority (ct 22 Oct 2026). Until GOV-001 ships, only the current owner previews, issues, applies and records refunds, credit notes and exchanges, and explicitly confirms each Stripe submission. GOV-001 then delegates bounded refund rights to manager, cashier and advisor roles and read access to the accountant, and GOV-004 adds refund step-up. Each credit is bounded by the exact reviewed invoice lines, quantities and uncredited recorded tender, and carries a staff-recorded customer instruction. Mallet never submits or retries a refund automatically. A pending or uncertain refund stays reserved until GET-only reconciliation resolves it. A refund the processor reports failed or canceled may be redirected once, by the owner, with a new staff-recorded customer instruction, to account credit on the same current account or to a staff-recorded manual tender; this releases exactly that reservation. Credit never moves between accounts. The payer sees typed amounts, methods and statuses only. **Acceptance evidence:** Refund a returned part, exchange an accessory and apply a credit to another RO; duplicate provider events cannot over-refund or change issued invoice history. Current native semantics: exact owner-reviewed credit notes retain immutable original invoices and saved exports; line quantities and recorded tender bound cumulative refunds and account credit. Original frozen pretax and tax cents are reversed by cumulative quantity with half-up rounding, so a full return reverses the exact original cents. Account-credit backing leaves the original paid balance and may be allocated once to an approved invoice of the same current account; an accessory exchange links returned parts to a separately authorized replacement invoice. Manual original-tender outcomes are owner-recorded, not money moved or verified by Mallet. A confirmed Stripe submission is claimed durably once; uncertain outcomes use GET-only reconciliation, and repeated provider outcomes cannot add another financial effect. Restores never submit refunds. Current payer sessions see typed amounts and statuses, not staff narratives or raw provider evidence. Also (ct 22 Oct 2026): a failed Stripe refund is redirected once to account credit and applied to another RO of the same account; a second redirect, a redirect of an uncertain refund, and a redirect to another account are refused; refunded plus credited never exceeds recorded tender. Refund authority, consent and recovery policy approved with change by ct (22 Oct 2026, be4ec20); the failed-refund redirection change is now built and asserted. GOV-001 now supplies bounded native credit and manual-refund rights and accountant finance reads under a conservative default pending ct approval; complete workflow delegation and reconciliation remain gaps. GOV-004 refund step-up is built (every credit and refund command needs a confirmation from the last five minutes). Native refund-authoring forms and signed provider-webhook intake are not built; Stripe outcomes use explicit owner reconciliation. An uncertain refund that reconciliation never matches has no in-product resolution and stays reserved. PAY-005 remains PARTIAL.

### RL-8 — AR-001 carried decision

**Date:** 2026-10-25  
**Ruled by:** ct  
**Governs:** AR-001

**Source record:** Offer approved commercial terms, credit limits and account statements, track ageing and promised payments, send consented reminders for unpaid or partial invoices and pause chasing disputed or paid balances. Owner-approved open terms must open RETURN-001 handover labelled “Released on account terms; balance due <date>”, retaining the exact account approval, invoice and due date. New product data inherits OPS-001 before shipping. Current native statements age current ledger balances at a selected UTC date; they are not historical balance snapshots. Net days run from the recorded invoice-terms assignment UTC date. Credit-limit review includes all approved outstanding invoices of the current payer. Promises suppress reminder eligibility through their promised date; open disputes and zero balances also suppress it. Terms, disputes and promises are append-only owner-reviewed records, ordered by retained ledger sequence. The current owner may explicitly release on reviewed active commercial terms, within the current credit limit, after fresh confirmation. The exact invoice revision, original assignment, current account approval and due date are retained with the handover; restored approvals cannot authorize destination release. Explicit owner-requested email balance reminders require the current billing contact’s email preference, exact current balance, fresh owner confirmation and per-send consent evidence. They request payment before or after the due date without asserting overdue status; disputed, paid and unexpired promised balances are suppressed. Each reference has one durable attempt, never automatic retry; mail acceptance means handed to the provider, not delivered. GOV-001 and GOV-004 inherit delegated reminder authority. **Acceptance evidence:** Issue two fleet term invoices, settle part of one by check, dispute the other and run reminders; only eligible outstanding balance is chased and statement totals match AR. Native owner-reviewed terms, credit limits, account statements, current-balance ageing, promised payments and dispute eligibility ship over the existing recorded-payment and same-payer deposit ledger. Explicit one-attempt balance reminders now use the current billing email preference, current outstanding amount, fresh owner confirmation and per-send recorded consent. No automatic chase or retry is introduced. AR-002 retains the separate scheduled-email slice as PARTIAL; complete sequences remain unbuilt. ct approved the PARTIAL reminder slice on 25 Oct 2026 at 19:03Z: manual reminders may request payment before or after the exact due date without claiming overdue status; disputed, paid and unexpired promised balances are suppressed, and mail acceptance is labelled handed to the provider, never delivered. The explicit current-owner open-terms handover gate now retains the exact invoice assignment, current active account approval and due date without recording payment. Approved native authority: current owner only, existing fresh-confirmation gate, explicit audited account instructions and terms consent, private native reads, no automatic outbound message or transfer. Source-owner terms cannot authorize new destination assignments after restore; the new owner must review terms again. Historical actor snapshots remain evidence only. GOV-001 inherits delegated finance authority; GOV-004 inherits finer-role confirmation.

### RL-9 — PORTAL-001 carried decision

**Date:** 2026-10-22  
**Ruled by:** ct  
**Governs:** PORTAL-001

**Source record:** Customers securely view their own asset service history, inspection, current status/promise, exact estimates, decisions, invoice/payment history and warranty, ask questions and book follow-up; scoped links and account sessions prevent guessing or cross-customer access. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Sign in as a household and fleet payer, review two visits and pay one invoice; try another customer’s IDs and expired links and receive no private data. Customer sign-in (ct 22 Oct 2026). A customer requests an email link and confirms the request. Every request gets the same response and timing; requests are limited per address and client. Links are single-use, expire in 15 minutes and sign in only after confirmation on the opened page. Each sign-in starts a separate account session that ends after 24 hours, at sign-out, or when the contact, its version, its account membership or the payer changes. SMS sign-in arrives with MSG-001. Customer account sign-in and payer-only approved invoice, balance, statement and payment history ship as the CUS-001 prerequisite. Repair status/promise, inspections, estimates/decisions, warranty, questions, follow-up booking, complete two-visit history and customer payment initiation remain unbuilt. SMS sign-in links (MSG-001) and portal payment initiation are not built. Both clauses stay PARTIAL per ct batch-11 D.  The per-address and per-client request limits are disclosed implementation values, not contract policy. Session membership revocation and exact 24-hour server expiry gaps from ct 22 Oct 2026 are now asserted; status remains PARTIAL.

### RL-10 — AUTO-001 carried decision

**Date:** 2026-10-26  
**Ruled by:** ct  
**Governs:** AUTO-001

**Source record:** Send confirmations, pre-visit instructions and time-based reminders via chosen email or SMS channel, including reschedule or cancel links, local shop time and quiet hours; stop replaced or canceled appointments and record failed delivery for staff. Conservative interim email default (ct APPROVE WITH RIDERS, 26 October 2026, mallet-outreach-i817): only the fresh-confirmed current owner may explicitly approve and schedule one email. Broader advisor and staff scheduling rights remain part of the target and a named Gap under GOV-001. Customer consent and owner send approval are separate records. Consent identifies the customer and recipient address, email channel, permitted purpose, related appointment or declined item, exact consent wording and wording version, customer consent time with timezone or UTC offset, capture time, capture channel, source evidence reference and recording actor. An affirmative customer form choice, customer email or documented telephone or in-person permission may supply the evidence. Silence, a preselected choice, a stored address, prior business and repair authorization do not establish outreach consent.

Owner approval binds the exact recipient, message content and template version, appointment or declined-item revision, consent evidence, recipient IANA timezone, allowed hours, scheduled instant and absolute expiry. Material changes invalidate the approval. Expiry is no later than 31 elapsed days after approval; it is a maximum send-authority lifetime, not permission for repeated contact or a retention period. The one-email limit applies across all cron invocations, restarts and repeated DST hours. Another email requires a fresh explicit owner approval and still-valid customer consent covering that email; renewed owner approval cannot override customer withdrawal.

Allowed hours use the recipient’s recorded IANA timezone. The first hour is included and the last excluded; overnight windows wrap midnight. Equal start and end hours grant no send window. Each cron evaluates its scheduled instant using the IANA offset applicable to that instant, including both occurrences of a repeated DST hour. A nonexistent local time is not invented. Before handoff, current time, expiry, consent, suppression, appointment or finding eligibility and current owner authority are rechecked; delayed execution cannot send outside allowed hours or after expiry. Unknown timezone, ambiguous permission or missing eligibility blocks the send for staff review. Messages also identify the appointment’s local shop time and timezone.

A durable claim precedes provider handoff. An interrupted claim becomes uncertain; failed or uncertain sends never retry automatically. Staff can inspect the related appointment or item, exact approved message, claim and attempt times, provider reference when available, outcome and recovery action without exposing credentials. Provider acceptance means handoff, never confirmed delivery; development suppression is also separate. Failure or uncertainty remains visible until a person records a resolution. Any later attempt needs fresh explicit approval after human resolution and a renewed eligibility check.

A recorded opt-out immediately suppresses affected pending and future outreach across manual, scheduled and agent sends under MSG-004. Owner stop can record a customer’s opt-out, booking or other applicable stop reason, but owner approval cannot undo customer withdrawal. Customer self-service opt-out remains a named Gap until proved. Consent, approval, suppression, stop, outcome and resolution history retain actor, time, exact versions, policy and evidence references; corrections append rather than replace prior decisions.

OPS-001 preserves eligible consent and outcome history, subject to DATA-001 and GOV-006 erasure and hold rules. Installation-local send authority, runnable reminder authority, booking reminder tokens and credentials are excluded from restoration. Nothing sends after restore from archived approvals or consent records; fresh destination authority and a new explicit approval are required, with current consent and suppression rechecked. Historical attribution never grants authority. Erasure must stop affected pending outreach, preserve only records required by the existing custody and hold rules, and retain the existing older-archive erasure fences. This policy does not introduce automatic deletion or a new retention schedule.

Appointment consent rider: an affirmative request for one appointment confirmation permits that confirmation only. Later reminders and pre-visit instructions require affirmative permission identifying the appointment, email channel and intended message purpose. Permission for appointment service messages does not permit declined-work or promotional outreach. Immediate booking confirmations retain BOOK-001 behavior. Replaced or canceled appointments suppress affected pending reminders. The complete target retains customer-chosen email or SMS, reminder series, reschedule and cancel links, local shop time, quiet hours and failed-delivery visibility. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Book, reschedule and cancel appointments around a US DST change and run the scheduler; only current eligible reminders arrive, in the recipient’s allowed hours. Email reminder slice only. Recurring reminder configuration, channel selection, SMS under MSG-001, customer self-service reminder opt-out and the complete reminder acceptance journey remain unbuilt or unproved. Immediate booking confirmations retain BOOK-001 behavior. Broader advisor and staff scheduling rights remain a named Gap under GOV-001. The conservative email default is ct APPROVE WITH RIDERS on 26 October 2026 under mallet-outreach-i817; complete consent provenance, execution-time eligibility, suppression, failure resolution, audit, erasure and inert-restore evidence for these riders remains unverified by this policy review. AUTO-001 remains PARTIAL.

### RL-11 — AUTO-004 carried decision

**Date:** 2026-10-26  
**Ruled by:** ct  
**Governs:** AUTO-004

**Source record:** Schedule advisor-approved follow-up by declined item, urgency, mileage or time and expiry, refresh price and availability before outreach, and stop on acceptance, repeat decline, opt-out or a finding no longer applicable. Conservative interim email default (ct APPROVE WITH RIDERS, 26 October 2026, mallet-outreach-i817): only the fresh-confirmed current owner may explicitly approve and schedule one email. Broader advisor and staff scheduling rights remain part of the target and a named Gap under GOV-001. Customer consent and owner send approval are separate records. Consent identifies the customer and recipient address, email channel, permitted purpose, related appointment or declined item, exact consent wording and wording version, customer consent time with timezone or UTC offset, capture time, capture channel, source evidence reference and recording actor. An affirmative customer form choice, customer email or documented telephone or in-person permission may supply the evidence. Silence, a preselected choice, a stored address, prior business and repair authorization do not establish outreach consent.

Owner approval binds the exact recipient, message content and template version, appointment or declined-item revision, consent evidence, recipient IANA timezone, allowed hours, scheduled instant and absolute expiry. Material changes invalidate the approval. Expiry is no later than 31 elapsed days after approval; it is a maximum send-authority lifetime, not permission for repeated contact or a retention period. The one-email limit applies across all cron invocations, restarts and repeated DST hours. Another email requires a fresh explicit owner approval and still-valid customer consent covering that email; renewed owner approval cannot override customer withdrawal.

Allowed hours use the recipient’s recorded IANA timezone. The first hour is included and the last excluded; overnight windows wrap midnight. Equal start and end hours grant no send window. Each cron evaluates its scheduled instant using the IANA offset applicable to that instant, including both occurrences of a repeated DST hour. A nonexistent local time is not invented. Before handoff, current time, expiry, consent, suppression, appointment or finding eligibility and current owner authority are rechecked; delayed execution cannot send outside allowed hours or after expiry. Unknown timezone, ambiguous permission or missing eligibility blocks the send for staff review. Messages also identify the appointment’s local shop time and timezone.

A durable claim precedes provider handoff. An interrupted claim becomes uncertain; failed or uncertain sends never retry automatically. Staff can inspect the related appointment or item, exact approved message, claim and attempt times, provider reference when available, outcome and recovery action without exposing credentials. Provider acceptance means handoff, never confirmed delivery; development suppression is also separate. Failure or uncertainty remains visible until a person records a resolution. Any later attempt needs fresh explicit approval after human resolution and a renewed eligibility check.

A recorded opt-out immediately suppresses affected pending and future outreach across manual, scheduled and agent sends under MSG-004. Owner stop can record a customer’s opt-out, booking or other applicable stop reason, but owner approval cannot undo customer withdrawal. Customer self-service opt-out remains a named Gap until proved. Consent, approval, suppression, stop, outcome and resolution history retain actor, time, exact versions, policy and evidence references; corrections append rather than replace prior decisions.

OPS-001 preserves eligible consent and outcome history, subject to DATA-001 and GOV-006 erasure and hold rules. Installation-local send authority, runnable reminder authority, booking reminder tokens and credentials are excluded from restoration. Nothing sends after restore from archived approvals or consent records; fresh destination authority and a new explicit approval are required, with current consent and suppression rechecked. Historical attribution never grants authority. Erasure must stop affected pending outreach, preserve only records required by the existing custody and hold rules, and retain the existing older-archive erasure fences. This policy does not introduce automatic deletion or a new retention schedule.

Declined-work consent rider: follow-up requires separate affirmative customer permission for email about the identified declined item; appointment-message permission and repair authorization do not supply it. The interim approval permits one email for that item. The complete target retains advisor-approved scheduling by item, urgency, mileage or time and expiry, refreshed price and availability before outreach, and cessation on acceptance, booking, repeat decline, opt-out or a finding no longer applicable. Previous repair and consent decisions remain unchanged. Automatic booking linkage, current availability revalidation and the complete stop workflow remain named Gaps until proved. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Decline brakes, later record eligible mileage, approve a refreshed quote and send follow-up; booking or approval stops the cadence and preserves previous decisions. One explicitly approved email per declined item only. Automatic booking linkage and suppression, customer self-service opt-out, recurring cadence, finding-no-longer-applicable workflow and fresh availability revalidation immediately before outreach remain unbuilt or unproved. Current quote changes and repeat customer decisions stop the saved follow-up; owner stop records booking, opt-out or inapplicability. Broader advisor and staff scheduling rights remain a named Gap under GOV-001. The conservative email default is ct APPROVE WITH RIDERS on 26 October 2026 under mallet-outreach-i817; separate declined-work consent provenance, execution-time eligibility, suppression, failure resolution, audit, erasure and inert-restore evidence for these riders remains unverified by this policy review. AUTO-004 remains PARTIAL.

### RL-12 — REPORT-002 carried decision

**Date:** 2026-10-26  
**Ruled by:** ct  
**Governs:** REPORT-002

**Source record:** Show gross profit and margin by repair, parts/labor/sublet, technician, advisor, service, supplier and location using actual purchase cost, loaded labor, discounts, core/refund adjustments and warranty rework; distinguish estimated from realized margin. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Receive a higher-cost part, finish a discounted repair and a comeback, then compare estimated/realized margins and source cost events.

Current native semantics (i925; ct APPROVE WITH RIDERS, 26 October 2026): only the current owner reads profitability or declares versioned loaded hourly costs; other roles receive neither loaded rates nor profitability. The report selects repairs by inclusive UTC booking dates and derives estimated and realized pretax values from retained native sources. Loaded rates are separate from payroll wages. Missing cost evidence leaves profit unavailable. The declared basis, allocation, refund and warranty rules are documented in `docs/profitability.md`; no money, outbound action or accounting posting is performed.

**CT ruling, 26 October 2026 — APPROVE WITH RIDERS; REPORT-002 remains PARTIAL.** Personal-owner-only profitability access and explicit owner-declared loaded hourly costs are approved as the current slice. Each rate revision retains its effective UTC date, USD-cent amount, basis, reason, actor and timestamp; earlier revisions remain inspectable. A dated correction may recompute the current repair-cohort projection, whose selection dates and calculation basis remain visible, without rewriting source invoices, approved timer history, published results or accounting records. Missing cost remains unavailable rather than zero. Estimated and realized margin remain distinct, with actual received costs, discounts, credits, refunds and warranty recovery reconciled once. Report access grants no send, purchase, payment, payroll or accounting-posting authority. GOV-001 retains explicit scoped advisor and manager margin access with separately controlled cost detail as unfinished work; SHOP-001 retains multi-location operation. The complete profitability target and OPS-001 portability remain binding. This ruling accepts no completion.

**Remaining REPORT-002 scope and proof:** Complete location comparison awaits SHOP-001. Purchase freight and supplier-tax allocation, mixed-supplier sales allocation and complete historical service-package attribution remain unproved. The full acceptance sentence remains open for those cost and comparison cases despite the asserted native higher-cost, discount and comeback journey. GOV-001 retains the missing delegated profitability permissions; REPORT-002 must prove their application when available. Direct proof of complete rate-change audit content and contrasting effective-date selection cases remains incomplete. Existing native report, source, recomputation and fresh-owner recovery assertions retain their stated scope. REPORT-002 remains PARTIAL. No clauses are carved.

27 October 2026 native progress (i925): the existing higher-cost and comeback journey now also asserts reconciled purchase freight and supplier tax by received line value, receipt quantity and net consumed lot-family quantity, including unused inventory and fractional returns; mixed-supplier sales reconcile by traced quantity. Retained priced-package snapshots keep their original service revision after a later rename. The same journey asserts complete dated rate declarations with original actor and audit references, contrasts earlier, later and equal-effective-date revisions, preserves invoices and approved time history, and recovers the projection under fresh authority. The ct remaining-work paragraph above is retained verbatim as the 26 October ruling; these later assertions close its named native allocation and rate-proof gaps only. Complete historical package attribution without retained source links remains unavailable. Location comparison remains SHOP-001, excluded from this campaign by its plan; delegated margin access remains GOV-001 and must be asserted when that door exists. REPORT-002 remains PARTIAL; no acceptance point is removed. Location comparison remains unbuilt under SHOP-001, explicitly excluded by this campaign plan. Historical service-package attribution without a retained native source link remains unavailable; no link is invented. Purchase-linked freight and supplier tax now allocate only from reconciled current bills; standalone unrecorded charges remain unavailable. Delegated advisor and manager margin access remains unfinished under GOV-001 and REPORT-002 must assert its application when available. Ct APPROVE WITH RIDERS, 26 October 2026, is retained verbatim with the target. REPORT-002 remains PARTIAL; no acceptance point is removed.

### RL-13 — REPORT-004 carried decision

**Date:** 2026-10-25  
**Ruled by:** ct  
**Governs:** REPORT-004

**Source record:** Report cycle time and time in each stage, overdue promises, wait-for-parts/approval causes, booking no-shows, DVI completion/engagement and warranty comeback rates; compare locations and periods with retained history. New product data inherits OPS-001 before shipping. Current report semantics: `/api/mallet/reports/turnaround?from=YYYY-MM-DD&to=YYYY-MM-DD` selects repairs by booking creation in an inclusive UTC date range. Durations are integer milliseconds. Cycle time is booking creation to actual completion, absent until completed; stage time continues until cancellation/loss or both collection and invoice export, otherwise the report time. Completion variance is actual completion minus the promise in force at completion (negative is early). Stage transitions retain their triggering native events atomically with the command; only observed history is reported, and older repairs without booking-stage evidence are explicitly incomplete rather than backfilled. The report follows existing workshop job visibility; its stage evidence inherits OPS-001. Booking attendance is an immutable current-owner observation after a confirmed appointment starts; unknown attendance is excluded from the no-show denominator. DVI completion uses the latest recorded result for each point on assigned snapshots in the booked-repair cohort. Engagement is reviewed reports with at least one page request, with repeated requests counted separately and no verified-human claim. Comebacks count completed repairs in the booked cohort with at least one retained warranty case, including later cases; multiple cases count the original repair once. Ratios use half-up tenths of a percent and absent denominators remain unavailable. The native report retains existing job visibility; members receive no appointment, report-view or warranty custody. Location comparison remains SHOP-001. **Acceptance evidence:** Run repairs with controlled waits and a comeback, then drill the delay report and promised-versus-actual completion to the exact stage events. Native stage waits, promises, observed booking no-shows, DVI completion, page-request engagement, warranty comeback rates and report drill-through now ship. Older stage history remains explicitly incomplete; location comparison is still SHOP-001. ct 25 Oct 20:55Z: REPORT-004 approved PARTIAL as adopted (current-owner-only immutable observation after appointment start, unknown excluded, no inferred no-show or charge). Rider: a correction is a new observation with reason, never an edit. Existing private staff read scope and no automatic message remain. The existing booking API and native report journeys prove reasoned append-only corrections, immutable original observations and recomputed no-show metrics. REPORT-004 remains PARTIAL for location comparison.

### RL-14 — REPORT-006 carried decision

**Date:** 2026-10-25  
**Ruled by:** ct  
**Governs:** REPORT-006

**Source record:** Save report filters, schedule permission-scoped email delivery, export CSV/XLSX and documented API datasets, and use migrated history in reports with explicit provenance/coverage rather than silently starting at cutover. New product data inherits OPS-001 before shipping. Personally saved filters retain fixed inclusive UTC dates and never grant report access. JSON, CSV and XLSX downloads use the same current permissions; XLSX contains data cells without formulas. Current-owner schedules require fresh confirmation and explicit recorded recurring consent, send CSV only to that owner’s unchanged native email, and recheck active owner role, account version and address per occurrence. One durable claim prevents replay; failed or uncertain handoff disables future delivery. Local schedule authority is excluded from archives; restored consent and delivery receipts are evidence only. Delivery receipts retain a SHA-256 hash rather than another copy of private report contents. Base mail acceptance is labelled handed to the provider, never delivered. **Acceptance evidence:** Schedule a location manager’s report and export the same period; totals include reconciled imported history, and revoked recipients lose report access. Native personally saved filters, JSON, formula-safe CSV and XLSX exports and explicit owner-to-self scheduled CSV Base mail handoffs now ship. ct 25 Oct 20:55Z: REPORT-006 approved PARTIAL as adopted (fresh-confirmed owner-to-self recurring mail, role, version and email rechecked per send, one claim, no retry, uncertain handoff disables). Rider: the owner sees last-sent time, outcome and an off switch on the same screen. Personal filters confer no authority and restored schedules confer none. The existing report API and native journeys prove actual attempt time, outcome and a working off switch on the same screen. Location-manager scheduling remains GOV-001 and SHOP-001; reconciled imported-history provenance and completeness remain MOVE-009 through MOVE-013 and require authorized source evidence. No delivery or migrated-history completeness claim is made. REPORT-006 remains PARTIAL.

### RL-15 — API-001 carried decision

**Date:** 2026-10-27  
**Ruled by:** ct  
**Governs:** API-001

**Source record:** Offer versioned scoped APIs for customers/assets, bookings, inspections, estimates/decisions, ROs, parts/orders, work and finance with pagination, stable external IDs, idempotent writes and per-action authorization; API parity enables custom inventory tools without a second product. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Using a scoped client follow a repair from intake through receipt, retry a write and page history; the client cannot approve or view money without its explicit capability.

**Authority ruling — ct 27 October 2026: APPROVE WITH RIDERS; API-001 remains PARTIAL.** A current owner using a native session and fresh privileged-action confirmation under GOV-004 may create and revoke installation-local API clients. Grants explicitly select resource-read or existing AGENT-001 preparation scopes; empty, unknown and wildcard grants are refused. Expiry defaults to 24 hours and accepts only integer values from 1 through 720 hours. Each read, write and retry rechecks current authority; expiry, revocation or loss of the issuing owner’s authority ends access. This slice grants no financial-read or decision capability and does not broaden AGENT-001 preparation authority.

Owner-only client management and the absence of financial-read and decision capabilities are interim implementation limits, not exclusions from API-001. Required follow-on work includes audited, revocable delegation to authorized shop staff and integrations, bounded renewal or rotation, usable order and inventory reads, and separately scoped receiving, allocation and fulfilment writes. Grants must enforce installation, resource and action boundaries and applicable location boundaries. Future financial reads and decisions require separate explicit capabilities and preserve exact customer consent, current revisions and provider authority.

Client tokens, token hashes, grants and retry receipts are excluded from archives and restoration. Restored product records, stable external IDs and historical attribution confer no authority. A fresh destination owner must issue new grants, and pending integrations must reconcile retained product state before resubmitting work; cross-restoration retry deduplication is not claimed. API-001 remains PARTIAL. The current slice provides versioned resource projections and idempotent retries for four preparation commands. Complete target-resource and write parity, inspection, work and finance APIs, explicit financial-read and decision capabilities, usable stock balances and location quantities, receiving, allocation and fulfilment writes, delegated client management and bounded renewal remain unbuilt or unproved. The complete scoped-client intake-to-receipt acceptance journey and sentence-level assertions, mutations and exact-SHA Verify evidence remain unestablished. The conservative authority default is approved with ct’s 27 October 2026 riders; this approval completes no acceptance sentence. API-provider eligibility, authorized account access, permitted data use and real provider acceptance wherever required remain named external boundaries and required delivery work, never scope exclusions.

### RL-16 — GOV-001 carried decision

**Date:** 2026-10-25  
**Ruled by:** ct  
**Governs:** GOV-001

**Source record:** Owners control settings, access and money policies; location managers run their shop; advisors handle intake/estimates/communications within discount limits; technicians see assigned work and record findings/time/actuals; purchasers manage stock/POs under spend limits; cashiers collect/refund under limits; accountants read/reconcile/export finance. Cost/payroll views and destructive actions require separate rights, enforced at every transport. **Acceptance evidence:** Exercise each role through page, form, API and downloads, exceed discount/refund/spend limits and access another location; require refusal without writes and verify authorized handoffs.

REPORT-002 inheritance: GOV-001 retains explicit scoped advisor and manager margin access with separately controlled cost detail; REPORT-002 must prove its application when those doors ship. AUTO-002 retains delegated status-message approval and staff contact resolution under explicit communication grants. Advisor, manager, purchaser, cashier and accountant roles with complete limits and location and cost rights remain a named Gap. Native grants cover this installation’s shop and an explicit subset of commands; full intake and communication delegation, accountant reconciliation, delegated destructive rights and multi-shop operation under SHOP-001 remain unbuilt or unproved. ct approved the PARTIAL local-grant slice on 25 Oct 2026 at 18:25Z: only the current owner with fresh confirmation grants or revokes local version-bound rights; zero default limits (a grant with no limit allows no delegated door or command), separate cost right, deny unlisted doors and other locations, no delegated outbound provider submission, and no restored grants. Refunds remain native recorded outcomes with fresh confirmation and bounded authority; connected submissions and redirection stay owner-only. No acceptance point is removed.

### RL-17 — GOV-002 carried decision

**Date:** 2026-10-25  
**Ruled by:** ct  
**Governs:** GOV-002

**Source record:** Maintain durable searchable/exportable audit of login/access changes, prices, approvals/consent, dispatch, stock, time corrections, money actions, imports and agent sends with actor, timestamp, before/after revision, policy and evidence; corrections append and private secrets never enter audit. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Perform a discount override, stock correction, refund and agent proposal, revoke the actor and export audit; exact prior decisions remain attributable and secrets are absent.

Current native governance semantics (ct approved PARTIAL slices, 25 Oct 2026 at 18:25Z): delegation is granted only by the current owner after fresh confirmation, to an active native member, with exact operator and grant versions checked on every write. Grants are local credentials excluded from archives. The staff workspace denies every unlisted door; the existing technician workspace and legacy owner and admin authority remain. Discounts are explicit unit discounts in basis points; revision price reductions are bounded against the original line’s base price, not compounded across edits. Purchase spend and native refund limits are whole USD cents per operation. Purchase commands also need the separate cost-view right. Finance writes require the person’s own fresh confirmation. Only this installation’s shop is grantable; a named different location is refused. SHOP-001 inherits complete location identity and isolation, and CUS-001, PAY-005, GOV-004 and every future staff workflow inherit explicit permission and fresh-authority checks before their new doors ship. The audit stores structured revision and evidence references atomically with native command changes; authentication decisions and import batches retain private actor snapshots, not credentials or raw command bodies. Search dates include whole UTC days; JSON and CSV exports contain the selected page of at most 100 entries and preserve the filters. Audit-only writes do not invalidate an otherwise unchanged business review. Legacy events and retained decision records remain the source of their original evidence; this round does not claim historical backfill or complete login coverage. Complete historical backfill remains unbuilt or unproved, including initial empty-installation login history; other specialist direct-write revision coverage remains unbuilt or unproved. Owner-configured minimum audit retention is a label only, with no timer or deletion and preserved owner export; the ct 25 October private-custody and no-deletion ruling is retained. Ordinary email-link login, exact media finding and upload transition revisions and durable provider-job state references are now asserted. Delegated auditor access stays with GOV-001. GOV-002 remains PARTIAL; no acceptance point is removed.

### RL-18 — GOV-004 carried decision

**Date:** 2026-10-22  
**Ruled by:** ct  
**Governs:** GOV-004

**Source record:** Support passkeys/MFA, privileged-action step-up and owner-required policy, protect session recovery and scoped customer links with expiry/revocation/rate limits, and require payer identity appropriate to the information/action shown. **Acceptance evidence:** Require a second factor, recover an owner, attempt a stolen expired approval link and step up a refund; invalid attempts reveal no customer history or authority.
 Current native semantics (sx c27; ct 22 Oct 15:55Z approved c26 with the following riders, none adds an acceptance point): a person may enrol authenticator-app (RFC 6238) and passkey (WebAuthn ES256, user verification required) second factors with eight single-use recovery codes; once enrolled, every new sign-in of that person must confirm before any Mallet page, API, media or Base `/auth` account route opens, and the first factor ends their other sessions. The owner may require a second factor of every person (default: optional, off). New-install setup prompts the owner to enrol their own factor. A person without a factor must freshly sign in to confirm the same privileged actions; an old cookie or initial setup is never a silent pass. A confirmation lasts five minutes on its own session and gates refunds and credits (PAY-005), the unpaid-release exception (RETURN-001), agent-key creation, asset erasure and custody-secret reveal; an agent key never holds one. Owner recovery is a recovery code or the deployment's one-time `rer signin` link, which may only reset the owner's own factors; no email-only reset exists. Recovery is audited and notifies every other active owner/admin in Security and with one email whose outcome is audited. Confirmation guesses are paced (eight misses per person per fifteen minutes) and customer-link misses per client and door (twenty per fifteen minutes); every customer-link door shows an unknown, revoked or expired link the same page; appointment-status access lapses a day after the appointment and staff can withdraw it; the existing appointment-management authority class remains a named Gap below. Approval links are single-purpose and revocable; decision consumes their authority, and access lapses at most seven days after creation. Payment links, when built, inherit that same seven-day-or-use ceiling. GOV-001 inherits delegating step-up to finer roles; GOV-003 inherits that provider sessions still owe the factor when the owner requires it; every later command that moves money or standing authority (PAY-007, BOOKS-001–003, MONEY-001, API-001–002) joins the step-up set before shipping. ct 22 Oct 15:55Z APPROVED AS LANDED with riders: fresh sign-in step-up for people without factors, new-owner enrolment prompt, audited recovery notices to other owners/admins, approval authority capped at seven days or use, and invalid links reveal no customer history. GOV-004 stays PARTIAL: GOV-003 enterprise SSO/SCIM/provider-session policy is missing, payment-link authority is not implemented or proved; appointment-management authority still needs a separate seven-day/single-use fence from its 24-hour-after-appointment read-only status link. That booking/waitlist link class touches BOOK-002, explicitly owned by ct in this round, and remains unproved here. Finer-role step-up belongs to GOV-001. Physical-device passkeys are not proved (software and Chromium virtual authenticators are proved).

### RL-19 — GOV-005 carried decision

**Date:** 2026-10-22  
**Ruled by:** ct  
**Governs:** GOV-005

**Source record:** Encrypt/restrict provider secrets, rotate/revoke least-privilege grants, redact logs and exports, validate signed webhook origin and isolate private media with authorized short-lived access. Publish each connector’s data flow and licensing/retention obligations before enablement. New product data inherits OPS-001 before shipping. **Acceptance evidence:** Rotate a supplier/payment credential, replay a bad-signature webhook and request another customer’s media; deny access and inspect logs/archive for secret absence.
 Current native semantics (sx c27; ct 22 Oct 15:55Z approved c26 with the following riders, none adds an acceptance point): provider credentials the owner saves in Mallet are sealed (AES-GCM, key derived from the installation secret, bound to connector and name), shown only as a short fingerprint, and replace the deployment's own binding; revoking one makes it unavailable to every provider call even while the binding remains. Only an owner with an enrolled factor can save, rotate or revoke one, behind a fresh second-factor proof (GOV-004) and after acknowledging the connector's published declaration version. Agent keys rotate in one step (new key created, old revoked). Stripe, Pier and email-delivery-event credentials rotate in product; the email sending key stays a deployment secret. The only signed webhook door today is the email delivery event intake, which accepts only the current signing secret, a fresh timestamp and a message and recipient Mallet itself sent; any future provider webhook (Stripe, PAY-005) inherits the same fence. Private media is served only to a live staff session with the job's rights or through a customer link scoped to the reviewed set, whose link defaults to at most seven days (only the owner may extend it, to the 31-day ceiling). A scoped media link opens a separate five-minute authorized byte URL; the parent link and exact reviewed file are rechecked on every read. Staff sessions last at most seven days; every media response is private and uncached. `/connectors` publishes each connector's data flow, retention, licence and access before it is enabled. Credentials and sealed values are excluded from archives (OPS-001). ct 22 Oct 15:55Z APPROVED AS LANDED with riders: owner enrolment before credential management, sealed secrets never read back and absent from logs/exports/archives, five-minute authorized media-byte URLs, revocable media links defaulting to seven days with owner extension up to 31 days, and bad-signature webhooks change nothing. GOV-005 stays PARTIAL until data-flow and licensing declarations are published and confirmed for every enabled connector. The deployment-secret email sending key cannot be rotated or revoked in product (named Gap). Future Stripe webhook intake belongs to PAY-005.

### RL-20 — API-001 prior authority record

**Date:** 2026-10-27  
**Ruled by:** ct  
**Governs:** API-001

CT verdict: APPROVE WITH RIDERS; API-001 stays PARTIAL. Reviewed candidate
cf0c0e4278f4e200e74208f5e03eebe1d73a5687 against main
ef1213e14df9f110df7889445c1d6f7bf2c39785. Source ruling:
sx plan document ct-ruling-mallet-api001.md, supplied with this assignment.

The authority ruling recorded immediately after API-001 in CONTRACT.md is
additive. The original target and acceptance sentence remain unchanged.
Fresh-confirmed current-owner client management, explicit read and preparation
grants, bounded expiry and inert credential recovery are an interim floor.
Delegated management, bounded renewal, usable inventory and order data,
fulfilment writes and separate financial and decision capabilities remain
required work. Approval establishes policy, not implementation completion,
provider acceptance or a completed intake-to-receipt journey.

The API-001 Status Gap retains the exact replacement wording supplied by CT.
Generated contract indexes follow CONTRACT.md.

### RL-21 — Fleet billing split

**Date:** 2026-10-25, 20:55 UTC
**Ruled by:** ct
**Governs:** FLEET-001, FLEET-002

**Source record:** FLEET-002 was split from FLEET-001 by ct at 20:55 UTC on 25 October 2026. Its source record said “Not implemented.” The billing and statement target remains owed at missing; the split grants no implementation status.

### RL-101 — AR-002: Scheduled and automated balance-reminder sequences

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** AR-002  
**Outcome:** adopt with rider

**Question:** May one explicitly approved current-balance email run under bounded consent without unattended repeated chasing?

**Default proposed/adopted:** Exact-balance one-email approval, current preference, IANA allowed hours, 31-day expiry, durable claim, current suppression and inert restore.

**Clause outcome:** Send only the approved current-balance reminder under current recipient consent and suppression, with explicit recovery for failed or uncertain handoff and no restored sending authority.

**Why:** Tekmetric previews selected A/R balances before sending and cancels stale marketing reminders; no common norm specifies the proposed 31-day expiry or retry algorithm, which are local protective limits. Compared Tekmetric's configured scheduling/sending with Shopmonkey's staff-selected reminders; neither documents this exact waitlist/retry/capability algorithm.

**Placement:** AR-002 owns the send rule; full versioned sequences, consent provenance, staff tasks and uncertainty resolution remain acceptance work.

**Sources:** [Tekmetric lets staff select balances and preview statement emails.](https://support.tekmetric.com/hc/en-us/articles/360048518993-Accounts-Receivable); [Tekmetric configures follow-up messages and Google or private feedback.](https://support.tekmetric.com/hc/en-us/articles/33212380922007-Marketing-Automations); [Shopmonkey lets staff choose recipients, templates and scheduled reminders.](https://support.shopmonkey.io/hc/en-us/articles/38743042626452-Appointment-Confirmation-Reminders).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:587`. No status change; all unfinished acceptance and proof remain owed.

**Application carried from main (28 October 2026):** Human review in this revision records the exact retained handoff and its evidence without changing the provider outcome, balance, schedule, retry eligibility or sending authority. Broader automatic chasing remains outside the approved bounded rule.

### RL-102 — AUTO-005: Review and satisfaction requests

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** AUTO-005  
**Outcome:** adopt with rider

**Question:** May one consented post-handover review invitation offer every customer the same public review path?

**Default proposed/adopted:** Fresh owner confirmation, separate affirmative review permission, one email per paid handover, equal invitation across ratings and private feedback.

**Clause outcome:** Use one separately consented review invitation per eligible handover, offering the same public-review option regardless of rating, with current withdrawal suppression and no automatic resend.

**Why:** Tekmetric offers Google and private feedback through its review-request automation. The owner-only one-message and seven-day capability restrictions are conservative local safeguards, not universal incumbent settings. Compared Tekmetric's configured scheduling/sending with Shopmonkey's staff-selected reminders; neither documents this exact waitlist/retry/capability algorithm.

**Placement:** State equal access and suppression once in AUTO-005 and cite MSG-004 for sending; delegated staff capability remains owed under GOV-001.

**Sources:** [Tekmetric configures follow-up messages and Google or private feedback.](https://support.tekmetric.com/hc/en-us/articles/33212380922007-Marketing-Automations); [Shopmonkey lets staff choose recipients, templates and scheduled reminders.](https://support.shopmonkey.io/hc/en-us/articles/38743042626452-Appointment-Confirmation-Reminders).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:602`. No status change; all unfinished acceptance and proof remain owed.

### RL-103 — BOOK-002: Resource calendars and waitlist

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** BOOK-002  
**Outcome:** adopt with rider

**Question:** May cancellation offers use recorded customer permission, FIFO matching and one staff-reviewed expiring offer?

**Default proposed/adopted:** Owner/admin records the request and one-off email permission; matching FIFO offers require explicit review; no automatic retry or advance.

**Clause outcome:** Use the recorded-permission, matching-FIFO waitlist with one bounded staff-reviewed offer; expiry, failed or uncertain handoff requires explicit staff recovery and grants no repair or payment authority.

**Why:** No common norm: Tekmetric documents configurable capacity and staff booking, but not this exact FIFO, expiry or retry algorithm; those details are the safest local default, not claimed incumbent parity. Compared Tekmetric's configured scheduling/sending with Shopmonkey's staff-selected reminders; neither documents this exact waitlist/retry/capability algorithm.

**Placement:** State the offer rule once in BOOK-002; preserve every resource, dispatch, recurring-date and DST obligation.

**Sources:** [Tekmetric exposes booking capacity and minimum lead-time settings.](https://support.tekmetric.com/hc/en-us/articles/42119797991703-Manage-and-Customize-Online-Booking-Settings-in-Tekmetric); [Tekmetric grants payment, report and account-management permissions separately.](https://support.tekmetric.com/hc/en-us/articles/360037201874-Employee-Permissions); [Shopmonkey lets staff choose recipients, templates and scheduled reminders.](https://support.shopmonkey.io/hc/en-us/articles/38743042626452-Appointment-Confirmation-Reminders).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:530`. No status change; all unfinished acceptance and proof remain owed.

### RL-104 — DIAG-002: Specialist diagnostics connections

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** DIAG-002  
**Outcome:** adopt with rider

**Question:** May a private diagnostic result be imported and inspected without automatically sharing or authorizing repair?

**Default proposed/adopted:** Owner-only explicit private result import and inspection with original bytes and mismatch quarantine.

**Clause outcome:** Keep diagnostic originals private under current resource permissions, quarantine identity mismatches and require a separately authorized sharing, repair or payment action.

**Why:** Tekmetric separates inspection and customer permissions; no common norm was found for the exact Phonecheck/Blackbelt file-custody algorithm, so private non-executing intake is the conservative local default. Compared Tekmetric's individually granted permissions with Shopmonkey's custom-role grants; neither documented scheme fixes the specialized provider-custody or SCIM algorithm being ruled here.

**Placement:** DIAG-002 owns diagnostic provenance and sharing; GOV-006 alone owns retention; all three adapter families remain owed.

**Sources:** [Tekmetric grants payment, report and account-management permissions separately.](https://support.tekmetric.com/hc/en-us/articles/360037201874-Employee-Permissions); [Shopmonkey assigns configurable permissions through custom user roles.](https://support.shopmonkey.io/hc/en-us/articles/38743182591124-User-Roles-Permissions).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:538`. No status change; all unfinished acceptance and proof remain owed.

### RL-105 — GOV-003: Enterprise sign-on and provisioning

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** GOV-003  
**Outcome:** adopt with rider

**Question:** May explicitly configured enterprise identities provision ordinary staff without inferring administrator authority?

**Default proposed/adopted:** Freshly confirmed owner configuration, exact provider association, technician-only provisioning, local factors and immediate revocation; authority excluded from archives.

**Clause outcome:** Enable enterprise identity only by explicit owner-approved configuration and exact provider association; provisioning grants only mapped ordinary staff rights, deactivation revokes live authority and recovery never restores credentials.

**Why:** Tekmetric gives account management its own permission. No common norm for the named shop incumbents establishes this exact SAML/SCIM association scheme; explicit least-privilege mapping is the safest local default. Compared Tekmetric's individually granted permissions with Shopmonkey's custom-role grants; neither documented scheme fixes the specialized provider-custody or SCIM algorithm being ruled here.

**Placement:** Put the connection/association rule once in GOV-003; preserve all Google, Entra, Okta, location, delegation and emergency-recovery journeys.

**Sources:** [Tekmetric grants payment, report and account-management permissions separately.](https://support.tekmetric.com/hc/en-us/articles/360037201874-Employee-Permissions); [Adaptive Planning exposes explicit SAML configuration and administrator recovery access.](https://doc.workday.com/adaptive-planning/en-us/workday-adaptive-planning-documentation/security-and-administration/administration-faqs-and-troubleshooting/administration-faqs/mwp1623710846108.html); [Shopmonkey assigns configurable permissions through custom user roles.](https://support.shopmonkey.io/hc/en-us/articles/38743182591124-User-Roles-Permissions).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:641`. No status change; all unfinished acceptance and proof remain owed.

### RL-106 — GOV-006: Retention erasure and legal holds

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** GOV-006  
**Outcome:** replace

**Question:** May financial and custody records be categorically preserved forever while other customer data is erased?

**Default proposed/adopted:** Manual owner actions, blank lifetimes, permanent financial/authorization/custody/asset snapshots and conservative shared-import holds.

**Clause outcome:** Use explicit retention purposes and scoped holds with reviewed eligible erasure; a blank lifetime pauses automatic destruction but never creates a permanent exemption from a valid erasure duty, and retained financial or custody facts need a documented continuing basis.

**Why:** Tekmetric recognizes verified deletion and specific legal-retention exceptions, rather than an unconditional permanent exemption. Specific statutory durations and jurisdiction-specific legal sign-off are not certified by this product ruling.

**Placement:** Replace the permanent-preservation default once in GOV-006, retaining immutable audit, hold, shared-custody and stale-restore obligations; absent eligibility proof, show the unresolved retention basis and refuse that destruction.

**Sources:** [Tekmetric handles verified deletion requests with legal-retention exceptions.](https://www.tekmetric.com/legal/privacy-policy-website).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:644`. No status change; all unfinished acceptance and proof remain owed.

### RL-107 — OPS-002: Fast counter work and dependable background jobs

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** OPS-002  
**Outcome:** adopt with rider

**Question:** May provider read jobs and customer reminders use bounded current consent and human uncertainty recovery?

**Default proposed/adopted:** Fresh owner approval for GET-only evidence jobs, quarantined restored jobs and no automatic resend after failed or uncertain reminders.

**Clause outcome:** Run only currently authorized jobs with durable idempotency and separate read-versus-send authority; quarantine restored runnable authority and require human resolution before retrying an uncertain outbound effect.

**Why:** Tekmetric exposes explicit statement sending and configurable reminders. No common norm dictates Mallet's lease, concurrency or replay limits; the local default prevents a restore or retry from creating new authority. Compared Tekmetric's configured scheduling/sending with Shopmonkey's staff-selected reminders; neither documents this exact waitlist/retry/capability algorithm.

**Placement:** State job authority once in OPS-002; cite AR-002 for reminder consent and keep every capacity, p95 and restart deadline unchanged.

**Sources:** [Tekmetric lets staff select balances and preview statement emails.](https://support.tekmetric.com/hc/en-us/articles/360048518993-Accounts-Receivable); [Tekmetric configures follow-up messages and Google or private feedback.](https://support.tekmetric.com/hc/en-us/articles/33212380922007-Marketing-Automations); [Shopmonkey lets staff choose recipients, templates and scheduled reminders.](https://support.shopmonkey.io/hc/en-us/articles/38743042626452-Appointment-Confirmation-Reminders).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:646`. No status change; all unfinished acceptance and proof remain owed.

### RL-108 — PAY-005: Refunds exchanges and customer credits

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** PAY-005  
**Outcome:** adopt with rider

**Question:** May bounded native staff refund rights and read-only accountant access implement the previously approved refund policy?

**Default proposed/adopted:** Explicit bounded credit/manual-refund rights with separate accountant finance reads; uncertain refunds remain reserved.

**Clause outcome:** GOV-001 may delegate bounded refund/credit verbs and finance reads, with current permission, exact transaction approval, step-up and immutable original-tender history enforced at every financial command.

**Why:** Tekmetric separates refund and financial-report permissions and ties refunds to original transactions; this applies the existing ct 22 October refund ruling rather than extending spending authority.

**Placement:** Put delegation once in GOV-001 and cite it from PAY-005; keep native authoring, provider reconciliation and uncertainty resolution in the Gap.

**Sources:** [Tekmetric grants payment, report and account-management permissions separately.](https://support.tekmetric.com/hc/en-us/articles/360037201874-Employee-Permissions); [Tekmetric links refund invoices to original payments and inherited tax.](https://support.tekmetric.com/hc/en-us/articles/13472321015959-Refund-Invoices).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:582`. No status change; all unfinished acceptance and proof remain owed.

### RL-109 — PAY-007: Paper checks and shop-defined tenders

**Date:** 2026-10-28  
**Ruled by:** ct  
**Governs:** PAY-007  
**Outcome:** adopt with rider

**Question:** May staff-recorded clearing evidence be retained without representing a verified bank settlement?

**Default proposed/adopted:** Owner-observed original-payment clearing journal with date, reference and recorder, without money movement or bank verification.

**Clause outcome:** Retain an append-only authorized observation linked to the original payment and label it owner-observed; only independent bank evidence may establish verified clearance.

**Why:** Tekmetric distinguishes recorded tender and original-payment refunds; its A/R flow does not make a manual record bank verification. The precise observation journal has no common norm; the ct 25 October distinction remains controlling.

**Placement:** State observation versus verification once in PAY-007; full check capture, returns, deposits and books posting remain owed.

**Sources:** [Tekmetric lets staff select balances and preview statement emails.](https://support.tekmetric.com/hc/en-us/articles/360048518993-Accounts-Receivable); [Tekmetric links refund invoices to original payments and inherited tax.](https://support.tekmetric.com/hc/en-us/articles/13472321015959-Refund-Invoices).

**Main read:** `ef1213e14df9f110df7889445c1d6f7bf2c39785`, `CONTRACT.md:584`. No status change; all unfinished acceptance and proof remain owed.
