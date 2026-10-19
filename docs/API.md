# API v1 contract

Base path: `/api/v1`. Timestamps are ISO-8601 UTC. Coin amounts are serialized as decimal strings with up to six decimal places to avoid JavaScript precision loss. Product and snapshot identifiers are stable strings/integers as documented by each schema.

## Initial vertical slice

- `GET /health` — process health, independent of upstream availability.
- `GET /status` — upstream availability, last successful snapshot time, data age, and stale/degraded state.
- `GET /profile?username=` — on-demand public profile lookup; loopback only, server-side API key required, one-hour in-memory cache. Missing purse data remains null when hidden or not returned.
- `GET /items` — cached official Hypixel names/material/tier for products in the latest Bazaar snapshot.
- `GET /market/snapshot` — latest normalized snapshot metadata and product count.
- `GET /opportunities/bazaar?tax_basis_points=&capital_coins=&maximum_quantity=&minimum_weekly_volume=&sale_horizon_hours=&volume_share_basis_points=&max_data_age_seconds=` — C++ engine results with calculation assumptions, volume cap, risk flags, batch return and projected profit/hour based on the selected share of the lower weekly volume counter.
- `GET /opportunities/fusion` — applies the same trade controls to the pinned, hash-checked SkyShards recipe graph and current Bazaar ingredient/output books. Returns guaranteed output estimates and catalog provenance; chance bonuses are excluded.

Errors use `{ "error": { "code": "stable_code", "message": "safe explanation", "request_id": "..." } }`. A missing or stale snapshot must be explicit. Do not return an apparently successful empty opportunities list when calculation failed. Pagination and request sizes are bounded. The authoritative machine-readable schema is `openapi/openapi.yaml`.

Opportunity responses are capped at 100 rows. `complete` and `truncated` report whether that cap omitted additional calculated results.

`estimated_profit_per_hour_coins` applies the selected participation share to the conservative weekly volume and scales the candidate batch's net profit per unit to an hourly rate. It assumes recent throughput and this snapshot's edge persist. It is a ranking estimate; it does not predict queue fill times, guarantee that the visible book will replenish, or mean the same price can be sustained.

Coin amounts in opportunity DTOs are decimal coin strings with up to six fractional digits. The requested sale tax is applied to estimated sale proceeds only; the API requires it explicitly and does not assert a universal in-game tax rate.
