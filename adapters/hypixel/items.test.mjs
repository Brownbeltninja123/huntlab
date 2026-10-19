import test from 'node:test';
import assert from 'node:assert/strict';
import { createItemCatalogFetcher, parseItemCatalog } from './items.mjs';

test('normalizes item names and ignores malformed resource entries', () => {
  const items = parseItemCatalog({ success: true, items: [
    { id: 'ENCHANTED_DIAMOND', name: 'Enchanted Diamond', material: 'DIAMOND', tier: 'UNCOMMON' },
    { id: 'BAD ID', name: 'ignored' },
    { id: 'NO_NAME' },
  ] });
  assert.deepEqual(items, [{
    product_id: 'ENCHANTED_DIAMOND', name: 'Enchanted Diamond', material: 'DIAMOND', tier: 'UNCOMMON',
  }]);
  assert.throws(() => parseItemCatalog({ success: false, items: [] }), /malformed/);
});

test('caches the official item resource between refresh intervals', async () => {
  let now = 1000;
  let calls = 0;
  const fetchItems = createItemCatalogFetcher({
    now: () => now,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ success: true, items: [{ id: 'TEST', name: 'Test' }] }) };
    },
  });
  assert.equal((await fetchItems())[0].name, 'Test');
  now += 1000;
  await fetchItems();
  assert.equal(calls, 1);
});
