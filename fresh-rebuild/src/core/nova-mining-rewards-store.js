import { waitForFirebaseUser } from './firebase-backend.js';

// Mining is served by the production NexusNova Telegram/Cloudflare Worker.
// Keep the legacy reward exports intact so unrelated Nova Vault/task modules
// continue to load without a module-import regression.
const MINING_API_BASE = 'https://nexusnova-telegram-bot.fahadsoomro123.workers.dev';
const LEGACY_REWARD_API_BASE = 'https://nova-mining-rewards.fahadsoomro123.workers.dev';

const ACTIONS = Object.freeze({
  claimDailyReward: '/v1/tasks/daily/claim',
  openNovaVault: '/v1/vault/open',
  openNovaVaultBoosted: '/v1/vault/boosted/open',
  useNovaBoost: '/v1/boost/use',
  useNovaTimeWarp: '/v1/boost/time-warp'
});

function apiError(body, status) {
  const message = String(
    body?.error || body?.message || `Mining service HTTP ${status}`
  ).slice(0, 280);
  const error = new Error(message);
  error.code = `cloudflare/${String(body?.code || `http-${status}`).toLowerCase()}`;
  error.status = status;
  return error;
}

async function post(base, path, data = {}) {
  const user = await waitForFirebaseUser();
  if (!user) throw new Error('Please sign in first.');

  const token = await user.getIdToken(false);
  if (!token) throw new Error('Secure sign-in token is unavailable. Reopen NexusNova and try again.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data || {})
    });

    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok || body?.ok === false) throw apiError(body, response.status);
    return body?.data && typeof body.data === 'object' ? body.data : (body || {});
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Cloudflare mining request timed out. Please try again.');
    }
    if (error?.status) throw error;
    throw new Error('Cloudflare secure connection is unavailable. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}

export function toggleMiningCloudflare({ action = 'session-start' } = {}) {
  const normalizedAction = String(action).toLowerCase() === 'session-renew'
    ? 'restart'
    : 'start';
  return post(MINING_API_BASE, '/api/mining/session', { action: normalizedAction });
}

export function claimDailyRewardCloudflare(data = {}) {
  return post(LEGACY_REWARD_API_BASE, ACTIONS.claimDailyReward, data);
}

export function openNovaVaultCloudflare(data = {}) {
  return post(LEGACY_REWARD_API_BASE, ACTIONS.openNovaVault, data);
}

export function openNovaVaultBoostedCloudflare(data = {}) {
  return post(LEGACY_REWARD_API_BASE, ACTIONS.openNovaVaultBoosted, data);
}

export function useNovaBoostCloudflare(data = {}) {
  return post(LEGACY_REWARD_API_BASE, ACTIONS.useNovaBoost, data);
}

export function useNovaTimeWarpCloudflare(data = {}) {
  return post(LEGACY_REWARD_API_BASE, ACTIONS.useNovaTimeWarp, data);
}

export const novaMiningRewardsStore = Object.freeze({
  apiBase: MINING_API_BASE,
  toggleMining: toggleMiningCloudflare,
  claimDailyReward: claimDailyRewardCloudflare,
  openNovaVault: openNovaVaultCloudflare,
  openNovaVaultBoosted: openNovaVaultBoostedCloudflare,
  useNovaBoost: useNovaBoostCloudflare,
  useNovaTimeWarp: useNovaTimeWarpCloudflare
});
