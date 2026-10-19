# Engineering status

Updated: 2026-10-20

## Phase 0 — architecture and repository setup

- [x] Read the full engineering handoff and inspect the repository.
- [x] Connect the workspace to the GitHub `main` branch; preserve GPL-3.0.
- [x] Verify API capabilities, reference project licences, and community-documented shard fusion mechanics; record sources and caveats.
- [x] Define architecture, shared domain models, SQLite schema, API contract, provenance policy, and agent file ownership.
- [x] Add reproducible CMake/Ninja build, C++ and Node tests, formatting rules, and CI.

## Phase 1 — Bazaar vertical slice

- [x] Centralized fetch with bounded timeout/retries and schema validation.
- [x] Normalize seller offers and buyer orders; reject malformed market data.
- [x] Persist validated snapshots in SQLite in a transaction and deduplicate identical content.
- [x] Simulate executable book depth and calculate a conservative instant-spread estimate in the isolated C++ core.
- [x] Expose health, freshness, snapshot, and opportunity routes.
- [x] Display results, assumptions, and stale/upstream state in the responsive web UI.
- [x] Verify an offline fixture end-to-end through C++ analysis, SQLite, REST, and served UI assets.
- [x] Verify the parser against a live official Bazaar payload (2,201 products observed on 2026-10-19 UTC).

## Phase 2 — usability, liquidity screening, and local profile lookup

- [x] Add weekly-volume minimum, configurable sale horizon/share, and C++ batch sizing bounded by estimated throughput.
- [x] Flag thin visible books, single-order-dominated depth, and unusually wide instant spreads.
- [x] Improve the UI with official display names, search, persisted assumptions, and volume/quantity explanations.
- [x] Add on-demand local Hypixel profile lookup for visible purse/bank balances; keep the key server-side, cache for one hour, and restrict this route to loopback.
- [x] Upgrade existing SQLite databases with weekly-volume data.
- [x] Rebuild the C++ engine and run all C++ and Node tests after the contract update.

## Phase 3 — throughput-adjusted Bazaar ranking

- [x] Add an auditable coins/hour estimate to each executable batch, based on the selected share of the conservative weekly volume and the candidate's net per-unit edge.
- [x] Show batch profit and projected coins/hour independently in the UI; document that the projection assumes repeatable edge and volume.
- [x] Let users sort results by projected coins/hour, batch profit or ROI.
- [ ] Add live market-history checks and calibrate fill-speed/confidence before presenting a probabilistic score.
- [x] Build the shard fusion slice with a pinned, hash-verified catalog, quantity-aware C++ optimizer, API endpoint, and manual-estimate UI.

## Build and test record

- `cmake --preset default --fresh` — passed with CMake 4.4.4, Ninja, and MinGW GCC 16.2.0.
- `cmake --build --preset default --parallel` — passed.
- `ctest --preset default --output-on-failure` — passed, 2/2 C++ test executables (Bazaar and fusion core).
- Full Node API/integration suite after current updates — passed, 25/25, including catalog integrity, full fusion graph protocol, C++ fusion CLI, Bazaar, SQLite, and API routes. HTTP tests require local loopback access.
- CMake rebuild and `ctest --preset default` after fusion — passed, 2/2 C++ test executables.
- Node parser, persistence, server, Bazaar integration, and fusion engine tests — passed, 25/25 (21 non-HTTP and 4 loopback HTTP tests).
- Node syntax checks for the changed server, protocol and browser modules — passed.
- `git diff --check` — passed (Git reported a harmless LF-to-CRLF working-copy warning for `README.md`).
- `clang-format --dry-run --Werror core/src/*.cpp core/include/huntlab/domain/*.hpp core/include/huntlab/analysis/*.hpp tests/unit/*.cpp` and Node syntax checks — passed.
- `git diff --check` — passed (Git reported a harmless LF-to-CRLF working-copy warning for `README.md`).

## Limitations and next steps

The slice analyzes Bazaar instant buy from seller offers followed by instant sell into buyer orders. Batch sizing now uses the smaller weekly volume counter, a user-set time window and share, plus current depth and capital. The new coins/hour estimate is a volume extrapolation from a single current book snapshot, not a measured rate. Risk labels are heuristics, not proof of manipulation. HuntLab still does not model limit-order queue position, measured fill rates, market impact beyond returned top-30 summary levels, or realized profit. Hypixel data can change before a user acts. Opportunity results are estimates and the UI directs users to execute manually.

Auction House valuation/flips, crafting recipes, historical time-series charts, unified cross-market ranking, Discord notifications, broader profile statistics, profile selection, authentication for non-local deployments, and richer pagination remain unimplemented. Item names/materials/tiers use Hypixel's official resource; actual item icons still need a legally reviewed texture-mapping source. No third-party code was imported; the MIT fusion dataset is documented separately in `docs/PROVENANCE.md`.

The application requires Node.js with `node:sqlite` support and a built C++ CLI. Local build/test commands and environment variables are documented in `docs/DEVELOPMENT.md`. The live feed is dynamic, so live opportunity counts and prices are not acceptance-test expectations.
