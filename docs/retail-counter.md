# Counter cash sales and returns

Open **Stock & receiving**, then **Retail cash counter**. The current owner
confirms a recent sign-in before recording a sale or return. Delegated cashier
rights are not implemented. This counter records physical USD cash; it does not
verify a bank balance or close a drawer.

Register an accessory and bin, receive its stock, and configure the shop's
sales tax. Scan or type the accessory and bin barcodes. Choose its non-serialized
stock lot when applicable; leave the lot empty only for untracked stock. The
home shop is the only supported location. Enter the quantity, unit price and
cash physically received. The receipt freezes subtotal, tax, total, cash,
change, stock source, recorder and time. It creates no repair or customer.

A unique sale reference identifies one instruction. Repeating that reference
with the same inputs retrieves its receipt without moving stock or recording
cash again. Reusing it with different inputs is refused. A new reference records
a new physical transaction, so retain the original reference when retrying.
Barcode matching ignores case. Sale instructions and receipts save barcodes in
lowercase, so a retry with different letter case still retrieves the same
receipt, including after restoring a workshop backup.

On a receipt, open **Record accessory return**. Inspect the returned accessory
as saleable, return it to the original bin and record the cash handed back with
its evidence and a unique return reference. Each return is a separate immutable
record. A repeated identical return instruction has no additional effect;
excess returns are refused. Reserved stock cannot be sold. Traced sales and
returns change the selected lot's remaining quantity.

Returns use the original receipt's price and tax even after tax settings change.
Tax allocated through each cumulative returned quantity rounds half up; the
current return receives the difference from the previous cumulative allocation.
For three 99-cent accessories at 7.5 percent, the receipt is 297 cents plus
22 cents tax. Returning one refunds 106 cents; returning the other two refunds
213 cents. Those returns total the original 319 cents exactly.

The private counter JSON report at `/api/mallet/retail` lists original sales and
returns and reconciles net recorded cash. Existing authenticated commands at
`/api/mallet/commands` accept `retail.sell` with `reference`, `itemBarcode`,
`binBarcode`, optional `lotId`, whole `quantity`, `unitCents` and `cashCents`.
`retail.return` accepts `reference`, `saleId`, whole `quantity`, `reason` and
`confirm: "saleable-cash-returned"`. Amounts are integer USD cents. Both verbs
enforce current owner authority on the server and retain private audit history.

OPS-001 archives include receipts, returns, their stock movements and audit
history. Restore validates amounts and references in private staging before
publishing records. The destination requires its own owner and confirmation;
historical recorder identity grants no access.

POS-001 retains current main’s MISSING judgment pending review of this cash-only slice. Customer credits, checks, split payments, shop-defined
tenders, opening float, cash paid in and out, cashier and location drawer close,
variance, deposit batches and daily-sales reconciliation remain held. PAY-007
and the recorded SHOP-001 location hold still apply. HARDWARE-001 requires real
printer and scanner acceptance; barcode field input is not hardware proof.
