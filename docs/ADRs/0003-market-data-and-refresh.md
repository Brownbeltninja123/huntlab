# ADR 0003: market data and refresh

- **Status:** Proposed
- **Date:** 2026-10-19

Use Hypixel's official Bazaar endpoint as the first live source. One server-side collector fetches and validates snapshots; browsers never call Hypixel directly. Persist only validated complete snapshots transactionally. Keep the last valid snapshot on upstream or persistence failure and expose freshness/degraded state. Configure refresh cadence, bound retries with backoff/jitter, and respect current API policies. Deduplicate identical snapshots by content hash.

Exact cadence, retention period, and stale thresholds require measurement and policy review before release; do not invent them in code.
