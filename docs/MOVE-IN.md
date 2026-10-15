# RepairShopr customer and asset snapshots

Mallet's first move-in kit creates an asset register from saved RepairShopr
customer and asset snapshots. It does not import tickets, visits, appointments,
estimates, invoices, payments, balances, credentials or sign-in authority. Each
new native asset begins at version 1 with an empty visits list. No provider API
call is made by this kit.

The source contract is RepairShopr's official [OpenAPI document](https://api-docs.repairshopr.com/swagger.json),
checked on 16 October 2026. Its `GET /customers` response example contains
`{customers:[...],meta:{total_pages,total_entries,per_page,page}}`; its
`GET /customer_assets` response example contains `{assets:[...]}`. Both are
paginated endpoints in the [official API documentation](https://api-docs.repairshopr.com/).
Supply those response objects, including the wrapper, rather than bare arrays.
Only the supplied records are reviewed. A `meta.total_pages` above one produces
a partial-snapshot warning. This bounded first kit accepts 100 combined customer
and asset records, 128 KiB combined snapshot JSON, and 16 KiB per source record.

## Mapping and review

Every source ID and asset `customer_id` must be a positive safe integer. Asset
`customer_id` resolves against the separate customer snapshot; a missing customer
is an error. An embedded asset customer must agree with that ID. Duplicate source
IDs are rejected. Customers remain retained source records; there is no separate
native customer entity in this release. Preview and the journal expose both
source identities for each asset-to-customer link.
Duplicate asset identifiers within the snapshots or against another register
asset are rejected, using the native register's case-insensitive comparison.

| Native field | RepairShopr source |
| --- | --- |
| `id` | Deterministic `rs-` ID derived from the fixed source namespace and asset ID |
| `customerName` | Customer `business_name`, then `fullname`, then joined `firstname`/`lastname` |
| `customerEmail` | Customer `email`, or empty when absent |
| `label` | Asset `name`, required |
| `identifier` | Asset `asset_serial`, required, at most 100 characters |
| `createdAt` | Asset `created_at`, normalized to UTC; missing/null/empty uses `1970-01-01T00:00:00.000Z` |
| `version`, `visits` | `1`, `[]` |

Every original source payload is retained, including unmapped fields such as
properties, notes, contacts, embedded customer data and provider metadata.
Unmapped record fields and wrapper metadata are reported in diagnostics. No
unknown field is promoted into an active permission, message or financial record.
Base's credential policy rejects credential-bearing input, including portal URLs
with access keys; it never silently deletes credentials from an apparently exact
original.

Inputs are JSON **objects**. The exact originals retained by this interface are
the UTF-8 bytes of `JSON.stringify` of each accepted snapshot object, with its
property order and all JSON fields preserved. Original file whitespace and
numeric spelling cannot be recovered from a parsed JSON object. The two retained
artifacts are named `repairshopr-customers.json` and `repairshopr-assets.json` and
include their byte counts and SHA-256 digests. The journal returns Base's verified
base64 originals for download. Fixtures under `tests/fixtures/repairshopr` contain
only synthetic data and are never loaded as application seed data.

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
