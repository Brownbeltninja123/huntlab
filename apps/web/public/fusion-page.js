import { buildFusionGraph, filterShards, sortOpportunities } from './fusion-graph.js';

const $ = (selector) => document.querySelector(selector);
const svgNS = 'http://www.w3.org/2000/svg';
let displayName = (value) => value;
let coin = (value) => `${value} coins`;
let number = new Intl.NumberFormat();
let shards = [];
let shardById = new Map();
let catalogSource = null;
let opportunities = [];
let analysisMeta = null;
let selected = null;
let pendingShardId = null;
let selectedRecipeId = null;
let path = [];
let pageInitialized = false;
let recipeLimit = 36;
let opportunityLimit = 24;
let scale = 1;
let panX = 0;
let panY = 0;
let dragging = null;
let expandGraph = false;
let selectionRequest = 0;

const setText = (element, text) => { element.textContent = text; };
const nameFor = (productId) => shardById.get(productId)?.name ?? displayName(productId);

function setNotice(message, { error = false } = {}) {
  const notice = $('#fusion-notice');
  notice.textContent = message;
  notice.hidden = !message;
  notice.classList.toggle('error', error);
}

function optionList(select, values) {
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function renderShardList() {
  const resultElement = $('#shard-results');
  const filtered = filterShards(shards, {
    query: $('#shard-search').value,
    family: $('#family-filter').value,
    rarity: $('#rarity-filter').value,
    recipeType: $('#recipe-filter').value,
  });
  setText($('#shard-count'), `${filtered.length} of ${shards.length}`);
  const fragment = document.createDocumentFragment();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = shards.length ? 'No shards match these filters.' : 'The shard catalogue is unavailable.';
    fragment.append(empty);
  }
  for (const shard of filtered) {
    const button = document.createElement('button');
    button.type = 'button';
    const isCurrent = (pendingShardId ?? selected?.shard.shard_id) === shard.shard_id;
    button.className = `shard-choice${isCurrent ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(isCurrent));
    button.setAttribute('aria-busy', String(pendingShardId === shard.shard_id));
    const main = document.createElement('span');
    main.className = 'shard-choice-name';
    main.textContent = shard.name;
    const metadata = document.createElement('span');
    metadata.className = 'shard-choice-meta';
    metadata.textContent = `${[shard.rarity, shard.type, shard.family].filter(Boolean).join(' · ')} · Select to view recipe`;
    button.append(main, metadata);
    button.addEventListener('click', () => void selectShard(shard.shard_id, { push: true }));
    fragment.append(button);
  }
  resultElement.replaceChildren(fragment);
}

function renderOpportunities() {
  const sort = $('#fusion-sort').value;
  const minimumProfit = toMicros($('#fusion-min-profit').value);
  const minimumRoi = Math.max(0, Number($('#fusion-min-roi').value) || 0) * 100;
  const items = sortOpportunities(opportunities.filter((item) =>
    toMicros(item.net_profit_coins) >= minimumProfit && item.roi_basis_points >= minimumRoi), sort);
  setText($('#opportunity-count'), `${opportunities.length}${items.length > opportunityLimit ? '+' : ''}`);
  const list = $('#fusion-opportunities');
  const fragment = document.createDocumentFragment();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = opportunities.length
      ? 'No result in the server’s returned top 100 meets these minimum profit and ROI filters.'
      : 'No positive fusion estimate is currently eligible. The service may exclude stale data, thin books, low volume, over-budget batches, or non-positive returns.';
    fragment.append(empty);
  }
  for (const item of items.slice(0, opportunityLimit)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'opportunity-choice';
    button.setAttribute('aria-label', `Open ${nameFor(item.output_product_id)} fusion, net ${coin(item.net_profit_coins)}, ROI ${(item.roi_basis_points / 100).toFixed(2)} percent`);
    const title = document.createElement('span');
    title.className = 'opportunity-name';
    title.textContent = nameFor(item.output_product_id);
    const profit = document.createElement('strong');
    profit.className = 'opportunity-net';
    profit.textContent = coin(item.net_profit_coins);
    const meta = document.createElement('span');
    meta.className = 'opportunity-meta';
    const formula = document.createElement('span');
    formula.className = 'opportunity-formula';
    const ingredients = (item.inputs ?? []).map((input) =>
      `${nameFor(input.product_id)} × ${number.format(input.quantity_per_fusion)}`);
    formula.textContent = `${ingredients.length ? ingredients.join(' + ') : 'Recipe details unavailable'} → ${number.format(item.output_quantity)} ${nameFor(item.output_product_id)}`;
    meta.textContent = `${(item.roi_basis_points / 100).toFixed(2)}% ROI · ${number.format(item.operation_count)} operations · ${coin(item.estimated_profit_per_hour_coins)}/hr*`;
    button.append(title, profit, formula, meta);
    button.addEventListener('click', () => void openOpportunity(item));
    fragment.append(button);
  }
  if (items.length > opportunityLimit) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'text-button';
    more.textContent = 'Show more ranked opportunities';
    more.addEventListener('click', () => { opportunityLimit += 24; renderOpportunities(); });
    fragment.append(more);
  }
  list.replaceChildren(fragment);
}

async function loadShardDetails(shardId, recipeId = null, offset = 0) {
  const query = new URLSearchParams({ limit: '100', offset: String(offset) });
  if (recipeId) query.set('recipe_id', recipeId);
  const response = await fetch(`/api/v1/fusion/catalog/shards/${encodeURIComponent(shardId)}?${query}`, { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? 'Could not load this shard’s recipes.');
  return result;
}

async function selectShard(shardId, { push = false, recipeId = null } = {}) {
  const shard = shardById.get(shardId);
  if (!shard) return;
  if (push && (selected?.shard.shard_id === shardId || path.some((entry) => entry.shard_id === shardId))) {
    setNotice('This branch returns to a shard already in the current path. Cycle expansion stopped; use the breadcrumbs to revisit an earlier shard.', { error: true });
    return;
  }
  const requestId = ++selectionRequest;
  if (push && selected) path.push({ shard_id: selected.shard.shard_id, recipe_id: selectedRecipeId });
  expandGraph = false;
  recipeLimit = 36;
  scale = 1;
  panX = 0;
  panY = 0;
  selectedRecipeId = recipeId;
  pendingShardId = shardId;
  renderShardList();
  setNotice('');
  setText($('#graph-heading'), `Loading ${shard.name}…`);
  $('#graph-content').replaceChildren();
  $('#graph-error').hidden = true;
  setText($('#graph-caption'), 'Loading the documented recipe and ingredients…');
  setText($('#recipe-heading'), 'Loading shard details…');
  setText($('#recipe-detail'), `Loading recipes for ${shard.name}…`);
  renderBreadcrumb();
  try {
    const result = await loadShardDetails(shardId, recipeId);
    if (requestId !== selectionRequest) return;
    selected = result;
    pendingShardId = null;
    renderShardList();
    renderBreadcrumb();
    renderSelected();
    $('.fusion-workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    if (requestId !== selectionRequest) return;
    pendingShardId = null;
    renderShardList();
    $('#graph-content').replaceChildren();
    $('#graph-error').hidden = false;
    const message = error.message.includes('404') || error.message.toLowerCase().includes('not found')
      ? 'The shard catalogue endpoint was not found. Restart the HuntLab server from the project folder, then refresh this page.'
      : `Could not load ${shard.name}: ${error.message}. Check the server is running, then try selecting it again.`;
    setText($('#graph-error'), message);
    setText($('#graph-heading'), shard.name);
    setText($('#graph-caption'), 'The recipe explorer could not load this shard.');
    setText($('#recipe-heading'), 'Shard details unavailable');
    setText($('#recipe-detail'), message);
    setNotice(message, { error: true });
  }
}

async function openOpportunity(opportunity) {
  path = [];
  await selectShard(opportunity.output_product_id, { recipeId: opportunity.recipe_id });
}

function renderBreadcrumb() {
  const element = $('#fusion-breadcrumb');
  const entries = [...path, ...(selected ? [{ shard_id: selected.shard.shard_id, recipe_id: selectedRecipeId }] : [])];
  const fragment = document.createDocumentFragment();
  entries.forEach((entry, index) => {
    if (index) {
      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.textContent = '›';
      fragment.append(separator);
    }
    const shard = shardById.get(entry.shard_id);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = shard?.name ?? entry.shard_id;
    button.disabled = index === entries.length - 1;
    if (!button.disabled) button.addEventListener('click', () => {
      path = entries.slice(0, index);
      void selectShard(entry.shard_id, { recipeId: entry.recipe_id });
    });
    fragment.append(button);
  });
  if (entries.length) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'text-button breadcrumb-reset';
    reset.textContent = 'Return to all shards';
    reset.addEventListener('click', resetGraph);
    fragment.append(reset);
  }
  element.replaceChildren(fragment);
}

function makeSvg(tag, attributes = {}) {
  const element = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function applyTransform() {
  $('#graph-content').setAttribute('transform', `translate(${panX} ${panY}) scale(${scale})`);
}

function renderGraph() {
  const content = $('#graph-content');
  content.replaceChildren();
  $('#graph-error').hidden = true;
  if (!selected) {
    $('#graph-expand').disabled = true;
    $('#graph-expand').setAttribute('aria-expanded', 'false');
    $('#graph-expand').textContent = 'Expand branches';
    $('#fusion-svg').setAttribute('viewBox', '0 0 850 390');
    $('.fusion-graph').style.height = '';
    setText($('#graph-heading'), 'Select a shard or opportunity');
    setText($('#graph-caption'), 'Choose a shard to view documented direct recipes. Select an ingredient to explore how that shard can be produced.');
    return;
  }
  let graph;
  try {
    graph = buildFusionGraph(selected.shard, selected.recipes, selectedRecipeId, expandGraph);
  } catch (error) {
    $('#graph-error').hidden = false;
    setText($('#graph-error'), error.message);
    return;
  }
  const recipe = graph.recipe;
  selectedRecipeId = recipe?.recipe_id ?? null;
  const opportunity = opportunities.find((item) => item.recipe_id === recipe?.recipe_id);
  setText($('#graph-heading'), `${selected.shard.name} · ${number.format(selected.total_recipes)} documented recipes`);
  $('#graph-expand').disabled = selected.total_recipes < 2;
  $('#graph-expand').setAttribute('aria-expanded', String(expandGraph));
  $('#graph-expand').textContent = expandGraph ? `Collapse branches (${graph.visibleRecipes.length} shown)`
    : selected.total_recipes > 1 ? `Expand branches (${number.format(selected.total_recipes)} alternatives)` : 'No alternatives';
  const graphHeight = Math.max(390, 190 + (graph.visibleRecipes.length - 1) * 150);
  $('#fusion-svg').setAttribute('viewBox', `0 0 850 ${graphHeight}`);
  $('.fusion-graph').style.height = `${Math.min(540, 340 + (graph.visibleRecipes.length - 1) * 60)}px`;
  setText($('#graph-caption'), opportunity
    ? 'Dashed green path and PROFIT label indicate a positive C++ estimate. Solid paths with NO ESTIMATE have no returned positive calculation; that is not proof of a loss.'
    : graph.visibleRecipes.length > 1
      ? `${graph.visibleRecipes.length} direct alternatives shown (maximum 4). Select a fusion node to inspect it or an input shard to explore its recipes. Shared inputs are deduplicated. No returned positive estimate does not prove a loss.`
      : 'This focused graph shows one source recipe. Select another recipe below or expand branches; choose an input to explore its source recipes. No returned positive estimate does not prove a loss.');
  const positions = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const link of graph.links) {
    const from = positions.get(link.from);
    const to = positions.get(link.to);
    const linkRecipeId = link.id.slice(link.id.indexOf(':') + 1);
    const edgeIsProfitable = opportunities.some((item) => item.recipe_id === linkRecipeId);
    const line = makeSvg('path', { d: `M ${from.x + (from.kind === 'recipe' ? 60 : 100)} ${from.y} C ${from.x + 125} ${from.y}, ${to.x - 100} ${to.y}, ${to.x - 60} ${to.y}`, class: `graph-link${edgeIsProfitable ? ' profitable' : ''}`, 'marker-end': 'url(#fusion-arrow)' });
    content.append(line);
    const label = makeSvg('text', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 8, class: 'link-label' });
    label.textContent = link.label;
    content.append(label);
  }
  for (const node of graph.nodes) {
    const shard = shardById.get(node.shard_id);
    const group = makeSvg('g', {
      class: `graph-node ${node.kind}`,
      transform: `translate(${node.x} ${node.y})`,
      'data-node-id': node.id,
      ...(node.kind === 'output' ? { role: 'img' } : { tabindex: '0', role: 'button' }),
    });
    group.setAttribute('aria-label', node.kind === 'recipe'
      ? `Fusion recipe, ${node.recipe.first_input_quantity} ${shardById.get(node.recipe.first_input_product_id)?.name ?? node.recipe.first_input_product_id} and ${node.recipe.second_input_quantity} ${shardById.get(node.recipe.second_input_product_id)?.name ?? node.recipe.second_input_product_id} produce ${node.recipe.output_quantity} ${selected.shard.name}. Press Enter to select.`
      : `${node.kind === 'output' ? 'Output' : 'Input'} shard ${shard?.name ?? node.shard_id}. ${node.kind === 'output' ? 'Selected output.' : 'Press Enter to inspect its recipes.'}`);
    if (node.kind === 'recipe') {
      group.append(makeSvg('path', { d: 'M 0 -38 L 62 0 L 0 38 L -62 0 Z', class: 'recipe-diamond' }));
      const text = makeSvg('text', { x: 0, y: 4, 'text-anchor': 'middle', class: 'recipe-node-label' });
      const recipeHasEstimate = opportunities.some((item) => item.recipe_id === node.recipe_id);
      text.textContent = recipeHasEstimate ? 'FUSE · PROFIT' : 'FUSE · NO ESTIMATE';
      group.append(text);
      if (recipeHasEstimate) group.classList.add('profitable-recipe');
      group.addEventListener('click', () => { selectedRecipeId = node.recipe_id; renderSelected(); });
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectedRecipeId = node.recipe_id; renderSelected(); }
      });
    } else {
      group.append(makeSvg('rect', { x: -92, y: -34, width: 184, height: 68, rx: 12, class: 'shard-node-box' }));
      const title = makeSvg('text', { x: 0, y: -2, 'text-anchor': 'middle', class: 'shard-node-title' });
      title.textContent = shard?.name ?? node.shard_id;
      const meta = makeSvg('text', { x: 0, y: 18, 'text-anchor': 'middle', class: 'shard-node-meta' });
      meta.textContent = node.kind === 'output' ? 'SELECTED OUTPUT' : 'CLICK TO EXPLORE INPUT';
      group.append(title, meta);
      group.addEventListener('click', () => {
        if (node.kind === 'output') return;
        void selectShard(node.shard_id, { push: true });
      });
      group.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && node.kind !== 'output') {
          event.preventDefault();
          void selectShard(node.shard_id, { push: true });
        }
      });
    }
    content.append(group);
  }
  applyTransform();
}

function renderRecipeDetails() {
  const container = $('#recipe-detail');
  if (!selected) {
    container.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = 'Select a shard from search or open a ranked opportunity to inspect its recipe and market analysis.';
    container.append(empty);
    setText($('#recipe-heading'), 'Shard details');
    setText($('#validation-badge'), 'No selection');
    return;
  }
  setText($('#recipe-heading'), `${selected.shard.name} · Recipe analysis`);
  setText($('#validation-badge'), 'Structure checked · mechanics unverified');
  const fragment = document.createDocumentFragment();
  const shard = selected.shard;
  const summary = document.createElement('div');
  summary.className = 'selected-shard-summary';
  const title = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = shard.name;
  const meta = document.createElement('span');
  meta.textContent = [shard.shard_id, shard.rarity, shard.type, shard.family].filter(Boolean).join(' · ');
  title.append(name, meta);
  const fuse = document.createElement('span');
  fuse.className = 'fuse-amount';
  fuse.textContent = `${number.format(shard.fuse_amount)} per input`;
  summary.append(title, fuse);
  fragment.append(summary);

  const available = selected.recipes;
  const alternativesHeading = document.createElement('div');
  alternativesHeading.className = 'alternatives-heading';
  const alternativesTitle = document.createElement('strong');
  alternativesTitle.textContent = `${number.format(selected.total_recipes)} documented direct recipe${selected.total_recipes === 1 ? '' : 's'}`;
  const source = document.createElement('span');
  source.textContent = 'Output choices shown only where the pinned catalogue has an explicit edge.';
  alternativesHeading.append(alternativesTitle, source);
  fragment.append(alternativesHeading);
  const alternatives = document.createElement('div');
  alternatives.className = 'recipe-alternatives';
  if (!available.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-copy';
    empty.textContent = 'No deterministic recipe is listed for this shard in the pinned source. It may be a base input or its recipe is unsupported.';
    alternatives.append(empty);
  }
  const visibleRecipes = available.slice(0, recipeLimit);
  const focusedRecipe = available.find((item) => item.recipe_id === selectedRecipeId);
  if (focusedRecipe && !visibleRecipes.includes(focusedRecipe)) visibleRecipes.push(focusedRecipe);
  for (const recipe of visibleRecipes) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `recipe-choice${recipe.recipe_id === selectedRecipeId ? ' selected' : ''}`;
    button.setAttribute('aria-pressed', String(recipe.recipe_id === selectedRecipeId));
    const left = document.createElement('span');
    left.textContent = `${nameFor(recipe.first_input_product_id)} × ${number.format(recipe.first_input_quantity)} + ${nameFor(recipe.second_input_product_id)} × ${number.format(recipe.second_input_quantity)}`;
    const right = document.createElement('span');
    right.textContent = `${number.format(recipe.output_quantity)} guaranteed`;
    const badge = document.createElement('span');
    badge.className = opportunities.some((item) => item.recipe_id === recipe.recipe_id) ? 'recipe-profit-tag' : 'recipe-status-tag';
    badge.textContent = opportunities.some((item) => item.recipe_id === recipe.recipe_id) ? 'Positive estimate' : 'No positive estimate returned';
    button.append(left, right, badge);
    button.addEventListener('click', () => {
      selectedRecipeId = recipe.recipe_id;
      renderSelected();
    });
    alternatives.append(button);
  }
  if (recipeLimit < available.length || selected.offset + available.length < selected.total_recipes) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'text-button';
    more.textContent = recipeLimit < available.length
      ? `Show ${Math.min(60, available.length - recipeLimit)} more recipes from this page`
      : `Load next recipes · ${number.format(selected.offset + available.length)} of ${number.format(selected.total_recipes)}`;
    more.addEventListener('click', () => void showMoreRecipes());
    alternatives.append(more);
  }
  fragment.append(alternatives);

  const recipe = available.find((item) => item.recipe_id === selectedRecipeId) ?? available[0];
  if (recipe) {
    selectedRecipeId = recipe.recipe_id;
    const selectedOpportunity = opportunities.find((item) => item.recipe_id === recipe.recipe_id);
    const analysis = document.createElement('section');
    analysis.className = `analysis-panel${selectedOpportunity ? ' estimate-available' : ' estimate-unavailable'}`;
    const analysisTitle = document.createElement('h3');
    analysisTitle.textContent = 'Market analysis';
    analysis.append(analysisTitle);
    if (!selectedOpportunity) {
      const unavailable = document.createElement('p');
      unavailable.className = 'analysis-warning';
      unavailable.textContent = 'No positive eligible C++ estimate is available for this recipe under the current settings. The opportunity API omits non-positive candidates, so this does not mean the recipe is necessarily loss-making. Missing prices, stale data, low depth or volume, capital limits, or fees may exclude it.';
      analysis.append(unavailable);
      const unknown = document.createElement('p');
      unknown.className = 'empty-copy';
      unknown.textContent = 'Input costs, sale proceeds, fees, net, ROI and hourly rate are not shown because no valid calculation result was returned.';
      analysis.append(unknown);
    } else {
      const metrics = [
        ['Input cost · required capital', coin(selectedOpportunity.acquisition_cost_coins)],
        ['Guaranteed output', `${number.format(selectedOpportunity.output_quantity)} ${shard.name}`],
        ['Gross sale proceeds', coin(selectedOpportunity.gross_proceeds_coins)],
        ['Sale fees', coin(selectedOpportunity.sale_fee_coins)],
        ['Net batch profit', coin(selectedOpportunity.net_profit_coins)],
        ['ROI', `${(selectedOpportunity.roi_basis_points / 100).toFixed(2)}%`],
        ['Estimated profit / hour*', `${coin(selectedOpportunity.estimated_profit_per_hour_coins)}/hr`],
        ['Output visible exit depth', number.format(Number(selectedOpportunity.visible_output_depth))],
        ['Output weekly volume', selectedOpportunity.conservative_weekly_output_volume == null ? 'Unavailable' : number.format(selectedOpportunity.conservative_weekly_output_volume)],
      ];
      const metricGrid = document.createElement('dl');
      metricGrid.className = 'analysis-metrics';
      for (const [label, value] of metrics) {
        const wrapper = document.createElement('div');
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        if (label === 'Net batch profit') dd.className = 'profit-value';
        wrapper.append(dt, dd);
        metricGrid.append(wrapper);
      }
      analysis.append(metricGrid);
      const inputs = document.createElement('div');
      inputs.className = 'input-liquidity';
      const label = document.createElement('strong');
      label.textContent = 'Ingredient liquidity';
      inputs.append(label);
      for (const input of selectedOpportunity.inputs ?? []) {
        const row = document.createElement('p');
        row.textContent = `${nameFor(input.product_id)} · need ${number.format(input.quantity_total)} · estimated acquisition cost ${input.acquisition_cost_coins == null ? 'unavailable' : coin(input.acquisition_cost_coins)} · visible seller depth ${number.format(Number(input.visible_acquisition_depth))} · weekly volume ${number.format(input.conservative_weekly_volume)}`;
        inputs.append(row);
      }
      analysis.append(inputs);
      for (const warning of selectedOpportunity.warnings ?? []) {
        const warn = document.createElement('p');
        warn.className = 'analysis-warning';
        warn.textContent = warning;
        analysis.append(warn);
      }
      const freshness = document.createElement('p');
      freshness.className = 'analysis-footnote';
      freshness.textContent = `Snapshot ${analysisMeta?.observed_at ?? 'timestamp unavailable'} · ${analysisMeta?.data_age_ms == null ? 'age unavailable' : `${Math.floor(analysisMeta.data_age_ms / 1000)} sec old`} · ${selectedOpportunity.execution_model}.`;
      analysis.append(freshness);
    }
    const provenance = document.createElement('p');
    provenance.className = 'analysis-footnote';
    provenance.textContent = `Recipe ${recipe.recipe_id}. Pinned source ${catalogSource?.revision ?? 'unknown'}; structural validation only. Game requirements, unlocks, and special cases are unresolved.`;
    analysis.append(provenance);
    fragment.append(analysis);
  }
  container.replaceChildren(fragment);
}

async function showMoreRecipes() {
  if (!selected) return;
  const target = selected;
  if (recipeLimit < selected.recipes.length) {
    recipeLimit = Math.min(selected.recipes.length, recipeLimit + 60);
    renderRecipeDetails();
    return;
  }
  const nextOffset = selected.offset + selected.recipes.length;
  if (nextOffset >= selected.total_recipes) return;
  const button = $('.recipe-alternatives .text-button');
  if (button) { button.disabled = true; button.textContent = 'Loading recipes…'; }
  try {
    const page = await loadShardDetails(target.shard.shard_id, null, nextOffset);
    if (selected !== target) return;
    selected.recipes.push(...page.recipes);
    selected.limit = page.limit;
    recipeLimit = Math.min(selected.recipes.length, recipeLimit + 60);
    renderSelected();
  } catch (error) {
    setNotice(error.message, { error: true });
  }
}

function renderSelected() {
  renderBreadcrumb();
  renderGraph();
  renderRecipeDetails();
}

function resetGraph() {
  selectionRequest += 1;
  path = [];
  selected = null;
  selectedRecipeId = null;
  expandGraph = false;
  scale = 1;
  panX = 0;
  panY = 0;
  renderShardList();
  renderBreadcrumb();
  renderGraph();
  renderRecipeDetails();
}

async function loadCatalog() {
  setText($('#fusion-catalog-status'), 'Loading catalogue…');
  const response = await fetch('/api/v1/fusion/catalog', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? 'Fusion catalogue unavailable.');
  if (!Array.isArray(result.shards) || result.shards.some((item) => typeof item.shard_id !== 'string' || typeof item.name !== 'string')) {
    throw new Error('The catalogue response is malformed; graph data was not rendered.');
  }
  shards = result.shards;
  shardById = new Map(shards.map((item) => [item.shard_id, item]));
  catalogSource = result.source;
  const families = [...new Set(shards.map((item) => item.family).filter(Boolean))].sort();
  const rarities = [...new Set(shards.map((item) => item.rarity).filter(Boolean))].sort();
  optionList($('#family-filter'), families);
  optionList($('#rarity-filter'), rarities);
  setText($('#fusion-catalog-status'), `${result.shard_count} shards · ${number.format(result.recipe_count)} recipes`);
  renderShardList();
}

function settingsQuery() {
  return new URLSearchParams({
    tax_basis_points: $('#tax').value,
    capital_coins: $('#capital').value,
    maximum_quantity: $('#quantity').value,
    minimum_weekly_volume: $('#weekly-volume').value,
    sale_horizon_hours: $('#sale-window').value,
    volume_share_basis_points: String(Number($('#volume-share').value) * 100),
    max_data_age_seconds: $('#max-data-age').value,
  });
}

function toMicros(value) {
  const text = String(value ?? '0').trim();
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/.test(text)) return 0n;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export async function refreshFusionPage() {
  if (!pageInitialized) return;
  const refresh = $('#fusion-refresh');
  refresh.disabled = true;
  setText($('#fusion-count'), 'Analysing…');
  setNotice('');
  try {
    const [statusResponse, analysisResponse] = await Promise.all([
      fetch('/api/v1/status', { cache: 'no-store' }),
      fetch(`/api/v1/opportunities/fusion?${settingsQuery()}`, { cache: 'no-store' }),
    ]);
    const status = await statusResponse.json();
    const result = await analysisResponse.json();
    if (!analysisResponse.ok) throw new Error(result.error?.message ?? 'Could not analyse shard fusion.');
    setText($('#fusion-snapshot'), status.observed_at ? new Date(status.observed_at).toLocaleString() : 'No validated snapshot');
    const freshness = $('#fusion-freshness');
    const stale = result.stale || result.unavailable_reason || status.market_state === 'stale';
    const sourceUnavailable = status.market_state === 'unavailable';
    freshness.className = `freshness ${stale || sourceUnavailable ? 'stale' : 'current'}`;
    freshness.textContent = sourceUnavailable ? 'Source unavailable · cached snapshot'
      : stale ? 'Stale or incomplete market data'
      : result.data_age_ms == null ? 'Market data age unavailable' : `Market data ${Math.floor(result.data_age_ms / 1000)} sec old`;
    analysisMeta = { observed_at: result.observed_at, data_age_ms: result.data_age_ms };
    if (result.unavailable_reason) {
      opportunities = [];
      setNotice('Analysis is unavailable because the current Bazaar snapshot is stale or incomplete. Catalogue browsing remains available.', { error: true });
    } else {
      opportunities = result.opportunities ?? [];
      if (result.truncated) setNotice('Showing the top 100 eligible results returned by the server. Adjust capital or volume assumptions to refine discovery.');
      else if (!opportunities.length) setNotice('No eligible positive fusion result under the current market, depth, volume and capital settings. The server does not return unprofitable candidates.');
      if (sourceUnavailable) setNotice('The latest upstream refresh failed. This analysis uses the last validated snapshot and may be out of date.');
    }
    if (selected) renderSelected();
    renderOpportunities();
    setText($('#fusion-count'), `${opportunities.length}${result.truncated ? '+' : ''}`);
  } catch (error) {
    opportunities = [];
    setText($('#fusion-count'), 'Unavailable');
    $('#fusion-freshness').className = 'freshness unavailable';
    setText($('#fusion-freshness'), 'Analysis unavailable');
    setNotice(error.message, { error: true });
    renderOpportunities();
    if (selected) renderSelected();
  } finally {
    refresh.disabled = false;
  }
}

export function initFusionPage(formatters = {}) {
  if (pageInitialized) return;
  pageInitialized = true;
  displayName = formatters.displayName ?? displayName;
  coin = formatters.coin ?? coin;
  number = formatters.number ?? number;
  $('#shard-search').addEventListener('input', renderShardList);
  $('#family-filter').addEventListener('change', renderShardList);
  $('#rarity-filter').addEventListener('change', renderShardList);
  $('#recipe-filter').addEventListener('change', renderShardList);
  $('#fusion-sort').addEventListener('change', renderOpportunities);
  $('#fusion-min-profit').addEventListener('input', renderOpportunities);
  $('#fusion-min-roi').addEventListener('input', renderOpportunities);
  $('#fusion-refresh').addEventListener('click', () => void refreshFusionPage());
  $('#graph-fit').addEventListener('click', () => { scale = 1; panX = 0; panY = 0; applyTransform(); });
  $('#graph-reset').addEventListener('click', resetGraph);
  $('#graph-zoom-in').addEventListener('click', () => { scale = Math.min(2.5, scale * 1.2); applyTransform(); });
  $('#graph-zoom-out').addEventListener('click', () => { scale = Math.max(0.55, scale / 1.2); applyTransform(); });
  const svg = $('#fusion-svg');
  svg.addEventListener('pointerdown', (event) => {
    if (event.target.closest('[data-node-id]')) return;
    dragging = { x: event.clientX, y: event.clientY, panX, panY };
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    panX = dragging.panX + event.clientX - dragging.x;
    panY = dragging.panY + event.clientY - dragging.y;
    applyTransform();
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    svg.addEventListener(eventName, () => { dragging = null; });
  }
  void Promise.all([loadCatalog(), refreshFusionPage()]).catch((error) => {
    $('#graph-error').hidden = false;
    setText($('#graph-error'), error.message);
    setText($('#fusion-catalog-status'), 'Catalogue unavailable');
    setNotice(error.message, { error: true });
  });
}
