# Market Strategy Implementation Audit

Audit date: 2026-10-20. This audit covers the current Bazaar path, its storage/API/UI contracts, existing tests and fusion status. See `HUNTLAB_ENGINEERING_HANDOFF.md` for the broader product and architecture plan.

## Existing Bazaar flow

`adapters/hypixel/bazaar.mjs` validates the official response and converts `sell_summary` into ascending seller offers (instant-buy acquisition) and `buy_summary` into descending buyer bids (instant-sell disposal). The Hypixel API defines each summary as the top 30 active orders; `quick_status.buyMovingWeek` and `sellMovingWeek` are historic transacted item volume over the last seven days plus live state. HuntLab takes the lower counter as a conservative weekly item count. A missing/invalid counter becomes `null`, which the C++ engine excludes; it is not treated as zero.

`adapters/persistence/store.mjs` stores normalized price levels and weekly volume in SQLite. `core/src/bazaar_analysis.cpp` walks seller and buyer depth independently, calculates total acquisition cost and disposal proceeds, charges the requested fee on proceeds (ceiling at one microcoin), and selects the maximum total net-profit batch among feasible order-book boundaries. It filters below a minimum weekly volume and caps quantity by maximum quantity, available depth, capital, sale horizon, and participation share. ROI is net profit divided by acquisition cost. The previous change added projected hourly profit using chosen-batch net per item × lower weekly volume × participation share / 168.

`apps/server/src/server.mjs` translates the engine output to API JSON and reports snapshot age/staleness. `apps/web/public/app.js` renders the result and offers search plus sorts by coins/hour, batch profit, or ROI. Current pricing is an **immediate-execution** simulation only. No limit-order/queue-fill strategy is implemented.

## Confirmed gaps / defects

- `lastUpdated` fallback to local fetch time could make missing/invalid upstream timestamps appear fresh. The parser must reject invalid source times and retain source update time separately from local observation time.
- Snapshot content dedupe mutates its stored observed timestamp. There is no observation-event table; identical polls disappear from history, and out-of-order API responses can regress the in-memory latest pointer.
- C++ output lacks gross profit, visible acquisition/exit depth, explicit fill quantity, and binding-limit reasons. API responses therefore cannot fully explain the chosen batch.
- Freshness is reported beside results, but stale snapshots can still produce positive opportunities. The request supports a user threshold but does not apply it.
- The hourly estimate's units are correct when volume is items/week and `volume_share_basis_points` is participation share: microcoins per item × items/week × share / 168. It projects repeated turnover and does not represent observed fill speed.
- Price-change and fill-speed confidence are unsupported. Repeated book snapshots can show price/depth changes, not actual individual fills or queue completion.
- No limit-order calculation, historical trend endpoint/UI, or fusion code/API/UI exists. Fusion rules/catalog should be explicit and versioned; no chance bonus should enter guaranteed profit.
- UI controls omit freshness. API/UI do not expose constraint binding or visible depth as separate signals.

## Phase plan

1. Correct source timestamps and preserve deduplicated snapshots plus per-poll observation events. Reject stale opportunities using a bounded caller threshold. **Done:** migration 003, parser validation, source-aware latest selection, and age/completeness gates.
2. Extend the C++ result contract with gross profit, visible depth, fill quantities and binding constraint IDs. Keep immediate-execution assumptions explicit; do not add speculative limit fills. **Done for Bazaar.**
3. Add descriptive historical price/depth/volume comparisons with explicit insufficient-history states; never call observations fills. **Not implemented yet.**
4. Pin/hash/attribute SkyShards; normalize ordered edges and quantities; add deterministic C++ guaranteed-output optimizer, API and UI. **Done as the first slice:** full data-integrity checks, bounded CLI protocol, top-100 route/UI, guaranteed output only, and no probabilities.
5. Rebuild, run full C++/Node suite and review API docs/UI behavior. **Done:** two CTest executables and all 25 Node tests passed after the final changes; see `docs/STATUS.md`.

## Source semantics

Hypixel's official Bazaar docs state that `buy_summary`/`sell_summary` are current top-30 orders. `quick_status.buyVolume`/`sellVolume` count item amounts in active orders; `buyPrice`/`sellPrice` are weighted averages of the top 2% of book volume; moving-week fields are historical transacted volume from the last seven days plus live state. HuntLab uses the moving-week counters only for throughput, not as current available depth. Source: https://api.hypixel.net/.

## Implemented during this audit

- `lastUpdated` is required and stored separately from local observation time; repeated same-content polls persist observation records while snapshot content remains deduplicated.
- Bazaar results now expose gross profit, current visible depth, fill quantities, binding constraints, and a caller-controlled freshness limit.
- Fusion uses the pinned dataset hash in `docs/PROVENANCE.md`, including recipes where both input slots reference the same shard. The C++ engine consumes shared depth once at the combined required quantity.
- Remaining major work includes historical chart/trend analysis, measured fill-speed calibration, Auction House, crafting, consolidated ranking, notifications, and broader profile-based allocation.
