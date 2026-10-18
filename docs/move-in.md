Bring your customer and asset register across from RepairShopr without retyping it. You save two lists from RepairShopr, Mallet shows you exactly what it will add, and nothing changes until you approve that exact plan. You can undo it afterwards.

Move-in brings the register: customers and their assets. Past tickets, appointments, estimates, invoices and payments stay in RepairShopr. Mallet makes no call to RepairShopr and never needs your RepairShopr password or API key.

## Save the two lists

Mallet reads the responses of two RepairShopr API endpoints, saved as JSON:

- `GET /customers` returns `{"customers":[...],"meta":{...}}`.
- `GET /customer_assets` returns `{"assets":[...]}`.

Save each response whole, including the outer object, not just the list inside it. Both endpoints are paginated: Mallet reviews only the records you give it, and warns when `meta.total_pages` says there are more pages. One move-in takes up to 100 customer and asset records together, up to 128 KiB of JSON, and up to 16 KiB per record; move a larger register in several batches.

The source contract is RepairShopr's official [OpenAPI document](https://api-docs.repairshopr.com/swagger.json), checked on 16 October 2026, and its [API documentation](https://api-docs.repairshopr.com/).

## 1. Preview the move

In Mallet, open **Move in** and paste the two responses into **Customers response JSON** and **Vehicles response JSON**. Press **Dry run — preview changes**.

The dry run writes nothing. **Review this exact plan** shows how many source records were read, every asset that will be added with its customer, any rejected records, and notes on fields that do not map. It ends with a review fingerprint: a code that stands for exactly this plan.

## 2. Apply the reviewed plan

Tick **I approve this fingerprint and its listed changes.** and press **Apply reviewed import**. Mallet applies only the plan you reviewed; if either list has changed, it needs a fresh preview.

Large moves are applied in batches. The journal shows **Import progress**; if it stops part-way, press **Continue approved import**.

Keep the import job ID the journal shows. **Read the journal or undo** on the **Move in** page opens that journal again by its ID.

## 3. Undo, if you need to

The journal's **Undo this import** removes the assets the move-in added. It refuses to remove an asset that has been changed or booked into a repair since the move-in, so work you have done in Mallet is never lost. The journal and the original files are kept.

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

