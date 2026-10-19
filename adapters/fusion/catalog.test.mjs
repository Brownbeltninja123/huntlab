import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_SOURCE, loadFusionCatalog, parseFusionCatalog } from './catalog.mjs';

test('loads the pinned licensed catalog and validates deterministic recipe quantities', async () => {
  const catalog = await loadFusionCatalog();
  assert.equal(catalog.shardCount, 322);
  assert.equal(catalog.recipes.length, 129_289);
  assert.equal(catalog.source.revision, CATALOG_SOURCE.revision);
  assert.ok(catalog.recipes.every((recipe) => recipe.output_quantity === 1 || recipe.output_quantity === 2));
});

test('rejects unknown shard references and invalid yields', () => {
  const base = { shards: { A: { internal_id: 'SHARD_A', fuse_amount: 1 } }, recipes: {} };
  assert.throws(() => parseFusionCatalog({ ...base, recipes: { A: { 1: [['A', 'MISSING']] } } }), /Invalid recipe edge/);
  assert.throws(() => parseFusionCatalog({ ...base, recipes: { A: { 3: [['A', 'A']] } } }), /Invalid output yield/);
});
