const ITEMS_URL = 'https://api.hypixel.net/v2/resources/skyblock/items';

export function parseItemCatalog(payload) {
  if (payload?.success !== true || !Array.isArray(payload.items)) {
    throw new Error('Hypixel item resource is malformed');
  }
  return payload.items.flatMap((item) => {
    if (typeof item?.id !== 'string' || !/^[A-Z0-9_:-]{1,128}$/.test(item.id) ||
        typeof item.name !== 'string' || !item.name.trim()) return [];
    return [{
      product_id: item.id,
      name: item.name,
      material: typeof item.material === 'string' ? item.material : null,
      tier: typeof item.tier === 'string' ? item.tier : null,
    }];
  });
}

export function createItemCatalogFetcher({
  fetchImpl = fetch,
  now = Date.now,
  cacheTtlMs = 24 * 60 * 60 * 1000,
} = {}) {
  let cache = null;
  return async function fetchItemCatalog() {
    if (cache && now() - cache.fetchedAt < cacheTtlMs) return cache.items;
    const response = await fetchImpl(ITEMS_URL, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Hypixel item resource returned HTTP ${response.status}`);
    const items = parseItemCatalog(await response.json());
    cache = { fetchedAt: now(), items };
    return items;
  };
}
