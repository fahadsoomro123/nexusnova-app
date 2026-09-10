// NOVA 5.7 Sol — Puter.js keyless AI provider adapter.
// No developer API keys are embedded or requested. Puter.js uses browser-side
// user authentication / user-pays accounting. Only currently verified/free
// chat routes are exposed to the keyless router.

const PUTER_SDK_URL = 'https://js.puter.com/v2/';
const SDK_TIMEOUT_MS = 5_000;
const MAX_PUTER_FREE_ROUTES = 48;

// Explicitly verified zero-cost seed routes (Aug 2026). Runtime catalog
// discovery can add more current $0/$0 models without an app update.
const VERIFIED_FREE_SEEDS = [
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'dots-studio/dots-3-note-preview:free',
  'inclusionai/ling-3.0-tiny:free',
  'liquid/lfm-2.5-2.6b:free',
  'z-ai/autoglm-phone-multilingual',
  'thedrummer/anubis-70b-v1.1',
  'sao10k/72b-qwen2.5-kunou-v1',
  'ds-archive/doctor-shotgun-3.3-70b-magnum-v4-se'
];

let sdkPromise = null;
let cachedRoutes = [];
let cachedAt = 0;
const CATALOG_TTL_MS = 5 * 60_000;

function loadScript() {
  if (globalThis.puter?.ai?.chat) return Promise.resolve(globalThis.puter);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-nova-puter-sdk]');
    if (existing) {
      const started = Date.now();
      const poll = setInterval(() => {
        if (globalThis.puter?.ai?.chat) {
          clearInterval(poll);
          resolve(globalThis.puter);
        } else if (Date.now() - started > SDK_TIMEOUT_MS) {
          clearInterval(poll);
          reject(new Error('Puter.js SDK did not become ready.'));
        }
      }, 80);
      return;
    }

    const script = document.createElement('script');
    script.src = PUTER_SDK_URL;
    script.async = true;
    script.dataset.novaPuterSdk = '1';
    const timer = setTimeout(() => reject(new Error('Puter.js SDK load timed out.')), SDK_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timer);
      if (globalThis.puter?.ai?.chat) resolve(globalThis.puter);
      else reject(new Error('Puter.js SDK loaded without AI API.'));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Puter.js SDK could not be loaded.'));
    };
    document.head.appendChild(script);
  }).catch(error => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

function zero(value) {
  const n = Number(value);
  return Number.isFinite(n) && n === 0;
}

function usableChatModel(row) {
  const id = String(row?.id || '').trim();
  if (!id) return false;
  if (/safety|guard|moderation|embed|rerank|ocr|image|video|speech|tts/i.test(id)) return false;
  const cost = row?.cost;
  if (!cost || !zero(cost.input) || !zero(cost.output)) return false;
  return true;
}

function dedupe(ids) {
  const seen = new Set();
  return ids.filter(id => {
    const key = String(id || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getPuterVerifiedSeedRoutes() {
  return VERIFIED_FREE_SEEDS.map((model, index) => ({
    provider: 'Puter',
    model,
    kind: 'puter',
    priority: 86 - Math.min(index, 20) * 0.15,
    timeoutMs: 5_500,
    seed: true
  }));
}

export async function discoverPuterFreeRoutes(force = false) {
  if (!force && cachedRoutes.length && Date.now() - cachedAt < CATALOG_TTL_MS) return cachedRoutes;

  const ids = [...VERIFIED_FREE_SEEDS];
  let signedIn = false;
  let catalogChecked = false;
  try {
    const puter = await loadScript();
    signedIn = Boolean(puter?.auth?.isSignedIn?.());
    // Avoid forcing an auth popup merely to discover routes. Once the user has
    // a Puter session, dynamically include every currently advertised $0/$0
    // general chat model.
    if (signedIn && typeof puter?.ai?.listModels === 'function') {
      const models = await puter.ai.listModels();
      catalogChecked = true;
      for (const row of Array.isArray(models) ? models : []) {
        if (usableChatModel(row)) ids.push(String(row.id).trim());
      }
    }
  } catch (error) {
    console.warn('[NOVA Puter] discovery unavailable:', error);
  }

  cachedRoutes = dedupe(ids).slice(0, MAX_PUTER_FREE_ROUTES).map((model, index) => ({
    provider: 'Puter',
    model,
    kind: 'puter',
    // Puter stays below already-proven anonymous fast routes until it succeeds;
    // the main router's adaptive last-good logic can then promote it.
    priority: 86 - Math.min(index, 20) * 0.15,
    timeoutMs: 5_500,
    seed: VERIFIED_FREE_SEEDS.includes(model)
  }));
  cachedAt = Date.now();
  globalThis.__NOVA_PUTER_FREE_ROUTE_COUNT__ = cachedRoutes.length;
  globalThis.__NOVA_PUTER_SIGNED_IN__ = signedIn;
  globalThis.__NOVA_PUTER_CATALOG_CHECKED__ = catalogChecked;
  return cachedRoutes;
}

function systemText(options = {}) {
  const parts = options?.systemInstruction?.parts;
  return Array.isArray(parts)
    ? parts.map(part => String(part?.text || '')).filter(Boolean).join('\n')
    : '';
}

function cfg(options = {}) {
  const source = options?.generationConfig || {};
  return {
    temperature: Math.min(1.2, Math.max(0.1, Number(source.temperature ?? 0.5))),
    maxTokens: Math.min(1200, Math.max(96, Number(source.maxOutputTokens ?? 800)))
  };
}

function extractText(result) {
  const content = result?.message?.content ?? result?.text ?? '';
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      return String(part?.text ?? part?.content ?? '');
    }).join('').trim();
  }
  return '';
}

export async function runPuterRoute(route, prompt, options = {}) {
  const puter = await loadScript();
  if (!puter?.ai?.chat) throw new Error('Puter AI is unavailable.');

  const settings = cfg(options);
  const system = systemText(options);
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: String(prompt || '') });

  // Puter automatically handles browser auth. First use may ask the user to
  // sign in / approve Puter; no API key is stored in NexusNova.
  const result = await puter.ai.chat(messages, {
    model: route.model,
    stream: false,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens
  });
  const text = extractText(result);
  if (!text) throw new Error(`Puter/${route.model} returned no usable text.`);
  return text;
}

export const PUTER_VERIFIED_FREE_SEED_COUNT = VERIFIED_FREE_SEEDS.length;
