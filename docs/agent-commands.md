Use the real app origin. `GET /api/mallet/state` returns `{actor,version,records}`. The top-level `version` is the store version; commands below use the relevant **record's** `version`. Read current records after each write: commands can update related records too. A version conflict requires a refresh and review of the changed record.

Send commands as JSON:

```http
POST /api/mallet/commands
Content-Type: application/json
Authorization: Bearer <private-preparation-key>

{"command":"invoice.prepare","input":{"jobId":"<completed-job-id>","version":7}}
```

The placeholders are not usable credentials or record IDs. Successful commands return their result as JSON. Errors return `{error,message,details?}` with an appropriate 4xx/5xx status. Mallet JSON bodies are limited to 1 MiB. Do not blindly repeat a failed financial decision; refresh its state first. Invoice export specifically returns its saved journal entry on a valid repeated request.

## Authentication and permissions

Native owner/admin sessions manage the repair workflow. Cookie-authenticated mutations require the exact app `Origin` and valid session; cross-site requests are refused. Do not bypass Base's CSRF protections. An agent uses only `Authorization: Bearer …`, never fabricated `actor` or role fields. Bearer requests must still address the correct app host and cannot be cross-site browser requests.

| Actor | Allowed work |
| --- | --- |
| Owner/admin | Workshop commands, agent-key create/revoke, invoice downloads, snapshot import preview/apply/journal/undo. |
| Member | Read assigned jobs, their assets/estimates/events; `work.record` on an assigned job. Assignment is by operator ID. |
| Agent key | Read workshop state; only the four preparation commands below. |
| Owner only | Native backup/restore and unused-asset erasure. |

A preparation key can see workshop/customer state, so treat it as private customer-data access. Keys expire 30 days after creation. The key is invalid if revoked, expired, or its creating owner/admin becomes inactive or changes operator version/role. Current session/key authority is checked again at mutation time.

Create keys from `/app/data`, or with an owner/admin native session:

```json
{"command":"agent.create","input":{"label":"Workshop assistant"}}
```

The response includes `{id,label,token,expiresAt}`; `expiresAt` is epoch milliseconds. Copy `token` once into private agent configuration. The UI never shows it again. Revoke with `{"command":"agent.revoke","input":{"id":"<key-id>"}}`. An agent key cannot create or revoke keys.

## Four agent preparation commands

| Command | Required input | Result and constraints |
| --- | --- | --- |
| `estimate.prepare` | `jobId`, job `version`, `lines`; optional `notes` | Draft estimate revision 1 on an open job with no estimate. Also updates the job. |
| `estimate.revise` | `estimateId`, estimate `version`, current `revision`, replacement `lines`; optional `notes` | Appends a draft revision; earlier approval does not approve it. Authorized estimates are frozen. |
| `dispatch.prepare` | `jobId`, job `version`, `bayId`, `technicianId`, `startAt`, `endAt`, `reason` | Pending proposal with observed conflicts. A person's approval checks current conflicts and job version again. |
| `invoice.prepare` | `jobId`, completed job `version` | Draft invoice from authorized actual work, once per job. Do not supply lines or totals. |

Example estimate input:

```json
{
  "command": "estimate.prepare",
  "input": {
    "jobId": "<job-id>",
    "version": 1,
    "lines": [
      {"kind":"part","description":"Oil filter","quantity":1,"unitCents":2500},
      {"kind":"labor","description":"Service labor","quantity":0.5,"unitCents":12000}
    ],
    "notes": "Review both lines before sharing."
  }
}
```

Each estimate has 1–100 lines. A line uses `kind:"part"|"labor"` (`labour` is accepted for legacy callers), `description`, positive numeric `quantity` with up to three decimal places, and non-negative integer `unitCents` **before tax, in USD**. Do not send a `gst` flag or a per-line tax override: the shop's parts/labor settings determine whether each line is taxable. The server rounds each line's subtotal and sales tax to integer cents, then sums the rounded lines. Optional `id` must be unique within the revision; otherwise IDs are generated. Only parts may carry optional `pierItemId`. A reference does not allocate stock.

Before preparing estimates, the owner configures the shop's sales tax rate and taxable categories in `/setup` or `/app/tax`. Parts default to taxable and labor to exempt; the owner must enter the actual rate. Mallet does not look up jurisdiction rates. Each estimate revision saves the rate and tax treatment used to price it; later settings changes do not reprice that revision or its resulting invoice. Agents can read the saved shop configuration at `records.taxSettings[0]` in workshop state, but cannot change it.

Times must include a timezone, for example `2026-10-19T09:00:00-04:00`. A booking/dispatch interval ends after it starts and lasts no more than seven days. `technicianId` must be the member's actual operator ID for that member to see and record work; a display label will not grant that access.

