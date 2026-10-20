import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBazaarSnapshot } from '../../../adapters/hypixel/bazaar.mjs';
import { createPlayerProfileFetcher } from '../../../adapters/hypixel/player.mjs';
import { createItemCatalogFetcher } from '../../../adapters/hypixel/items.mjs';
import { analyzeWithCpp } from '../../../adapters/analysis/protocol.mjs';
import { loadFusionCatalog, CATALOG_SOURCE } from '../../../adapters/fusion/catalog.mjs';
import { analyzeFusionWithCpp } from '../../../adapters/fusion/protocol.mjs';

const thisDirectory = fileURLToPath(new URL('.', import.meta.url));
const webDirectory = resolve(thisDirectory, '../../web/public');
const MAX_PAGE_SIZE = 100;
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function json(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function parseBoundedInteger(value, name, min, max) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new Error(`${name} is outside supported bounds`);
  }
  return result;
}

function parseCoinsToMicros(value, name) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(value)) {
    throw new Error(`${name} must be a coin amount with at most six decimal places`);
  }
  const [whole, fraction = ''] = value.split('.');
  const micros = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${name} is too large`);
  return Number(micros);
}

function microsToCoins(micros) {
  const value = typeof micros === 'bigint' ? micros : BigInt(micros);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 1_000_000n;
  const fraction = String(absolute % 1_000_000n).padStart(6, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function isoTimestamp(millis) {
  return new Date(millis).toISOString();
}

function stale(snapshot, now, staleAfterMs) {
  const sourceUpdatedAt = snapshot.source_updated_at ?? snapshot.observed_at;
  const age = now() - sourceUpdatedAt;
  return age < 0 || age > staleAfterMs;
}

function sourceDataAge(snapshot, now) {
  return Math.max(0, now() - (snapshot.source_updated_at ?? snapshot.observed_at));
}

export function createHuntlabServer({
  store,
  fetchSnapshot = () => fetchBazaarSnapshot({ apiKey: process.env.HYPIXEL_API_KEY ?? '' }),
  fetchPlayerProfile = createPlayerProfileFetcher(),
  fetchItemCatalog = createItemCatalogFetcher(),
  analyze = (snapshot, settings) => analyzeWithCpp(resolve(
    process.env.HUNTLAB_ANALYZER ??
      `build/default/bin/huntlab_analysis_cli${process.platform === 'win32' ? '.exe' : ''}`,
  ), snapshot, settings),
  analyzeFusion = (snapshot, recipes, settings) => analyzeFusionWithCpp(resolve(
    process.env.HUNTLAB_FUSION_ANALYZER ??
      `build/default/bin/huntlab_fusion_cli${process.platform === 'win32' ? '.exe' : ''}`,
  ), snapshot, recipes, settings),
  now = Date.now,
  staleAfterMs = 120_000,
  refreshSeconds = 60,
} = {}) {
  if (!store) throw new Error('MarketStore is required');
  let latest = store.latestSnapshot();
  let lastError = null;
  let refreshInProgress = false;
  let fusionCatalogPromise;
  function getFusionCatalog() {
    fusionCatalogPromise ??= loadFusionCatalog().then((catalog) => {
      const recipesByOutput = new Map();
      for (const recipe of catalog.recipes) {
        const recipes = recipesByOutput.get(recipe.output_product_id) ?? [];
        recipes.push(recipe);
        recipesByOutput.set(recipe.output_product_id, recipes);
      }
      return { ...catalog, recipesByOutput };
    });
    return fusionCatalogPromise;
  }
  let activeAnalyses = 0;
  const analysisQueue = [];
  const maximumQueuedAnalyses = 4;

  function runAnalysis(snapshot, settings, analyzer = analyze) {
    return new Promise((resolveAnalysis, rejectAnalysis) => {
      const job = () => {
        activeAnalyses += 1;
        Promise.resolve()
          .then(() => analyzer(snapshot, settings))
          .then(resolveAnalysis, rejectAnalysis)
          .finally(() => {
            activeAnalyses -= 1;
            const next = analysisQueue.shift();
            if (next) next();
          });
      };
      if (activeAnalyses === 0) {
        job();
      } else if (analysisQueue.length < maximumQueuedAnalyses) {
        analysisQueue.push(job);
      } else {
        const error = new Error('Analysis service is busy; retry shortly.');
        error.code = 'analysis_busy';
        rejectAnalysis(error);
      }
    });
  }

  async function refresh() {
    if (refreshInProgress) return;
    refreshInProgress = true;
    try {
      const fetched = await fetchSnapshot();
      latest = store.saveSnapshot(fetched);
      lastError = null;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'market refresh failed';
      console.error(JSON.stringify({
        event: 'market_refresh_failed',
        error_type: error instanceof Error ? error.name : 'unknown',
        message: lastError,
      }));
      latest = store.latestSnapshot();
    } finally {
      refreshInProgress = false;
    }
  }

  const intervalMs = Math.min(Math.max(refreshSeconds, 30), 300) * 1000;
  const timer = setInterval(() => { void refresh(); }, intervalMs);
  timer.unref?.();
  void refresh();

  const server = createHttpServer(async (request, response) => {
    const requestId = randomUUID();
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;
      if (request.method !== 'GET') {
        return json(response, 405, { error: { code: 'method_not_allowed', message: 'GET only', request_id: requestId } });
      }
      if (pathname === '/api/v1/health') {
        return json(response, 200, { status: 'ok' });
      }
      if (pathname === '/api/v1/profile') {
        const remote = request.socket.remoteAddress ?? '';
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) {
          return json(response, 403, { error: { code: 'local_access_only', message: 'Profile lookup is only available from this machine.', request_id: requestId } });
        }
        try {
          const profile = await fetchPlayerProfile(url.searchParams.get('username'));
          return json(response, 200, profile);
        } catch (error) {
          const status = error.code === 'invalid_username' ? 400
            : error.code === 'hypixel_rate_limited' ? 429
              : error.code === 'api_key_required' ? 503
                : error.code === 'player_not_found' ? 404 : 502;
          return json(response, status, {
            error: {
              code: error.code ?? 'profile_lookup_failed',
              message: error.message ?? 'Profile lookup failed.',
              request_id: requestId,
            },
          });
        }
      }
      if (pathname === '/api/v1/items') {
        try {
          const catalog = await fetchItemCatalog();
          const productIds = new Set(latest?.products.map((product) => product.product_id) ?? []);
          return json(response, 200, {
            items: catalog.filter((item) => productIds.has(item.product_id)),
          });
        } catch {
          return json(response, 503, { error: { code: 'item_catalog_unavailable', message: 'Hypixel item names are temporarily unavailable.', request_id: requestId } });
        }
      }
      if (pathname === '/api/v1/fusion/catalog') {
        const catalog = await getFusionCatalog();
        return json(response, 200, {
          shards: catalog.shards,
          shard_count: catalog.shardCount,
          recipe_count: catalog.rawRecipeCount,
          source: CATALOG_SOURCE,
          validation_status: 'structural_catalog_validation_only',
          validation_note: 'The pinned source structure and identifiers are checked. Game mechanics, unlocks, and special-case rules are not independently verified.',
        });
      }
      const fusionShardMatch = pathname.match(/^\/api\/v1\/fusion\/catalog\/shards\/([A-Z0-9_:-]{1,128})$/);
      if (fusionShardMatch) {
        const catalog = await getFusionCatalog();
        const shard = catalog.shards.find((item) => item.shard_id === fusionShardMatch[1]);
        if (!shard) {
          return json(response, 404, { error: { code: 'shard_not_found', message: 'Shard ID is not in the pinned fusion catalogue.', request_id: requestId } });
        }
        const allRecipes = catalog.recipesByOutput.get(shard.shard_id) ?? [];
        let limit;
        let offset;
        const requestedRecipe = url.searchParams.get('recipe_id');
        try {
          limit = parseBoundedInteger(url.searchParams.get('limit') ?? '100', 'limit', 1, 100);
          offset = parseBoundedInteger(url.searchParams.get('offset') ?? '0', 'offset', 0, 1_000_000);
          if (requestedRecipe !== null) {
            if (!/^[A-Z0-9_:-]{1,128}$/.test(requestedRecipe)) throw new Error('recipe_id is invalid');
            const selectedIndex = allRecipes.findIndex((recipe) => recipe.recipe_id === requestedRecipe);
            if (selectedIndex < 0) throw new Error('recipe_id is not a recipe for this shard');
            offset = Math.floor(selectedIndex / limit) * limit;
          }
        } catch (error) {
          return json(response, 400, { error: { code: 'invalid_catalog_query', message: error.message, request_id: requestId } });
        }
        const recipes = allRecipes.slice(offset, offset + limit);
        return json(response, 200, {
          shard,
          recipes,
          total_recipes: allRecipes.length,
          offset,
          limit,
          source: CATALOG_SOURCE,
          validation_status: 'structural_catalog_validation_only',
          validation_note: 'Source recipe relationship; in-game requirements and special mechanics remain unverified.',
        });
      }
      if (pathname === '/api/v1/status') {
        const dataAge = latest ? sourceDataAge(latest, now) : null;
        const marketState = !latest ? 'empty' : lastError ? 'unavailable'
          : (!latest.complete || dataAge > staleAfterMs) ? 'stale' : 'current';
        return json(response, 200, {
          market_state: marketState,
          snapshot_id: latest?.id ?? null,
          observed_at: latest ? isoTimestamp(latest.observed_at) : null,
          source_updated_at: latest ? isoTimestamp(latest.source_updated_at ?? latest.observed_at) : null,
          data_age_ms: dataAge,
          last_error: lastError,
          checked_at: isoTimestamp(now()),
        });
      }
      if (pathname === '/api/v1/market/snapshot') {
        if (!latest) {
          return json(response, 503, { error: { code: 'snapshot_unavailable', message: 'No validated Bazaar snapshot is available.', request_id: requestId } });
        }
        return json(response, 200, {
          snapshot_id: latest.id,
          source: latest.source,
          observed_at: isoTimestamp(latest.observed_at),
          source_updated_at: isoTimestamp(latest.source_updated_at ?? latest.observed_at),
          product_count: latest.product_count ?? latest.products.length,
          complete: latest.complete !== false,
          data_age_ms: sourceDataAge(latest, now),
          stale: Boolean(lastError) || stale(latest, now, staleAfterMs),
        });
      }
      if (pathname === '/api/v1/opportunities/bazaar') {
        if (!latest) {
          return json(response, 503, { error: { code: 'snapshot_unavailable', message: 'No validated Bazaar snapshot is available.', request_id: requestId } });
        }
        let taxBasisPoints;
        let capitalMicros;
        let maximumQuantity;
        let minimumWeeklyVolume;
        let saleHorizonHours;
        let volumeShareBasisPoints;
        let maximumDataAgeSeconds;
        try {
          taxBasisPoints = parseBoundedInteger(url.searchParams.get('tax_basis_points'), 'tax_basis_points', 0, 10_000);
          capitalMicros = parseCoinsToMicros(url.searchParams.get('capital_coins'), 'capital_coins');
          maximumQuantity = parseBoundedInteger(url.searchParams.get('maximum_quantity') ?? '100', 'maximum_quantity', 1, 1_000_000);
          minimumWeeklyVolume = parseBoundedInteger(url.searchParams.get('minimum_weekly_volume') ?? '10000', 'minimum_weekly_volume', 0, 1_000_000_000_000);
          saleHorizonHours = parseBoundedInteger(url.searchParams.get('sale_horizon_hours') ?? '24', 'sale_horizon_hours', 1, 168);
          volumeShareBasisPoints = parseBoundedInteger(url.searchParams.get('volume_share_basis_points') ?? '500', 'volume_share_basis_points', 1, 10_000);
          maximumDataAgeSeconds = parseBoundedInteger(url.searchParams.get('max_data_age_seconds') ?? String(Math.max(30, Math.floor(staleAfterMs / 1000))), 'max_data_age_seconds', 30, 3_600);
        } catch (error) {
          return json(response, 400, { error: { code: 'invalid_settings', message: error.message, request_id: requestId } });
        }
        const dataAgeMs = sourceDataAge(latest, now);
        const dataIsStale = !latest.complete || stale(latest, now, maximumDataAgeSeconds * 1_000);
        let calculated = [];
        try {
          if (!dataIsStale) calculated = await runAnalysis(latest, {
            tax_basis_points: taxBasisPoints,
            capital_micros: capitalMicros,
            maximum_quantity: maximumQuantity,
            minimum_weekly_volume: minimumWeeklyVolume,
            sale_horizon_hours: saleHorizonHours,
            volume_share_basis_points: volumeShareBasisPoints,
          });
        } catch (error) {
          if (error.code === 'analysis_busy') {
            return json(response, 503, {
              error: { code: 'analysis_busy', message: error.message, request_id: requestId },
            });
          }
          throw error;
        }
        const truncated = calculated.length > MAX_PAGE_SIZE;
        const opportunities = calculated.slice(0, MAX_PAGE_SIZE).map((opportunity) => ({
          product_id: opportunity.product_id,
          quantity: opportunity.quantity,
          acquisition_cost_coins: microsToCoins(opportunity.acquisition_cost_micros),
          gross_proceeds_coins: microsToCoins(opportunity.gross_proceeds_micros),
          gross_profit_coins: microsToCoins(opportunity.gross_profit_micros),
          fee_coins: microsToCoins(opportunity.fee_micros),
          net_profit_coins: microsToCoins(opportunity.net_profit_micros),
          estimated_profit_per_hour_coins: microsToCoins(opportunity.estimated_profit_per_hour_micros),
          roi_basis_points: opportunity.roi_basis_points,
          acquisition_vwap_coins: microsToCoins(opportunity.acquisition_vwap_micros),
          disposal_vwap_coins: microsToCoins(opportunity.disposal_vwap_micros),
          acquisition_visible_depth: String(opportunity.acquisition_visible_depth),
          disposal_visible_depth: String(opportunity.disposal_visible_depth),
          filled_quantity: opportunity.filled_quantity,
          unfilled_quantity: opportunity.unfilled_quantity,
          execution_model: 'immediate_order_book',
          buy_price_source: 'sell_summary (seller offers)',
          sell_price_source: 'buy_summary (buyer orders)',
          warnings: [
            'Estimates simulate immediate execution through the available top-30 levels.',
            'Order-book state may change before a manual trade is completed.',
            ...(lastError ? ['Upstream refresh failed; this calculation uses the last valid snapshot.'] : []),
          ],
          weekly_volume_cap: opportunity.weekly_volume_cap,
          conservative_weekly_volume: opportunity.conservative_weekly_volume,
          binding_constraints: [
            ...(opportunity.binding_constraint_flags & 1 ? ['user_maximum_quantity'] : []),
            ...(opportunity.binding_constraint_flags & 2 ? ['available_capital'] : []),
            ...(opportunity.binding_constraint_flags & 4 ? ['acquisition_depth'] : []),
            ...(opportunity.binding_constraint_flags & 8 ? ['disposal_depth'] : []),
            ...(opportunity.binding_constraint_flags & 16 ? ['weekly_volume'] : []),
            ...(opportunity.binding_constraint_flags & 32 ? ['profit_maximizing_quantity'] : []),
          ],
          risk_flags: [
            ...(opportunity.risk_flags & 1 ? ['thin_visible_book'] : []),
            ...(opportunity.risk_flags & 2 ? ['single_order_dominates_book'] : []),
            ...(opportunity.risk_flags & 4 ? ['unusually_wide_spread'] : []),
            ...(opportunity.risk_flags & 8 ? ['insufficient_acquisition_liquidity_for_requested_maximum'] : []),
            ...(opportunity.risk_flags & 16 ? ['insufficient_exit_liquidity_for_requested_maximum'] : []),
          ],
        }));
        return json(response, 200, {
          snapshot_id: latest.id,
          snapshot_timestamp: isoTimestamp(latest.observed_at),
          source_updated_at: isoTimestamp(latest.source_updated_at ?? latest.observed_at),
          data_age_ms: dataAgeMs,
          stale: dataIsStale,
          unavailable_reason: !latest.complete ? 'incomplete_snapshot' : dataIsStale ? 'stale_snapshot' : null,
          tax_basis_points: taxBasisPoints,
          capital_coins: microsToCoins(capitalMicros),
          maximum_quantity: maximumQuantity,
          minimum_weekly_volume: minimumWeeklyVolume,
          sale_horizon_hours: saleHorizonHours,
          volume_share_basis_points: volumeShareBasisPoints,
          max_data_age_seconds: maximumDataAgeSeconds,
          execution_model: 'immediate_order_book',
          fee_basis: 'configured_sale_fee_on_gross_proceeds',
          hourly_profit_formula: '(net_batch_profit / selected_quantity) * conservative_weekly_volume * participation_share / 168',
          algorithm_version: 'bazaar-orderbook-v5-extreme-roi-filter',
          complete: !truncated,
          truncated,
          opportunities,
        });
      }

      if (pathname === '/api/v1/opportunities/fusion') {
        if (!latest) {
          return json(response, 503, { error: { code: 'snapshot_unavailable', message: 'No validated Bazaar snapshot is available.', request_id: requestId } });
        }
        let taxBasisPoints;
        let capitalMicros;
        let maximumQuantity;
        let minimumWeeklyVolume;
        let saleHorizonHours;
        let volumeShareBasisPoints;
        let maximumDataAgeSeconds;
        try {
          taxBasisPoints = parseBoundedInteger(url.searchParams.get('tax_basis_points'), 'tax_basis_points', 0, 10_000);
          capitalMicros = parseCoinsToMicros(url.searchParams.get('capital_coins'), 'capital_coins');
          maximumQuantity = parseBoundedInteger(url.searchParams.get('maximum_quantity') ?? '100', 'maximum_quantity', 1, 1_000_000);
          minimumWeeklyVolume = parseBoundedInteger(url.searchParams.get('minimum_weekly_volume') ?? '10000', 'minimum_weekly_volume', 0, 1_000_000_000_000);
          saleHorizonHours = parseBoundedInteger(url.searchParams.get('sale_horizon_hours') ?? '24', 'sale_horizon_hours', 1, 168);
          volumeShareBasisPoints = parseBoundedInteger(url.searchParams.get('volume_share_basis_points') ?? '500', 'volume_share_basis_points', 1, 10_000);
          maximumDataAgeSeconds = parseBoundedInteger(url.searchParams.get('max_data_age_seconds') ?? String(Math.max(30, Math.floor(staleAfterMs / 1000))), 'max_data_age_seconds', 30, 3_600);
        } catch (error) {
          return json(response, 400, { error: { code: 'invalid_settings', message: error.message, request_id: requestId } });
        }
        const dataAgeMs = sourceDataAge(latest, now);
        const dataIsStale = !latest.complete || stale(latest, now, maximumDataAgeSeconds * 1_000);
        let calculated = [];
        let matchedRecipes = [];
        let shardMarketById = new Map();
        if (!dataIsStale) {
          try {
            const catalog = await getFusionCatalog();
            shardMarketById = new Map(latest.products.map((item) => [item.product_id, item]));
            // Bound the solver workload to recipes whose three traded items are in this snapshot.
            matchedRecipes = catalog.recipes.filter((recipe) => {
              const first = shardMarketById.get(recipe.first_input_product_id);
              const second = shardMarketById.get(recipe.second_input_product_id);
              const output = shardMarketById.get(recipe.output_product_id);
              return first && second && output && first.sell_offers.length && second.sell_offers.length &&
                output.buy_orders.length && first.conservative_weekly_volume >= minimumWeeklyVolume &&
                second.conservative_weekly_volume >= minimumWeeklyVolume &&
                output.conservative_weekly_volume >= minimumWeeklyVolume;
            });
            calculated = await runAnalysis(latest, {
              tax_basis_points: taxBasisPoints,
              capital_micros: capitalMicros,
              maximum_quantity: maximumQuantity,
              minimum_weekly_volume: minimumWeeklyVolume,
              sale_horizon_hours: saleHorizonHours,
              volume_share_basis_points: volumeShareBasisPoints,
              recipes: matchedRecipes,
            }, (snapshot, settings) => analyzeFusion(snapshot, settings.recipes, settings));
          } catch (error) {
            if (error.code === 'analysis_busy') {
              return json(response, 503, { error: { code: 'analysis_busy', message: error.message, request_id: requestId } });
            }
            throw error;
          }
        }
        const recipeById = new Map(matchedRecipes.map((recipe) => [recipe.recipe_id, recipe]));
        const visibleDepth = (levels) => levels.reduce((sum, level) => sum + BigInt(level.amount), 0n).toString();
        const opportunities = calculated.slice(0, MAX_PAGE_SIZE).map((opportunity) => {
          const recipe = recipeById.get(opportunity.recipe_id);
          const firstMarket = shardMarketById.get(opportunity.first_input_product_id);
          const secondMarket = shardMarketById.get(opportunity.second_input_product_id);
          const outputMarket = shardMarketById.get(opportunity.output_product_id);
          const sameInput = opportunity.first_input_product_id === opportunity.second_input_product_id;
          const inputDetail = (productId, quantityPerFusion, costMicros, market) => ({
            product_id: productId,
            quantity_per_fusion: quantityPerFusion,
            quantity_total: quantityPerFusion * opportunity.operation_count,
            acquisition_cost_coins: microsToCoins(costMicros),
            visible_acquisition_depth: visibleDepth(market.sell_offers),
            conservative_weekly_volume: market.conservative_weekly_volume,
          });
          return ({
          recipe_id: opportunity.recipe_id,
          output_product_id: opportunity.output_product_id,
          first_input_product_id: opportunity.first_input_product_id,
          second_input_product_id: opportunity.second_input_product_id,
          operation_count: opportunity.operation_count,
          output_quantity: opportunity.output_quantity,
          inputs: recipe ? (sameInput ? [inputDetail(
            recipe.first_input_product_id,
            recipe.first_input_quantity + recipe.second_input_quantity,
            opportunity.first_input_cost_micros + opportunity.second_input_cost_micros,
            firstMarket,
          )] : [
            inputDetail(recipe.first_input_product_id, recipe.first_input_quantity,
              opportunity.first_input_cost_micros, firstMarket),
            inputDetail(recipe.second_input_product_id, recipe.second_input_quantity,
              opportunity.second_input_cost_micros, secondMarket),
          ]) : [],
          visible_output_depth: visibleDepth(outputMarket?.buy_orders ?? []),
          conservative_weekly_output_volume: outputMarket?.conservative_weekly_volume ?? null,
          acquisition_cost_coins: microsToCoins(opportunity.acquisition_cost_micros),
          gross_proceeds_coins: microsToCoins(opportunity.gross_proceeds_micros),
          sale_fee_coins: microsToCoins(opportunity.sale_fee_micros),
          net_profit_coins: microsToCoins(opportunity.net_profit_micros),
          roi_basis_points: opportunity.roi_basis_points,
          estimated_profit_per_hour_coins: microsToCoins(opportunity.estimated_profit_per_hour_micros),
          execution_model: 'immediate_order_book',
          buy_price_source: 'sell_summary (ingredient seller offers)',
          sell_price_source: 'buy_summary (output buyer orders)',
          warnings: ['Fusion requires manual in-game execution.', 'Only guaranteed recipe output is valued; chance bonuses are excluded.',
            ...(lastError ? ['Upstream refresh failed; this estimate uses the last valid snapshot.'] : [])],
        });
        });
        return json(response, 200, {
          snapshot_id: latest.id,
          observed_at: isoTimestamp(latest.observed_at),
          source_updated_at: isoTimestamp(latest.source_updated_at ?? latest.observed_at),
          data_age_ms: dataAgeMs,
          stale: dataIsStale,
          unavailable_reason: !latest.complete ? 'incomplete_snapshot' : dataIsStale ? 'stale_snapshot' : null,
          catalog: { source: CATALOG_SOURCE.repository, revision: CATALOG_SOURCE.revision,
            sha256: CATALOG_SOURCE.sha256, license: CATALOG_SOURCE.license,
            recipes_considered: matchedRecipes.length },
          assumptions: { maximum_operations: maximumQuantity, sale_tax_basis_points: taxBasisPoints,
            capital_coins: microsToCoins(capitalMicros), minimum_weekly_volume: minimumWeeklyVolume,
            sale_horizon_hours: saleHorizonHours, volume_share_basis_points: volumeShareBasisPoints,
            max_data_age_seconds: maximumDataAgeSeconds,
            fee_basis: 'configured_sale_fee_on_gross_output_proceeds',
            output_basis: 'guaranteed_selected_output_only' },
          execution_model: 'immediate_order_book',
          hourly_profit_formula: '(net batch profit / fusion operations) * conservative weekly operation throughput * participation share / 168',
          algorithm_version: 'fusion-orderbook-v1-guaranteed-output',
          complete: calculated.length <= MAX_PAGE_SIZE,
          truncated: calculated.length > MAX_PAGE_SIZE,
          opportunities,
        });
      }

      const relativePath = pathname === '/' || pathname === '/fusion' || pathname === '/fusion/'
        ? 'index.html' : pathname.slice(1);
      if (!/^[A-Za-z0-9._/-]+$/.test(relativePath) || relativePath.split('/').includes('..')) {
        return json(response, 404, { error: { code: 'not_found', message: 'Not found', request_id: requestId } });
      }
      try {
        const content = await readFile(resolve(webDirectory, relativePath));
        response.writeHead(200, {
          'content-type': CONTENT_TYPES[extname(relativePath)] ?? 'application/octet-stream',
          'x-content-type-options': 'nosniff',
          'cache-control': 'no-cache',
        });
        response.end(content);
      } catch {
        return json(response, 404, { error: { code: 'not_found', message: 'Not found', request_id: requestId } });
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'api_request_failed',
        request_id: requestId,
        error_type: error instanceof Error ? error.name : 'unknown',
      }));
      return json(response, 500, { error: { code: 'internal_error', message: 'Request could not be completed.', request_id: requestId } });
    }
  });

  return {
    server,
    refresh,
    async close() {
      clearInterval(timer);
      await new Promise((resolveClose, rejectClose) => {
        server.close((error) => error ? rejectClose(error) : resolveClose());
      });
    },
  };
}
