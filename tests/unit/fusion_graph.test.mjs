import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFusionGraph, filterShards, sortOpportunities } from '../../apps/web/public/fusion-graph.js';

const shard = { shard_id: 'SHARD_OUT', name: 'Output' };
const recipes = [
  { recipe_id: 'SHARD_OUT:SHARD_A:SHARD_B:1', output_product_id: 'SHARD_OUT', output_quantity: 1,
    first_input_product_id: 'SHARD_A', first_input_quantity: 2, second_input_product_id: 'SHARD_B', second_input_quantity: 3 },
  { recipe_id: 'SHARD_OUT:SHARD_A:SHARD_A:2', output_product_id: 'SHARD_OUT', output_quantity: 2,
    first_input_product_id: 'SHARD_A', first_input_quantity: 2, second_input_product_id: 'SHARD_A', second_input_quantity: 2 },
];

test('fusion graph represents the selected recipe as a directed, guaranteed-output path', () => {
  const graph = buildFusionGraph(shard, recipes, recipes[0].recipe_id);
  assert.equal(graph.recipe.recipe_id, recipes[0].recipe_id);
  assert.equal(graph.nodes.length, 4);
  assert.equal(graph.links.length, 3);
  assert.ok(graph.links.every((link) => graph.nodes.some((node) => node.id === link.from) && graph.nodes.some((node) => node.id === link.to)));
  assert.equal(graph.nodes.find((node) => node.kind === 'output').quantity, 1);
});

test('fusion graph deduplicates identical input nodes and aggregates their edge quantity', () => {
  const graph = buildFusionGraph(shard, recipes, recipes[1].recipe_id);
  assert.equal(graph.nodes.filter((node) => node.kind === 'shard').length, 1);
  assert.equal(graph.links.find((link) => link.from === 'shard:SHARD_A').label, '× 4');
  assert.equal(graph.links.filter((link) => link.to.startsWith('recipe:')).length, 1);
});

test('expanded graph shows bounded alternatives and deduplicates shared shard nodes', () => {
  const more = Array.from({ length: 8 }, (_, index) => ({ ...recipes[0],
    recipe_id: `SHARD_OUT:SHARD_A:SHARD_${index}:1`, second_input_product_id: `SHARD_${index}` }));
  const graph = buildFusionGraph(shard, more, more[0].recipe_id, true);
  assert.equal(graph.visibleRecipes.length, 4);
  assert.equal(graph.truncatedAlternatives, 4);
  assert.equal(graph.nodes.filter((node) => node.id === 'shard:SHARD_A').length, 1);
  assert.equal(graph.nodes.filter((node) => node.kind === 'recipe').length, 4);
  assert.ok(graph.links.every((link) => graph.nodes.some((node) => node.id === link.from) && graph.nodes.some((node) => node.id === link.to)));
});

test('malformed catalogue edges are excluded instead of rendered', () => {
  const graph = buildFusionGraph(shard, [...recipes, { ...recipes[0], recipe_id: 'bad', first_input_quantity: 0 }]);
  assert.equal(graph.rejected_recipe_count, 1);
  assert.equal(graph.alternatives, 2);
  assert.throws(() => buildFusionGraph(null, []), /validated shard/);
});

test('search filters use names, IDs, family, rarity, and known recipe type', () => {
  const input = [
    { shard_id: 'SHARD_A', name: 'Grove', family: 'Forest', rarity: 'common', recipe_type: null },
    { shard_id: 'SHARD_B', name: 'Mire', family: 'Swamp', rarity: 'rare', recipe_type: 'random' },
  ];
  assert.deepEqual(filterShards(input, { query: 'grove' }).map((item) => item.shard_id), ['SHARD_A']);
  assert.deepEqual(filterShards(input, { query: 'SHARD_B' }).map((item) => item.shard_id), ['SHARD_B']);
  assert.deepEqual(filterShards(input, { family: 'Swamp', rarity: 'rare', recipeType: 'random' }).map((item) => item.name), ['Mire']);
  assert.deepEqual(filterShards(input, { recipeType: 'standard' }).map((item) => item.name), ['Grove']);
});

test('opportunity sorting keeps profit, ROI, and throughput as separate orderings', () => {
  const input = [
    { id: 'a', net_profit_coins: '100', roi_basis_points: 500, estimated_profit_per_hour_coins: '20' },
    { id: 'b', net_profit_coins: '50', roi_basis_points: 1000, estimated_profit_per_hour_coins: '90' },
  ];
  assert.deepEqual(sortOpportunities(input, 'net').map((item) => item.id), ['a', 'b']);
  assert.deepEqual(sortOpportunities(input, 'roi').map((item) => item.id), ['b', 'a']);
  assert.deepEqual(sortOpportunities(input, 'hourly').map((item) => item.id), ['b', 'a']);
});
