# Bazaar screening and batch sizing

## Evidence from existing calculators

The reviewed open-source [Hypixel Bazaar Flipper](https://github.com/julesgtz/hypixel-bazaar-flipper) (MIT) uses weekly volume and liquidity when screening. [HaedenB's Bazaar Flipper](https://github.com/HaedenB/bazaar-flipper) estimates a user's throughput share from the smaller of weekly buyer/seller volume, filters low-volume and empty books, caps size to visible depth, and labels whale-dominated, thin, or unusually wide books; its GitHub repository does not declare a license, so HuntLab uses it only as a behavior reference. [Bazaar Calc](https://github.com/Goofythesecond/bazaar-calc) (MIT code, with separately attributed CC BY-NC-SA wiki-derived facts) additionally describes historical fill-speed calibration and manipulation checks. Those approaches are useful design evidence, not independently validated guarantees. HuntLab does not copy their code or data.

## Implemented estimator

For each product, HuntLab derives `conservative_weekly_volume = min(buyMovingWeek, sellMovingWeek)`. Products with missing volume data or less than the user-selected minimum are omitted. Feasible quantity is bounded by all of:

1. User maximum batch.
2. Affordable acquisition depth and available capital.
3. Executable acquisition and disposal depth in the current top-30 summaries.
4. `floor(conservative_weekly_volume × sale_horizon_hours / 168 × volume_share)`.

Among feasible quantities, the C++ engine checks book-level boundaries and returns the quantity with the highest estimated total net profit. This is an optimizer under the selected assumptions, not a universally perfect quantity: weekly volume is aggregate activity, not guaranteed available demand, and it does not say when orders will fill.

Risk flags report a small visible book, a single order dominating a side's visible depth, and an immediate spread above 50% ROI. These flags are warnings, not proof of manipulation and not automatic exclusions. The minimum-volume gate is the hard filter; the share cap is the throughput constraint. User controls and formulas are returned by the API so results remain auditable.

## Known data gap

Historical snapshots and observed order episodes are not yet analyzed. A future phase can estimate per-side fill speed from repeated observations, blend it with weekly counters, add trend/manipulation checks, and test calibration against manually recorded fill outcomes. Until then, estimates must be treated as uncertain and all trades remain manual.

## Coins per hour and ranking

The Bazaar Meta [flips page](https://www.skyblock.bz/flips) describes its headline as maximum coins/hour from the previous week's instant buys and sells, assuming the user can buy the estimated insta-buy volume. This makes throughput-adjusted return a useful summary, but the site currently rendered `0 Options` in the inspected session, so its live table fields and actual filters were not observable. HuntLab does not scrape its results or copy its implementation.

HuntLab now returns both the best feasible one-time batch and `estimated_profit_per_hour_coins`. The rate is:

```text
(net profit for chosen batch / batch quantity)
× conservative weekly volume
× configured participation share
÷ 168 hours
```

The rate estimates repeated throughput if both the current batch edge and the historical volume persist. The UI says this explicitly. It is deliberately distinct from the one-time batch profit and does not forecast queue fill times. The candidate batch remains capped by capital, current top-30 acquisition/disposal depth, the sale window's volume share and the user quantity limit.

### Filter policy

- **Hard eligibility:** positive simulated net after the user's stated fee, sufficient weekly volume, complete executable sides, affordable capital, and positive feasible quantity.
- **Execution cap:** the lesser of current top-30 depth, available capital, user maximum, configured share of recent weekly volume over the sale window.
- **Warnings:** thin visible books, one large top-level order, and an anomalously wide immediate spread. These can explain a risky result without pretending they prove manipulation.
- **Ranking:** keep net batch profit, hourly projection, ROI, feasible quantity, visible depth and risks as separate columns/signals. If users choose a default sort, prefer hourly projection with risk warnings still visible; do not collapse all quality into an opaque score.
- **Future confidence:** calculate only after stored repeated snapshots support price deviation, depth persistence, order replenishment and observed fill-time estimates. Until then, do not invent a confidence probability or assume the best current price remains available.

## Fusion flip model

The first fusion slice is implemented through `GET /api/v1/opportunities/fusion`, a separate C++ CLI target, and a UI table. Catalog import validates every shard/recipe reference, allowed output yield, and ingredient quantity, then verifies the checked-in JSON's SHA-256 before use. The pinned catalog is SkyShards revision `bc767f820318ab0ae2ce6bd5150c7095dd00da12`, 322 shard entries and 129,289 ordered recipe edges. Its exact data hash and MIT notice are recorded in `docs/PROVENANCE.md` and `data/fusion/`.

For each selected output edge the optimizer acquires each ingredient against seller offers, sells the guaranteed output quantity against buyer orders, applies the configured sale fee, and bounds operations by all three books, recent volume/participation, capital, and the user operation limit. It chooses the best positive net batch over book-level quantity boundaries. It ranks by the same explicit throughput projection as Bazaar; this is not measured fusion time or a fill probability. Recipes with unavailable market products/depth and stale/incomplete data produce no result. Reptile chance bonuses are excluded.

This is a conservative first import, not a definitive transcription of every in-game fusion special case. The upstream graph explicitly identifies output edges and guaranteed output quantity, but the included tests prove parsing, arithmetic, limits, and protocol—not every recipe against an in-game sample. Validate special recipes and ingredient amounts in-game before treating all catalog entries as authoritative. No chance-based expected value is included.
