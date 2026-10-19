# HuntLab --- Engineering Handoff for the Next Agent

**Document type:** Product specification, architecture decision record,
research notes, and multi-agent implementation plan\
**Research date:** 18 October 2026\
**Working name:** HuntLab\
**Primary game:** Hypixel SkyBlock\
**Primary goal:** A fast, accurate, continuously updated Bazaar analysis
application with dedicated Crafting and Hunting Attribute Shard Fusion
optimisation tabs\
**Status:** Ready for implementation planning; licence and game-rule
verification are mandatory before reuse or release

------------------------------------------------------------------------

## 0. Mission and non-negotiable outcomes

Build a polished, self-hostable web application that finds and explains
profitable Hypixel SkyBlock market opportunities. The application must
combine:

1.  Bazaar order-flip analysis.
2.  Recursive crafting and intermediate-recipe analysis.
3.  A dedicated Hunting Attribute Shard Fusion optimiser.
4.  Persistent market history and price trends.
5.  A live, responsive web interface.
6.  A C++ calculation core, designed for performance, testability, and
    long-term extension.
7.  A repository and integration process that permits multiple agents to
    work independently without conflicting interfaces or duplicate
    implementations.

The result must be real software, not a mock dashboard. No fabricated
prices, recipes, profit numbers, or fake "live" badges. If a data source
is unavailable, show a clear degraded/stale state.

### Quality requirements

-   Cleanly written, readable, well-commented code.
-   Comments explain *why* a decision or algorithm exists, not every
    obvious line.
-   Strict separation between market ingestion, domain rules,
    optimisation, persistence, API and UI.
-   Reproducible builds and automated tests.
-   All calculations traceable to inputs and assumptions.
-   Market estimates must be presented as estimates, not guaranteed
    earnings.
-   Manual decision-support only. Do not automate in-game buying,
    selling, clicking, or gameplay.
-   Every copied code component and data source must have a documented
    licence/provenance decision.
-   All cross-agent interfaces must be agreed before parallel
    implementation begins.

------------------------------------------------------------------------

## 1. Research findings: repositories and what they contribute

This is a targeted web/GitHub search, not a mathematically exhaustive
census of every repository ever created. Repository state, licences,
branches, dependencies, and data-source terms can change. Recheck the
exact revision and its files before integrating anything.

### 1.1 Bazaar Calc --- highest-value architectural reference

Repository: https://github.com/Goofythesecond/bazaar-calc\
Licence reported by repository: MIT\
Primary technologies: TypeScript/JavaScript, web application, shared
calculation packages, server/worker, persistent storage.

Its documented capabilities include: - Bazaar order flips. - Crafting,
including intermediate crafts. - Enchanted-book combination. - Forge
routes. - NPC arbitrage. - Kat pet upgrades. - Hunting shard fusion. -
Order-size and daily-limit modelling. - Fill-time estimates, competition
and market warnings. - Confidence levels and a capital-allocation
planner. - Historical snapshots and paper trading. - A shared
calculation layer used by web, server and collectors.

The documented architecture separates shared
rules/market/recipes/fill/calculation/data/service logic from
server-core, worker, API, web and collector packages. This is a useful
model for modular boundaries.

**Use it for** - Architecture patterns and domain decomposition. -
Studying calculation details and auditability. - Understanding how
recommendations can explain every input and intermediate step. -
Identifying test cases and failure modes. - Potentially reusing
MIT-licensed code after reviewing exact files, dependencies, and
attribution obligations.

**Do not** - Copy large parts without understanding how their
abstractions work. - Assume every external data source used by another
project can be republished. - Assume the repository's main MIT licence
automatically relicenses third-party data, images, fonts, or
dependencies. - Treat its sophisticated fill estimates as ground truth
without validating the assumptions and data quality.

Repository documentation specifically states it uses Hypixel public API
data, NotEnoughUpdates-REPO data under MIT, and shard/game-rule facts
from the Hypixel SkyBlock wiki under CC BY-NC-SA 3.0. It also explicitly
says it avoids republishing data from some third-party market services
because their terms do not allow republication. That distinction is
critical: the project must have a data-source policy, not just a
software licence policy.

### 1.2 SkyShards --- fusion graph and rule reference

Repository: https://github.com/Campionnn/SkyShards\
Licence reported by repository: MIT\
Primary focus: Hypixel SkyBlock attribute shard fusion planning.

It provides a shard fusion website, fusion-related metadata/graph data,
and a configurable optimiser focused on obtaining shard attributes
efficiently.

**Use it for** - Fusion metadata and candidate valid fusion paths. -
Understanding shard identifiers and recipe graph representation. -
Comparing the results of an independently implemented fusion
optimiser. - A versioned data import, provided the precise source files
are covered by the stated licence and attribution is preserved.

**Required work before implementation** - Inspect the current default
branch and identify the canonical fusion data files. - Record the source
commit SHA and file hashes in a provenance manifest. - Map each field
into the internal schema; do not make the UI depend directly on upstream
JSON structure. - Validate IDs, input quantities, output alternatives,
unlock/level requirements, special fusion cases and output quantities. -
Verify current mechanics against primary/current game documentation
where possible. - Add tests for special cases and known fusion
examples. - Detect upstream schema changes and fail validation loudly
instead of silently dropping recipes.

Do not assume a graph represents market profitability by itself. A valid
fusion graph must be combined with current acquisition prices, output
sale prices, fees, available volume, execution constraints, and the
user's goals.

### 1.3 Hypixie --- second opinion on shard and Bazaar economics

Repository: https://github.com/skermiebroTech/skyblock\
Licence reported by repository: GPL-3.0-or-later.

Hypixie is a browser-based SkyBlock helper that includes live Bazaar
analysis, attribute shard fusion profit calculations, attribute planning
and other game helpers. Its documentation discusses Bazaar order-flip
math, tax, weekly volume, and limitations of top-of-book pricing.

**Use it for** - Cross-checking shard profit logic. - Identifying UI
affordances and missing edge cases. - Comparing tax and volume
assumptions. - A reference for live catalog discovery and fallback
behaviour.

**Licence caution** GPL-3.0-or-later is a copyleft licence. If code is
copied or a derivative is created, distribution obligations may affect
the resulting project. Do not copy code into an MIT-licensed or
otherwise differently licensed project without a deliberate licence
decision and legal review. It is safe to study public behaviour and
independently implement game rules, but do not copy protected
expression/code while calling it a clean-room implementation.

### 1.4 Hypixel Bazaar Flipper --- baseline scoring and filters

Repository: https://github.com/julesgtz/hypixel-bazaar-flipper\
Licence reported by repository: MIT.\
Primary technology: Python terminal interface.

Features documented include live Bazaar fetching, margin/liquidity
metrics, a scoring model, logical filters, local cache and offline mode.

**Use it for** - A simple baseline to test against. - Understanding how
basic margin and liquidity filters can be exposed to users. - Reference
cases for sorting and filtering.

**Do not use its score as the sole ranking function.** A composite score
can hide trade-offs. The new application should show net profit per
unit, ROI, expected profit rate, liquidity, capacity, risk and
confidence separately, then allow the user to choose a ranking strategy.

### 1.5 Bazaar API --- historical data service reference

Repository: https://github.com/Crefax/bazaar-api\
Licence reported by repository: GNU GPL v3.0.\
Primary technology: Rust/Actix with database-backed price snapshots and
OHLCV candles.

