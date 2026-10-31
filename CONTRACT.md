# Mallet target product contract

Mallet is the complete shop management product for US independent repair shops switching from Tekmetric, Shopmonkey, Mitchell 1 Manager SE, Shop-Ware or AutoLeap. It covers intake, inspection, exact customer authorization, parts, technician work, payment, return and continuing follow-up, including bicycle, electronics and equipment benches.

## Product target

| | |
| --- | --- |
| Category | Auto repair shop management software |
| Incumbents a buyer switches from | Tekmetric, Shopmonkey, Mitchell 1 Manager SE, Shop-Ware, AutoLeap |
| Up-and-comers it must also beat | No separate up-and-comers were named in the approved scope. |
| First buyer | A US independent auto repair shop owner with service advisors, technicians, a parts purchaser and an outside accountant, taking USD payments and applying configured US sales tax |

The complete job includes commercial/fleet customers, vehicle and asset history, appointment and bay capacity, DVI evidence, line-level approvals and supplemental work, automotive labor guides and parts networks, inventory/cores/returns, technician clocks, quality/warranty, customer communication, card/ACH/financing, accounting and ARO/car-count/profit reporting. Named migration paths include every approved auto incumbent and the researched bench-system alternatives. Imported history remains useful in daily repair, follow-up and reporting rather than an inaccessible attachment dump.