Agents are denied `tax.configure`, `estimate.approve`, `estimate.markSent`, `estimate.authorise`, `dispatch.approve`, `invoice.approve`, `invoice.export`, `work.record`, `job.book`, `job.complete`, asset changes, import, portability and people/key management. The person reviews prepared work in the job UI; approvals and events retain the preparer, decision-maker, exact revision/version and timestamp.

## Human command reference

These require an owner/admin native session unless marked otherwise. `version` always names the target record described in the row.

| Command | Input |
| --- | --- |
| `tax.configure` | `ratePercent` (number), `partsTaxable` (boolean), `laborTaxable` (boolean). Sets the shop sales tax configuration for future estimate revisions. |
| `asset.create` | `customerName`, optional `customerEmail`, `label`, unique `identifier`. |
| `asset.update` | `assetId`, asset `version`, same asset fields. |
| `job.book` | `assetId`, asset `version`, `title`, optional `notes`, `bayId`, `technicianId`, `startAt`, `endAt`. |
| `estimate.approve` | `estimateId`, estimate `version`, exact current `revision`. |
| `estimate.markSent` | `estimateId`, estimate `version`, `revision`, `method`, optional `note`. Method: `email`, `printed`, `phone`, `in person`, `manual share`. Records manual sharing; no email is delivered or confirmed. |
| `estimate.authorise` | `estimateId`, estimate `version`, `revision`, nonempty unique `lineIds`, `customerName`, `method`, `evidence`. Method: `signed`, `email reply`, `phone`, `in person`. Must follow approval and sharing of this revision. Staff attest to external evidence. |
| `dispatch.approve` | `proposalId`, proposal `version`. Refuses stale jobs, current resource conflicts, completed jobs or jobs with actual work. |
| `work.record` | `jobId`, job `version`, authorized `lineId`, numeric `quantity`, optional `note`. Also allowed for its assigned member. Cumulative quantity cannot exceed authorization. |
| `job.complete` | `jobId`, job `version`, optional `note`. Requires actual work. |
| `invoice.approve` | `invoiceId`, invoice `version`, optional exact invoice `revision`. |
| `invoice.export` | `invoiceId`, invoice `version`. First export requires approval. A repeat accepts the current version or the version immediately before first export and returns the saved entry. |
| `asset.erase` | **Owner only:** `assetId`, `confirm:"ERASE"`. Refuses assets with visits. |

Invoices use recorded authorized quantities and the frozen estimate prices and sales tax rate. No arbitrary prices or totals may be injected at invoice preparation. The saved export has `format:"mallet-invoice-csv"`; download it as owner/admin at `GET /api/mallet/exports/<export-id>`. Its money columns are `UnitUSD`, `SubtotalUSD`, `SalesTaxUSD` and `TotalUSD`, and `Currency` is `USD`. This generic CSV is not guaranteed to match Xero's import schema. Asset event history is available at `GET /api/mallet/assets/<asset-id>/history.csv` within the caller's visible state.

## Snapshot move-in API

All routes require an owner/admin native session and same-origin mutation checks. These are separate endpoints, not preparation-key commands. Read [Move in from RepairShopr](/docs/move-in) before supplying RepairShopr customer/asset snapshots.

| Method and path | Input / result |
| --- | --- |
| `POST /api/mallet/imports/preview` | `{customers,assets}` → dry-run plan, `fingerprint`, counts, diagnostics and source links. No writes. |
| `POST /api/mallet/imports/apply` | `{customers,assets,fingerprint}` using the identical reviewed snapshots → journal job/progress. Resolve error diagnostics before applying. Repeat identical approved input to continue a bounded apply. |
| `POST /api/mallet/imports/resume` | `{id}` → continue the retained approved plan without uploading snapshots again. |
| `GET /api/mallet/imports/journal?id=<id>` | Retained job, full plan, originals and mapped/source links. |
| `POST /api/mallet/imports/undo` | `{id}` → undo; refuses changed assets or those with later visits. |

The browser path is `/app/move-in`: preview, explicitly approve the fingerprint, apply and retain the journal ID. These imports move customers/assets only, not source jobs or authorizations.

## Backup and restore

The owner uses `/app/data` → Download workshop backup, or native `rer export` / `rer import` described in [Back up, restore and erase](/docs/backup-and-restore). Backups exclude identity and keys. Restore requires an empty product destination with a fresh owner/configuration. An archive that predates an erasure is refused (`restore_refused`, reason `erasure_epoch`), with or without `--journal`: restore a backup made after the erasure. Local `--input` and `--journal` files must be owner-only (0600) paths inside the checkout, such as `exports/workshop.rer`.

