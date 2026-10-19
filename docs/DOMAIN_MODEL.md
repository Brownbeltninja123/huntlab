# Domain model (v1 draft)

This contract is the only source of truth for Bazaar meanings and calculation inputs. The C++ library owns business logic; adapters normalize inputs and serialize results.

## Primitive values

- `ProductId`: stable Hypixel product identifier string.
- `SnapshotId`: signed 64-bit database identifier.
- `UnixMillis`: UTC epoch milliseconds.
- `Coins`: signed 64-bit integer microcoins (one million units per coin). Hypixel Bazaar prices are coin-denominated numeric values; the parser rejects unsupported precision or unsafe ranges rather than silently rounding.
- `Quantity`: positive integer item count.

## Snapshot and product market

`MarketSnapshot` contains an ID, source (`hypixel_bazaar`), source update time when supplied, fetch start/end times, observation time, freshness, and a map of `ProductId` to `ProductMarket`.

`ProductMarket` contains the product ID; top-of-book summaries; quick-status weighted prices, active order volumes/counts, and moving-week volumes; snapshot ID; and observation timestamp. Hypixel's terminology is normalized as **buy orders** (players offering to buy) and **sell offers** (players offering to sell). Do not infer fillability for an entire batch from one summary price.

The Bazaar adapter stores `conservative_weekly_volume = min(buyMovingWeek, sellMovingWeek)` for the current bounded screen. A missing counter remains missing; it is never converted to zero trade volume.

## Execution and result

`MarketAssumptions` contains execution mode, explicitly configured sale tax in basis points, capital and reserve, maximum order-book slippage, maximum feasible quantity, and a documented conservative volume assumption. No tax rate is silently selected by the application.

`Opportunity` contains a stable ID, type, output ID, acquisition cost, gross proceeds, fees, net estimated profit, ROI basis points (optional when denominator is zero), feasible quantity, explanation steps, risk flags, confidence inputs, snapshot ID/time, data age, settings, algorithm version, calculation time, and completeness/truncation flags.

Internal numeric values and rounding semantics are explicit in the API schema. API money fields are decimal coin strings with at most six fractional digits. Missing input data is represented as absent plus a warning, never as zero-cost or zero-price.
