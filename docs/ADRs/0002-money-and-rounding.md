# ADR 0002: coin representation and rounding

- **Status:** Proposed; must be finalized before calculation implementation
- **Date:** 2026-10-19

Represent coin prices with signed 64-bit integer fixed-point units. Preserve source precision at parse time; reject values that exceed the supported decimal scale or integer range. Quantities are positive integers. Tax is configured in basis points and applied only to the verified taxed side. Use checked intermediate arithmetic and round fees upward to the smallest coin unit as a conservative estimate. ROI is basis points; omit it when acquisition cost is zero. Store API coin values as decimal integer strings.

Before merging calculation code, confirm the API/game price precision and tax semantics and add hand-calculated boundary tests. No default tax rate is implied by this ADR.
