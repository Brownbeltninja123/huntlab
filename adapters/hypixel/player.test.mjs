import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerProfileFetcher } from './player.mjs';

test('looks up a public selected profile and caches the balance response', async () => {
  let calls = 0;
  let currentTime = 1_800_000_000_000;
  const responses = [
    { success: true, player: { uuid: '01234567-89ab-cdef-0123-456789abcdef', displayname: 'Hunter' } },
    { success: true, profiles: [{
      cute_name: 'Pomegranate', selected: true,
      banking: { balance: 9_000 },
      members: { '0123456789abcdef0123456789abcdef': { coin_purse: 1_234.5 } },
    }] },
  ];
  const fetchProfile = createPlayerProfileFetcher({
    apiKey: 'test-only', now: () => currentTime,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(options.headers['API-Key'], 'test-only');
      return { ok: true, status: 200, json: async () => responses.shift() };
    },
  });
  const result = await fetchProfile('Hunter');
  assert.equal(result.profile_name, 'Pomegranate');
  assert.equal(result.purse_coins, 1_234.5);
  assert.equal(result.bank_coins, 9_000);
  assert.equal(calls, 2);
  currentTime += 30 * 60 * 1000;
  assert.deepEqual(await fetchProfile('hunter'), result);
  assert.equal(calls, 2);
});

test('rejects invalid usernames and does not require API key when only Bazaar data is used', async () => {
  const fetchProfile = createPlayerProfileFetcher({ apiKey: '' });
  await assert.rejects(fetchProfile('x'), { code: 'api_key_required' });
  const configured = createPlayerProfileFetcher({ apiKey: 'test', fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(configured('bad name'), { code: 'invalid_username' });
});

test('reports profile privacy as unavailable instead of inventing a zero balance', async () => {
  const payloads = [
    { success: true, player: { uuid: '0123456789abcdef0123456789abcdef' } },
    { success: true, profiles: [{ selected: true, members: { '0123456789abcdef0123456789abcdef': {} } }] },
  ];
  const fetchProfile = createPlayerProfileFetcher({
    apiKey: 'test', fetchImpl: async () => ({ ok: true, status: 200, json: async () => payloads.shift() }),
  });
  const result = await fetchProfile('Hunter');
  assert.equal(result.purse_coins, null);
  assert.equal(result.balance_visibility, 'limited');
});