It documents a market tracker, product endpoints, latest snapshots,
chart series/candles, retention, rate limiting, and API key management.

**Use it for** - Historical data model ideas. - OHLCV materialisation
and retention policies. - API versioning, health checks, and rate-limit
handling. - Understanding the cost of storing high-frequency snapshots.

**Licence caution:** GPL-3.0 copyleft. Treat it as a reference unless
the project is intentionally compatible with its licence. There is no
technical reason the C++ engine must be written in Rust just because
this service is.

### 1.6 Bazcal --- AGPL bot reference, archived

Repository: https://github.com/Wykerd/bazcal\
Licence reported by repository: GNU AGPL v3.0-or-later.\
Status: archived/discontinued according to its repository page.

It is a configurable Discord bot for Bazaar trading advice and
notifications, with a scripting mechanism.

**Use it for** - Ideas for alert delivery and notification workflows. -
Historical perspective on command-driven flip tools.

**Avoid integrating its code into the core** unless the AGPL
consequences are deliberately accepted. It is archived and is not the
preferred foundation for a modern web application.

### 1.7 bzflipper --- MIT ChatTriggers helper

Repository: https://github.com/tombl/bzflipper\
Licence reported by repository: MIT.\
Primary focus: in-game ChatTriggers command helper for identifying
undersupplied flips and choosing how to obtain an item.

**Use it for** - Understanding the distinction between "find a
profitable route" and "find the ideal way to obtain a target item". -
Possible examples of command-driven user workflows.

It depends on ChatTriggers and is not an appropriate application
architecture to copy wholesale.

### 1.8 Additional Bazaar trackers: useful references, licence unclear

-   https://github.com/SpyrosR/Skyblock-Bazzar-Tracker --- full-stack
    live dashboard with TypeScript, WebSockets, SQLite and historical
    data.
-   https://github.com/stevejobless1/bazaar-tracker --- polling service
    and historical-price API.
-   https://github.com/BlastyTheDev/bazaar-tracker --- Bazaar data
    visualisation and Supabase history.
-   https://github.com/HaedenB/bazaar-flipper --- static client-side
    Bazaar/NPC/craft flip finder.
-   https://github.com/andyjjrt/bazaar --- price-tracker frontend.
-   https://github.com/linjeffrey21-creator/BazaarTracker --- custom
    market analytics metrics.
-   https://github.com/jauligian/HypixelAPIBazaarApp --- Java desktop
    Bazaar monitor; README says "Modify and distribute freely" but does
    not identify a standard licence in the inspected view.

For several of these, a clear standard licence was not visible in the
search results inspected. **Treat these as reference-only until a valid
licence is confirmed in the actual repository revision.** A public
repository without a licence does not grant general permission to copy
or redistribute its code.

### 1.9 FlipShards --- directly relevant, but licence needs verification

Repository: https://github.com/abishekraom/FlipShards

Its README describes a standalone shard fusion profit calculator using
CoflNet snapshots and SkyShards fusion data, ranking profit, ROI, volume
and risk. It includes recursive fusion-aware acquisition and custom
craft calculations.

This is highly relevant conceptually. However, a standard licence file
was not visible in the repository view inspected. Do not copy its code
until its licence is explicitly verified. Its data source is also an
independent consideration: using an API is not automatically permission
to redistribute its output or use it without regard to provider terms.

### 1.10 Official API and source data

-   Hypixel API documentation: https://api.hypixel.net/
-   Bazaar endpoint: `GET https://api.hypixel.net/v2/skyblock/bazaar`
-   Official API implementation repository:
    https://github.com/HypixelDev/PublicAPI
-   NotEnoughUpdates repository:
    https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO
-   SkyShards repository: https://github.com/Campionnn/SkyShards
-   Bazaar Calc repository:
    https://github.com/Goofythesecond/bazaar-calc

Hypixel's Bazaar response includes `buy_summary`, `sell_summary`, and
`quick_status`. The summaries represent the top orders; quick status
includes weighted average prices, order counts, active order volumes,
and moving-week traded-volume counters. The endpoint may return a
temporary unavailable response when its data is not populated. Respect
current API policies and rate limits.

### 1.11 Research conclusion

Do not fork one project and bolt features onto it without a clear
architectural plan.

Recommended starting strategy:

1.  **Study Bazaar Calc first** for full-market modelling, data
    provenance, route explanations, and test architecture.
2.  **Use SkyShards as the first fusion-data source** after verifying
    current files and rules.
3.  **Cross-check shard economics with Hypixie and FlipShards** without
    copying code from repositories whose licences are incompatible or
    unclear.
4.  **Use the official Hypixel API as the primary live market source.**
5.  **Create an independent C++ domain/optimisation engine**, keeping
    imported data behind a normalisation layer.
6.  **Build a modern web UI** on a documented, versioned REST contract.
7.  **Keep an attribution/provenance manifest** for code, rules, data,
    icons, fonts and other assets.

The research does not prove that every Bazaar-flipping project on GitHub
has been found. Before release, run a second, reproducible repository
search and re-check the exact licence files for every dependency
actually used.

------------------------------------------------------------------------

## 2. Licence and provenance policy

This is a product requirement, not an afterthought.

### 2.1 Code licences versus data terms

Keep separate records for: - Source code. - Static datasets. -
Facts/game mechanics. - Historical market records. - Icons, images,
fonts and UI assets. - Third-party libraries. - APIs and their terms of
service.

A repository may be MIT-licensed while a bundled font, icon set, or data
file has a different licence. A provider may allow API access but
restrict redistribution of its output. Do not assume one permission
covers everything.

### 2.2 Initial reuse policy

  -----------------------------------------------------------------------
  Source                  Current decision        Reason
  ----------------------- ----------------------- -----------------------
  Bazaar Calc             Candidate for reuse     MIT; strongest overall
                          after file-by-file      reference
                          review                  

  SkyShards               Candidate for fusion    MIT; domain-specific
                          metadata and selected   source
                          code after review       

  Hypixel Bazaar API      Use as primary live     Official data endpoint
                          data source subject to  
                          current API policies    

  NEU-REPO                Candidate for           MIT-reported project
                          recipes/items with      
                          attribution and licence 
                          review                  

  Hypixie                 Reference-only unless   GPL-3.0-or-later
                          copyleft compatibility  
                          is intentional          

  Bazaar API (Crefax)     Reference-only unless   GPL-3.0
                          copyleft compatibility  
                          is intentional          

  Bazcal                  Reference-only;         Network copyleft and
                          archived and            old architecture
                          AGPL-3.0-or-later       

  FlipShards              No code copying until a No standard licence
                          licence is confirmed    visible in inspected
                                                  view

  Other                   Reference-only          Public visibility is
  unlicensed/unclear                              not a licence
  repositories                                    
  -----------------------------------------------------------------------

This is an engineering screening, not legal advice. If redistribution or
public hosting matters, have the final dependency set reviewed.

### 2.3 Required repository files

Create: - `LICENSE` --- choose the project licence before importing
code. - `NOTICE.md` --- third-party notices and required attributions. -
`docs/PROVENANCE.md` --- source URLs, exact commit SHAs, file hashes,
licence, imported fields/files, modifications, and update procedure. -
`docs/DATA_SOURCES.md` --- source endpoints, terms checked, refresh
intervals, retention, and redistribution restrictions. - `third_party/`
only if vendoring is necessary; keep original notices with vendored
code.

For each reused code component, record:

