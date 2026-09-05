import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-functions.js';
import { firebaseApp, requireFirebaseUser } from '../../core/firebase-backend.js';
import { TRAVEL_EDGE_URL } from './travel-edge-config.js';

const functions = getFunctions(firebaseApp, 'us-central1');
const REQUEST_TIMEOUT_MS = 26000;

function cleanBase(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function travelEdgeBase() {
  const meta = document.querySelector('meta[name="nexusnova-travel-edge-url"]')?.content;
  return cleanBase(globalThis.NEXUSNOVA_TRAVEL_EDGE_URL || meta || TRAVEL_EDGE_URL);
}

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callEdge(name, payload) {
  const base = travelEdgeBase();
  if (!base) return null;
  const user = await requireFirebaseUser();
  const idToken = await user.getIdToken(false);
  const response = await fetchWithTimeout(`${base}/rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify(payload || {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const message = data?.message || data?.error || `Travel edge API HTTP ${response.status}`;
    const error = new Error(String(message).slice(0, 240));
    error.code = `edge-${response.status}`;
    throw error;
  }
  return data || {};
}

export async function travelCall(name, payload = {}) {
  const edge = await callEdge(name, payload);
  if (edge !== null) return edge;

  // Safe fallback while Cloudflare is not configured or after Google billing is restored.
  const user = await requireFirebaseUser();
  if (!user) throw new Error('Please sign in first.');
  const response = await httpsCallable(functions, name)(payload);
  return response?.data || {};
}

export async function travelHealth() {
  const base = travelEdgeBase();
  if (base) {
    try {
      const response = await fetchWithTimeout(`${base}/health`, { headers: { Accept: 'application/json' } }, 8000);
      if (response.ok) return await response.json();
    } catch {}
  }
  try {
    return await travelCall('getProviderHealth', {});
  } catch {
    return { ok: false, backend: base ? 'cloudflare-edge' : 'firebase', providers: {} };
  }
}
