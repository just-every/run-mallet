# Sales and customer decisions

Native owners and admins can download a read-only report using their existing
session at `GET /api/mallet/reports/sales`. Members and preparation agent keys
cannot read a whole-shop sales report. No new access role is introduced.

Use `from=YYYY-MM-DD&to=YYYY-MM-DD` for 1–366 inclusive calendar days. Both dates
default independently to today in the installation's configured shop time zone
(`America/New_York` until changed). The returned period names that IANA zone.
Calendar dates follow the zone's daylight saving rules rather than a fixed UTC
offset. Only `location=installation` is available today. Unknown, duplicate,
invalid or unsupported filters are refused instead of silently broadening the
report. The report always uses USD.

The default response is JSON with schema `mallet-sales-report/v1`. Add
`format=csv` to download the same definitions, summary and source records as one
CSV document. Monetary columns named `Cents` are integer cents; an empty CSV
ratio or a JSON `null` means there is no denominator, not a zero percent result.
Text beginning with a spreadsheet formula prefix is escaped in the CSV.

Completed vehicle count means completed/invoiced repair orders dated by their
retained completion timestamp; a repeat visit is another repair, not a second
unique vehicle. It includes completed repairs without an approved invoice.
Pretax sales include only immutable invoices that a person approved or exported
on those completed repairs, after recorded line discounts. Sales tax and gross
invoice totals are separate. ARO is pretax sales divided by the number of
completed repairs with an approved/exported invoice, half up to whole cents.
The report separately names completed repairs missing an approved invoice.
Open, canceled and lost repairs and draft invoices contribute no sales. Invoice
export and repeated download never create another sale.

The decision cohort uses each customer authorization's original timestamp and
exact estimate revision. A decision is accepted when it authorizes at least one
line; the approval ratio divides accepted decisions by all decisions, expressed
in tenths of a percent, rounded half up. Each supplement is a separate decision.
Authorized and declined values are original pretax line values, including
retained decisions on repairs later canceled or lost. Later replacements do not
rewrite those earlier decisions. These values are authorization history, not
realized sales, cash collected or processor settlement.

Every completed repair and decision supplies a source repair link. Invoices
include their ID, number, revision and totals; decisions include the estimate
ID and revision, timestamp, recorder, method and exact authorized and declined lines.
The CSV contains those same repair and line references. Totals derive from the
current product archive without new records, credentials or side effects, so
restoring the source product history reproduces the report under fresh native
authority.

Issued credit notes reduce the original completed repair's pretax sales and tax
once. Pending and completed refund states are disclosed, but refund completion
never deducts the credit twice. Full credit excludes that invoice from the ARO
denominator and the completed car count; original sources stay in the report.
Adjustments are cumulative as of the read, attributed to the repair's completion
period, rather than a cash-basis filing-period calculation.

The close funnel uses root estimates prepared in the selected period as its
cohort, following current outcomes. Approval and close divide by estimated
repairs, completion by approved repairs, and collection by completed repairs.
A repair is closed only when collection is recorded and its invoice exported.
Each stage includes the source repair, root estimate and decision revision.
Booking recorders are compared as accountable advisors until GOV-001 ships
finer attribution. Their sales and funnel use the same definitions and expose
their source repairs. This report does not disclose private refund instructions.

REPORT-001 and REPORT-007 remain **partial** for SHOP-001 multiple-location reporting. There
is no destructive invoice void operation: issue a full credit using PAY-005.
This is not a settlement report or a completed tax return.