``` text
component:
upstream_url:
upstream_commit:
upstream_path:
licence:
local_path:
changes:
notice_required:
tests_added:
review_status:
```

------------------------------------------------------------------------

## 3. Product definition

### 3.1 Core tabs

#### A. Overview

-   Market data freshness and service health.
-   Number of current candidates by category.
-   Highest expected-profit opportunities.
-   Watchlist and recent alerts.
-   User-configurable capital and tax assumptions.
-   No fabricated summary metrics when data is missing.

#### B. Bazaar

-   Searchable/sortable product table.
-   Current best buy-order and sell-offer data, correctly labelled.
-   Order-flip net margin after tax.
-   Instant buy/sell comparison.
-   Volume and active-order counts.
-   Estimated fill speed, liquidity and order-book depth where data
    supports it.
-   Risk/confidence indicators with explanations.
-   Budget/capital capacity projection.
-   Watchlist, threshold filters, CSV export and alerts.
-   Per-item detail drawer with calculation breakdown and historical
    chart.

#### C. Crafting

-   Recipes loaded from versioned, validated data.
-   Direct buy versus craft comparison.
-   Recursive ingredient acquisition.
-   Multiple routes to the same output.
-   Intermediate crafts and quantity rounding.
-   Output alternatives where relevant.
-   Bazaar and NPC exit comparison where data supports it.
-   Input costs, output value, taxes, net profit, ROI, batch size and
    expected throughput.
-   Explain the complete recipe tree.
-   Show unknown or unpriced ingredients explicitly; never silently
    price them as zero.

#### D. Hunting Shard Fusions

A dedicated first-class tab, not a generic recipe filter.

-   Search by shard name, attribute, rarity and identifier.
-   Rank single-step fusions and recursive/multi-step fusion paths.
-   Compare direct Bazaar acquisition against fusing ingredients.
-   Model the actual Fusion Machine input requirements and output
    choices from validated data.
-   Include special-case fusion rules and unlock requirements.
-   Estimate the total input cost, output sale proceeds after applicable
    tax, net profit, ROI and capital tied up.
-   Include available order-book depth, weekly volume, data freshness
    and confidence.
-   Show exact steps: input shard A and quantity, input shard B and
    quantity, fusion choice/output, subsequent steps, final sale.
-   Filters for rarity, shard family/type, max depth, minimum profit,
    minimum ROI, volume, risk, capital, and acquisition mode.
-   Support user-owned inventory as an optional cost-basis mode.
-   Support a target mode: "What is the cheapest way to obtain this
    shard?"
-   Support a profit mode: "Which fusion routes have the highest
    risk-adjusted expected profit?"
-   Clearly distinguish **profitable fusion** from **profitable
    buy-order/sell-offer trading**.
-   Account for Fusion Machine unlocks and player requirements when
    relevant.
-   Add a route comparison panel and a complete calculation audit.

#### E. History

-   Per-item price and volume charts.
-   Margin history.
-   Observed price changes and data-source freshness.
-   Route/paper-trading journal, if implemented.
-   Retention policy visible to users.
-   Historical snapshots must be timestamped and source-labelled.

#### F. Settings

-   Tax/perk configuration.
-   Capital and reserve.
-   Order-slot and daily limit assumptions where modelled.
-   Conservative/base/aggressive execution assumptions.
-   Refresh settings within API policy.
-   Data retention.
-   Theme and display preferences.
-   API keys only if a chosen data provider requires them; secrets must
    not be exposed to browser logs or committed.

### 3.2 Not in scope for the initial release

-   Automatic in-game trades or gameplay automation.
-   Claims that estimated profits are guaranteed.
-   Account credential collection.
-   An attempt to evade API rate limits.
-   Unverified recipe guessing.
-   A large microservice architecture with multiple databases before
    scale requires it.
-   Copying an entire GPL/AGPL application while keeping a conflicting
    licence.

------------------------------------------------------------------------

## 4. Technical architecture

### 4.1 Proposed stack

**Backend and calculation core** - C++20 initially; C++23 may be enabled
if the selected compiler/build environment supports it consistently. -
CMake. - Drogon HTTP framework, or another selected C++ HTTP framework
behind a documented interface. - `nlohmann/json` for JSON. - SQLite for
the default single-instance deployment. - `libcurl` or the HTTP client
supported by the chosen framework for outbound requests. - Catch2 or
GoogleTest for unit/integration tests. - `spdlog` for structured
logging. - `fmt` for formatting where useful.

**Frontend** - TypeScript. - React. - Vite. - A consistent component
system and accessible table/chart components. - REST API client
generated from or checked against OpenAPI. - WebSocket or Server-Sent
Events (SSE) for live updates; start with SSE if one-way updates are
sufficient.

**Development and operations** - Docker Compose for a reproducible
self-hosted deployment. - CMake presets. - `clang-format`, `clang-tidy`,
and sanitizers in CI. - ESLint/Prettier and TypeScript strict mode. -
GitHub Actions or equivalent CI. - SQLite migration scripts. -
`.env.example` with safe placeholders, never secrets.

These are proposals. The lead agent must freeze versions and framework
choices in `docs/ADRs/` before parallel coding begins.

### 4.2 Architecture diagram

``` text
                     Hypixel Public API
                             |
                             v
                    +-------------------+
                    | Market Collector  |
                    | polling, retries, |
                    | validation        |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    | Normalised Market |
                    | Snapshot          |
                    +-----+---------+---+
                          |         |
                          v         v
                  +------------+  +----------------+
                  | SQLite     |  | Event Publisher|
                  | snapshots  |  | SSE updates    |
                  +------+-----+  +-------+--------+
                         |                |
                         v                v
                 +----------------+   +-----------+
                 | C++ Domain and |   | Web UI    |
                 | Optimisation   |<--| React/TS  |
                 | Engine         |   +-----------+
                 +-------+--------+
                         |
                         v
                 +----------------+
                 | Versioned REST |
                 | API / DTOs     |
                 +----------------+
```

Keep the C++ engine independent from HTTP, SQLite, JSON, and UI
implementation details wherever practical. It should accept typed domain
objects and return typed results. Adapters perform network, persistence,
serialization and presentation work.

### 4.3 Design principles

1.  **Domain-first:** calculations must be callable from tests without a
    running server.
2.  **One source of truth:** a single canonical C++ implementation for
    profit and route calculations.
3.  **No UI arithmetic:** the frontend formats returned calculations; it
    does not independently reimplement game economics.
4.  **Typed contracts:** use explicit C++ types and API schemas; avoid
    ambiguous `double` fields with undocumented meanings.
5.  **Reproducibility:** every recommendation should reference the
    market snapshot, recipe/rule version, settings and algorithm version
    used.
6.  **Graceful degradation:** stale cache is better than a blank screen,
    but stale values must be labelled.
7.  **Bounded computation:** all recursive searches have depth,
    candidate, time or node limits and report when results may be
    incomplete.
8.  **Explainability:** a result must include its working, not just a
    profit number.
9.  **Separation of concerns:** ingestion, calculation, persistence, API
    and UI must be independently testable.
10. **No hidden magic numbers:** thresholds and assumptions belong in
    configuration or named constants with documentation.

------------------------------------------------------------------------

## 5. Proposed repository layout

