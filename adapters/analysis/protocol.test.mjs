import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAnalysisRequest, parseAnalysisOutput } from './protocol.mjs';

const settings = {
  tax_basis_points: 125,
  capital_micros: 100,
  maximum_quantity: 2,
  minimum_weekly_volume: 10_000,
  sale_horizon_hours: 24,
  volume_share_basis_points: 500,
};

test('serializes typed normalized markets into protocol v3', () => {
  const input = encodeAnalysisRequest({ products: [{
    product_id: 'TEST_PRODUCT',
    conservative_weekly_volume: 280_000,
    sell_offers: [{ price_micros: 10, amount: 2, orders: 1 }],
    buy_orders: [{ price_micros: 12, amount: 2, orders: 1 }],
  }] }, settings);
  assert.equal(input, 'v3\t125\t100\t2\t10000\t24\t500\nP\tTEST_PRODUCT\t280000\t10:2:1\t12:2:1\n');
});

test('rejects invalid or oversized settings before spawning the engine', () => {
  assert.throws(() => encodeAnalysisRequest({ products: [] }, {
    ...settings, tax_basis_points: 10_001,
  }), /tax_basis_points/);
  assert.throws(() => encodeAnalysisRequest({ products: [] }, {
    ...settings, tax_basis_points: 0, maximum_quantity: 1_000_001,
  }), /maximum_quantity/);
});

test('parses monetary output exactly, including values beyond JavaScript safe integers', () => {
  const result = parseAnalysisOutput(
    'O\tTEST_PRODUCT\t2\t9007199254740993\t9007199254741993\t100\t9007199254741893\t1250\t4503599627370497\t4503599627370996\t20\t5\t1234567\t1000\t9007199254740993\t9007199254740994\t2\t0\t2\t280000\n',
  );
  assert.equal(result[0].acquisition_cost_micros, 9_007_199_254_740_993n);
  assert.equal(result[0].net_profit_micros, 9_007_199_254_741_893n);
  assert.equal(result[0].quantity, 2);
  assert.equal(result[0].risk_flags, 5);
  assert.equal(result[0].estimated_profit_per_hour_micros, 1_234_567n);
  assert.equal(result[0].gross_profit_micros, 1_000n);
  assert.equal(result[0].acquisition_visible_depth, 9_007_199_254_740_993n);
  assert.equal(result[0].unfilled_quantity, 0);
  assert.equal(result[0].binding_constraint_flags, 2);
  assert.equal(result[0].conservative_weekly_volume, 280_000);
});
