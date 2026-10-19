# HuntLab

HuntLab is a self-hostable Hypixel SkyBlock market-analysis application. Its C++ analysis library is independent of the web UI and market-data adapters. Estimates are decision support for manual in-game execution; HuntLab will not automate buying, bidding, clicking, or gameplay.

## Status

The Bazaar opportunity analyzer and the first Hunting Attribute Shard fusion slice are implemented and tested. See [`docs/STATUS.md`](docs/STATUS.md) for build/test evidence and remaining work, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for boundaries and data flow.

## Current analysis slices

One central collector fetches Hypixel's public Bazaar endpoint, validates the response and stores normalized observations in SQLite. The C++ core calculates conservative Bazaar flips and deterministic shard-fusion estimates from current books. A versioned API exposes the snapshot and opportunities; the responsive web UI shows the results, timestamps, assumptions and stale state. See `docs/ANALYSIS_STRATEGY.md` for estimator details and limitations.

## Development

The initial slice uses a C++20 analysis executable, a Node.js 24 REST/ingestion service with built-in SQLite, and a responsive HTML/CSS/ES-module UI. Bazaar screening and batch-sizing assumptions are documented in [`docs/ANALYSIS_STRATEGY.md`](docs/ANALYSIS_STRATEGY.md). The boundaries are documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for prerequisites and commands. Local toolchain availability and actual build status are tracked in [`docs/STATUS.md`](docs/STATUS.md).

## Data and licensing

The GitHub repository is currently licensed under GPL-3.0. Third-party code, game facts and market data have separate provenance and compatibility requirements; see [`docs/PROVENANCE.md`](docs/PROVENANCE.md) and [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
