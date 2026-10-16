# Mallet

Mallet runs the repair bench for a small Australian mechanic, bicycle or device shop: customer assets, bay bookings, estimates, recorded customer authorisation, parts and labour, and one saved invoice export per visit. The asset keeps its visit history. You run the app and hold its data in your own account.

## Start from a fresh clone

Install the `rer` launcher once if it is missing:

```sh
npx -y @runeditrun/rer@0.2.26 cli install
export PATH="$HOME/.local/bin:$PATH"
git clone https://github.com/just-every/run-mallet.git
cd run-mallet
rer dev
```

If you already have `rer`, start at `git clone`. This checkout pins `@runeditrun/rer` **0.2.26**, Node 22.20.0 and pnpm 10.12.4. The launcher uses the checkout's pinned package and selects its Node runtime. `rer dev` installs dependencies, sets up a local owner and starts the real app automatically. First launch can take several minutes; if interrupted, the same command resumes.

Open the printed `RER_OPEN` link on this computer. It signs you in as the local owner. **The link is a credential: keep it private.** Finish the first-run form at `/setup`, then open `/app`. `RER_READY` is the listener address. Development and demo email is suppressed; no mailbox delivery is needed for this local journey. There are no shared owner credentials to copy.

Stop with `rer dev --stop` or Ctrl-C. For a deliberate installation with your own owner mailbox, use `rer install`, then `rer setup` and its prompts, then `rer dev`. [RUN-LOCALLY.md](RUN-LOCALLY.md) describes private answers, runtime selection and recovery; `rer describe` shows supported commands.

## Docs and the run site

The owner guides live in [`docs/`](docs/) as Markdown, listed in [`docs/site.json`](docs/site.json): [getting started](docs/getting-started.md), [completing a repair](docs/complete-a-repair.md), [bookings and history](docs/bookings-and-history.md), [people and agent keys](docs/people-and-agents.md), [move-in](docs/move-in.md), [backup and restore](docs/backup-and-restore.md) and [deploying](docs/deploy.md).

`rer build --site` builds Mallet's public run site into `dist/site`: the homepage, the Run page at `/run` and those docs at `/docs`, as static pages with no script on the homepage and nothing loaded from another origin. `rer dev` also serves it, printed as `RER_SITE`. Its source is `src/site/`; the domain it will publish to is in `deploy-site.json`, and `.github/workflows/run-site.yml` deploys it only when the repository variable `RUN_SITE_DEPLOY` is `true`. Until the run site has its domain, start from this README.

## Complete a repair

1. In the workshop, use **Add a customer's asset**. Enter the customer, vehicle/device label and unique registration or serial. Open the saved asset.
2. Use **Book in a visit**. Enter the request, bay, technician, start and end. Use ISO timestamps with an explicit timezone, for example `2026-10-19T09:00:00+10:00` and `2026-10-19T10:00:00+10:00`. Times are stored as UTC. Overlapping bookings for either the bay or technician are refused. When assigning a member, enter their **operator ID**, obtained from `/auth/operators` or `GET /auth/session`, rather than their display name.
3. Open the job and **Prepare estimate** with parts and labour. The form has one part and one labour line; the API supports 1–100 lines. Prices are AUD excluding GST, with 10% Australian GST shown separately. The form taxes both lines; API lines can explicitly use `gst:false`.
4. Review and **Approve estimate**. Open the printable estimate and share it yourself. Use **Record estimate shared** to record the method and reference. Choosing email records your manual handoff; Mallet does not send the estimate or confirm delivery.
5. Select the lines the customer actually authorised, enter their name, method and evidence, and **Record customer authorisation**. Staff record signed, phone, email-reply or in-person evidence; this is not a customer signing portal. Unselected lines are declined. Approval and authorisation name the exact revision. A revision before authorisation needs fresh approval and sharing; an authorised estimate is frozen. Book a new visit for additional work.
6. Record parts used and labour hours against authorised lines. The total recorded quantity cannot exceed what was authorised. **Complete repair**, then **Prepare invoice**, review it and **Approve invoice**.
7. **Export invoice once**, then download the saved CSV. Later export requests retrieve that same export record. The invoice uses authorised prices and recorded quantities, without editable replacement totals.
8. Return to the asset for every visit, its audit trail and **Download service history CSV**. Booking another visit preserves the earlier one.

The invoice file is a generic Mallet CSV with AUD unit, subtotal, GST and total columns. It is **not an automatic Xero import** or a live accounting integration. Review and map it in your accounting workflow; a saved export does not establish that it has been posted to the books.

## People and agent access

Owners and admins manage jobs and approve estimates, dispatch plans and invoices. Members see their assigned jobs and record their authorised work. Members cannot approve prices or export invoices. Only the owner can restore backups or erase assets.

