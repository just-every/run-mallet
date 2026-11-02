# Supplier ordering gateway v1

Mallet can contact a shop-authorized HTTPS gateway implementing this contract.
This adapter does not provide PartsTech, Nexpart or Worldpac licensing; their
named BUY clauses retain those separate obligations. Test journeys replace only
the network edge. No live supplier proof or production eligibility is claimed.

The owner sets `MALLET_SUPPLIER_ORIGIN` to a bare HTTPS origin and manages
`MALLET_SUPPLIER_KEY` through the existing owner-only connection declaration and
sealed-key screen (or a private deployment binding). Never put a key in a URL,
product record, fixture or archive. Requests use a Bearer header; redirects are
refused, responses are bounded to 128 KiB and requests time out after eight
seconds. The gateway must deduplicate all POSTs by `idempotency-key` and preserve
client-reference lookup. The owner must have authority to send the ship-to
address to this supplier. Compare sends only SKU, unit and quantity.

`GET /v1/quotes?sku=...&unit=...&quantity_milli=...` returns `offers` (1–50).
Each offer contains `quoteId`, `supplierId`, `supplierName`, `grade`, boolean
`compatible`, `availableMilli`, `quantityMilli`, `unitCents`, `freightCents`,
`taxCents`, `currency: "USD"`, and ISO times with a zone: `observedAt`,
`cutoffAt`, `etaAt`, `expiresAt`. Compatibility is the supplier's assertion for
the requested catalog SKU/unit, not an OEM fitment certification. Quantity uses
integer thousandths, money integer cents and extended costs round half-up.
Mallet computes the exact total. Expired, past-cutoff, incompatible or
insufficient quotes cannot be approved or submitted. A comparison creates at
most one cart, linked to its repair when supplied.

`POST /v1/orders` receives `clientReference` (the stable Mallet purchase ID),
`supplierId`, `quoteId`, `currency`, `totalCents`, `shipTo` and `lines`. Each line
contains `sku`, `grade`, `unit`, `quantityMilli`, `unitCents`. The request is
claimed durably before sending and carries `mallet-supplier-order-<purchase ID>`
as its idempotency key. A concurrent/replayed or uncertain claim never POSTs
again: it uses `GET /v1/orders/<clientReference>`. A gateway must retain this
lookup even after rejection or cancellation; a missing lookup stays uncertain
and never authorizes a new order automatically.

An order response contains the exact `clientReference`, `supplierId`, `quoteId`,
`currency`, `totalCents`, `lines`, a stable `orderId`, and `status`:
`acknowledged`, `substitution`, `rejected`, or `cancelled`. A substitution also
contains `proposal: {id, sku, grade, unitCents}`. The original cart must still be
returned unchanged; the proposed replacement is separate and is never approved
implicitly. Mismatched scopes, prices, changed order IDs, oversized/invalid
responses and transport errors remain visible as uncertain outcomes. Receiving
requires a current exact acknowledgment. Rejected/cancelled orders do not
supply replenishment demand; all observations remain in history.

After separate explicit human review,
`POST /v1/orders/<clientReference>/actions` receives `clientReference`,
`actionId`, `action` (`cancel` or `reject-substitution`) and optional
`proposalId`. It uses `mallet-supplier-action-<action ID>` as its idempotency key
and returns an order response with `actionId`. Repeat/uncertain actions use GET
only. Cancellation is confirmed only by a `cancelled` provider outcome.
Rejecting a substitution never accepts a replacement or alters the original
spend. A gateway may retain the original acknowledged order after rejection.
A different cart requires a new comparison and approval; staff must first
reconcile the earlier purchase to avoid duplicate buying. No automatic retry,
provider switch, stock receipt, payment or accounting posting occurs.

Quote, cart, approval, claim, outcome and action history travel in product
archives; keys and sessions do not. Restored claimed submissions/actions are
lookup-only. Owners/admins can review recovery and explicitly request another
lookup through the native screen. BUY-003/004/005 and future supplier adapters
inherit exact approval, idempotency, custody and honest outcome requirements;
GOV-001 retains finer purchaser roles and limits, BOOKS-003 connected posting.
