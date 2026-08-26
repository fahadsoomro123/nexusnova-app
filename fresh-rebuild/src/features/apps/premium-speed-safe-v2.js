import { premiumNovaInternetSpeedRenderers } from './premium-nova-internet-speed.js';

function isCloudflareDownload(input) {
  try {
    const raw = input instanceof Request ? input.url : String(input || '');
    const url = new URL(raw, location.href);
    return url.origin === 'https://speed.cloudflare.com' && url.pathname === '/__down';
  } catch {
    return false;
  }
}

function streamCountingResponse(response) {
  if (!(response instanceof Response) || !response.body?.getReader) return response;

  return new Proxy(response, {
    get(target, prop) {
      if (prop === 'arrayBuffer') {
        return async () => {
          const reader = target.body.getReader();
          let bytes = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bytes += Number(value?.byteLength || 0);
            }
          } finally {
            try { reader.releaseLock(); } catch {}
          }
          // The original speed engine only reads .byteLength. Returning this
          // lightweight counter avoids holding multi-megabyte parallel buffers
          // in Android WebView while preserving the requested transfer size.
          return { byteLength: bytes };
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    }
  });
}

export function renderNovaInternetSpeedSafeV2() {
  const base = premiumNovaInternetSpeedRenderers['nova-internet-speed'];
  if (typeof base !== 'function') return null;

  const originalFetch = window.fetch;
  const boundFetch = originalFetch.bind(window);
  const safeFetch = async (input, init) => {
    const response = await boundFetch(input, init);
    return isCloudflareDownload(input) ? streamCountingResponse(response) : response;
  };

  window.fetch = safeFetch;
  let root;
  try {
    root = base();
  } catch (error) {
    window.fetch = originalFetch;
    throw error;
  }

  if (!(root instanceof HTMLElement)) {
    window.fetch = originalFetch;
    return root;
  }

  const baseCleanup = root.__cleanup;
  let cleaned = false;
  root.__cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (window.fetch === safeFetch) window.fetch = originalFetch;
    baseCleanup?.();
  };
  return root;
}

export const speedSafeV2Renderers = Object.freeze({
  'nova-internet-speed': renderNovaInternetSpeedSafeV2
});
