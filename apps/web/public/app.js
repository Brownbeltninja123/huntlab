import { initFusionPage, refreshFusionPage } from './fusion-page.js';

const connection = document.querySelector('#connection');
const snapshotTime = document.querySelector('#snapshot-time');
const productCount = document.querySelector('#product-count');
const dataAge = document.querySelector('#data-age');
const freshness = document.querySelector('#freshness');
const rows = document.querySelector('#opportunities');
const notice = document.querySelector('#notice');
const rowCount = document.querySelector('#row-count');
const form = document.querySelector('#settings-form');
const refreshButton = document.querySelector('#refresh');
const profileForm = document.querySelector('#profile-form');
const profileUsername = document.querySelector('#profile-username');
const profileResult = document.querySelector('#profile-result');
const searchInput = document.querySelector('#search');
const sortInput = document.querySelector('#sort');
const settingsIds = ['tax', 'capital', 'quantity', 'weekly-volume', 'sale-window', 'volume-share', 'max-data-age'];
let opportunities = [];
let itemNames = new Map();

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 });
const coin = (amount) => `${number.format(Number(amount))} coins`;

function setMarketState(state, ageMs, error) {
  connection.className = `connection ${state}`;
  connection.lastElementChild.textContent = state === 'current' ? 'Connected'
    : state === 'stale' ? 'Stale data' : state === 'unavailable' ? 'Source unavailable' : 'Waiting';
  freshness.className = `freshness ${state}`;
  freshness.textContent = state === 'current' ? 'Market data current'
    : state === 'stale' ? 'Showing stale snapshot'
      : state === 'unavailable' ? 'Upstream unavailable · cached data shown' : 'Waiting for source';
  dataAge.textContent = ageMs == null ? '—' : `${Math.floor(ageMs / 1000)} sec`;
  if (error) showNotice(error);
}

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}

function clearNotice() {
  notice.textContent = '';
  notice.hidden = true;
}

function renderOpportunities(items) {
  rowCount.textContent = `${items.length} found`;
  if (!items.length) {
    rows.innerHTML = opportunities.length && searchInput.value.trim()
      ? '<tr><td colspan="10" class="empty">No item names match your search.</td></tr>'
      : '<tr><td colspan="10" class="empty">No positive estimate meets the volume, depth, freshness, and budget limits.</td></tr>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const row = document.createElement('tr');
    const cells = [
      [`${displayName(item.product_id)}${item.risk_flags?.length ? ` · Caution: ${item.risk_flags.map(riskLabel).join(', ')}` : ''}`, item.risk_flags?.length ? 'product caution' : 'product'],
      [`${number.format(item.quantity)} / ${number.format(item.weekly_volume_cap)} max`, ''],
      [coin(item.acquisition_vwap_coins), ''],
      [coin(item.disposal_vwap_coins), ''],
      [`${number.format(BigInt(item.acquisition_visible_depth))} / ${number.format(BigInt(item.disposal_visible_depth))}`, ''],
      [coin(item.acquisition_cost_coins), ''],
      [coin(item.net_profit_coins), 'profit'],
      [coin(item.estimated_profit_per_hour_coins) + '/hr', 'profit'],
      [`${(item.roi_basis_points / 100).toFixed(2)}%`, 'roi'],
      [(item.binding_constraints ?? []).map(constraintLabel).join(', ') || 'No single limit', ''],
    ];
    for (const [value, className] of cells) {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (className) cell.className = className;
      row.append(cell);
    }
    row.title = [item.product_id, ...item.warnings, ...(item.risk_flags ?? []).map(riskDescription)].join(' · ');
    row.dataset.search = `${item.product_id} ${displayName(item.product_id)}`.toLocaleLowerCase();
    fragment.append(row);
  }
  rows.replaceChildren(fragment);
}

function constraintLabel(constraint) {
  return ({ user_maximum_quantity: 'batch max', available_capital: 'capital',
    acquisition_depth: 'buy depth', disposal_depth: 'exit depth', weekly_volume: 'weekly volume',
    profit_maximizing_quantity: 'profit optimum' })[constraint] ?? constraint;
}

function riskDescription(flag) {
  return flag === 'thin_visible_book' ? 'Few visible orders: fills may be fragile.'
    : flag === 'single_order_dominates_book' ? 'One order dominates visible depth.'
      : flag === 'unusually_wide_spread' ? 'Unusually wide immediate spread; verify in game.' : flag;
}

function riskLabel(flag) {
  return flag === 'thin_visible_book' ? 'thin book'
    : flag === 'single_order_dominates_book' ? 'one large order'
      : flag === 'unusually_wide_spread' ? 'wide spread' : flag;
}

function readableName(productId) {
  return productId.replaceAll('_', ' ').toLocaleLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
}

function displayName(productId) {
  return itemNames.get(productId) ?? readableName(productId);
}

function renderFilteredOpportunities() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filtered = opportunities.filter((item) =>
    `${item.product_id} ${displayName(item.product_id)}`.toLocaleLowerCase().includes(query));
  const coinValue = (value) => {
    const [whole, fraction = ''] = value.split('.');
    return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  };
  const compareCoins = (a, b) => {
    const left = coinValue(a);
    const right = coinValue(b);
    return left > right ? -1 : left < right ? 1 : 0;
  };
  const compare = sortInput.value === 'roi'
    ? (a, b) => b.roi_basis_points - a.roi_basis_points
    : sortInput.value === 'batch'
      ? (a, b) => compareCoins(a.net_profit_coins, b.net_profit_coins)
      : (a, b) => compareCoins(a.estimated_profit_per_hour_coins, b.estimated_profit_per_hour_coins);
  filtered.sort(compare);
  renderOpportunities(filtered);
}

