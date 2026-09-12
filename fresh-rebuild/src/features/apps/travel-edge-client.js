import { TRAVEL_EDGE_URL } from './travel-edge-config.js';

const REQUEST_TIMEOUT_MS = 32000;
const RETRYABLE = new Set([429, 500, 502, 503]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  if (!base) throw new Error('NexusNova Travel Cloudflare endpoint is not configured.');

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${base}/rpc/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-NexusNova-Client': 'fresh-rebuild'
        },
        body: JSON.stringify(payload || {})
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!response.ok) {
        const message = data?.message || data?.error || `Travel edge API HTTP ${response.status}`;
        const error = new Error(String(message).slice(0, 240));
        error.code = `edge-${response.status}`;
        error.status = response.status;
        if (attempt === 0 && RETRYABLE.has(response.status)) {
          lastError = error;
          await sleep(700);
          continue;
        }
        throw error;
      }
      return data || {};
    } catch (error) {
      if (attempt === 0 && (error?.name === 'AbortError' || RETRYABLE.has(Number(error?.status)))) {
        lastError = error;
        await sleep(700);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('Travel Cloudflare request failed.');
}

export async function travelCall(name, payload = {}) {
  const data = await callEdge(name, payload);
  try {
    document.dispatchEvent(new CustomEvent('nexusnova:travel-rpc', {
      detail: { name, data }
    }));
  } catch {}
  return data;
}

export async function travelHealth() {
  const base = travelEdgeBase();
  if (!base) return { ok: false, backend: 'cloudflare-only', architecture: 'cloudflare-only', providers: {} };
  try {
    const response = await fetchWithTimeout(`${base}/health`, {
      headers: { Accept: 'application/json', 'X-NexusNova-Client': 'fresh-rebuild' }
    }, 9000);
    if (response.ok) return await response.json();
  } catch {}
  return { ok: false, backend: 'cloudflare-only', architecture: 'cloudflare-only', providers: {} };
}