``` text
huntlab/
├── README.md
├── LICENSE
├── NOTICE.md
├── CONTRIBUTING.md
├── SECURITY.md
├── CMakeLists.txt
├── CMakePresets.json
├── vcpkg.json
├── docker-compose.yml
├── .env.example
├── .editorconfig
├── .clang-format
├── .clang-tidy
├── .github/
│   └── workflows/
│       ├── backend.yml
│       ├── frontend.yml
│       └── integration.yml
├── apps/
│   ├── server/
│   │   ├── CMakeLists.txt
│   │   └── src/main.cpp
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── app/
│           ├── components/
│           ├── features/
│           │   ├── overview/
│           │   ├── bazaar/
│           │   ├── crafting/
│           │   ├── fusions/
│           │   ├── history/
│           │   └── settings/
│           ├── api/
│           ├── hooks/
│           ├── styles/
│           └── test/
├── core/
│   ├── domain/
│   ├── market/
│   ├── recipes/
│   ├── optimizer/
│   ├── pricing/
│   ├── history/
│   ├── application/
│   └── CMakeLists.txt
├── adapters/
│   ├── hypixel/
│   ├── coflnet/            # optional, only if terms/permissions are approved
│   ├── persistence/
│   ├── http/
│   └── serialization/
├── data/
│   ├── recipes/
│   ├── fusions/
│   ├── items/
│   └── provenance/
├── db/
│   └── migrations/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DOMAIN_MODEL.md
│   ├── DATA_SOURCES.md
│   ├── PROVENANCE.md
│   ├── TESTING.md
│   ├── DEVELOPMENT.md
│   ├── AGENT_WORKFLOW.md
│   └── ADRs/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── golden/
└── third_party/
```

The exact directories can change, but each folder must have one clear
owner and purpose. Avoid splitting one logical module across several
agents without a contract.

------------------------------------------------------------------------

## 6. Domain model and shared interfaces

Create these interfaces before delegating implementation. The names
below are proposals; the lead agent can refine them once, document the
decision, and then freeze them.

### 6.1 Fundamental types

``` cpp
using ProductId = std::string;
using ShardId = std::string;
using RecipeId = std::string;
using SnapshotId = std::int64_t;
using UnixMillis = std::int64_t;

// Coins should be represented as integer minor units if the game's
// price precision permits it. If decimal prices are needed, define a
// single documented fixed-point representation. Avoid arbitrary
// floating-point rounding for money.
struct Coins {
    std::int64_t value;
};

struct Quantity {
    std::int64_t value;
};
```

Do not use `double` as the canonical representation for coin balances or
quantities. Use fixed-point/integer arithmetic where possible, and
explicitly define rounding rules.

### 6.2 Market models

``` cpp
struct PriceLevel {
    Coins unit_price;
    Quantity amount;
    std::int32_t order_count;
};

struct ProductMarket {
    ProductId product_id;
    std::vector<PriceLevel> buy_orders;
    std::vector<PriceLevel> sell_orders;
    Coins weighted_buy_price;
    Coins weighted_sell_price;
    Quantity active_buy_volume;
    Quantity active_sell_volume;
    Quantity moving_week_buy_volume;
    Quantity moving_week_sell_volume;
    std::int32_t active_buy_orders;
    std::int32_t active_sell_orders;
    UnixMillis observed_at;
    SnapshotId snapshot_id;
    bool is_stale;
};
```

Names must match their actual meaning. Hypixel's API naming can be
confusing: document which side represents orders posted by buyers versus
offers posted by sellers, and test the mapping with fixture JSON.

### 6.3 Price assumptions

``` cpp
enum class ExecutionMode {
    Instant,
    LimitOrder,
    Mixed
};

struct MarketAssumptions {
    ExecutionMode execution_mode;
    std::int32_t tax_basis_points;
    Coins available_capital;
    Coins reserve_capital;
    double expected_volume_share;
    std::int32_t max_route_depth;
    bool include_owned_inventory;
};
```

Do not hardcode a single tax rate. The user must be able to select the
relevant tax/perk settings. Temporary mayor effects or other rule
modifiers should be modelled as versioned rules when verified.

### 6.4 Recipe and fusion models

``` cpp
struct Ingredient {
    ProductId product_id;
    Quantity quantity;
};

struct Recipe {
    RecipeId recipe_id;
    ProductId output_id;
    Quantity output_quantity;
    std::vector<Ingredient> ingredients;
    std::optional<std::string> requirement_id;
    std::string source_id;
    std::string rule_version;
};

struct FusionOutcome {
    ShardId output_shard_id;
    std::string outcome_id;
};

struct FusionRule {
    RecipeId rule_id;
    ShardId input_a;
    ShardId input_b;
    Quantity input_a_quantity;
    Quantity input_b_quantity;
    std::vector<FusionOutcome> possible_outputs;
    std::optional<std::string> requirement_id;
    std::string source_id;
    std::string rule_version;
};
```

Fusion is not necessarily identical to a deterministic crafting recipe.
If a fusion can offer several possible outcomes and the player chooses
one, model the actual game rule. If outcomes are random or conditional,
represent that explicitly. Never silently assume that the most valuable
output is guaranteed.

Use canonical ordering for symmetric input pairs so `(A, B)` and
`(B, A)` do not become duplicate rules unless order truly changes the
mechanic.

### 6.5 Calculation result

``` cpp
struct CalculationStep {
    std::string step_type;
    std::string description;
    std::vector<Ingredient> inputs;
    std::vector<Ingredient> outputs;
    Coins cost;
    Coins revenue;
    std::string explanation_code;
};

struct Opportunity {
    std::string opportunity_id;
    std::string opportunity_type;
    ProductId output_id;
    Coins input_cost;
    Coins gross_revenue;
    Coins fees;
    Coins net_profit;
    std::int32_t roi_basis_points;
    Quantity feasible_quantity;
    std::optional<double> expected_profit_per_hour;
    double confidence;
    std::vector<std::string> risk_flags;
    std::vector<CalculationStep> steps;
    SnapshotId market_snapshot_id;
    std::string rules_version;
    std::string algorithm_version;
    UnixMillis calculated_at;
};
```

The API may serialise `Coins` as an integer or decimal string; pick one
representation and document it. Never let JSON consumers guess whether
an amount is coins, thousands of coins, or a floating-point estimate.

### 6.6 Result metadata

Every calculation response should include: - `snapshot_id` -
`snapshot_timestamp` - `market_data_age_ms` - `recipe_data_version` -
`algorithm_version` - `settings_hash` or serialised settings -
`complete` and `truncated` flags - `warnings[]` - `calculated_at`

This makes the system auditable and helps explain differences between
runs.

------------------------------------------------------------------------

## 7. Profit mathematics and market modelling

### 7.1 Bazaar limit-order flip

For a simple order flip, the conceptual profit is:

``` text
net_sale_proceeds = expected_sell_price * quantity - applicable_fees
acquisition_cost  = expected_buy_price * quantity
net_profit        = net_sale_proceeds - acquisition_cost
ROI               = net_profit / acquisition_cost
```

In a conventional buy-order-then-sell-offer flip: - Acquisition is based
on the price paid to fill a buy order. - Revenue is based on the
expected sale-offer fill price. - Bazaar tax applies according to the
current game rules and selected user configuration. - The best
theoretical prices are not necessarily the prices a new order can fill
at. - A route can be profitable per unit but infeasible because the book
is too thin or the capital is insufficient.

The current Hypixel Bazaar endpoint documents weighted average prices
and order summaries. Do not confuse active order volume with actual
transacted volume.

### 7.2 Instant trades

