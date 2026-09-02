import { requireFirebaseUser } from './firebase-backend.js';

const API_BASE = 'https://nova-mining-rewards.fahadsoomro123.workers.dev';

// Cloudflare v2 is the active mutation backend while Firebase Functions are
// temporarily unavailable. Firebase Auth remains the user identity source and
// Firestore remains the account store, but reward/mining writes go through the
// Cloudflare Worker rather than callable Functions/App Check.
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
  // Cloudflare verifies the refreshed Firebase ID token itself. Do not require
  // Firebase App Check here; that would recreate the Functions dependency this
  // bridge is meant to avoid during the temporary Firebase issue.
  const user = await requireFirebaseUser({ verified:true });
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method:'POST',
    cache:'no-store',
    headers:{
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify(data || {})
  });
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
