import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const CATALOG_SOURCE = Object.freeze({
  repository: 'https://github.com/Campionnn/SkyShards',
  revision: 'bc767f820318ab0ae2ce6bd5150c7095dd00da12',
  sha256: '52ebf05761c7858a18baab2dcafd3c5ab09e841373554dda0d8332917e864391',
  license: 'MIT',
  chanceBonusPolicy: 'excluded; guaranteed output only',
});

const sourcePath = new URL('../../data/fusion/fusion-data.json', import.meta.url);
const ID = /^[A-Z0-9_:-]{1,128}$/;

export function parseFusionCatalog(source) {
  const data = typeof source === 'string' ? JSON.parse(source) : source;
  if (!data || !data.shards || !data.recipes || typeof data.shards !== 'object' || typeof data.recipes !== 'object') {
    throw new Error('Fusion catalog must contain shard and recipe objects');
  }
  const ids = new Set();
  const productIds = new Set();
  const shards = [];
  for (const [key, shard] of Object.entries(data.shards)) {
    if (!ID.test(key) || !shard || !ID.test(shard.internal_id ?? '') ||
        typeof shard.name !== 'string' || !shard.name.trim() ||
        !Number.isSafeInteger(shard.fuse_amount) || shard.fuse_amount <= 0 || productIds.has(shard.internal_id) ||
        !['family', 'type', 'rarity', 'recipe_type'].every((field) => shard[field] == null || typeof shard[field] === 'string') ||
        !['synthesized', 'chameleon'].every((field) => shard[field] == null || typeof shard[field] === 'boolean')) {
      throw new Error(`Invalid fusion shard entry ${key}`);
    }
    ids.add(key);
    productIds.add(shard.internal_id);
    shards.push({
      shard_id: shard.internal_id,
      source_key: key,
      name: shard.name,
      family: shard.family ?? null,
      type: shard.type ?? null,
      rarity: shard.rarity ?? null,
      fuse_amount: shard.fuse_amount,
      synthesized: shard.synthesized ?? null,
      chameleon: shard.chameleon ?? null,
      recipe_type: shard.recipe_type ?? null,
    });
  }
  const recipes = [];
  for (const [outputKey, yields] of Object.entries(data.recipes)) {
    if (!ids.has(outputKey) || !yields || typeof yields !== 'object') throw new Error(`Invalid fusion output ${outputKey}`);
    for (const [yieldText, pairs] of Object.entries(yields)) {
      const outputQuantity = Number(yieldText);
      if (![1, 2].includes(outputQuantity) || !Array.isArray(pairs)) throw new Error(`Invalid output yield for ${outputKey}`);
      for (const pair of pairs) {
        if (!Array.isArray(pair) || pair.length !== 2 || !pair.every((id) => ids.has(id))) {
          throw new Error(`Invalid recipe edge for ${outputKey}`);
        }
        const [firstKey, secondKey] = pair;
        const output = data.shards[outputKey];
        const first = data.shards[firstKey];
        const second = data.shards[secondKey];
        // The graph explicitly identifies the chosen output. Ignore only source rows
        // marked as random; chance-based bonus output is never inferred here.
        if (output.recipe_type === 'random') continue;
        recipes.push({
          recipe_id: `${output.internal_id}:${data.shards[firstKey].internal_id}:${data.shards[secondKey].internal_id}:${outputQuantity}`,
          output_product_id: output.internal_id,
          output_quantity: outputQuantity,
          first_input_product_id: first.internal_id,
          first_input_quantity: first.fuse_amount,
          second_input_product_id: second.internal_id,
          second_input_quantity: second.fuse_amount,
        });
      }
    }
  }
  return { shards, recipes, shardCount: ids.size, rawRecipeCount: recipes.length };
}

export async function loadFusionCatalog() {
  const bytes = await readFile(sourcePath);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== CATALOG_SOURCE.sha256) throw new Error('Pinned fusion catalog hash does not match provenance');
  const catalog = parseFusionCatalog(bytes.toString('utf8'));
  return { ...catalog, source: CATALOG_SOURCE };
}
