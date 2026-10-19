# Repository instructions

## Product boundaries

- Keep the C++ domain and analysis core independent of HTTP, persistence, JSON, and UI code.
- Do not duplicate profit, tax, or route calculations in adapters or the frontend.
- Do not invent prices, recipes, market freshness, or shard mechanics. Unknown inputs stay unknown and produce explicit warnings.
- Keep game execution manual. Do not add buying, bidding, clicking, packet manipulation, or unattended trading.
- Do not add third-party code or data without checking the exact source files, licence/terms, pinned revision, and provenance requirements.

## Contract and ownership rules

- Read `docs/DOMAIN_MODEL.md`, `docs/API.md`, and the relevant ADR before changing shared interfaces.
- Root CMake files, dependency manifests, OpenAPI, shared domain headers, migrations, CI, and provenance are owned by the lead integrator unless a task explicitly assigns them.
- Module ownership and handoff rules are in `docs/AGENT_WORKFLOW.md`.
- Keep pull requests focused. Report changed files, interface changes, assumptions, tests and commands run, licence/provenance changes, and limitations.
- Never make a feature claim until the required build and tests have passed.

## Style and correctness

- Use C++20, strict TypeScript, clang-format, ESLint, and Prettier configurations from this repository.
- Prefer integer/fixed-point coin arithmetic and explicit rounding rules.
- Give every result snapshot, settings, algorithm, and rule-version metadata.
- Treat external API payloads as untrusted input. Bound retries, payload sizes, pages, and optimizer work.
- Tests must be deterministic and must not require live network access. Use sanitized, source-labelled fixtures.
