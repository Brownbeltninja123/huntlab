const ID = /^[A-Z0-9_:-]{1,128}$/;

export function filterShards(shards, { query = '', family = '', rarity = '', recipeType = '' } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return shards.filter((shard) => {
    if (needle && !`${shard.name} ${shard.shard_id} ${shard.family ?? ''}`.toLocaleLowerCase().includes(needle)) return false;
    if (family && shard.family !== family) return false;
    if (rarity && shard.rarity !== rarity) return false;
    if (recipeType && (shard.recipe_type ?? 'standard') !== recipeType) return false;
    return true;
  });
}

export function buildFusionGraph(shard, recipes, selectedRecipeId = null, expandAlternatives = false) {
  if (!shard || !ID.test(shard.shard_id) || !Array.isArray(recipes)) {
    throw new TypeError('A validated shard and recipe list are required to build the fusion graph.');
  }
  const validRecipes = recipes.filter((recipe) => recipe.output_product_id === shard.shard_id &&
    ID.test(recipe.recipe_id) && ID.test(recipe.first_input_product_id) && ID.test(recipe.second_input_product_id) &&
    Number.isSafeInteger(recipe.first_input_quantity) && recipe.first_input_quantity > 0 &&
    Number.isSafeInteger(recipe.second_input_quantity) && recipe.second_input_quantity > 0 &&
    Number.isSafeInteger(recipe.output_quantity) && recipe.output_quantity > 0);
  const selected = validRecipes.find((recipe) => recipe.recipe_id === selectedRecipeId) ?? validRecipes[0] ?? null;
  if (!selected) return { nodes: [], links: [], recipe: null, alternatives: validRecipes.length, rejected_recipe_count: recipes.length };
  const visibleRecipes = expandAlternatives
    ? [selected, ...validRecipes.filter((recipe) => recipe.recipe_id !== selected.recipe_id)].slice(0, 4)
    : [selected];
  const nodes = new Map();
  const links = [];
  const rowHeight = 150;
  visibleRecipes.forEach((recipe, index) => {
    const centerY = 100 + index * rowHeight;
    const recipeNodeId = `recipe:${recipe.recipe_id}`;
    if (!nodes.has(recipeNodeId)) nodes.set(recipeNodeId, { id: recipeNodeId, kind: 'recipe', recipe_id: recipe.recipe_id, recipe, x: 360, y: centerY });
    const outputId = `output:${shard.shard_id}`;
    if (!nodes.has(outputId)) nodes.set(outputId, { id: outputId, kind: 'output', shard_id: shard.shard_id,
      quantity: recipe.output_quantity, x: 650, y: 100 + ((visibleRecipes.length - 1) * rowHeight) / 2 });
    const sameInput = recipe.first_input_product_id === recipe.second_input_product_id;
    const inputs = [
      { id: recipe.first_input_product_id, quantity: recipe.first_input_quantity, y: sameInput ? centerY : centerY - 43, slot: 'first' },
      ...(!sameInput ? [{ id: recipe.second_input_product_id, quantity: recipe.second_input_quantity, y: centerY + 43, slot: 'second' }] : []),
    ];
    if (sameInput) inputs[0].quantity += recipe.second_input_quantity;
    for (const input of inputs) {
      const inputNodeId = `shard:${input.id}`;
      if (!nodes.has(inputNodeId)) nodes.set(inputNodeId, { id: inputNodeId, kind: 'shard', shard_id: input.id, x: 70, y: input.y });
      links.push({ id: `${input.slot}:${recipe.recipe_id}`, from: inputNodeId, to: recipeNodeId,
        label: `× ${input.quantity}` });
    }
    links.push({ id: `output:${recipe.recipe_id}`, from: recipeNodeId, to: outputId,
      label: `× ${recipe.output_quantity} guaranteed` });
  });
  return { nodes: [...nodes.values()], links, recipe: selected, visibleRecipes, alternatives: validRecipes.length,
    truncatedAlternatives: Math.max(0, validRecipes.length - visibleRecipes.length), rejected_recipe_count: recipes.length - validRecipes.length };
}

export function sortOpportunities(opportunities, sort = 'net') {
  const toMicros = (value) => {
    const [whole, fractional = ''] = String(value).split('.');
    return BigInt(whole) * 1_000_000n + BigInt(fractional.padEnd(6, '0').slice(0, 6));
  };
  const compareCoins = (a, b, property) => {
    const left = toMicros(a[property]);
    const right = toMicros(b[property]);
    return left > right ? -1 : left < right ? 1 : 0;
  };
  return [...opportunities].sort(sort === 'roi'
    ? (a, b) => b.roi_basis_points - a.roi_basis_points
    : sort === 'hourly'
      ? (a, b) => compareCoins(a, b, 'estimated_profit_per_hour_coins')
      : (a, b) => compareCoins(a, b, 'net_profit_coins'));
}
