const MICROS_PER_COIN = 1_000_000;
const MAX_PRODUCTS = 20_000;
const MAX_LEVELS = 30;

function toMicros(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`invalid ${field}`);
  }
  const scaled = Math.round(value * MICROS_PER_COIN);
  if (!Number.isSafeInteger(scaled) || Math.abs(value - scaled / MICROS_PER_COIN) > 0.00000051) {
    throw new Error(`unsupported precision or range in ${field}`);
  }
  return scaled;
}

function parseLevels(raw, field, sortDescending) {
  if (!Array.isArray(raw) || raw.length > MAX_LEVELS) {
    throw new Error(`invalid ${field}`);
  }
  const levels = raw.map((level) => {
    if (!level || !Number.isSafeInteger(level.amount) || level.amount <= 0 ||
        !Number.isSafeInteger(level.orders) || level.orders < 0) {
      throw new Error(`invalid ${field} level`);
    }
    return {
      price_micros: toMicros(level.pricePerUnit, `${field}.pricePerUnit`),
      amount: level.amount,
      orders: level.orders,
    };
  });
  levels.sort((a, b) => sortDescending
    ? b.price_micros - a.price_micros
    : a.price_micros - b.price_micros);
  return levels;
}

export function parseBazaarResponse(payload, observedAt = Date.now()) {
  if (!payload || payload.success !== true || !payload.products ||
      typeof payload.products !== 'object' || Array.isArray(payload.products)) {
    throw new Error('Hypixel Bazaar response is missing success/products');
  }
  const entries = Object.entries(payload.products);
  if (entries.length === 0 || entries.length > MAX_PRODUCTS) {
    throw new Error('Hypixel Bazaar product count is outside accepted bounds');
  }
  if (!Number.isSafeInteger(observedAt) || observedAt <= 0 ||
      !Number.isSafeInteger(payload.lastUpdated) || payload.lastUpdated <= 0 ||
      payload.lastUpdated > observedAt + 60_000) {
    throw new Error('Hypixel Bazaar response has an invalid lastUpdated timestamp');
  }
  const products = entries.map(([productId, raw]) => {
    if (!/^[A-Z0-9_:-]{1,128}$/.test(productId) || !raw ||
        !Array.isArray(raw.sell_summary) || !Array.isArray(raw.buy_summary)) {
      throw new Error(`invalid Bazaar product ${productId}`);
    }
    const quick = raw.quick_status;
    const weeklyVolumes = [quick?.buyMovingWeek, quick?.sellMovingWeek];
    const hasWeeklyVolumes = weeklyVolumes.every((value) => Number.isSafeInteger(value) && value >= 0);
    return {
      product_id: productId,
      conservative_weekly_volume: hasWeeklyVolumes ? Math.min(...weeklyVolumes) : null,
      // Hypixel sells are offers to buyers; these are acquisition costs.
      sell_offers: parseLevels(raw.sell_summary, `${productId}.sell_summary`, false),
      // Hypixel buys are bids from buyers; these are disposal proceeds.
      buy_orders: parseLevels(raw.buy_summary, `${productId}.buy_summary`, true),
    };
  });

  return {
    source: 'hypixel_bazaar',
    observed_at: observedAt,
    source_updated_at: payload.lastUpdated,
    complete: true,
    products,
  };
}

export async function fetchBazaarSnapshot({
  fetchImpl = fetch,
  apiKey = '',
  retries = 2,
  timeoutMs = 8_000,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let retryDelayMs = null;
    try {
      const headers = apiKey ? { 'API-Key': apiKey } : {};
      const response = await fetchImpl('https://api.hypixel.net/v2/skyblock/bazaar', {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers?.get?.('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter >= 0) {
          retryDelayMs = Math.min(retryAfter * 1_000, 30_000);
        }
        throw new Error('Hypixel API returned HTTP 429');
      }
      if (response.status >= 500) {
        throw new Error(`Hypixel API returned HTTP ${response.status}`);
      }
      if (!response.ok) {
        throw new Error(`Hypixel API returned HTTP ${response.status}`);
      }
      return parseBazaarResponse(await response.json(), now());
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const exponential = retryDelayMs ?? Math.min(250 * (2 ** attempt), 2_000);
        const jitter = Math.floor(Math.random() * 100);
        await sleep(exponential + jitter);
      }
    }
  }
  throw lastError ?? new Error('Hypixel API fetch failed');
}
