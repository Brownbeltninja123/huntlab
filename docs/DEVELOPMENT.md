# Development

## Requirements

- CMake 3.25 or newer.
- C++20 compiler (MSVC, Clang, or GCC).
- Ninja (the checked-in CMake preset uses it).
- Node.js 24.19 or newer (the server and tests use built-in Node modules only).

## Configure, build, and test

From the repository root:

```powershell
cmake --preset default
cmake --build --preset default
ctest --preset default --output-on-failure
$env:HUNTLAB_ANALYZER = (Resolve-Path .\build\default\bin\huntlab_analysis_cli.exe).Path
$env:HUNTLAB_FUSION_ANALYZER = (Resolve-Path .\build\default\bin\huntlab_fusion_cli.exe).Path
$node = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" # or node.exe if installed on PATH
$tests = rg --files -g '*.test.mjs'
& $node --test $tests
```

On Linux/macOS, use `build/default/bin/huntlab_analysis_cli` and `build/default/bin/huntlab_fusion_cli`. Both environment variables are optional when using the default CMake preset paths. They should point to the executables built from the current source tree.

Run the app with `node apps/server/src/main.mjs` after building. It listens on `127.0.0.1:8080` by default, refreshes one central Bazaar snapshot, and stores normalized observations in the local SQLite database. If using `.env`, Node 24 can load it directly: `node --env-file=.env apps/server/src/main.mjs`.

The local UI lets the user set sale-tax basis points, capital, batch/operation size, minimum weekly trading volume, sale window, expected share of weekly activity, and maximum market-data age. These are explicit assumptions, not inferred facts. Use the **Shard fusion** navigation entry to evaluate guaranteed-output recipes against current Bazaar books; the selected SkyShards output and every input remain manually executed in game.

To enable the optional profile lookup, put your registered Hypixel developer API key in the ignored `.env` file as `HYPIXEL_API_KEY=...`, then launch with Node's built-in env-file support: `node --env-file=.env apps/server/src/main.mjs`. The key is sent only from the server to Hypixel and is never returned to the browser. Profile lookup is an explicit action, is restricted to localhost, and is cached for one hour. It does not authenticate account ownership or use a Minecraft password/session token. Hypixel profile visibility settings may omit purse or other values. Do not expose this local service to the internet without authentication and a policy review.

## Formatting and static checks

- C++: run `clang-format -i` on `.cpp` and `.hpp` files; `.clang-format` is authoritative.
- All files: UTF-8, LF, final newline, two-space indentation except C++ (four spaces), as specified by `.editorconfig`.
- JSON/YAML/Markdown/JS: follow `.prettierrc.json` conventions (semicolons, single quotes in JS, trailing commas, 100-column target).
- CI runs `git diff --check`, `clang-format --dry-run --Werror`, the C++ build/CTest suite, Node syntax checks, and deterministic Node tests.
