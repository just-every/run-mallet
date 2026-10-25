# Stripe invoice collection

The current owner saves the workshop's private Stripe key under Connectors,
reads and acknowledges declaration version 2, then opens Stripe merchant
connection. Connection checks the authenticated account's US country, USD
settlement currency and actual Stripe mode. Test mode is accepted only in a
local or demo installation. No credential is returned or included in archives.

Open an approved repair invoice, then **Collect payment with Stripe**. Confirm
the exact outstanding USD balance and the hosted method with a freshly proved
enrolled second factor. Mallet records the operation before asking Stripe for
one Checkout Session. Open the resulting hosted checkout for the customer.
While checkout is unresolved, other tender and invoice credits are refused so
the hosted amount cannot become stale. Explicitly expire or reconcile it first.
Card numbers, CVC and bank credentials are entered on Stripe and never pass
through Mallet. This creates no automatic outbound charge or customer message.
An uncertain request remains stopped for owner inspection in Stripe; Mallet
never automatically repeats it. If the dashboard shows an existing Session,
inspect its identifier in Mallet: matching metadata and amount recover that
session with a read only request. An open session can be explicitly expired.

After payment, reconcile the Stripe event identifier from the merchant
Dashboard on that invoice's payment screen. Mallet retrieves the event using
the merchant key and independently reads its current PaymentIntent and charge.
Metadata must bind the exact invoice revision and checkout, and captured USD
amounts must match. Processing ACH receives no payment allocation. Duplicate
and reordered event identifiers retain one allocation per processor payment.
A redirect from Checkout alone never marks the invoice paid.

Reconcile fees after Stripe exposes the charge's balance transaction. Mallet
retains the exact gross, fee and net contribution to the Stripe balance.
Optionally provide an automatic payout identifier: Mallet verifies that the
charge transaction belongs to that payout and records its status, batch total
and expected arrival. The payment's net contribution can be smaller than the
whole payout. A provider status does not establish receipt by the bank. Manual
payouts have no supported transaction-membership proof in this door.

These records inherit native export and fresh-owner restore. Old connection
history grants no provider authority to the destination owner, who must connect
again. Hosted checkout URLs are fetched for the current owner, not archived.

The same invoice screen prepares an exact card-present PaymentIntent and sends
it, once, to the merchant's WisePOS E, S700 or S710 smart reader. Reader
acknowledgment is shown separately from payment confirmation. Inspecting a
stopped action only reads its existing payment and reader. Explicit cancellation
has separate durable claims for clearing the reader and canceling uncaptured
funds; a captured payment uses the refund door. No reader action or payment
creation is automatically retried. Card-present settlement uses the same
invoice, authenticated event and fee reconciliation rules as hosted checkout.

PAY-001 remains PARTIAL. Physical reader deployment, ACH returns and disputes, signed
webhook delivery, bank receipt and the sandbox legs named in the contract Gap
remain unproved. PAY-005 inherits webhook transport; MONEY-001 inherits disputes
and payout close; BILL-001 inherits recurring agreement authority. None may
reuse this explicit invoice checkout as permission for an automatic charge.

The committed held-key journey is `./tests/stripe-sandbox.mjs`. It creates its
invoice and checkout through native authenticated doors, enters Stripe's public
test card only on the hosted page, reconciles the provider event twice, reads
real fees, probes hosted ACH and cleans up open sessions and payment value.
Stripe has no per-payment deletion API: completed test charges remain in its
transaction history after refund. No broad test-data deletion is attempted on
the shared account. The command must receive only test credentials from the
fleet injector and run through heavy-slot.

The independent real Terminal journey is `./tests/stripe-terminal-sandbox.mjs`.
It creates a temporary test location and simulated reader, uses the native owner
doors to bind and send the invoice payment, presents Stripe's default simulated
card, reconciles the event exactly once and reads fees. It cancels unfinished
actions, refunds captured test value and deletes its own reader and location.
