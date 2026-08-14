/* NexusNova Scripture Source Guard v2
   Adds cache fallback for Quran data and CDN->raw fallback for Bukhari data. */
(() => {
  'use strict';
  if (window.__nxScriptureSourceGuard) return;
  window.__nxScriptureSourceGuard = true;

  const nativeFetch = window.fetch.bind(window);
  const CACHE_NAME = 'nexusnova-scripture-data-v2';

  const isQuran = url => /^https:\/\/api\.alquran\.cloud\/v1\/surah\//i.test(url);
  const isHadith = url => /^https:\/\/cdn\.jsdelivr\.net\/gh\/fawazahmed0\/hadith-api@1\/editions\//i.test(url);

  function hadithRawUrl(url) {
    const prefix = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/';
    if (!url.startsWith(prefix)) return '';
    return 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/' + url.slice(prefix.length);
  }

  async function cachePut(url, response) {
    if (!('caches' in window) || !response?.ok) return;
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(url, response.clone());
    } catch (_) {}
  }

  async function cacheMatch(url) {
    if (!('caches' in window)) return null;
    try {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(url);
    } catch (_) {
      return null;
    }
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : String(input?.url || '');
    if (!isQuran(url) && !isHadith(url)) return nativeFetch(input, init);

    try {
      const response = await nativeFetch(input, init);
      if (response.ok) {
        cachePut(url, response);
        return response;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch (primaryError) {
      if (isHadith(url)) {
        const fallbackUrl = hadithRawUrl(url);
        if (fallbackUrl) {
          try {
            const response = await nativeFetch(fallbackUrl, { ...(init || {}), cache:'no-store' });
            if (response.ok) {
              cachePut(url, response);
              return response;
            }
          } catch (_) {}
        }
      }

      const cached = await cacheMatch(url);
      if (cached) return cached;
      throw primaryError;
    }
  };
})();