# ADR 0001: modular monolith and initial stack

- **Status:** Proposed for first vertical slice
- **Date:** 2026-10-19

## Decision

Build a C++20 standalone domain/analysis library and command-line adapter using CMake. Keep market ingestion, persistence, and REST in a Node.js 24 service using built-in `fetch`, `node:http`, and `node:sqlite`; the service invokes the C++ analyzer through a versioned, tab-delimited standard-input/output protocol. Use a native HTML/CSS/ES-module frontend for the first slice, with no production market fixtures or client-side calculations. Add dependencies only when a feature needs them and records their license/provenance.

## Rationale

The design preserves a typed C++ calculation core independent of UI/network/persistence, clean adapter boundaries, one poller, and a straightforward self-hosted deployment. The small process boundary makes the first vertical slice buildable without a large framework dependency. A modular monolith keeps the initial operational cost low while allowing Auction House adapters and analysis to be added later.

## Consequences and open checks

The GPL-3 project license requires dependency and data compatibility review. Pin the Node major version in development and CI. Confirm CMake and compiler availability plus Windows/Linux support in CI before declaring the stack frozen. The first web interface uses browser standards and needs no dependency lockfile. If the process boundary becomes a performance bottleneck, replace it only through a documented ADR and retain one canonical C++ implementation.
