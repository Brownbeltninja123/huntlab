const BASE_URL = 'https://api.hypixel.net/v2';
const UUID_PATTERN = /^[0-9a-f]{32}$/i;

function apiError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function getJson(fetchImpl, path, apiKey) {
  const response = await fetchImpl(`${BASE_URL}${path}`, {
    headers: { 'API-Key': apiKey },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw apiError(response.status === 429 ? 'Hypixel API rate limit reached; try again later.'
      : `Hypixel API returned HTTP ${response.status}.`,
    response.status === 429 ? 'hypixel_rate_limited' : 'hypixel_request_failed');
  }
  const result = await response.json();
  if (result?.success !== true) {
    throw apiError('Hypixel did not return profile data. Check the player name and API visibility settings.',
      'profile_unavailable');
  }
  return result;
}

function readNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function createPlayerProfileFetcher({
  fetchImpl = fetch,
  apiKey = process.env.HYPIXEL_API_KEY ?? '',
  now = Date.now,
  cacheTtlMs = 60 * 60 * 1000,
  maximumCacheEntries = 100,
} = {}) {
  const cache = new Map();
  return async function fetchPlayerProfile(rawUsername) {
    if (!apiKey) throw apiError('Configure a server-side Hypixel API key to look up profiles.', 'api_key_required');
    if (typeof rawUsername !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(rawUsername)) {
      throw apiError('Enter a valid Minecraft username (3–16 letters, numbers, or underscores).', 'invalid_username');
    }
    const username = rawUsername;
    const cacheKey = username.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && now() - cached.fetchedAt < cacheTtlMs) return cached.value;

    const playerResponse = await getJson(fetchImpl,
      `/player?name=${encodeURIComponent(username)}`, apiKey);
    const player = playerResponse.player;
    if (typeof player?.uuid !== 'string' || !UUID_PATTERN.test(player.uuid.replaceAll('-', ''))) {
      throw apiError('Hypixel could not find that player.', 'player_not_found');
    }
    const uuid = player.uuid.replaceAll('-', '').toLowerCase();
    const profilesResponse = await getJson(fetchImpl, `/skyblock/profiles?uuid=${uuid}`, apiKey);
    const profiles = Array.isArray(profilesResponse.profiles) ? profilesResponse.profiles : [];
    const selectedProfile = profiles.find((profile) => profile?.selected) ?? profiles[0];
    const memberMap = selectedProfile?.members ?? {};
    const member = memberMap[uuid] ?? memberMap[player.uuid] ??
      Object.entries(memberMap).find(([key, value]) =>
        key.replaceAll('-', '').toLowerCase() === uuid ||
        (typeof value?.player_id === 'string' && value.player_id.replaceAll('-', '').toLowerCase() === uuid),
      )?.[1];
    if (!selectedProfile || !member) {
      throw apiError('No visible SkyBlock profile was returned for this player.', 'profile_unavailable');
    }
    const value = {
      username: player.displayname ?? username,
      uuid,
      profile_name: selectedProfile.cute_name ?? 'SkyBlock profile',
      purse_coins: readNonNegativeNumber(member.coin_purse),
      bank_coins: readNonNegativeNumber(selectedProfile.banking?.balance),
      fetched_at: new Date(now()).toISOString(),
      balance_visibility: readNonNegativeNumber(member.coin_purse) === null ? 'limited' : 'available',
    };
    if (cache.size >= maximumCacheEntries) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { fetchedAt: now(), value });
    return value;
  };
}