An instant buy and then instant sell usually crosses the spread and is
often loss-making before other costs. Calculate it as a separate
execution mode using the appropriate sell offers and buy orders. Do not
present the limit-order margin as instant profit.

### 7.3 Order-book depth

Calculate how much quantity is available across levels at or better than
the assumed execution price. For a candidate quantity `q`, simulate
consuming levels rather than multiplying all units by the top price.

Return: - Estimated acquisition VWAP. - Estimated sale VWAP. - Quantity
feasible within configured price slippage. - The unfilled remainder, if
any. - A warning when only top-of-book prices are available.

### 7.4 Liquidity and expected profit rate

Keep these concepts separate: - Net profit per unit. - Total profit for
the candidate batch. - ROI. - Historical traded volume. - Active
order-book depth. - Expected fill time. - Expected profit per hour. -
Confidence.

A seven-day volume counter is a useful prior, not a guaranteed hourly
fill rate. If fill-time observations are not available, mark the
estimate as heuristic. Do not imply that a large margin on a rare item
is reliably repeatable.

### 7.5 Tax and fees

-   Store rates as basis points or another exact fixed-point unit.
-   Define whether fees are charged on acquisition, sale, both, or
    neither.
-   Apply the tax to the correct side of the transaction.
-   Add verified temporary modifiers through rules/configuration, not
    scattered conditionals.
-   Add tests for each perk/rate.
-   Show the fee line in the calculation breakdown.

### 7.6 Profit calculations must be explainable

For every opportunity, show: 1. The market snapshot timestamp. 2. Price
source and price side. 3. The quantities being bought and sold. 4. The
chosen execution model. 5. Ingredient or shard costs. 6. Each
craft/fusion step. 7. Applicable taxes and fees. 8. Gross revenue. 9.
Net profit. 10. ROI and capacity limits. 11. Risk flags and data
confidence. 12. Any rule or requirement applied.

------------------------------------------------------------------------

## 8. Hunting Attribute Shard Fusion optimiser

This deserves a separate module and test suite. Do not treat fusion as
merely another one-step craft.

### 8.1 Required modes

1.  **Best single-step fusion:** rank valid input pairs and selected
    outputs.
2.  **Best route to target:** find the cheapest valid acquisition path
    for a chosen shard.
3.  **Best profit route:** acquire inputs, perform valid fusion, sell
    the output.
4.  **Recursive route:** allow intermediate shards to be inputs to later
    fusions.
5.  **Inventory-aware route:** use user-owned shards at a configurable
    cost basis.
6.  **Capital-constrained route:** reject or down-rank paths that exceed
    the available capital.
7.  **Execution-aware route:** account for input and output liquidity,
    not only quoted price.
8.  **Requirement-aware route:** respect validated game unlocks and
    player requirements.

### 8.2 Data preparation

Build a versioned fusion dataset. Every record needs: - Stable shard
ID. - Display name. - Attribute/family. - Rarity/type where
applicable. - Bazaar product ID mapping. - Input pair and exact
quantities. - Possible output IDs and output-selection semantics. -
Requirements and unlocks. - Source URL and source commit/version. - Date
verified. - Provenance/licence information.

The UI must not use display names as identifiers. IDs remain stable even
when names change.

### 8.3 Optimisation approach

Start with a correctness-first graph algorithm.

-   Represent shard types as graph nodes.
-   Represent each valid fusion rule as a hyperedge with two input
    nodes, input quantities and one or more legal outputs.
-   For a target shard, compute the cheapest known acquisition route
    from direct market acquisition and all valid fusion alternatives.
-   For profit scanning, enumerate valid rules, calculate route costs
    and sale proceeds, and rank them under configured constraints.
-   Memoise subproblem results keyed by target shard, snapshot, rule
    version, depth and relevant settings.
-   Avoid duplicate symmetric rules.
-   Bound recursive depth and search expansion.
-   Detect cycles or prevent them by enforcing a valid depth/step
    progression when game mechanics permit that.
-   Preserve the best few routes per target rather than only one route,
    so the user can compare cost, risk and liquidity.
-   Clearly mark any result truncated by a search budget.

Do not assume the lowest-cost input path always maximises net profit:
output sale value, fees, quantity rounding, liquidity and capital tied
up can change the optimal route.

### 8.4 Avoiding false arbitrage

A fusion is not automatically profitable because the output shard has a
high listed price.

-   Verify that the output can actually be sold at the assumed quantity
    and price.
-   Verify input acquisition costs at the quantity required.
-   Account for the applicable tax on sale.
-   Use current and historical market data to flag abnormal or thin
    prices.
-   Do not assume a top-of-book price is available for an entire batch.
-   Apply player unlock requirements.
-   Model exactly what output the game allows the player to select.
-   Separate a *guaranteed legal output* from an outcome that is
    probabilistic or uncertain.
-   Do not use "profit" to mean the market value of an output minus an
    arbitrary average ingredient price without showing the full route.

### 8.5 UI design

A fusion opportunity row should include: - Output shard. - Input pair. -
Route depth. - Input cost. - Sale proceeds after tax. - Net profit. -
ROI. - Estimated execution quantity. - Liquidity indicator. -
Confidence/risk. - "View route" action.

The route detail should render a tree or step list with every
intermediate shard and ingredient quantity. It must explain why the
route was selected over the next-best alternatives.

------------------------------------------------------------------------

## 9. Crafting optimiser

Crafting and shard fusion share pricing and recipe primitives, but
should have separate rule modules.

### Required features

-   Recipes with multiple ingredients and output quantities.
-   Recursive ingredient acquisition.
-   Multiple routes to obtain the same ingredient.
-   Ingredient quantity rounding and craft-batch multiples.
-   NPC purchase/sale options when verified.
-   Recipe unlocks/requirements.
-   Price freshness and missing price handling.
-   Recipe graph cycle validation.
-   Max-depth and max-node limits.
-   Cost breakdown per ingredient and sub-recipe.
-   Output sell-volume constraints.
-   Cache invalidation when any dependent price or recipe changes.

### Route selection

For a target product, compare: - Buy target directly. - Craft target
from directly purchased ingredients. - Craft one or more ingredients
first. - Alternative recipes. - NPC routes if applicable.

Use a cost-minimisation objective for target acquisition and a
profit-maximisation objective for craft flips. These are different
optimisation questions.

------------------------------------------------------------------------

## 10. Market ingestion and freshness

### 10.1 Hypixel API adapter

Implement a small, isolated client that: - Calls the official Bazaar
endpoint. - Parses the current response schema. - Validates required
fields and types. - Records fetch start/end, HTTP status and observed
time. - Handles timeouts, 429/rate-limit responses, 5xx errors and
malformed payloads. - Uses bounded retries with exponential backoff and
jitter. - Never retries in an unbounded tight loop. - Observes API
policy and rate-limit headers where present. - Does not log API
secrets. - Exposes a typed result, not raw JSON, to the rest of the
system.

### 10.2 Refresh strategy

Do not poll aggressively just because the UI should feel responsive.

-   Make refresh cadence configurable within the source's policy.
-   Poll once per process, not once per browser client.
-   Deduplicate unchanged snapshots.
-   If the upstream request fails, keep the last valid snapshot and mark
    it stale.
-   Show a visible timestamp and data-age warning.
-   Avoid recalculating every possible route when only an unrelated
    product price changed.

### 10.3 Incremental recomputation

Maintain dependency maps: - Product ID -\> recipes using this product as
input. - Product ID -\> fusion rules requiring the associated shard. -
Product ID -\> output opportunities whose revenue depends on it. -
Recipe/rule ID -\> dependent routes.

