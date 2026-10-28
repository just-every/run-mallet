# Location command foundation

Additional locations are currently managed through the signed-in command API at
`/api/mallet/commands`. The native Staff roles and limits screen lets the owner
select one saved location for a bounded staff grant. Location configuration and
consolidated reporting screens remain unfinished.

Only the current owner with fresh privileged-action confirmation may save a
location, assign a bin or transfer a vehicle repair. Existing staff limits and
separate cost rights continue to apply. Staff may read and mutate records in
their granted location only; the part catalog is shared within the installation.
Restoring an archive preserves product history but restores no staff grants.

Send JSON with `command` and an `input` object:

| Command | Input and behavior |
| --- | --- |
| `location.save` | Supply `code`, `name`, two-letter US `state`, IANA `timeZone`, `invoicePrefix`, `ratePercent`, boolean `partsTaxable` and `laborTaxable`, `merchantReference`, `ledgerReference`, `reason` and `hours`. Updates also require `id` and the exact `version`. |
| `location.bin` | Supply `binId`, its exact `version`, `locationId` and `reason`. Only unused bins may be assigned; physical stock moves through the existing traced transfer commands. |
| `location.transferRepair` | Supply `jobId`, its exact `version`, `assetVersion`, destination `locationId`, `bayId`, `technicianId`, `reason`, custody `evidence` and `confirm: "transfer-repair"`. The destination must be free. Only an unestimated booked repair with no stock reservation or another open vehicle visit can move. |
| `location.metrics` | No input fields. Returns original-shop and additional-location groups plus their consolidated totals in integer USD cents. |

`hours` contains seven entries beginning with Sunday. Use `null` for a closed
day, otherwise an object with integer `open` and `close` minutes since local
midnight. Opening precedes closing; closing may equal 1440. These are saved
settings, not an enforced appointment availability policy yet.

`asset.create` accepts a saved `locationId`. `job.book` inherits the asset's
location and refuses a different location. Use the existing owner-controlled
customer account and asset-link commands to record household identity; they
confer no additional staff access. Explicit shared-customer permission management
and complete active-repair transfer remain unfinished.

A repair snapshots local tax and operational settings when booked. Its estimate
uses that snapshot; its immutable invoice keeps the location and a separate
sequence under the saved prefix. A location used by a repair cannot change its prefix.
Earlier repairs retain their settings when the location configuration changes.

Consolidated metrics include approved and exported invoices less issued credit
notes exactly once. They describe recorded revenue, not settlement, collected
cash, tax filing or all existing report dimensions. Existing report screens
still need location comparisons.

Merchant and ledger references are private owner declarations, never credentials
or verified provider connections. Additional-location collection and direct
processor verification refuse until merchant routing is implemented. Customer
credit and deposit allocation cannot cross location ledgers. No provider or
legal acceptance is claimed. The conservative authority policy awaits ct review
under `mallet-locations-f5`; SHOP-001 remains PARTIAL.
