

Technical source details retained from the contract at `0ccbe75470bbcc0298a3d88dae1ec4c6515df022`. The live contract governs scope; RULINGS.md governs changed decisions. These parameters describe the retained technical requirements, not a claim of completion.

## INTAKE-004

Temporary unlock material is owner-only after explicit consent, AES-GCM encrypted under per-secret data keys wrapped by dedicated private installation configuration, excluded from archives/state/audits, preserving the exact entered value. It becomes inaccessible immediately when its purpose ends or its at-most-24-hour lifetime expires; ciphertext is removed on explicit purpose end, documented handover, the next custody/vault request or the next 15-minute scheduled sweep. Each secret is encrypted under its own data key, held outside the database's point-in-time recovery and destroyed at purge, so a restored database copy yields undecryptable ciphertext.

## INTAKE-002

Only its 256-bit hashed, seven-day, revocable scoped link can save the customer draft or typed-name acknowledgment; it grants no account or repair/payment authority and is excluded from archives. The immutable receipt contains a SHA-256, is immediately readable/downloadable on the same link, and remains privately retrievable by staff after a template change. The emailed and downloadable copy is a readable, printable document of the exact terms, answers, typed name, time and SHA-256, with the JSON attached.

## BOOK-001

Customers explicitly request confirmation email and receive a private 256-bit management link, stored only as a hash outside archives, to confirm, reschedule or cancel their own appointment. Refusals name the email or connection limit and explain confirmation, cancellation or expiry; the source uses a SHA-256 hash of the Cloudflare client address (a shared unknown-source bucket when absent), never a raw address or a form-supplied source.

## DIAG-001

Owner/admin create read-only customer inspection links: 256 random bits shown once, only the SHA-256 stored outside archives (restores keep link history, never access), seven-day default expiry (only the owner may extend it, to the 31-day ceiling), revocable, GET-only with no session; they show the vehicle, repair title and shared revisions’ complaint, cause, correction, codes, measurements, test method and customer explanation, never staff notes, attachments, prices, costs, contacts or other repairs.

## DVI-002

Findings and uploads bind opaque client IDs and exact metadata, 64 KiB chunk ordinals and SHA-256; mismatched retries refuse, and completion verifies the whole digest before viewing. The phone camera/file door retains original bytes; the annotated shared photo is a JPEG at quality 0.78 with its longest edge at most 1600 pixels. Browser video capture records up to 30 seconds at requested video/audio bitrates of 1,500,000/64,000 bits per second; a prepared shared video retains the captured compressed bytes.

Findings and uploads bind opaque client IDs and exact metadata, 64 KiB chunk ordinals and content digest; mismatched retries refuse, and completion verifies the whole digest before viewing.

JPEG/PNG/WebP originals are at most 8 MiB and MP4/WebM originals at most 32 MiB.

## DVI-003

The report uses the existing hashed 256-bit, 1–30 day, revocable read-only inspection link; every media request and chunk page rechecks link authority and only serves the reviewed shared variants, never originals.

## DIAG-002

The landed file adapter accepts a single Phonecheck Device Info JSON response and retains its exact UTF-8 bytes, SHA-256, AppVersion/BuildNo and original Passed/Failed/Pending strings.

## EST-003

Links carry 256 random bits with only the SHA-256 stored outside archives, expire no later than seven days under GOV-007 (the ct 22 October rider replaces the older 1–30-day range), are revocable and stop working once the estimate gets a new revision or total, any decision, or the repair completes. One same-origin POST per link records the decision through the exact-revision authorization rules as a link-only customer actor (method “signed link”, typed name, addressee email, UTC time, revision, approved and declined line amounts and approved totals, consent text); an identical replay returns the same receipt and a different second decision is refused. The receipt is canonical JSON with its SHA-256, retrievable by owner/admin and labelled a typed-name electronic signature with identity not verified beyond possession of the emailed link.

Links carry 256 random bits with only the content digest stored outside archives, expire no later than seven days under GOV-007 (the ct 22 October rider replaces the older 1–30-day range), are revocable and stop working once the estimate gets a new revision or total, any decision, or the repair completes.

The receipt is canonical JSON with its content digest, retrievable by owner/admin and labelled a typed-name electronic signature with identity not verified beyond possession of the emailed link.

## EST-006

A Worker cron every minute sends due reminders through the shop’s configured Base mail sender only while that link is the current, unrevoked, unexpired, undecided revision of an open repair; each reminder carries a fresh 256-bit token for the same link (only its SHA-256 is stored, outside archives), offers Stop reminders, and records the provider’s answer as given (handed to the provider, never “delivered”). Opt-out: the customer’s approval page offers Stop reminders (same-origin POST on the link, no signature) and owner/admin may record an opt-out the customer gave; it applies to that email address installation-wide for automatic reminders only, never closes an open link or blocks an advisor’s explicit send, and is lifted only by owner/admin recording how the customer asked to resume (MSG-001 text reminders inherit the opt-out record before they ship).

## BUY-002

Submission requires a fresh human proof and explicit audited confirmation, is claimed durably before its one POST, and uses a stable idempotency key.

## PAY-005

A pending or uncertain refund stays reserved until GET-only reconciliation resolves it. A confirmed Stripe submission is claimed durably once; uncertain outcomes use GET-only reconciliation, and repeated provider outcomes cannot add another financial effect.

## REPORT-004

