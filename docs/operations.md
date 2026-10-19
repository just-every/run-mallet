# Backups, updates and recovery

These steps operate on the local installation in this checkout. Use [Run locally](../RUN-LOCALLY.md) for the full command contract and [Back up, restore and erase](/docs/backup-and-restore) for the owner download door. `rer describe` reports the checkout's actual supported verbs. The pinned CLI does not provide complete remote export/import: a local backup does not back up a hosted shop. Follow the provider's backup procedure for hosted data; do not attempt to recover a hosted shop by importing into the local copy.

## Save a backup

Pause shop activity and stop this installation's dev or preview process before exporting so no writes race the backup. In a foreground terminal, use Ctrl-C. Record the source revision (`git rev-parse HEAD`), any local source changes, and the backup date together outside the served app, then run from the checkout root:

```sh
rer export --output exports/pre-update.rer
```

Use a new filename for each backup. Keep the archive and its integrity receipt private, with a separate protected copy outside the checkout. A relative export path must be under `exports/`; an absolute path outside the checkout is also supported. Import requires an owned regular file with mode 0600. Keep a private copy of the installation configuration separately: archives deliberately exclude identities, sessions, agent keys and private settings. Never commit those files or place them in a served directory.

Backups contain every current Mallet product record kind, including mileage, service intervals, declined-work decisions and follow-up, immutable approvals and saved invoice exports, and import originals and journals. Native inspection photo/video originals, prepared shared variants, provenance and upload chunks are included as private D1 product data. Future product records, media and retained provider data inherit OPS-001 portability acceptance before shipping. Backup/restore does not convert historical actor IDs into access rights or broaden an existing approval.

After an erasure, take a new backup and use that instead of an older one. DATA-001's erasure fences remain mandatory; a later journal is not permission to resurrect erased data. Retain the latest erasure evidence with the recovery material. A completely fresh destination cannot discover later source erasures by itself: without that later journal it can accept an older archive. Carry the latest post-erasure backup/journal; do not treat an import without later source evidence as proof of freshness. If the only pre-update backup predates a later erasure, stop and resolve recovery against the current erasure fence before restoring it.

## Update without removing shop data

1. Save the pre-update revision and backup as above, and preserve any uncommitted source changes separately before switching revisions. Keep the original checkout and configuration. Review the new release's migration and compatibility instructions.
2. With the app stopped, fetch the source and switch to the chosen release or commit. Do not change dependency pins independently of that source revision. Then run in the same checkout:

   ```sh
   rer install
   rer setup
   rer dev
   ```

3. Repeated setup keeps the saved owner, data and private settings, and applies the declared migrations. Open the printed `RER_OPEN` link privately on this computer. Check health/readiness, representative repair history, mileage and declined work, exact approvals, saved invoice downloads and import custody before resuming shop activity. Compare product record counts with the pre-update archive, allowing only the release's documented migrations. Compare inspection finding/variant/chunk counts and open the retained original and prepared versions; incomplete uploads remain resumable.

The update keeps the existing owner and accounts. Do not reset the installation, clear database state, rewrite migration history or replace private settings to make an update pass. Setup refusals identify the required repair; follow that repair without discarding shop data. Keep the pre-update backup and source revision until the update is accepted. Review any work recorded after the backup separately before choosing recovery.

## Recover the pre-update shop in a fresh checkout

Recover the matching pre-update source revision and pre-update backup together. Running old source against the updated database is not a rollback. Stop further writes in the affected installation and keep it intact for investigation and reconciliation.

1. Obtain a separate checkout at the recorded pre-update source revision, including the owner's preserved source changes if any. Use a new directory and leave the affected checkout untouched. Run `rer install` there.
2. Copy the private backup and latest trusted backup/journal into that checkout's `exports/` directory, as `pre-update.rer` and `latest-journal.rer`, and set both file modes to 0600. When no later backup exists, the source backup is its own journal; once an erasure happens, carry its newer journal instead. Restore while the destination contains no shop records:

   ```sh
   rer import --input exports/pre-update.rer --journal exports/latest-journal.rer --yes
   rer setup
   rer dev
   ```

3. Setup establishes fresh native owner authority and private configuration for the recovered installation. Use the same shop owner's account unless a different owner is intended; the restore acceptance journey uses a separate owner to prove the authority boundary. Select a free local port with `rer setup --port N` if the CLI reports an origin conflict. Reconnect providers through their normal approval doors when needed; never copy sessions or keys out of the archive.
4. Before accepting recovery, compare record counts by kind and media counts with the archive, open the original approvals and saved invoice exports, check mileage/declined-work history and import originals, and finish a restored open repair using the recovered installation's authorized operator. Inspect quality checklist versions, failures, corrective work, sign-offs and overrides as well. If the archived technician identity has no destination authority, the current owner uses **Take over this repair’s technician assignment**, with a reason. Original work/results/signatures retain their historical actors; the owner becomes the current technician and clearance becomes stale. The owner must inspect/retest and sign current work as technician, then obtain a different current owner/admin's independent quality sign-off before completion. Verify source sessions and agent keys confer no restored authority. The integrity checks and erasure fences must succeed; do not bypass a refusal. Reconcile any activity after the pre-update backup before resuming operations.

An import refusal for existing records means the destination is not empty. Choose another fresh checkout; never reset the original shop to recover. Retain both checkouts and the private evidence until the owner has accepted the recovered shop.
