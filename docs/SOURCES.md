# Source provenance

Mallet was composed from the generated Base foundation and converted to the pinned `@runeditrun/rer` **0.2.22** package. The Base source pin is [`c7cb0613120074c5ffca63f610533802afbda6bd`](https://github.com/runeditrun/base/tree/c7cb0613120074c5ffca63f610533802afbda6bd). The foundation supplies native owner/operator auth, Worker/D1 runtime, setup, owner-account deployment, portability and erasure/import infrastructure. Mallet supplies the workshop records, repair workflow, forms and policy. Foundation scaffolding alone is not product acceptance.

The workshop direction and sibling references come from the dated **16 October 2026, FOURTH-TEN section 4** decision. The implementation uses these sources as patterns; their presence is not a claim of interchangeable APIs or a verbatim fork of each module.

| Source | Pinned implementation | Mallet use |
| --- | --- | --- |
| Glove | [`quotes.ts`, `1b13d601922a3d9d0e0ddd149bef21f166862973`](https://github.com/just-every/run-glove/blob/1b13d601922a3d9d0e0ddd149bef21f166862973/src/glove/commands/quotes.ts) | Exact-revision preparation, person approval and frozen customer authorisation. |
| Glove | [`dispatch.ts`, same pin](https://github.com/just-every/run-glove/blob/1b13d601922a3d9d0e0ddd149bef21f166862973/src/glove/commands/dispatch.ts) | Review conflicts before assigning a bay/technician. |
| Glove | [`invoices.ts`, same pin](https://github.com/just-every/run-glove/blob/1b13d601922a3d9d0e0ddd149bef21f166862973/src/glove/commands/invoices.ts) | One saved invoice export. Mallet's CSV has its own generic columns; Glove's Xero columns do not establish Mallet compatibility. |
| Gasket | [`assets.ts`, `886a7d635e74cf08be5f7ebd0ba8588548af01b9`](https://github.com/just-every/run-gasket/blob/886a7d635e74cf08be5f7ebd0ba8588548af01b9/src/gasket/assets.ts) | Versioned asset register. |
| Gasket | [`history.ts`, same pin](https://github.com/just-every/run-gasket/blob/886a7d635e74cf08be5f7ebd0ba8588548af01b9/src/gasket/history.ts) | Whole-asset visit history and CSV. |
| Pier | [`catalogue.ts`, `6397c1dc15232a83e0c770f8b67c1fe74c5c3dd5`](https://github.com/just-every/run-pier/blob/6397c1dc15232a83e0c770f8b67c1fe74c5c3dd5/src/pier/catalogue.ts) | Optional external parts catalogue, without forking inventory. |
| Barrow | [`pier.ts`, `576c6dce7939aea2f1c4874ec6395cc7cb2e8405`](https://github.com/just-every/run-barrow/blob/576c6dce7939aea2f1c4874ec6395cc7cb2e8405/src/barrow/pier.ts) | Read-only connection pattern for an owner-run Pier. |

RepairShopr snapshot mapping is documented in [MOVE-IN.md](MOVE-IN.md). Mallet's policy and import adapter live in `src/mallet/archive-policy.mjs` and `src/mallet/imports/`; native Base services own the underlying journal, transfer and erasure machinery. Base's sharded CI template supplies the foundation workflow; a template is not evidence of Mallet release acceptance.

Market comparisons, name checks and private build/review evidence stay in the parent evidence workspace. This public repository does not need a copied market-research directory or pricing claims.
