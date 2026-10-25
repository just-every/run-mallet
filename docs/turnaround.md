# Stage delays and customer promises

Signed-in staff can download the current report as JSON:

`GET /api/mallet/reports/turnaround?from=2026-10-01&to=2026-10-31`

The existing workshop visibility applies: owners and admins see the shop's repairs, members see their currently assigned/helper repairs, and agent credentials cannot read the report. Dates select booking creation, inclusive in UTC, with the same maximum 366-day range as the technician report. Omitted dates mean today in UTC.

Each repair includes cycle time in integer milliseconds from booking creation to actual completion, or null while unfinished. Its stage intervals and totals continue through handover until both collection and invoice export, or cancellation/loss. Each interval identifies the immutable stage observation and the native business events that caused it. Event IDs resolve in the existing `/api/mallet/state` response under the same job visibility. Reads never create stage evidence.

`promise.completionVarianceMs` compares actual completion with the exact promise revision in force at completion: positive means late, negative means early, and null means unfinished. `promise.overdue` identifies an unfinished, uncanceled repair whose promise has passed. A revised promise retains its original history; it does not rewrite an earlier completion comparison.

New native bookings retain stage observations from intake. Existing repairs acquire observations prospectively; `historyComplete: false` and `observedFrom` disclose the coverage boundary. No stage durations before that boundary are invented. Stage evidence is included in ordinary workshop backups and restores under fresh native authority.

Open `/app/reports/turnaround` for the same scoped report, appointment attendance observations and source-event drill-through. The report has fixed inclusive UTC period filters and CSV and XLSX downloads.

Booking attendance is an immutable current-owner observation after a confirmed appointment starts; unknown attendance is excluded from the no-show denominator. DVI completion uses the latest recorded result for each point on assigned snapshots in the booked-repair cohort. Engagement is reviewed reports with at least one page request, with repeated requests counted separately and no verified-human claim. Comebacks count completed repairs in the booked cohort with at least one retained warranty case, including later cases; multiple cases count the original repair once. Ratios use half-up tenths of a percent and absent denominators remain unavailable. The native report retains existing job visibility; members receive no appointment, report-view or warranty custody. Location comparison remains SHOP-001.

Native stage waits, promises, observed booking no-shows, DVI completion, page-request engagement, warranty comeback rates and report drill-through now ship. Older stage history remains explicitly incomplete; location comparison is still SHOP-001. Conservative attendance-custody default awaits ct mallet-reporting-i797: current-owner-only immutable observation, no inferred no-show, no automatic charge or message, and existing private staff read scope. REPORT-004 remains PARTIAL pending that ruling and location comparison.