When a market product changes, invalidate affected calculations and
recompute those routes first. Run a periodic full consistency
recomputation to catch dependency bugs.

### 10.4 Market history

Use SQLite initially. Design schema and indexes around actual queries: -
Latest snapshot per product. - Snapshot metadata. - Product price
observations. - Optional order-book levels. - Derived
candles/aggregates. - Recipe/rule versions. - Cached calculation
metadata. - User settings/watchlist, if needed.

Do not store every full order book forever by default. Establish
configurable retention, aggregation and vacuum/compaction policy. Keep
enough detail to calculate recent order-book depth and enough historical
aggregates for charts.

### 10.5 Data providers

Primary source: official Hypixel public API.

Third-party providers such as CoflNet may be evaluated as optional
adapters, but: - Review the current terms before integration. - Do not
assume API access means redistribution is permitted. - Do not republish
data from a provider that prohibits it. - Keep provider-specific data
behind an adapter. - Allow the system to run without optional
providers. - Record source provenance for every stored snapshot.

------------------------------------------------------------------------

## 11. REST API contract

Freeze a versioned API before frontend/backend agents work in parallel.
The first version can be small.

### Proposed endpoints

``` text
GET  /api/v1/health
GET  /api/v1/status
GET  /api/v1/market/snapshot
GET  /api/v1/market/products
GET  /api/v1/market/products/{productId}
GET  /api/v1/market/products/{productId}/history
GET  /api/v1/opportunities/bazaar
GET  /api/v1/opportunities/crafting
GET  /api/v1/fusions/opportunities
GET  /api/v1/fusions/shards
GET  /api/v1/fusions/shards/{shardId}/routes
POST /api/v1/fusions/optimise
POST /api/v1/crafting/optimise
GET  /api/v1/recipes
GET  /api/v1/settings
PUT  /api/v1/settings
GET  /api/v1/events   # SSE if selected
```

Use query parameters for pagination, filters, sorting and objective
settings. Validate all inputs. Limit page size and optimisation budgets.

### API rules

-   Return ISO-8601 UTC timestamps.
-   Return stable IDs, not only names.
-   Include `snapshot_id` and `data_age_ms`.
-   Use structured error responses with a stable error code.
-   Never return a successful empty array when an internal failure
    prevented computation; return a clear error or stale result.
-   Publish an OpenAPI document.
-   Frontend types must be generated from or validated against the API
    schema.
-   Keep backward-compatible changes within `/api/v1`; breaking changes
    require a version decision.

------------------------------------------------------------------------

## 12. Frontend implementation requirements

### Layout

-   Persistent top navigation or sidebar.
-   Separate tabs: Overview, Bazaar, Crafting, Hunting Shard Fusions,
    History, Settings.
-   Search and filters appropriate to each tab.
-   Tables with stable sorting, pagination/virtualisation where needed,
    and clear empty/loading/error states.
-   Route detail panel/drawer for calculation breakdown.
-   Responsive desktop and mobile layouts.
-   Keyboard-accessible controls and adequate contrast.
-   Number formatting for coins and percentages.
-   Tooltips/explanations for specialist market terminology.

### Performance

-   Do not render the entire market table repeatedly for every price
    tick.
-   Debounce search and expensive filter changes.
-   Keep table rows keyed by stable product/opportunity ID.
-   Use SSE/WebSocket updates to update changed rows, not reload the
    entire application.
-   Use server-side optimisation for recursive search; do not run the
    full fusion graph in the UI thread.
-   Cancel obsolete requests when the user changes filters.
-   Cache results with a clear snapshot/version key.
-   Never show a stale calculation as if it used the latest snapshot.

### User-facing data states

-   Live/current.
-   Updating.
-   Stale but available.
-   Upstream unavailable.
-   No price available.
-   Calculation incomplete/truncated.
-   Not profitable under current assumptions.
-   Invalid or unverified recipe.

------------------------------------------------------------------------

## 13. Multi-agent development plan

The lead agent must create shared contracts first, then delegate bounded
tasks. Agents should not all independently decide names, types,
libraries, API routes, or profit formulas.

### Agent 0 --- Lead architect and integrator

**Owns:** architecture, contracts, repo setup, final integration, code
review.

Tasks: 1. Create repository skeleton. 2. Select/freeze compiler, CMake,
dependencies and frontend stack. 3. Write ADRs and domain/API contracts.
4. Set coding standards and CI. 5. Create issue/PR templates and agent
handoff instructions. 6. Review data-source/licence policy. 7. Integrate
branches and resolve cross-module questions. 8. Ensure tests cover
interactions between modules. 9. Verify the application starts from a
clean clone. 10. Maintain a single status document and a decision log.

**Must not:** implement all modules in a monolith or permit other agents
to silently redefine public interfaces.

### Agent 1 --- Market data adapter and ingestion

**Owns:** `adapters/hypixel/`, market normalisation types and ingestion
tests, subject to the lead's module boundaries.

Deliverables: - HTTP client. - Typed parser. - Rate-limit and retry
policy. - Market snapshot model. - Freshness/stale-state handling. -
Fixture-based tests using recorded/sanitised API responses. -
Data-source documentation.

Acceptance: - Handles valid, missing, malformed and unavailable
responses. - Does not hammer upstream on failure. - Does not leak
secrets. - Unit tests can run without network access.

### Agent 2 --- C++ Bazaar calculation engine

**Owns:** `core/market/`, `core/pricing/`, Bazaar opportunity
calculations.

Deliverables: - Price-side normalisation tests. - Limit-order and
instant-trade models. - Tax/fee calculation. - Volume and order-book
depth calculations. - Profit/ROI/capacity output. - Risk flags with
explicit reasons. - Golden test fixtures.

Acceptance: - Uses the shared domain models. - Does not depend on HTTP
or UI. - Produces deterministic output for a fixed snapshot/settings. -
Exposes every assumption in result metadata. - Handles empty books and
zero denominators safely.

### Agent 3 --- Fusion data and Hunting Shard optimiser

**Owns:** `core/recipes/` fusion submodule, `core/optimizer/fusion*`,
`data/fusions/`.

Deliverables: - Source-data import/normalisation. - Provenance
manifest. - Fusion graph validator. - Rule tests for normal and special
cases. - Single-step optimiser. - Recursive target-route optimiser. -
Profit route optimiser. - Search budgets and truncation reporting. -
Route breakdown output. - Test cases for invalid IDs, missing prices,
cycles, and asymmetric rules.

Acceptance: - Uses only verified rules. - Distinguishes selectable
output from random outcome. - Does not assume market value equals
realised sale proceeds. - Can be called through a C++ API without HTTP
or UI. - Results are deterministic for fixed input and settings.

### Agent 4 --- Crafting and general recipe optimiser

**Owns:** `core/recipes/` non-fusion recipe support and
`core/optimizer/crafting*`.

Deliverables: - Recipe import/validation. - Recursive ingredient-cost
calculation. - Alternative route comparison. - Batch and quantity
rounding. - Cycle and depth handling. - Craft flip calculation. - Cost
tree/steps for UI. - Unit and golden tests.

Acceptance: - Missing prices never become zero. - Invalid/cyclic recipes
fail clearly. - Alternative routes are compared using the same pricing
assumptions. - The module shares market/pricing primitives with the
Bazaar engine.

### Agent 5 --- Persistence and market history

