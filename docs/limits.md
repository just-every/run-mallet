Mallet does one job: the repair bench, from booking to handover. These are the things it leaves out, so you can decide what stays where it is.

## Customers and messages

- Mallet does not email or text customers. **Record estimate shared** records how you handed the estimate over.
- There is no customer portal and no e-signature. Staff record what the customer authorised, how and the evidence.
- No reminders, SMS or calendar sync.

## Money and accounting

- No payments, card terminals, deposits or balances.
- The invoice export is a plain Mallet CSV. It is not an import for Xero, MYOB or QuickBooks, and Mallet does not post anything to your books.

## Parts and vehicles

- No parts ordering, supplier networks or stock reservation. An optional read-only Pier catalogue adapter (`GET /api/mallet/catalogue`) reads parts from your own Pier; it never reserves or orders them.
- No registration, VIN or NZTA lookups, OEM repair data, warranty claims, inspection checklists or photos.

## Moving in

- Move-in brings customers and assets from saved RepairShopr lists. Past tickets, appointments, estimates, invoices and payments stay in RepairShopr.

## Agents

- An agent only prepares estimates, revisions, dispatch plans and invoice drafts. It never approves, shares, records a customer's authorisation, records work or exports. A person decides every one.

## This release

- Erasure is for unused assets only. An asset with visits keeps its service and financial history.
- Estimate forms in the app take one part line and one labour line; longer estimates come through the command API.
