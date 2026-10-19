import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MarketStore } from './store.mjs';

const snapshot = (observed_at = 1_800_000_000_000) => ({
  source: 'hypixel_bazaar',
  observed_at,
  source_updated_at: observed_at,
  complete: true,
  products: [{
    product_id: 'TEST_PRODUCT',
    conservative_weekly_volume: 280_000,
    sell_offers: [{ price_micros: 10_000_000, amount: 3, orders: 1 }],
    buy_orders: [{ price_micros: 11_000_000, amount: 3, orders: 1 }],
  }],
});

test('stores a snapshot and retrieves normalized levels', () => {
  const store = new MarketStore();
  try {
    const saved = store.saveSnapshot(snapshot());
    const latest = store.latestSnapshot();
    assert.equal(saved.id, latest.id);
    assert.deepEqual(latest.products, snapshot().products);
  } finally {
    store.close();
  }
});

test('deduplicates content while preserving each observation and rejects out-of-order latest data', () => {
  const store = new MarketStore();
  try {
    const first = store.saveSnapshot(snapshot());
    const second = store.saveSnapshot(snapshot(1_800_000_000_500));
    assert.equal(first.id, second.id);
    assert.equal(store.latestSnapshot().observed_at, 1_800_000_000_500);
    store.saveSnapshot(snapshot(1_800_000_000_250));
    assert.equal(store.latestSnapshot().observed_at, 1_800_000_000_500);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM market_observations').get().count, 3);
  } finally {
    store.close();
  }
});

test('rejects invalid source timestamps before persistence', () => {
  const store = new MarketStore();
  try {
    assert.throws(() => store.saveSnapshot({ ...snapshot(), source_updated_at: 0 }), /timestamps/);
  } finally {
    store.close();
  }
});

test('upgrades an existing database with the weekly-volume column', () => {
  const directory = mkdtempSync(join(tmpdir(), 'huntlab-migration-'));
  const path = join(directory, 'legacy.db');
  const legacyDb = new DatabaseSync(path);
  legacyDb.exec(`
    CREATE TABLE market_snapshots (
      id INTEGER PRIMARY KEY, source TEXT NOT NULL, content_hash TEXT NOT NULL UNIQUE,
      observed_at_ms INTEGER NOT NULL, last_seen_at_ms INTEGER NOT NULL,
      product_count INTEGER NOT NULL CHECK (product_count > 0)
    );
    CREATE TABLE market_products (
      snapshot_id INTEGER NOT NULL, product_id TEXT NOT NULL, sell_offers_json TEXT NOT NULL,
      buy_orders_json TEXT NOT NULL, PRIMARY KEY (snapshot_id, product_id)
    );
  `);
  legacyDb.close();
  const store = new MarketStore(path);
  try {
    const saved = store.saveSnapshot(snapshot());
    assert.equal(saved.id, store.latestSnapshot().id);
    assert.equal(store.latestSnapshot().products[0].conservative_weekly_volume, 280_000);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
