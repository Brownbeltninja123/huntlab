# Web UI

The UI is a same-origin responsive HTML/CSS/ES-module application served by the Node API service. `public/app.js` owns the app shell, Bazaar view, shared trade assumptions, and browser-history routing. `/fusion` is a separate full-page workspace. `public/fusion-page.js` owns catalog/API state, search, filters, discovery, and recipe detail views; `public/fusion-graph.js` contains pure graph preparation and sorting helpers. The graph is rendered with bounded native SVG, without a third-party graph dependency.

The fusion graph begins at one selected output, shows at most four direct recipe branches when expanded, and progressively requests ingredient recipes in pages of 100. It never recursively loads the entire 129k-edge graph. Shared inputs are deduplicated. Focused details and the textual alternative list remain available when users do not navigate the graph.

The UI formats API values and displays freshness, source, assumptions, and uncertainty. It contains no price, tax, or profit calculation logic and no market values are mocked into production pages. The C++ engine returns the ingredient acquisition-cost breakdown and all opportunity profitability fields. Catalogue validation is structural only; game requirements and special cases remain unverified. The single-step opportunity API omits non-positive candidates, so a missing positive result is not labelled a loss.

Run the app with the commands in the root `README.md`. The browser smoke path is `/fusion`; deterministic graph logic and API routes are covered by `tests/unit/fusion_graph.test.mjs` and `apps/server/server.test.mjs`.
