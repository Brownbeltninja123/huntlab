import { spawn } from 'node:child_process';

const MAX_INPUT_BYTES = 64 * 1024 * 1024;

function encodeLevels(levels) {
  return levels.map(({ price_micros, amount, orders }) => `${price_micros}:${amount}:${orders}`).join(';');
}

export function encodeFusionRequest(snapshot, recipes, settings) {
  const lines = [`v1f\t${settings.tax_basis_points}\t${settings.capital_micros}\t${settings.maximum_quantity}\t${settings.minimum_weekly_volume}\t${settings.sale_horizon_hours}\t${settings.volume_share_basis_points}`];
  for (const p of snapshot.products) {
    lines.push(['P', p.product_id, p.conservative_weekly_volume ?? -1,
      encodeLevels(p.sell_offers), encodeLevels(p.buy_orders)].join('\t'));
  }
  for (const r of recipes) {
    lines.push(['R', r.recipe_id, r.output_product_id, r.output_quantity,
      r.first_input_product_id, r.first_input_quantity,
      r.second_input_product_id, r.second_input_quantity].join('\t'));
  }
  const request = `${lines.join('\n')}\n`;
  if (Buffer.byteLength(request) > MAX_INPUT_BYTES) throw new Error('fusion analysis request exceeds maximum input size');
  return request;
}

export function parseFusionOutput(output) {
  if (!output.trim()) return [];
  return output.trimEnd().split(/\r?\n/).map((line) => {
    const f = line.split('\t');
    if (f.length !== 13 || f[0] !== 'F' || !/^[A-Z0-9_:-]{1,128}$/.test(f[1])) {
      throw new Error('fusion engine returned malformed output');
    }
    const smallInts = [f[5], f[6], f[11]].map(Number);
    if (smallInts.some((value) => !Number.isSafeInteger(value)) ||
        !f.slice(7, 11).every((value) => /^-?[0-9]+$/.test(value)) || !/^-?[0-9]+$/.test(f[12])) {
      throw new Error('fusion engine returned invalid numbers');
    }
    return {
      recipe_id: f[1], output_product_id: f[2], first_input_product_id: f[3], second_input_product_id: f[4],
      operation_count: smallInts[0], output_quantity: smallInts[1], acquisition_cost_micros: BigInt(f[7]),
      gross_proceeds_micros: BigInt(f[8]), sale_fee_micros: BigInt(f[9]),
      net_profit_micros: BigInt(f[10]), roi_basis_points: smallInts[2],
      estimated_profit_per_hour_micros: BigInt(f[12]),
    };
  });
}

export function analyzeFusionWithCpp(executable, snapshot, recipes, settings, { timeoutMs = 20_000 } = {}) {
  const input = encodeFusionRequest(snapshot, recipes, settings);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    const timer = setTimeout(() => { child.kill(); reject(new Error(`fusion analyzer exceeded ${timeoutMs} ms`)); }, timeoutMs);
    child.on('error', (error) => { clearTimeout(timer); reject(new Error(`fusion analyzer could not run: ${error.message}`)); });
    child.stdout.on('data', (chunk) => { bytes += chunk.length; if (bytes > MAX_INPUT_BYTES) child.kill(); else stdout.push(chunk); });
    child.stderr.on('data', (chunk) => { if (Buffer.concat(stderr).length < 64 * 1024) stderr.push(chunk); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`fusion analyzer failed (${code ?? signal}): ${Buffer.concat(stderr).toString('utf8').slice(0, 500)}`));
      try { resolve(parseFusionOutput(Buffer.concat(stdout).toString('utf8'))); } catch (error) { reject(error); }
    });
    child.stdin.on('error', (error) => { child.kill(); clearTimeout(timer); reject(new Error(`fusion request could not be written: ${error.message}`)); });
    child.stdin.end(input);
  });
}
