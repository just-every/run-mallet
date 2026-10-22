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


### Intake custody and unlock material

Condition and custody receipts, checklist comparisons and value-free access audits travel in workshop archives. Typed signatures acknowledge the exact saved checklist and consent text; they do not verify a customer's identity. Before/after evidence uses the private inspection media store. A comparison records custody evidence only, not collection or payment.

Temporary unlock material is different: only the current owner may store or reveal it after explicit customer consent for a named purpose, with a lifetime of at most 24 hours. Each value is encrypted with its own random data key. The data key is wrapped by the dedicated managed INTAKE_VAULT_KEY setting and kept in the private INTAKE_VAULT R2 bucket, outside D1 Time Travel and all product archives. Purging destroys that key before deleting ciphertext, so restoring an older database cannot recover a purged value. End the purpose immediately when unlock work finishes; expiry removes the ciphertext on the scheduled sweep or next vault/custody request and expired values cannot be revealed. Never copy or back up the key bucket. End active purposes before rotating INTAKE_VAULT_KEY; SESSION_SECRET is not a vault key. Upgrading from session-key encryption makes legacy active secrets unavailable; obtain fresh consent and re-enter them. The owner can start a customer erasure request from custody by destroying all unlock material across that customer account’s assets and visits; other repair records are retained. GOV-006 inherits the same immediate purge when full customer erasure ships. Purposes and reveal reasons containing the entered unlock value are refused; reveal reasons are audited without values. Recovery retains non-secret receipts and audit history but requires fresh customer consent and fresh unlock material. Do not put passwords or unlock codes in ordinary notes, damage descriptions, photos or receipts.


### Warranty and documented handover

The Warranty & comeback work link keeps saved shop-declared coverage terms, the original invoice and paid-tender evidence, installed supplier lot/serial, human coverage decision, separate no-charge repair, actual costs and externally evidenced supplier/OEM claim history. A prepared claim is not a submission; credited amounts are reporting evidence, not accounting postings. The original invoice and saved export stay unchanged.

Document handover uses the existing collection command with stronger checks: current independent quality clearance, latest signed custody comparison, mileage-out, staff collector check, customer-authorized delegate evidence where needed, warranty advice and a printable receipt. Every processor-backed collection rereads captured, paid, unrefunded USD evidence from Stripe. Configure the shop-owned STRIPE_SECRET_KEY as a private Worker secret; never put it in source or product data. The intent must carry metadata mallet_invoice_id equal to the exact Mallet invoice ID. The check reads evidence only and creates no charge or refund. Test-mode receipts are labelled; captured funds are not proof of a bank payout. Provider failure or refunded funds blocks release.

Only the current owner can explicitly permit release without verified settlement, with a reason bound to the exact invoice and expiring after 24 hours. The receipt preserves the exception and never calls it payment. Customer-granted delegate authority is job-scoped and revocable. Staff check the actual collector in person without storing identity documents; Mallet does not verify identity. The receipt can be printed or saved from the private staff page; no customer message is sent automatically. Historical collections remain observations, not retroactive settlement or custody certificates. New documented handover ends and removes temporary unlock material; it cannot be recreated after release.


### Versioned customer intake forms

Configure vehicle/device templates from Condition & custody. Publish stable custom field keys, required choices, exact diagnostic fee and storage/teardown terms. Issuing a customer link freezes that version and the visit recipient; creating the link sends no message. Share the one-time displayed private link directly with the customer. It expires after seven days and can be revoked from the custody page. Anyone holding that scoped bearer link can use it; no customer identity verification or account authority is inferred.

Customers can save a draft and sign on a phone. A missing required field keeps all valid answers and lists what is missing. Signing records the exact template, answers, typed name, electronic-terms/copy consent and receipt checksum. It authorizes neither additional repair work nor a payment charge. The signed page immediately contains the readable copy and an exact JSON download. A single email-copy claim is saved before calling Base mail. A crash or uncertain result is not automatically retried; the signed copy remains on the link and in staff retrieval, and the shop can provide a paper copy. Development mail is honestly marked not sent. New template versions never alter issued or signed terms. Archives retain templates, drafts, signed receipts and mail outcomes while excluding bearer-link credentials; restored staff retrieve the historical signed copy with fresh native authority.