**Owns:** `adapters/persistence/`, `core/history/`, `db/migrations/`.

Deliverables: - SQLite schema and migrations. - Snapshot storage and
deduplication. - Latest-price queries. - Historical
observations/candles. - Configurable retention. - Query indexes. -
Integration tests. - Backup/export notes.

Acceptance: - Migrations work from an empty database. - Re-ingesting the
same snapshot is safe/idempotent. - Concurrent reads do not corrupt
data. - Retention is bounded and documented. - Query behaviour is tested
on realistic fixtures.

### Agent 6 --- REST API and live updates

**Owns:** `adapters/http/`, `apps/server/`, API schema/OpenAPI.

Deliverables: - Health/status routes. - Market, history and opportunity
routes. - Fusion and crafting optimisation routes. - Input validation
and pagination. - Structured errors. - SSE or chosen update transport. -
API integration tests.

Acceptance: - Uses application/domain services, not duplicated
formulas. - API schema matches frontend types. - Slow optimisation does
not block health/status endpoints. - Request size, query size and
optimisation budgets are bounded. - API failures are observable in logs.

### Agent 7 --- Frontend shell and shared UI

**Owns:** `apps/web/src/app`, shared components, styling, API client.

Deliverables: - App shell and navigation. - Responsive layout and design
tokens. - Reusable table, filter, status, chart and detail components. -
API client and type validation. - Loading/error/stale/empty states. -
Accessibility baseline. - Component tests.

Acceptance: - All tabs can be navigated. - No hard-coded fake live
market values. - API types come from the agreed contract. - Works on
mobile and desktop. - UI is usable with keyboard navigation.

### Agent 8 --- Feature UI: Bazaar, Crafting, Fusions, History

This agent may be split into separate subagents once shared components
and API contracts are stable. Each feature should be owned by a separate
directory: - `features/bazaar/` - `features/crafting/` -
`features/fusions/` - `features/history/`

Deliverables: - Feature-specific table/filter/detail views. -
Integration with real API responses. - Visual explanation of route
steps. - Responsive states. - Feature tests.

Acceptance: - No feature duplicates calculation logic. - Fusions has its
own first-class tab and route detail. - All calculations display their
snapshot timestamp and assumptions. - Missing or stale data is visibly
explained.

### Agent 9 --- Quality, performance and integration testing

**Owns:** integration test suite, load/performance checks, end-to-end
smoke tests, test documentation.

Deliverables: - Cross-module golden cases. - API contract tests. -
Clean-install build test. - UI smoke tests. - Sanitizer/valgrind or
equivalent checks where available. - Optimiser performance fixtures. -
Memory and database retention checks. - Bug triage report.

Acceptance: - Full CI passes from a clean clone. - No flaky
network-dependent unit tests. - Known calculation cases match
hand-verified expected values. - Large fusion graphs complete within
agreed time limits or explicitly report truncation. - UI does not freeze
during refreshes.

### Parallelism rules

-   Agents 1--5 can work in parallel after domain types are frozen.
-   Agent 6 can scaffold routes early but must not invent DTOs.
-   Agent 7 can build the shell and component library against mocked
    *typed fixtures* only; all mocks must be clearly marked as test data
    and never used as live production results.
-   Agent 8 starts feature integration when the API contract and shared
    UI components exist.
-   Agent 9 builds fixtures and test plans immediately, then adds
    end-to-end coverage as modules land.
-   Agent 0 owns shared files such as root CMake, lockfiles, OpenAPI,
    domain interfaces and CI workflows unless a specific owner is
    assigned.
-   No two agents should edit the same core file concurrently.
-   Use separate branches and small pull requests.
-   Each agent must report changed files, decisions, tests run, known
    limitations and any interface changes.

------------------------------------------------------------------------

## 14. Integration contracts between agents

### 14.1 Contract-first workflow

Before implementation: 1. Lead creates `docs/DOMAIN_MODEL.md`. 2. Lead
creates API DTO schemas/OpenAPI. 3. Lead creates representative JSON
fixtures. 4. All module owners acknowledge the interfaces. 5. Only then
do parallel implementations begin.

### 14.2 Pull request checklist

Every PR must state: - Purpose. - Files/modules changed. - Public
interface changes. - Tests added/updated. - Build/test commands
executed. - Licence/provenance changes. - Performance implications. -
Known limitations. - Follow-up tasks.

### 14.3 Definition of done

A module is not done merely because it compiles. It must: - Build in
CI. - Have unit tests. - Have API/domain documentation where relevant. -
Use structured logging and explicit errors. - Avoid hidden global
state. - Avoid duplicated domain calculations. - Have no unresolved
TODOs that compromise correctness. - Be integrated against the actual
shared contract. - Include source/licence attribution for imported
material.

### 14.4 Agent coordination files

Create: - `AGENTS.md` --- repository-wide instructions for coding
agents. - `docs/AGENT_WORKFLOW.md` --- module ownership, branch/PR
workflow, and handoff template. - `docs/ADRs/0001-architecture.md`. -
`docs/ADRs/0002-money-and-rounding.md`. -
`docs/ADRs/0003-market-data-and-refresh.md`. -
`docs/ADRs/0004-fusion-optimizer.md`. -
`docs/ADRs/0005-licensing-and-data-provenance.md`.

Each feature directory should include a short README with its owner,
dependencies, entry points, test commands and extension instructions.

------------------------------------------------------------------------

## 15. Testing strategy

### 15.1 Unit tests

Test: - Market field mapping. - Tax and fee arithmetic. -
Integer/fixed-point rounding. - Empty/missing price data. - Order-book
walking and VWAP. - Recipe cost calculation. - Alternative recipe
selection. - Fusion pair canonicalisation. - Special fusion rules. -
Recursive route memoisation. - Search depth and node limits. - Stale
data and cache invalidation. - Confidence/risk explanations. - API
validation and pagination.

### 15.2 Golden tests

Create versioned fixture cases with known expected results. Each case
should contain: - Input market snapshot. - Recipe/fusion data version. -
User settings. - Expected route. - Expected input cost, revenue, fees
and profit. - Expected warnings. - Explanation of why the result is
correct.

Use hand-calculated cases for the basic arithmetic and a second
independently implemented spreadsheet/script for selected complex
routes. Do not use a result from the same code under test as its own
expected answer.

### 15.3 Property-based tests

Examples: - Net profit equals revenue minus acquisition cost minus fees
under the defined model. - Increasing acquisition cost while other
inputs remain fixed cannot increase profit. - Reducing output sale price
cannot increase profit. - No opportunity may have negative required
quantities. - A route may not claim more output than its valid recipe
quantities produce. - Canonical symmetric fusion pairs should not be
duplicated. - An unpriced input must not result in a valid numeric
profit estimate. - Fixed inputs and settings must yield deterministic
outputs. - An optimiser's reported route must be replayable step by
step.

### 15.4 Integration tests

-   API fixture -\> market parser -\> normalised snapshot.
-   Snapshot -\> database -\> latest snapshot query.
-   Snapshot + rules -\> calculation -\> REST DTO.
-   Fusion data import -\> graph validation -\> route output.
-   SSE update -\> frontend state update.
-   Stale cache -\> UI stale banner.
-   Bad upstream response -\> service remains healthy with an explicit
    degraded status.

### 15.5 Performance tests

Measure: - Snapshot parsing time. - Database ingestion/query latency. -
Full Bazaar ranking latency. - Single target fusion route latency. -
Full fusion opportunity scan latency. - Frontend table update latency. -
Memory use during recursive optimisation. - Startup time from a cold
database.

