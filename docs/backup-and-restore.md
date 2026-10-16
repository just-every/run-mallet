Your workshop lives with you, so the backups are yours too. Mallet makes one file that holds the whole workshop, and restores it into a fresh installation on any computer.

## What a backup holds

A backup holds your workshop records: assets, jobs, estimates and their frozen approvals, authorisations, recorded work, invoices and their saved CSVs, and the original files from any move-in. It leaves out sign-in identities, sessions, agent keys and private settings: the installation you restore into has its own owner and its own keys.

Keep backups private. They contain your customers' names and contact details.

## Download a backup

The owner can download one at any time from **Data & access**: press **Download workshop backup**. You get `workshop.rer`.

Or, from the `run-mallet` folder, stop Mallet and export with `rer`:

```sh
rer dev --stop
rer export --output exports/workshop.rer
```

## Restore on another computer

Restore goes into an empty installation, so nothing already there is overwritten.

1. On the new computer, install rer and get Mallet, as in [Get started](/docs/getting-started).
2. Run `rer dev` once, finish setup as the new owner, then stop it with `rer dev --stop`.
3. Import the backup and start again:

```sh
rer import --input exports/workshop.rer --yes
rer dev
```

Mallet refuses to import into an installation that already has workshop records. Moved-in records stay usable by the new owner, including their journals and undo.

## Erase an unused asset

The owner can erase an asset that has never had a visit, for example one added by mistake or brought in by a move-in that a customer asked you to remove. Open the asset, type `ERASE` under **Erase unused asset** and press the button. Mallet removes the asset and the personal data imported with it.

An asset with visits keeps its service and financial history.

## Keep erasure in older backups

An older backup still contains what you erased. After erasing, download a fresh backup and keep it as the erasure journal. When you restore an older backup, pass that journal so erased data does not come back:

```sh
rer import --input exports/older.rer --journal exports/after-erasure.rer --yes
```
