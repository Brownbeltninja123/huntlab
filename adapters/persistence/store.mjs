import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migrationUrl = new URL('../../db/migrations/001_market_snapshots.sql', import.meta.url);
const volumeMigrationUrl = new URL('../../db/migrations/002_weekly_volume.sql', import.meta.url);
const observationMigrationUrl = new URL('../../db/migrations/003_market_observations.sql', import.meta.url);

export class MarketStore {
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(readFileSync(migrationUrl, 'utf8'));
    const productColumns = this.db.prepare('PRAGMA table_info(market_products)').all();
    if (!productColumns.some((column) => column.name === 'conservative_weekly_volume')) {
      this.db.exec(readFileSync(volumeMigrationUrl, 'utf8'));
    }
    const snapshotColumns = this.db.prepare('PRAGMA table_info(market_snapshots)').all();
    if (!snapshotColumns.some((column) => column.name === 'source_updated_at_ms')) {
      this.db.exec(readFileSync(observationMigrationUrl, 'utf8'));
    }
    this.insertSnapshot = this.db.prepare(`
      INSERT INTO market_snapshots (source, content_hash, observed_at_ms, last_seen_at_ms, product_count, source_updated_at_ms)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(content_hash) DO UPDATE SET
        last_seen_at_ms = MAX(market_snapshots.last_seen_at_ms, excluded.last_seen_at_ms),
        source_updated_at_ms = MAX(market_snapshots.source_updated_at_ms, excluded.source_updated_at_ms)
      RETURNING id
    `);
    this.insertObservation = this.db.prepare(`
      INSERT INTO market_observations (snapshot_id, source_updated_at_ms, observed_at_ms, complete)
      VALUES (?, ?, ?, ?)
    `);
    this.insertProduct = this.db.prepare(`
      INSERT INTO market_products (snapshot_id, product_id, sell_offers_json, buy_orders_json, conservative_weekly_volume)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(snapshot_id, product_id) DO UPDATE SET
        sell_offers_json = excluded.sell_offers_json,
        buy_orders_json = excluded.buy_orders_json,
        conservative_weekly_volume = excluded.conservative_weekly_volume
    `);
  }

  saveSnapshot(snapshot) {
    if (!Number.isSafeInteger(snapshot.observed_at) || snapshot.observed_at <= 0 ||
        !Number.isSafeInteger(snapshot.source_updated_at) || snapshot.source_updated_at <= 0 ||
        !Array.isArray(snapshot.products) || snapshot.products.length === 0) {
      throw new Error('snapshot timestamps or product data are invalid');
    }
    const canonical = JSON.stringify(snapshot.products);
    const hash = createHash('sha256').update(canonical).digest('hex');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const snapshotRow = this.insertSnapshot.get(
        snapshot.source, hash, snapshot.observed_at, snapshot.observed_at, snapshot.products.length,
        snapshot.source_updated_at,
      );
      const snapshotId = Number(snapshotRow.id);
      this.insertObservation.run(snapshotId, snapshot.source_updated_at, snapshot.observed_at, 1);
      for (const product of snapshot.products) {
        this.insertProduct.run(
          snapshotId,
          product.product_id,
          JSON.stringify(product.sell_offers),
          JSON.stringify(product.buy_orders),
          product.conservative_weekly_volume ?? null,
        );
      }
      this.db.exec('COMMIT');
      return this.latestSnapshot() ?? { ...snapshot, id: snapshotId, stale: false };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  latestSnapshot() {
    const row = this.db.prepare(`
      SELECT s.id, s.source, o.observed_at_ms, o.source_updated_at_ms, s.product_count, o.complete
      FROM market_observations o JOIN market_snapshots s ON s.id = o.snapshot_id
      ORDER BY o.source_updated_at_ms DESC, o.observed_at_ms DESC, o.id DESC LIMIT 1
    `).get();
    if (!row) return null;
    const products = this.db.prepare(`
      SELECT product_id, sell_offers_json, buy_orders_json, conservative_weekly_volume
      FROM market_products WHERE snapshot_id = ? ORDER BY product_id
    `).all(row.id).map((product) => ({
      product_id: product.product_id,
      sell_offers: JSON.parse(product.sell_offers_json),
      buy_orders: JSON.parse(product.buy_orders_json),
      conservative_weekly_volume: product.conservative_weekly_volume == null
        ? null : Number(product.conservative_weekly_volume),
    }));
    return {
      id: Number(row.id),
      source: row.source,
      observed_at: Number(row.observed_at_ms),
      source_updated_at: Number(row.source_updated_at_ms),
      product_count: Number(row.product_count),
      complete: Boolean(row.complete),
      products,
    };
  }

  close() {
    this.db.close();
  }
}
