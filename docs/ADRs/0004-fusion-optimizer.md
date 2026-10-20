# ADR 0004: fusion optimizer boundary

- **Status:** Accepted; staged implementation
- **Date:** 2026-10-19

Fusion rules will be versioned data normalized into an internal schema. Model input quantities, requirements, legal selectable outputs, random outcomes, and chance-based bonuses explicitly. Canonicalize symmetric input pairs only when verified game rules say their order is irrelevant. Keep rule import and validation separate from graph optimization. Bound recursion and expansion and report truncation. Do not ship optimization results from unverified data.

The current implementation provides a single-step C++ optimizer over the hash-pinned SkyShards catalogue and a paged, progressive UI explorer. The imported source structure is checked, but game requirements, unlocks, and special mechanics are not independently verified. Recursive target-route optimization and reason-coded non-positive candidate results remain future work; the UI must not infer a loss from an absent positive result.
