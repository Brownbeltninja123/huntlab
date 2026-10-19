import { spawn } from 'node:child_process';

const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

function assertInteger(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label} is outside supported bounds`);
  }
}

function encodeLevels(levels) {
  return levels.map(({ price_micros, amount, orders }) => {
    assertInteger(price_micros, 'price_micros', { min: 1 });
    assertInteger(amount, 'amount', { min: 1 });
    assertInteger(orders, 'orders');
    return `${price_micros}:${amount}:${orders}`;
  }).join(';');
}

export function encodeAnalysisRequest(snapshot, settings) {
  assertInteger(settings.tax_basis_points, 'tax_basis_points', { max: 10_000 });
  assertInteger(settings.capital_micros, 'capital_micros');
  assertInteger(settings.maximum_quantity, 'maximum_quantity', { min: 1, max: 1_000_000 });
  assertInteger(settings.minimum_weekly_volume, 'minimum_weekly_volume', { max: 1_000_000_000_000 });
  assertInteger(settings.sale_horizon_hours, 'sale_horizon_hours', { min: 1, max: 168 });
  assertInteger(settings.volume_share_basis_points, 'volume_share_basis_points', { min: 1, max: 10_000 });
  const rows = [`v3\t${settings.tax_basis_points}\t${settings.capital_micros}\t${settings.maximum_quantity}\t${settings.minimum_weekly_volume}\t${settings.sale_horizon_hours}\t${settings.volume_share_basis_points}`];
  for (const product of snapshot.products) {
    if (!/^[A-Z0-9_:-]{1,128}$/.test(product.product_id)) {
      throw new Error('invalid product_id for analysis protocol');
    }
    rows.push([
      'P',
      product.product_id,
      product.conservative_weekly_volume ?? -1,
      encodeLevels(product.sell_offers),
      encodeLevels(product.buy_orders),
    ].join('\t'));
  }
  const input = `${rows.join('\n')}\n`;
  if (Buffer.byteLength(input) > MAX_INPUT_BYTES) {
    throw new Error('analysis request exceeds maximum input size');
  }
  return input;
}

export function parseAnalysisOutput(output) {
  const lines = output.trim() ? output.trimEnd().split(/\r?\n/) : [];
  return lines.map((line) => {
    const columns = line.split('\t');
    if (columns.length !== 20 || columns[0] !== 'O') {
      throw new Error('analysis engine returned malformed output');
    }
    const [type, product_id, quantity, acquisition, gross, fee, net, roi, buy_vwap, sell_vwap,
      weekly_cap, risk_flags, hourly_profit, gross_profit, acquisition_depth, disposal_depth,
      filled_quantity, unfilled_quantity, binding_constraints, weekly_volume] = columns;
    const numericValues = [quantity, roi, weekly_cap, risk_flags,
      filled_quantity, unfilled_quantity, binding_constraints, weekly_volume].map(Number);
    const moneyValues = [acquisition, gross, fee, net, buy_vwap, sell_vwap, hourly_profit, gross_profit];
    if (!/^[A-Z0-9_:-]{1,128}$/.test(product_id) ||
        !/^[0-9]+$/.test(acquisition_depth) || !/^[0-9]+$/.test(disposal_depth) ||
        !/^[0-9]+$/.test(hourly_profit) ||
        numericValues.some((value) => !Number.isSafeInteger(value)) ||
        !moneyValues.every((value) => /^-?[0-9]+$/.test(value))) {
      throw new Error('analysis engine returned invalid numeric output');
    }
    const [quantityValue, roiValue, weeklyCapValue, riskFlags,
      filledQuantity, unfilledQuantity, bindingConstraintFlags] = numericValues;
    const [acquisitionValue, grossValue, feeValue, netValue, buyVwapValue, sellVwapValue,
      hourlyProfitValue, grossProfitValue] =
      moneyValues.map(BigInt);
    return {
      product_id,
      quantity: quantityValue,
      acquisition_cost_micros: acquisitionValue,
      gross_proceeds_micros: grossValue,
      fee_micros: feeValue,
      net_profit_micros: netValue,
      roi_basis_points: roiValue,
      acquisition_vwap_micros: buyVwapValue,
      disposal_vwap_micros: sellVwapValue,
      weekly_volume_cap: weeklyCapValue,
      risk_flags: riskFlags,
      estimated_profit_per_hour_micros: BigInt(hourly_profit),
      gross_profit_micros: grossProfitValue,
      acquisition_visible_depth: BigInt(acquisition_depth),
      disposal_visible_depth: BigInt(disposal_depth),
      filled_quantity: filledQuantity,
      unfilled_quantity: unfilledQuantity,
      binding_constraint_flags: bindingConstraintFlags,
      conservative_weekly_volume: numericValues[7],
    };
  });
}

export function analyzeWithCpp(executable, snapshot, settings, { timeoutMs = 10_000 } = {}) {
  const input = encodeAnalysisRequest(snapshot, settings);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let errorBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error(`analysis engine exceeded ${timeoutMs} ms`));
    }, timeoutMs);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    }

    child.on('error', (error) => finish(new Error(`analysis engine could not run: ${error.message}`)));
    child.stdout.on('data', (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(new Error('analysis engine output exceeds maximum size'));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (errorBytes < 64 * 1024) {
        const remaining = 64 * 1024 - errorBytes;
        stderr.push(chunk.subarray(0, remaining));
        errorBytes += Math.min(chunk.length, remaining);
      }
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString('utf8').slice(0, 500);
        finish(new Error(`analysis engine failed (${code ?? signal}): ${detail}`));
        return;
      }
      try {
        finish(null, parseAnalysisOutput(Buffer.concat(stdout).toString('utf8')));
      } catch (error) {
        finish(error);
      }
    });
    child.stdin.on('error', (error) => {
      if (!settled) finish(new Error(`analysis request could not be written: ${error.message}`));
    });
    child.stdin.end(input);
  });
}
