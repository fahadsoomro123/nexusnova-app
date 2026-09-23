import { waitForFirebaseUser } from './firebase-backend.js';

const API_BASE = 'https://nexusnova-telegram-bot.fahadsoomro123.workers.dev';
const MINING_ENDPOINT = '/api/mining/session';

function apiError(body, status) {
  const message = String(
    body?.error || body?.message || `Mining service HTTP ${status}`
  ).slice(0, 280);
  const error = new Error(message);
  error.code = `cloudflare/${String(body?.code || `http-${status}`).toLowerCase()}`;
  error.status = status;
  return error;
}

export async function toggleMiningCloudflare({ action = 'session-start' } = {}) {
  const user = await waitForFirebaseUser();
  if (!user) throw new Error('Please sign in first.');

  const token = await user.getIdToken(false);
  if (!token) throw new Error('Secure sign-in token is unavailable. Reopen NexusNova and try again.');

  const normalizedAction = String(action).toLowerCase() === 'session-renew'
    ? 'restart'
    : 'start';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${API_BASE}${MINING_ENDPOINT}`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action: normalizedAction })
    });

    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok || body?.ok === false) throw apiError(body, response.status);
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Cloudflare mining request timed out. Please try again.');
    }
    if (error?.status) throw error;
    throw new Error('Cloudflare mining connection failed. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}