async function loadItemNames() {
  try {
    const response = await fetch('/api/v1/items', { cache: 'no-store' });
    if (!response.ok) return;
    const result = await response.json();
    itemNames = new Map(result.items.map((item) => [item.product_id, item.name]));
    renderFilteredOpportunities();
  } catch {
    // Readable product IDs remain available when the metadata endpoint is offline.
  }
}

function restoreSettings() {
  for (const id of settingsIds) {
    const saved = localStorage.getItem(`huntlab.${id}`);
    if (saved !== null) document.getElementById(id).value = saved;
  }
  profileUsername.value = localStorage.getItem('huntlab.profileUsername') ?? '';
  sortInput.value = localStorage.getItem('huntlab.sort') ?? 'hourly';
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = profileUsername.value.trim();
  const button = profileForm.querySelector('button');
  button.disabled = true;
  profileResult.textContent = 'Fetching visible profile data…';
  try {
    const response = await fetch(`/api/v1/profile?username=${encodeURIComponent(username)}`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message ?? 'Could not fetch that profile.');
    localStorage.setItem('huntlab.profileUsername', username);
    const parts = [`${result.username} · ${result.profile_name}`];
    if (result.purse_coins !== null) parts.push(`Purse: ${coin(result.purse_coins)}`);
    if (result.bank_coins !== null) parts.push(`Bank: ${coin(result.bank_coins)}`);
    profileResult.textContent = parts.join(' · ');
    if (result.purse_coins !== null) {
      document.querySelector('#capital').value = String(result.purse_coins);
      localStorage.setItem('huntlab.capital', String(result.purse_coins));
      profileResult.textContent += ' · Purse copied to capital';
    } else {
      profileResult.textContent += ' · Purse is hidden or unavailable in profile data';
    }
  } catch (error) {
    profileResult.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

async function load() {
  refreshButton.disabled = true;
  clearNotice();
  try {
    const statusResponse = await fetch('/api/v1/status', { cache: 'no-store' });
    const status = await statusResponse.json();
    setMarketState(status.market_state, status.data_age_ms,
      status.last_error ? `Latest refresh failed: ${status.last_error}` : null);

    if (!status.snapshot_id) {
      snapshotTime.textContent = 'No validated snapshot';
      productCount.textContent = '—';
      renderOpportunities([]);
      rows.innerHTML = '<tr><td colspan="10" class="empty">No market data is available yet. The service will keep retrying within its configured limits.</td></tr>';
      return;
    }

    const snapshotResponse = await fetch('/api/v1/market/snapshot', { cache: 'no-store' });
    const snapshot = await snapshotResponse.json();
    snapshotTime.textContent = new Date(snapshot.observed_at).toLocaleString();
    productCount.textContent = number.format(snapshot.product_count);

    const parameters = new URLSearchParams({
      tax_basis_points: document.querySelector('#tax').value,
      capital_coins: document.querySelector('#capital').value,
      maximum_quantity: document.querySelector('#quantity').value,
      minimum_weekly_volume: document.querySelector('#weekly-volume').value,
      sale_horizon_hours: document.querySelector('#sale-window').value,
      volume_share_basis_points: String(Number(document.querySelector('#volume-share').value) * 100),
      max_data_age_seconds: document.querySelector('#max-data-age').value,
    });
    const opportunityResponse = await fetch(`/api/v1/opportunities/bazaar?${parameters}`, { cache: 'no-store' });
    const result = await opportunityResponse.json();
    if (!opportunityResponse.ok) throw new Error(result.error?.message ?? 'Could not calculate opportunities.');
    setMarketState(result.stale ? 'stale' : 'current', result.data_age_ms);
    if (result.truncated) showNotice('Showing the top 100 results. Increase the minimum weekly volume or adjust your budget to narrow the list.');
    if (result.unavailable_reason) showNotice('No flips shown: market snapshot is older than your data-age limit or incomplete. Refresh the source or increase the allowed age.');
    opportunities = result.opportunities;
    renderFilteredOpportunities();
  } catch (error) {
    setMarketState('unavailable', null, error.message);
  } finally {
    refreshButton.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  for (const id of settingsIds) localStorage.setItem(`huntlab.${id}`, document.getElementById(id).value);
  void load();
  if (location.pathname.startsWith('/fusion')) void refreshFusionPage();
});
searchInput.addEventListener('input', renderFilteredOpportunities);
sortInput.addEventListener('change', () => {
  localStorage.setItem('huntlab.sort', sortInput.value);
  renderFilteredOpportunities();
});
refreshButton.addEventListener('click', () => void load());
restoreSettings();
void loadItemNames();
void load();
setInterval(() => void load(), 30_000);
let fusionInitialized = false;
function navigate(path, push = true) {
  const isFusion = path === '/fusion' || path === '/fusion/';
  if (push && location.pathname !== (isFusion ? '/fusion' : '/')) history.pushState({}, '', isFusion ? '/fusion' : '/');
  document.querySelector('#bazaar').hidden = isFusion;
  document.querySelector('#fusion-page').hidden = !isFusion;
  document.querySelector(isFusion ? '#fusion-settings-slot' : '#bazaar-settings-slot')
    .append(document.querySelector('#shared-assumptions'));
  document.querySelectorAll('[data-route]').forEach((link) => {
    const active = link.dataset.route === (isFusion ? 'fusion' : 'bazaar');
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.title = isFusion ? 'HuntLab · Shard Fusion Explorer' : 'HuntLab · Bazaar Analysis';
  if (isFusion && !fusionInitialized) {
    fusionInitialized = true;
    initFusionPage({ displayName, coin, number });
  }
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(link.dataset.route === 'fusion' ? '/fusion' : '/');
});
window.addEventListener('popstate', () => navigate(location.pathname, false));
navigate(location.pathname, false);
