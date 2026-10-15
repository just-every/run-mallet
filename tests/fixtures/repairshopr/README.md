# Synthetic RepairShopr snapshots

Every person, address, identifier and asset in these files is invented test data.
These are fixtures only; they are never seeded into the application.

- `customers.json` follows the official `GET /customers` response wrapper:
  `{ "customers": [...], "meta": { "total_pages", "total_entries", "per_page", "page" } }`.
- `assets.json` follows the official `GET /customer_assets` wrapper:
  `{ "assets": [...] }`. Assets link by `customer_id`; an embedded `customer`
  remains original source data. The null `created_at` exercises the explicit
  epoch rule. Customer notes, asset properties and other provider fields
  exercise unmapped custody.
- `orphan-assets.json` references customer 999, absent from `customers.json`.
  Preview and apply must fail rather than invent a customer.

Shapes and provider field names were checked against RepairShopr's official
[OpenAPI document](https://api-docs.repairshopr.com/swagger.json) on 16 October
2026, under `paths./customers.get.responses.200` and
`paths./customer_assets.get.responses.200`. The [official API documentation](https://api-docs.repairshopr.com/)
describes both endpoints as paginated. No authenticated provider request was made.