Mallet mounts the full Base handler with its [archive policy](https://github.com/just-every/run-mallet/blob/main/src/mallet/archive-policy.mjs). All routes below require the owner's native session; mutation requests include the matching `Origin`. The transfer job is scoped to the owner who created it.

| Method and path | Operation |
| --- | --- |
| `POST /api/portability/exports` | Create export job with `{}`. Returns `{id}`. |
| `GET /api/portability/exports/<id>` | Read status. |
| `POST /api/portability/exports/<id>/advance` | Advance bounded export work; body follows the Base protocol (`expectedPart`, `maxParts`). |
| `GET /api/portability/exports/<id>/download` | Download completed archive as NDJSON. |
| `POST /api/portability/imports` | Create import with `{manifest,confirmed:true}` from an archive. |
| `PUT /api/portability/imports/<id>/parts/<index>` | Upload the archive's numbered part using the Base protocol. |
| `POST /api/portability/imports/<id>/finalize` | Finalize the staged import using Base's validated protocol. |
| `GET /api/portability/imports/<id>` | Read import status. |
| `POST /api/portability/exports/<id>/abort` or `POST /api/portability/imports/<id>/abort` | Abort a transfer. |

Use the pinned Base transfer client/CLI for manifest and part construction; arbitrary workshop JSON is not a portability archive. A backup made after an erasure is the one to restore: an older archive, even with that later backup as `--journal`, is refused so erased information is not revived. Erasure is restricted to unused assets in this release; visit-bearing assets remain retained.


## Separate scoped assistant tools

AGENT-001 preparation keys keep the four commands above. They cannot invoke the following tools. A separate owner-issued key reads only `GET /api/mallet/assistant`; general workshop state, pages, downloads and unrelated commands refuse it. Tool requests use the existing command endpoint with the scoped bearer key. The owner manages grants and exact decisions in Assistant settings.

| Command | Inputs and boundary |
| --- | --- |
| `assistant.grant` | Fresh-confirmed owner only: `kind` is `receptionist`, `polish` or `send`; `subjectId` names one booking service, repair or tentative appointment respectively. Include `label`, timezone-bearing `notBefore` and `expiresAt`, `spendCents:0`, `channel` of `none` or, for send only, `email`, `confirm:true` and `reason`. Returns a one-time token. |
| `assistant.intake` | Receptionist key only: `serviceId`, a currently offered `slotId`, customer `name` and `email`, `request`, `consentEvidence`, `consent:true` and `aiDisclosed:true`. Returns the recorded intake and tentative reservation, including its expiry. No booking-confirmation token or repair authority is issued. |
| `assistant.polish` | Note key only: `diagnosisId` and current diagnosis `version`; optional `proposed` narrative fields are `complaint`, `cause`, `correction`, `staffNote`, `customerExplanation` and `testMethod`. Omitted fields normalize whitespace. Numeric observations, units and trouble codes must remain exact. Measurements, codes, attachments and attribution come only from the saved source. Every proposal is retained separately. |
| `assistant.reviewEdit` | Current owner only: `editId`, exact proposal `version`, `decision` of `approved` or `rejected`, `confirm:true`, and `reason`. Refuses a changed source or revoked grant. Records a decision; never overwrites technician evidence. |
| `assistant.queue` | Send key only, no recipient or content inputs. Generates one proposed confirmation per requested tentative appointment, addressed to the recorded requesting customer. |
| `assistant.review` | Fresh-confirmed owner only: `sendId`, exact `version`, exact `to` and `content`, and `confirm:true`. Changed or expired appointments refuse review. |
| `assistant.send` | Same send key: `sendId` and current `version`. Requires exact owner review, current grant and appointment eligibility. Claims durably before one mail handoff. Provider acceptance is separate from delivery and development suppression. No automatic retry follows failure, uncertainty or an interrupted claim. A new grant cannot bypass the one-attempt boundary for this appointment. |
| `assistant.escalate` | Any scoped key: `reason`. Creates a private owner task for its allowed subject. |
| `assistant.resolve` | Current owner only: `escalationId`, `version`, and resolution `reason`. Preserves the original request. Resolution grants no resend authority. |
| `assistant.revoke` | Fresh-confirmed owner only: `grantId`, current `version`, and `reason`. Revokes the key and stops queued or reviewed messages. Prior evidence remains. |

A grant permits no spending, supplier order, repair approval or customer authorization. Missing scope or limits grant nothing. Every write rechecks live owner and grant authority in its transaction; a final current-authority read precedes mail handoff. Expired or revoked keys cannot read scoped data. Historical grants and proposals survive backup, but local keys never do. The conservative expanded authority default remains pending ct approval as described in ADV-008.
