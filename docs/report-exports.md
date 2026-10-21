# Current report exports

Use an active native session to request either current dataset:

- `GET /api/mallet/reports/technicians?from=2026-10-01&to=2026-10-31`
- `GET /api/mallet/reports/turnaround?from=2026-10-01&to=2026-10-31`

The default is JSON; `format=json` is equivalent. Add `format=csv` for a CSV
attachment. Both formats use the same report projection and permissions on
every request. No export token or additional permission is created. Technician
reports give owners all rows and payroll cost, admins all rows without payroll
cost, and members only their own row without payroll cost. Turnaround reports
use existing workshop assignment/helper visibility. Agents are refused; a
revoked native session cannot download either dataset.

`from` and `to` are inclusive UTC calendar dates, each defaulting to today. The
maximum period is 366 days. Invalid dates, unsupported filters or formats, and
repeated query parameters are refused. These endpoints currently support only
`from`, `to` and `format`; they do not support a location filter. Sales exports
use a separate, installation-local date convention: see [sales-report.md](sales-report.md).

JSON technician datasets contain `period`, `generatedAt` and `technicians`.
Each technician supplies hours, ratios, counted timer intervals with retained
revisions/corrections, authorized sold labor and assignment history. Owners
also receive pay cost, unrated time and rate history. JSON turnaround datasets
contain `period`, `generatedAt`, `coverage` and `repairs`, with cycle/elapsed
time, observed stage intervals/totals, source event IDs and promise comparison.
See [turnaround.md](turnaround.md) for definitions and coverage boundaries.

CSV uses UTF-8, a header row, CRLF records and quoted fields with doubled quotes.
The fixed columns in order are `Record`, `TechnicianId`, `JobId`, `SourceId`,
`Metric`, `Value`, `Unit`, `At`, `Stage`, `From`, `To`, `Description`, `JobURL`.
Metadata records give the schema (`mallet-technician-csv/v1` or
`mallet-turnaround-csv/v1`), requested dates, UTC zone and generation time.
Definition records state coverage. These v1 layouts describe the current
exports; incompatible layouts require a new schema value.

Technician CSV records are summaries, counted timers, sold labor lines and
assignment changes. The sold-labor `SourceId` is the estimate ID and `Metric`
is its line ID; timer `SourceId` identifies the retained timer. Full revision
and correction objects remain available in JSON. Turnaround CSV records are
repair coverage, cycle/elapsed summaries, individual stages, stage totals and
promise comparisons. Stage `SourceId` identifies the retained stage observation;
promise `SourceId` identifies its retained promise. `JobURL` opens the source
repair under the reader's existing permissions. `From` and `To` on stage rows
are exact UTC timestamps, while the period metadata uses calendar dates.

Durations are integer milliseconds, sold labor is thousandths of an hour,
ratios are tenths of a percent and pay cost is integer USD cents. Blank values
mean unavailable or no denominator, not zero. Negative completion variance
remains numeric and means early completion. Text with a spreadsheet formula
prefix is prefixed with an apostrophe; embedded commas, quotes and newlines
remain inside the quoted field. CSV is a readable report export, not an import
format or a replacement for the complete product archive.

Downloads are read-only, private and not cached. Each is computed from current
native records, so live running timers can change between requests; it is not
an issued, retained financial snapshot. Restoring product history reproduces
closed-job and stopped-timer values under fresh native authority. The export
adds no new stored record class and includes no credentials.

REPORT-006 remains partial: saved filters, scheduled permission-scoped email,
XLSX, reconciled imported-history coverage and the complete location-manager
scheduling/revocation acceptance remain required. Current exports explicitly
make no migrated-history completeness claim.
