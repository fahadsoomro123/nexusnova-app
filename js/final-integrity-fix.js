/* NexusNova development network guard + critical live-module bootstrap.
   Mining is intentionally NOT handled here. The sole mining owner is
   rewards-security-v1.js (single-owner-v3), backed directly by Firestore
   Security Rules. This file preserves the StackBlitz news proxy behavior,
   boots critical non-mining modules, then loads the defensive integrity UI. */
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

  // These are core user-facing utilities, not mining owners. Dynamic scripts
  // are forced into insertion order so the secure rewarded-ad guard registers
  // before the legacy Spark reward handler can capture the Watch Ad button.
  function loadCritical({flag, marker, src, error}) {
    if (window[flag] || document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    script.onerror = () => console.warn(error);
    document.body.appendChild(script);
  }

  loadCritical({
    flag:'__nxRewardedAdsConfigV1',
    marker:'data-nx-rewarded-config',
    src:'./js/nexusnova-rewarded-ads-config-v1.js?v=1',
    error:'NexusNova rewarded ads public config failed to load.'
  });
  loadCritical({
    flag:'__nxRewardedAdsV1',
    marker:'data-nx-rewarded-ads',
    src:'./js/nexusnova-rewarded-ads-v1.js?v=1',
    error:'NexusNova rewarded ads bridge failed to load.'
  });
  loadCritical({
    flag:'__nxRewardedAdsButtonGuardV1',
    marker:'data-nx-rewarded-guard',
    src:'./js/nexusnova-rewarded-ads-button-guard-v1.js?v=1',
    error:'NexusNova rewarded ads button guard failed to load.'
  });
  loadCritical({
    flag:'__nxRewardsSparkV1',
    marker:'data-nx-rewards-spark',
    src:'./js/nexusnova-rewards-spark-v1.js?v=2',
    error:'NexusNova Spark rewards module failed to load.'
  });
  loadCritical({
    flag:'__nxAllAppsSmartSearchV2',
    marker:'data-nx-allapps-smart-search',
    src:'./js/nexusnova-allapps-smart-search-v1.js?v=4',
    error:'NexusNova ALL APPS smart search failed to load.'
  });
  loadCritical({
    flag:'__nxCommunityProgressV1',
    marker:'data-nx-community-progress',
    src:'./js/nexusnova-community-progress-v1.js?v=1',
    error:'NexusNova Community League failed to load.'
  });
  loadCritical({
    flag:'__nxCompleteProfileV1',
    marker:'data-nx-complete-profile',
    src:'./js/nexusnova-complete-profile-v1.js?v=1',
    error:'NexusNova Complete Profile failed to load.'
  });

  await import('./final-integrity-fix-core.js?v=3');
})();