import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MarketStore } from '../../adapters/persistence/store.mjs';
import { parseBazaarResponse } from '../../adapters/hypixel/bazaar.mjs';
import { analyzeWithCpp } from '../../adapters/analysis/protocol.mjs';
import { createHuntlabServer } from '../../apps/server/src/server.mjs';

const analyzer = process.env.HUNTLAB_ANALYZER ?? resolve(
  `build/default/bin/huntlab_analysis_cli${process.platform === 'win32' ? '.exe' : ''}`,
);
const fixturePath = fileURLToPath(new URL('../fixtures/bazaar_snapshot.json', import.meta.url));

test('saved Hypixel response flows through validation, SQLite, C++, REST, and the web UI', async () => {
  const response = JSON.parse(await readFile(fixturePath, 'utf8'));
  const snapshot = parseBazaarResponse(response, response.lastUpdated + 250);
  const store = new MarketStore();
  const saved = store.saveSnapshot(snapshot);
  const now = () => snapshot.observed_at + 250;
  const app = createHuntlabServer({
    store,
    now,
    staleAfterMs: 5_000,
    analyze: (market, settings) => analyzeWithCpp(analyzer, market, settings),
    // Hold the background refresh so the offline fixture remains the single
    // deterministic source throughout this integration test.
    fetchSnapshot: () => new Promise(() => {}),
  });
  app.server.listen(0, '127.0.0.1');
  await new Promise((resolveListening) => app.server.once('listening', resolveListening));
  const origin = `http://127.0.0.1:${app.server.address().port}`;

  try {
    const latest = store.latestSnapshot();
    assert.equal(latest.id, saved.id);
    assert.ok(latest.products.some((product) => product.product_id === 'TEST_PRODUCT'));

    const apiResponse = await fetch(
      `${origin}/api/v1/opportunities/bazaar?tax_basis_points=500&capital_coins=1000&maximum_quantity=4`,
    );
    assert.equal(apiResponse.status, 200);
    const payload = await apiResponse.json();
    assert.equal(payload.snapshot_id, saved.id);
    assert.equal(payload.snapshot_timestamp, new Date(snapshot.observed_at).toISOString());
    assert.equal(payload.stale, false);
    assert.equal(payload.opportunities.length, 1);
    assert.equal(payload.opportunities[0].product_id, 'TEST_PRODUCT');
    assert.equal(payload.opportunities[0].quantity, 4);
    assert.equal(payload.opportunities[0].acquisition_cost_coins, '400');
    assert.equal(payload.opportunities[0].gross_proceeds_coins, '480');
    assert.equal(payload.opportunities[0].fee_coins, '24');
    assert.equal(payload.opportunities[0].net_profit_coins, '56');
    assert.equal(payload.opportunities[0].estimated_profit_per_hour_coins, '1166.666666');

    const pageResponse = await fetch(origin);
    assert.equal(pageResponse.status, 200);
    const html = await pageResponse.text();
    assert.match(html, /Bazaar opportunities/);
    assert.match(html, /Coins per hour/);
  } finally {
    await app.close();
    store.close();
  }
});
