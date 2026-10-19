# Architecture

## Boundaries

1. **Hypixel adapter:** owns HTTP, timeout/retry policy, payload validation and normalization. The collector is centralized per server process, not triggered per browser user.
2. **Domain/analysis core:** owns strongly typed market values, pricing rules, conservative feasibility, opportunities and explanation steps. It must not include HTTP, JSON, database, or UI dependencies.
3. **Persistence adapter:** owns SQLite schema, migrations, transaction and retention behavior.
4. **Application service/API:** orchestrates refresh, persistence, analysis and serialization. REST handlers do not recalculate economics.
5. **Web app:** consumes API types, formats and presents server-calculated values, and makes freshness/assumptions visible.

## First deployment shape

One Node.js server process and one SQLite database. The server owns the poll loop and REST API, and invokes the standalone C++ analysis CLI through a bounded versioned protocol. The HTML/CSS/ES-module UI is served by the same process. Avoid a distributed service layout until a measured scale requirement exists.

## Vertical slice data path

Hypixel Bazaar → typed parser/validator → normalized `MarketSnapshot` → SQLite transaction → C++ opportunity service → REST DTO → responsive table/detail panel.

## Failure and stale-data behavior

On timeout, malformed payload, 429, 5xx, or Hypixel 503, bound retries and preserve the latest valid snapshot. Mark its freshness stale and return that state with the data. A persistence error must not publish a new snapshot as current. Log structured error categories without secrets.
