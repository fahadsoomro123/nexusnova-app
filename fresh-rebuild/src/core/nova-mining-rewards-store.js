import { requireFirebaseUser } from './firebase-backend.js';

const API_BASE = 'https://nova-mining-rewards.fahadsoomro123.workers.dev';

// Release/test safety: active Nova Vault, Booster, Rain and Time Warp flows use
// App-Check-protected Firebase callables. Keep this Cloudflare client scoped to
// the Daily Reward only so stale duplicate reward routes cannot be invoked by
// current web code.
const ACTIONS = Object.freeze({
  claimDailyReward: '/v1/tasks/daily/claim'
});

function apiError(body, status) {
  const message = String(body?.message || body?.error || `Mining rewards HTTP ${status}`).slice(0, 280);
  const error = new Error(message);
  error.code = `cloudflare/${String(body?.code || `http-${status}`).toLowerCase()}`;
  error.status = status;
  return error;
}

async function post(path, data = {}) {
  const user = await requireFirebaseUser({ write:true });
  if (user.emailVerified !== true) {
    try { await user.reload(); } catch {}
  }
  if (user.emailVerified !== true) throw new Error('Verify your email first.');
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    cache: 'no-store',
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
}

export async function callNovaMiningRewards(name, data = {}) {
  const path = ACTIONS[String(name || '')];
  if (!path) throw new Error('This mining reward action is handled by the Firebase secure backend.');
  return post(path, data);
}

export function claimDailyRewardCloudflare(data = {}) {
  return callNovaMiningRewards('claimDailyReward', data);
}

export const novaMiningRewardsStore = Object.freeze({
  apiBase: API_BASE,
  call: callNovaMiningRewards,
  claimDailyReward: claimDailyRewardCloudflare
});
