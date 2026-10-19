import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFusionRequest, parseFusionOutput } from './protocol.mjs';

test('encodes fusion candidates and parses exact coin amounts', () => {
  const request = encodeFusionRequest({ products: [{ product_id: 'A', conservative_weekly_volume: 100,
    sell_offers: [{ price_micros: 10, amount: 2, orders: 1 }], buy_orders: [] }] }, [{
    recipe_id: 'OUT:A:B:2', output_product_id: 'OUT', output_quantity: 2,
    first_input_product_id: 'A', first_input_quantity: 1,
    second_input_product_id: 'B', second_input_quantity: 1,
  }], { tax_basis_points: 0, capital_micros: 1000, maximum_quantity: 4,
    minimum_weekly_volume: 0, sale_horizon_hours: 24, volume_share_basis_points: 500 });
  assert.match(request, /^v1f\t0\t1000/);
  const parsed = parseFusionOutput('F\tOUT:A:B:2\tOUT\tA\tB\t2\t4\t300\t500\t0\t200\t6666\t100\n');
  assert.equal(parsed[0].operation_count, 2);
  assert.equal(parsed[0].acquisition_cost_micros, 300n);
  assert.equal(parsed[0].estimated_profit_per_hour_micros, 100n);
});
