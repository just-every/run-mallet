How the move-in kit is wired into Mallet, for anyone changing or reviewing it. Owners moving in need only [Move in from RepairShopr](/docs/move-in).

## Server integration

Import `src/mallet/imports/index.ts`. All entry points are server-only:

```ts
type ImportActor = { id: string; name: string; role: string }
type ImportAuthority = { sql: string; params: any[] }
type SnapshotInput = { customers: object; assets: object }

preview(db, actor, input: SnapshotInput, authority)
apply(db, actor, input: SnapshotInput & { fingerprint: string }, authority)
journal(db, actor, jobId: string, authority)
undo(db, actor, jobId: string, authority)
portabilityCheckpoint(db) // Promise<D1Sql[]>
erase(db, actor, assetId: string, authority, {
  nativeStatements: D1Sql[], checkpoint: D1Sql[]
})
```

The authenticated HTTP handler supplies its current-session SQL predicate and
enforces origin/CSRF protection and owner/admin access. Kit ANDs that predicate
with the actor's current active owner/admin role in the same D1 transaction,
before and after mutations. Its stable custody principal is `role:owner`, so a
restored installation can read or undo retained imports even after local operator
IDs have changed. That principal is an attribution key; it grants no authority.

`preview` returns `{name,fingerprint,counts,diagnostics,links,plan}` and executes
SELECT-only authorization fences. It creates no jobs or native rows. `apply`
rebuilds the plan from the supplied snapshots and requires the exact reviewed
fingerprint. A changed snapshot needs a new review. Jobs are idempotently keyed
by that fingerprint. The kit is insert-only: it refuses to overwrite an existing
native target, and changed data under an already imported source identity is a
conflict. Identical apply requests return/resume the same job.

`apply` and `undo` return a Base `ImportJob` with `id`, `fingerprint`, `state`,
`checkpoint`, `total` and the remaining standard job binding fields. Each call
processes one batch of up to ten **source entries**, including customer records.
If state is `queued` or `applying`, repeat the same approved apply payload. If
state is `undoing`, repeat undo. `journal` returns `{job,plan,originals,links}`.
Undo uses Base's strict native edit checks: a changed version, any changed value,
or a later native booking blocks reversal with `NATIVE_EDIT_CONFLICT`. Successful
undo removes the imported assets and preserves the audit/original custody.

`erase` is restricted to the current owner and an unused asset (`visits: []`).
The parent must also enforce its unused-asset business rules. Pass complete
server-authored domain cleanup SQL and the result of
`await portabilityCheckpoint(db)`. The adapter calls Base's actual portability
redaction helper, captures its returned prepare/bind SQL, and delegates real
reads and initialization to D1. This keeps Base's restore checkpoint algorithm.
Erasure removes the asset and its ownership marker, redacts its kit source and
provenance, withdraws the affected original snapshot, installs source/target
tombstones, advances the portability checkpoint, and records Base's erasure
receipt atomically. Peer asset records and their retained parsed custody survive;
the withdrawn snapshot's original bytes become unavailable for every record that
shared that artifact. A later apply or undo cannot resurrect the erased asset.
Customer source records continue to describe the retained customer register
context; this endpoint erases an unused asset, not an entire person's identity.

## Persistence

`src/modules/import-kit/src` is copied from the real Base import-kit source and
uses its Worker D1 entry point, with the sibling D1 transport and `nodejs_compat`.
Numbered migration `migrations/core/0016_import_kit.sql` is generated from the
public exports `d1Schema`, `d1ErasureSchema`, `d1StreamOriginSchema`,
`d1StagingSchema`, `d1NativeStagingSchema`, `d1CustodyStateSchema`,
`d1ReversalFenceSchema`, `d1PreparationSchema`, `d1PreparationStepsSchema`,
`d1RetirementSchema` and `d1ErasureProgressSchema`. The legacy stream receipt
upgrade is unnecessary on this fresh installation.

Native targets live in `mallet_records(kind,id,revision,value)` with kind `asset`.
The kit's opaque applied revision is bridged through
`mallet_import_revisions(kind,id,import_revision,native_revision)` so native
revisions remain integers. Exact guards cover the complete JSON value, native
revision and kit marker. Native set guards count all assets in the destination.
The domain's existing row triggers advance `mallet_meta.version` on import and
undo, as they do on ordinary native writes. Marker rows are removed when the
native row is deleted. Include the native records, marker table and all `ik_*`
custody in portability; the import journal and originals contain personal data.
