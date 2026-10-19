# Provenance and reuse register

No external executable code has been copied into HuntLab. The pinned SkyShards fusion data is imported as documented below.

## Project license

The GitHub repository currently contains a GNU General Public License version 3 text. Treat the project as GPL-3.0 unless the owner deliberately changes it. Check every dependency and copied component for compatibility and keep its copyright/license notices. This engineering screening is not legal advice.

## Research references (study only; no code/data imported)

| Source | Current license finding | Decision |
|---|---|---|
| [Bazaar Calc](https://github.com/Goofythesecond/bazaar-calc) | MIT for code, with named wiki-derived files under CC BY-NC-SA 3.0 | Architecture reference only pending file/dependency review; do not import wiki-derived data |
| [SkyShards](https://github.com/Campionnn/SkyShards) | MIT | Pinned `public/fusion-data.json` imported; source revision and file hash below |
| [Hypixie](https://github.com/skermiebroTech/skyblock) | GPL-3.0-or-later | Reference only; do not copy code without compatibility review |
| [Hypixel Bazaar Flipper](https://github.com/julesgtz/hypixel-bazaar-flipper) | MIT | Independent baseline reference; no code imported |
| [Crefax Bazaar API](https://github.com/Crefax/bazaar-api) | GPL-3.0 as reported in handoff; exact revision/file review remains | Reference only |
| [Bazcal](https://github.com/Wykerd/bazcal) | AGPL-3.0-or-later as reported in handoff | Reference only |
| FlipShards and unlicensed/unclear projects | License not confirmed | No copying |

## Imported fusion dataset

- Upstream: [SkyShards](https://github.com/Campionnn/SkyShards), path `public/fusion-data.json`
- Revision: `bc767f820318ab0ae2ce6bd5150c7095dd00da12`
- SHA-256: `52ebf05761c7858a18baab2dcafd3c5ab09e841373554dda0d8332917e864391`
- License: MIT; notice retained at `data/fusion/LICENSE-SkyShards`
- Local path: `data/fusion/fusion-data.json`
- Validation: 322 shard records, 129,289 recipe edges, all references resolve, only output yields 1 and 2; runtime loader verifies hash and validates the schema before analysis.
- Modifications: none to source JSON. The adapter maps source shard keys to Hypixel `internal_id`; chance bonuses are excluded.
- Validation limit: tests verify data integrity and optimizer math, not every recipe against in-game fusion outcomes. Treat special recipes as needing in-game confirmation.

## Import record template

For each imported item record: component, upstream URL, exact commit SHA, upstream path, SHA-256, license/terms, local path, modifications, notices, tests, and review status. Keep source code, datasets, game facts, market records, assets, dependencies, and API terms as separate entries.