Set thresholds after measuring a representative dataset; do not invent
performance claims. Use profiling before micro-optimising.

------------------------------------------------------------------------

## 16. Security and operational requirements

-   Never commit API keys, session secrets, or personal credentials.
-   Keep provider tokens server-side if a provider requires one.
-   Validate all user-supplied IDs, filter values, route depth and page
    sizes.
-   Protect admin endpoints if any are added.
-   Apply bounded queues and request timeouts.
-   Limit concurrent expensive optimiser jobs.
-   Use structured logs with request IDs and no secrets.
-   Expose health and readiness endpoints.
-   Gracefully handle database locks and upstream downtime.
-   Keep dependencies pinned and audit them regularly.
-   Document backup and restore.
-   Do not scrape or republish third-party data contrary to provider
    terms.
-   The app must not perform in-game actions or request a player's
    Minecraft credentials.

------------------------------------------------------------------------

## 17. Development phases and milestones

### Phase 0 --- research and architecture freeze

-   Recheck licences and exact repository revisions.
-   Choose project licence.
-   Verify fusion rules and data schema.
-   Freeze domain types and API contract.
-   Create repository skeleton, CI, formatting and test framework.

**Exit gate:** all module owners agree on the public interfaces.

### Phase 1 --- data foundation

-   Implement Hypixel client and fixture parser.
-   Store snapshots in SQLite.
-   Import/validate fusion data.
-   Import/validate crafting data.
-   Expose health/status and latest snapshot.

**Exit gate:** app can ingest real data safely and fall back to a
labelled stale snapshot.

### Phase 2 --- correct core calculations

-   Bazaar order-flip and instant-trade models.
-   Fees/tax settings.
-   Recipe cost engine.
-   Fusion route engine.
-   Golden and property tests.

**Exit gate:** each result can be reproduced and audited from its
inputs.

### Phase 3 --- API and first UI

-   Versioned REST API.
-   Shared web shell.
-   Bazaar and fusion tables.
-   Route detail view.
-   Data freshness states.

**Exit gate:** real market data flows from upstream to UI with no
duplicated formulas.

### Phase 4 --- full feature set

-   Crafting tab.
-   History charts.
-   Filters, watchlist and alerts.
-   SSE/WebSocket updates.
-   Inventory-aware and target-route optimisation.

**Exit gate:** all tabs use real data and pass feature tests.

### Phase 5 --- performance and deployment

-   Incremental recalculation.
-   Query/index tuning.
-   Optimiser limits and profiling.
-   Docker Compose.
-   Clean-install and backup/restore test.
-   Documentation and licence audit.

**Exit gate:** a new developer can clone, configure and run the project
using only the documented steps.

------------------------------------------------------------------------

## 18. Initial acceptance criteria

The first public-quality release is acceptable only when all of the
following are true:

### Correctness

-   [ ] Market buy/sell sides are verified against actual API fixture
    semantics.
-   [ ] Tax and fee calculations have hand-verified tests.
-   [ ] Missing/stale data never appears as fresh or as zero-cost.
-   [ ] Crafting and fusion routes are based on validated rules.
-   [ ] Fusion output semantics match the game.
-   [ ] Every opportunity has a complete calculation breakdown.
-   [ ] Results identify the exact snapshot and rule version used.

### Performance and reliability

-   [ ] Market polling is centralised and respects API policies.
-   [ ] UI refresh does not trigger independent upstream API calls per
    client.
-   [ ] Expensive searches are bounded and cancellable.
-   [ ] A failed upstream fetch does not crash the app.
-   [ ] Historical storage has a retention policy.
-   [ ] Incremental invalidation is tested.
-   [ ] Clean build and test suite pass in CI.

### UX

-   [ ] Dedicated Bazaar, Crafting, Hunting Shard Fusions and History
    tabs exist.
-   [ ] Fusions can rank both single-step and multi-step routes.
-   [ ] Route details show exact quantities and each intermediate step.
-   [ ] Sorting, filtering, search and data freshness work.
-   [ ] UI is responsive and keyboard accessible.
-   [ ] No fabricated production data is shown.

### Maintainability

-   [ ] Public interfaces are documented.
-   [ ] Tests are readable and deterministic.
-   [ ] Module READMEs explain extension points.
-   [ ] Third-party licences and provenance are recorded.
-   [ ] The lead can build and run the entire app from a clean clone.

------------------------------------------------------------------------

## 19. Immediate next actions for the lead agent

1.  Create the repository and add this handoff to `docs/HANDOFF.md`.
2.  Inspect the current Bazaar Calc and SkyShards source trees at pinned
    commits.
3.  Verify the precise files and licences that would be reused.
4.  Create `docs/PROVENANCE.md` before importing code/data.
5.  Select and document the project licence.
6.  Write the first version of the domain model and OpenAPI schema.
7.  Add CMake, frontend package configuration, formatters, CI and test
    harness.
8.  Create small, representative market and fusion fixtures.
9.  Assign agents using the module ownership table.
10. Require each agent to produce a small working vertical slice before
    expanding scope.
11. Integrate one end-to-end path first: API snapshot -\> normalised
    market -\> one Bazaar calculation -\> API response -\> UI table.
12. Integrate one fusion path next: validated fusion data -\> cost
    optimiser -\> detailed route -\> UI route view.
13. Add recursive routes and broader crafting only after the vertical
    slices are tested.
14. Perform a final licence/data-source audit before public release.

### Required first vertical slice

The first slice should be deliberately small: - Fetch one real Bazaar
snapshot. - Parse and store it. - Calculate one simple, fully specified
opportunity. - Return the result via REST. - Display it in the UI with
the snapshot timestamp and calculation breakdown. - Test the entire flow
with a saved fixture when offline.

This proves the interfaces fit together before multiple agents expand
the system.

------------------------------------------------------------------------

## 20. Primary references

1.  Bazaar Calc repository:
    https://github.com/Goofythesecond/bazaar-calc
2.  Bazaar Calc architecture and research are in its `docs/` and
    `research/` directories.
3.  SkyShards repository: https://github.com/Campionnn/SkyShards
4.  Hypixie repository: https://github.com/skermiebroTech/skyblock
5.  Hypixel Bazaar Flipper:
    https://github.com/julesgtz/hypixel-bazaar-flipper
6.  Bazaar API service: https://github.com/Crefax/bazaar-api
7.  Bazcal: https://github.com/Wykerd/bazcal
8.  bzflipper: https://github.com/tombl/bzflipper
9.  FlipShards: https://github.com/abishekraom/FlipShards
10. SpyrosR tracker: https://github.com/SpyrosR/Skyblock-Bazzar-Tracker
11. stevejobless1 tracker:
    https://github.com/stevejobless1/bazaar-tracker
12. Blasty tracker: https://github.com/BlastyTheDev/bazaar-tracker
13. HaedenB flip finder: https://github.com/HaedenB/bazaar-flipper
14. Hypixel public API documentation: https://api.hypixel.net/
15. Hypixel API Java implementation:
    https://github.com/HypixelDev/PublicAPI
16. NotEnoughUpdates repository:
    https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO

**Final instruction to the implementation agent:** prioritise
correctness, transparent calculations, clean interfaces and reproducible
tests over feature count. The goal is an expandable system that other
developers can understand and safely extend, not a large codebase whose
calculations cannot be trusted.
