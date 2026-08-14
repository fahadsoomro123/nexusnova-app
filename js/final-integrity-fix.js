/* NexusNova development network guard.
   Mining is intentionally NOT handled here. The sole mining owner is
   rewards-security-v1.js (single-owner-v3), backed directly by Firestore
   Security Rules. This file only preserves the StackBlitz news proxy behavior
   and then loads the defensive integrity UI layer. */
(async () => {
  'use strict';

  const host = String(window.location.hostname || '').toLowerCase();
  const isDevHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.includes('--3000--') ||
    host.includes('webcontainer') ||
    host.includes('staticblitz') ||
    host.endsWith('.stackblitz.io') ||
    host.endsWith('.stackblitz.com');

  if (isDevHost && !window.__nxDevNewsProxyGuard && typeof window.fetch === 'function') {
    const nativeFetch = window.fetch.bind(window);
    window.__nxDevNewsProxyGuard = true;

    window.fetch = function(input, init) {
      const raw = typeof input === 'string' ? input : String(input?.url || '');
      let target = '';

      try {
        const parsed = new URL(raw, window.location.href);
        if (parsed.hostname === 'api.allorigins.win' && parsed.pathname.startsWith('/raw')) {
          target = parsed.searchParams.get('url') || '';
        } else if (
          parsed.hostname === 'api.gdeltproject.org' ||
          parsed.hostname === 'api.rss2json.com'
        ) {
          target = parsed.href;
        }
      } catch (_) {}

      if (target) {
        const proxyUrl = '/nx-news-proxy?url=' + encodeURIComponent(target);
        return nativeFetch(proxyUrl, { ...(init || {}), cache:'no-store' });
      }

      return nativeFetch(input, init);
    };
  }

  await import('./final-integrity-fix-core.js?v=3');
})();
