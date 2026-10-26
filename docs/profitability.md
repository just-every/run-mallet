# Repair profitability

The owner opens **Repair orders → Repair profitability**. The report and its source JSON use `/app/reports/profitability` and `/api/mallet/reports/profitability`. Loaded labor settings live at `/app/settings/profitability`; `costRate.set` is the equivalent native command. Admins, technicians, delegated staff, customer sessions and agents receive no profitability or loaded-rate access. Loaded rates are omitted from non-owner workshop state.

The conservative access default awaits ct approval under `mallet-profitability-i918`. REPORT-002 remains PARTIAL. The existing payroll report and payroll wage records keep their meaning. This report never sends, pays, posts to accounting or destroys data.

## Basis

The inclusive UTC date range selects repairs by their booking creation date. Current later invoices, credits, corrections and warranty cases remain attached to that cohort. It is a current repair-cohort view, not a filing-period or settlement report. All amounts are USD cents; gross profit is pretax revenue less cost, and margin is gross profit divided by positive revenue, half-up to basis points. No positive revenue means no margin percentage.

Estimated revenue uses the exact customer-authorized lines after authorized supplement replacements, already net of per-unit discounts. Explicit line cost snapshots supply unit part cost and hourly estimated labor cost; a linked sublet's quoted scope cost is already a total. An ordinary fee has no direct cost unless an explicit cost or sublet supplies one. Missing estimated cost is unavailable, never silently treated as a free part or free labor.

Realized revenue requires an approved or exported invoice. Issued credit-note pretax amounts reverse revenue once; completing its refund does not reverse it again. Draft invoices and open repairs cannot establish realized gross profit. Costs can still be inspected while a repair is open.

## Source costs

- Consumed part cost is the retained `stockUse.costCents`, linked to the received lot and its original unit cost. Receiving or reserving unused inventory is not another repair expense. Inspected saleable returns reverse the cumulative proportion of that exact consumed cost, with the final return preserving the last cent.
- Reconciled supplier core and installed-part RMA credits reduce cost once. Expected credits are never counted. Customer core credits are ordinary issued credit notes, separate from supplier cost recovery.
- Sublets use only the latest bill covering every retained scope. A bill spanning multiple scopes is allocated cumulatively by scope quantity, retaining its bill revision and source amounts. Customer sublet charges remain invoice fee lines and are never added twice.
- Job timers use their latest approved revision, including billable, nonbillable and rework categories. Each interval uses the owner's declared loaded hourly cost effective on its UTC start date, half-up to cents. Running intervals and missing rates make realized cost incomplete. Attendance and idle wages are not invented as repair hours. Job labor cost is allocated cumulatively across recorded labor quantities; unallocated job time remains explicit.
- Loaded cost is an owner-declared full hourly amount with a required basis and reason, including the owner's chosen wage and burden components. Dated revisions remain immutable; greatest effective date wins, latest save on ties. Future dates never apply early. A dated correction can recompute historical costs while retaining every earlier rate revision.
- Explicit warranty actual costs replace the stock or allocated timer cost for those same actual quantities. Only a credited warranty claim outcome reduces cost. If an RMA and warranty claim could duplicate recovery, the cost is unavailable until reconciled; no matching or duplicate reduction is guessed.

Every cost event retains its source identity, amount and relevant received cost, bill revision, rate, timer history or warranty evidence. The report links each contributing repair and its sources. Reads create no product records.

Original repair adjusted profit includes the linked comeback's net cost, including its own revenue and recorded recovery. Cohort totals count each repair once; the adjusted original is a comparison, not another expense in totals.

Comparisons cover repair, line category, technician, advisor, exact service description and supplier. Advisor means the original booking recorder. Non-timer attribution uses the current lead; actual timer costs use the timer owner. Sales use a unique linked lot, sublet or core supplier where known; mixed or unlinked supplier sales remain explicitly unattributed. This is not an allocation of an ambiguous supplier margin.

## Remaining scope and recovery

Multiple locations require SHOP-001 and are not available. Purchase freight and supplier tax are not apportioned to parts. Mixed-supplier sales apportionment and complete historical service-package attribution are not claimed; service grouping currently uses retained line descriptions. Finer cost permissions remain GOV-001. These limitations and the pending access ruling keep REPORT-002 PARTIAL.

OPS-001 archives retain loaded cost revisions, original cost sources, credits, timer corrections and warranty evidence. A fresh native owner recomputes the same report; archived actors and original sessions confer no destination authority. Invalid loaded-rate records are refused during private archive staging.
