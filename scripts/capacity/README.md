# Native capacity fixture and import journey

This is **test tooling**. It streams a genuine version-2 Mallet native archive,
using the schema, column inventory, migrations and excluded-table inventory from
a genuine native export of an empty installation. Production contains no sample
customers or media. The generator never creates identities, credentials, scoped
customer links, approvals, actual work, invoices or payment evidence.

The complete OPS-002 declaration is ten shops, each with 30,000 customers,
40,000 vehicles, 8,000 repair orders per year over seven years (56,000 per shop),
25 photos and one short video per RO, 2,500 stocked SKUs and 30 concurrent native
staff sessions. Installation totals are 300,000 customers, 400,000 vehicles,
560,000 ROs, 14,000,000 photos, 560,000 videos, 25,000 SKUs and 300 staff sessions,
plus 50 open customer links. Search p95 is 500 ms (first page <=50), board and RO
open p95 are 1 s, board propagation is 2 s, photo acknowledgement is 1 s after
the last byte (photos <=8 MiB). Due/restart job deadlines are five minutes.

**Ten shops remain unsupported:** the product has no shop identity/isolation
model. `--shops 10` refuses with that reason instead of adding ignored shop
fields. This fixture and its successful import do not prove OPS-002 capacity.

Export an empty installation through native `rer export`, then generate:

```sh
node scripts/capacity/generate.mjs --template /path/empty.rer --output /path/synthetic-smoke.rer
node scripts/capacity/generate.mjs --template /path/empty.rer --output /path/synthetic-one-shop.rer --scale single-shop --shops 1
```

Default `smoke` has six customers, eight vehicles, ten ROs, one photo and one
video per RO and five stocked SKUs. `single-shop` uses the exact per-shop record
and media counts above. Each customer has one native contact and payer account;
vehicles link to accounts and carry bidirectional RO visit references. ROs are
historical cancellations before authorization, with empty actuals and no
fabricated decisions. Thus these are volume fixtures, not proof of typical
completed-RO/estimate/inspection/decision query performance. Stocked SKU records
have no fabricated stock receipts/balances. No live sessions or customer links
are generated. Search projection rows come from the product's own pure helper.

Photos repeat the genuine synthetic PNG in `tests/fixtures/dvi/front-brake.png`;
videos repeat the genuine one-second silent WebM in that directory. Every item
has its own finding, immutable upload metadata, client alias, 64 KiB chunks,
chunk digests and completed whole-file digest. There are no placeholder or
missing media bytes. The adjacent `.report.json` records exact fixture byte
sizes and total raw media bytes; this repeated content does not establish an
8 MiB upload latency result. At full single-shop counts the existing 1.8 MB PNG
means roughly 2.53 TB of raw photo bytes, before base64/archive overhead. Do not
run the full generator casually. No full-scale run is claimed here.

Output is created exclusively with mode 0600 and never overwrites an existing
file. Inventory planning is one bounded pass, output is a second deterministic
pass; only a part (<=1 MiB and <=250 rows), one source record and the two shared
media fixtures are held at a time. Counts and native schema/content/part/archive
checksums are produced by the pinned Base portability implementation. The
original native source identity, erasure journal and epoch are replaced with an
explicit synthetic fixture identity and empty synthetic journal. Source
installation credentials are never included.

Import into a separately configured **empty test installation** using the
normal native import command:

```sh
rer import --input /path/synthetic-smoke.rer --yes
```

For an already authenticated public HTTP test driver,
`importCapacity(lines, request, {laterJournal, onProgress})` from `import.mjs`
streams the native create/part/finalize routes. `request(path,{method,body})`
must supply the destination's fresh native owner session and same-origin
headers; credentials stay in that caller. There is no database insertion path,
auth bypass or relaxed checksum/graph validator. The native import refuses a
populated destination and preserves erasure freshness rules.

`tests/support/capacity-import-journey.mjs` exports one public HTTP journey for
the main test file to register. A small coherent fixture restores and its media
bytes remain readable. Six fully rehashed archives prove that unknown record
kinds, invalid RO status, dangling RO/asset/payer/media relationships and
corrupted media bytes are refused without publishing business records.

Remaining proof requires real ten-shop identity/isolation, full declared
historical graphs and live authorization contexts, the exact candidate SHA,
server request timing logs and p95 aggregation, concurrent native sessions,
photo progress/last-byte timing, other-board propagation and real scheduled job
restart/failure/replay outcomes. No performance result is inferred from this
smoke import.

Staged graph validation keeps memory bounded, but native Base finalization still
re-verifies every part in one invocation. Complete-media validation also performs
a bounded cursor read for each upload/chunk. Total SQL work grows with the
dataset; this is not proof that a full media archive fits one hosted Worker
invocation's query/time limits. Resumable finalization needs separate runtime
work before claiming this complete declared-capacity import.
