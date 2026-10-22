# Counter performance and capacity

OPS-002 remains partial. Its declaration is unchanged: ten shops, each with
30,000 customers, 40,000 vehicles, seven years of 8,000 annual ROs, 25 photos and
one video per RO, 2,500 stocked SKUs and 30 concurrent staff sessions, plus
50 open customer links installation-wide. No result on a small fixture proves
those capacity or p95 requirements.

`GET /api/mallet/accounts` returns `{accounts,nextCursor,total}` with at most
50 matching accounts. Search covers names, contact email/phone digits and linked
vehicle labels/plate/VIN, including merged aliases. Native SQL-maintained search
documents and trigrams avoid loading repair history for the API. Opaque cursors
bind the query and installation revision; account names sort with SQL NOCASE and IDs break ties; a changed revision refuses stale
paging instead of skipping or repeating rows. Owner/admin authority is checked
on every page. Native account pages have next-page links, but their editing
selectors still load the full contact/vehicle register.

`GET /api/mallet/repairs/:id` reads an indexed, version-fenced single-repair graph
with authorized lines, inspections and decisions. Current crew authority applies
to each referenced visit. Oversized graphs refuse explicitly rather than silently
truncating history. The native repair-editing page still uses complete state for
its catalogs, availability and correction controls; it has not been replaced by
this narrower read graph.

An open native board checks a small authenticated revision endpoint every half
second while visible. A changed version fetches the current board projection and
updates stage columns and bays. It preserves the actual filter form, draft text,
selection, focused card, scroll and selected repair panel. Stale exact-version
approval forms remain intact and retain the server's existing conflict fence.
An unavailable update connection is shown on the board; ordinary polling resumes
when it recovers. Historical counts, focused stages and pending-agent work remain
complete. The board still builds from installation-wide state.

Search, board, revision, RO-open and photo-completion responses include
`Server-Timing: mallet;dur=...`. Matching Worker JSON request logs contain only a
fixed route class, method, status and server duration; no query, customer ID,
private token or credential is logged. Photo completion timing ends when the
server returns its whole-file verification/acknowledgment response.

The [capacity tools](../scripts/capacity/README.md) stream genuine native archive
parts and enter through the normal import door. Checksums remain mandatory.
Private staged validation checks record/reference graphs, financial source
snapshots, exact search projections, media metadata/chunks/digests and job
recovery authority before publication. Memory is bounded, but native finalization
still processes all parts in a single invocation. Legacy schema bridging also
requires Base to pass migration replay into its HTTP portability wrapper; the
current wrapper rejects an older schema before the product hook is reached.

Remaining work includes shop identities/isolation, complete declared-volume
history/media and active sessions, resumable full-volume import, bounded native
board/repair/account editing reads, and exact-candidate concurrent workload
measurements for every stated p95 and due/restart deadline. The existing media
upload-progress UI is retained; an 8 MiB final-byte acknowledgment at declared
capacity has not been measured.