Current report semantics: `/api/mallet/reports/turnaround?from=YYYY-MM-DD&to=YYYY-MM-DD` selects repairs by booking creation in an inclusive UTC date range.

## REPORT-006

Delivery receipts retain a SHA-256 hash rather than another copy of private report contents.

## GOV-003

OIDC uses signed tokens with PKCE; SAML requires signed Responses and Assertions, exact configured issuer, audience and callback, a single-use browser-bound request and a still-approved certificate.

## GOV-004

Current native semantics (sx c27; ct 22 Oct 15:55Z approved c26 with the following riders, none adds an acceptance point): a person may enrol authenticator-app (RFC 6238) and passkey (WebAuthn ES256, user verification required) second factors with eight single-use recovery codes; once enrolled, every new sign-in of that person must confirm before any Mallet page, API, media or Base `/auth` account route opens, and the first factor ends their other sessions.

## GOV-005

Current native semantics (sx c27; ct 22 Oct 15:55Z approved c26 with the following riders, none adds an acceptance point): provider credentials the owner saves in Mallet are sealed (AES-GCM, key derived from the installation secret, bound to connector and name), shown only as a short fingerprint, and replace the deployment's own binding; revoking one makes it unavailable to every provider call even while the binding remains.

## GOV-006

Customer erasure immediately destroys INTAKE-004 unlock data keys outside D1 recovery, before other retention processing.

## OPS-002

Current native semantics (sx c27): persistent business-event jobs use atomic installation-wide concurrency of four, one-minute leases and cron, stopped failed/uncertain handoffs and explicit owner recovery; only GET-only payment evidence may be replayed under fresh audited approval.


## INTAKE-004 — retained source details

Temporary unlock material is owner-only after explicit consent, authenticated encryption encrypted under per-secret data keys wrapped by dedicated private installation configuration, excluded from archives/state/audits, preserving the exact entered value.

## INTAKE-004 — retained source details

It becomes inaccessible immediately when its purpose ends or its at-most-24-hour lifetime expires; ciphertext is removed on explicit purpose end, documented handover, the next custody/vault request or the next 15-minute scheduled sweep.

## INTAKE-004 — retained source details

Each secret is encrypted under its own data key, held outside the database's point-in-time recovery and destroyed at purge, so a restored database copy yields undecryptable ciphertext.

## INTAKE-004 — retained source details

The vault key is a dedicated private setting.

## INTAKE-004 — native reveal floor

Until GOV-001 ships only the owner reveals; GOV-001 then lets the job's assigned technician reveal, each reveal reasoned and audited.

## PAY-005 — retained source details

Until GOV-001 ships, only the current owner previews, issues, applies and records refunds, credit notes and exchanges, and explicitly confirms each Stripe submission. GOV-001 then delegates bounded refund rights to manager, cashier and advisor roles and read access to the accountant, and GOV-004 adds refund step-up.

## PAY-005 — retained source details

Mallet never submits or retries a refund automatically.

## PAY-005 — retained source details

A pending or uncertain refund stays reserved until GET-only reconciliation resolves it.

## RETURN-001 — retained source details

Until GOV-001 adds delegated manager authority, only the current owner may approve a reasoned unpaid-release exception for that exact invoice (24-hour expiry); it never records payment.

## REPORT-002 — prior native scope and proof notes

Show gross profit and margin by repair, parts/labor/sublet, technician, advisor, service, supplier and location using actual purchase cost, loaded labor, discounts, core/refund adjustments and warranty rework; distinguish estimated from realized margin. Only the current owner reads profitability or declares versioned loaded hourly costs; other roles receive neither loaded rates nor profitability. The report selects repairs by inclusive UTC booking dates and derives estimated and realized pretax values from retained native sources. Loaded rates are separate from payroll wages. Missing cost evidence leaves profit unavailable. The declared basis, allocation, refund and warranty rules are documented in the documented operation; no money, outbound action or accounting posting is performed. Personal-owner-only profitability access and explicit owner-declared loaded hourly costs are approved as the current slice. Each rate revision retains its effective UTC date, USD-cent amount, basis, reason, actor and timestamp; earlier revisions remain inspectable. A dated correction may recompute the current repair-cohort projection, whose selection dates and calculation basis remain visible, without rewriting source invoices, approved timer history, published results or accounting records. Missing cost remains unavailable rather than zero. Estimated and realized margin remain distinct, with actual received costs, discounts, credits, refunds and warranty recovery reconciled once. Report access grants no send, purchase, payment, payroll or accounting-posting authority. The complete profitability target and OPS-001 portability remain binding. Complete location comparison awaits SHOP-001. The full acceptance sentence remains open for those cost and comparison cases despite the asserted native higher-cost, discount and comeback journey. GOV-001 retains the missing delegated profitability permissions; REPORT-002 must prove their application when available. Direct proof of complete rate-change audit content and contrasting effective-date selection cases remains incomplete. Existing native report, source, recomputation and fresh-owner recovery assertions retain their stated scope. Retained priced-package snapshots keep their original service revision after a later rename. The same journey asserts complete dated rate declarations with original actor and audit references, contrasts earlier, later and equal-effective-date revisions, preserves invoices and approved time history, and recovers the projection under fresh authority. Complete historical package attribution without retained source links remains unavailable. Location comparison remains SHOP-001, excluded from this campaign by its plan; delegated margin access remains GOV-001 and must be asserted when that door exists. The governing recorded decision is RL-12.
