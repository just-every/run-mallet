# Stage delays and customer promises

Signed-in staff can download the current report as JSON:

`GET /api/mallet/reports/turnaround?from=2026-10-01&to=2026-10-31`

The existing workshop visibility applies: owners and admins see the shop's repairs, members see their currently assigned/helper repairs, and agent credentials cannot read the report. Dates select booking creation, inclusive in UTC, with the same maximum 366-day range as the technician report. Omitted dates mean today in UTC.

Each repair includes cycle time in integer milliseconds from booking creation to actual completion, or null while unfinished. Its stage intervals and totals continue through handover until both collection and invoice export, or cancellation/loss. Each interval identifies the immutable stage observation and the native business events that caused it. Event IDs resolve in the existing `/api/mallet/state` response under the same job visibility. Reads never create stage evidence.

`promise.completionVarianceMs` compares actual completion with the exact promise revision in force at completion: positive means late, negative means early, and null means unfinished. `promise.overdue` identifies an unfinished, uncanceled repair whose promise has passed. A revised promise retains its original history; it does not rewrite an earlier completion comparison.

New native bookings retain stage observations from intake. Existing repairs acquire observations prospectively; `historyComplete: false` and `observedFrom` disclose the coverage boundary. No stage durations before that boundary are invented. Stage evidence is included in ordinary workshop backups and restores under fresh native authority.

REPORT-004 remains partial. The endpoint currently covers stage delays and promise timing. Booking no-shows, DVI completion and engagement, warranty comeback rates, location comparisons and a report screen remain to be built.
