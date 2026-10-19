# Agent workflow and ownership

## Contract-first rule

The integrator owns `docs/DOMAIN_MODEL.md`, `openapi/openapi.yaml`, root build/dependency files, shared C++ domain headers, CI, migrations, and provenance. Feature implementation begins only after those interfaces are frozen.

## Suggested bounded ownership after contracts freeze

| Workstream | Exclusive ownership |
|---|---|
| Hypixel ingestion | `adapters/hypixel/`, parser fixtures and its tests |
| C++ Bazaar analysis | `core/`, `tests/unit/` |
| Persistence | `adapters/persistence/`, `db/migrations/` |
| REST service | `adapters/http/`, `apps/server/` |
| Web shell and Bazaar view | `apps/web/public/` |
| Engine process protocol | `adapters/analysis/` |
| Integration review | `tests/integration/`, contract compatibility review |

No two contributors edit a shared contract or root build file concurrently. Work on isolated branches, submit small changes for review, and report changed files, decisions, public interface changes, assumptions, tests/commands, provenance changes, risks, and remaining work. Add tests with each module. The integrator owns merges and cross-module fixes.

## Handoff template

```text
Purpose:
Files/modules changed:
Public interfaces changed:
Assumptions and sources:
Tests and exact commands:
Licence/provenance changes:
Known limitations:
Follow-up:
```