People management uses Base's authenticated routes. Read the current operator list at `GET /auth/operators`; invite with `POST /auth/invite` and `{email,displayName,role:"member"}` (or `"admin"`). Change access through `POST /auth/operator/role` with `{operatorId,role}` and `POST /auth/operator/status` with `{operatorId,status:"active"}` or `"inactive"`. These require an authorised native session and Base's CSRF checks: use the app's exact origin, send its session cookie and the matching `Origin` header on mutations. Operator role limits still apply; a bearer agent key cannot manage people. See the [Base auth contract](src/modules/operator-auth/README.md#http-contract). Hosted invitations need configured mail; development suppresses delivery.

In **Data & access** (`/app/data`), create a labelled preparation key and copy it once to your agent's private environment. Keys expire after 30 days and can be revoked there. An agent may read workshop state and prepare estimates, estimate revisions, dispatch proposals and invoice drafts. A person must decide them. Agents cannot share or authorise estimates, approve, record work, export, import, restore or erase. [docs/agent-commands.md](docs/agent-commands.md) gives payloads, versions and access boundaries.

## Move in, back up and erase

**Move into Mallet** (`/app/move-in`) accepts saved RepairShopr customer and customer-asset API response snapshots. Preview the changes without writing, review the exact fingerprint, then apply. Keep the returned job ID to inspect its journal, retained originals and source links or undo it. Undo refuses to remove assets changed or booked since import. This moves the register; historical jobs, invoices and authorisations stay with the source system. See [docs/move-in.md](docs/move-in.md) for supported shapes and limits. No RepairShopr account credentials or live synchronisation are needed.

The owner can use **Download workshop backup** in Data & access, or export locally:

```sh
rer dev --stop
rer export --output exports/workshop.rer
```

Keep the archive private. To restore on another machine, clone this repository, use `rer dev` to finish setup for a fresh owner, stop it, then import into its empty product store:

```sh
rer import --input exports/workshop.rer --yes
rer dev
```

A populated destination is refused. Backups cover workshop records, approvals, invoices and retained import originals, excluding identity, sessions, agent keys and private settings. The destination claims its own owner and needs its own configuration. The policy is [src/mallet/archive-policy.mjs](src/mallet/archive-policy.mjs); the full owner-only Base export/import HTTP handler is mounted at `/api/portability/*`. [docs/agent-commands.md](docs/agent-commands.md#backup-and-restore) lists that protocol.

The owner can open an **unused** asset and type `ERASE` to erase it and affected imported personal data. Assets with visits retain their service and financial records in this release. After erasure, save a fresh backup as the later erasure journal. When restoring an older archive, supply it with `rer import --input exports/older.rer --journal exports/after-erasure.rer --yes` so erased data is not revived. Keep this later journal with older archives.

## Deploy in your own account

Local use requires no Cloudflare account. Hosted use requires your own Cloudflare account with a registered workers.dev subdomain and an account-scoped API token with **Workers Scripts: Edit** and **D1: Edit**. This edition declares one D1 database. Provider resources belong to your account.

Follow the pinned [Base owner-account deploy kit](https://github.com/runeditrun/base/blob/913926d5425ad95321fb22f95ee8f4c4cd7b552f/modules/deploy-kit/README.md) after local setup. Supply `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OWNER_EMAIL`, `SESSION_SECRET`, `SETUP_TOKEN` and `MAIL_API_KEY` privately through the environment or supported private `--env-file`. Configure a real verified sender in `deploy.json` in place of its invalid example `MAIL_FROM`; the declared mail provider is Resend. Never put keys in source or command arguments. Hosted auth mail is separate from manually sharing repair estimates.

```sh
rer deploy --dry-run
rer deploy
```

Dry run builds and validates locally without provider requests. A real deploy provisions declared resources, applies migrations and checks hosted health. Keep the private `.rer/deploy/<environment>.json` state file outside Git and back it up after deployment: it records resource ownership for future deploys. A fresh clone without it cannot safely adopt an existing deployment. Use the recorded receipt and health result as deployment evidence; local startup and a dry run do not prove hosted health or mail delivery. [OPERATIONS.md](OPERATIONS.md) and the pinned deploy-kit README describe recovery and current flags. Stop the local server before builds.

## First-release boundaries

Optional Pier integration is available at `GET /api/mallet/catalogue`, a read-only catalogue adapter using `GET /api/pier/state` at your configured `PIER_ORIGIN`, with a private authorised `PIER_SESSION`. It does not reserve, decrement or order stock and is not required for a repair. The first release does not need supplier networks, payments, vehicle-registry lookups, OEM repair data or warranty claims.

[ACCEPTANCE.md](ACCEPTANCE.md) defines the release journey; [CONTRACT.md](CONTRACT.md) records invariants and [SOURCES.md](docs/SOURCES.md) records implementation provenance. Acceptance criteria describe what must be proved; they are not a claim that a hosted stranger journey has already passed.
