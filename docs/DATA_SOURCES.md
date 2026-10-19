# Data sources

## Hypixel public API

- Endpoint: `GET https://api.hypixel.net/v2/skyblock/bazaar`.
- Role: primary source for Bazaar product summaries and quick status.
- Documented response: buy/sell summaries plus weighted quick-status prices, active-order totals/counts, and moving-week transacted volumes. Summary arrays expose the current top 30 orders for each transaction type. The endpoint can return 503 when its data has not yet populated.
- Refresh: one configurable server-side poll loop; use bounded retries and honor rate-limit information/policies. Do not poll once per user or attempt to evade limits.
- Retention: store normalized observations only as required by the documented local retention policy; label the source and observed time.
- Terms: recheck the current Hypixel API policy before release. Public access does not imply unrestricted republication rights.
- Item presentation: `GET /v2/resources/skyblock/items` supplies item IDs, display names, materials, and tiers; `GET /v2/resources/packs` supplies current Hypixel resource-pack URLs. The metadata endpoint does not directly provide a browser-ready icon URL. The UI uses official display names and a readable ID fallback; resource-pack icon mapping and asset redistribution need separate review.
- Profile lookup: `GET /v2/player` resolves a supplied username, then `GET /v2/skyblock/profiles` returns visible SkyBlock profile data and documented profile banking. Both require a server-side API key; returned data depends on in-game API settings. The UI initiates lookups manually and caches them locally for one hour. Hypixel policy disallows continuous polling of player data, requires API keys not be shared with third parties, and can change; recheck [the current API policy](https://developer.hypixel.net/policies/) before release. Profile lookup is informational, not an ownership-authentication flow.

## Fusion and recipe data

No fusion or recipe dataset is approved for production use yet. Candidate sources and their files must be pinned and reviewed in `PROVENANCE.md`; community game facts require independent current validation. Do not copy data until its applicable license and terms are recorded.
