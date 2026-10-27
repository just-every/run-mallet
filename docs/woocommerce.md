# Connect WooCommerce

Open Settings → Connectors. Read the WooCommerce declaration, enrol and confirm your own second factor, and save two credentials: base64 encoding of your WooCommerce read-only consumer key, a colon and its secret; and your webhook signing secret. Credentials are sealed and never shown again. Use an HTTPS store origin. Plain HTTP is accepted only on loopback for disposable local testing.

Enable the connection and acknowledge Mallet as the native stock authority. Map a simple product ID to the native item with the same SKU and its bin. Variations and tracked lots are refused. The existing native stock ledger remains authoritative. This slice does not publish stock to WooCommerce: keep the storefront quantity reconciled explicitly in WooCommerce before accepting further orders.

Configure WooCommerce order created and order updated webhooks to `/api/mallet/woocommerce/events`, using the saved signing secret. WooCommerce sends an order updated event for line refunds. Every admitted signature triggers authenticated reads of the current order and its refund records. An old event therefore cannot roll quantities or status back. Admitted line changes, missing historical refunds, unmapped items, insufficient native stock and unsupported currencies are refused without partial stock writes. Inspect the provider order and retry its ID explicitly after correcting the cause. There is no automatic outbound retry or charge.

Observed refunds do not prove returned goods. Inspect the actual returned units, then enter the observed refund IDs in the connector's returned-goods field and read the current order again. Each approved identity restores its actual line quantities once. Partial returns retain the original order and payment reference. A provider payment status or transaction identifier never creates cash, a processor capture, settlement or a books posting.

Disable the connection or revoke either credential to stop observations. Re-enabling creates fresh enabling authority. The same exact store origin retains its product mappings and order identities, so it cannot receive old orders twice. A changed origin is a separate store identity; review its mapping before admission. Recovery retains private order, mapping, refund, audit and stock history while excluding credentials and enabling authority. A fresh owner must establish a new connection; historical identities cannot admit events.

Booking links, stock publication, broader conflict resolution and complete provider reconciliation remain unfinished under STORE-002. Existing Pier, processor and accounting holds still apply. Current-owner authority and explicit returned-goods approval are conservative defaults awaiting ct approval.

## Disposable installation journey

With Docker available, run `node tests/support/woocommerce-local.mjs` from the checkout root under a 20-minute process timeout. It provisions isolated WordPress 6.8.3 and WooCommerce 10.3.0 with MariaDB, runs both existing STORE-002 tests against the actual provider, and removes its containers, network, volume and temporary files on completion. It publishes only a loopback store port. On Linux, set `MALLET_CHROMIUM` to the installed Chromium executable when Playwright's bundled browser is unavailable. This installer journey is opt-in; push Verify retains the controlled network edge and does not install a provider.

`tests/support/woocommerce-journey.mjs` supports a real local WordPress installation with WooCommerce active and USD configured. The disposable fixture uses synthetic credentials only: one read-only key for the adapter and one separate write-capable key for creating the provider test order and manual refund. It creates a simple stocked product, a paid test order and an actual manual line-refund record with `api_refund: false`. This performs no payment-gateway refund. Its temporary HTTP receiver forwards the exact signed WooCommerce delivery to Mallet.

Run with `MALLET_WOO_ORIGIN` naming the loopback store origin, and `MALLET_WOO_GATEWAY` naming the container gateway that can reach the temporary receiver:

```sh
node --test --test-name-pattern='^STORE-002: authenticated' tests/mallet.test.mjs
```

The synthetic writer is `synthetic-mallet-consumer` with secret `synthetic-mallet-secret`. The reader is `synthetic-mallet-reader` with secret `synthetic-mallet-reader-secret`. Register their hashed consumer keys through WooCommerce's own API-key table in the disposable installation. Never use these fixtures on a real shop. Allow only the receiver's local gateway and ephemeral port in the disposable WordPress HTTP validation filters; preserve the provider's actual webhook signing and delivery code. The local HTTP fixture must mark its own request as TLS-terminated for WooCommerce Basic authentication; real stores use HTTPS. Remove the disposable installation afterward.

Without the local origin, the same retained-history and refusal assertions use a controlled network edge in push Verify. The browser journey asserts the public owner forms at 1440 and records those screens at 1440 and 390. Neither mode establishes processor or accounting acceptance.
