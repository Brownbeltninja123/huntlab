import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchBazaarSnapshot, parseBazaarResponse } from './bazaar.mjs';

const validPayload = {
  success: true,
  lastUpdated: 1_800_000_000_000,
  products: {
    TEST_PRODUCT: {
      sell_summary: [
        { pricePerUnit: 11, amount: 4, orders: 2 },
        { pricePerUnit: 10, amount: 3, orders: 1 },
      ],
      buy_summary: [
        { pricePerUnit: 8, amount: 3, orders: 2 },
        { pricePerUnit: 9, amount: 4, orders: 1 },
      ],
      quick_status: { sellMovingWeek: 50_000, buyMovingWeek: 40_000 },
    },
  },
};

test('normalizes seller offers ascending and buyer orders descending', () => {
  const snapshot = parseBazaarResponse(validPayload, 1_800_000_000_001);
  assert.equal(snapshot.observed_at, 1_800_000_000_001);
  assert.equal(snapshot.source_updated_at, validPayload.lastUpdated);
  assert.deepEqual(snapshot.products[0].sell_offers.map((level) => level.price_micros), [10_000_000, 11_000_000]);
  assert.deepEqual(snapshot.products[0].buy_orders.map((level) => level.price_micros), [9_000_000, 8_000_000]);
  assert.equal(snapshot.products[0].conservative_weekly_volume, 40_000);
});

test('rejects incomplete, empty, and unsafe product data', () => {
  assert.throws(() => parseBazaarResponse({ success: false }), /success\/products/);
  assert.throws(() => parseBazaarResponse({ success: true, products: {} }), /outside accepted bounds/);
  assert.throws(() => parseBazaarResponse({
    success: true,
    lastUpdated: validPayload.lastUpdated,
    products: { BAD: { sell_summary: [{ pricePerUnit: 1, amount: 1.5, orders: 1 }], buy_summary: [] } },
  }, 1_800_000_000_001), /level/);
  assert.throws(() => parseBazaarResponse({ ...validPayload, lastUpdated: 0 }, 1_800_000_000_001), /lastUpdated/);
});

test('bounds retries and retries temporary upstream failures', async () => {
  let calls = 0;
  const snapshot = await fetchBazaarSnapshot({
    retries: 1,
    now: () => 1_800_000_000_001,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return { status: 503, ok: false };
      return { status: 200, ok: true, json: async () => validPayload };
    },
    sleep: async () => {},
  });
  assert.equal(calls, 2);
  assert.equal(snapshot.products.length, 1);
});

test('stops after the configured retry budget', async () => {
  let calls = 0;
  await assert.rejects(fetchBazaarSnapshot({
    retries: 2,
    fetchImpl: async () => {
      calls += 1;
      return { status: 503, ok: false };
    },
    sleep: async () => {},
  }), /HTTP 503/);
  assert.equal(calls, 3);
});
