import { waitForFirebaseUser } from './firebase-backend.js';

const API_BASE = 'https://nova-mining-rewards.fahadsoomro123.workers.dev';

// Cloudflare v2 is the active mutation backend while Firebase Functions are
// unavailable. Firebase Auth supplies the existing ID token and Firestore stays
// the account store, but reward/mining writes are owned by Cloudflare.
const ACTIONS = Object.freeze({
  claimDailyReward: '/v1/tasks/daily/claim',
  toggleMining: '/v1/mining/toggle',
  openNovaVault: '/v1/vault/open',
  openNovaVaultBoosted: '/v1/vault/boosted/open',
  useNovaBoost: '/v1/boost/use',
  useNovaTimeWarp: '/v1/boost/time-warp'
});

function apiError(body, status) {
  const message = String(body?.message || body?.error || `Mining rewards HTTP ${status}`).slice(0, 280);
  const error = new Error(message);
  error.code = `cloudflare/${String(body?.code || `http-${status}`).toLowerCase()}`;
  error.status = status;
  return error;
}

async function post(path, data = {}) {
  // Do not call user.reload(), App Check, or Firebase Functions here. The user is
  // already signed in and Cloudflare independently validates the ID token with
  // Firebase Auth before touching Firestore. This keeps Vault/boost actions
  // usable while Firebase callable/App-Check infrastructure is having issues.
  const user = await waitForFirebaseUser(6_000);
  if (!user) throw new Error('Please sign in first.');

  const token = await user.getIdToken(false);
  if (!token) throw new Error('Secure sign-in token is unavailable. Reopen NexusNova and try again.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method:'POST',
      cache:'no-store',
      signal:controller.signal,
      headers:{
        Authorization:`Bearer ${token}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(data || {})
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Cloudflare request timed out. Please try again.');
    throw new Error('Cloudflare secure connection is unavailable. Please try again.');
  } finally {
    clearTimeout(timer);
  }

  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok || body?.ok === false) throw apiError(body, response.status);
  return body?.data && typeof body.data === 'object' ? body.data : (body || {});
}

export async function callNovaMiningRewards(name, data = {}) {
  const path = ACTIONS[String(name || '')];
  if (!path) throw new Error('Unknown Cloudflare mining reward action.');
  return post(path, data);
}

export function claimDailyRewardCloudflare(data = {}) {
  return callNovaMiningRewards('claimDailyReward', data);
}

export function toggleMiningCloudflare(data = {}) {
  return callNovaMiningRewards('toggleMining', data);
}

export function openNovaVaultCloudflare(data = {}) {
  return callNovaMiningRewards('openNovaVault', data);
}

export function openNovaVaultBoostedCloudflare(data = {}) {
  return callNovaMiningRewards('openNovaVaultBoosted', data);
}

export function useNovaBoostCloudflare(data = {}) {
  return callNovaMiningRewards('useNovaBoost', data);
}

export function useNovaTimeWarpCloudflare(data = {}) {
  return callNovaMiningRewards('useNovaTimeWarp', data);
}

export const novaMiningRewardsStore = Object.freeze({
  apiBase:API_BASE,
  call:callNovaMiningRewards,
  claimDailyReward:claimDailyRewardCloudflare,
  toggleMining:toggleMiningCloudflare,
  openNovaVault:openNovaVaultCloudflare,
  openNovaVaultBoosted:openNovaVaultBoostedCloudflare,
  useNovaBoost:useNovaBoostCloudflare,
  useNovaTimeWarp:useNovaTimeWarpCloudflare
});