Neighboring products stay separate: [Pier](https://github.com/just-every/run-pier) is an optional inventory authority; [Pantry](https://github.com/just-every/run-pantry), QuickBooks Online or Xero hold the general ledger; [Crank](https://github.com/just-every/run-crank) runs cross-product automation; [Auth](https://github.com/just-every/run-auth) can supply identity. Repair stock, consent, technician work and shop customer follow-up remain Mallet’s job. A connected storefront, accounting package, supplier or OEM does not become part of Mallet.

The primary journey: check in the customer and asset, diagnose and inspect, price and authorize exact work, source parts and complete it, collect the payment and hand over, then follow the next service.

## How to read this contract

- This follows the RER contract standard.
- Core, Agent surface and Later are reported separately.
- Done means every acceptance point has recorded proof.
- Field proof is visible in its non-blocking register.
- ACCEPTANCE.md and docs/CLAIMS.md are generated from this file.

## Door rules

- **D-1.** Exact scope. Estimates, consent, orders and financial decisions bind their exact inputs and versions. Changing price, part, scope or recipient invalidates the affected decision; accepted repair scope is never retrospectively broadened. Agent decisions carry their computed classes under the company’s policy.
- **D-2.** Evidence boundaries. A repair view, draft order, bank screenshot or model inference supplies no customer consent, supplier acknowledgment, verified settlement or physical receipt. Keep the actual decision, provider or receiving evidence separately.
- **D-3.** Workshop custody. Every capability adding product records, media or provider evidence extends OPS-001’s inventory before shipping, retaining exact repair decisions, saved invoice exports and import originals under DATA-001 and GOV-006. Historical attribution grants no destination authority.
- **D-4.** Outreach consent. Appointment and declined-work email permission identifies the customer, recipient, channel, purpose, related appointment or declined item, exact wording and version, customer time and timezone, capture time and channel, source reference and recorder. An affirmative form choice, email or documented spoken permission supplies evidence. Silence, preselected choices, a stored address, prior business and repair authorization do not. Appointment confirmation permission covers one confirmation only; later instructions, reminders and declined-work outreach need their own stated purpose.
- **D-5.** Exact outreach scope. A person’s one-email approval binds recipient, content and template, related source revision, consent evidence, recipient IANA timezone, allowed hours, scheduled instant and expiry. Material changes invalidate it; expiry is at most 31 elapsed days and grants neither repeated contact nor a retention period. The limit survives cron replay, restart and repeated DST hours. A later email needs fresh authority and still-valid consent. For an agent, external is the class and the company’s policy decides its disposition.
- **D-6.** Allowed hours. The recorded recipient IANA timezone controls each scheduled instant. Opening is inclusive and closing exclusive; overnight windows wrap midnight and equal hours allow no window. Both occurrences of a repeated DST hour use their actual offset; a nonexistent local instant is not invented. Recheck current time, expiry, permission, suppression, related-record eligibility and current authority at handoff. Unknown timezone or permission and missing eligibility leave a visible staff task. Appointment messages also identify local shop time and timezone.
- **D-7.** Uncertain outreach. A durable claim precedes the provider call. Failed, interrupted and uncertain attempts do not retry automatically. Staff inspect the related record, exact message, claim and attempt times, provider reference, outcome and recovery action; a person records resolution before any freshly authorized later attempt and renewed eligibility check.
- **D-8.** Withdrawal. Recorded opt-out suppresses affected pending and future outreach at manual, scheduled and agent doors under MSG-004. A recorded stop identifies withdrawal, booking or another applicable reason. No renewed send approval overrides customer withdrawal; consent, approval, suppression, stop, outcome and resolution corrections append with actor, time, versions, policy and evidence.
- **D-9.** Outreach recovery. Eligible consent and outcome history follows OPS-001, DATA-001 and GOV-006. Local send authority, runnable reminders, link tokens and credentials are excluded from restoration. Restored history alone sends nothing; fresh destination authority and current consent and suppression are required. Erasure stops affected pending outreach and retains only facts with an existing custody or hold basis. This establishes no automatic deletion schedule.

## Shared duties (Base)

| Base duty | Duty | Delta clauses | Base journey |
| --- | --- | --- | --- |
| BASE-ACCESS-001 | Sign-in | none | not run |
| BASE-ACCESS-002 | Sessions | HTTP-001, GOV-004, GOV-007 | not run |
| BASE-ACCESS-003 | Public endpoints | HTTP-001 | not run |
| BASE-ACCESS-004 | Server-side authorisation | GOV-001 | not run |
| BASE-INPUT-001 | Validation | none | not run |
| BASE-INPUT-002 | HTML | none | not run |
| BASE-INPUT-003 | Uploads | IMPORT-001, INTAKE-001, DIAG-001, DVI-002, DVI-003, FLOW-004, MSG-003, MOBILE-001, MOBILE-002, MOVE-001, MOVE-002, MOVE-003, MOVE-004, MOVE-005, MOVE-006, MOVE-007, MOVE-008, MOVE-009, MOVE-010, MOVE-011, GOV-005, GOV-008, GOV-006, OPS-001, OPS-002, ADV-001, ADV-006 | not run |
| BASE-SECRET-001 | No leakage | HTTP-001, GOV-002, GOV-005, GOV-008, OPS-001 | not run |
| BASE-SECRET-002 | Startup | none | not run |
| BASE-DATA-001 | Export and import | DATA-001, INTAKE-004, BOOK-003, QUALITY-001, DIAG-002, FLOW-002, PAY-004, AR-002, REPORT-002, API-002, MOVE-001, MOVE-002, MOVE-003, MOVE-004, MOVE-005, MOVE-007, MOVE-011, MOVE-013, GOV-003, GOV-004, GOV-005, GOV-006, OPS-001, OPS-002, OPS-003, ADV-006 | not run |
| BASE-DATA-002 | Retention | none | not run |
| BASE-DATA-003 | Erasure | AGENT-001, DATA-001, INTAKE-004, BOOK-001, BOOK-003, DVI-002, DVI-003, DIAG-002, AUTO-002, AUTO-005, MOVE-002, GOV-004, GOV-005, GOV-006, ADV-006 | not run |
| BASE-DATA-004 | Outbound flows | GOV-005, GOV-008 | not run |
| BASE-DATA-005 | Independence | OPEN-001 | not run |
| BASE-PUBLIC-001 | Privacy | none | not run |
| BASE-PUBLIC-002 | Origins | none | not run |
| BASE-PUBLIC-003 | Accessibility | none | not run |
| BASE-OPS-001 | Health | HTTP-001 | not run |
| BASE-OPS-002 | Migrations | OPS-001 | not run |
| BASE-OPS-003 | Idempotency | IMPORT-001, INTAKE-002, INTAKE-003, BOOK-003, DVI-003, EST-003, PART-003, BUY-002, PAY-002, AR-001, AR-002, BOOKS-001, BOOKS-002, BOOKS-003, AUTO-002, AUTO-005, REPORT-006, CAL-002, STORE-002, API-001, API-002, MOVE-010, GOV-005, OPS-002, ADV-008 | not run |
| BASE-OPS-004 | Failure is visible | IMPORT-001, INTAKE-002, INTAKE-003, BOOK-003, DVI-003, EST-003, PART-003, BUY-002, PAY-002, AR-001, AR-002, BOOKS-001, BOOKS-002, BOOKS-003, AUTO-002, AUTO-005, REPORT-006, CAL-002, STORE-002, API-001, API-002, MOVE-010, GOV-005, OPS-002, ADV-008 | not run |
| BASE-OPS-005 | Audit | GOV-002 | not run |
| BASE-ROLE-001 | Roles through every door | HTTP-001, WORK-001, DATA-001, PIER-001, INTAKE-004, INTAKE-002, INTAKE-003, BOOK-003, DIAG-001, DVI-001, DVI-002, DVI-003, QUALITY-001, DIAG-002, EST-004, EST-005, FLOW-001, FLOW-002, FLOW-003, TIME-001, RETURN-001, FLEET-001, PART-001, PART-003, PAY-004, PAY-005, AR-001, AR-002, BOOKS-001, MSG-003, AUTO-001, AUTO-002, AUTO-004, AUTO-005, REPORT-002, REPORT-003, REPORT-004, REPORT-006, SHOP-001, CAL-002, STORE-002, API-001, API-002, MOBILE-002, MOVE-008, GOV-001, GOV-003, GOV-004, GOV-007, GOV-005, GOV-008, GOV-006, OPS-001, OPS-002, OPS-003, ADV-006, ADV-008 | not run |
| BASE-AUDIT-001 | Searchable, durable audit | VEH-003, INTAKE-004, DVI-004, QUALITY-001, FLOW-004, PART-006, TAX-002, AUTO-005, REPORT-007, REPORT-002, API-001, MOVE-011, GOV-002, GOV-003, GOV-005, GOV-006, ADV-006 | not run |
| BASE-BACKUP-001 | Independent backup, restore and rollback | DATA-001, OPS-001 | not run |
| BASE-DATA-006 | Erasure respects retention and legal hold | AGENT-001, DATA-001, INTAKE-004, BOOK-001, BOOK-003, DVI-002, DVI-003, DIAG-002, AUTO-002, AUTO-005, MOVE-002, GOV-004, GOV-005, GOV-006, ADV-006 | not run |
| BASE-SIGNIN-001 | Standards-based SSO and lifecycle | GOV-003 | not run |
| BASE-SIGNIN-002 | Native multi-factor authentication | GOV-003, GOV-004, GOV-007 | not run |
| BASE-INSTALL-001 | Free self-host and removal | OPS-001, OPEN-001 | not run |
| BASE-MAIL-001 | Truthful mail outcomes | CUS-001, INTAKE-002, BOOK-001, BOOK-003, DIAG-001, DVI-002, DVI-003, EST-003, EST-004, EST-006, EST-007, FLOW-001, FLOW-002, FLOW-003, FLOW-005, RETURN-002, FLEET-001, BUY-002, BUY-005, PART-006, BUY-006, INV-001, PAY-003, PAY-004, AR-001, AR-002, MONEY-001, MSG-001, MSG-002, MSG-003, PORTAL-001, AUTO-001, AUTO-002, AUTO-004, AUTO-005, REPORT-006, SHIP-001, API-002, MOVE-004, MOVE-005, MOVE-009, GOV-003, GOV-005, ADV-003, ADV-008 | not run |
| BASE-ACCESSIBILITY-001 | One accessibility bar | MOBILE-001 | not run |
| BASE-DOCS-001 | On-site docs from one contract | none | not run |
| BASE-AGENT-001 | One MCP door per seed | none | not run |
| BASE-AGENT-002 | The seed's jobs are tools, through the UI's own actions | SURFACE-001 | not run |
| BASE-AGENT-003 | Records are resources | SURFACE-004 | not run |
| BASE-AGENT-004 | Business identity and short-lived, audience-bound tokens | AGENT-001 | not run |
| BASE-AGENT-005 | An agent acts as a person in a role, never more | HTTP-001, AGENT-001, DVI-001, DVI-002, QUALITY-001, EST-007, TIME-001, FLOW-004, RETURN-001, MSG-004, REPORT-003, API-001, GOV-002, ADV-001, ADV-002, ADV-004, ADV-006, ADV-007, ADV-008 | not run |
| BASE-AGENT-006 | Every action declares its risk class | HTTP-001, AGENT-001, DVI-001, DVI-002, QUALITY-001, EST-007, TIME-001, FLOW-004, RETURN-001, MSG-004, REPORT-003, API-001, GOV-002, SURFACE-001, SURFACE-002, SURFACE-003, ADV-001, ADV-002, ADV-003, ADV-004, ADV-005, ADV-006, ADV-007, ADV-008 | not run |
| BASE-AGENT-007 | The company's policy decides, at one chokepoint | HTTP-001, AGENT-001, DVI-001, DVI-002, QUALITY-001, EST-007, TIME-001, FLOW-004, RETURN-001, MSG-004, REPORT-003, API-001, GOV-002, SURFACE-002, SURFACE-003, SURFACE-005, ADV-001, ADV-002, ADV-003, ADV-004, ADV-005, ADV-006, ADV-007, ADV-008 | not run |
| BASE-AGENT-008 | Truthful attribution | AGENT-001, GOV-004, GOV-007, SURFACE-002, ADV-001, ADV-002, ADV-003, ADV-004, ADV-005, ADV-006, ADV-007, ADV-008 | not run |
| BASE-AGENT-009 | Every agent action is audited with its class and decision | GOV-002, SURFACE-005 | not run |
| BASE-AGENT-010 | Agents can follow changes | SURFACE-004 | not run |
| BASE-AGENT-011 | Limits are policy, and Pause stops everything | SURFACE-005 | not run |
| BASE-AGENT-012 | Writes are idempotent and conflict-safe | SURFACE-005 | not run |
| BASE-AGENT-013 | Manifest, docs and the conformance journey | SURFACE-001, SURFACE-004, SURFACE-005 | not run |

## Published clauses

- `HTTP-001`: *Tier:* Core · *Cites:* BASE-ACCESS-002, BASE-ACCESS-003, BASE-ROLE-001, BASE-OPS-001, BASE-SECRET-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3
- `WORKSHOP-001`: *Tier:* Core · *Rules:* D-1, D-2, D-3
- `ESTIMATE-001`: *Tier:* Core · *Rules:* D-1, D-2, D-3
- `WORK-001`: *Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2, D-3
- `INVOICE-001`: *Tier:* Core · *Rules:* D-1, D-2, D-3
- `AGENT-001`: *Tier:* Core · *Cites:* BASE-AGENT-004, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-DATA-003, BASE-DATA-006 · *Rules:* D-1, D-2, D-3 · *Register:* R-10
- `IMPORT-001`: *Tier:* Core · *Cites:* BASE-INPUT-003, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3
- `DATA-001`: *Tier:* Core · *Cites:* BASE-DATA-001, BASE-DATA-003, BASE-DATA-006, BASE-BACKUP-001, BASE-ROLE-001 · *Rules:* D-1, D-2, D-3
- `PIER-001`: *Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

### Published workshop guarantees

#### HTTP-001 — Private app boundary

**Requirement.** The workshop boundary distinguishes health and declared public surfaces from its repair pages, commands and downloads. The workshop boundary refuses unconfigured hosts and cross-origin repair mutations. Unknown paths return real 404s. AGENT-001 describes a preparation-scoped grant.

**Acceptance.**
1. Request private pages, state, commands and exports signed out, as another role, after revocation and cross-origin; require refusal without writes, then succeed with the authorized session.

#### WORKSHOP-001 — Register and visits

**Requirement.** Customer-linked assets have unique case-insensitive identifiers and retain every native visit. Booking snapshots customer and asset details, normalizes timezone-bearing ISO timestamps to UTC, assigns the operator ID, and refuses overlaps for either the bay or technician.

**Acceptance.**
1. Register an asset through the counter form, book repeat visits and try overlapping bay and technician bookings through the command API; inspect the conflict and complete service history.

#### ESTIMATE-001 — Exact decision

**Requirement.** Estimates retain revisions, prices and preparer identity. A person approves the exact current revision before a recorded manual handoff. Staff capture customer identity, selected lines, method and evidence against it; manual sharing is labeled separately from delivered messaging. Accepted scope is immutable; EST-004 adds separately authorized supplements to that repair.

**Acceptance.**
1. Prepare and revise through the API, refuse stale approval, record a printed handoff and partial customer authorization, then refuse unapproved quantities and changes to accepted lines.

#### WORK-001 — Authorized actuals

**Requirement.** Parts and labor actuals use only lines and quantities within the person-approved, customer-authorized revision. A member records work only on assigned jobs; completion requires recorded work. Additional scope never inherits consent from a previous decision.

**Acceptance.**
1. As an assigned member record an authorized line; refuse another job, an unapproved line and excess quantity, then complete and inspect actor and revision evidence.

#### INVOICE-001 — One saved export

**Requirement.** An invoice freezes authorized prices and actual quantities after completion and requires a person to approve before export. Repeated export retrieves the same saved invoice and journal entry. Saved exports use USD unit, subtotal, sales tax and total columns. Migration preserves original cent amounts, export identities and approvals while updating legacy labels; subsequent downloads return the same saved export.

**Acceptance.**
1. Complete authorized work, prepare and approve the invoice through the app, export twice with current and preceding versions, and compare saved identity, lines, totals and approval history.

#### AGENT-001 — Scoped preparation keys

**Requirement.** A person can issue a preparation-scoped grant for estimate preparation and revision, dispatch preparation and invoice preparation. The grant expires and is revocable, and retains the actor, time and exact prepared revision. Calls outside that chosen preparation scope are refused. Broader service-advisor jobs use ADV-008 and the company’s policy for their computed classes; a preparation grant does not expand to include them.

**Acceptance.**
1. Issue a preparation-scoped key through the owner door and prepare an estimate draft.
2. With that preparation grant, attempt approval, sharing, customer authorization, invoice export, erasure and access management; each exceeds its scope.
3. Record a person’s exact decision, revoke the preparation key, and verify both the old key and a concurrent revoked write are refused.

#### IMPORT-001 — Reviewed register move

**Requirement.** Saved RepairShopr customer and asset JSON snapshots use the Base import kit. Preview writes no business records; apply requires the reviewed fingerprint, retains originals, source links and a journal, and supports bounded continuation. Undo refuses changed or used records. MOVE-009 extends the existing register move to repair history.

**Acceptance.**
1. Upload customers and customer-assets API snapshots, preview and apply the fingerprint, replay, resume and undo; inspect originals and journal, and prove an asset used by a new visit survives undo.

#### DATA-001 — Custody and erasure

**Requirement.** Workshop archives retain exact decisions, saved invoice exports and original import custody. An unused asset can be erased; an asset with visits retains the eligible repair history under GOV-006. An archive older than erasure is refused when the destination knows the later erasure or the later journal is supplied; a post-erasure archive restores. A fresh destination without that later evidence labels the recovery “Erasure history unverified: supply your latest archive as the journal.” The restore screen asks for the latest journal or the owner explicitly chooses unverified recovery. It never silently filters erased rows or claims freshness without evidence. AUTO-002 status permission, exact message approvals, outcomes and task history follow this custody; local sending authority is excluded.

**Acceptance.**
1. Export populated records through portability routes, restore to an empty fresh installation and compare history; reject populated restore, unauthorized erase and pre-erasure archives; restore a post-erasure backup.

#### PIER-001 — Read only

**Requirement.** The optional Pier catalog adapter performs GET using private authorized connection settings, identifies observation time and reports failures. Catalog browsing itself never moves stock. PART-003 defines a separate explicit reservation/movement connection when Pier is selected as inventory authority; Mallet still owns the repair.

**Acceptance.**
1. Connect a real Pier installation, open the catalog and compare SKU/name/unit with source; revoke access and show a recoverable error while source stock remains unchanged.

## Target clauses

### Customers, vehicles and intake

#### CUS-001 — Customer and fleet accounts

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Maintain searchable people and business accounts, multiple vehicles/assets, phone/email, billing contacts, communication preferences, tax status, notes and duplicate-safe merge with source history; fleets can have separate driver, authorizer and payer. GOV-001 sets the finer advisor, manager, cashier and accountant rights. The governing recorded decision is RL-1.

**Acceptance.**
1. Create a household and fleet, merge a duplicate, change a driver and search by name, phone and plate; old invoices retain their snapshots and the payer alone sees fleet billing.
2. Owner and admin create and edit contacts, accounts, drivers and links.
3. A merge needs owner or admin, the exact versions, a preview of the survivor, a reason and identity-match evidence, and it keeps both source snapshots.
4. On the customer side, only the account's current payer sees fleet billing (invoices, balances, statements, payments), through a PORTAL-001 account session.
5. Drivers and authorizers see no billing unless they are also the payer.
6. Changing the payer ends the old payer's access at once.
7. Stored roles alone grant nothing.
8. Also (ct 22 Oct 2026): an admin creates a fleet and changes its driver; the payer signs in and sees billing; the driver and authorizer are refused; after the payer changes, the old payer is refused.

#### VEH-001 — Vehicle identity and VIN decode

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Store VIN, plate/state, year/make/model, engine, trim, drivetrain, fuel and vehicle-specific fitment; scan VIN/plate from a phone and decode through NHTSA vPIC and a licensed US plate provider such as CarMD. A staff correction keeps raw decode provenance and never conflates two vehicles.

**Acceptance.**
1. Scan a VIN and state plate through intake, compare decoded engine/trim with provider evidence, correct an ambiguous result and show duplicate warnings and manual entry when decode is unavailable.

#### VEH-002 — Mileage and service intervals

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Record intake/out mileage or hours, units, observation date and corrections with reason; retain readings per visit, flag impossible regressions and compute time/mileage service due without inventing a current odometer. Readings are nonnegative whole miles (default), kilometers or hours, with timezone-bearing observations stored in UTC; corrections append with a reason and retain the original. A service becomes due when its latest observed reading in the same unit reaches or exceeds the entered threshold, or its inclusive UTC due date arrives; the two triggers use OR and no current reading is extrapolated.

**Acceptance.**
1. Enter 62,100 miles, close at 62,112, record a corrected prior reading and inspect due dates and the warning for a lower uncorrected reading.

#### VEH-003 — CARFAX service history exchange

*Tier:* Core · *Cites:* BASE-AUDIT-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-7

**Requirement.** With the shop’s eligible CARFAX account, retrieve vehicle service history and submit eligible completed service records; preserve provider attribution, consent, event IDs and submission failures. External history remains distinguished from shop-performed work.

**Acceptance.**
1. Connect a CARFAX approved test account, read history by VIN, close a qualifying repair and submit once; duplicate events do not duplicate history and a provider refusal remains actionable.

#### INTAKE-001 — Condition media and custody

*Tier:* Core · *From:* INTAKE-001 · *Cites:* BASE-INPUT-003 · *Rules:* D-1, D-2, D-3

**Requirement.** Attach timestamped before/after photos and video, damage marks, accessories, keys, valuables, security-lock handling and custody receipts to the asset and visit; private secrets are restricted and removed after their purpose ends. Owner/admin record immutable before/after condition with same-visit completed media, damage locations, keys/accessories/valuables and a typed acknowledgment of the exact checklist; identity is not verified. A comparison retains every original item, returned quantities, discrepancies and explicit electronic-signing/receipt consent with paper-copy instructions; it records no payment or release. Temporary unlock custody is governed by INTAKE-004. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#intake-004).

**Acceptance.**
1. Check in a vehicle with body damage and spare key and a device with charger, capture signed custody receipt and photos, then compare the actual handover against the same checklist.

#### INTAKE-004 — Temporary unlock custody

*Tier:* Core · *From:* INTAKE-001 · *Cites:* BASE-ROLE-001, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006 · *Rules:* D-1, D-2, D-3

**Requirement.** Keep consented temporary unlock material private, preserve its exact entered value and exclude it from archives, public state and audits. It becomes inaccessible immediately when its purpose ends or its at-most-24-hour lifetime expires; the removal schedule and cryptographic custody are retained in [contract mechanisms](docs/contract-mechanisms.md#intake-004). Ciphertext is not restored; fresh owners retain only non-secret custody/audit history. Recovered database records cannot recover a purged secret.  A purpose containing the secret value is refused. Customer erasure purges that customer's unlock material at once. GOV-001 governs reveal authority for the owner and the job’s assigned technician; each reveal retains its reason and audit. GOV-006 requires immediate unlock-material purge at the customer-erasure door, including the linked customer account.

**Acceptance.**
1. Save consented temporary unlock material without copying it into public state, audit or archives.
2. End its purpose, let its lifetime expire and erase the customer; the material becomes inaccessible, including after an older database is recovered.
3. Retain the non-secret custody history under fresh destination authority.

#### INTAKE-002 — Custom forms and signed shop terms

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Configure forms by vehicle/device type, capture symptom, diagnostic fee, storage/teardown terms and customer consent with exact version, signature and delivery copy; flag missing required fields without losing a draft. Owner/admin publish versioned vehicle/device templates with required/optional custom text fields, a whole-cent USD diagnostic fee, storage and teardown terms. Each issued form snapshots its exact terms and visit; later template edits never alter a draft or signed receipt. Only the issued, seven-day, revocable form link can save that customer’s draft or typed-name acknowledgment; it grants no account, repair or payment authority and is excluded from archives. Missing required fields are named while all valid draft answers remain saved. Signing explicitly consents to those exact terms and electronic signing/receipt with paper-copy instructions and requests one copy at the snapshotted customer email. The immutable receipt contains a content digest, is immediately readable/downloadable on the same link, and remains privately retrievable by staff after a template change. One email claim precedes the provider call; a failed or uncertain attempt never hides or replaces the signed copy. No customer identity verification or automatic retry is claimed. GOV-007 and INTAKE-003 govern customer-link/identity and intake authority before shipping. Before consent the form states the ESIGN consumer disclosures: the right to a paper copy and any fee, the right to withdraw consent and its effect, that consent covers this intake only, the hardware and software needed, and how to update the email. Opening the signed copy records demonstrated access. The emailed and downloadable copy is a readable, printable document of the exact terms, answers, typed name, time and content digest, with the JSON attached. Templates may require separately ticked acknowledgments (liability waiver, device data-loss and backup, storage charges), each recorded in the receipt. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#intake-002).

**Acceptance.**
1. Publish two intake templates, change shop terms after an intake and retrieve its original signed version; a customer completes required fields by phone and receives a copy.

#### INTAKE-003 — Counter and after-hours check-in

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Provide walk-in, drop-box and customer mobile check-in with requested work, contact/vehicle verification, key drop and queue receipt; an advisor confirms booking and diagnostic spend before work starts. Owner/admin issue a private seven-day revocable one-request invitation using a published intake template and a frozen diagnostic-only quote including configured sales tax. The customer enters requested work, contact, vehicle identifier and key-drop details, separately acknowledges required template terms and explicitly signs only the exact diagnostic total and electronic queue receipt. Submission creates no booking, work authorization or charge; identical replay retains one immutable printable queue receipt and changed replay is refused. Only owner/admin review the request, record contact/vehicle verification and physical key receipt, match an existing vehicle and explicitly confirm both booking and the exact diagnostic spend. Confirmation atomically creates one collision-checked visit and one separately identified diagnostic-only estimate decision bound to the customer receipt; tax/total changes need a new invitation and consent. Requested repairs and teardown need separate authority. Link possession and typed names do not verify identity, no automatic message is sent, and staff verification stores no identity-document copies. All records are archived; bearer credentials are excluded and restored staff need fresh authority.

**Acceptance.**
1. Submit an after-hours check-in, review it at the counter, match an existing vehicle and authorize the diagnostic fee; duplicate submission creates one intake and no automatic repair authorization.

#### BOOK-001 — Online appointment booking

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-DATA-003, BASE-DATA-006 · *Rules:* D-1, D-2, D-3

**Requirement.** Customers book, reschedule or cancel services against published opening hours, bay skills, duration, location, lead time and staff capacity; simultaneous last-slot requests cannot overbook and tentative slots have expiry. Published dated opening windows include exact UTC-offset bounds, a location, a skilled bay and active staff member; service duration defines the slot grid and minimum lead time and current active staff are checked again at confirmation and rescheduling. Customer pages and confirmation mail name the snapshotted shop timezone. Bay and staff reservations are shared with staff booking and dispatch. Tentative holds expire after the configured 1–1800 seconds (default 600); a compare-and-swap transaction makes simultaneous last-slot claims exclusive. Customers explicitly request confirmation email and receive a private 256-bit management link, stored only as a hash outside archives, to confirm, reschedule or cancel their own appointment. The public booking door permits at most one unexpired tentative hold per case-normalized email and three per source connection, enforced by the same transaction fence as capacity. Refusals name the email or connection limit and explain confirmation, cancellation or expiry; the source uses a content digest hash of the Cloudflare client address (a shared unknown-source bucket when absent), never a raw address or a form-supplied source. A management link opens and changes only its one appointment, never other bookings, the customer record or vehicle history. No customer register lookup, repair authorization or charge occurs. Owner/admin alone publish availability; mail outcomes distinguish provider handoff, development suppression, failure and uncertainty, and a claimed send is never automatically retried. BOOK-002, BOOK-003, AUTO-001 and PORTAL-001 inherit these capacity and private-management boundaries. The governing recorded decision is RL-2. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#book-001).

**Acceptance.**
1. Embed a booking form, choose a service on a phone and contend for the last available bay; one confirmed appointment is sent and cancellation frees capacity.

#### BOOK-002 — Resource calendars and recurring reservations

*Tier:* Core · *From:* BOOK-002 · *Rules:* D-1, D-2, D-3

**Requirement.** Advisors see day/week technician, bay, lift and loaner capacity, absences and recurring bookings; dispatch approval rechecks conflicts, and a cancellation offers a waitlisted customer a bounded reservation. US shop timezones and DST are explicit. Owner/admin manage typed bay, lift and loaner resources, staff qualifications, dated absences and finite weekly reservations. Native staff identities are rechecked at reservation and dispatch approval; existing free-text repair assignments keep their prior identity boundary. Registered resources and qualifications, absences, recurring reservations, active native staff and current jobs/customer appointments share the booking/dispatch transaction fence. Weekly series contain 2–52 explicitly dated occurrences at the same local wall times in an IANA timezone, with each actual UTC offset supplied; nonexistent times and incorrect offsets are refused. Resource calendars show day/week reservations and absences in the saved shop timezone, including DST labels. Existing reservations are retained when availability changes; subsequent booking, confirmation, rescheduling and dispatch approval recheck it. BOOK-003 governs the waitlist offer (RL-103).

**Acceptance.**
1. Book a bay and technician, attempt an overlap and approve a move after a competing booking; resource conflicts are rechecked.
2. Exercise recurring dates and a DST transition using the saved shop timezone and offsets.

#### BOOK-003 — Cancellation waitlist offers

*Tier:* Core · *From:* BOOK-002 · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** The adopted conservative waitlist default is owner/admin recorded, job-independent customer request evidence and explicit permission for one cancellation-offer email, FIFO among matching service/full-time-interval requests that satisfy the existing per-email/source hold bounds. A cancellation atomically makes one ordinary expiring hold for the earliest eligible request, including when a previously offered appointment is canceled; an owner/admin explicitly reviews and emails that offer, with its private appointment-only link created after one durable send claim. Cancellation alone sends nothing. There is no automatic retry or queue advance after expiry: staff explicitly advance the next eligible request. Provider handoff, development suppression, rate limiting, failure and uncertainty remain separate from delivery; neither an offer nor confirmation grants repair or payment authority. Queue, offer, resource, absence and recurring histories inherit OPS-001, while management tokens and provider credentials stay excluded. Use the recorded-permission, matching-FIFO waitlist with one bounded staff-reviewed offer; expiry, failed or uncertain handoff requires explicit staff recovery and grants no repair or payment authority. (RL-103).

**Acceptance.**
1. Cancel a booking with matching waitlisted requests; the earliest eligible recorded-permission request gets one bounded hold.
2. Review and send the offer once; expire it or fail the handoff and require explicit staff recovery without repair or payment authority.

#### DIAG-001 — Diagnostic findings and private notes

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Technicians retain complaint/cause/correction, measurements, DTCs, test method and attachments with staff-only notes visibly separated from the customer explanation; no private note leaks through an approval link. Diagnostic entries record a required complaint, cause, correction, exact uppercase OBD-II codes (such as P0301), measurements with their exact value and unit and no conversion, test method, server-verified references to completed DVI-002 media on the same repair, a staff-only note and a customer explanation; the assigned technician or owner/admin records them, and each change appends a revision. Only owner/admin share one exact revision with the customer; a later revision stays private until shared. Owner/admin create read-only customer inspection links: 256 random bits shown once, only the content digest stored outside archives (restores keep link history, never access), seven-day default expiry (only the owner may extend it, to the 31-day ceiling), revocable, GET-only with no session; they show the vehicle, repair title and shared revisions’ complaint, cause, correction, codes, measurements, test method and customer explanation, never staff notes, attachments, prices, costs, contacts or other repairs. Unknown, expired and revoked links get the same not-available page; each view appends a receipt and changes no approval. Mallet does not send the link and labels it not sent; DVI-003 adds shared media, delivery and view analytics and MSG-001 adds sending. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#diag-001).

**Acceptance.**
1. Enter DTCs and measured findings on an assigned repair, write a private cost note, and open the customer inspection link; only explicitly shared findings appear.

#### ASSET-001 — Bicycle and device repair benches

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** The same customer/asset/visit model supports bicycle serials, frame and component specifications, equipment hours and device serial/IMEI, model, accessories and bench resources; vehicle-only fields and automotive provider requirements do not block those repairs. Legacy untyped records retain vehicle-compatible behavior until explicitly classified once; classification does not rewrite existing visits. Bicycle frame/components, equipment model and device model/IMEI/expected accessories are saved with the asset; each visit and invoice keeps its original snapshot. The serial or identifier is entered directly, with no automotive provider requirement. Bays also serve as named benches under the same conflict fence. Owner/admin may save an explicit rate and parts/labor taxability for each asset type; until then the shop default applies. An explicit type rule keeps its saved values when the default changes. Accepted line tax snapshots remain frozen; no jurisdiction or tax treatment is inferred from an asset. Documented vehicle returns retain mileage-out, equipment returns require observed hours-out, and bicycle/device returns require no odometer reading; all retain the existing quality, payment and signed custody gates.

**Acceptance.**
1. Run bicycle brake work and a serialized device repair from intake to paid return beside an auto repair; their history, parts and tax rules use the correct asset type.

### Digital inspections and repair quality

#### DVI-001 — Configurable digital inspections

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Create versioned multipoint templates by vehicle/service, assign technicians and mark green/yellow/red or not inspected with measurements and mandatory reasons; incomplete checks remain visible and templates can map findings to canned jobs. Owner/admin manage reusable templates and versioned canned service recipes; each assignment snapshots its exact template and mapped recipe revisions for the repair’s current native technician. Only the currently assigned technician records immutable observations; owners/admin read shop inspections, technicians read only their currently assigned repair snapshots, and agent access follows its sponsor’s job scope and the company’s sensitive policy. Every result needs evidence/reason. Yellow/red results also need a configured exact-unit numeric measurement or owner-defined labelled grade, and a completed same-repair private DVI-002 image; the write binds its native custody, digest and provenance. A not-inspected point stays incomplete without invented values. New observations append and supersede earlier results without changing them. Template/recipe edits never alter earlier assignments, results or prepared estimates. A mapped yellow/red finding prepares a real part/labor estimate at the explicitly reviewed current recipe revision and shop tax, preserving original finding, template, mapped recipe and priced recipe snapshots; approval and work still need separate exact decisions. Existing decided repairs use EST-004 supplements. Checklist measurements, grade labels, retained observations and their original photos also appear beside prior/current visits in DVI-004 history, under the existing native assignment check for each visit. All reusable/assigned history, grade labels, photo references and bytes inherit OPS-001 portability with fresh native authority.

**Acceptance.**
1. Assign a brake inspection, record pad thickness and an uninspected item, change the template and reopen the original; the original checklist and its completion state remain exact.

#### DVI-002 — Photo and video inspection evidence

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001, BASE-DATA-003, BASE-DATA-006, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Capture, annotate and upload findings on phones/tablets with compression, resumable progress, capture time and technician provenance; keep originals and shared versions and recover interruption without duplicate findings. Owner/admin sessions may access all shop findings; technicians access only their currently assigned repairs, and agent media reads follow the sponsor’s scope and the company’s sensitive policy. A foreign-origin upload writes no finding or chunk. Retries retain one finding and each original/shared version. Conflicting metadata or bytes are refused, and a variant is verified before it can be viewed. Phone capture retains original bytes and a separately compressed, annotated shared photo. The prepared shared video retains its compressed capture; its capture duration and encoding parameters are documented with the media formats. Capture time is technician-reported with a timezone and normalized to UTC, separate from server receipt time and native actor provenance. Both versions stay private, with no public URLs; “shared” means prepared, not sent. The browser remembers only opaque finding/upload IDs and content hashes for reselect-and-resume. DVI-003 owns reviewed customer delivery and must preserve private-original control; GOV-006 owns retention, erasure and holds, with no automatic media deletion before that policy ships. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#dvi-002).

**Acceptance.**
1. Capture marked-up brake photos and a short video, interrupt the upload, resume, and view original/shared media from the finding; duplicates and private originals are controlled.

#### DVI-003 — Customer inspection presentation

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001, BASE-DATA-003, BASE-DATA-006, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Text/email a branded mobile report showing measurements, urgency, technician evidence and an advisor-reviewed plain-language explanation, linked to exact estimate lines; record delivery and views without treating a view as approval. Customer delivery must preserve DVI-002 private-original control; a prepared shared variant is never itself delivery. It extends the DIAG-001 customer inspection link (token, expiry, revocation, view receipts and the staff-note boundary) with shared media, delivery and view analytics. Owner/admin explicitly review an immutable report snapshot of current inspection results, urgency, exact measurements, a plain-language explanation, selected completed shared photo/video variants, and selected lines of a current person-approved estimate revision. The report uses the existing hashed 256-bit, 1–30 day, revocable read-only inspection link; every media request and chunk page rechecks link authority and only serves the reviewed shared variants, never originals. Customer pages omit staff identities, notes, costs, contacts and unselected lines. Proposal pages retain their exact revision and label superseded revisions historical. Owner/admin verify the email recipient and record explicit customer permission before one durable send claim; that claim permits no automatic retry. Signed Resend delivery events are accepted only with the configured installation webhook key, exact retained provider message ID and reviewed recipient; bounded original bytes, timestamp verification and durable event identity checks reject forged, stale, foreign and conflicting events. Deferred, delivered, bounced, suppressed and complaint facts remain separate from submission handoff; older nonterminal events cannot regress a terminal fact. Receipt handling sends nothing and changes no approval; private owner/admin pages show the provider state and last report-view time, and archives preserve the receipts while excluding verification keys. Report views are counted and timestamped without changing any repair, inspection, estimate or approval. MSG-001 inherits these reviewed-report and explicit-send boundaries for SMS; GOV-006 inherits report/media retention without automatic deletion before its policy ships. The governing recorded decision is RL-3. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#dvi-003).

**Acceptance.**
1. Send an inspection report to a customer phone, play its video and open a proposed repair; a viewed report leaves all approval decisions unchanged.

#### DVI-004 — Inspection history comparison

*Tier:* Core · *Cites:* BASE-AUDIT-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Compare prior inspection measurements and images for the same vehicle/asset, distinguish imported evidence, and carry unresolved recommendations forward without silently representing old observations as new tests. Measurements retain the entered numeric value, name and explicit unit; comparison never converts units. Imported attribution is source-declared, not provider-verified. A carry is a reference to the original observation, date, actor and optional exact declined decision, never a new test or authorization. Resolution appends a reason and native actor without changing original evidence; resolved recommendations cannot be carried again. Current DVI-002 access rules apply separately to every source and destination visit.

**Acceptance.**
1. Open a second visit, compare brake measurements with the prior visit and carry a declined finding into a new inspection; date and provenance remain visible.

#### QUALITY-001 — Completion tests and return clearance

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001, BASE-DATA-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Define pre/post-repair checklists, road-test measurements and required technician/quality sign-off; a failed or incomplete critical check blocks ready-for-return until an authorized override with reason. Physical safety evidence names the qualified person who performed it. An agent’s own sign-off carries commitment under the company’s policy and never poses as that person. Owner/admin define job-specific versioned pre/post checklists, including explicit measurement names and units for road tests. The currently assigned native technician records immutable results and signs the exact current checklist, results and actual work; a different owner/admin supplies the independent quality decision. The owner can perform the manager’s decision when that shop role has no assigned person. Required or critical checks must pass, or an independent owner/admin explicitly selects the failed/incomplete checks and records a qualified safe-to-release override with reason; both signatures remain required. A passing retest after failure requires linked actual corrective work added after that failure, with reason. Values keep their entered units without conversion. Later work, results, checklist revision or technician change invalidates clearance. Only the current owner may take over an open repair’s technician assignment with a reason, including after fresh-owner recovery; every prior work/result/signature snapshot retains its actor, old clearance becomes stale, and the new technician needs a different current owner/admin’s independent quality decision. Archived identity attribution grants no destination authority. An agent cannot attribute its decision to the qualified person; record preparation and the agent’s own commitment decision follow the company’s policy. Existing historical completions retain their state and never acquire invented quality evidence.

**Acceptance.**
1. Fail the post-repair brake check, try ready status, record corrective work and obtain a second sign-off; inspect the failed result and any manager override.

#### DIAG-002 — Specialist diagnostics connections

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006 · *Rules:* D-1, D-2, D-3 · *Register:* R-7

**Requirement.** Attach vehicle scan-tool reports and device diagnostics from PhoneCheck and Blackbelt360 using authorized APIs or vendor result-file imports; map serial/VIN, test version and pass/fail, flag mismatches and retain raw evidence. The file adapter accepts a single Phonecheck Device Info JSON response and retains its exact UTF-8 bytes, content digest, provider application and build versions and original Passed/Failed/Pending strings. It compares source serial/IMEI against the saved visit, quarantines mismatches without applying findings, and keeps explanations separate from measured source results. Explicitly imported diagnostic originals remain private, with private owner archive/export custody, no automatic customer sharing, outbound call, repair/payment authority or safety certification; GOV-006 governs retention. Keep diagnostic originals private under current resource permissions, quarantine identity mismatches and require a separately authorized sharing, repair or payment action. (RL-104). Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#diag-002).

**Acceptance.**
1. Import a scan report and each device provider’s test result through its adapter; a wrong serial is quarantined and no generated explanation changes measured results.

#### DIAG-003 — OEM service information and recall context

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** Open licensed OEM repair procedures, fluid specifications, technical service bulletins, recall references and maintenance schedules matched to VIN/engine through MOTOR, ALLDATA and ProDemand; show provenance and licensing restrictions. Recall completion requires an authorized repair record.

**Acceptance.**
1. Look up the same VIN in each licensed connector, attach a cited procedure/TSB and recall reference to a job, and refuse a mismatched engine or expired entitlement.

### Estimates and customer authorization

#### EST-001 — Parts and labor pricing

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Build USD estimates with quantities, labor hours/rates, part cost/selling price, fees, discounts, tax treatment and customer/fleet rate profiles; show totals before tax, tax and balance, and convert accepted lines into the repair and invoice without rekeying. Named customer/fleet labor-rate profiles are explicitly selected for a draft with an exact saved version; they do not create customer accounts or fleet membership. Each revision snapshots its profile and all line prices. Quantities have up to three decimals; USD unit costs and discounts are nonnegative whole cents, and a per-unit discount cannot exceed its unit selling price. Discounted unit price is extended and rounded half up to cents, then line tax is rounded half up; labor profiles replace entered labor rates before the line discount. Fees have an explicit taxable/exempt choice at the shop rate and require customer authorization and recorded actual quantity like other lines. Later profile or tax edits do not reprice accepted work or invoices. The invoice balance is the existing invoice total less issued credits and applied tender net of refunds and account-credit redirection, bounded below by zero. Recorded tender is an allocation, not proof of cleared funds; subtotal, line tax and accepted prices remain frozen. PAY-004 retains its separate pre-invoice deposit and complete split-tender obligations.

**Acceptance.**
1. Prepare mixed labor/parts for a fleet rate, apply a discount and compare the accepted estimate with actuals and invoice cent totals.

#### EST-002 — Canned jobs and pricing matrices

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Version reusable service packages with parts, labor and inspection mappings; configure cost-based parts matrices, labor matrices, minimum charges and rounding, preserving the rule and override reason used on each estimate. Owner/admin version packages and part/labor cost matrices; the owner can record the manager’s reasoned price override when that role has no assigned person. Costs and minima are nonnegative USD cents per part unit or labor hour. Bands start at zero, have inclusive lower and exclusive upper bounds, meet without gaps and end unbounded. Cost plus basis-point markup rounds half-up to whole cents, then upward to the configured cent increment, then the minimum applies. Quantity is unchanged. Each saved draft freezes package, optional exact inspection-template assignment, cost, complete matrix revision, band, intermediate amounts, calculated price and any overriding actor/reason/time. Matrix or package changes affect future drafts only; no package preparation grants work or customer consent.

**Acceptance.**
1. Create an oil-service package and cost matrix, add it from a finding, override one price as a manager, then change the matrix; the old estimate remains reproducible.

#### EST-003 — Customer approval and decline by link

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Send an expiring repair-scoped link by text/email; customers view exact version, evidence, total and terms, approve/decline individual jobs or all work and sign. Decisions retain identity, timestamp, revision, line amounts and consent evidence; a changed price invalidates the old link. Owner/admin email a link for the current person-approved, undecided revision of an estimate or EST-004 supplement through the shop’s configured mail sender to the asset’s customer email, and see it once to share it themselves; each link keeps its send outcome, and text sending is MSG-001’s. Links are revocable, expire no later than seven days under GOV-007 and RL-18, and stop working on a new estimate revision or total, any decision or repair completion. Their authority is excluded from archives. The customer page needs no session and shows the exact revision’s lines, quantities, unit prices, per-line sales tax and totals, DIAG-001 shared findings and the shop’s terms; the customer chooses approve or decline for every line, types a full name and explicitly agrees to sign and receive this record electronically, with the typed name as their electronic signature. Before submitting the decision, the page tells the customer to request a paper copy of the estimate and decision from the repair shop by phone or in person; the signed receipt retains this full consent text. One submission per link records the decision through the exact-revision authorization rules as a link-only customer actor (method “signed link”, typed name, addressee email, UTC time, revision, approved and declined line amounts and approved totals, consent text); an identical replay returns the same receipt and a different second decision is refused. Owner/admin can retrieve the integrity-bound receipt, labelled a typed-name electronic signature with identity not verified beyond possession of the emailed link. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#est-003).

**Acceptance.**
1. On a phone approve one line and decline another, replay the request and try an expired/stale link after a price change; exactly one valid decision is retained and staff can retrieve its signed receipt.

#### EST-004 — Supplemental approval on the same repair

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** New findings or price changes create a separate supplementary version on the existing RO, retaining prior accepted/declined lines, completed work and decisions; only the incremental scope needs fresh consent and refusal does not stop already authorized work. Each supplement is a separately identified estimate linked to the original, with its own reason, revisions, person approval, exact manual handoff and customer decision. A prospective price change explicitly replaces an unworked quantity from an exact authorized estimate/revision/line with the same part/labor kind and quantity at a new nonnegative USD price and the current frozen shop tax basis; higher and lower prices are supported. Pending or declined replacements leave prior authority intact. Accepting the replacement reduces only the prior unworked quantity, rechecking other replacements and actuals atomically; completed quantities keep their original price and tax. Work and invoice rows bind estimate ID, revision and line ID independently, even when line IDs repeat. Every original or supplemental customer decision stores the customer authorizer, method (in person, phone, signed, email reply or other with required evidence/note), server-recorded time, native recorder and exact authorized revised total computed from that revision. Phone decisions lacking identity or evidence are refused. Every invoice snapshots each used scope’s approval and decision; saved exports preserve those sources and remain immutable. Existing ESTIMATE-001 manual sharing is labelled as a recorded handoff, never provider delivery; EST-003 and MSG-001–003 retain customer-link and delivered-messaging requirements.

**Acceptance.**
1. Authorize brakes, start work, discover a rotor and send its supplement; decline it, then approve a new supplement and verify invoice quantities cannot cross authorized revisions.

#### EST-005 — Declined work register

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Keep each declined or deferred repair with reason, evidence, price/version, date and mileage, owner and due trigger; advisors recall it on the next visit and reprice before asking again, never count it as sold. Staff record the exact current customer decision, including a full decline with zero authorized lines, with no work authority from a decline. The register snapshots the observed reading and decision; its follow-up is due at the entered same-unit reading threshold (inclusive) or UTC date (inclusive), whichever arrives first. A later visit prepares a separate current-price draft and needs its own approval and customer decision; the prior decline stays unchanged.

**Acceptance.**
1. Decline tires at 60,000 miles, open the next visit and turn the still-needed item into a repriced estimate with a new decision; history keeps both outcomes.

#### GUIDE-001 — MOTOR labor times

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** With licensed MOTOR access, select exact vehicle/engine and operations, include overlapping-operation adjustments and source/version on an advisor-reviewed labor line; never confuse flat-rate billed time with technician clock time.

**Acceptance.**
1. Select a MOTOR operation, add a related operation with overlap and compare imported hours/provenance to the licensed source before approval.

#### GUIDE-002 — ALLDATA labor and procedures

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** Connect the shop’s ALLDATA entitlement for matched operations, labor times and linked procedures; retain source references and handle unsupported vehicles or lost entitlement as visible exceptions.

**Acceptance.**
1. Build a quote from a licensed ALLDATA vehicle lookup, compare its operation/time, then expire access and show the unresolved lookup without fabricated times.

#### GUIDE-003 — ProDemand estimating and maintenance

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** Use the shop’s Mitchell 1 ProDemand entitlement for vehicle-specific labor operations, maintenance schedules and repair information; operator reviews the selected operation and avoids duplicate included labor.

**Acceptance.**
1. Select maintenance and repair operations from ProDemand on an RO, compare source hours and included work, and retain the reference on the approved estimate.

#### EST-006 — Estimate expiry and approval chasing

*Tier:* Core · *From:* EST-006 · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Configure expiry and signature-request steps, send reminders only for current undecided versions, stop on reply/decision/opt-out and route unanswered or delivery-failed requests to an advisor. Owner/admin (acting as service advisor) keep one versioned chase policy: the approval-link lifetime (1–7 days, default 7) and up to three increasing reminder days (default 2 and 5), each strictly before expiry; every EST-003 link snapshots the policy when sent, and a reminder day is 24 hours after the moment the link was sent. The minute-by-minute reminder schedule sends only for the current, unrevoked, unexpired and undecided revision of an open repair. Each reminder opens that same revision, offers Stop reminders and retains its send outcome; link authority is excluded from archives. One durable claim precedes each provider call; a run sends at most the latest due step per link and a failed or uncertain step is never retried. Reminders stop immediately on a customer decision (link or in-shop authorization) or revocation, and at the next run on a new revision or total, expiry or a closed repair; an owner/admin records a customer reply (phone, in person or email) with a note, labelled as recorded by staff because Mallet does not read mailbox replies (MSG-002/MSG-003 inherit stopping on a threaded reply before they ship). Opt-out: the customer’s approval page offers Stop reminders (same-origin POST on the link, no signature) and owner/admin may record an opt-out the customer gave; it applies to that email address installation-wide for automatic reminders only, never closes an open link or blocks an advisor’s explicit send, and is lifted only by owner/admin recording how the customer asked to resume (MSG-001 text reminders inherit the opt-out record before they ship). EST-007 owns unanswered and failed-send tasks. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#est-006).

**Acceptance.**
1. Send an estimate, advance a scheduled reminder, supersede it and approve the replacement; only the current undecided version is chased and failed delivery opens an advisor task.

#### EST-007 — Approval-chasing recovery tasks

*Tier:* Core · *From:* EST-006 · *Cites:* BASE-MAIL-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** A rejected, rate-limited, uncertain or unconfigured send (first email or reminder) and a current revision that expires undecided (including after an opt-out) each open one advisor task on the repair and the Approvals queue, resolved by owner/admin with a note and never closed automatically; a failed first email also stops that link’s reminders. Technicians retain their job scope. Agent reminder calls carry external under the company’s policy; customer opt-out remains the customer’s act, and scheduler invocation remains a background service door.

**Acceptance.**
1. Reject or interrupt an estimate send or reminder; one visible advisor task retains the related repair and outcome.
2. Let the current revision expire undecided, including after opt-out; its unanswered task remains until an authorized person resolves it with a note.

### Workshop execution and technician work

#### FLOW-001 — Live repair and technician boards

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Show intake, diagnosis, approval, parts, work, quality, ready, collected and closed stages with assignment, customer, due date, priority and blockers; filter and search, enforce allowed transitions and retain canceled/lost work. Stages derive from each repair’s own records in this precedence: closed (canceled, lost, or collected with the invoice exported), collected, ready (completed after QUALITY-001 clearance), quality (recorded work with the assigned technician’s current sign-off or a post-work check result), approval (any estimate or supplement undecided, or every one declined), parts (customer-authorized with a staff-reported required part not physically received), work (customer-authorized), diagnosis (a DIAG-001 diagnosis or DVI inspection exists), then intake; a card moves only when its gated command succeeds, so work needs customer authorization and ready needs quality clearance. Due is the current customer pickup promise, else the booked end; overdue means now is at or after the promise. Owner/admin set normal, high or urgent priority with a reason and kept history; cancel or mark lost an open repair with no recorded work and no running timer (reason, stage and actor kept, bay and technician freed, shown under Closed); and record collection only on a completed repair whose invoice a person approved: staff type the collector’s name, and the immutable record keeps the recorder, time and invoice number and status, historically labelled “Collection recorded by staff. Mallet did not record or verify payment, keys or the collector’s identity.” New collection uses RETURN-001’s documented-handover gate, exact evidence and staff-check label; old observations are not retroactively certified. Filters cover one technician (lead or helper), stage, priority, customer-promise status and search over customer, email, vehicle, plate/VIN, title and invoice number; technicians see only repairs they are on; the board re-reads current records on every load and every 60 seconds.

**Acceptance.**
1. Move several realistic ROs through the board, filter one technician and overdue customer promise, and try to skip authorization/quality gates.

#### FLOW-002 — Promise times and capacity

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-DATA-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Set a customer promise separately from bay booking; show parts ETA, labor remaining and resource dependencies, warn before a promise is missed, and require an advisor to approve and communicate any revised promise. Owner/admin act as the service advisor and approve original promises or exact proposed revisions; assigned native technicians may update required-part ETAs and resource dependencies only for currently assigned repairs. The pickup promise is separate from the bay/technician booking. Every part or dependency edit appends its source, reason, actor and UTC time; a staff-reported ETA is never supplier confirmation or physical receipt. Labor remaining is current customer-authorized sold labor less performed quantities and accepted replacements, excluding timers. The planning finish is the latest of now, booking start, unreceived part ETAs, and unfinished dependency booking/projected finishes, plus remaining labor hours. The plan warns before pickup when that finish exceeds the promise or an unreceived part is past ETA; now at or beyond pickup is overdue. These calculations never move a booking. Revising a promise requires an owner/admin to review the exact prior promise, plan, dependency versions, recipient and remaining work, then approve and claim one email through the configured Base mail sender. The original promise and all revisions remain. Receipts retain exact old/new times, reason, approving actor, recipient and provider outcome. Failed or unconfirmed promise notices remain visible for advisor action without automatic retries. Customer pickup promises and mail render in the configured installation time zone with its IANA name (America/New_York by default), preserving daylight-saving changes. Owner/admin may change the shop zone with a reason; its version is rechecked before approving a notice, and each notice retains the zone used. Staff operational times may use the browser zone while showing the shop zone. Historical claimed sends cannot be replayed after restore.

**Acceptance.**
1. Delay a required part beyond a promised pickup, inspect the affected bay/technician plan and approve one revised promise; preserve original promise and customer notice receipt.

#### FLOW-003 — Rules-based routing and escalation

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Route intake by location, repair type, skill and priority; escalate unassigned, approval-waiting, parts-stalled or diagnostic exceptions to a named manager on shop-hour deadlines, with acknowledgment and resolution history. Routing assigns one case handler without changing approved technician dispatch. Exact location, repair-type and declared-skill labels plus the board priority match rules in saved order; the first active matching handler wins and an existing active handler is retained. Each blocker episode snapshots its policy and calendar; deadlines count whole real minutes whose shop-local starts are open (opening inclusive, closing exclusive), skipping closed dates, counting repeated DST minutes twice and missing minutes zero. At the due instant, the next routing run records one durable internal escalation task, never a message-delivery claim; acknowledgment and source-backed resolution preserve the episode history.

**Acceptance.**
1. Submit two repair types, run routing and advance a closed-day deadline; one assigned handler receives each case and an unacknowledged blocker escalates once.

#### TIME-001 — Employee clock and job timers

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Technicians clock in/out, break and start/pause/resume job labor from their assigned board; distinguish attendance, actual time, sold hours and nonbillable work, require reasons for corrections and handle concurrent timers by shop policy. Native staff clock only their own attendance and one job timer at a time; starting/resuming needs the current job assignment and an open attendance interval outside a break. Pause before starting a break or clocking out; end a break before clocking out. After reassignment, a technician can stop their already-running own timer, granting no new work authority. Billable, nonbillable and rework intervals remain separate from authorized sold labor hours and invoiced actual quantities; timers never create work authority or billing entries. Server UTC instants persist across requests; elapsed seconds retain milliseconds, attendance less breaks gives net attendance, and job seconds sum separately. Board clocks show elapsed timer time rounded to the nearest minute, with minute carry. Today’s sold hours use the UTC date of the recorded customer decision. Staff propose corrections only to their own stopped intervals with exact prior version, timezone-bearing start/end and a reason; owner/admin approve the exact immutable proposal and an owner can decide when the manager role has no assigned person. Approval rechecks versions, non-overlap and attendance bounds; all original intervals, proposals and deciding actors remain. Staff see only their own time, owner/admin read shop time, agent reads are sensitive and follow the sponsor’s scope and the company’s policy. OPS-001 archives retain exact histories under fresh native authority; historical identity never becomes self-service authority.

**Acceptance.**
1. Clock in, run two jobs with a break, correct a missed stop with manager approval and compare attendance, actual and sold hours; a member cannot alter a colleague’s time.

#### FLOW-004 — Technician crews and subtasks

*Tier:* Core · *From:* FLOW-004 · *Cites:* BASE-INPUT-003, BASE-AUDIT-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Assign multiple technicians and subtasks with private notes, mentions, attachments, dependencies and handover acknowledgment; preserve per-person work and prevent unassigned staff from changing restricted jobs. The booked technician leads a repair; owner/admin (acting as service advisor) add or remove helper technicians (active technicians only). A current helper has exactly the lead’s job-scoped technician access (read the repair, run their own timers, record work, diagnosis, inspection results and media) and loses it at the next request after removal; quality sign-off stays the lead’s. Every timer, work line, diagnosis and note stays attributed to its author. Subtasks have one crew assignee and may depend on earlier subtasks of the same repair (acyclic by construction); the lead or owner/admin create them, and only the assignee or owner/admin completes one, refused until every dependency is complete. Staff notes are private to the repair’s current crew and owner/admin, excluded from customer links, receipts and unassigned technicians; agent access uses the sponsor’s scope and the company’s sensitive policy; a note may mention only people who can already read the repair (owner/admin or crew), resolved by the server from active operators, and the mentioned person sees it under Waiting for you until they mark it seen; attachments are references to that repair’s existing completed inspection media. FLOW-005 governs the acknowledged technician handoff.

**Acceptance.**
1. Mention an advisor on a private diagnostic note and complete a dependent subtask only after its dependency; inspect crew attribution and both technicians’ time.

#### FLOW-005 — Acknowledged technician handoff

*Tier:* Core · *From:* FLOW-004 · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** The lead or owner/admin proposes a handoff to another active technician with a required work-state note, refused while the lead has a running timer on the repair or another handoff is waiting; it takes effect only when the recipient acknowledges it (or declines with a reason), and the previous lead leaves the crew unless the proposal keeps them as a helper. Acknowledgment writes an immutable handover receipt: from/to, proposer, note, proposed and acknowledged times, open subtasks and each person’s billable, rework and nonbillable seconds on the repair.

**Acceptance.**
1. Propose a diagnostic handoff without changing the lead; accept it as the recipient and inspect the exact handover receipt.
2. Preserve both technicians’ time and open subtasks, or decline with a reason and keep the prior assignment.

#### WARRANTY-001 — Warranty and comeback work

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Link a comeback to original invoice, VIN/serial, installed part/lot, failure, mileage and warranty terms; distinguish shop, supplier and OEM responsibility, approve coverage, track claim/rework costs and retain the original paid repair. Owner/admin save versioned shop-declared terms with inclusive UTC time bounds and an absolute reading limit in the declared unit (no conversion). A comeback snapshots the original approved invoice, staff-recorded paid tender evidence, terms, asset identifier and installed lot/serial provenance; later edits never reprice that repair. Coverage and shop/supplier/OEM responsibility require an explicit immutable human decision, and covered rework uses its own customer-authorized zero-price actuals. Cost entries bind those actuals once. Supplier/OEM claims are approved records only, with separately evidenced submitted/accepted/rejected/credited histories; no outbound claim or accounting posting is inferred. BUY-006, BOOKS-003 and OEM-001/002 retain connected remittance, posting and authorized provider submissions.

**Acceptance.**
1. Return with the same symptom within coverage, open a linked rework RO, approve no-charge labor and a supplier claim, then compare comeback cost and preserved original invoice.

#### RETURN-001 — Paid and documented handover

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Ready status requires quality evidence; collection records actual customer and delegate, keys and accessories, mileage, receipt and warranty advice. Unpaid release requires explicit permitted manager override; no payment screenshot or agent inference counts as settlement. Collection through the command and native form requires current QUALITY-001 clearance, the latest signed comparison of the latest before-condition custody checklist, an active mileage-out reading, actual collector and staff identity-check evidence, warranty advice and an immutable printable receipt. Owner and admin record customer-granted delegate authority with explicit evidence; revoked authority is refused. Fresh Stripe succeeded USD intents bound by the exact invoice identity must have paid, captured, unrefunded charge evidence covering the invoice; each handover rechecks the provider, current state and native session. This means processor-confirmed captured funds, not a verified bank payout. A zero-total invoice needs no payment and explicitly says no processor check was needed. Screenshots, caller flags and restored receipts do not satisfy settlement; staff tender follows the exact-revision rule below. GOV-001 governs delegated unpaid-release authority. A reasoned unpaid-release exception binds the exact invoice, expires within 24 hours and never records payment. An agent’s release decision carries commitment under the company’s policy. Historical FLOW-001 collections retain their old honest label and are not retroactively certified. Documented handover ends all temporary unlock purposes. Collector identity is checked by staff, not verified by Mallet. GOV-001 and GOV-004 inherit expanded authority and identity controls; PAY-001/002/004/007 inherit connected payment and settlement extensions. A disputed Stripe charge, or a test-mode receipt on a production installation, does not satisfy settlement. Staff-recorded cash, check or shop-defined tender (PAY-004, PAY-007) covering the exact invoice revision also opens handover, labelled 'Tender recorded by staff; Mallet did not verify funds' (checks add 'not cleared'). An invoice on an owner-approved account with open terms (AR-001, FLEET-001) opens handover labelled 'Released on account terms; balance due <date>'. The unpaid-release exception warns that release may end the shop's possessory lien (RETURN-002). AR-001 and FLEET-001 use the labelled open-terms handover gate; selecting reviewed active account terms at handover requires fresh confirmation and current credit-limit review.

**Acceptance.**
1. Try collection with a failed test and unpaid invoice, then settle through the processor and hand keys to an authorized delegate; inspect receipt and any override.

#### RETURN-002 — Storage, abandoned property and repair liens

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-11

**Requirement.** Mallet applies the shop's state rules, kept as versioned data with sources. The rules cover: when storage charges start; abandoned vehicle and device notices (method, recipients including lienholders, timing); the possessory or mechanic's lien amount; lien sale or disposal. Notices, their delivery evidence and deadline clocks attach to the repair. Release ends accrual and records any lien waived. Disposal needs the owner, completed statutory steps and a recorded legal review, and never erases history. Mallet tracks deadlines and evidence; it gives no legal advice.

Conservative storage slice (sx-mallet-c-i931, ct approval pending): only the fresh-confirmed current owner publishes immutable, source-linked California or Texas rule records and opens a completed repair's ledger after recording ready notification, agreed terms, reviewed recipients including lienholder search, and legal applicability. Owner-entered grace hours, whole-cent daily rate and cap, notice deadline days and minimum wait days are frozen on the repair; they are not supplied statutory values. Completed elapsed 24-hour periods accrue in arrears, with no automatic invoice charge. The estimated repair principal is bounded by the reviewed amount and current invoice balance. Notice copies, delivery evidence, recipient list, deadline clocks and case-specific legal reviews append to retained history. Every disposal attempt is refused: timely notice and review alone do not establish complete statutory compliance. Documented RETURN-001 handover atomically freezes accrual and records the relinquished possessory-lien estimate, exact handover and actor without certifying legal effect or payment of storage fees. New records inherit OPS-001 archives and the existing GOV-006 custody and hold rules; historical records confer no disposal authority. No legal advice or automatic outbound or destructive action is provided.

**Acceptance.**
1. In a California shop and a Texas shop, leave a repair uncollected, accrue storage, record the notices on schedule, refuse early disposal, then release on payment.

#### FLEET-001 — Fleet and commercial repair workflows

*Tier:* Core · *From:* FLEET-001 · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Handle fleet purchase-order numbers, driver versus authorizer, credit limits, payer terms, FLEET-002 billing and vehicle downtime; require the fleet’s allowed authorizer and preserve per-vehicle cost history. Owner-approved open terms must open RETURN-001 handover labelled “Released on account terms; balance due <date>”, retaining the exact account approval, invoice and due date. The terms door requires an owner-recorded PO and the unchanged billing snapshot’s allowed authorizer matching the current fleet account. This records a staff-reviewed assertion, not automated verification of the fleet manager. Per-vehicle cost means the retained invoice charge; the displayed interval is booked start to recorded completion, not verified off-road downtime. The current repair-decision door requires the current owner to record the unchanged fleet account revision, current allowed authorizer, PO and explicit approval evidence before any lines are authorized; a driver or bearer link cannot grant fleet repair authority. This is a staff-reviewed assertion, not identity verification. Term invoice copies retain their exact term assignment, due date, PO, lines and amounts, and use the existing explicit one-attempt Base mail door to the current unchanged accounts contact with its current email preference; no delivery is claimed. The displayed vehicle interval remains booked start to recorded completion, with no verified off-road claim. A separate recorded-custody projection pairs the documented handover with its retained same-visit signed before-condition intake, exposing source identifiers and revisions, observation and recording times and the frozen invoice charge. Missing, conflicting or open custody endpoints remain unknown or open; the recorded evidence does not verify off-road downtime. The governing recorded decision is RL-4.

**Acceptance.**
1. A driver drops off a fleet van, the fleet manager approves against its PO, accounts receives a term invoice and a statement drills to that van’s downtime/cost.

#### FLEET-002 — Fleet billing and statement reconciliation

*Tier:* Core · *From:* FLEET-001, FLEET-002 · *Rules:* D-1, D-2, D-3

**Requirement.** Keep consolidated fleet statements, billing reconciliation and per-vehicle cost and downtime drill-through, distinguishing retained invoice charges and booked-to-completed intervals from verified vehicle downtime (RL-21).

**Acceptance.**
1. Send the fleet term invoice and reconcile its consolidated statement to each van’s retained charge and downtime interval.

### Parts, inventory and purchasing

#### PART-001 — Shop parts catalog and traceability

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Maintain SKU, supplier/OEM cross-references, vehicle fitment, unit, locations, serial/lot, cost, selling price, warranty and supersession; trace a consumed lot or serial from receiving to repair and customer. Catalog cross-references, fitment and warranty are shop declarations, not supplier/OEM verification. Receiving freezes its catalog, supplier lot/serial, bin, unit cost and source evidence. Owner/admin identifies a physical lot against already recorded customer-authorized part actuals, without adding a customer charge; usage is bounded by both that actual and remaining lot quantity and appends the negative stock movement. Recorded receipt unit cost is extended half-up to USD cents; later catalog changes never rewrite received provenance or installed cost. A serial represents one whole unit. Count variance for tracked stock identifies the affected lot and cannot make a serial fractional. PART-003 retains atomic work/reservation consumption, cancellation releases, returns and the separate Pier movement authority; PART-005 retains supplier returns/RMAs and BOOKS-003 retains accounting journals.

**Acceptance.**
1. Receive two lots of the same SKU, install one and search the supplier lot; only affected ROs and vehicles appear.

#### PART-002 — Barcode receiving and stock counts

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Identify parts and storage bins by scanned or entered barcode, receive labeled quantities, run blind/cycle counts and approve variance adjustments with reasons; track on-hand, reserved and available separately and prevent silent negative stock. Part and bin identification accepts a scanned or entered barcode. Stock quantities use integer thousandths of each part’s declared unit without conversion. The append-only movement ledger derives on-hand; active repair reservations are separate and available is on-hand minus reserved. Barcode receiving retains labeled and physically received quantities and their shortage; a unique receipt reference prevents repeated receipt. Blind and cycle count entry screens withhold expected balances; submitting a count proposes no movement. Owner/admin approval retains a reason, actor and UTC time, refuses intervening stock movements or a result below reserved stock, and appends the variance once. GOV-001 governs purchasing roles and limits; PART-003 governs consumption and cost allocation, PART-008 transfers and BOOKS-003 journal posting.

**Acceptance.**
1. Scan a shipment and bins, count a shortage and approve its adjustment; stock ledger and receiving/variance reports reconcile.

#### PART-003 — Repair reservations and consumption

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Reserve required parts to a repair, commit actual usage/cost on work, release on cancellation and reverse only through a recorded return. Use Mallet’s repair stock ledger or an explicitly selected Pier inventory authority with idempotent commands and conflict reconciliation. Recording work may identify an exact active reservation and physical lot; actual work, frozen lot cost, reservation consumption and negative stock movement commit in one transaction or none do. Cancellation releases every remaining reservation in the same transaction. A recorded inspected saleable return appends a positive movement against the original use, bounded by its unreturned quantity; it never deletes usage, changes authorized work or refunds a customer. Supplier-return custody cannot also become a saleable return.

**Acceptance.**
1. Reserve the last item for one RO, refuse a competing reservation, consume it and cancel another job; retry a Pier movement and prove source and repair ledger agree once.

#### BUY-001 — Purchase orders and goods receipts

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Create supplier POs from repair demand or stock needs with approved spend, ship-to, tax/freight and expected date; receive full/partial/backordered quantities against the PO, allocate to waiting ROs and match supplier bill before closure. GOV-001 governs the purchasing roles and limits for preparation and approval of the exact PO spend. Supplier tax and freight are recorded USD cents, each quantity uses integer thousandths of its part unit, and each extended unit cost rounds half-up to cents before summing. Goods receipt requires a matching part barcode, bin and unique receipt reference, adds only physically received quantity and reserves repair-demand receipts to the linked open RO. Outstanding quantity remains a backorder. Owner and admin operators may short-close all outstanding quantities with a required reason, actor and UTC time. The immutable decision retains original approval, ordered and physically received quantities and receipt references; it creates no stock movement and prevents later receipt of the short-closed quantity. Closure then requires a new bill matched to physically received quantities after the short-close, with the original approved unit costs, tax and freight; earlier bill exceptions remain visible. Bills retain sequential immutable versions and supplier invoice numbers; exact approved quantities less explicitly short-closed quantities, unit costs, supplier tax and freight must match cumulative physical receipts before closure. A changed bill remains an exception until a corrected bill matches; earlier exceptions remain visible. These are staff records, not supplier order submission, payment or accounting-posting claims; BUY-002 retains submission/acknowledgment and BOOKS-003 retains posting.

**Acceptance.**
1. Approve a two-line PO, receive one line and part of another, retain the backorder and match a changed supplier bill as an exception.

#### BUY-002 — Supplier stock and approved ordering

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Compare current supplier availability, compatible part grade, price, delivery cutoff, freight and ETA; require buyer approval of exact supplier/cart/amount and reconcile acknowledgment, substitution, cancellation and rejected order without duplicate purchase. Owner/admin compare current offers through the shop-authorized supplier-ordering gateway, with observed/expiry times, compatible grade, quantity, USD price, cutoff, freight/tax and ETA. The exact supplier, quote, cart, ship-to and amount are frozen in human spend approval; expired, past-cutoff, incompatible and insufficient offers are refused. Submission requires a fresh human proof and explicit audited confirmation, is claimed durably before its one POST, and uses a stable idempotency key. Concurrent, timed-out and restored claims reconcile by client-reference GET only. Only matching supplier/quote/cart/amount and stable order identity become acknowledgment; substitutions remain separate unapproved proposals, with explicit rejection, cancellation and rejected-order histories. Receiving requires an exact acknowledgment. Credentials use the existing owner-only declaration/sealed-key/revocation door; comparison sends only SKU/unit/quantity and submission only the approved cart/ship-to/opaque reference. BUY-003/004/005 retain direct licensed supplier adapters and inherit these approval/replay obligations; GOV-001 retains finer purchaser roles and BOOKS-003 posting. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#buy-002).

**Acceptance.**
1. Compare two suppliers, approve a cart, replay a timed-out submission and process a rejected substitution; one acknowledged order is linked to the repair.

#### BUY-003 — PartsTech catalog and orders

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** Connect the shop’s PartsTech account for VIN-aware catalog search, supplier stock/cost and order placement from an RO; retain quote freshness, order IDs, acknowledgments, ETA and returns references.

**Acceptance.**
1. Search a licensed PartsTech test account for a VIN-specific part, approve an order, receive its acknowledgment and partial receipt and show its linked RO cost.

#### BUY-004 — Nexpart catalog and orders

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** Use WHI Nexpart credentials and distributor access to quote matched parts and availability, approve orders and track status/returns with source order IDs; uncertain fitment stays unresolved.

**Acceptance.**
1. Find and order a part through an authorized Nexpart connection, simulate an unavailable line and compare acknowledgment and returned credit with the RO.

#### BUY-005 — Worldpac sourcing and orders

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** Connect authorized Worldpac/speedDIAL ordering for vehicle-matched SKUs, price, branch availability and delivery; import confirmed order and receipt, and retain cores/returns and credits against original lines.

**Acceptance.**
1. Select a Worldpac part, approve the order, receive a delayed shipment and process a return/credit without losing original cost or promised ETA.

#### PART-004 — Core deposits and returns

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Separate core charge from sale price/tax under configured rules; track customer/supplier core due dates, deposits, returned condition, shipment and supplier credit, and alert before a core credit expires. Owner/admin track a core against a separately customer-authorized one-unit fee on an approved original invoice and its installed lot. The existing configured fee tax is frozen separately from sale price. UTC customer/supplier deadlines and a configured advance window create visible due/expiry alerts. Physical return condition and external shipment evidence are immutable. Supplier credit documents reconcile independently from customer liability, with adjusted/partial credit exposure retained. Only the owner, with fresh confirmation and customer original-tender instruction, issues the existing credit note for the original core fee and its original tax; a refund outcome is separately evidenced, never inferred. Original invoices are unchanged. BOOKS-003 inherits connected vendor-credit posting.

**Acceptance.**
1. Sell a core-bearing alternator, collect deposit, send the old core and reconcile an adjusted supplier credit; the core exposure and invoice correction tie out.

#### PART-005 — Supplier RMAs and defective parts

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Create linked supplier returns for faulty, unused and warranty parts with reason, serial/lot, original PO/RO, authorization, label, shipment and expected credit; quarantine defective stock until disposition. Owner/admin identify a lot against its original approved PO goods receipt without receiving it again; part, bin, supplier, quantity and unit cost must match. Faulty, unused and warranty returns retain original PO, installed-use/RO and approved warranty references. Physical unused stock is removed from saleable on-hand into separate quarantine; a removed installed part enters only quarantine, never on-hand again. Supplier RMA number/label and shipment require recorded external evidence. Disposition is explicit and reasoned; a failed installed part cannot be restocked. Append-only supplier credit documents retain partial-credit exposure and the linked rework cost less these credits. No supplier action, customer charge or accounting posting is inferred. BOOKS-003 and BUY-006 inherit posting/remittance.

**Acceptance.**
1. Remove a failed installed part, quarantine it, obtain an RMA and reconcile partial credit; repair warranty cost and stock both remain traceable.

#### PART-006 — ETA and special-order follow-through

*Tier:* Core · *Cites:* BASE-MAIL-001, BASE-AUDIT-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Link each special part to its RO and approved charge, expose acknowledged ETA and delays, notify purchaser/advisor on change, and update availability only after receiving staff confirms actual arrival. Special-order evidence records the supplier, order reference, exact customer-authorized part revision/line and remaining quantity, acknowledgment text and timezone-bearing ETA (stored in UTC); it is labeled staff-recorded, not provider-verified, and does not claim Mallet placed an order. Backorder, ETA change and receipt create retained internal owner/admin advisor notices, with review attribution; these notices do not send email/SMS. Receipt records the full linked quantity, receiving reference, actual arrival time and recorder, cannot be repeated or silently reopened, and is required before recording consumption of the linked part. The same record updates FLOW-002’s versioned plan and invalidates stale promise reviews; a changed ETA alone never establishes receipt. Actuals and INVOICE-001 remain the sole billing path at authorized prices, with no extra special-order charge.

**Acceptance.**
1. Backorder a special part, change supplier ETA and receive it; waiting RO and promise review update, and the invoice includes only approved charges once.

#### PART-007 — Low-stock replenishment

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Configure min/max by location, demand and preferred supplier; low-stock alerts prepare reviewable replenishment POs/carts with open orders deducted, and never treat a suggested order as placed. Owner and admin operators configure minimum, maximum, additional unreserved demand and preferred supplier per stock bin/location. Quantities are thousandths without conversion. Projected stock is available plus outstanding stock orders minus additional demand; below minimum a draft fills to maximum. Repair-specific orders are excluded; unlocated stock orders are allocated once in stable bin order. Repeating preparation retains the same draft; changed inputs supersede it and require fresh exact-spend approval. A suggested or approved PO is never labeled placed. BUY-002 inherits actual submission and GOV-001 finer purchasing roles.

**Acceptance.**
1. Consume below minimum with an outstanding PO, run replenishment twice and approve the resulting cart; only unmet demand is ordered once.

#### PART-008 — Inter-store transfers

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Move stock between locations through request, approval, dispatch, in-transit and receipt with serial/lot/cost custody; shortages and damaged receipts create exceptions rather than duplicate stock. Owner/admin request and approve exact sending/destination bin/shop labels, traced lot/serial quantities and frozen unit costs. Approval moves nothing; dispatch rechecks unreserved availability and removes sending stock once into transit. Receipt records every line, adds only undamaged received quantities and retains shortages in transit and damaged units in separate quarantine. A fresh reasoned custody correction records recovered receipt, return to source, confirmed loss or witnessed destruction once; resolved means every exception has a disposition, not that every unit arrived. Serial units remain whole, and child lots preserve original provenance and cost. Stock counts cannot recreate a serial already available at another location, in transit or quarantined. BOOKS-003 inherits transfer journals.

**Acceptance.**
1. Transfer a serialized part between shops, receive one unit short and inspect sending, in-transit and receiving balances plus approved correction.

#### BUY-006 — Supplier and warranty compensation reconciliation

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Match supplier invoices, credits, freight and core charges to PO/receipt/repair cost, and warranty labor submissions to allowed hours/rates and remittance; exceptions go to a purchaser/manager before BOOKS-003 posts the bill or vendor credit to the connected QuickBooks Online, Xero or Pantry ledger.

**Acceptance.**
1. Process a short delivery, changed supplier price and underpaid warranty labor claim; reviewed adjustments reconcile to the BOOKS-003 bill and vendor-credit postings in the connected ledger and to RO margin.

#### BUY-007 — MobileSentrix US parts

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** For device benches connect MobileSentrix US catalog, SKU compatibility, supplier stock/cost and approved cart handoff; preserve supplier order and receipt references and never claim a cart is a placed order.

**Acceptance.**
1. Choose a compatible phone part, approve a MobileSentrix cart, complete supplier checkout and receive the actual shipment into the linked ticket.

#### BUY-008 — Injured Gadgets order sync

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Authenticate Injured Gadgets order-ID/OrderSync capture, map purchased SKUs to reviewed POs and GRNs, receive full/partial shipments and track cost/returns; imports cannot purchase or receive twice.

**Acceptance.**
1. Capture an actual authorized supplier order, preview mapping, import twice and partially receive it; one PO and correct remaining balance exist.

### US invoicing, payments and accounting

#### INV-001 — USD invoices and customer delivery

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Issue numbered USD invoices and printable/PDF receipts from authorized actuals, including customer/vehicle/mileage, sold labor, parts, sublet, discounts, fees, tax, deposits and warranty terms; deliver by email/text and retain exact issued versions and legacy history with original cent amounts and tax basis. The governing recorded decision is RL-5.

**Acceptance.**
1. Finish a mixed US repair, issue and deliver the invoice, reopen a legacy export and verify each currency and total; corrected invoices reference their original.

#### TAX-001 — US parts and labor sales tax

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-11

**Requirement.** Configure location/jurisdiction rates and effective dates, separate parts/labor/sublet/fee taxability and rounding, tax-inclusive/exclusive pricing and exemptions; optionally calculate through Avalara or TaxJar and retain provider evidence. Corrections reverse the original tax basis.

**Acceptance.**
1. Invoice taxable parts and exempt labor in two configured US jurisdictions, then refund one part; compare tax cents, rule versions and tax-provider responses.

#### TAX-002 — Exemptions and shop fees

*Tier:* Core · *Cites:* BASE-AUDIT-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-11

**Requirement.** Retain exemption or resale certificate, scope and expiry; configure shop supplies, disposal or environmental fees, discounts and legally permitted surcharges with visible basis and consent, and report tax collected by jurisdiction for filing. The owner may explicitly apply an in-date certificate to a new draft revision of its unchanged repair billing account; scope and inclusive UTC dates are checked at application, and earlier decisions and invoices stay frozen. Supplies rules retain discounted pre-tax parts or labor basis, a percentage in basis points, half-up cent rounding and a USD cap. The exact fee and basis are disclosed before recorded customer consent; the resulting draft still requires approval and customer authorization. Raw certificates stay private; issued documents disclose only the applied reference, jurisdiction, scope and dates. The current filing-period preview uses inclusive UTC event dates and labels all unresolved credit transfers and redirected refunds for review. Owner-observed clearance is a private original-tender evidence record, not independent bank confirmation. With explicit current-owner original receipt evidence and jurisdiction legal-basis review, direct original-tender account credit reverses its source credit tax on the review UTC date; its destination invoice recognizes tax on the later application or review date, as a credit adjustment without new cash. Unattributed and nested credit sources remain excluded. A completed recorded manual refund after failed-refund redirection reverses the original tax once; incomplete outcomes do not. Deposit attribution uses the later invoice allocation or recorded clearance date and retains the original receipt date; no legal deposit-tax treatment or completed return is claimed. The governing recorded decision is RL-6.

**Acceptance.**
1. Apply a fleet exemption and capped supplies fee, expire the certificate and refund a taxed line; invoice disclosures and jurisdiction tax report match the recorded rules.

#### PAY-001 — Stripe card and ACH collection

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-8

**Requirement.** Use the merchant’s Stripe account for hosted card/wallet and ACH payment entry plus supported Stripe Terminal devices; confirm payment from authenticated provider events, model pending ACH/returns and reconcile payment/payout/fees to the invoice without storing PAN or bank credentials.

**Acceptance.**
1. Pay a test invoice by card and ACH, deliver duplicate/out-of-order events and an ACH return, then reconcile the payout; one payment allocation per provider event is retained.

#### PAY-002 — Square counter and online payments

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3 · *Register:* R-8

**Requirement.** Connect the merchant’s Square account, supported reader/terminal and hosted online payment links; capture counter status, cancellations, refunds and settlements with provider IDs and idempotent application to the correct invoice/location.

**Acceptance.**
1. Collect through a Square sandbox terminal/payment link, cancel an attempt and replay its webhook; invoice and settlement ledger reflect only the completed payment.

#### PAY-003 — Text-to-pay and mobile wallets

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Send a repair-scoped balance link supporting processor-hosted cards, Apple Pay and Google Pay where eligible; show invoice, payments and current balance, expire replaced links and preserve SMS delivery distinct from paid state.

**Acceptance.**
1. Text a balance link to a phone, make a partial wallet payment in provider test mode, reopen the link and verify remaining balance; link receipt alone never marks paid.

#### PAY-004 — Deposits and split tenders

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-DATA-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Collect deposits before parts ordering, partial payments and split tenders across cash, card, ACH, paper check and shop-defined manual tenders (PAY-007); allocate one payment to one or more customer/RO/invoice balances with clear unallocated credits, refund rules and no double application when a deposit becomes final payment. The native command ledger records pre-invoice cash, check or shop-defined tender against an explicit customer account, optionally earmarked for an open repair. Unallocated credit is received tender less allocations and recorded original-tender refunds. Allocation creates invoice tender once without new cash, only for the same current payer account and earmarked repair, with exact invoice revision and balance checks. Unallocated earmarked deposits are refunded only after cancellation; allocated tender follows PAY-005 invoice credit and refund rules. ct adopted the deposit authority and custody policy: only the current owner records, allocates or refunds deposits, with explicit recorded customer instructions for each action and a fresh enrolled authenticator or passkey proof within five minutes. A recent email sign-in, recovery code or local development session alone never substitutes for that factor. Unallocated deposits remain private records, absent from non-owner reads, exports and revenue totals; existing allocated invoice tender visibility remains. Allocation and unallocated credit cause no provider call or transfer. Cancellation never refunds automatically; an original-tender refund is a separate owner action with fresh proof and the customer’s recorded instruction, recording observed facts without moving money. Recorded deposits and allocations stay labelled as unverified funds; they never claim provider confirmation or clearance. GOV-001 inherits delegated finance authority.

**Acceptance.**
1. Take a deposit, finish a repair and split the remainder across cash, card and a check; cancel another repair and refund its deposit, reconciling all balances.

#### PAY-005 — Refunds exchanges and customer credits

*Tier:* Core · *From:* PAY-005 · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Authorized staff issue partial/full refunds to original tender, credit notes, accessory exchanges and customer credits with reason, tax reversal and provider outcome; restrict amounts to refundable balance and track disputed or failed refunds. GOV-001 governs bounded refund rights for manager, cashier and advisor roles and finance reads for the accountant; GOV-004 supplies refund step-up. An agent’s refund or credit call carries money, decided by the company’s policy; an agent’s binding credit decision also carries commitment. Each credit is bounded by the exact reviewed invoice lines, quantities and uncredited recorded tender, and carries a staff-recorded customer instruction. A native staff submission binds the exact approved transaction. Agent submissions follow the company’s money policy; an uncertain effect remains reserved and requires explicit resolution before any new submission. A pending or uncertain refund stays reserved until read-only provider reconciliation resolves it. A refund the processor reports failed or canceled may be redirected once, by the owner, with a new staff-recorded customer instruction, to account credit on the same current account or to a staff-recorded manual tender; this releases exactly that reservation. Credit never moves between accounts. The payer sees typed amounts, methods and statuses only. GOV-001 may delegate bounded refund/credit verbs and finance reads, with current permission, exact transaction approval, step-up and immutable original-tender history enforced at every financial command. (RL-108). PAY-008 governs uncertainty and redirection. The governing recorded decision is RL-7. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#pay-005).

**Acceptance.**
1. Refund a returned part, exchange an accessory and apply a credit to another RO; duplicate provider events cannot over-refund or change issued invoice history.
2. exact owner-reviewed credit notes retain immutable original invoices and saved exports; line quantities and recorded tender bound cumulative refunds and account credit.
3. Original frozen pretax and tax cents are reversed by cumulative quantity with half-up rounding, so a full return reverses the exact original cents.
4. Account-credit backing leaves the original paid balance and may be allocated once to an approved invoice of the same current account; an accessory exchange links returned parts to a separately authorized replacement invoice.
5. Manual original-tender outcomes are owner-recorded, not money moved or verified by Mallet.

#### PAY-008 — Uncertain refund recovery

*Tier:* Core · *From:* PAY-005 · *Rules:* D-1, D-2, D-3

**Requirement.** Keep a processor refund reserved while pending or uncertain. GET-only reconciliation resolves its observed state; failed or canceled outcomes may be redirected once to same-account credit or a recorded manual tender on a fresh exact instruction. Original invoices, tender history and cumulative refundable quantity remain unchanged (RL-108). The governing recorded decision is RL-7.

**Acceptance.**
1. A confirmed Stripe submission is claimed durably once; uncertain outcomes use GET-only reconciliation, and repeated provider outcomes cannot add another financial effect.
2. Restores never submit refunds.
3. Current payer sessions see typed amounts and statuses, not staff narratives or raw provider evidence.
4. Also (ct 22 Oct 2026): a failed Stripe refund is redirected once to account credit and applied to another RO of the same account; a second redirect, a redirect of an uncertain refund, and a redirect to another account are refused; refunded plus credited never exceeds recorded tender.

#### PAY-006 — Consumer financing

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-8

**Requirement.** Offer Sunbit, Affirm and Synchrony Car Care through approved provider/processor programs, clearly disclose customer terms in provider-hosted applications and record funded/denied/canceled/refunded status; eligibility, onboarding and underwriting remain provider decisions.

**Acceptance.**
1. From a test repair offer each provider’s approved test flow, decline one and fund another; record actual funding before collection and propagate a partial refund to financing.

#### PAY-007 — Paper checks and shop-defined tenders

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Record a paper check with check number, payer (customer, fleet account or third party), bank, check date and amount, applied across one or more invoices or held as an unallocated account credit. Configure shop-defined manual tender types, for example a warranty administrator’s corporate card or a trade account, each with a name, active state, whether it counts in the cash drawer and its deposit or clearing account, and each posting to QuickBooks Online or Xero under its own name (BOOKS-001/BOOKS-002/BOOKS-003). A returned or bounced check is recorded against the original payment with reason, date and an optional configured returned-check fee; it reopens every affected invoice balance and AR ageing, flags the payer and posts a reversal to the books without editing the original payment. Checks and each manual tender appear by count and total on the drawer close and the daily close (POS-001 and REPORT-005) and are grouped into a bank deposit batch, with a printable deposit slip listing check numbers, whose total matches the bank deposit. The clearing door records immutable owner-observed evidence for an original check or other-tender payment or deposit, including observed UTC date, bank evidence reference, recorder and instruction. It moves no money, does not verify the bank and cannot represent a returned-check reversal. Retain an append-only authorized observation linked to the original payment and label it owner-observed; only independent bank evidence may establish verified clearance. (RL-109).

**Acceptance.**
1. Take one fleet check paying three term invoices, one retail check and a payment on a shop-defined “Warranty administrator card” tender; close the drawer and build a deposit batch listing check numbers and totals.
2. Bounce the retail check with a fee: its invoice balance reopens, AR ageing changes and a reversal reaches the QBO sandbox, while the original payment stays unchanged.
3. The fleet statement, the REPORT-005 close and the deposit batch tie out to the cent.

#### POS-001 — Retail counter and cash drawer

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Sell accessories/parts without a repair, apply barcode scanning, customer credits and tax, issue receipts, and reconcile opening float, cash in/out, checks and each shop-defined tender by count and total (PAY-007), drawer close and variance by cashier/location, ending in a bank deposit batch that separates cash from checks.

**Acceptance.**
1. Sell a scanned accessory, return one, split tender between cash and a check and close the drawer with a variance; cash movement, check list, deposit batch and daily sales reports reconcile.

#### AR-001 — Terms statements and payment follow-up

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Offer approved commercial terms, credit limits and account statements, track ageing and promised payments, send consented reminders for unpaid or partial invoices and pause chasing disputed or paid balances. Owner-approved open terms must open RETURN-001 handover labelled “Released on account terms; balance due <date>”, retaining the exact account approval, invoice and due date. The statements age current ledger balances at a selected UTC date; they are not historical balance snapshots. Net days run from the recorded invoice-terms assignment UTC date. Credit-limit review includes all approved outstanding invoices of the current payer. Promises suppress reminder eligibility through their promised date; open disputes and zero balances also suppress it. Terms, disputes and promises are append-only owner-reviewed records, ordered by retained ledger sequence. The current owner may explicitly release on reviewed active commercial terms, within the current credit limit, after fresh confirmation. The exact invoice revision, original assignment, current account approval and due date are retained with the handover; restored approvals cannot authorize destination release. Explicit owner-requested email balance reminders require the current billing contact’s email preference, exact current balance, fresh owner confirmation and per-send consent evidence. They request payment before or after the due date without asserting overdue status; disputed, paid and unexpired promised balances are suppressed. Each reminder reference has one durable attempt and permits no automatic retry. GOV-001 and GOV-004 inherit delegated reminder authority. The governing recorded decision is RL-8.

**Acceptance.**
1. Issue two fleet term invoices, settle part of one by check, dispute the other and run reminders; only eligible outstanding balance is chased and statement totals match AR.

#### AR-002 — Scheduled and automated balance-reminder sequences

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-DATA-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** only the fresh-confirmed current owner schedules one email for an exact invoice, current billing recipient, outstanding balance and consent evidence. Scheduling snapshots the exact message, invoice version, terms approval, contact version, recipient IANA timezone, allowed hours, due instant and expiry within 31 elapsed days. A durable claim precedes handoff; current eligibility and owner authority are rechecked, and failed or uncertain sends never retry automatically. Payment, credit, dispute, an unexpired promise, changed terms or contact, and the installation-wide automatic-reminder opt-out suppress pending email. Restore retains history without runnable authority. Messages request payment before or after the recorded due date without claiming overdue status. Full versioned sequences, complete consent provenance and advisor failure tasks remain named Gaps. Human review preserves the original failed or uncertain outcome and grants no retry or sending authority. AR-001 manual reminder authority is unchanged. Send only the approved current-balance reminder under current recipient consent and suppression, with explicit recovery for failed or uncertain handoff and no restored sending authority. (RL-101).

**Acceptance.**
1. Run scheduled reminders for unpaid and partial invoices; only eligible outstanding balances are chased, with disputed and paid balances suppressed.

#### BILL-001 — Recurring service agreements

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Manage maintenance/service agreements with covered assets, recurring approved invoices through merchant processor, visit entitlements, renewal notices and cancellation terms; keep actual repair and extra-work authorization distinct from subscription charges.

**Acceptance.**
1. Enrol a fleet maintenance agreement, invoice its next period once, consume a covered visit and approve extra work separately; cancel and verify no later charge.

#### BOOKS-001 — QuickBooks Online two-way sync

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Connect QuickBooks Online with explicit customer, invoice, payment (by tender type, including checks and shop-defined tenders under PAY-007), credit, refund, sales-tax, account, class and location mappings, and post the cost-side and cash entries of BOOKS-003: supplier bills from received POs carrying the supplier invoice number, vendor credits for parts returns and core credits, authorized sublet cost, processor fees and payouts, drawer cash in/out and over/short, and inventory transfers and adjustments. For each entry type the shop chooses individual posting or a daily per-location summary that lists its source records. Sync allowed changes both ways, preserve source authority, reconcile totals and route conflicts/errors without duplicate posting.

**Acceptance.**
1. Post a paid RO to a QBO sandbox, edit a permitted payment there, import it, then replay webhooks and break an account mapping; each side reconciles and the broken item stays visible.
2. Receive a PO with a supplier invoice number, return one of its lines and pay a sublet; the sandbox shows one bill, one vendor credit and one fee expense, each linked to its Mallet source record, and replaying every job and webhook creates no duplicate.

#### BOOKS-002 — Xero two-way sync

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Provide the same explicit customer/invoice/payment/credit/refund/account/tax mapping, the BOOKS-003 cost-side and cash postings (supplier bills, vendor credits including core credits, sublet cost, processor fees and payouts, drawer movements, inventory transfers and adjustments) with the same individual or daily-summary choice, and exception handling for a shop using Xero, with chosen system-of-record fields, sync checkpoints and duplicate-safe repair-history links.

**Acceptance.**
1. Send a mixed-tax invoice and refund to a Xero demo organization, record a payment there and reconcile it in Mallet; revoked access queues an actionable exception.
2. Receive a PO and return one line; the organization shows one supplier bill and one credit note linked to their Mallet source records, and replay posts neither twice.

#### BOOKS-003 — Cost and cash postings to the books

*Tier:* Core · *Cites:* BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Post every movement that changes cost of goods, payables or cash to the connected QuickBooks Online or Xero company (or Pantry), each mapped to a chosen vendor, account, item/class and location and linked back to its Mallet source record: a supplier bill when a PO receipt is matched to its supplier invoice (BUY-001/BUY-006), with the supplier invoice number as reference; a vendor credit for each parts return, RMA credit and supplier core credit (PART-004/PART-005); a bill to the sublet vendor at cost when SUBLET-001 receives its bill; processor fees as expense and payouts as transfers to the bank account (PAY-001/PAY-002/MONEY-001); check and shop-defined tender deposits (PAY-007); drawer paid-in, paid-out and over/short (POS-001); and inventory transfers, count adjustments and cost of goods on consumption as journal entries (PART-002/PART-003/PART-008). Per entry type the shop chooses individual posting or a daily per-location summary listing its source records. Corrections post as reversing or adjusting entries, never as edits inside a locked accounting period; a locked period, missing mapping or revoked connection holds the entry as a visible exception. Replay, retry and reconnection never post twice.

**Acceptance.**
1. In a QBO sandbox and a Xero demo company, receive a two-line PO with a supplier invoice number, return one line with a core credit, pay a sublet, settle a card payment and its payout, record a drawer paid-out and transfer stock between two locations.
2. Each system shows the bill, vendor credit, sublet bill, fee expense, payout transfer and journal entries, each opening its Mallet source record.
3. Switch fees to daily summary and post a second day, then replay every job and webhook: no entry appears twice, and the period gross profit in the books equals REPORT-002.

#### MONEY-001 — Payment disputes and settlement close

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-8

**Requirement.** Link chargebacks, evidence deadlines, processor fees, refunds, financing remittances and payout adjustments to original repair consent/quality/delivery evidence; managers approve evidence submissions and reconcile gross receipts to net bank deposit.

**Acceptance.**
1. Open a provider test dispute on a signed repair, assemble and approve its evidence, then compare a payout with fees/refunds to the shop close report.

#### SUBLET-001 — Sublet work and outsourced services

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Track approved outsourced machining, towing, calibration or specialist work with supplier, custody, PO, cost, ETA and customer price; receiving and quality sign-off are required before billing and return. Sublets link existing person-approved, customer-authorized service fee lines with their selected frozen tax treatment; added scope links a separately authorized incremental line without changing earlier decisions. Custody handoffs, ETA revisions and full supplier bill revisions retain recorded evidence, actor and UTC times. A bill predating added scope leaves actual cost and margin pending until a current-scope bill is recorded. Margin is the frozen customer subtotal before customer sales tax less the full supplier bill (including supplier tax/freight), in USD cents; the percentage divides that difference by the customer subtotal and rounds to two decimals, and is unavailable for a zero subtotal. Each sublet change invalidates prior repair quality clearance; receiving and current QUALITY-001 clearance gate completion, which precedes invoice preparation and collection. Supplier/PO and bill entries are staff records, not order submission, payment or accounting-posting claims; BUY-001 and BOOKS-003 keep those existing obligations.

**Acceptance.**
1. Send a cylinder head to an outside shop, record delayed return and supplier bill, approve added scope and reconcile sublet margin and custody.

### Customer communication and follow-up

#### MSG-001 — Two-way repair SMS with Twilio

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Send and receive texts/MMS through the shop’s Twilio number, thread them on the customer/RO, retain consent and opt-out state, handle US A2P registration and delivery failures, and prevent customer or vehicle cross-thread leakage.

**Acceptance.**
1. Complete Twilio-approved test messaging with an inbound reply/photo, STOP and failed delivery; preserve transcript and suppress later nonpermitted sends.

#### MSG-002 — Gmail repair conversations

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Connect a shop Gmail/Google Workspace mailbox using minimum OAuth permissions, send from its identity and attach replies to the right customer/RO using message/thread IDs; show revoked access or ambiguous matching for human resolution.

**Acceptance.**
1. Send an estimate from a Google test mailbox, reply from the customer and revoke OAuth; the reply appears once on the RO and later delivery has an actionable error.

#### MSG-003 — Microsoft 365 Outlook conversations

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Connect shop Outlook/Microsoft 365 with Microsoft Graph OAuth for approved shared/user mailboxes; preserve reply threading, permissions, attachments and sent/delivery status while private staff notes remain internal.

**Acceptance.**
1. Send from a Microsoft 365 test mailbox, reply with an attachment and remove shared-mailbox authority; only authorized conversations appear and blocked sends are surfaced.

#### PORTAL-001 — Customer repair portal

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Customers securely view their own asset service history, inspection, current status/promise, exact estimates, decisions, invoice/payment history and warranty, ask questions and book follow-up; scoped links and account sessions prevent guessing or cross-customer access. SMS sign-in arrives with MSG-001. The governing recorded decision is RL-9.

**Acceptance.**
1. Sign in as a household and fleet payer, review two visits and pay one invoice; try another customer’s IDs and expired links and receive no private data.
2. A customer requests an email link and confirms the request.
3. Every request gets the same response and timing; requests are limited per address and client.
4. Links are single-use, expire in 15 minutes and sign in only after confirmation on the opened page.
5. Each sign-in starts a separate account session that ends after 24 hours, at sign-out, or when the contact, its version, its account membership or the payer changes.

#### AUTO-001 — Appointment confirmation and reminders

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3, D-4, D-5, D-6, D-7, D-8, D-9

**Requirement.** Send confirmations, pre-visit instructions and time-based reminders via chosen email or SMS channel, including reschedule or cancel links, local shop time and quiet hours; stop replaced or canceled appointments and record failed delivery for staff. Appointment consent rider: an affirmative request for one appointment confirmation permits that confirmation only. Later reminders and pre-visit instructions require affirmative permission identifying the appointment, email channel and intended message purpose. Permission for appointment service messages does not permit declined-work or promotional outreach. Immediate booking confirmations retain BOOK-001 behavior. Replaced or canceled appointments suppress affected pending reminders. The complete target retains customer-chosen email or SMS, reminder series, reschedule and cancel links, local shop time, quiet hours and failed-delivery visibility. The governing recorded decision is RL-10.

**Acceptance.**
1. Book, reschedule and cancel appointments around a US DST change and run the scheduler; only current eligible reminders arrive, in the recipient’s allowed hours.

#### AUTO-002 — Status and pickup notifications

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-DATA-003, BASE-DATA-006, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Approved stage changes send customer-safe diagnosis, approval-needed, parts-delay, ready and pickup notices using versioned templates; deduplicate events, respect channel preference and escalate failed pickup contact or uncollected property under shop policy. Only the freshly confirmed current owner records affirmative customer email preference for this repair and separately approves one exact customer-safe message per observed stage event and notice type. Permission records the recipient, repair-status purpose, exact wording and version, customer time with UTC offset, capture channel, evidence reference, recorder and capture time. Stored contact details, repair authorization and silence are not permission. Diagnosis details never populate messages automatically. Approval binds the exact current stage, repair and source revisions, recipient, message and template version, recipient IANA timezone, allowed hours, send instant and absolute expiry within 31 days. Unknown permission, changed sources, withdrawal, erasure, collection or an expired approval prevents handoff. A durable claim precedes the single Base mail handoff; cron replay and restart never resend a claimed event. Failed or interrupted status handoffs require an owner resolution and never retry automatically. The owner sets an explicit pickup follow-up deadline and policy for each ready or pickup notice. Failed pickup contact and an elapsed deadline on an uncollected ready repair create private owner tasks visible on the repair list, with attributable manual resolution. There is no automatic fee, disposal, title action, payment or repair authority. Withdrawal suppresses pending and future repair-status email; owner approval cannot override it. MSG-004 inherits this suppression at future send doors. OPS-001 preserves exact permission, approved content, source, outcomes and task history while excluding installation-local send authority; restoration cannot recreate a send or a runnable escalation from historical approval. DATA-001 and GOV-006 retain existing authorization custody and holds; erasure revokes local status-send authority even under a hold. No automatic deletion or retention schedule is introduced.

**Acceptance.**
1. Advance an RO to waiting parts then ready, replay the event and let pickup lapse; each eligible notice sends once and the uncollected case reaches staff.

#### AUTO-003 — Time and mileage service reminders

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Compute due services from licensed maintenance schedules, last performed work, actual odometer/time and customer preferences; send attributable reminders with booking links, stop sold/returned vehicles and surface unknown current mileage for confirmation.

**Acceptance.**
1. Close a 60,000-mile service, advance time and add a later odometer reading; only genuinely due consented recommendations generate reminders and completed work suppresses them.

#### AUTO-004 — Declined-work follow-up

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3, D-4, D-5, D-6, D-7, D-8, D-9

**Requirement.** Schedule advisor-approved follow-up by declined item, urgency, mileage or time and expiry, refresh price and availability before outreach, and stop on acceptance, repeat decline, opt-out or a finding no longer applicable. Declined-work consent rider: follow-up requires separate affirmative customer permission for email about the identified declined item; appointment-message permission and repair authorization do not supply it. The interim approval permits one email for that item. The complete target retains advisor-approved scheduling by item, urgency, mileage or time and expiry, refreshed price and availability before outreach, and cessation on acceptance, booking, repeat decline, opt-out or a finding no longer applicable. Previous repair and consent decisions remain unchanged. The governing recorded decision is RL-11.

**Acceptance.**
1. Decline brakes, later record eligible mileage, approve a refreshed quote and send follow-up; booking or approval stops the cadence and preserves previous decisions.

#### AUTO-005 — Review and satisfaction requests

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-AUDIT-001, BASE-DATA-003, BASE-DATA-006, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** After verified completion and collection send consented review requests for Google Business Profile and customer satisfaction, using consistent eligibility without review gating; route negative or private feedback to staff and show delivery, response and attribution. Only the freshly confirmed current owner records separate affirmative customer permission and explicitly approves one immediate email for a paid documented handover. Permission retains the recipient, review purpose, exact wording and version, customer time with UTC offset, capture time and channel, source evidence reference and recorder. The invitation uses an owner-entered HTTPS Google Business Profile review link, not the Google API. A durable claim permits one Base mail handoff per handover across replay and restart; failed, interrupted or uncertain attempts require a recorded owner resolution and never resend. Staff-recorded tender retains its existing unverified-funds label; unpaid exceptions, account-term releases and no-charge visits are ineligible. No rating or prior feedback enters eligibility. The private seven-day link identifies only its request, stores only a hash outside archives and permits one private response or permission withdrawal. Every rating sees the same public-review invitation before and after responding or withdrawing; feedback is never automatically published or sent onward. Every private response creates an owner-only FLOW-004 task that the current owner can complete after collection. Responses are attributed to the private-link holder, not an authenticated customer identity. Permission withdrawal suppresses further review requests; owner approval cannot undo it. MSG-004 inherits that suppression for future review-send doors. OPS-001 preserves attributed permission, exact approved message, outcome, response and task history, while excluding review links and installation-local send authority. Restored permission cannot send without fresh destination permission and approval; historical task assignment grants no authority. DATA-001 and GOV-006 retain their existing hold and authorization-custody rules: erasure revokes review links and local send authority even under a hold, erases eligible private responses with personal data and preserves exact permission and email approval history with other authorizations. This introduces no automatic deletion or retention schedule. Use one separately consented review invitation per eligible handover, offering the same public-review option regardless of rating, with current withdrawal suppression and no automatic resend (RL-102).

**Acceptance.**
1. Complete a paid collection, send the request once, submit a poor private response and verify the public-review invitation remains equally available and staff receives a task.

#### AUTO-006 — Warranty and contract renewal follow-up

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Schedule warranty checks and service-contract renewals using actual coverage dates, vehicle ownership and consent; link a reported issue to original repair and stop renewals after cancellation or vehicle transfer.

**Acceptance.**
1. Advance a warranty check and maintenance renewal, reply with a repeat symptom and cancel another agreement; create the linked case without unwanted renewal sends.

#### MSG-004 — Communication controls and searchable history

*Tier:* Core · *Cites:* BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Version templates, support customer language preferences, show sent/delivered/failed/replied states, search/export transcripts and honour consent, suppression and quiet hours across manual, scheduled and agent sends. No background send is hidden as a draft.

**Acceptance.**
1. Change an SMS template, opt out through an inbound message and attempt a manual and automated send; transcript shows exact content/policy and both respect the suppression.

### Reporting and multi-shop management

#### REPORT-001 — ARO and car-count reporting

*Tier:* Core · *From:* REPORT-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Report average repair order, completed vehicle count, estimate approval/close ratio, sold/declined work and advisor performance with explicit denominators, shop timezone, exclusions and date/location filters; every figure drills to source ROs and decisions. REPORT-007 governs the cohort funnel.

**Acceptance.**
1. Complete/void/refund a known set of ROs, compare ARO/car count/close ratio with independent arithmetic and drill every component to the underlying record.
2. Current single-installation reporting distinguishes completed repair count from the approved-invoice ARO denominator: pretax discounted invoice sales per approved/exported completed repair, half up to cents; dates are inclusive in the configured shop timezone.
3. Customer-decision volumes use the exact original revision and decision date, with partial approval counting as an accepted decision and percentages half up to tenths; supplements and later canceled/lost repairs retain their original decisions.
4. These volumes are not realized sales or settled payment.
5. Issued credit notes reduce the completed repair’s original sales and tax once, including before the refund completes; refund outcomes never subtract the same credit again.
6. A fully credited invoice is excluded from car count and the ARO denominator, with the original invoice, credit and repair sources retained.

#### REPORT-007 — Repair sales cohorts and funnel

*Tier:* Core · *From:* REPORT-001 · *Cites:* BASE-AUDIT-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Report root-estimate cohorts and their approval, completion, collection and closure conversions with the declared denominators and source repairs. Later cancellations and supplements retain their original decision history.

**Acceptance.**
1. The close funnel groups root estimates by preparation date and follows their current decisions, completion, collection and export; approval and close divide by estimates, completion by approved estimates, and collection by completed repairs.
2. Closed means collected with an exported invoice.
3. Booking recorders are compared as accountable advisors until GOV-001 adds finer advisor attribution; all comparisons expose their sales and cohort source repairs.
4. Multiple-location reporting remains a named SHOP-001 gap.

#### REPORT-002 — Repair and parts profitability

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001, BASE-DATA-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Show gross profit and margin by repair, parts/labor/sublet, technician, advisor, service, supplier and location using actual purchase cost, loaded labor, discounts, core/refund adjustments and warranty rework; distinguish estimated from realized margin. The owner declares versioned loaded hourly costs separately from payroll wages; GOV-001 governs scoped advisor and manager margin access with separately controlled cost detail. SHOP-001 supplies location comparison. Every rate revision retains its effective date, amount, basis, reason, actor and timestamp. A dated correction may recompute the selected repair-cohort projection without rewriting source invoices, approved timer history, published results or accounting records. Missing cost remains unavailable rather than zero. Received costs, discounts, credits, refunds and warranty recovery reconcile once; report access grants no send, purchase, payment, payroll or accounting-posting authority. Retained priced-package snapshots keep their original service revision after a later rename; missing historical source links remain explicit. The full selection, allocation, cost and attribution rules stay in [profitability](docs/profitability.md), and OPS-001 retains their source history. The governing recorded decision is RL-12.

**Acceptance.**
1. Receive a higher-cost part, finish a discounted repair and a comeback, then compare estimated/realized margins and source cost events.

#### REPORT-003 — Technician efficiency and productivity

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Report sold-versus-actual hours, efficiency, productivity/utilization, attendance and nonbillable/rework time, with clear formulas and drill-through to timers, edits and assignments; staff access follows role. Sold hours are customer-authorized labor on repairs currently assigned to the technician, dated by the UTC date of the customer decision; actual hours are billable job-timer time; efficiency = sold ÷ actual billable hours; productivity (utilization) = all job-timer time (billable, nonbillable and rework) ÷ net attendance (attendance less breaks). Intervals use their latest approved TIME-001 revision, clipped to an inclusive UTC date range (a running interval counts to now); percentages round half-up to one decimal. Payroll-sensitive hourly rates are owner-only: set with an inclusive UTC effective-from date and a reason, every revision retained, the greatest effective-from on or before a date applying (ties to the latest save); pay cost is each attendance interval’s net time at the rate in effect on its UTC start date, half-up cents, and unrated time is shown as unrated. Owner and admin read every technician’s hours, members read only their own row, and agent report reads carry sensitive under the company’s policy.

**Acceptance.**
1. Clock two technicians through billable and rework jobs, adjust one timer and recompute the report from clock events; unauthorized staff cannot see payroll-sensitive rates.

#### REPORT-004 — Turnaround and customer promises

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Report cycle time and time in each stage, overdue promises, wait-for-parts/approval causes, booking no-shows, DVI completion/engagement and warranty comeback rates; compare locations and periods with retained history. Current report semantics: the documented operation selects repairs by booking creation in an inclusive UTC date range. Durations are integer milliseconds. Cycle time is booking creation to actual completion, absent until completed; stage time continues until cancellation/loss or both collection and invoice export, otherwise the report time. Completion variance is actual completion minus the promise in force at completion (negative is early). Stage transitions retain their triggering native events atomically with the command; only observed history is reported, and older repairs without booking-stage evidence are explicitly incomplete rather than backfilled. The report follows existing workshop job visibility; its stage evidence inherits OPS-001. Booking attendance is an immutable current-owner observation after a confirmed appointment starts; unknown attendance is excluded from the no-show denominator. DVI completion uses the latest recorded result for each point on assigned snapshots in the booked-repair cohort. Engagement is reviewed reports with at least one page request, with repeated requests counted separately and no verified-human claim. Comebacks count completed repairs in the booked cohort with at least one retained warranty case, including later cases; multiple cases count the original repair once. Ratios use half-up tenths of a percent and absent denominators remain unavailable. The native report retains existing job visibility; members receive no appointment, report-view or warranty custody. Location comparison remains SHOP-001. The governing recorded decision is RL-13. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#report-004).

**Acceptance.**
1. Run repairs with controlled waits and a comeback, then drill the delay report and promised-versus-actual completion to the exact stage events.

#### REPORT-005 — Daily financial and inventory close

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Produce sales, tenders by type (including checks and shop-defined tenders), bank deposit batches, deposits, refunds, returned checks, AR ageing, sales tax, parts valuation, slow stock, supplier/core credits and drawer/processor reconciliations; close a period and record later corrections without rewriting its issued snapshot.

**Acceptance.**
1. Close a day containing split payments, deposit, refund, stock variance and core return; reports tie to item ledgers and the subsequent correction remains separate.

#### REPORT-006 — Scheduled reports and portable data

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Save report filters, schedule permission-scoped email delivery, export CSV/XLSX and documented API datasets, and use migrated history in reports with explicit provenance/coverage rather than silently starting at cutover. Personally saved filters retain fixed inclusive UTC dates and never grant report access. XLSX exports contain data cells without formulas. Current-owner schedules require fresh confirmation and explicit recorded recurring consent, send CSV only to that owner’s unchanged native email, and recheck active owner role, account version and address per occurrence. One durable claim prevents replay; failed or uncertain handoff disables future delivery. Local schedule authority is excluded from archives; restored consent and delivery receipts are evidence only. Delivery receipts retain a content digest hash rather than another copy of private report contents. The governing recorded decision is RL-14. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#report-006).

**Acceptance.**
1. Schedule a location manager’s report and export the same period; totals include reconciled imported history, and revoked recipients lose report access.

#### SHOP-001 — Multiple shops and location controls

*Tier:* Core · *Cites:* BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Run distinct US locations with local tax/timezone, hours, invoice numbering, stock, staff and merchant/ledger mapping; share customers with permission, transfer repairs/parts and compare consolidated results without mixing tenants or merchant funds.

**Acceptance.**
1. Operate two locations in different states, move a vehicle/part and restrict a location manager; consolidated metrics reconcile while the manager cannot mutate the other shop.

### Connected tools and mobility

#### HARDWARE-001 — Labels receipts and scanners

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-5

**Requirement.** Print repair/part/barcode labels on supported DYMO and Zebra devices and customer receipts on Star printers, with declared US paper/label sizes; USB barcode scanners select the intended asset/SKU and reprints are marked without duplicating stock.

**Acceptance.**
1. Through the declared printer and scanner transport fixture print and scan a repair label on DYMO and Zebra, print a Star receipt, disconnect a printer and recover the pending print without new receiving events.

#### CAL-001 — Google Calendar scheduling

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Connect Google Calendar with explicit per-technician mapping, availability visibility and chosen two-way fields; event IDs, cancellation, recurring-event exceptions and conflicts reconcile without publishing private repair details.

**Acceptance.**
1. Book and reschedule from Mallet and a Google test calendar, edit one recurring exception and revoke access; one linked event and an actionable conflict remain.

#### CAL-002 — Microsoft 365 Calendar scheduling

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Synchronize approved appointment/resource fields with Outlook/Office 365 calendars using Graph, preserving source authority, timezone and conflicts; private findings/consent never go into shared event bodies.

**Acceptance.**
1. Create an appointment, change its time in Microsoft 365 and replay notifications; conflict handling requires advisor resolution and only one event exists.

#### OEM-001 — Apple GSX authorized repairs

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-7

**Requirement.** For eligible device shops connect their own Apple GSX program account for warranty entitlement, repair/diagnostic status, authorized parts and claim outcomes; preserve OEM references and require staff approval before submissions/spend.

**Acceptance.**
1. Using approved OEM test access, validate serial entitlement, submit a reviewed repair/parts request and reconcile a rejected claim; no access is implied for an ineligible shop.

#### OEM-002 — Samsung GSPN authorized repairs

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-7

**Requirement.** Connect an eligible shop’s Samsung GSPN account for serial/warranty lookup, service requests, diagnostics references, parts and reimbursement state, under OEM access agreements and auditable staff approvals.

**Acceptance.**
1. Run a permitted GSPN test repair, obtain authorization and parts status, then reconcile warranty compensation and a failed submission without duplicate claims.

#### SHIP-001 — ShipStation mail-in and return logistics

*Tier:* Core · *Cites:* BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Manage mail-in bench repairs through ShipStation with incoming/outgoing labels, carrier tracking, insurance/value, packaging/custody, return address verification and exception follow-up; charge only approved shipping and release only after return clearance.

**Acceptance.**
1. Create a mail-in device repair, receive its tracked parcel, finish and pay the repair, print a return label and handle a delivery exception with preserved custody.

#### STORE-001 — Shopify storefront connection

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Connect a separate Shopify device/accessory store for product/SKU, authorized stock availability, online orders, taxes, payments, returns and repair-booking handoffs; source orders reconcile once and never create fictitious repair consent.

**Acceptance.**
1. Place a Shopify test accessory order and return it, then book a repair handoff; stock/credit reconcile without duplicate payments or unapproved labor.

#### STORE-002 — WooCommerce storefront connection

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Connect a shop’s WooCommerce storefront through authenticated API/webhooks with mapped products, stock authority, orders, refunds and booking links; surface stale/conflicting updates and do not double-count online payment as counter cash.

**Acceptance.**
1. Receive an authorized WooCommerce test order, replay its webhook and refund a line; one order, correct stock and provider-linked payment remain.

#### API-001 — Documented shop API

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-AUDIT-001, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Offer versioned scoped APIs for customers/assets, bookings, inspections, estimates/decisions, ROs, parts/orders, work and finance with pagination, stable external IDs, idempotent writes and per-action authorization; API parity enables custom inventory tools without a second product. A current owner using a native session and fresh privileged-action confirmation under GOV-004 may create and revoke installation-local API clients. Grants explicitly select named resource-read and preparation scopes; finance reads and decisions use their separate capabilities. Empty, unknown and wildcard grants are refused. Expiry defaults to 24 hours and accepts only integer values from 1 through 720 hours. AGENT-001’s preparation scope does not expand implicitly. Authorized shop staff and integrations receive audited, revocable delegated client management, bounded renewal or rotation, order and inventory reads, and separately scoped receiving, allocation and fulfilment writes. Grants must enforce installation, resource and action boundaries and applicable location boundaries. Financial reads and decisions require separate explicit capabilities and preserve exact customer consent, current revisions and provider authority. Client tokens, token hashes, grants and retry receipts are excluded from archives and restoration. Restored product records, stable external IDs and historical attribution confer no authority. A fresh destination owner must issue new grants, and pending integrations must reconcile retained product state before resubmitting work; cross-restoration retry deduplication is not claimed. The governing recorded decision is RL-15.

**Acceptance.**
1. Using a scoped client follow a repair from intake through receipt, retry a write and page history; the client cannot approve or view money without its explicit capability.

#### API-002 — Webhooks and visible integration recovery

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-MAIL-001, BASE-DATA-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Deliver signed versioned events for booking, inspection, approval, parts, status, invoice and payment to Crank/Zapier or custom consumers; use durable outbox, deduplication, bounded retries and operator replay, showing provider health and failed actions. Only the fresh-confirmed current owner explicitly approves an HTTPS endpoint and selected event families. Signed schema version 1 envelopes contain business identifiers, event type and occurrence time, not customer details or provider credentials. Signing keys are generated once, sealed under installation configuration, rotated without changing event identity and removed on stop. Each delivery is claimed durably before handoff. Explicit retryable HTTP refusals receive at most three attempts with backoff; an interrupted or timed-out handoff becomes uncertain and needs a reasoned owner replay. Consumers must atomically deduplicate the stable event_id before applying a business change. Endpoint authority requires its still-active originating owner and never survives archive recovery; only non-secret subscription metadata, exact event envelopes and attempt history are portable. GOV-001 retains delegated operator rights; GOV-004 step-up and OPS-001 fresh destination authority remain required.

**Acceptance.**
1. Receive signed events in a Crank workflow and controlled endpoint, return failures, rotate keys and replay; consumers apply each business event once and staff sees remaining exceptions.

#### MOBILE-001 — Responsive staff and customer work

*Tier:* Core · *Cites:* BASE-ACCESSIBILITY-001, BASE-INPUT-003 · *Rules:* D-1, D-2, D-3 · *Register:* R-1, R-2

**Requirement.** Counter, advisor, technician, parts, manager and customer workflows support the 1440 and 390 layouts. Media capture, customer decisions and payment are usable on phones; repair tables retain readable context and reachable actions.

**Acceptance.**
1. At both widths run intake to collection, parts receiving, clock/DVI capture and customer approval/payment; inspect each end state and complete keyboard navigation without clipped actions.

#### MOBILE-002 — Native iOS and Android workshop apps

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003 · *Rules:* D-1, D-2, D-3 · *Register:* R-4

**Requirement.** Provide real iOS/Android technician/advisor apps with camera VIN/media scanning, assigned job clocks, DVI, secure push and interrupted-connectivity capture; encrypted queued drafts revalidate permissions/version before sync and never fabricate remote approval/payment offline.

**Acceptance.**
1. Install both apps, capture an inspection without connectivity, reconnect after a role/version change and resolve the conflict; revoked users lose access and push contains no private media.

### Move-in and continuity from incumbent systems

#### MOVE-001 — Tekmetric move-in

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-DATA-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** Read Tekmetric Customers Download CSV for the register, exported financial/parts reports and an authorized API JSON capture for available vehicles/ROs/decisions. Move the shop setup and stock under MOVE-013: canned jobs (Smart Jobs) with their labor, parts and fee lines, the parts pricing matrix, labor rates, shop fees (supplies, EPA/disposal), inspection templates, vendors with account numbers and inventory on hand with bins, quantities and cost, taken from authorized API capture where the shop’s API access exposes them, Tekmetric report exports otherwise. Obtain a vendor-assisted history/media archive for records neither route covers; the documented self-service export covers only the customer list. Retain exact source fields/IDs, report filters and snapshot time; a customer CSV alone never passes history acceptance.

**Acceptance.**
1. Import a real owner-authorized source capture spanning paid/open ROs, declined work, deposits and inspection media; reconcile customer populations beyond filtered customer reports, counts, dollars and attachment access; reproduce three Smart Jobs and one matrix-priced part with the source totals and reconcile inventory per SKU and bin as MOVE-013 requires.

#### MOVE-002 — Shopmonkey move-in

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** Read list exports and XLSX templates for customers/fleets, vehicles, vendors, parts and canned fees, plus canned services, labor rates, pricing matrices, inspection templates and inventory with bins, quantities and cost into MOVE-013 setup; ingest All Time XLS reports including Line Item Detail, All Invoices and All Payments plus authorized API JSON orders. Capture inspection/media/signature originals separately when API coverage is incomplete; blank cells never silently erase existing data.

**Acceptance.**
1. Import a Shopmonkey archive with fleets, line items, payments and media, review All Time/filter coverage and duplicate mappings, then reproduce a historical RO and opening AR with exact consent artifacts.

#### MOVE-003 — Mitchell 1 Manager SE move-in

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-DATA-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** Process an owner-supplied native Manager SE database backup with an explicit database/schema adapter and associated media files; use MM Create Data Export File Followup.csv for contact/follow-up data and PDF invoices as labeled source evidence. The database adapter also extracts canned jobs, labor rates, parts pricing/markup tables, shop supply and hazardous-waste fees, inspection checklists where present, vendors with account numbers and inventory with locations, quantities and cost into MOVE-013 setup. The filtered CSV/PDF route is not a substitute for structured repair, recommendation, setup, inventory and balance migration.

**Acceptance.**
1. Restore an authorized database copy into an isolated extraction tool, preview source counts and map customer/vehicle/RO IDs, invoices, recommendations, balances, canned jobs and inventory; open matching PDF/media evidence and reconcile an open RO at cutover.

#### MOVE-004 — Shop-Ware move-in

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-MAIL-001, BASE-DATA-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** Import Shop-Ware AR invoice CSV and report deliveries for Customer Information, Customer Invoices, Service Details and Parts Details; arrange its vendor-assisted offboarding archive for full relationships and media, including canned jobs, pricing matrices, labor rates, shop fees, inspection templates, vendors with account numbers and inventory with bins, quantities and cost for MOVE-013 setup, each declared in the delivery manifest. Discover/declare each supplied schema and eligible API permissions rather than assuming public full-history API/export coverage.

**Acceptance.**
1. Preview a real delivered archive with its manifest/sample validation, import all agreed records and media, and reconcile history, declined work, estimates, AR, canned-job totals and inventory per SKU and bin; unresolved vendor extraction remains an explicit blocking item.

#### MOVE-005 — AutoLeap move-in

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-MAIL-001, BASE-DATA-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** Accept the owner’s actual AutoLeap customer exports and invoice-history reports, its inventory report export, plus vendor-assisted data/media delivery that also carries canned services, labor rates, pricing matrices, shop fees, inspection templates and vendors with account numbers for MOVE-013 setup. Verify encoding, file type, headers, report filters and schema from the supplied sample before mapping; no unverified universal CSV, full-history API or QBO sync is claimed as a complete archive.

**Acceptance.**
1. Obtain an authorized export/archive and sample manifest, validate format through preview, then reconcile vehicles, historical/open work, payments, declines, inspection evidence, canned-service totals and inventory per SKU and bin; every unavailable object has a visible extraction task.

#### MOVE-006 — RepairDesk move-in

*Tier:* Core · *Cites:* BASE-INPUT-003 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** For a device bench import actual RepairDesk customer/inventory CSV exports and repair-ticket Excel (.xls) exports plus authorized invoice/payment reports and attachment originals; preserve ticket status, device serials, warranty, approvals and supplier/part relationships, declaring unsupported source fields before apply.

**Acceptance.**
1. Preview supplied RepairDesk CSV/XLS files and media manifest, reject mismatched ticket references and reconcile a warranty comeback, serialized stock and partial-payment ticket.

#### MOVE-007 — Orderry move-in

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-DATA-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** Import Orderry customer/product spreadsheet exports and authorized API JSON captures for work orders/estimates/payments; where historical work orders need support-assisted extraction, ingest the delivered archive with original identifiers and media manifest rather than a claimed universal work-order spreadsheet.

**Acceptance.**
1. Move an authorized Orderry dataset, compare a customer’s repeat work orders and inventory/open balance and inspect original estimate consent and attachment access.

#### MOVE-008 — Fixably move-in

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-INPUT-003 · *Rules:* D-1, D-2, D-3 · *Register:* R-9

**Requirement.** For an authorized device shop ingest its provider-assisted Fixably data export or entitled API JSON capture with explicit versioned schema, OEM references, repair/warranty/parts/finance relationships and media originals; credentials and OEM authority never migrate as data.

**Acceptance.**
1. Validate a real delivered capture’s schema/coverage, move repair history and warranty/parts costs, reconcile control totals and reauthorize the OEM account at destination.

#### MOVE-009 — RepairShopr full repair history

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Extend IMPORT-001 saved customers/customer-assets JSON with authorized RepairShopr ticket, estimate, invoice, payment and inventory API snapshots and downloaded attachment originals; retain historical technician, warranty, authorization and email/SMS evidence and map to searchable repair history.

**Acceptance.**
1. Import register plus historical/open tickets and invoices, reconcile serial/customer relationships and dollars and open a prior repair’s original decision/media; undo preserves native activity after cutover.

#### MOVE-010 — Reviewed safe migration and resumability

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Every importer previews field mappings, duplicate/conflict decisions, unsupported/missing records, money/units/timezones and media access without business writes; apply binds exact content/mapping fingerprint, records source originals/links/journal, supports large bounded resumable batches and safe undo without deleting later native work.

**Acceptance.**
1. Preview a multi-batch source with duplicate VINs and broken media, change a mapping after review and require refusal, then apply/resume/replay and selectively undo untouched records.

#### MOVE-011 — Historical reports and opening balances

*Tier:* Core · *Cites:* BASE-INPUT-003, BASE-AUDIT-001, BASE-DATA-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Preserve original currency/tax, numbering, dates, attribution, consent artifacts and source links; history is searchable and drives pre-cutover service, decline, warranty and reporting views. Reconcile source counts, gross/net/tax, open AR, deposits/credits, stock/core valuation (posted from the MOVE-013 SKUs and bins, not a lump balance) and paid status; missing history cannot silently count as zero.

**Acceptance.**
1. Import an 18-month archive containing tax changes, refunds and comebacks, independently total each financial/control population and drill reports to original evidence, including inaccessible-media exceptions.

#### MOVE-012 — Open work and controlled cutover

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Plan source snapshot, delta window and cutover; carry appointments, open ROs, current authorizations, parts/backorders, promises, balances and deposits with one owner for collection/order/messages. Shadow compare a completed repair, adopt once and retain rollback/export plan; no double charge, purchase or reminder.

**Acceptance.**
1. Migrate an open approved RO and pending deposit, make one final source change, apply its reviewed delta and finish in Mallet; reconcile one invoice/payment/order/message owner across cutover.

#### MOVE-013 — Shop setup and inventory move-in

*Tier:* Core · *Cites:* BASE-DATA-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Every incumbent move-in (MOVE-001 to MOVE-009) imports the setup advisors quote from as working Mallet configuration, not attachments: canned jobs with labor, parts and fee lines and inspection mappings (EST-002); parts pricing matrices, labor rates and customer/fleet rate profiles; shop fees such as supplies and EPA/disposal with caps and tax treatment (TAX-002); inspection templates (DVI-001); vendors with account numbers, contacts and supplier-network links (BUY-001 to BUY-005); and inventory on hand as SKUs with bins, quantities, unit cost, cores and min/max (PART-001, PART-002, PART-004, PART-007). The preview manifest names each object’s extraction route for that source (self-service report export, authorized API capture or vendor-assisted archive) and shows unmapped categories, matrix tiers and tax treatment; an object no route has supplied stays a visible blocking extraction task, never an empty default. Apply runs through MOVE-010, and MOVE-011’s opening stock valuation is posted from the same imported SKUs and bins.

**Acceptance.**
1. From an owner-authorized Tekmetric capture, then each other incumbent’s route, import setup and inventory.
2. Reproduce three canned jobs (an oil service, front brakes and a diagnostic) and one matrix-priced part with the same line and grand totals as the source; reconcile on-hand quantity and extended cost per SKU and bin against the source inventory report; start a new estimate from an imported canned job and sell one stocked part from its imported bin, which decrements that bin.

### Tires and broader automotive operations

#### TIRE-001 — Tire fitment pricing and sourcing

*Tier:* Core · *Rules:* D-1, D-2, D-3 · *Register:* R-6

**Requirement.** Manage tire size, load/speed rating, vehicle fitment, sets, installation/balance/alignment packages, disposal fees, stock and supplier quotes/orders through PartsTech, TireHub and NAPA ProLink where authorized; preserve substitutions for advisor/customer review.

**Acceptance.**
1. Quote a correctly rated set using each supported authorized supplier connection, reject incompatible fitment, order/receive tires and reconcile fees and installed stock.

#### TIRE-002 — DOT tire registration and traceability

*Tier:* Core · *Rules:* D-1, D-2, D-3

**Requirement.** Capture tire DOT/TIN by installed wheel/vehicle, sale date and customer, submit registration through an approved registration partner such as CIMS, track provider acknowledgment and identify affected customers from a recall/lot search.

**Acceptance.**
1. Scan an installed set’s TINs, submit a partner test registration once and run a lot/recall query; missing/invalid codes remain unresolved and never marked registered.

### Roles, security and operating guarantees

#### GOV-001 — Job-specific staff rights

*Tier:* Core · *Cites:* BASE-ROLE-001, BASE-ACCESS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Owners control settings, access and money policies; location managers run their shop; advisors handle intake/estimates/communications within discount limits; technicians see assigned work and record findings/time/actuals; purchasers manage stock/POs under spend limits; cashiers collect/refund under limits; accountants read/reconcile/export finance. Cost/payroll views and destructive actions require separate rights, enforced at every transport. Bounded refund and credit verbs and accountant finance reads may be delegated separately, keeping exact transaction authority, step-up and immutable original-tender history (RL-108). The governing recorded decision is RL-16.

**Acceptance.**
1. Exercise each role through page, form, API and downloads, exceed discount/refund/spend limits and access another location; require refusal without writes and verify authorized handoffs.

#### GOV-002 — Approvals audit and accountable changes

*Tier:* Core · *Cites:* BASE-AUDIT-001, BASE-OPS-005, BASE-SECRET-001, BASE-AGENT-009, BASE-AGENT-005, BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Repair audit entries cover login and access changes, prices, exact approvals and consent, dispatch, stock, time corrections, money, imports and agent sends, with the prior and resulting revision, governing shop policy and source evidence. The governing recorded decision is RL-17.

**Acceptance.**
1. Perform a discount override, stock correction, refund and agent proposal, revoke the actor and export audit; exact prior decisions remain attributable and secrets are absent.

#### GOV-003 — Enterprise sign-on and provisioning

*Tier:* Core · *Cites:* BASE-SIGNIN-001, BASE-SIGNIN-002, BASE-ROLE-001, BASE-DATA-001, BASE-MAIL-001, BASE-AUDIT-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-3

**Requirement.** Connect Google Workspace, Microsoft Entra ID and Okta with explicit ordinary-staff role and shop mapping. A current owner with a fresh enrolled-factor proof confirms the exact provider association. Provisioning maps new identities only to technicians, cannot adopt native identities or infer administrator authority from email domains, assertions or claims, and requires the exact immutable provider subject and email. Connection revocation disables its technicians; emergency deployment-owner recovery remains independent. GOV-001 governs delegated roles, SHOP-001 locations, GOV-004 local factors and GOV-005 provider credentials. Enable enterprise identity only by explicit owner-approved configuration and exact provider association; provisioning grants only mapped ordinary staff rights, deactivation revokes live authority and recovery never restores credentials (RL-105). Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#gov-003).

**Acceptance.**
1. Sign in through each configured Google Workspace, Microsoft Entra ID and Okta provider and provision a mapped technician.
2. Disable that technician and attempt the old page and API sessions; authority ends while repair attribution remains.
3. Revoke a connection, recover owner access with the provider unavailable and restore repair data; credentials and revoked identity authority do not return.

#### GOV-004 — Strong staff authentication

*Tier:* Core · *From:* GOV-004 · *Cites:* BASE-SIGNIN-002, BASE-ACCESS-002, BASE-AGENT-008, BASE-ROLE-001, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006 · *Rules:* D-1, D-2, D-3 · *Register:* R-12

**Requirement.** Use Mallet’s native factor and recovery flows for staff, with owner-controlled factor requirements. Fresh confirmation gates refunds and credits, unpaid release, key creation, asset erasure and temporary unlock reveal; the specific native and enrolled-factor requirements stay in [security](docs/security.md). Recovery notices reach other active owners/admins. GOV-003 provider sessions retain the required local factor. GOV-007 governs customer links. The governing recorded decision is RL-18. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#gov-004).

**Acceptance.**
1. Require a second factor and recover an owner through the supported native recovery paths.
2. Step up a refund; an old session or a token without the required current proof gives no privileged authority.
3. Recover a lost factor and inspect the other owners’ and admins’ recovery notices.

#### GOV-007 — Customer link protection

*Tier:* Core · *From:* GOV-004 · *Cites:* BASE-SIGNIN-002, BASE-ACCESS-002, BASE-AGENT-008, BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Protect customer approval, inspection, intake, check-in, appointment and future payment links with their purpose, expiry, revocation and guessing fences. Invalid links reveal no customer history. Appointment status ends one day after the appointment; management authority has its separate seven-day-or-use boundary. Approval decisions consume their link, and payment links inherit the seven-day-or-use ceiling. Payer billing remains account-session authority. The governing recorded decision is RL-18.

**Acceptance.**
1. Attempt stolen, revoked and expired links at each customer door; the response reveals no customer history or authority.
2. Consume a decision link, expire appointment status and exercise appointment management separately; none gives payer authority.

#### GOV-005 — Provider credential custody

*Tier:* Core · *From:* GOV-005 · *Cites:* BASE-SECRET-001, BASE-DATA-004, BASE-INPUT-003, BASE-ROLE-001, BASE-MAIL-001, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Rotate and revoke shop connector credentials after the current owner acknowledges the connector’s published data-flow, retention, licence and access declaration. A replacement supersedes the deployment binding and revocation makes that credential unavailable. Stripe, Pier and mail-event keys use the same custody; the mail sending key has its deployment-setting lifecycle. GOV-008 governs private media. The governing recorded decision is RL-19. Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#gov-005).

**Acceptance.**
1. Rotate a supplier/payment credential and show the next authorized call uses the replacement.
2. Replay a bad-signature webhook; inspect response, logs, audit and archive for credential absence.
3. Revoke the credential and restore records into a fresh owner installation; no old credential authority returns.

#### GOV-008 — Private attachment access

*Tier:* Core · *From:* GOV-005 · *Cites:* BASE-SECRET-001, BASE-DATA-004, BASE-INPUT-003, BASE-ROLE-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Repair attachments are readable by the current assigned staff or through the exact reviewed customer set. A customer media link opens a separately bounded byte URL, and both the parent and reviewed file are rechecked on every read. Private originals remain distinct from DVI-003 customer variants. [Connector custody](docs/connectors.md) documents the short link and byte lifetimes. The governing recorded decision is RL-19.

**Acceptance.**
1. Request another customer’s media and an unreviewed original; neither is exposed.
2. Expire or revoke the parent while a byte URL exists; the later read is refused.

#### GOV-006 — Retention erasure and legal holds

*Tier:* Core · *Cites:* BASE-DATA-003, BASE-DATA-006, BASE-AUDIT-001, BASE-ROLE-001, BASE-INPUT-003, BASE-DATA-001 · *Rules:* D-1, D-2, D-3 · *Register:* R-11

**Requirement.** The customer export collects the related repair, financial, media and import-original custody. Retention eligibility covers that full inventory, including stored media objects and older-backup erasure fences. DATA-001’s strict older-archive refusal remains. Customer erasure immediately destroys INTAKE-004 unlock data keys outside D1 recovery, before other retention processing. Retention, erasure and holds include DVI-002 finding metadata, immutable original and shared bytes and incomplete upload chunks. Destruction follows an explicitly configured retention purpose or an eligible reviewed erasure action. AUTO-002 inheritance: personal erasure immediately revokes installation-local status-send authority even under a hold; exact permission and approval snapshots follow existing authorization custody without a new automatic deletion or retention schedule. Only the current owner may export customer data, place or release scoped holds, change manual retention lifetimes or approve an exact preview. Blank lifetimes pause automatic destruction; each retained fact needs its continuing purpose or hold (RL-106). Customer erasure immediately destroys external unlock keys, then erases eligible current profiles, native finding metadata, original/shared bytes and incomplete chunks, and withdraws affected whole import artifacts. Financial, authorization, signed custody/intake, merge-consent and service-history facts remain exact only for a documented continuing retention basis or scoped hold; shared contacts require their own basis (RL-106). A financial hold does not prevent eligible media erasure; scoped media/personal/import/all holds preserve their scope. Any import/all hold conservatively protects shared import custody. Each approved action records actor, consent evidence, exact preview and counts, with partial failures requiring a fresh preview; older archives are refused when the later journal or known epoch proves erasure. All new records inherit OPS-001. Use explicit retention purposes and scoped holds with reviewed eligible erasure; a blank lifetime pauses automatic destruction but never creates a permanent exemption from a valid erasure duty, and retained financial or custody facts need a documented continuing basis (RL-106). Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#gov-006).

**Acceptance.**
1. Place a financial hold, erase eligible customer media, compare archive/object storage and restore attempts, then release a hold and run the approved retention action with auditable counts.

#### OPS-001 — Owner-run deployment and complete portability

*Tier:* Core · *Cites:* BASE-DATA-001, BASE-BACKUP-001, BASE-INSTALL-001, BASE-OPS-002, BASE-SECRET-001, BASE-ROLE-001, BASE-INPUT-003 · *Rules:* D-1, D-2, D-3

**Requirement.** Mallet’s archive inventory includes every workshop record, exact decision, saved export, import original, provider receipt and retained media original, shared variant, metadata and incomplete chunk. Historical actors remain attributable under fresh destination authority. Every capability that adds product data extends this inventory under D-3 before shipping. The archive selection and exclusion rules are documented in [workshop portability](docs/backup-and-restore.md).

**Acceptance.**
1. From a fresh checkout launch with rer dev, create a real repair, export, restore into an empty separately configured owner installation and finish it; verify record/media counts, fresh authority.

#### OPS-002 — Fast counter work at declared capacity

*Tier:* Core · *From:* OPS-002 · *Cites:* BASE-ROLE-001, BASE-INPUT-003, BASE-DATA-001, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Declared capacity per installation: 10 shops; per shop 30,000 customers, 40,000 vehicles, 8,000 ROs a year with 7 years of history, 25 inspection photos and one short video per RO, 2,500 stocked SKUs and 30 concurrent staff sessions (300 across the installation) plus 50 open customer links. At that capacity, p95 times measured at the server are: customer, phone, plate or VIN search returning the first page of at most 50 matches within 500 ms; job board load within 1 s, and a stage change visible on other staff boards within 2 s; RO open with lines, inspection and decisions within 1 s; each inspection photo of up to 8 MB acknowledged within 1 s after its last byte arrives, with upload progress shown meanwhile. A scheduled reminder or provider job runs within 5 minutes of its due time, and within 5 minutes of restart for jobs that fell due while the server was down. OPS-003 governs job authority and recovery; AR-002 governs reminder consent (RL-107). Technical formats and custody parameters are in [contract mechanisms](docs/contract-mechanisms.md#ops-002).

**Acceptance.**
1. Load the declared dataset through the import door, drive 30 concurrent staff sessions in one shop and 300 across ten, and measure each stated p95 (search, board load and refresh, RO open, photo acknowledgment) from request logs.
2. Stop the server with reminders and provider jobs due, restart it and show each runs exactly once within 5 minutes; inject a provider failure and replay it; inspect one visible outcome per business event and the backlog diagnostics.
3. Search is paged and the core RO API is indexed; server timings use fixed route classes without private query/token data.
4. Native peer boards update stage/bay projections without discarding drafts.

#### OPS-003 — Background job authority and recovery

*Tier:* Core · *From:* OPS-002 · *Cites:* BASE-ROLE-001, BASE-DATA-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Only currently authorized read or send jobs run, with separate authority for those effects. Restored runnable authority is quarantined. Failed and uncertain outbound handoffs require human resolution before a new attempt; AR-002 governs reminder consent (RL-107). The job’s owner, backlog, durable outcome and recovery are visible. Capacity and due/restart deadlines stay in OPS-002.

**Acceptance.**
1. Queue overlapping persistent business events; at most four run concurrently, interrupted work respects its one-minute lease, and failed or uncertain handoffs remain stopped until explicit owner recovery. Only read-only payment evidence is replayable after the recorded fresh authorization.
2. Archives preserve outcomes but cannot grant destination provider/customer-link authority.
3. Recover an uncertain outbound effect explicitly; a restored or retried record alone grants no new sending authority.

### Open source and installation

#### OPEN-001 — Free and open source under the MIT license, run by one command

*Tier:* Core · *Cites:* BASE-INSTALL-001, BASE-DATA-005 · *Rules:* D-1, D-2, D-3

**Requirement.** Mallet is published under the MIT license, including every capability in this contract. Anyone may run, modify and redistribute that complete source. The public run page and README offer the documented one-command launch into an empty buyer-owned shop. Third-party service and hosting charges are disclosed separately.

**Acceptance.**
1. Read LICENSE and rer-project.json and find MIT; build the public run site and read its launch command; run that command in a clean directory and reach setup with an empty shop; inspect the installed source and app for Mallet license keys, fees, paid gates and upgrade prompts and find none.

### Agent surface (Base-delivered)

#### BASE-AGENT-001 — One MCP door per seed

*Tier:* Agent surface

**Requirement.** Every seed, hosted or self-hosted, serves one remote MCP endpoint at `/mcp` over Streamable HTTP. It speaks the current revision (2026-07-28) and accepts 2025-11-25 clients through the twelve-month deprecation window. It implements `server / discover`, tools, resources and prompts. Lists are deterministic and carry `ttlMs` and `cacheScope: "private"`. Roots, Sampling and Logging are not served.

**Acceptance.**
1. `server / discover` returns the supported versions, capabilities, `serverInfo` and instructions.
2. A 2026-07-28 request works with no handshake, and a 2025-11-25 client completes `initialize` and lists the same tools.
3. An unsupported version returns `UnsupportedProtocolVersion`.
4. Two `tools / list` calls return the same order, with cache fields.
5. A foreign Origin returns 403, and a header and body method mismatch returns `HeaderMismatch`.
6. An oversized body returns 413 with no effect.

#### BASE-AGENT-002 — The seed's jobs are tools, through the UI's own actions

*Tier:* Agent surface

**Requirement.** Each Core job a person does in the product is a tool. Where one is not, the Agent surface says why: it runs on a device, it is a person's interactive screen, it belongs to a connector or the import door, or it is an installation fact. Risk is never the reason: a risky job is a tool with its class (BASE-AGENT-006). Tools are named `<seed>.<area>.<verb>` and declare input and output schemas and truthful annotations. Each calls the same server action as the UI, so validation and authorization are written once, and the seed's embedded agents use the same registry. A business refusal returns `isError` with the seed's stable error code.

**Acceptance.**
1. The Core clause ids in each tool's `_meta`, with the not-a-tool reasons that `server / discover` serves, cover every Core clause in the contract, and no reason is risk; the harness and `rer check` fail on a gap.
2. Each tool's fixture result validates against its `outputSchema`.
3. Read tools declare `readOnlyHint`; tools that can carry destructive declare `destructiveHint`, and tools that can carry external declare `openWorldHint`.
4. A refusal returns the same error code the UI gets for the same action.
5. The UI action and its tool, on the same fixture, give the same record state and the same audit event type.
6. The seed's embedded agents appear in the audit as calls to the same tools.

#### BASE-AGENT-003 — Records are resources

*Tier:* Agent surface

**Requirement.** Each primary record type has a URI template, and tools return `resource_link`s to the records they touch. A read returns exactly the fields the caller's role sees in the UI. File bytes count against any byte budget on the grant. A record the caller cannot open reads as not found, identical to a missing id. Text from customers, imports or files carries an untrusted marker in `_meta`.

**Acceptance.**
1. `resources / templates / list` names every record type in the Agent surface.
2. Reads as two roles return exactly what the UI shows each.
3. An out-of-scope id and a missing id give identical responses.
4. A write's `resource_link` reads back the new state.
5. Bytes over budget return `budget_exhausted` and no partial content.
6. Customer-sourced text carries the untrusted marker.

#### BASE-AGENT-004 — Business identity and short-lived, audience-bound tokens

*Tier:* Agent surface

**Requirement.** The door is an OAuth 2.1 resource server. Its RFC 9728 metadata names the authorization servers this installation trusts. That is the paired Business when Business provisioned it, verified with the owner-claim trust the installation already holds for its import door; otherwise it is the seed's own sign-in. Access tokens are RFC 9068 JWTs with `aud` set to the seed's canonical MCP URI, `sub` the sponsoring person, `act` the agent (RFC 8693) with its specialist, scopes per tool family, and a lifetime of 15 minutes or less (5 by default). The policy scopes rules on the sponsor, agent and specialist the token names. The consent behind the tokens can last longer and is revocable. Tokens travel only in the Authorization header, and there is no passthrough.

**Acceptance.**
1. An unauthenticated call returns 401 with `resource_metadata`, and the metadata names the trusted servers and scopes.
2. A Business token for this seed works, and the same token sent to a sibling seed returns 401.
3. An expired token returns 401, and a token with a lifetime over 15 minutes is refused.
4. A read-only token calling a write tool returns 403 `insufficient_scope` with every needed scope in one challenge.
5. A token in a query string is refused and not logged.
6. Revoking consent in the seed or in Business refuses the next call within 60 seconds.
7. After unpairing, Business tokens are refused and the seed's own sign-in still works.

#### BASE-AGENT-005 — An agent acts as a person in a role, never more

*Tier:* Agent surface

**Requirement.** Every call is authorized as the sponsoring person's current role and access (BASE-ACCESS-004), intersected with the grant's resources, actions and budget. A grant only narrows. No call widens the calling agent's own authority. A call that would widen its own grant or its sponsor's role, or change the company policy or Pause, is refused with `self_escalation`, whatever the policy says; narrowing its own grant is allowed. Other access and security changes are ordinary actions in the access and security classes. An agent never acts after its sponsor is suspended. Anything an agent reads (records, files, emails, imports, other seeds' results) is data and cannot change its scope, its targets or a call's class.

**Acceptance.**
1. For each role fixture, every tool's allow or deny through MCP equals the UI's for the same action.
2. A one-folder, read-only grant holds, and widening through arguments is refused.
3. Downgrading the sponsor changes the next call's result, and suspending the sponsor returns 401.
4. Calls that widen the agent's own grant or its sponsor's role, or change the policy or Pause, return `self_escalation` and change nothing, even under a policy with every class autonomous; dropping a scope from its own grant runs.
5. An injection fixture yields no out-of-grant call and no change of class: record text asking for a wider action, or claiming that a recipient is internal.

#### BASE-AGENT-006 — Every action declares its risk class

*Tier:* Agent surface

**Requirement.** Classes come from the fleet list in RISK-POLICY.md: standard, external, money, commitment, accounts, gated, access, security, destructive, sensitive and live. In the registry, each tool declares the classes it can carry and a server-side classifier that decides them per call from the arguments, current records and, for gated, the provider's answer. The classifier also supplies each class's facts: the measure (items, recipients, amount and currency, people or records), the counterparty (internal, known, new or public), the direction for access, the provider and step for gated, and the data kind for sensitive. A classifier never reads a flag, label or claim supplied by the agent or by record text. A seed cannot add a class; it proposes one for the fleet list.

**Acceptance.**
1. Every tool in `tools / list` carries its possible classes in `_meta`, equal to the Agent surface table.
2. For each tool, fixture calls cover every class it can carry, and the computed classes and facts equal the fixture's expected values.
3. An argument or record text asserting a class or a confirmation (`internal: true`, `confirmExternal: true`) leaves the computed classes unchanged.
4. Money calls carry amount and currency, external calls their counterparty and recipient count, access calls their direction, and destructive calls their item count.
5. No tool in `tools / list` declares a class outside the fleet list, and `rer check` fails on one.
6. A refused call's audit row still records its computed classes.

#### BASE-AGENT-007 — The company's policy decides, at one chokepoint

*Tier:* Agent surface

**Requirement.** Every agent door calls one decision function: MCP, the integration API with agent tokens, and the seed's embedded agents. It evaluates the call's classes against the company's policy, as above. The seed ships no dispositions and fills no gap with one: agent access opens only under a complete policy that setup has asked for (RISK-POLICY.md), and before then every agent call returns `policy_unset` with the setup link and changes nothing. *Autonomous* runs the call. *Review* runs it and adds it to the review feed. *Approval* saves a pending action with server-computed facts and returns `input_required`, with a URL-mode elicitation to the seed's approval page and a pending handle. Each person the rule names approves the exact saved revision in a signed-in browser, and changed inputs need a new approval. The retried call returns the result and a receipt. A rejection returns `approval_rejected`, and a lapse past the wait the rule sets returns `approval_expired`. *Blocked* returns `policy_blocked`, naming the class, rule and revision.

**Acceptance.**
1. The Base harness runs each tool under each disposition for every class it can carry, and sees it run, run and enter the review feed, wait with no effect, or be refused.
2. Before setup is complete, the setup page lists every class the seed's tools carry with examples and no answer pre-selected, an agent call returns `policy_unset` with the setup link and changes nothing, and an incomplete revision cannot be confirmed; a `*` rule completes it, and a tool an upgrade adds with an unanswered class appears in `tools / list` once that class is answered, while the other tools keep running.
3. Under "money autonomous up to $500, approval up to $10,000, blocked above", calls of $400, $600 and $20,000 run, wait and are refused; a per-day cap sends the call that crosses it to the next rule.
4. A call carrying two classes takes the stricter disposition.
5. An approval shows server-computed facts and an expiry, returns the URL elicitation and a handle, and completes once after the named approver approves; a changed input needs a new approval, and a rejection or lapse leaves no effect.
6. The same call through MCP, the integration API and an embedded agent gets the same decision.
7. A policy change applies to the next call within 60 seconds, and the audit cites the new revision.
8. A policy document with a bad signature or another Business's id is rejected, and the door keeps the last valid revision.

#### BASE-AGENT-008 — Truthful attribution

*Tier:* Agent surface

**Requirement.** Every agent act is recorded and shown as `"<agent> for <person>"`, and mail and messages an agent sends outside name it that way as their sender. An approval, a review mark, a confirmation (a warning dialog, a typed-field confirmation, a delivery confirmation), a decision or a signature attributed to a person comes only from that person's signed-in session. When an agent does the equivalent act, the record names the agent, and the act carries its own class; a binding decision or a signature is commitment. Agent doors ignore arguments that stand for a person's confirmation. No tool solves a bot check, or enters a person's own password or 2FA code at an outside service. A provider step that demands a person goes to a person, whatever the policy says; the gated class marks such steps before they run.

**Acceptance.**
1. An agent call carrying a person-confirmation flag is classified and decided exactly as without it.
2. Approving, marking reviewed or answering a policy question with an agent or device token returns 403 and changes nothing.
3. A form-mode elicitation "accept" never completes an approval.
4. Where an agent's decision, signature or field confirmation runs without a person, it reads `"<agent> for <person>"` in the record, the activity view, exports and any certificate, never as the person's own act.
5. After a person approves an agent's prepared action, the record shows the person as approver and the agent as preparer.
6. Activity and exports at 1440 and 390 show `"<agent> for <person>"` for every agent act.
7. Mail an agent sends to an outside address names `"<agent> for <person>"` as its sender.

#### BASE-AGENT-009 — Every agent action is audited with its class and decision

*Tier:* Agent surface

**Requirement.** Extending BASE-OPS-005, each call that reads private data or changes anything records the agent client, name and specialist, and the run or task id (`traceparent` when sent); the sponsoring person, the grant, the tool and the targets; the classes and their facts, and the policy revision and rule; the decision (autonomous, review, approval, blocked, unset or self_escalation) and the outcome (done, refused, pending or failed); the approval or review id and person, and the idempotency key. For a period, the seed's Agents page shows actions by class and decision with the notable ones, the review feed (Mark reviewed, Flag, and Undo where reversible), pending approvals, steps waiting for a person and setup questions. Business shows the same across seeds.

**Acceptance.**
1. One write leaves a complete audit row.
2. Refused, pending, unset and self-escalation calls are audited.
3. The Agents page's counts by class and decision equal the audit rows on a fixture week.
4. The review feed lists exactly the calls decided as review; Mark reviewed records the person, and Undo restores a reversible one.
5. Filtering by agent or class lists only those rows, and export includes every field.
6. Removing the agent keeps its rows and its name.
7. The Agents page works at 1440 and 390 with no serious or critical axe findings.

#### BASE-AGENT-010 — Agents can follow changes

*Tier:* Agent surface

**Requirement.** The seed emits a typed event for every record change and for every approval, review and policy decision. Each event carries a stable id, a type, the record URI, the actor (a person, or an agent acting for a person) and a time. Events never carry secrets or more than the subscriber may read. Agents can read events three ways: `subscriptions / listen`, an `events.list` tool with a cursor, and signed webhooks from Base `integrations` using the same ids. Every channel delivers at least once and filters by access at delivery.

**Acceptance.**
1. A subscribed record changed in the UI produces a notification within 10 seconds.
2. `events.list` returns the same event id the webhook carries.
3. Replaying from a cursor returns the same ids in order.
4. After access is revoked, no channel delivers events about that record.
5. A failed webhook is visible and replays without duplicate effects.
6. `approval.pending`, `approval.decided`, `review.flagged` and `policy.adopted` carry the class and decision and nothing the subscriber may not read.

#### BASE-AGENT-011 — Limits are policy, and Pause stops everything

*Tier:* Agent surface

**Requirement.** Business limits are rules in the company's policy: per-call and per-day thresholds on any class's measure, such as money moved, outside recipients or items destroyed; spend caps on provider cost (models, SMS, email) per seed, specialist or agent, which setup asks with the classes; "no cap" is an answer. Tools with provider cost declare an estimate before they run, and an exhausted cap returns `budget_exhausted` before any partial effect. The seed's capacity limits (request rate, body and byte sizes) protect the installation: they bound rate and size, never daily business volume, are documented and are not policy. A grant carries budgets only when the person granting it sets them. A **Pause agents** control in the seed, and Pause all agents in Business when paired, refuses every agent token within 60 seconds until a person resumes; browser sessions and devices keep working.

**Acceptance.**
1. A rate overrun returns 429 with `Retry-After`.
2. A per-day cap of three outside recipients sends the fourth to the rule that applies past the cap.
3. An exhausted spend cap returns `budget_exhausted` with no partial effect and shows the spend.
4. Under the answer "no cap", a spending call runs and its spend shows in usage; a call that spends nothing is unaffected by any cap.
5. The usage view shows calls, decisions by class, money moved and provider spend per agent.
6. Pause and Pause all agents each stop the next call within 60 seconds, and resume restores access.
7. An agent token cannot resume.

#### BASE-AGENT-012 — Writes are idempotent and conflict-safe

*Tier:* Agent surface

**Requirement.** Every mutating tool requires an idempotency key and takes an optional expected revision. The same key with the same arguments returns the first outcome for at least 24 hours; the same key with different arguments returns `idempotency_conflict`; a stale revision returns `revision_conflict` with the current revision. Long work returns a job handle and a status tool, with no dependence on the Tasks extension.

**Acceptance.**
1. Two calls with one key give one effect and equal results.
2. A retry with a new JSON-RPC id and the same key, after a dropped stream, returns the recorded outcome.
3. The same key with different arguments returns a conflict and no effect.
4. A stale revision returns a conflict naming the current revision.
5. A job handle used by another person's token reads as not found.

#### BASE-AGENT-013 — Manifest, docs and the conformance journey

*Tier:* Agent surface

**Requirement.** `server / discover` instructions and an on-site `/docs/agents` page are generated from the action registry. The page lists tools by job, with each tool's classes, the test that adds each computed class, its scopes, resource templates, event types, capacity limits and error codes, and the specialist role. `prompts / list` carries the specialist's jobs. Base ships the conformance journey, a harness that `rer verify` runs against `rer dev` and seeds run in CI. It is an MCP client; a signed-in test person takes a person's steps (setup answers, approvals, review marks, resume) through the URLs the door returns, and the same browser leg runs the UI-parity actions and the page checks at 1440 and 390. It runs every acceptance point of BASE-AGENT-001 to 012 and of the seed's SURFACE clauses under two company policies: *all autonomous* (`*`), and *held* (standard review, every other class the seed declares approval, which the test person grants), plus the single-class variants a point names. A point that names no disposition passes under both.

**Acceptance.**
1. The docs list exactly the names in `tools / list` and `resources / templates / list`.
2. Each tool's classes, and the test behind each computed one, are documented.
3. The harness fails on any of: a tool without a schema; an effect under approval or blocked, or before setup is complete; a computed class that differs from its fixture; a flag that changes a class or completes a person's step; a role-parity mismatch; a wrong-audience token being accepted; a duplicate effect on retry.
4. Every acceptance point runs under both policies, every decision matches the policy in force, and under all autonomous no call waits for a person or is refused by policy.
5. A stranger agent given only the seed URL completes the specialist journey through MCP.

### Agent surface

**Specialist: service advisor.** It takes repair work from intake through exact scope, parts and payment records to follow-up, using the shop’s existing physical and customer evidence.

Inherits BASE-AGENT-001 to BASE-AGENT-013. The company’s policy decides every call.

**How Mallet computes each class.**

- **standard.** an internal reversible repair draft, observation, priority change or bookkeeping edit; facts include affected item count. A priority change uses the current repair and priority-history revisions and retains its reason; it does not change a running board rule.

- **external.** a message, share, source submission or record newly visible outside the shop; facts include recipient count and known, new or public counterparty.

- **money.** an authorized order, diagnostic estimate, payment, refund, published price or charge changes what the shop pays or charges; facts include exact amount, currency and counterparty. Check-in confirmation takes the diagnostic total and currency from the saved quote, the counterparty from the matched customer and asset plus signed check-in, and the source facts from the current check-in revision, saved quote and signed receipt checksum. Confirmation records the resulting diagnostic estimate and its revision against those facts; caller confirmation flags supply none of them.

- **commitment.** a diagnostic-estimate authorization, repair, promise, warranty or claim decision binds the shop; facts include value, counterparty and exact source revision. Check-in confirmation binds the same quoted diagnostic total, matched customer, current check-in revision and signed receipt as its money facts and records the resulting diagnostic-estimate revision; it grants no broader repair or payment authority.

- **accounts.** a messaging registration or provider action creates an outside identity or paid resource; facts name that provider.

- **gated.** a provider requires hosted consent, checkout, identity verification or acceptance in a person’s account; facts name provider and step.

- **access.** a staff, role, device, customer-link or agent grant changes continuing access; facts include people and direction.

- **security.** a connector credential, unlock key, factor or protective setting changes; facts identify that setting.

- **destructive.** an erasure, irreversible stock/custody deletion or cancellation/lost closure that cannot be reopened in the product cannot be undone; facts include affected item count. Board closure uses the current repair, its closure outcome and resource reservations, retaining the reason and history and counting the repair closed; releasing resources does not erase their records.

- **sensitive.** the selected records include regulated identity/bank data or payroll rates; facts include record count and data kind.

- **live.** routing, job scheduling, calendar synchronization or a live board rule changes the running shop service; facts identify the affected service.

| Tool | Does | Core clauses | Risk class | Today |
| --- | --- | --- | --- | --- |
| `mallet.visits.book` | Register and visits | WORKSHOP-001 | standard | not implemented over MCP |
| `mallet.estimates.prepare` | Exact decision | ESTIMATE-001 | standard | not implemented over MCP |
| `mallet.work.record` | Authorized actuals | WORK-001 | standard | not implemented over MCP |
| `mallet.invoices.export` | One saved export | INVOICE-001 | standard | not implemented over MCP |
| `mallet.grants.issue` | Scoped preparation keys | AGENT-001 | access · security | not implemented over MCP |
| `mallet.custody.erase` | Custody and erasure | DATA-001 | destructive (+ sensitive) | not implemented over MCP |
| `mallet.catalogue.read` | Read only | PIER-001 | standard | not implemented over MCP |
| `mallet.customers.update` | Customer and fleet accounts | CUS-001 | standard or access | not implemented over MCP |
| `mallet.vehicles.decode` | Vehicle identity and VIN decode | VEH-001 | standard or external | not implemented over MCP |
| `mallet.readings.record` | Mileage and service intervals | VEH-002 | standard | not implemented over MCP |
| `mallet.carfax.exchange` | CARFAX service history exchange | VEH-003 | external | not implemented over MCP |
| `mallet.custody.record` | Condition media and custody | INTAKE-001 | standard (+ commitment) | not implemented over MCP |
| `mallet.unlock.manage` | Temporary unlock custody | INTAKE-004 | security (+ destructive) | not implemented over MCP |
| `mallet.forms.publish` | Custom forms and signed shop terms | INTAKE-002 | standard (+ money) (+ commitment) (+ external) (+ access) | not implemented over MCP |
| `mallet.checkin.confirm` | Confirm booking and authorize the exact customer-consented diagnostic estimate | INTAKE-003 | money · commitment | not implemented over MCP |
| `mallet.appointments.book` | Online appointment booking | BOOK-001 | standard (+ commitment) (+ external) (+ access) | not implemented over MCP |
| `mallet.resources.reserve` | Resource calendars and recurring reservations | BOOK-002 | standard | not implemented over MCP |
| `mallet.waitlist.offer` | Cancellation waitlist offers | BOOK-003 | external (+ commitment) (+ access) | not implemented over MCP |
| `mallet.findings.record` | Diagnostic findings and private notes | DIAG-001 | standard (+ external) (+ access) | not implemented over MCP |
| `mallet.assets.classify` | Bicycle and device repair benches | ASSET-001 | standard (+ money) | not implemented over MCP |
| `mallet.inspections.record` | Configurable digital inspections | DVI-001 | standard | not implemented over MCP |
| `mallet.media.upload` | Photo and video inspection evidence | DVI-002 | standard | not implemented over MCP |
| `mallet.inspections.share` | Customer inspection presentation | DVI-003 | external | not implemented over MCP |
| `mallet.inspections.compare` | Inspection history comparison | DVI-004 | standard | not implemented over MCP |
| `mallet.clearance.record` | Completion tests and return clearance | QUALITY-001 | commitment (+ money) (+ external) | not implemented over MCP |
| `mallet.diagnostics.import` | Specialist diagnostics connections | DIAG-002 | standard | not implemented over MCP |
| `mallet.pricing.prepare` | Parts and labor pricing | EST-001 | standard | not implemented over MCP |
| `mallet.recipes.prepare` | Canned jobs and pricing matrices | EST-002 | standard (+ money) | not implemented over MCP |
| `mallet.estimates.decide` | Record the agent’s own exact estimate decision; retain the customer’s separate consent | ESTIMATE-001, EST-003, EST-004 | commitment (+ money) (+ external) | not implemented over MCP |
| `mallet.supplements.prepare` | Supplemental approval on the same repair | EST-004 | standard | not implemented over MCP |
| `mallet.declines.reprice` | Declined work register | EST-005 | standard | not implemented over MCP |
| `mallet.chasing.schedule` | Estimate expiry and approval chasing | EST-006 | standard or live (+ external) | not implemented over MCP |
| `mallet.chasing.resolve` | Approval-chasing recovery tasks | EST-007 | standard | not implemented over MCP |
| `mallet.board.read` | Read and filter live repair and technician boards | FLOW-001 | standard | not implemented over MCP |
| `mallet.board.priority` | Change repair priority with a reason and retained priority history | FLOW-001 | standard | not implemented over MCP |
| `mallet.board.close` | Cancel or mark a repair lost with a reason and retained history, releasing its stock and booked resources | FLOW-001 | destructive | not implemented over MCP |
| `mallet.promises.update` | Promise times and capacity | FLOW-002 | standard or commitment (+ external) | not implemented over MCP |
| `mallet.routing.run` | Rules-based routing and escalation | FLOW-003 | standard or live (+ external) | not implemented over MCP |
| `mallet.time.record` | Employee clock and job timers | TIME-001 | standard or sensitive (+ commitment) | not implemented over MCP |
| `mallet.crew.update` | Technician crews and subtasks | FLOW-004 | standard or access | not implemented over MCP |
| `mallet.handoffs.acknowledge` | Acknowledged technician handoff | FLOW-005 | standard or access (+ commitment) | not implemented over MCP |
| `mallet.warranty.claim` | Warranty and comeback work | WARRANTY-001 | commitment (+ money) (+ external) | not implemented over MCP |
| `mallet.handover.record` | Paid and documented handover | RETURN-001 | commitment (+ money) (+ external) | not implemented over MCP |
| `mallet.storage.dispose` | Storage, abandoned property and repair liens | RETURN-002 | standard or destructive (+ money) (+ commitment) (+ external) | not implemented over MCP |
| `mallet.fleet.authorize` | Fleet and commercial repair workflows | FLEET-001 | commitment (+ money) (+ external) | not implemented over MCP |
| `mallet.fleet.reconcile` | Fleet billing and statement reconciliation | FLEET-002 | standard (+ money) (+ external) | not implemented over MCP |
| `mallet.parts.trace` | Shop parts catalog and traceability | PART-001 | standard | not implemented over MCP |
| `mallet.stock.count` | Record physical receipts and stock counts | PART-002, BUY-001 | standard | not implemented over MCP |
| `mallet.stock.consume` | Repair reservations and consumption | PART-003 | standard | not implemented over MCP |
| `mallet.purchases.prepare` | Purchase orders and goods receipts | BUY-001 | standard | not implemented over MCP |
| `mallet.orders.submit` | Place the exact supplier order | BUY-002, PART-007 | money · commitment · external | not implemented over MCP |
| `mallet.partstech.order` | PartsTech catalog and orders | BUY-003 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.nexpart.order` | Nexpart catalog and orders | BUY-004 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.worldpac.order` | Worldpac sourcing and orders | BUY-005 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.cores.reconcile` | Core deposits and returns | PART-004 | standard or money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.returns.reconcile` | Supplier RMAs and defective parts | PART-005 | standard or money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.specialparts.update` | ETA and special-order follow-through | PART-006 | standard | not implemented over MCP |
| `mallet.stock.replenish` | Low-stock replenishment | PART-007 | standard | not implemented over MCP |
| `mallet.stock.transfer` | Inter-store transfers | PART-008 | standard | not implemented over MCP |
| `mallet.suppliers.reconcile` | Supplier and warranty compensation reconciliation | BUY-006 | standard or money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.mobilesentrix.handoff` | MobileSentrix US parts | BUY-007 | external (+ money) (+ commitment) (+ gated) | not implemented over MCP |
| `mallet.injuredgadgets.import` | Injured Gadgets order sync | BUY-008 | standard or external | not implemented over MCP |
| `mallet.invoices.issue` | Issue the exact invoice and deliver its customer copy | INVOICE-001, INV-001 | standard or money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.tax.configure` | US parts and labor sales tax | TAX-001 | money | not implemented over MCP |
| `mallet.exemptions.apply` | Exemptions and shop fees | TAX-002 | money (+ commitment) | not implemented over MCP |
| `mallet.stripe.collect` | Stripe card and ACH collection | PAY-001 | money · external (+ gated) | not implemented over MCP |
| `mallet.square.collect` | Square counter and online payments | PAY-002 | money · external (+ gated) | not implemented over MCP |
| `mallet.balance.send` | Text-to-pay and mobile wallets | PAY-003 | external | not implemented over MCP |
| `mallet.deposits.allocate` | Deposits and split tenders | PAY-004 | money (+ external) | not implemented over MCP |
| `mallet.refunds.issue` | Refunds exchanges and customer credits | PAY-005 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.refunds.recover` | Uncertain refund recovery | PAY-008 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.financing.offer` | Consumer financing | PAY-006 | money · external (+ gated) | not implemented over MCP |
| `mallet.tenders.record` | Paper checks and shop-defined tenders | PAY-007 | money (+ external) | not implemented over MCP |
| `mallet.counter.sell` | Retail counter and cash drawer | POS-001 | money (+ external) | not implemented over MCP |
| `mallet.terms.assign` | Terms statements and payment follow-up | AR-001 | standard (+ money) (+ commitment) (+ external) | not implemented over MCP |
| `mallet.balance.schedule` | Scheduled and automated balance-reminder sequences | AR-002 | external (+ live) | not implemented over MCP |
| `mallet.agreements.renew` | Recurring service agreements | BILL-001 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.qbo.sync` | QuickBooks Online two-way sync | BOOKS-001 | money (+ external) | not implemented over MCP |
| `mallet.xero.sync` | Xero two-way sync | BOOKS-002 | money (+ external) | not implemented over MCP |
| `mallet.books.post` | Cost and cash postings to the books | BOOKS-003 | money (+ external) | not implemented over MCP |
| `mallet.disputes.submit` | Payment disputes and settlement close | MONEY-001 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.sublets.receive` | Sublet work and outsourced services | SUBLET-001 | standard | not implemented over MCP |
| `mallet.sms.send` | Two-way repair SMS with Twilio | MSG-001 | external | not implemented over MCP |
| `mallet.gmail.send` | Gmail repair conversations | MSG-002 | external | not implemented over MCP |
| `mallet.outlook.send` | Microsoft 365 Outlook conversations | MSG-003 | external | not implemented over MCP |
| `mallet.portal.read` | Customer repair portal | PORTAL-001 | standard | not implemented over MCP |
| `mallet.appointments.notify` | Appointment confirmation and reminders | AUTO-001 | external | not implemented over MCP |
| `mallet.status.notify` | Status and pickup notifications | AUTO-002 | external | not implemented over MCP |
| `mallet.services.remind` | Time and mileage service reminders | AUTO-003 | external | not implemented over MCP |
| `mallet.declines.followup` | Declined-work follow-up | AUTO-004 | external | not implemented over MCP |
| `mallet.reviews.invite` | Review and satisfaction requests | AUTO-005 | external | not implemented over MCP |
| `mallet.renewals.notify` | Warranty and contract renewal follow-up | AUTO-006 | external | not implemented over MCP |
| `mallet.communication.configure` | Communication controls and searchable history | MSG-004 | standard | not implemented over MCP |
| `mallet.sales.report` | ARO and car-count reporting | REPORT-001 | standard | not implemented over MCP |
| `mallet.funnel.report` | Repair sales cohorts and funnel | REPORT-007 | standard | not implemented over MCP |
| `mallet.profitability.report` | Repair and parts profitability | REPORT-002 | standard | not implemented over MCP |
| `mallet.technicians.report` | Technician efficiency and productivity | REPORT-003 | standard or sensitive | not implemented over MCP |
| `mallet.turnaround.report` | Turnaround and customer promises | REPORT-004 | standard | not implemented over MCP |
| `mallet.close.record` | Daily financial and inventory close | REPORT-005 | standard | not implemented over MCP |
| `mallet.reports.schedule` | Scheduled reports and portable data | REPORT-006 | external (+ live) (+ sensitive) | not implemented over MCP |
| `mallet.shops.configure` | Multiple shops and location controls | SHOP-001 | standard or live (+ access) (+ external) | not implemented over MCP |
| `mallet.googlecalendar.sync` | Google Calendar scheduling | CAL-001 | standard or live (+ external) | not implemented over MCP |
| `mallet.outlookcalendar.sync` | Microsoft 365 Calendar scheduling | CAL-002 | standard or live (+ external) | not implemented over MCP |
| `mallet.gsx.submit` | Apple GSX authorized repairs | OEM-001 | external (+ money) (+ commitment) (+ gated) | not implemented over MCP |
| `mallet.gspn.submit` | Samsung GSPN authorized repairs | OEM-002 | external (+ money) (+ commitment) (+ gated) | not implemented over MCP |
| `mallet.shipstation.label` | ShipStation mail-in and return logistics | SHIP-001 | external (+ money) (+ commitment) (+ gated) | not implemented over MCP |
| `mallet.shopify.sync` | Shopify storefront connection | STORE-001 | standard or money (+ external) (+ live) | not implemented over MCP |
| `mallet.woocommerce.sync` | WooCommerce storefront connection | STORE-002 | standard or money (+ external) (+ live) | not implemented over MCP |
| `mallet.clients.issue` | Documented shop API | API-001 | access · security | not implemented over MCP |
| `mallet.events.subscribe` | Webhooks and visible integration recovery | API-002 | external (+ access) (+ security) (+ live) | not implemented over MCP |
| `mallet.tires.order` | Tire fitment pricing and sourcing | TIRE-001 | money (+ commitment) (+ external) | not implemented over MCP |
| `mallet.tires.register` | DOT tire registration and traceability | TIRE-002 | external (+ commitment) | not implemented over MCP |
| `mallet.roles.update` | Job-specific staff rights | GOV-001 | access | not implemented over MCP |
| `mallet.audit.read` | Approvals audit and accountable changes | GOV-002 | standard | not implemented over MCP |
| `mallet.enterprise.configure` | Enterprise sign-on and provisioning | GOV-003 | access · security (+ gated) | not implemented over MCP |
| `mallet.security.configure` | Strong staff authentication | GOV-004 | security (+ access) | not implemented over MCP |
| `mallet.links.manage` | Customer link protection | GOV-007 | access (+ security) (+ external) | not implemented over MCP |
| `mallet.credentials.rotate` | Provider credential custody | GOV-005 | security | not implemented over MCP |
| `mallet.attachments.read` | Private attachment access | GOV-008 | standard or sensitive | not implemented over MCP |
| `mallet.retention.erase` | Retention erasure and legal holds | GOV-006 | destructive (+ sensitive) | not implemented over MCP |
| `mallet.jobs.recover` | Background job authority and recovery | OPS-003 | standard or live (+ external) | not implemented over MCP |
| `mallet.advisor.price` | Inspection evidence to priced estimate | ADV-001 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.advisor.reply` | Policy-directed customer conversations | ADV-002 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.advisor.resolve` | Resolve the next repair blocker | ADV-003 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.advisor.source` | Source parts and keep promise times current | ADV-004 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.advisor.followup` | Bring declined work back at the right mileage | ADV-005 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.advisor.patterns` | Detect comeback and supplier quality patterns | ADV-006 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.advisor.reconcile` | Reconcile repair pickup payment and profit | ADV-007 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.assistants.intake` | Bounded agent authority and receptionist handoff | ADV-008 | standard (+ commitment) (+ money) (+ external) (+ sensitive) | not implemented over MCP |
| `mallet.sms.register` | Register the shop’s outside messaging identity | MSG-001 | accounts · external (+ gated) | not implemented over MCP |
| `mallet.providers.connect` | Connect the named merchant, mailbox, calendar, storefront and OEM accounts | PAY-001, PAY-002, MSG-002, MSG-003, CAL-001, CAL-002, STORE-001, STORE-002, OEM-001, OEM-002 | access · security (+ gated) | not implemented over MCP |
| `mallet.purchases.approve` | Bind the exact purchase spend and PO version | BUY-001 | money · commitment | not implemented over MCP |
| `mallet.orders.compare` | Compare current supplier quotes without placing an order | BUY-002, BUY-003, BUY-004, BUY-005, PART-007 | standard or external | not implemented over MCP |
| `mallet.retention.hold` | Place or release the scoped retention hold | GOV-006 | commitment | not implemented over MCP |
| `mallet.retention.configure` | Set the documented retention purposes and lifetimes | GOV-006 | security (+ commitment) | not implemented over MCP |

**Resources.** `mallet://customers/{id}`, `mallet://assets/{id}`, `mallet://repairs/{id}`, `mallet://inspections/{id}`, `mallet://estimates/{id}`, `mallet://parts/{id}`, `mallet://orders/{id}`, `mallet://invoices/{id}`, `mallet://jobs/{id}` and `mallet://audit/{id}`.

**Events.** Repair, inspection, customer-decision, part/order, job, invoice and payment changes; the corresponding policy, review and approval decisions. **Prompts.** Complete a repair week → SURFACE-005; price inspection evidence → ADV-001; resolve blockers → ADV-003; source delayed parts → ADV-004; reconcile pickup → ADV-007.

**Not tools, and why.** HTTP-001: private-door boundaries are an installation fact; OPS-002: measured installation capacity is proved by the seeded workload; IMPORT-001: the reviewed import door owns source preview, apply and undo; DIAG-003: the licensed connector supplies the source; estimate preparation remains a tool; GUIDE-001: the licensed connector supplies the source; estimate preparation remains a tool; GUIDE-002: the licensed connector supplies the source; estimate preparation remains a tool; GUIDE-003: the licensed connector supplies the source; estimate preparation remains a tool; HARDWARE-001: physical printer/scanner drivers run on a device; related receiving records remain tools; MOBILE-001: these are people’s interactive screens and device capture/sync behavior; MOBILE-002: these are people’s interactive screens and device capture/sync behavior; MOVE-001: the reviewed import door owns source preview, apply and undo; MOVE-002: the reviewed import door owns source preview, apply and undo; MOVE-003: the reviewed import door owns source preview, apply and undo; MOVE-004: the reviewed import door owns source preview, apply and undo; MOVE-005: the reviewed import door owns source preview, apply and undo; MOVE-006: the reviewed import door owns source preview, apply and undo; MOVE-007: the reviewed import door owns source preview, apply and undo; MOVE-008: the reviewed import door owns source preview, apply and undo; MOVE-009: the reviewed import door owns source preview, apply and undo; MOVE-010: the reviewed import door owns source preview, apply and undo; MOVE-011: the reviewed import door owns source preview, apply and undo; MOVE-012: the reviewed import door owns source preview, apply and undo; MOVE-013: the reviewed import door owns source preview, apply and undo; OPS-001: licensing, installation and archive verification are installation facts and the import door; OPEN-001: licensing, installation and archive verification are installation facts and the import door. A person’s safety inspection, receipt of keys and provider-hosted identity/password/2FA steps remain physical or interactive evidence; their record preparation remains a tool.

**Limits.** OPS-002’s seeded capacity and timing bars remain gating. [Capacity and custody parameters](docs/contract-mechanisms.md) describe request, media and byte limits. Business volume thresholds and provider spend caps are the company’s policy.

**Handoffs.** Listen for supplier, payment, mailbox, calendar and repair events from the named connectors; emit typed repair, part, consent and payment references for Crank and the connected books, inventory and identity specialists.

#### SURFACE-001 — Service-advisor registry

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-002, BASE-AGENT-006, BASE-AGENT-013 · *Rules:* D-1, D-2, D-3 · *Register:* R-10

**Requirement.** The service-advisor registry and discovery manifest equal the planned job table, including its explicit non-tool reasons.

**Acceptance.**
1. The registered jobs cover every Core id in the table or its stated physical, screen, connector, import or installation reason.
2. The Base conformance journey exercises the registered repair actions on Mallet’s seeded records under both company policies.

#### SURFACE-002 — Repair classes and provider steps

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-1, D-2, D-3

**Requirement.** Compute repair and provider classes from the server’s exact repair, recipient, price, provider and authority records.

**Acceptance.**
1. An internal reversible draft is standard with its item count.
2. Sharing to a colleague stays internal; a customer, supplier or public link adds external with exact recipient count and counterparty.
3. An authorized diagnostic estimate or order, published price change, payment or refund carries money with exact amount, currency and counterparty; check-in confirmation uses its saved quote, matched customer and signed receipt, while a draft alone creates none of those effects.
4. Diagnostic-estimate authorization, repair, promise, warranty and claim decisions carry commitment with their exact source revision, value and counterparty; check-in confirmation binds the signed diagnostic quote and resulting estimate revision without authorizing broader repairs or payment.
5. Creating an outside messaging identity or paid resource carries accounts with its provider.
6. A provider-owned consent, checkout or verification step carries gated with the provider and required step.
7. Changing continuing staff, assigned-crew, customer-link or agent authority carries access with people and widening or narrowing direction.
8. Changing protective settings, retention settings, factors or credentials carries security with the affected setting; issuing an access credential carries both access and security.

#### SURFACE-003 — Irreversible, regulated and live repair facts

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-006, BASE-AGENT-007 · *Rules:* D-1, D-2, D-3

**Requirement.** Classify irreversible custody effects, regulated records and running-service changes on the shop’s own scenarios.

**Acceptance.**
1. An irreversible erasure, custody deletion or cancellation/lost board closure carries destructive and the affected item count; closure retains its reason and history and releases the repair’s stock and booked resources.
2. A regulated identity/bank record or payroll-rate read carries sensitive with record count and kind.
3. Changing routing, scheduled jobs, calendar synchronization or a running board rule carries live with the service identity.
4. Moving an otherwise internal record where a customer can now see it adds external; a claimed confirmation in imported text changes none of these facts.

#### SURFACE-004 — Repair resources and handoffs

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-003, BASE-AGENT-010, BASE-AGENT-013 · *Rules:* D-1, D-2, D-3

**Requirement.** The repair graph, exact consent, inventory, invoice and recovery state are resources linked by the table’s jobs, with typed references for the named specialists.

**Acceptance.**
1. The resource inventory covers every record family named above on a populated repair fixture.
2. Intake, findings, exact decisions, supplier changes, invoices and recovery events retain the same repair and source identities across the subscribed and replayed handoff.
3. Private technician notes and unshared original media remain outside the customer’s resource view in the same populated fixture.

#### SURFACE-005 — A seeded repair week through MCP

*Tier:* Agent surface · *From:* new · *Cites:* BASE-AGENT-007, BASE-AGENT-009, BASE-AGENT-011, BASE-AGENT-012, BASE-AGENT-013 · *Rules:* D-1, D-2, D-3 · *Register:* R-10

**Requirement.** A stranger agent given only the seed URL completes the service-advisor week on seeded records, including the pre-recorded qualified physical evidence, under the two named company policies.

**Acceptance.**
1. Under all autonomous, take intake, measured findings, a priced exact estimate, the customer’s recorded decision, a supplier delay and revised promise, authorized actuals, invoice/payment evidence and follow-up through their tools; no agent call waits for a policy approval or is refused by policy.
2. Under held (standard review and the other declared classes approval), complete the same week after the named test person handles each policy-held step, and reconcile actions, review entries and exact approved revisions.
3. Revoke the queued outreach grant and change an estimate revision during the week; the obsolete action has no effect and the next permitted action uses the current evidence.
4. Keep qualified-person safety clearance, actual receipt, customer consent and provider settlement distinct from the agent’s interpretation throughout both runs.

## Push further

### Push further with a service-advisor agent

#### ADV-001 — Inspection evidence to priced estimate

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-INPUT-003, BASE-AGENT-005 · *Rules:* D-1, D-2, D-3

**Requirement.** The advisor agent reads actual DVI measurements/media, vehicle/engine, prior repairs, licensed procedures/labor times and current compatible stock/quotes to propose cited repairs, alternatives and a priced estimate. It names missing evidence and contradictions. Physical diagnosis and safety evidence retain their qualified performer; an agent’s own binding decision carries commitment under the company’s policy. Agent price/scope decisions carry commitment and money; exposing the result to a customer adds external, and the company’s policy decides those calls.

**Acceptance.**
1. Under the held company policy, give a real inspection with a contradictory DTC and two part choices to the agent; inspect citations, fitment, labor overlap and totals, reject a proposal and prove no customer message/order/work occurs.

#### ADV-002 — Policy-directed customer conversations

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-005 · *Rules:* D-1, D-2, D-3

**Requirement.** Under the company’s policy for standard drafts and external sends, the agent drafts or sends inspection/estimate messages and answers questions using only shared repair evidence, prices, consent and current provider facts. It identifies itself, preserves transcript and escalates ambiguity, safety, disputes, discounts and new scope. Customer replies never become consent unless captured through EST-003.

**Acceptance.**
1. Under the held company policy, approve an exact estimate message, ask a factual question and then demand a discount/safety assurance; send only authorized facts, escalate the exceptions and keep line decisions unchanged until the customer signs.

#### ADV-003 — Resolve the next repair blocker

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-MAIL-001 · *Rules:* D-1, D-2, D-3

**Requirement.** Continuously join intake, diagnostics, authorization, parts, technician progress and promise history to identify the next blocker, assign an owner, prepare the smallest permitted next action and track acknowledgment to resolution. Changed scope and promises carry commitment, prices add money and an outside recipient adds external; the company’s policy decides the call.

**Acceptance.**
1. Under the held company policy, stall three repairs on evidence, consent and a backorder; inspect distinct cited blockers, approve actions and follow their actual outcomes through to cleared work without falsely marking completion.

#### ADV-004 — Source parts and keep promise times current

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-005 · *Rules:* D-1, D-2, D-3

**Requirement.** Read fitment, warranty/quality constraints, supplier stock/cost/cutoffs, open POs and work capacity; compare approved alternatives, draft exact orders and chase acknowledged ETA changes. Supplier orders and substitutions carry money and external, changed promises carry commitment and external, and the company’s policy decides agent calls. Customer consent to extra charges and receiving evidence remain distinct records.

**Acceptance.**
1. Under the held company policy, delay a required part and offer an incompatible cheaper alternative; reject bad fitment, approve a valid substitution and revised customer promise, then verify ETA clears only on actual receipt.

#### ADV-005 — Bring declined work back at the right mileage

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008 · *Rules:* D-1, D-2, D-3

**Requirement.** Link declined findings to real mileage/time, service schedules, updated inspections, ownership and communication consent; propose the right next offer with current price/availability and booking capacity, suppress obsolete/completed items and follow replies to an attributed decision whose commitment class the company’s policy decides.

**Acceptance.**
1. Under the held company policy, decline a service, import a later odometer reading and a replacement inspection, approve eligible outreach and book it; stale findings and opt-outs produce no sends and the old consent is never reused.

#### ADV-006 — Detect comeback and supplier quality patterns

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-ROLE-001, BASE-INPUT-003, BASE-AUDIT-001, BASE-DATA-001, BASE-DATA-003, BASE-DATA-006, BASE-AGENT-005 · *Rules:* D-1, D-2, D-3

**Requirement.** Compare symptoms, prior repairs, measurements, installed serial/lots, RMA results, labor and warranty outcomes to flag likely repeat-failure clusters and prepare a cited review/claim packet. Technicians determine cause and safety; claim and corrective-action decisions carry commitment, adding money or external when the action spends or reaches a counterparty; the company’s policy decides agent calls.

**Acceptance.**
1. Under the held company policy, record repeated failures from one lot and an unrelated symptom; inspect the cited cluster, reject a false association and approve a supplier claim without an agent providing the qualified person’s diagnosis or safety clearance.
2. a likely cluster requires the same normalized recorded symptom, catalog item, supplier and marked lot on at least two distinct original repairs.
3. Serial provenance, prior actual work, diagnostic measurements, warranty decisions, claim outcomes and linked RMA histories remain cited observations, not inferred causes.
4. A human may append a rejected or retained association with reason; rejection excludes that case without rewriting source decisions.
5. A person’s warranty review retains the person’s authority; an agent’s claim decision carries commitment under the company’s policy.
6. Detected-cluster claims bind current source revisions; stale packets are refused.
7. No diagnosis, safety clearance, outbound submission, accounting posting or provider outcome follows from detection or review.
8. Review history and claim citations inherit the existing warranty archive, audit and erasure boundaries under OPS-001, DATA-001 and GOV-006; citations copy record identifiers and revisions, not customer or media snapshots.

#### ADV-007 — Reconcile repair pickup payment and profit

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-005 · *Rules:* D-1, D-2, D-3

**Requirement.** Compare authorized revisions, actual labor/parts costs, quality sign-off, physical handover, processor events and accounting postings; open cases for unbilled authorized work, incorrect cost or missing money and prepare a simulated correction. Agent credits and refunds carry money and collection decisions carry commitment under the company’s policy. Physical handover and settlement need the recorded human or provider evidence.

**Acceptance.**
1. Under the held company policy, provide a completed repair with a missing cost and short settlement; review proposed correction and margin effect, approve it and verify actual provider/ledger outcome before the case closes.

#### ADV-008 — Bounded agent authority and receptionist handoff

*Tier:* Core · *Cites:* BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-ROLE-001, BASE-MAIL-001, BASE-AGENT-005, BASE-OPS-003, BASE-OPS-004 · *Rules:* D-1, D-2, D-3

**Requirement.** Define separate revocable grants for receptionist intake/appointment booking, diagnostic-note polishing and sends decided by the company’s external policy, with chosen data, actions, channels and time scope; business spend and escalation follow the company’s policy. Preserve raw technician notes and every proposed edit, disclose AI interactions and stop queued actions on revocation; AGENT-001 preparation keys keep their original narrow authority. The fresh-confirmed current owner issues a separate revocable local key for one booking service, one repair's diagnostic notes, or one requested tentative appointment email. A granter chooses data, action, channel, start, expiry and any budget. The held journey uses a 31-day maximum scope, zero spend and only its requested appointment email. The illustrated narrow grant excludes orders, repair authorization, financial decisions and general workshop reads; a broader explicitly issued grant still uses the company’s money, commitment, external and sensitive policies. Receptionist intake records the customer's appointment request, consent evidence and AI disclosure before reserving existing capacity; it creates no repair or payment. Note proposals retain the entire raw revision, immutable structured measurements and trouble codes, and each proposed wording; numeric observations and written units cannot change, and the company’s policy decides an agent’s standard wording edit, which remains separate from the technician source. One generated email per requested tentative appointment carries external with the recipient and exact content. The company’s policy decides the call before the durable handoff claim. Revocation stops queued messages. Failed, uncertain or interrupted claims never retry automatically; staff see the outcome and record a human resolution. Human escalation remains available to every scoped assistant. Archives retain history but exclude local assistant keys; restored history grants no runnable authority. AGENT-001 keys retain only their original four preparation commands.

**Acceptance.**
1. Under the held company policy, let an explicitly authorized receptionist capture intake and reserve a slot, polish notes without changing measured facts, then revoke its grant before a queued send; no send/order/approval survives revocation or exceeds policy.

## Field proof register

| ID | Proof | Clauses | State | Date | Receipt |
| --- | --- | --- | --- | --- | --- |
| R-1 | Human screen-reader review | MOBILE-001 | not run | | |
| R-2 | Dated VPAT | MOBILE-001 | not run | | |
| R-3 | Real Google Workspace, Entra ID and Okta tenant receipts | GOV-003 | not run | | |
| R-4 | iOS and Android store approval receipts | MOBILE-002 | not run | | |
| R-5 | Physical DYMO, Zebra and Star counter-device pass | HARDWARE-001 | not run | | |
| R-6 | Real licensed automotive data and supplier account eligibility | GUIDE-001, GUIDE-002, GUIDE-003, DIAG-003, BUY-003, BUY-004, BUY-005, TIRE-001 | not run | | |
| R-7 | Real OEM, CARFAX and specialist diagnostic provider eligibility | OEM-001, OEM-002, VEH-003, DIAG-002 | not run | | |
| R-8 | Merchant, banking and financing eligibility and real settlement receipts | PAY-001, PAY-002, PAY-006, MONEY-001 | not run | | |
| R-9 | Authorized incumbent production extraction and media completeness receipts | MOVE-001, MOVE-002, MOVE-003, MOVE-004, MOVE-005, MOVE-006, MOVE-007, MOVE-008 | not run | | |
| R-10 | Real Claude, ChatGPT, Codex and Copilot client interoperability receipts | AGENT-001, SURFACE-001, SURFACE-005 | not run | | |
| R-11 | Professional jurisdiction-specific legal and tax review | RETURN-002, TAX-001, TAX-002, GOV-006 | not run | | |
| R-12 | Physical authenticator/passkey device pass | GOV-004 | not run | | |

## Boundaries

Mallet owns the complete repair-shop job above. It does not act as a bank, card network, lender, parcel carrier, OEM service franchise, physical diagnostic instrument, tax advisor or full general ledger. The shop uses its merchant-owned Stripe/Square accounts and financing partners, ShipStation/carriers, licensed labor/OEM programs, technician-confirmed tests and QuickBooks Online/Xero or Pantry. Integrating each required account, approval program and data agreement is part of delivery. Provider refusal or missing eligibility is visible and leaves the affected job pending; it never fabricates a result or removes the contractual integration.

The first buyer is US independent auto repair. Tire, fleet, bicycle, device, mail-in and equipment workflows remain expressly included at the named clauses’ depth. Manufacturing, general warehouse planning, payroll/tax filing ([Envelope](https://github.com/just-every/run-envelope)) and broad marketing campaign management stay in their separate products; Mallet exports staff time, finance and consented repair events to those authorities. Shop repair reminders, declined-work recovery and review follow-up are native Mallet workflows. Physical diagnosis, road-test and safe return are qualified technician decisions; consumer financing is underwritten and disclosed by the provider.

Provider sandboxes, official-schema fakes, run-auth and seeded capacity runs remain acceptance work. Production eligibility, physical devices, human professional review and store approval have their own dated register receipts.

## Homepage claims

| # | Claim | Clauses |
| --- | --- | --- |
| 1 | "Mallet checks cars in by VIN" | INTAKE-003, VEH-001 |
| 2 | "texts photo inspections for line-by-line approval" | DVI-002, DVI-003, MSG-001, EST-003, ESTIMATE-001 |
| 3 | "orders parts" | BUY-002 |
| 4 | "runs the technician board" | FLOW-001 |
| 5 | "takes payment" | PAY-003 |
| 6 | "brings customers back" | AUTO-003, AUTO-004, ADV-005 |
| 7 | "100% free, open source" | OPEN-001 |
| 8 | "alternative to Tekmetric, Shopmonkey and Mitchell 1 Manager SE" | MOVE-001, MOVE-002, MOVE-003 |
| 9 | RO 4127 · VIN decoded · 62,100 mi | VEH-001, VEH-002 |
| 10 | Inspection · 2 red, 3 yellow · texted to Dana Brooks | DVI-001, DVI-003, MSG-001 |
| 11 | Front brakes approved · cabin filter declined → due at 67,000 mi | ESTIMATE-001, EST-005 |
| 12 | Pads backordered at Worldpac → PartsTech +$8.40 · Dana re-approved 10:05 | ADV-004, BUY-003, BUY-005, ESTIMATE-001 |
| 13 | Bay 3 · Luis Romero · 2.4 hrs sold · promise 5:00 pm · ready 4:10 | WORKSHOP-001, FLOW-001, FLOW-002 |
| 14 | Paid by text · $531.70 incl. 7.5% tax | PAY-003, TAX-001 |
| 15 | Six-stop day timeline with "Promise 5:00 pm · kept" | WORKSHOP-001, FLOW-002 |
| 16 | "Dana checks in from her phone at the drop box" | INTAKE-003 |
| 17 | "Mallet decodes the VIN" | VEH-001 |
| 18 | "has the repair order ready when Kayla opens it" | INTAKE-003 |
| 19 | RO card: mileage in, last visit, "6 visits · 5 imported from Tekmetric" | WORKSHOP-001, VEH-002, MOVE-001 |
| 20 | "Luis inspects 39 points on a tablet" | DVI-001 |
| 21 | "Every red and yellow item carries a measurement and a photo" | DVI-001, DVI-002 |
| 22 | Inspection texted, "Delivered 9:12 · opened 9:19" | DVI-003, MSG-001 |
| 23 | "The agent prices what Luis found" | ADV-001, AGENT-001 |
| 24 | MOTOR labor times (1.6 + 0.8 hrs) | GUIDE-001 |
| 25 | "Checked by Kayla Ortiz" before it goes out | ESTIMATE-001, AGENT-001 |
| 26 | "Dana says yes to the brakes and not now to the filter" (on her phone, signed) | ESTIMATE-001, EST-003 |
| 27 | Declined work kept with photo and price, due at 67,000 mi | EST-005, DVI-002 |
| 28 | "The agent finds pads in stock nearby" | ADV-004, BUY-002, BUY-003 |
| 29 | "reprices the line" | ESTIMATE-001, AGENT-001 |
| 30 | "checks Bay 3’s afternoon" | AGENT-001, FLOW-002 |
| 31 | "Dana re-approves by text" | EST-003, MSG-001, ESTIMATE-001 |
| 32 | Worldpac backorder, Morse Rd supplier via PartsTech, order approved, pads scanned to RO 4127 | BUY-002, BUY-003, BUY-005, PART-006 |
| 33 | "Customer promise changed: no" | FLOW-002 |
| 34 | "Every car’s stage, promise and clock, live" | FLOW-001, FLOW-002, TIME-001 |
| 35 | "Technicians start and stop jobs from the bay" | WORK-001, TIME-001 |
| 36 | Waiting parts: promise moved, customer told | PART-006, FLOW-002 |
| 37 | Agent "Next blocker" | ADV-003 |
| 38 | "clocked in 7:28 am · 6.1 hrs sold today" | TIME-001 |
| 39 | Quality check: road test, pedal, lug torque, signed | QUALITY-001 |
| 40 | "Dana gets a ready text with her balance and pays from her phone" (Apple Pay) | PAY-003, MSG-001 |
| 41 | Invoice 10418 from labor and parts, sales tax 7.5% | INVOICE-001, TAX-001 |
| 42 | "QuickBooks has it a minute later" | BOOKS-001 |
| 43 | Collected 4:30 pm, miles out, keys returned | RETURN-001, VEH-002 |
| 44 | Reminder on Priya's phone: "Timing belt due at 105,000 mi", $780.00, Book | AUTO-004, ADV-005, MSG-001, BOOK-001 |
| 45 | "The agent tracks declined work and service intervals by mileage" | ADV-005, AUTO-003, AUTO-004 |
| 46 | "refreshes each price" | ADV-005 |
| 47 | "drafts the text for Kayla to send" | ADV-002, MSG-001, MSG-004 |
| 48 | Text failed on a landline, sent by email | MSG-001, MSG-002 |
| 49 | Reminders stopped for a sold vehicle | AUTO-003 |
| 50 | Emailed weekly report: car count, ARO, sales, on promise | REPORT-001, REPORT-004, REPORT-006 |
| 51 | Technician sold, clocked and efficiency | REPORT-003 |
| 52 | "Every number opens the repair orders behind it" | REPORT-001, REPORT-007 |
| 53 | "31,906 Tekmetric repair orders, all searchable" | MOVE-001 |
| 54 | "Customers, vehicles, history, canned jobs and open work come across before cutover" | MOVE-001, MOVE-012, MOVE-013 |
| 55 | Reviewed import (preview, apply what was reviewed) | MOVE-010, IMPORT-001 |
| 56 | Shadow compare RO 3987 and cutover | MOVE-012 |
| 57 | "Run it yourself with one line" (`npx -y @runeditrun/rer dev just-every/run-mallet`) | OPS-001 |
| 58 | "100% free and open source. MIT licensed." | OPEN-001 |
| 59 | "Free, open source shop management" | OPEN-001 |

### Shared preparation door

The copied Base agent door is the single MCP and company-policy receiver for
Mallet's current AGENT-001 preparation surface. It inherits BASE-AGENT-001,
BASE-AGENT-002, BASE-AGENT-003, BASE-AGENT-004, BASE-AGENT-005,
BASE-AGENT-006, BASE-AGENT-007, BASE-AGENT-008, BASE-AGENT-009,
BASE-AGENT-010, BASE-AGENT-011, BASE-AGENT-012 and BASE-AGENT-013.
`agent-surface.json` declares the adopted registry and public-door journey.
Native human decisions, customer consent, physical evidence and provider outcomes
remain separate from preparation. This adoption does not assert the pending ct
service-advisor surface or change the native owner-confirmation riders.
The declared capabilities are tools, resources, policy, pause, audit and idempotency.
Public resources adopt the existing assets, repairs, jobs, estimates and invoices
preparation views under unchanged `workshop:read` authority. Repair links retain
exact dispatch proposals without applying them. Events, prompts and subscriptions
remain undeclared families with typed refusals; the full resource clause remains
PARTIAL. Multi-sponsor, mail-provider tools,
record refresh, timed lifecycle, dual host and queued lifecycle are not proved.
Queued agent execution remains unadopted in the seed; Base's authenticated
continuation hooks do not themselves establish native queue consent binding.
See [the agent door's supported scope](docs/agent-door.md).

## Status

Judged from the code and tests at commit `39e7b596fc2a2a9cd592c139276f47f1611565d0` (30 October 2026).

| Clauses | Done | Partial | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| Published | 1 | 8 | 0 | 9 |
| Target and push further | 22 | 80 | 59 | 161 |
| All | 23 | 88 | 59 | 170 |

| Clause | Title | Kind | Status | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| `HTTP-001` | Private app boundary | published | partial | `src/mallet/http.ts`; `src/mallet/auth.ts`; `tests/mallet.test.mjs` | Not asserted in the old cited evidence: Private page refusal while signed out; Private state refusal while signed out; Private command refusal while signed out; Private export refusal while signed out; Revoked-session refusal; Cross-origin mutation refusal with no write; Authorized private-door success and unchanged refusal state. Asserted: Another role sees no assigned repair. |
| `WORKSHOP-001` | Register and visits | published | partial | `src/mallet/workshop.ts`; `tests/mallet.test.mjs`; `tests/browser-journey.mjs` | Not asserted in the old cited evidence: Counter registration creates the asset; Technician collision outcome is read back; History download names the second visit. Asserted: Repeated visits remain in history; Bay collision is read back. |
| `ESTIMATE-001` | Exact decision | published | partial | `src/mallet/estimates.ts`; `tests/mallet.test.mjs`; `tests/browser-journey.mjs` | Not asserted in the old cited evidence: Prepared and revised exact API content; Stale approval refusal outcome; Printed handoff is read back; Accepted lines cannot be changed; Unapproved line refusal; Excess quantity refusal. Asserted: Partial authorization retains exact total. |
| `WORK-001` | Authorized actuals | published | partial | `src/mallet/workshop.ts`; `src/mallet/model.ts`; `tests/mallet.test.mjs` | Not asserted in the old cited evidence: Assigned member actual is read back; Another-job refusal has unchanged actuals; Unapproved-line refusal has unchanged actuals; Excess-quantity refusal has unchanged actuals; Completed job retains actual actor; Completed job retains exact source revision. The native journeys exercise the workflow, but their title, performed step or uncited helper is not a point-level assertion here. |
| `INVOICE-001` | One saved export | published | partial | `src/mallet/invoices.ts`; `tests/mallet.test.mjs`; `tests/browser-journey.mjs` | Not asserted in the old cited evidence: Approval history retains exact deciding actor and revision; Retry using the preceding version returns the same saved export; Actual-work invoice has the expected lines. Asserted: Exact invoice cent total; Repeated export identity is equal; Exactly one saved export; Exact approval history count. |
| `AGENT-001` | Scoped preparation keys | published | partial | `src/mallet/auth.ts`; `src/mallet/model.ts`; `tests/mallet.test.mjs`; `tests/browser-journey.mjs` — preparationKeyBrowser, invoked by that push journey, proves native owner issuance, exact revised draft and person decision readback, native revocation and unchanged refused preparation with credential-masked screens at 1440 and 390 | Not asserted in the old cited evidence: Native issuance returns a key (assertion is in uncited tests/browser-journey.mjs); Preparation succeeds with exact draft content; Preparation scope refuses approval; Preparation scope refuses sharing; Preparation scope refuses customer authorization; Preparation scope refuses invoice export; Preparation scope refuses erasure; Preparation scope refuses access management; Person decision is retained with attribution; Revoked key cannot write; Concurrent revoked write changes nothing. The native journeys exercise the workflow, but their title, performed step or uncited helper is not a point-level assertion here. |
| `IMPORT-001` | Reviewed register move | published | partial | `src/mallet/imports/service.ts`; `src/mallet/imports/snapshots.ts`; `tests/mallet.test.mjs` | Not asserted in the old cited evidence: An asset with a native visit itself survives undo; Journal retains resumed batches. Asserted: Preview leaves the asset population absent; Exact reviewed import population; Apply replay has one job identity; Journal retains originals; Undo removes untouched assets. |
| `DATA-001` | Custody and erasure | published | partial | `src/mallet/archive-policy.mjs`; `src/mallet/imports/portability.ts`; `src/mallet/imports/erasure.ts`; `tests/mallet.test.mjs`; `src/mallet/restore/notice.mjs`; `src/mallet/ui/restore.ts`; `tests/restore.test.mjs` | Not asserted in the old cited evidence: Populated repair history compares after empty-destination recovery; Populated restore has no effect; Unauthorized erasure has no effect. Asserted: Known pre-erasure archive leaves destination unpopulated; Current post-erasure archive excludes erased asset. Matching repair-history and populated-restore assertions exist in uncited tests/support/portable-repair.mjs; they cannot be added to this carried evidence set. |
| `PIER-001` | Read only | published | done | `src/mallet/pier.ts`; `src/mallet/http.ts`; `tests/pier-journey.mjs`; `tests/support/real-pier.mjs` |  |
| `CUS-001` | Customer and fleet accounts | target | partial | `tests/mallet.test.mjs`; `tests/support/customers-journey.mjs`; `tests/support/portal-journey.mjs`; `tests/customers-browser.mjs` | GOV-001 finer roles are still to come. SMS sign-in links (MSG-001) and portal payment initiation are not built. CUS-001 and PORTAL-001 stay PARTIAL per ct batch-11 D. The per-address and per-client request limits are disclosed implementation values, not contract policy. Session membership revocation and exact 24-hour server expiry gaps from ct 22 Oct 2026 are now asserted; status remains PARTIAL. |
| `VEH-001` | Vehicle identity and VIN decode | target | missing |  | No structured vehicle fields, camera VIN/plate scan or decode provider connection. |
| `VEH-002` | Mileage and service intervals | target | done | `src/mallet/mileage.ts`; `src/mallet/ui/mileage.ts`; `tests/mallet.test.mjs` |  |
| `VEH-003` | CARFAX service history exchange | target | missing |  | No CARFAX history or service reporting integration; account/program approval is required engineering work. |
| `INTAKE-001` | Condition media and custody | target | partial | `tests/media.test.mjs`; `tests/intake-browser.mjs` | Not asserted in the old cited evidence: Vehicle damage condition is read back; Signed custody receipt fields are read back. Asserted: Vehicle key checklist is visible; Device charger checklist is visible; Photos remain attached; Actual returned checklist is compared. Additional signed-checklist and condition assertions live in uncited tests/support/intake-journey.mjs. |
| `INTAKE-004` | Temporary unlock custody | target | partial | `tests/media.test.mjs` — “INTAKE-001 / INTAKE-004 / OPS-001: signed condition and custody, exact checklist comparison, private temporary secrets and fresh-owner recovery” directly stores and exactly reveals a distinctive consented unlock value, inspects populated public state, exact non-secret store and reveal custody entries, downloaded audit JSON and CSV and every downloaded portability archive part; it refuses signed-out reveal without changing business or custody records and excludes the secret table while retaining exact non-secret history. `tests/intake-browser.mjs` — intakeBrowser, registered by “INTAKE-001: vehicle and device signed custody and actual checklist comparison at 1440/390”, reloads native custody pages after storage and reveal, independently reads persisted consent, purpose, actor and access reason, preserves the exact entered value only on reveal and verifies empty general-page secret fields. Existing `tests/support/intake-journey.mjs` retains customer erasure and recovery coverage. | Not asserted in the old cited evidence: No material is copied to public state; No material is copied to audit; No material is copied to archives; Purpose end destroys readability; Lifetime expiry destroys readability; Older database cannot recover the secret; Destination authority is fresh. Asserted: Consented material is readable only through the authorized vault; Customer erasure removes reveal; Non-secret custody history restores exactly. Additional vault, state/audit/archive absence and recovery assertions live in uncited tests/support/intake-journey.mjs. |
| `INTAKE-002` | Custom forms and signed shop terms | target | partial | `tests/media.test.mjs`; `tests/intake-forms-browser.mjs` | Not asserted in the old cited evidence: Two published templates are both read back. Asserted: Original terms survive template change; Staff retrieve the original signed version; Required phone fields retain saved answers; Exact readable copy is downloadable. Additional vehicle/device-template and delivered-copy assertions live in uncited tests/support/intake-forms-journey.mjs. |
| `INTAKE-003` | Counter and after-hours check-in | target | done | `tests/media.test.mjs`; `tests/support/check-in-journey.mjs`; `tests/check-in-browser.mjs` |  |
| `BOOK-001` | Online appointment booking | target | partial | `tests/mallet.test.mjs` | Not asserted in the old cited evidence: Embedded booking form; Phone service selection; Last-bay contention result; Exactly one confirmed appointment is sent; Cancellation frees the claimed capacity. The native journeys exercise the workflow, but their title, performed step or uncited helper is not a point-level assertion here. Additional booking assertions live in uncited tests/support/booking-journey.mjs and tests/bookings-browser.mjs. |
| `BOOK-002` | Resource calendars and recurring reservations | target | partial | `tests/mallet.test.mjs`; `tests/support/calendar-journey.mjs`; `tests/support/waitlist-journey.mjs`; `tests/calendar-browser.mjs` | Native resource calendars, qualifications, absences and dated recurring reservations are asserted. Point-level completion proof for every resource, competing-dispatch and recurring-DST outcome remains unestablished. |
| `BOOK-003` | Cancellation waitlist offers | target | partial | `tests/mallet.test.mjs`; `tests/support/calendar-journey.mjs`; `tests/support/waitlist-journey.mjs`; `tests/calendar-browser.mjs` | Native matching-FIFO offers and explicit staff recovery are asserted. Complete permission, FIFO, expiry and failed/uncertain-handoff outcome proof remains unestablished. |
| `DIAG-001` | Diagnostic findings and private notes | target | done | `src/mallet/diagnostics.ts`; `src/mallet/diagnosis-links.ts`; `src/mallet/ui/diagnostics.ts`; `migrations/core/0021_customer_links.sql`; `tests/support/diagnosis-journey.mjs`; `tests/diagnosis-browser.mjs` |  |
| `ASSET-001` | Bicycle and device repair benches | target | done | `tests/mallet.test.mjs`; `tests/support/asset-journey.mjs`; `tests/asset-browser.mjs` |  |
| `DVI-001` | Configurable digital inspections | target | done | `src/mallet/inspections.ts`; `src/mallet/inspection-photo.ts`; `src/mallet/inspection-visibility.ts`; `src/mallet/ui/inspections.ts`; `tests/mallet.test.mjs`; `tests/support/inspection-journey.mjs`; `tests/inspection-browser.mjs`; `src/mallet/media/history.ts`; `src/mallet/media/browser-history.ts` |  |
| `DVI-002` | Photo and video inspection evidence | target | done | `tests/media.test.mjs` — “DVI-002 and OPS-001: private original and shared custody, interrupted upload, exact replay, assignment and revocation and full archive recovery” proves attributable capture time, resumable chunks, exact original digest, duplicate and conflict control, private full and ranged refusal bodies for signed-out, unassigned, reassigned, revoked and agent readers, and exact fresh-owner recovery without source-session authority. `tests/media-browser.mjs` — “mediaBrowser”, registered in `tests/media.test.mjs`, captures marked-up brake photos and playable video, interrupts and resumes the actual multipart upload with one finding and upload identity, opens the original and compressed shared photo, and records the finding screens at 1440 and 390. |  |
| `DVI-003` | Customer inspection presentation | target | partial | `tests/mallet.test.mjs` | ct 22 Oct 12:58Z APPROVED AS LANDED. Email leg only: SMS stays MSG-001's and report/media retention stays GOV-006's as named Gaps; DVI-003 stays PARTIAL. Resend downstream email delivery is proved at the controlled network edge; SendGrid events whose message ID differs from its submission receipt remain unconfirmed, and Cloudflare queue delivery is not wired. |
| `DVI-004` | Inspection history comparison | target | done | `src/mallet/media/history.ts`; `src/mallet/media/validation.ts`; `src/mallet/media/browser-history.ts`; `src/mallet/ui/media.ts`; `migrations/core/0020_inspection_resolution.sql`; `tests/media.test.mjs`; `tests/inspection-history-browser.mjs` |  |
| `QUALITY-001` | Completion tests and return clearance | target | partial | `src/mallet/quality.ts`; `src/mallet/ui/quality.ts`; `src/mallet/workshop.ts`; `tests/mallet.test.mjs`; `tests/support/quality-journey.mjs`; `tests/quality-browser.mjs`; `tests/support/portable-repair.mjs` | The native physical-quality sequence and independent sign-off are asserted. The agent’s own commitment decision under the company’s policy remains unasserted. |
| `DIAG-002` | Specialist diagnostics connections | target | partial | `tests/mallet.test.mjs`; `tests/support/diagnostic-results-journey.mjs`; `tests/diagnostic-results-browser.mjs`; `docs/diagnostic-results.md` | Phonecheck result-file intake is asserted; vehicle scan-tool and Blackbelt360 adapters, complete source schemas and all provider result cases remain unbuilt or unproved. RL-104 governs privacy and separate action authority. |
| `DIAG-003` | OEM service information and recall context | target | missing |  | No automotive technical-data, TSB, recall or maintenance-schedule integration. |
| `EST-001` | Parts and labor pricing | target | done | `tests/mallet.test.mjs`; `tests/support/estimate-pricing-journey.mjs`; `tests/estimate-pricing-browser.mjs` |  |
| `EST-002` | Canned jobs and pricing matrices | target | partial | `src/mallet/pricing.ts`; `src/mallet/inspections.ts`; `src/mallet/ui/pricing.ts`; `tests/mallet.test.mjs`; `tests/support/pricing-journey.mjs`; `tests/pricing-browser.mjs` | Not asserted in the old cited evidence: Package originates from an inspection finding. Asserted: Cost matrix prices the package; Override reason and actor are retained; Matrix edits preserve the full old estimate. |
| `EST-003` | Customer approval and decline by link | target | done | `src/mallet/approval-links.ts`; `src/mallet/approval-door.ts`; `src/mallet/ui/approval.ts`; `migrations/core/0022_approval_links.sql`; `tests/support/approval-journey.mjs`; `tests/approval-browser.mjs` |  |
| `EST-004` | Supplemental approval on the same repair | target | done | `src/mallet/estimates.ts`; `src/mallet/supplement-scope.ts`; `src/mallet/workshop.ts`; `src/mallet/invoices.ts`; `src/mallet/ui/estimates.ts`; `tests/mallet.test.mjs`; `tests/support/supplement-journey.mjs`; `tests/supplement-browser.mjs` |  |
| `EST-005` | Declined work register | target | done | `src/mallet/declined-work.ts`; `src/mallet/ui/declined-work.ts`; `tests/mallet.test.mjs` |  |
| `GUIDE-001` | MOTOR labor times | target | missing |  | No MOTOR labor-guide adapter or overlap-time handling. |
| `GUIDE-002` | ALLDATA labor and procedures | target | missing |  | No ALLDATA integration or entitlement workflow. |
| `GUIDE-003` | ProDemand estimating and maintenance | target | missing |  | No ProDemand adapter or licensed-data workflow. |
| `EST-006` | Estimate expiry and approval chasing | target | done | `src/mallet/approval-chasing.ts`; `src/mallet/approval-door.ts`; `src/mallet/approval-links.ts`; `src/mallet/ui/chasing.ts`; `migrations/core/0023_approval_reminders.sql`; `tests/support/chase-journey.mjs`; `tests/approval-browser.mjs` |  |
| `EST-007` | Approval-chasing recovery tasks | target | partial | `src/mallet/approval-chasing.ts`; `src/mallet/approval-door.ts`; `src/mallet/approval-links.ts`; `src/mallet/ui/chasing.ts`; `migrations/core/0023_approval_reminders.sql`; `tests/support/chase-journey.mjs`; `tests/approval-browser.mjs` | Not asserted in the old cited evidence: An interrupted uncertain send opens the distinct recovery outcome. Asserted: A rejected send opens one advisor task; The task retains the rejected reminder outcome; An expired undecided revision has an unanswered task; Resolution retains the authorized person; Resolution retains the entered note. |
| `FLOW-001` | Live repair and technician boards | target | partial | `src/mallet/flow.ts`; `src/mallet/ui/board.ts`; `src/mallet/ui/flow.ts`; `tests/support/flow-journey.mjs`; `tests/flow-browser.mjs` | Not asserted in the old cited evidence: Quality refusal leaves completion unchanged. Asserted: Repair crosses its recorded stages; Technician filter returns its exact repair; Overdue promise filter returns its exact repair; Authorization gate preserves the prior stage. |
| `FLOW-002` | Promise times and capacity | target | done | `src/mallet/promises.ts`; `src/mallet/promise-zone.ts`; `src/mallet/promise-door.ts`; `src/mallet/ui/promises.ts`; `src/mallet/http.ts`; `tests/support/promise-journey.mjs`; `tests/promise-browser.mjs` |  |
| `FLOW-003` | Rules-based routing and escalation | target | done | `src/mallet/routing.ts`; `src/mallet/routing-door.ts`; `docs/routing.md`; `tests/mallet.test.mjs`; `tests/support/routing-journey.mjs` |  |
| `TIME-001` | Employee clock and job timers | target | partial | `src/mallet/time.ts`; `src/mallet/ui/time.ts`; `src/mallet/http.ts`; `tests/mallet.test.mjs`; `tests/support/time-journey.mjs`; `tests/time-browser.mjs` | Not asserted in the old cited evidence: A member’s attempt leaves a colleague’s original time unchanged. Asserted: Attendance is computed from clock events; Breaks remain separate; Actual nonbillable and rework time remains separate; Sold hours are independently displayed; Approved correction retains original intervals; Correction retains manager and reason. |
| `FLOW-004` | Technician crews and subtasks | target | done | `src/mallet/collaboration.ts`; `src/mallet/ui/collaboration.ts`; `src/mallet/http.ts`; `src/mallet/media/storage.ts`; `tests/support/collaboration-journey.mjs`; `tests/collaboration-browser.mjs` |  |
| `FLOW-005` | Acknowledged technician handoff | target | partial | `src/mallet/collaboration.ts`; `src/mallet/ui/collaboration.ts`; `src/mallet/http.ts`; `src/mallet/media/storage.ts`; `tests/support/collaboration-journey.mjs`; `tests/collaboration-browser.mjs` | Not asserted in the old cited evidence: Exact elapsed per-person time in receipt; Decline retains reason. Asserted: Proposal leaves the prior lead unchanged; Recipient acceptance changes the lead; Receipt retains exact from actor; Receipt retains exact to actor; Receipt retains work-state note; Receipt has both technicians’ time identities; Open subtasks are retained; Decline keeps the prior assignment. |
| `WARRANTY-001` | Warranty and comeback work | target | partial | `tests/mallet.test.mjs`; `tests/warranty-browser.mjs` | Not asserted in the old cited evidence: No-charge labor has exact zero-price actuals. Asserted: Coverage result appears for the linked comeback; Prepared supplier claim cites both repair cases; Net comeback cost is read back; Original invoice stays exact. |
| `RETURN-001` | Paid and documented handover | target | partial | `tests/mallet.test.mjs`; `tests/return-browser.mjs`; `tests/support/return-revision.mjs` | Not asserted in the old cited evidence: Failed quality result prevents collection; Actual delegate authorization and identity are read back. Asserted: Unpaid collection is visibly refused; Processor captured funds are read back; Printable receipt retains returned key count; Override reason remains visible in the final handover receipt. |
| `RETURN-002` | Storage, abandoned property and repair liens | target | missing | Candidate implementation evidence, pending acceptance: `tests/mallet.test.mjs` — "RETURN-002: reviewed CA and TX storage versions, notice clocks, disposal refusal, payment release and private recovery" (`tests/support/storage-journey.mjs`, storageJourney) proves frozen sourced rule versions, accrual start and notice deadline, exact delivery wait, early and policy disposal refusals, unpaid refusal followed by cash-funded handover freezing the capped ledger, private roles and fresh-owner archive recovery. "RETURN-002: native storage rules, notices, legal refusal and released ledger at 1440 and 390" (`tests/storage-browser.mjs`, storageBrowser) proves the native settings, repair ledger, notice, review, refusal and released handover screens at both widths. | Main judgment retained: no accepted versioned state-rule storage accrual, statutory notices, lien calculation or legally reviewed disposal. Owner-entered reviewed ledger only. Complete encoded and legally validated California and Texas statutory applicability, device notices, per-recipient step validation, state-specific calendar and sale procedures, storage-fee invoicing and settlement, and legally reviewed sale or disposal remain unbuilt or unproved. Disposal is disabled. Owner-only authority, elapsed-period capped accrual, recorded lien relinquishment and retained legal evidence are conservative defaults awaiting ct approval under mallet-storage-i931; RETURN-002 remains MISSING pending a new acceptance judgment. |
| `FLEET-001` | Fleet and commercial repair workflows | target | partial | ct 25 Oct 20:55Z approved PARTIAL as adopted; fleet riders proved by the receivables API and native journeys below; `tests/mallet.test.mjs` — "AR-001 and FLEET-001: owner-reviewed terms, credit limits, fleet authorizer, check allocation, disputes, promises and private recovered statements" (`tests/support/receivables-journey.mjs`) proves two term invoices, exact current balances after a partial check allocation, credit-limit refusal, driver-authorizer separation at term assignment, due dates and ageing, dispute and paid-balance suppression, promised-payment dates, non-owner refusal, immutable history and fresh-owner recovery without restored terms authority. "AR-001, FLEET-001 and TAX-002: native terms, fleet PO, disputed statement, promise and observed-clearance preview at 1440 and 390" (`tests/receivables-browser.mjs`) proves native reviewed terms, fleet PO, consolidated statement and vehicle repair drill-through, disputes, promises, mobile fit and icon-control audit. The same API journey additionally proves current fleet repair-authorizer and PO enforcement, stale-account refusal, bearer-link refusal, exact term-invoice contents, current accounts email, one Base mail handoff and replay refusal. Its native journey additionally proves the fleet repair-authority form and recorded decision, exact term-invoice issue and honest mail outcome at 1440 and 390. The same receivables API and native journeys prove separate source-cited recorded custody, exact intake and comparison drill-through, frozen invoice charge, missing and competing sources, same-vehicle cross-visit isolation, refused replay, unchanged approvals and balances and identical fresh-owner recovered projections. | Native terms, credit limits, statements, per-vehicle invoice charges, labelled booked-start to recorded-completion intervals and explicit term-invoice Base mail handoff now ship. ct 25 Oct 20:55Z: FLEET-001 approved PARTIAL as adopted (owner records account, authorizer, PO and approval evidence; driver and bearer cannot authorize). Riders: a change of fleet account or authorizer voids pending approvals; the PO and evidence are required, not optional; new missing row Fleet billing and statement reconciliation (FLEET-002). Existing approved terms custody remains current-owner-only with explicit audited fleet instructions, current account and invoice-authorizer match, no automatic outbound action or restored finance authority. This extends the qualified FLEET-001 inheritance of the ct 25 Oct 17:20Z AR-001 ruling; GOV-001 inherits delegated finance authority. No independent identity verification, email delivery or verified off-road downtime is claimed. The existing receivables API and native journeys prove account and authorizer changes void pending approvals, renewed approval, required PO and evidence, and driver refusal. FLEET-001 remains PARTIAL. Fleet billing and statement reconciliation is tracked separately by FLEET-002. Recorded custody evidence is implemented separately from booked start and completion. Verified off-road downtime, independent fleet-manager identity verification, mail delivery and complete FLEET-001 qualification remain unclaimed. Existing account, retention and multi-shop holds are unchanged. |
| `FLEET-002` | Fleet billing and statement reconciliation | target | missing |  | Not implemented (ct 25 Oct 20:55Z split from FLEET-001) |
| `PART-001` | Shop parts catalog and traceability | target | partial | `tests/mallet.test.mjs`; `tests/stock-trace-browser.mjs` | Not asserted in the old cited evidence: Both received lot quantities are independently asserted. Asserted: Installed lot use is read back; Installed use retains exact repair identity; Consumed supplier-lot search shows the repair; Unconsumed supplier-lot search excludes that repair. |
| `PART-002` | Barcode receiving and stock counts | target | partial | `tests/mallet.test.mjs`; `tests/inventory-browser.mjs` | Not asserted in the old cited evidence: Stock movement ledger reconciles every receipt and variance; Receiving report reconciles to movement totals; Variance report reconciles to movement totals. Asserted: Receipt shortage is exact; Approved variance changes stock to the expected quantity. |
| `PART-003` | Repair reservations and consumption | target | partial | `tests/mallet.test.mjs`; `tests/support/stock-consumption-journey.mjs`; `tests/inventory-browser.mjs` | Selected Pier movement authority, idempotent retry and source reconciliation remain unbuilt; the existing Pier connection exposes a catalog only. |
| `BUY-001` | Purchase orders and goods receipts | target | partial | `tests/mallet.test.mjs`; `tests/purchasing-browser.mjs` | Not asserted in the old cited evidence: Two-line exact approved cart is read back; Full received quantity is read back separately. Asserted: Partial received quantity and backorder remain visible; Changed bill has a price exception; Changed bill has a quantity exception. |
| `BUY-002` | Supplier stock and approved ordering | target | done | `tests/mallet.test.mjs`; `tests/support/supplier-orders-journey.mjs`; `tests/supplier-orders-browser.mjs`; `docs/supplier-ordering.md` |  |
| `BUY-003` | PartsTech catalog and orders | target | missing |  | No PartsTech adapter, credential onboarding or supplier-event mapping. |
| `BUY-004` | Nexpart catalog and orders | target | missing |  | No Nexpart connection or distributor onboarding. |
| `BUY-005` | Worldpac sourcing and orders | target | missing |  | No Worldpac or speedDIAL integration; supplier approval/access work remains required. |
| `PART-004` | Core deposits and returns | target | partial | `tests/mallet.test.mjs`; `tests/support/cores-journey.mjs`; `tests/cores-browser.mjs` | Not asserted in the old cited evidence: Physical core shipment evidence is read back. Asserted: Core deposit has exact subtotal; Core deposit has exact tax; Core deposit is recorded; Adjusted supplier credit is exact; Customer correction reverses exact invoice tax; Original invoice remains unchanged. |
| `PART-005` | Supplier RMAs and defective parts | target | partial | `tests/mallet.test.mjs`; `tests/support/supplier-returns-journey.mjs`; `tests/supplier-returns-browser.mjs` | Not asserted in the old cited evidence: RMA authorization and shipment evidence are read back. Asserted: Removed installed part retains repair and original use; Removed stock enters quarantine; Partial credit is exact; Remaining supplier credit exposure is exact; Net warranty cost is exact; Stock remains separately traceable. |
| `PART-006` | ETA and special-order follow-through | target | done | `src/mallet/special-parts.ts`; `src/mallet/ui/special-parts.ts`; `src/mallet/promises.ts`; `src/mallet/workshop.ts`; `tests/support/special-part-journey.mjs`; `tests/special-part-browser.mjs` |  |
| `PART-007` | Low-stock replenishment | target | partial | `tests/mallet.test.mjs`; `tests/support/replenishment-journey.mjs`; `tests/replenishment-browser.mjs` | Not asserted in the old cited evidence: Actual supplier order is placed exactly once. Asserted: Outstanding PO is subtracted from the demand; Repeated preparation keeps the same draft; Draft has exact unmet quantity; Approval retains exact cart. |
| `PART-008` | Inter-store transfers | target | done | `tests/mallet.test.mjs`; `tests/support/transfers-journey.mjs`; `tests/transfers-browser.mjs` |  |
| `BUY-006` | Supplier and warranty compensation reconciliation | target | missing |  | No supplier invoice or warranty-labor matching, remittance or exception workflow. |
| `BUY-007` | MobileSentrix US parts | target | missing |  | No MobileSentrix connection or supplier cart/receipt handoff. |
| `BUY-008` | Injured Gadgets order sync | target | missing |  | No Injured Gadgets OrderSync importer, POs or receiving integration. |
| `INV-001` | USD invoices and customer delivery | target | partial | `tests/mallet.test.mjs`; `tests/support/invoice-documents-journey.mjs`; `tests/invoice-documents-browser.mjs`; `tests/sales-tax.test.mjs` | Email leg implemented; text delivery remains MSG-001, whose Twilio toll-free verification is in review. Financial corrections retain PAY-005 credit notes; issued-copy corrections preserve original financial amounts. Complete mixed sublet and pre-invoice deposit disclosure remain unproved. Standard-font PDF visible glyphs outside ASCII are substituted, with exact Unicode retained in ActualText and HTML and text copies. ct approved mallet-invoice-c30 on 23 Oct with the owner-only issue, private read and explicit audited email-consent default retained; one attempt per copy, no automatic retry, restored issue authority cannot send. INV-001 remains PARTIAL for the named remaining points. |
| `TAX-001` | US parts and labor sales tax | target | partial | `src/mallet/tax.ts`; `src/mallet/money.ts`; `src/mallet/setup.ts`; `migrations/core/0018_sales_tax.sql`; `tests/sales-tax.test.mjs` | Owner-entered combined rate, separate parts/labor taxability, USD, half-up cent rounding per line and frozen estimate/invoice tax ship. Dana’s 7.5% repair totals $531.70; migration preserves historical cents and prompts for an unknown rate. No multiple jurisdictions/effective dates, sublet/fee classes, tax-inclusive pricing, exemptions, refunds or tax-provider adapter. |
| `TAX-002` | Exemptions and shop fees | target | partial | `tests/sales-tax.test.mjs`; `tests/support/tax-custody-journey.mjs`; `tests/invoice-documents-browser.mjs`; `tests/mallet.test.mjs`; `tests/support/refunds-journey.mjs`; `tests/support/filing-tax-journey.mjs`; `tests/receivables-browser.mjs` | Explicit fleet exemption, configurable discount rules and capped supplies, disposal, environmental and owner-declared permitted surcharge rules are implemented. Cumulative collected-tax reporting now separates recorded cash and captured Stripe receipts from invoice tax, with proportional half-up allocation for partial receipts and exact completed-refund tax reversals. A dedicated inclusive-UTC filing-period preview now attributes cash deposit allocations to their invoice, separately discloses original receipt dates, records owner-observed check and other-tender bank clearance, allocates partial receipt tax with cumulative half-up cents and reverses completed original-tender refund tax. Filing preview exclusions retain their recorded UTC date and omit records after the selected period end; unresolved earlier records remain visible for review. Direct original-tender customer credits and failed-refund redirections now support explicit owner-reviewed original receipt mappings, separate source and destination tax credit adjustments, and completed manual-refund tax reversal. Unattributed or nested customer-credit sources remain excluded; PAY-007 returned-tender reversals remain unbuilt. ct approved the PARTIAL filing-treatment slice on 25 Oct 2026 at 19:03Z: current owner only with fresh confirmation, explicit original receipt evidence and owner-reviewed jurisdiction legal basis; source credit tax reverses on the review UTC date and destination tax is recognized on later application or review. The owner records the legal basis. Mallet gives no tax advice and files nothing. No new cash, automatic transfer, bank verification or legal filing claim is made. US sales-tax rules by state remain a named Gap. Approved observed-clearance and allocation-date semantics: current owner only with fresh confirmation, immutable private bank evidence, no provider verification, no automatic refund, transfer or filing. A deposit is attributed on allocation, or on later observed clearance, with original receipt date retained; this preview does not decide a jurisdiction’s legal deposit-tax rule. Fixed shop fees above the saved USD cap are refused, including previously saved rules; percentage fees use discounted pre-tax parts or labor with half-up cent rounding and a cap. Discounts apply to the remaining unit price after any existing unit discount, round half up to cents before quantity extension, then reduce the percentage fee and tax basis. ct approved the extended fee and discount policy on 24 Oct at 16:25Z: owner-only review of the legal basis, recorded customer consent, half-up rounding of each remaining unit price before quantity extension, tax and percentage fees (USD 0.005 rounds up), refusal of a fixed fee above the saved cap, frozen prior amounts, renewed approval and customer authorization, and no outbound action. A declared permitted surcharge records the owner’s legal basis; Mallet never verifies legal permission. The report labels unassigned jurisdictions, retains invoice-basis totals separately, and discloses unresolved collection attribution; it is not a completed tax return or legal filing advice. ct approved mallet-tax-c30 on 23 Oct; its owner-only private custody and immutable jurisdiction declarations remain. ct approved the c31 exemption and capped supplies application on 24 Oct at 14:50Z: owner-only explicit review, a current scoped certificate for the unchanged billing account, recorded customer consent, renewed approval and customer authorization; raw certificates remain private and prior amounts remain frozen, with no automatic repricing or outbound action. TAX-002 remains PARTIAL for the remaining named gaps. |
| `PAY-001` | Stripe card and ACH collection | target | partial | `./tests/mallet.test.mjs`; `./tests/support/stripe-journey.mjs`; `./tests/support/terminal-journey.mjs`; `./tests/support/stripe-returns-journey.mjs`; `./tests/stripe-browser.mjs`; `./tests/stripe-sandbox.mjs`; `./tests/stripe-ach-sandbox.mjs`; `./tests/stripe-terminal-sandbox.mjs` | Native current-owner connection, exact-invoice hosted checkout, smart-reader initiation and cancellation, owner-triggered authenticated event reconciliation, pending ACH, append-only observed ACH returns, fees and automatic payout membership are implemented. Each outbound collection is explicit, freshly confirmed with an enrolled factor and durably claimed once; uncertain handoff stays stopped for read only reconciliation. No automatic outbound charge or message is introduced. This door supports a US merchant settling USD; production test credentials are refused. Sandbox card and wallet collection, card-present capture and their fees remain unproved. The held US test merchant reports charges disabled and refuses native hosted card and ACH requests with HTTP 400 on payment_method_types; native reader payment-intent creation also returns HTTP 400. An eligible test merchant enabled for these methods is required. Real ACH collection and return receipts remain a named Gap. Actual automatic payout membership is unproved: the held US account reports payouts disabled, and no isolated automatic-payout simulator is available; an eligible owner-configured US test merchant and its scheduled payout are required. Provider event reconciliation is an explicit owner read, not webhook delivery or bank receipt. GOV-001 inherits delegated payment authority, MONEY-001 inherits general disputes and payout close, and BILL-001 inherits recurring agreement authority; none may reuse invoice checkout as authority for an automatic charge. PAY-001 remains PARTIAL. |
| `PAY-002` | Square counter and online payments | target | missing |  | No Square account, terminal, payment-link or webhook adapter. |
| `PAY-003` | Text-to-pay and mobile wallets | target | missing |  | No text-to-pay page, wallet checkout, scoped payment links or receipt tracking. |
| `PAY-004` | Deposits and split tenders | target | partial | `tests/mallet.test.mjs`; `tests/support/deposits-journey.mjs`; `tests/inventory-browser.mjs` | ACH and connected pre-order card deposits require PAY-001 provider work and an authorized merchant Stripe test account. The ct deposit authority and custody ruling is adopted and proved; the provider work keeps PAY-004 PARTIAL. |
| `PAY-005` | Refunds exchanges and customer credits | target | partial | `tests/mallet.test.mjs`; `tests/support/refunds-journey.mjs`; `tests/customers-browser.mjs`; `docs/refunds.md` | Refund authority, consent and recovery policy approved with change by ct (22 Oct 2026, be4ec20); the failed-refund redirection change is now built and asserted. GOV-004 refund step-up is built (every credit and refund command needs a confirmation from the last five minutes). Native refund-authoring forms and signed provider-webhook intake are not built; Stripe outcomes use explicit owner reconciliation. An uncertain refund that reconciliation never matches has no in-product resolution and stays reserved. PAY-005 remains PARTIAL. |
| `PAY-008` | Uncertain refund recovery | target | partial | `tests/mallet.test.mjs`; `tests/support/refunds-journey.mjs`; `tests/customers-browser.mjs`; `docs/refunds.md` | Failed-refund same-account redirection and read-only reconciliation are asserted. Complete native recovery authoring, provider-outcome resolution and payer-privacy branches remain unbuilt or unproved. |
| `PAY-006` | Consumer financing | target | missing |  | No financing partners, hosted application handoff, onboarding agreements or funding/refund mapping. |
| `PAY-007` | Paper checks and shop-defined tenders | target | partial | `tests/sales-tax.test.mjs`; `tests/support/filing-tax-journey.mjs`; `tests/mallet.test.mjs`; `tests/receivables-browser.mjs` | Existing recorded check and other-tender payments and deposits now have an immutable owner-observed clearing-evidence journal, privately retained and restored. Structured check number, payer, bank and date capture, named manual-tender configuration, returned-check reversal and fees, drawer and daily-close reconciliation, deposit batches and printable slips, and QBO or Xero posting remain unbuilt. BOOKS-001 requires an authorized QBO sandbox for the named acceptance receipt. |
| `POS-001` | Retail counter and cash drawer | target | missing |  | No retail checkout, cash drawer, cashier tender or closeout workflow. |
| `AR-001` | Terms statements and payment follow-up | target | partial | `tests/mallet.test.mjs`; `tests/support/receivables-journey.mjs`; `tests/receivables-browser.mjs` | Native owner-reviewed terms, credit limits, account statements, current-balance ageing, promised payments and dispute eligibility ship over the existing recorded-payment and same-payer deposit ledger. Explicit one-attempt balance reminders now use the current billing email preference, current outstanding amount, fresh owner confirmation and per-send recorded consent. No automatic chase or retry is introduced. AR-002 retains the separate scheduled-email slice as PARTIAL; complete sequences remain unbuilt. ct approved the PARTIAL reminder slice on 25 Oct 2026 at 19:03Z: manual reminders may request payment before or after the exact due date without claiming overdue status; disputed, paid and unexpired promised balances are suppressed, and mail acceptance is labelled handed to the provider, never delivered. The explicit current-owner open-terms handover gate now retains the exact invoice assignment, current active account approval and due date without recording payment. Approved native authority: current owner only, existing fresh-confirmation gate, explicit audited account instructions and terms consent, private native reads, no automatic outbound message or transfer. Source-owner terms cannot authorize new destination assignments after restore; the new owner must review terms again. Historical actor snapshots remain evidence only. GOV-001 inherits delegated finance authority; GOV-004 inherits finer-role confirmation. |
| `AR-002` | Scheduled and automated balance-reminder sequences | target | partial | `tests/mallet.test.mjs` — "AR-001 and FLEET-001: owner-reviewed terms, credit limits, fleet authorizer, check allocation, disputes, promises and private recovered statements" (`tests/support/receivables-journey.mjs`, scheduledBalances and receivablesJourney) proves scheduled unpaid and partial balances, exact email amounts, disputed and promised suppression, no duplicate after concurrent cron and restart, and inert restored schedules. "AR-001, FLEET-001 and TAX-002: native terms, fleet PO, disputed statement, promise and observed-clearance preview at 1440 and 390" (`tests/receivables-browser.mjs`, receivablesBrowser) proves native scheduling, exact-message review and stopping at both widths. The same API journey, balanceRecoveryJourney, proves controlled failed and interrupted handoffs, current-owner-only review, fresh confirmation, exact schedule and retained invoice and approval references, stale-reference and replay refusals, one receipt under concurrent closure, unchanged original outcomes and balances, zero further handoffs after restart, and exact fresh-owner recovery without restored sending authority. The same native journey, balanceRecoveryBrowser, proves on-demand review, append-only human resolution and recovered-owner review, with browser proof at 1440 and 390. The existing API journey also proves versioned review-policy replacement without changing enrolled plans, exact invoice-scoped due review steps, future-step and replay refusal, attributable purpose-specific one-email permission, automatic durable owner failure tasks, complete retained provider references, customer-erasure suppression and a restored plan's inability to authorize a destination send after fresh terms review. The native journey also saves policy revisions under Settings, plans and stops internal review sequences and selects an exact review step before separate email approval. | RL-101's bounded one-email path now retains purpose-specific customer permission wording and version, customer time, capture channel, source reference, recipient and contact revision, captured actor and time, and separate exact owner approval. Versioned policies plan internal owner reviews; each step requires fresh permission and a separate current-balance email approval. Failed or uncertain handoffs create durable current-owner review tasks and append-only human resolutions without changing their outcome, balance, retry eligibility or sending authority. Full configured unattended repeated chasing remains unbuilt and awaits policy approval under mallet-balance-i881; RL-101 approves only the bounded current-balance email. Delegated advisor task and finance access remains GOV-001 work. The complete automated-sequence acceptance journey remains unproved. Current payment, credit, dispute, promise, preference, contact, terms and opt-out suppression, allowed hours, 31-day expiry, durable no-retry claims and inert restored authority remain. Customer erasure suppresses plans and pending email and removes local sending authority; stale archives cannot replay over a supplied later erasure journal. Existing account, retention and multi-shop holds are unchanged. AR-002 remains PARTIAL. |
| `BILL-001` | Recurring service agreements | target | missing |  | No recurring agreements, scheduled invoices, entitlements or renewal/cancellation workflow. |
| `BOOKS-001` | QuickBooks Online two-way sync | target | missing |  | No QuickBooks Online OAuth, mapping, invoice/payment sync or reconciliation. |
| `BOOKS-002` | Xero two-way sync | target | missing |  | No Xero connection or two-way accounting workflow. |
| `BOOKS-003` | Cost and cash postings to the books | target | missing |  | No accounting connection or posting of supplier bills, vendor credits, sublet cost, processor fees, payouts, drawer movements or inventory journals. |
| `MONEY-001` | Payment disputes and settlement close | target | missing |  | No disputes, evidence deadlines, payout close or processor-fee accounting. |
| `SUBLET-001` | Sublet work and outsourced services | target | done | `tests/mallet.test.mjs`; `tests/sublet-browser.mjs`; `tests/support/sublet-journey.mjs` |  |
| `MSG-001` | Two-way repair SMS with Twilio | target | missing |  | No repair SMS/MMS adapter, inbox, A2P onboarding or consent/opt-out workflow. |
| `MSG-002` | Gmail repair conversations | target | missing |  | No Gmail OAuth, ticket threading or repair mail delivery. |
| `MSG-003` | Microsoft 365 Outlook conversations | target | missing |  | No Microsoft Graph mailbox connection, reply sync or shared mailbox controls. |
| `PORTAL-001` | Customer repair portal | target | partial | `tests/mallet.test.mjs`; `tests/customers-browser.mjs`; `tests/support/portal-journey.mjs` | Customer account sign-in and payer-only approved invoice, balance, statement and payment history ship as the CUS-001 prerequisite. Repair status/promise, inspections, estimates/decisions, warranty, questions, follow-up booking, complete two-visit history and customer payment initiation remain unbuilt. SMS sign-in links (MSG-001) and portal payment initiation are not built. Both clauses stay PARTIAL per ct batch-11 D. The per-address and per-client request limits are disclosed implementation values, not contract policy. Session membership revocation and exact 24-hour server expiry gaps from ct 22 Oct 2026 are now asserted; status remains PARTIAL. |
| `AUTO-001` | Appointment confirmation and reminders | target | partial | `tests/mallet.test.mjs`; `tests/support/outreach-journey.mjs`; `tests/outreach-browser.mjs` | Email reminder slice only. Recurring reminder configuration, channel selection, SMS under MSG-001, customer self-service reminder opt-out and the complete reminder acceptance journey remain unbuilt or unproved. Immediate booking confirmations retain BOOK-001 behavior. Broader advisor and staff scheduling rights remain a named Gap under GOV-001. The conservative email default is ct APPROVE WITH RIDERS on 26 October 2026 under mallet-outreach-i817; complete consent provenance, execution-time eligibility, suppression, failure resolution, audit, erasure and inert-restore evidence for these riders remains unverified by this policy review. AUTO-001 remains PARTIAL. |
| `AUTO-002` | Status and pickup notifications | target | partial | `tests/mallet.test.mjs`; `tests/support/status-notices-journey.mjs`; `tests/status-notices-browser.mjs` | Native email flow is implemented under mallet-status-i925, a conservative owner-only consent and approval default pending ct policy approval. Customer-chosen SMS requires MSG-001 and real provider delivery acknowledgments remain unproved; provider acceptance is only handoff. Self-service withdrawal and complete delegated communication rights remain MSG-004 and GOV-001. No automatic disposal, fee or legal-property action is implemented. AUTO-002 remains PARTIAL; no acceptance point is removed. |
| `AUTO-003` | Time and mileage service reminders | target | missing |  | No maintenance plans, service-due calculation or reminder automation. |
| `AUTO-004` | Declined-work follow-up | target | partial | `tests/mallet.test.mjs` — “AUTO-004: approved refreshed quote, observed mileage, explicit stop and repeat decline preserve decisions” runs declinedOutreachJourney, declinedEligibilityJourney, declinedErasureJourney, declinedCustomerJourney, declinedClockJourney and declinedBookingJourney (`tests/support/outreach-journey.mjs` and `tests/support/declined-outreach-journey.mjs`). These native command, customer booking, private withdrawal, cron, audit, export and restore doors prove separate item-specific consent provenance and replay identity; exact recipient, quote and attributable stock and capacity source binding; wrong-purpose and unauthorized refusal; changed sources, expiry, recipient hours, delayed execution and repeated DST suppression; current staff authority; failed and uncertain handoff resolution without retry; repeat decisions, new bookings, exact declined-item invitation booking, inapplicability and customer withdrawal stops; original decision preservation, held erasure and stale archive fences; exact historical recovery without destination sending, invitation or withdrawal capabilities. “AUTO-001 and AUTO-004: owner schedules and stops email through native forms at 1440 and 390” (`tests/outreach-browser.mjs`) proves native permission and availability review, exact message history, source invalidation, human resolution, exact linked customer booking, self-service withdrawal and inert fresh-owner recovery, with both release-width screens. | One explicitly approved current-owner email per declined item only. Broader advisor and staff scheduling rights remain a named Gap under GOV-001 and the ct APPROVE WITH RIDERS ruling of 26 October 2026, mallet-outreach-i817; this run does not release that sending-authority fence. Configured recurring cadence, complete availability beyond evidenced native stock and booked repair sources, and complete target workflow qualification remain unbuilt or unproved. An invitation now binds a customer-confirmed native appointment to the exact declined item; booking stops further approval for that item, and destination-local invitation and management capabilities are not restored. Customer-scope erasure revokes these new capabilities even after a recipient correction. Existing native vehicle bookings, new recipient appointments, current quote changes, repeat customer decisions, finding inapplicability and private customer withdrawal suppress saved follow-up. Complete rider coverage at future manual, scheduled and agent doors remains MSG-004 work. Provider acceptance is handoff, never delivery; supplier and account, retention and sending-authority holds remain unchanged. AUTO-004 remains PARTIAL; no acceptance point is removed. |
| `AUTO-005` | Review and satisfaction requests | target | partial | `tests/mallet.test.mjs`; `tests/support/reviews-journey.mjs`; `tests/reviews-browser.mjs` | Conservative default ADOPTED: fresh-confirmed owner-only, separate affirmative review permission, one immediate email per paid documented handover, no resend, identical public invitation for every rating, owner-only private response and task, seven-day local capability, inert restored send authority and existing erasure and authorization custody. No Google API integration or delivery-confirmation claim; owner supplies the Google review link and Base mail acceptance is provider handoff. Broader staff authority remains under GOV-001; future review-send doors under MSG-004 inherit withdrawal suppression. |
| `AUTO-006` | Warranty and contract renewal follow-up | target | partial | `tests/mallet.test.mjs`; `tests/support/coverage-follow-up-journey.mjs`; `tests/warranty-browser.mjs`; `tests/coverage-follow-up-browser.mjs` | Owner-managed internal review register only. Retained shop warranty terms and owner-evidenced service-contract dates are assertions, never independently verified coverage. Adopted conservative default: current owner only, attributable customer permission for internal review, no repair, billing, sending or renewal authority; cancellation and recorded ownership changes stop affected reviews, and restored scheduling needs fresh owner activation. ct approval of this default and scoped delegation remain pending. Outbound renewal messages, customer reply-channel integration, complete consented automated follow-through and renewal execution remain unbuilt or unproved. BILL-001 recurring merchant charging still requires unavailable cloud Stripe credentials; existing payment and books holds and GOV-006 retention and eligibility approval remain unchanged. AUTO-006 remains PARTIAL. |
| `MSG-004` | Communication controls and searchable history | target | missing |  | No repair communication templates, transcript export, language preferences or shared send-policy enforcement. |
| `REPORT-001` | ARO and car-count reporting | target | partial | `tests/sales-report.test.mjs`; `tests/mallet.test.mjs`; `tests/support/return-journey.mjs` | Multiple-location filters and comparisons remain unbuilt under SHOP-001. Whole-invoice voids are represented by full issued credit notes, not deletion of immutable invoices. Settled-cash reporting belongs to REPORT-005. |
| `REPORT-007` | Repair sales cohorts and funnel | target | partial | `tests/sales-report.test.mjs`; `tests/mallet.test.mjs`; `tests/support/return-journey.mjs` | Native sales cohorts, conversion arithmetic and source drill-through are asserted. Multi-location cohorts and complete migrated/external-history coverage remain unproved under SHOP-001 and MOVE-011. |
| `REPORT-002` | Repair and parts profitability | target | partial | `tests/sales-report.test.mjs`; `tests/support/profitability-journey.mjs`; `tests/profitability-browser.mjs` | Location comparison remains unbuilt under SHOP-001, explicitly excluded by this campaign plan. Historical service-package attribution without a retained native source link remains unavailable; no link is invented. Purchase-linked freight and supplier tax now allocate only from reconciled current bills; standalone unrecorded charges remain unavailable. Delegated advisor and manager margin access remains unfinished under GOV-001 and REPORT-002 must assert its application when available. Ct APPROVE WITH RIDERS, 26 October 2026, is retained verbatim with the target. REPORT-002 remains PARTIAL; no acceptance point is removed. |
| `REPORT-003` | Technician efficiency and productivity | target | done | `src/mallet/reports/technicians.ts`; `src/mallet/pay-rates.ts`; `src/mallet/ui/reports.ts`; `src/mallet/http.ts`; `tests/support/report-journey.mjs`; `tests/report-browser.mjs` |  |
| `REPORT-004` | Turnaround and customer promises | target | partial | `tests/mallet.test.mjs`; `tests/support/flow-journey.mjs`; `tests/support/booking-journey.mjs`; `tests/support/inspection-report-journey.mjs`; `tests/support/warranty-journey.mjs`; `tests/report-browser.mjs` | Native stage waits, promises, observed booking no-shows, DVI completion, page-request engagement, warranty comeback rates and report drill-through now ship. Older stage history remains explicitly incomplete; location comparison is still SHOP-001. ct 25 Oct 20:55Z: REPORT-004 approved PARTIAL as adopted (current-owner-only immutable observation after appointment start, unknown excluded, no inferred no-show or charge). Rider: a correction is a new observation with reason, never an edit. Existing private staff read scope and no automatic message remain. The existing booking API and native report journeys prove reasoned append-only corrections, immutable original observations and recomputed no-show metrics. REPORT-004 remains PARTIAL for location comparison. |
| `REPORT-005` | Daily financial and inventory close | target | missing |  | No financial/inventory reports, tender reconciliation or period snapshots. |
| `REPORT-006` | Scheduled reports and portable data | target | partial | `tests/mallet.test.mjs`; `tests/support/report-journey.mjs`; `tests/support/report-xlsx.mjs`; `tests/support/flow-journey.mjs`; `tests/report-browser.mjs` | Native personally saved filters, JSON, formula-safe CSV and XLSX exports and explicit owner-to-self scheduled CSV Base mail handoffs now ship. ct 25 Oct 20:55Z: REPORT-006 approved PARTIAL as adopted (fresh-confirmed owner-to-self recurring mail, role, version and email rechecked per send, one claim, no retry, uncertain handoff disables). Rider: the owner sees last-sent time, outcome and an off switch on the same screen. Personal filters confer no authority and restored schedules confer none. The existing report API and native journeys prove actual attempt time, outcome and a working off switch on the same screen. Location-manager scheduling remains GOV-001 and SHOP-001; reconciled imported-history provenance and completeness remain MOVE-009 through MOVE-013 and require authorized source evidence. No delivery or migrated-history completeness claim is made. REPORT-006 remains PARTIAL. |
| `SHOP-001` | Multiple shops and location controls | target | missing |  | One workshop installation model; no locations, shared-customer controls, consolidated metrics or per-location provider routing. |
| `HARDWARE-001` | Labels receipts and scanners | target | missing |  | No printer/scanner adapters, job queue, hardware setup or receipt/label formats. |
| `CAL-001` | Google Calendar scheduling | target | missing |  | No Google Calendar OAuth or event synchronization. |
| `CAL-002` | Microsoft 365 Calendar scheduling | target | missing |  | No Microsoft 365 calendar adapter, mapping or conflict reconciliation. |
| `OEM-001` | Apple GSX authorized repairs | target | missing |  | No GSX integration, provider approval, warranty mappings or authorized repair submissions. |
| `OEM-002` | Samsung GSPN authorized repairs | target | missing |  | No GSPN connection, access agreements or warranty/parts/claim workflow. |
| `SHIP-001` | ShipStation mail-in and return logistics | target | missing |  | No ShipStation adapter, shipping labels, tracking or mail-in custody. |
| `STORE-001` | Shopify storefront connection | target | missing |  | No Shopify store, order, availability or return adapter. |
| `STORE-002` | WooCommerce storefront connection | target | missing |  | No WooCommerce adapter or storefront/repair reconciliation. |
| `API-001` | Documented shop API | target | partial | `src/mallet/api/resources.ts`; `src/mallet/api/commands.ts`; `src/mallet/api/clients.ts`; `tests/support/shop-api-journey.mjs`; `tests/mallet.test.mjs`; `docs/shop-api.md` | API-001 remains PARTIAL. The current slice provides versioned resource projections and idempotent retries for four preparation commands. Complete target-resource and write parity, inspection, work and finance APIs, explicit financial-read and decision capabilities, usable stock balances and location quantities, receiving, allocation and fulfilment writes, delegated client management and bounded renewal remain unbuilt or unproved. The complete scoped-client intake-to-receipt acceptance journey and sentence-level assertions, mutations and exact-SHA Verify evidence remain unestablished. The conservative authority default is approved with ct’s 27 October 2026 riders; this approval completes no acceptance sentence. API-provider eligibility, authorized account access, permitted data use and real provider acceptance wherever required remain named external boundaries and required delivery work, never scope exclusions. |
| `API-002` | Webhooks and visible integration recovery | target | partial | `tests/mallet.test.mjs`; `tests/support/webhook-journey.mjs`; `tests/support/real-crank.mjs`; `docs/webhooks.md` | Identifier-event API slice only. Native staff integration settings and recovery screens and delegated operator rights remain unbuilt or unproved. The conservative owner-only endpoint approval, event disclosure and recovery policy awaits ct review. Complete per-sentence mutation and exact-SHA hosted proof remain pending; API-002 stays PARTIAL. |
| `MOBILE-001` | Responsive staff and customer work | target | partial | `src/mallet/ui/common.ts`; `tests/browser-journey.mjs` | Existing core is exercised at both widths; target roles, media, approval/payment and accessibility journeys do not exist. |
| `MOBILE-002` | Native iOS and Android workshop apps | target | missing |  | No native apps, mobile distribution, push or offline capture/sync. |
| `MOVE-001` | Tekmetric move-in | target | missing |  | Only RepairShopr register snapshots supported; no Tekmetric CSV/API/history/media importer or reconciled capture. |
| `MOVE-002` | Shopmonkey move-in | target | missing |  | No Shopmonkey XLS/XLSX/API importer or inspection/history capture. |
| `MOVE-003` | Mitchell 1 Manager SE move-in | target | missing |  | No Manager SE database extractor, Followup.csv/PDF importer or schema/media mapping. |
| `MOVE-004` | Shop-Ware move-in | target | missing |  | No Shop-Ware importer; complete vendor offboarding format/media access must be provisioned and validated. |
| `MOVE-005` | AutoLeap move-in | target | missing |  | No AutoLeap importer; outbound archive schema and media delivery need provider discovery/provisioning, not a scope reduction. |
| `MOVE-006` | RepairDesk move-in | target | missing |  | No RepairDesk CSV/XLS importer, media mapping or historic stock/financial reconciliation. |
| `MOVE-007` | Orderry move-in | target | missing |  | No Orderry spreadsheet/API/history importer or support-assisted capture workflow. |
| `MOVE-008` | Fixably move-in | target | missing |  | No Fixably importer; actual export schema/API entitlement and media coverage need provider provisioning. |
| `MOVE-009` | RepairShopr full repair history | target | partial | `src/mallet/imports/snapshots.ts`; `src/mallet/imports/service.ts`; `tests/mallet.test.mjs` | Customers/assets snapshot preview/apply/original custody ship; no repair, stock, finance, attachment or transcript history import. |
| `MOVE-010` | Reviewed safe migration and resumability | target | partial | `src/mallet/imports/service.ts`; `src/mallet/imports/context.ts`; `tests/mallet.test.mjs` | RepairShopr register fingerprint/journal/resume/undo exist with small bounds; no full-category schemas, mappings, volume or media coverage. |
| `MOVE-011` | Historical reports and opening balances | target | missing |  | No historical repair/finance importer, opening ledgers or report reconciliation. |
| `MOVE-012` | Open work and controlled cutover | target | missing |  | No shadow cutover, final-delta importer, open-repair adoption or external action fencing. |
| `MOVE-013` | Shop setup and inventory move-in | target | missing |  | No setup or inventory importer; canned jobs, pricing matrices, labor rates, fees, inspection templates, vendors and stock do not yet exist as Mallet records. |
| `TIRE-001` | Tire fitment pricing and sourcing | target | missing |  | No tire fitment/catalogs, TireHub/NAPA ProLink adapters or tire package/order workflow. |
| `TIRE-002` | DOT tire registration and traceability | target | missing |  | No tire TIN ledger, registration partner onboarding or submission/recall traceability. |
| `GOV-001` | Job-specific staff rights | target | partial | `tests/mallet.test.mjs`; `tests/support/governance-journey.mjs`; `tests/governance-browser.mjs` | Advisor, manager, purchaser, cashier and accountant roles with complete limits and location and cost rights remain a named Gap. Native purchaser forms now cover PO preparation and approval, partial barcode receiving, visible physical stock and reservations, bill exception and matching history, and closure within the existing spend and separate cost rights. Linked bins and PO records from other named locations are refused and excluded from permitted downloads. Native grants still cover this installation’s shop and an explicit subset of commands; full intake and communication delegation, accountant reconciliation, delegated destructive rights and multi-shop operation under SHOP-001 remain unbuilt or unproved. ct approved the PARTIAL local-grant slice on 25 Oct 2026 at 18:25Z: only the current owner with fresh confirmation grants or revokes local version-bound rights; zero default limits (a grant with no limit allows no delegated door or command), separate cost right, deny unlisted doors and other locations, no delegated outbound provider submission, and no restored grants. Refunds remain native recorded outcomes with fresh confirmation and bounded authority; connected submissions and redirection stay owner-only. No acceptance point is removed. |
| `GOV-002` | Approvals audit and accountable changes | target | partial | `tests/mallet.test.mjs`; `tests/support/governance-journey.mjs`; `tests/governance-browser.mjs`; `tests/media.test.mjs`; `tests/support/provider-jobs-journey.mjs`; `tests/retention-browser.mjs` | Complete historical backfill remains unbuilt or unproved, including initial empty-installation login history; other specialist direct-write revision coverage remains unbuilt or unproved. Owner-configured minimum audit retention is a label only, with no timer or deletion and preserved owner export; the ct 25 October private-custody and no-deletion ruling is retained. Ordinary email-link login, exact media finding and upload transition revisions and durable provider-job state references are now asserted. Delegated auditor access stays with GOV-001. GOV-002 remains PARTIAL; no acceptance point is removed. |
| `GOV-003` | Enterprise sign-on and provisioning | target | partial | `tests/mallet.test.mjs`; `tests/support/enterprise-journey.mjs`; `tests/support/saml-journey.mjs`; `tests/enterprise-browser.mjs`; `tests/enterprise-saml-browser.mjs`; `docs/enterprise-identity.md` | Provider proofs use controlled network edges as permitted by this contract; production eligibility and provider-operated outbound SCIM delivery are not claimed. Additional delegated roles inherit GOV-001 and additional locations inherit SHOP-001. |
| `GOV-004` | Strong staff authentication | target | partial | `tests/mallet.test.mjs`; `tests/support/strong-auth-journey.mjs`; `tests/support/link-protection-journey.mjs`; `tests/security-browser.mjs`; `src/mallet/ui/security.ts`; `docs/security.md` | Native factors, recovery and refund step-up are asserted. Provider-session factor proof and complete delegated privileged-action coverage remain unproved under GOV-003 and GOV-001; physical-authenticator proof is in R-12. |
| `GOV-007` | Customer link protection | target | partial | `tests/mallet.test.mjs`; `tests/support/strong-auth-journey.mjs`; `tests/support/link-protection-journey.mjs`; `tests/security-browser.mjs`; `src/mallet/ui/security.ts`; `docs/security.md` | Existing scoped links and guessing fences are asserted. Appointment-management authority still needs a separate seven-day-or-use fence from read-only status access, and payment-link authority remains unbuilt or unproved. |
| `GOV-005` | Provider credential custody | target | partial | `tests/mallet.test.mjs`; `tests/support/connector-journey.mjs`; `tests/support/inspection-report-journey.mjs`; `tests/media.test.mjs`; `tests/security-browser.mjs`; `src/mallet/strong-auth/secret-box.ts`; `src/mallet/auth.ts`; `src/mallet/pier.ts`; `src/mallet/archive-policy.mjs`; `docs/connectors.md` | Sealed credentials and native rotation/revocation are asserted. Published and confirmed data-flow and licensing declarations for every enabled connector, deployment mail-sending-key rotation and the remaining provider webhook doors remain unbuilt or unproved. |
| `GOV-008` | Private attachment access | target | partial | `tests/mallet.test.mjs`; `tests/support/connector-journey.mjs`; `tests/support/inspection-report-journey.mjs`; `tests/media.test.mjs`; `tests/security-browser.mjs`; `src/mallet/strong-auth/secret-box.ts`; `src/mallet/auth.ts`; `src/mallet/pier.ts`; `src/mallet/archive-policy.mjs`; `docs/connectors.md` | Private originals and reviewed customer variants are asserted. The complete byte-URL expiry, parent revocation, review-set change and replay/read-authority proof matrix remains unestablished. |
| `GOV-006` | Retention erasure and legal holds | target | partial | `tests/mallet.test.mjs`; `tests/support/retention-journey.mjs`; `tests/retention-browser.mjs` | Manual holds and eligible media erasure are asserted. Eligibility for retained financial, authorization, custody, identity and shared-account facts must be proved against the continuing-purpose rule in RL-106; statutory schedules and per-artifact cross-customer hold mapping remain unproved. |
| `OPS-001` | Owner-run deployment and complete portability | target | done | `docs/operations.md`; `src/mallet/archive-policy.mjs`; `src/mallet/http.ts`; `tests/clone-journey.mjs`; `tests/browser-journey.mjs`; `tests/mallet.test.mjs`; `tests/support/portable-repair.mjs`; `tests/media.test.mjs` |  |
| `OPS-002` | Fast counter work at declared capacity | target | partial | `tests/mallet.test.mjs`; `tests/support/capacity-import-journey.mjs`; `tests/support/search-journey.mjs`; `tests/search-browser.mjs`; `tests/support/repair-read-journey.mjs`; `tests/support/jobs-journey.mjs`; `tests/support/provider-jobs-journey.mjs`; `tests/jobs-browser.mjs`; `tests/support/board-live-journey.mjs`; `docs/background-jobs.md`; `docs/performance.md`; `scripts/capacity/README.md` | No declared-capacity proof: ten-shop identity/isolation is not built; complete volume/history/media, 30/300 active staff sessions and 50 customer links have not been loaded and measured. Every stated p95 and five-minute due/restart deadline remains unproved at that capacity. Native board/repair/account-editing reads still need bounded projections while preserving complete historical counts/selectors. Base native archive finalization re-verifies all parts and erasure sidecars in one invocation, without a resumable finalization/validation cursor; the register-only import exceeded its 15-minute bound before producing timings. HTTP portability also needs Worker-safe older-schema migration replay; released rer 0.2.79 does not close either Base dependency. The small import/restart/browser journeys and request timing instrumentation are functional proof only; OPS-002 stays PARTIAL. |
| `OPS-003` | Background job authority and recovery | target | partial | `tests/mallet.test.mjs`; `tests/support/capacity-import-journey.mjs`; `tests/support/search-journey.mjs`; `tests/search-browser.mjs`; `tests/support/repair-read-journey.mjs`; `tests/support/jobs-journey.mjs`; `tests/support/provider-jobs-journey.mjs`; `tests/jobs-browser.mjs`; `tests/support/board-live-journey.mjs`; `docs/background-jobs.md`; `docs/performance.md`; `scripts/capacity/README.md` | Small reminder and provider-read jobs prove restart and explicit recovery. Complete queued-authority lifecycle and every failed/uncertain resolution branch remain open for point-level completion proof. |
| `OPEN-001` | Free and open source under the MIT license, run by one command | target | done | `LICENSE`; `rer-project.json`; `tests/clone-journey.mjs`; `tests/open-source-journey.mjs`; `tests/browser-journey.mjs` |  |
| `SURFACE-001` | Service-advisor registry | target | missing |  | No remote MCP registry, class classifier and company-policy conformance journey asserts these seed outcomes. |
| `SURFACE-002` | Repair classes and provider steps | target | missing |  | No remote MCP registry, class classifier and company-policy conformance journey asserts these seed outcomes. |
| `SURFACE-003` | Irreversible, regulated and live repair facts | target | missing |  | No remote MCP registry, class classifier and company-policy conformance journey asserts these seed outcomes. |
| `SURFACE-004` | Repair resources and handoffs | target | missing |  | No remote MCP registry, class classifier and company-policy conformance journey asserts these seed outcomes. |
| `SURFACE-005` | A seeded repair week through MCP | target | missing |  | No remote MCP registry, class classifier and company-policy conformance journey asserts these seed outcomes. |
| `BASE-AGENT-001` | One MCP door per seed | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | CORE adopted at one production door. Multi-sponsor and dual-host lifecycles remain unproved; no broader transport completion is claimed. |
| `BASE-AGENT-002` | The seed's jobs are tools, through the UI's own actions | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Six native preparation/read tools only. The ct service-advisor surface, separately scoped assistant and native API client adoption remain incomplete. |
| `BASE-AGENT-003` | Records are resources | target | partial | `agent-surface.json`; `tests/agent-door/resources.mjs` — afterStep native outcome comparisons under autonomous and held-standard-review conformance, resources missing and revoked-key refusals (built-app conformance 661 of 661 passing); `tests/agent-door/resource-authority.mjs` — resourceAuthorityJourney, registered in `tests/mallet.test.mjs`: populated owner and member reads, identical missing and restricted refusals, scope and consent revocation, suspended sponsor, erasure replay, private-note and original-byte exclusion, exact proposal readback and attributable native browser readback at 1440 and 390. | Customers, inspections, parts, orders and audit resource families, complete two-role UI parity, file-byte budget qualification and resource refresh remain unproved. Expanded native authority still awaits ct approval; expanded grants, customer sending and promise-changing authority remain held. |
| `BASE-AGENT-004` | Business identity and short-lived, audience-bound tokens | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Signed owner binding and current native admission are proved in the disposable production build. Multi-sponsor lifecycle and production Business delivery remain unproved. Native authConfig declares no allow-list, so no excluded-allow-list proof is claimed. |
| `BASE-AGENT-005` | An agent acts as a person in a role, never more | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Native preparation authority stays narrow; no access/security mutation is registered. Owner-native administration and the broader ct authority/escalation surfaces remain unadopted. |
| `BASE-AGENT-006` | Every action declares its risk class | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Only native standard preparation effects are adopted. The other ten classes in the ct surface remain unadopted; no spend, provider or target-only capability is claimed. |
| `BASE-AGENT-007` | The company's policy decides, at one chokepoint | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | The declared CORE policy pipeline is proved; production Business delivery, standalone policy issuance outside the seed and the broader ct repair-week effects remain unproved. |
| `BASE-AGENT-008` | Truthful attribution | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Native preparation retains agent and sponsor attribution. Complete specialist-week, outbound and queued attribution remain unproved; no unsupported Undo is invented. |
| `BASE-AGENT-009` | Every agent action is audited with its class and decision | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Declared calls and typed family refusals are audited. Full specialist native-activity coverage outside this registry remains unproved. |
| `BASE-AGENT-010` | Agents can follow changes | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Undeclared families: events and subscriptions. Typed refusals are proved; event replay, live notifications and subscribed handoffs are not offered. |
| `BASE-AGENT-011` | Limits are policy, and Pause stops everything | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | CORE Pause is adopted. Spend reservations, company-wide byte/spend budgets and timed lifecycle remain unproved; no provider cost is registered. |
| `BASE-AGENT-012` | Writes are idempotent and conflict-safe | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Native preparation replay and current-authority replay admission are proved. Queued lifecycle and uncertain-provider recovery remain outside this registry and unproved. |
| `BASE-AGENT-013` | Manifest, docs and the conformance journey | target | partial | `agent-surface.json`; `tests/agent-door/owner.mjs`; `tests/agent-door/reviewer.mjs`; `tests/agent-door/fixtures.mjs` — SEED_VERIFY_SHARD=runtime npx -y @runeditrun/rer@0.2.91 verify: "Agent door conformance: 587/587 points passed", normal exit 0 (29 October 2026). | Undeclared family: prompts. The wider ct registry, public resources, full repair-week journeys and owner-native administration remain incomplete. No clause is promoted to done. |
| `ADV-001` | Inspection evidence to priced estimate | push-further | partial | `src/mallet/estimates.ts`; `src/mallet/model.ts`; `tests/mallet.test.mjs` | Scoped agents can prepare estimate revisions; no evidence interpretation, guide/supplier data, compatible stock pricing or integrated review packet. |
| `ADV-002` | Policy-directed customer conversations | push-further | missing |  | No repair conversational agent, delivered customer messages, approved reply policy or escalation handoff. |
| `ADV-003` | Resolve the next repair blocker | push-further | partial | `tests/mallet.test.mjs`; `tests/support/blocker-journey.mjs`; `tests/support/blocker-parts.mjs`; `tests/support/blocker-follow-through.mjs`; `tests/support/blocker-archive.mjs`; `tests/blocker-browser.mjs`; `tests/support/blocker-browser-follow-through.mjs` | Native source-cited blockers, current handlers, prepared steps and evidence, consent, receiving, work and quality follow-through are asserted. Evaluation of agent actions under the held company class policy, including commitment, money and external decisions, is not asserted by the cited evidence. |
| `ADV-004` | Source parts and keep promise times current | push-further | missing |  | No sourcing/ETA agent, supplier connections, arrival confirmation or promise-update follow-through. |
| `ADV-005` | Bring declined work back at the right mileage | push-further | partial | `tests/support/declined-work-review-journey.mjs` — declinedReviewJourney, registered in `tests/mallet.test.mjs` as “ADV-005: cited declined-work review preserves decisions, refuses stale or unsafe preparation and recovers erased history”; `tests/declined-work-review-browser.mjs` — declinedReviewBrowser, registered as “ADV-005: owner reviews later mileage, replacement inspection and advisory history at 1440 and 390”. Native review captures exact customer decisions, active corrected readings, current inspection observations, repriced quote revisions, recorded account and vehicle revisions and booking-capacity citations. Refresh appends history; stale preparation is refused. Recorded customer reminder withdrawals and resumptions are exact cited source revisions: either change invalidates the packet, an active withdrawal suppresses preparation, and resumption leaves item-specific outreach consent unknown. The same journeys preserve all previous decisions and exclude unrelated customer preference citations. A quote whose current work no longer matches the retained native declined-item association stays unknown and cannot prepare an advisory; a current price revision for the same work remains usable. A later green observation of the same checklist point, including a replacement checklist, suppresses the older selected finding; completed work and explicit inapplicability also suppress advisory preparation. Media erasure removes eligible photo metadata from every retained packet revision while respecting holds. Personal erasure removes mutable packets; archives retain exact remaining history without sending authority and reject stale erasure replay. | Advisory preparation only. A shop-authorized licensed maintenance-source entitlement and matching schedule evidence were not supplied, so the schedule-qualified outreach-to-booking journey cannot be proven here. Licensed service-schedule evidence, independently verified ownership, affirmative item-specific communication consent, current availability qualification, approved outreach, reply handling and booking follow-through remain unbuilt or unproved; unknown eligibility is never inferred from a mileage or time threshold. The delivered native owner or admin advisory review grants no send, reservation or customer-decision authority; the planned agent call carries its computed classes under the company’s policy. Expanded native authority still awaits ct approval. AGENT-001 currently implements four preparation commands; expanded grants, customer sending and promise changes are not delivered by this native advisory slice. The planned tools remain subject to the company’s policy. ADV-008 retains its ct, conversation, channel and standalone-intake erasure gaps. |
| `ADV-006` | Detect comeback and supplier quality patterns | push-further | partial | `tests/mallet.test.mjs`; `tests/support/warranty-pattern-journey.mjs`; `tests/support/warranty-journey.mjs`; `tests/support/supplier-returns-journey.mjs`; `tests/warranty-browser.mjs` | Not asserted in the old cited evidence: Held company policy decides the agent claim; Policy class decides the agent commitment. Asserted: Detected cluster has exact members; Unrelated symptom is not a match; False association rejection is read back; Prepared claim retains exact source citations; Review leaves diagnosis unchanged; Review leaves safety clearance unchanged; One original repair cannot make a repeat cluster; Two original repairs make a repeat cluster; Catalog item filter excludes mismatch; Supplier filter excludes mismatch; Marked-lot filter excludes mismatch; Serial provenance is exact; Lot provenance is exact; Prior measurements are exact; Actual labor quantities are exact; Warranty decision is exact; Claim outcome is retained; Linked RMA and credit history is exact; Rejected and retained associations append; Review retains reason; Rejection changes repeat eligibility; Source decisions remain unchanged; Authorized admin reviews the exact packet; Changed source makes captured review stale; Changed source makes captured claim stale; No diagnosis from detection/review; No safety clearance from detection/review; No external provider submission after review and claim; No financial posting from review; No provider outcome is inferred; Citation schema has only record kind, id and revision; Review history remains after recovery; Claim citations remain after erasure and recovery. |
| `ADV-007` | Reconcile repair pickup payment and profit | push-further | partial | `src/mallet/invoices.ts`; `tests/mallet.test.mjs` | Invoice preparation from authorized actuals is asserted under the held company policy. Pickup, actual-cost and processor/books comparison and correction follow-through remain unbuilt or unproved. |
| `ADV-008` | Bounded agent authority and receptionist handoff | push-further | partial | `tests/mallet.test.mjs`; `tests/support/assistant-journey.mjs`; `tests/assistants-browser.mjs` | Native scoped assistant tools and owner settings implement the intake, reservation, note-proposal, disclosure, escalation and one-email fixture. Evaluation under the company’s class policy remains unproved; the narrow fixture is not a product disposition. The unresolved broader native-authority question is retained in docs/agent-commands.md. Complete receptionist conversation, channels beyond the requested appointment email, and complete customer erasure mapping for standalone receptionist intake remain unbuilt or unproved. A recorded AI-disclosure acknowledgment and customer request are evidence supplied by the assistant, not a certification of an external conversation. Provider acceptance proves handoff only. |
