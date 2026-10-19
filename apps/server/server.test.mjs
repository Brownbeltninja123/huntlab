import test from 'node:test';
import assert from 'node:assert/strict';
import { MarketStore } from '../../adapters/persistence/store.mjs';
import { createHuntlabServer } from './src/server.mjs';
import { loadFusionCatalog } from '../../adapters/fusion/catalog.mjs';

const sampleSnapshot = {
  source: 'hypixel_bazaar',
  observed_at: 1_800_000_000_000,
  source_updated_at: 1_800_000_000_000,
  complete: true,
  products: [{ product_id: 'TEST_PRODUCT', sell_offers: [], buy_orders: [], conservative_weekly_volume: 280_000 }],
};

test('REST API exposes health, freshness, validation errors and C++ result contract', async () => {
  const store = new MarketStore();
  store.saveSnapshot(sampleSnapshot);
  const app = createHuntlabServer({
    store,
    now: () => 1_800_000_000_500,
    staleAfterMs: 10_000,
    fetchSnapshot: async () => sampleSnapshot,
    analyze: () => [{
      product_id: 'TEST_PRODUCT', quantity: 2,
      acquisition_cost_micros: 200_000_000,
      gross_proceeds_micros: 240_000_000,
      gross_profit_micros: 40_000_000,
      fee_micros: 300_000,
      net_profit_micros: 39_700_000,
      estimated_profit_per_hour_micros: 2_000_000,
      roi_basis_points: 1_985,
      acquisition_vwap_micros: 100_000_000,
      disposal_vwap_micros: 120_000_000,
      weekly_volume_cap: 100,
      acquisition_visible_depth: 10n,
      disposal_visible_depth: 12n,
      filled_quantity: 2,
      unfilled_quantity: 0,
      binding_constraint_flags: 2,
      conservative_weekly_volume: 280_000,
      risk_flags: 0,
    }],
    analyzeFusion: () => [],
    fetchPlayerProfile: async (username) => ({
      username, uuid: '0123456789abcdef0123456789abcdef', profile_name: 'Pomegranate',
      purse_coins: 1234.5, bank_coins: 99, fetched_at: new Date(1_800_000_000_500).toISOString(),
      balance_visibility: 'available',
    }),
    fetchItemCatalog: async () => [{
      product_id: 'TEST_PRODUCT', name: 'Test Product', material: 'DIAMOND', tier: 'UNCOMMON',
    }],
  });
  app.server.listen(0, '127.0.0.1');
  await new Promise((resolve) => app.server.once('listening', resolve));
  const address = app.server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const health = await fetch(`${origin}/api/v1/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ok');

    const profile = await fetch(`${origin}/api/v1/profile?username=Hunter`);
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).purse_coins, 1234.5);
    const itemResponse = await fetch(`${origin}/api/v1/items`);
    assert.deepEqual((await itemResponse.json()).items.map((item) => item.name), ['Test Product']);

    const status = await fetch(`${origin}/api/v1/status`);
    assert.equal((await status.json()).market_state, 'current');

    const invalid = await fetch(`${origin}/api/v1/opportunities/bazaar?tax_basis_points=-1&capital_coins=10`);
    assert.equal(invalid.status, 400);

    const response = await fetch(`${origin}/api/v1/opportunities/bazaar?tax_basis_points=125&capital_coins=1000&maximum_quantity=2`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.snapshot_id, 1);
    assert.equal(result.stale, false);
    assert.equal(result.opportunities[0].net_profit_coins, '39.7');
    assert.equal(result.opportunities[0].estimated_profit_per_hour_coins, '2');
    assert.equal(result.opportunities[0].buy_price_source, 'sell_summary (seller offers)');
    assert.equal(result.opportunities[0].weekly_volume_cap, 100);

    const fusionResponse = await fetch(`${origin}/api/v1/opportunities/fusion?tax_basis_points=125&capital_coins=1000&maximum_quantity=2`);
    assert.equal(fusionResponse.status, 200);
    const fusion = await fusionResponse.json();
    assert.equal(fusion.catalog.revision, 'bc767f820318ab0ae2ce6bd5150c7095dd00da12');
    assert.equal(fusion.assumptions.output_basis, 'guaranteed_selected_output_only');
    assert.deepEqual(fusion.opportunities, []);
  } finally {
    await app.close();
    store.close();
  }
});

test('server reports a stale last snapshot when upstream refresh fails', async () => {
  const store = new MarketStore();
  store.saveSnapshot(sampleSnapshot);
  const app = createHuntlabServer({
    store,
    now: () => 1_800_000_001_000,
    staleAfterMs: 100,
    fetchSnapshot: async () => { throw new Error('fixture upstream failure'); },
    analyze: () => [],
  });
  app.server.listen(0, '127.0.0.1');
  await new Promise((resolve) => app.server.once('listening', resolve));
  const address = app.server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/status`);
    const status = await response.json();
    assert.equal(status.market_state, 'unavailable');
    assert.equal(status.snapshot_id, 1);
    assert.equal(status.last_error, 'fixture upstream failure');
  } finally {
    await app.close();
    store.close();
  }
});

test('fusion endpoint exposes pinned recipe requirements and market depth with the analysis result', async () => {
  const recipe = (await loadFusionCatalog()).recipes[0];
  const store = new MarketStore();
  const products = [recipe.first_input_product_id, recipe.second_input_product_id, recipe.output_product_id]
    .map((product_id) => ({ product_id, sell_offers: [{ price_micros: 100, amount: 50, orders: 1 }],
      buy_orders: [{ price_micros: 150, amount: 60, orders: 1 }], conservative_weekly_volume: 1_000_000 }));
  store.saveSnapshot({ ...sampleSnapshot, products });
  let seenRecipe;
  const app = createHuntlabServer({
    store,
    now: () => sampleSnapshot.observed_at + 500,
    fetchSnapshot: () => new Promise(() => {}),
    analyzeFusion: (_snapshot, recipes) => {
      seenRecipe = recipes.find((candidate) => candidate.recipe_id === recipe.recipe_id);
      return [{ recipe_id: recipe.recipe_id, output_product_id: recipe.output_product_id,
        first_input_product_id: recipe.first_input_product_id, second_input_product_id: recipe.second_input_product_id,
        operation_count: 2, output_quantity: 4, acquisition_cost_micros: 1_400n,
        gross_proceeds_micros: 600n, sale_fee_micros: 0n, net_profit_micros: 0n,
        roi_basis_points: 0, estimated_profit_per_hour_micros: 0n }];
    },
  });
  app.server.listen(0, '127.0.0.1');
  await new Promise((resolve) => app.server.once('listening', resolve));
  try {
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    const response = await fetch(`${origin}/api/v1/opportunities/fusion?tax_basis_points=0&capital_coins=1000&minimum_weekly_volume=0`);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(seenRecipe.first_input_quantity, recipe.first_input_quantity);
    assert.ok(result.catalog.recipes_considered >= 1);
    assert.equal(result.opportunities[0].inputs[0].quantity_total, recipe.first_input_quantity * 2);
    assert.equal(result.opportunities[0].inputs[1].quantity_per_fusion, recipe.second_input_quantity);
    assert.equal(result.opportunities[0].visible_output_depth, '60');
  } finally {
    await app.close();
    store.close();
  }
});
