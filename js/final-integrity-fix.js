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

  function loadCritical({flag, marker, src, error}) {
    if (window[flag] || document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.setAttribute(marker, '1');
    script.onerror = () => console.warn(error);
    document.body.appendChild(script);
  }

  loadCritical({flag:'__nxRewardedAdsConfigV1',marker:'data-nx-rewarded-config',src:'./js/nexusnova-rewarded-ads-config-v1.js?v=1',error:'NexusNova rewarded ads public config failed to load.'});
  loadCritical({flag:'__nxRewardedAdsV1',marker:'data-nx-rewarded-ads',src:'./js/nexusnova-rewarded-ads-v1.js?v=1',error:'NexusNova rewarded ads bridge failed to load.'});
  loadCritical({flag:'__nxRewardedAdsButtonGuardV1',marker:'data-nx-rewarded-guard',src:'./js/nexusnova-rewarded-ads-button-guard-v1.js?v=1',error:'NexusNova rewarded ads button guard failed to load.'});
  loadCritical({flag:'__nxAdSettingsV2',marker:'data-nx-ad-settings-v2',src:'./js/nexusnova-ad-settings-v2.js?v=20260817-test',error:'NexusNova TEST ad settings failed to load.'});
  loadCritical({flag:'__nxNetworkGuardianV1',marker:'data-nx-network-guardian-v1-script',src:'./js/nexusnova-network-guardian-v1.js?v=20260817-final-audit',error:'NexusNova live network status guardian failed to load.'});
  loadCritical({flag:'__nxUxSimplifyV1',marker:'data-nx-ux-simplify-v1',src:'./js/nexusnova-ux-simplify-v1.js?v=20260817-compact2',error:'NexusNova contextual navigation failed to load.'});
  loadCritical({flag:'__nxSpeedTestAppV4',marker:'data-nx-speedtest-app-v4',src:'./js/nexusnova-speedtest-app-v4.js?v=20260817-ux-only',error:'NexusNova standalone Speed Test failed to load.'});
  loadCritical({flag:'__nxBrandingV1',marker:'data-nx-branding-v1-script',src:'./js/nexusnova-branding-v1.js?v=20260817-branding-v1',error:'NexusNova app-wide branding layer failed to load.'});
  loadCritical({flag:'__nxProductivityDeskV1',marker:'data-nx-productivity-desk-v1',src:'./js/nexusnova-productivity-desk-v1.js?v=20260817-stable',error:'NexusNova offline Nova Desk failed to load.'});
  loadCritical({flag:'__nxRewardsSparkV1',marker:'data-nx-rewards-spark',src:'./js/nexusnova-rewards-spark-v1.js?v=2',error:'NexusNova Spark rewards module failed to load.'});
  loadCritical({flag:'__nxAllAppsSmartSearchV2',marker:'data-nx-allapps-smart-search',src:'./js/nexusnova-allapps-smart-search-v1.js?v=4',error:'NexusNova Nova Hub smart search failed to load.'});
  loadCritical({flag:'__nxCommunityProgressV1',marker:'data-nx-community-progress',src:'./js/nexusnova-community-progress-v1.js?v=1',error:'NexusNova Community League failed to load.'});
  loadCritical({flag:'__nxCompleteProfileV1',marker:'data-nx-complete-profile',src:'./js/nexusnova-complete-profile-v1.js?v=1',error:'NexusNova Complete Profile failed to load.'});
  loadCritical({flag:'__nxGrowthCenterV1',marker:'data-nx-growth-center',src:'./js/nexusnova-growth-center-v1.js?v=1',error:'NexusNova Growth Center failed to load.'});
  loadCritical({flag:'__nxNovaVaultV1',marker:'data-nx-nova-vault',src:'./js/nexusnova-nova-vault-v1.js?v=1',error:'NexusNova Nova Vault failed to load.'});
  loadCritical({flag:'__nxGrowthReferralLinkV1',marker:'data-nx-growth-referral-link',src:'./js/nexusnova-growth-referral-link-v1.js?v=2',error:'NexusNova referral invite link guard failed to load.'});
  loadCritical({flag:'__nxReferralCaptureV1',marker:'data-nx-referral-capture',src:'./js/nexusnova-referral-capture-v1.js?v=1',error:'NexusNova referral capture failed to load.'});
  loadCritical({flag:'__nxOnboardingInsightsV1',marker:'data-nx-onboarding-insights',src:'./js/nexusnova-onboarding-insights-v1.js?v=1',error:'NexusNova guided onboarding failed to load.'});
  loadCritical({flag:'__nxAnalyticsV1',marker:'data-nx-analytics',src:'./js/nexusnova-analytics-v1.js?v=2',error:'NexusNova anonymous analytics failed to load.'});
  loadCritical({flag:'__nxBugReportV1',marker:'data-nx-bug-report',src:'./js/nexusnova-bug-report-v1.js?v=1',error:'NexusNova bug reporting failed to load.'});
  loadCritical({flag:'__nxHealthMonitorV1',marker:'data-nx-health-monitor',src:'./js/nexusnova-health-monitor-v1.js?v=1',error:'NexusNova automatic local health monitor failed to load.'});
  loadCritical({flag:'__nxNexusBrowserV1',marker:'data-nx-browser',src:'./js/nexusnova-browser-v1.js?v=1',error:'NexusNova Browser failed to load.'});
  loadCritical({flag:'__nxNexusBrowserGuardV1',marker:'data-nx-browser-guard',src:'./js/nexusnova-browser-guard-v1.js?v=1',error:'NexusNova Browser guard failed to load.'});
  loadCritical({flag:'__nxModernUiV1',marker:'data-nx-modern-ui-v1-script',src:'./js/nexusnova-modern-ui-v1.js?v=20260817-modern2',error:'NexusNova modern Nova Hub UI failed to load.'});

  await import('./final-integrity-fix-core.js?v=3');

  [250, 750, 1500, 3000, 6000].forEach(ms => setTimeout(() => {
    if (typeof window.nexusOpenCompleteProfile === 'function') {
      window.editSettingsProfile = window.nexusOpenCompleteProfile;
    }
  }, ms));
})();
