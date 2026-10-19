# Server and adapters

The Node.js 24 service owns Hypixel HTTP, payload validation, SQLite persistence, and REST serialization. It never computes profit formulas. Bazaar and shard-fusion opportunities are requested from separate standalone C++ executables through the bounded protocols in `adapters/analysis/protocol.mjs` and `adapters/fusion/protocol.mjs`; child processes are launched without a shell.

Run from the repository root after building: `node apps/server/src/main.mjs`. Configure the binaries with `HUNTLAB_ANALYZER` and `HUNTLAB_FUSION_ANALYZER` if they are not in the default CMake preset paths. Fusion recipe data is hash-checked on load and source/license details are recorded in `docs/PROVENANCE.md`.
