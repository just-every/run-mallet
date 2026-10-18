Mallet runs the repair bench today, from booking to handover: the register, estimates with each line's authorization, recorded work and one invoice. The homepage shows the whole shop Mallet is being built to run, and the [Mallet contract](https://run-mallet.com/contract) lists every part of it with its progress. Until a part lands, this is how this release handles it, so you can decide what stays where it is for now.

## Customers and messages

- Today Mallet does not email or text customers. **Record estimate shared** records how you handed the estimate over.
- There is no customer portal or e-signature yet. Staff record what the customer authorized, how and the evidence.
- Reminders, SMS and calendar sync are not in this release.

## Money and accounting

- Payments, card terminals, deposits and balances are not in this release.
- Prices and invoices use USD. The owner enters the shop's sales tax percentage in setup or `/app/tax` and chooses whether parts and labor are taxable; parts default to taxable and labor to exempt. Mallet does not look up state or county rates.
- Line subtotals and sales tax round to cents. Each estimate revision freezes its tax rate and treatment, and its invoice uses that saved rate even if the shop later changes its settings.
- The invoice export is a plain Mallet CSV. It is not an import for QuickBooks Online or Xero, and Mallet does not post anything to your books yet.

## Parts and vehicles

- Parts ordering, supplier networks and stock reservation are not in this release. An optional read-only Pier catalog adapter (`GET /api/mallet/catalogue`) reads parts from your own Pier; it never reserves or orders them.
- VIN and plate decoding, OEM repair data, labor guides, warranty claims, inspection checklists and photos are not in this release.

## Moving in

- Move-in brings customers and assets from saved RepairShopr lists. Past tickets, appointments, estimates, invoices and payments stay in RepairShopr.

## Agents

- An agent only prepares estimates, revisions, dispatch plans and invoice drafts. It never approves, shares, records a customer's authorization, records work or exports. A person decides every one.

## This release

- Erasure is for unused assets only. An asset with visits keeps its service and financial history.
- Estimate forms in the app take one part line and one labor line; longer estimates come through the command API.
