import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { analyzeFusionWithCpp } from '../../adapters/fusion/protocol.mjs';
import { loadFusionCatalog } from '../../adapters/fusion/catalog.mjs';

const executable = resolve(`build/default/bin/huntlab_fusion_cli${process.platform === 'win32' ? '.exe' : ''}`);

test('fusion protocol runs the C++ optimizer using ingredient requirements and guaranteed output', async () => {
  const snapshot = { products: [
    { product_id: 'A', conservative_weekly_volume: 1_000_000,
      sell_offers: [{ price_micros: 100, amount: 5, orders: 2 }], buy_orders: [] },
    { product_id: 'B', conservative_weekly_volume: 1_000_000,
      sell_offers: [{ price_micros: 200, amount: 5, orders: 2 }], buy_orders: [] },
    { product_id: 'OUT', conservative_weekly_volume: 1_000_000,
      sell_offers: [], buy_orders: [{ price_micros: 500, amount: 10, orders: 3 }] },
  ] };
  const recipes = [{ recipe_id: 'OUT:A:B:2', output_product_id: 'OUT', output_quantity: 2,
    first_input_product_id: 'A', first_input_quantity: 1,
    second_input_product_id: 'B', second_input_quantity: 1 }];
  const result = await analyzeFusionWithCpp(executable, snapshot, recipes, {
    tax_basis_points: 0, capital_micros: 10_000, maximum_quantity: 5,
    minimum_weekly_volume: 0, sale_horizon_hours: 24, volume_share_basis_points: 500,
  });
  assert.equal(result[0].operation_count, 5);
  assert.equal(result[0].output_quantity, 10);
  assert.equal(result[0].net_profit_micros, 3_500n);
});

test('fusion CLI accepts the complete pinned recipe graph within bounded protocol limits', async () => {
  const catalog = await loadFusionCatalog();
  const result = await analyzeFusionWithCpp(executable, { products: [] }, catalog.recipes, {
    tax_basis_points: 0, capital_micros: 10_000, maximum_quantity: 5,
    minimum_weekly_volume: 0, sale_horizon_hours: 24, volume_share_basis_points: 500,
  });
  assert.equal(catalog.recipes.length, 129_289);
  assert.deepEqual(result, []);
});
