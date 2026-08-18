/* NexusNova Nova Hub Ad Gate v1
   Minimal monetization wrapper around the existing Nova Hub app cards.

   It deliberately does NOT redesign Nova Hub or change feature logic.
   Protected/sensitive destinations always open immediately with no ad.
   Eligible destinations use the existing NexusNovaAds policy controller:
   - two+ eligible app actions are allowed before the first interstitial,
   - 3 minute minimum gap,
   - max 4 interstitials per session,
   - no-fill/unavailable never blocks the requested app,
   - once an ad is actually shown, the app opens immediately after dismissal.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubAdGateV1) return;
  window.__nxNovaHubAdGateV1 = true;
  window.nexusNovaHubAdGateVersion = 'nova-hub-ad-gate-v1';

  const PLACEMENT = 'hub-app-open';
  const OPEN_FAILSAFE_MS = 14_000;
  let inFlight = null;

  function targetFrom(button) {
    if (!button) return '';
    const explicit = String(button.dataset?.nxNovaHubTarget || '').trim().toLowerCase();
    if (explicit) return explicit;
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/openMoreTab\(\s*['"]([^'"]+)['"]/)?.[1]?.toLowerCase() ||
      code.match(/switchTab\(\s*['"]([^'"]+)['"]/)?.[1]?.toLowerCase() || '';
  }

  function openFeature(feature) {
    const name = String(feature || '').trim().toLowerCase();
    if (!name) return;
    try {
      document.body.classList.remove('nx-allapps-open');
      const menu = document.getElementById('moreMenu');
      if (menu) {
        menu.classList.remove('show');
        menu.style.display = 'none';
      }
      if (typeof window.openMoreTab === 'function') {
        window.openMoreTab(name);
        return;
      }
      window.switchTab?.(name, null);
    } catch (error) {
      console.warn('NexusNova Hub ad gate navigation:', error);
      try { window.switchTab?.(name, null); } catch (_) {}
    }
  }

  function finish(reason = 'complete') {
    const active = inFlight;
    if (!active) return;
    clearTimeout(active.timer);
    inFlight = null;
    console.info('NexusNova Hub ad gate:', reason, active.feature);
    setTimeout(() => openFeature(active.feature), 0);
  }

  function startGate(feature) {
    if (inFlight) return false;
    const ads = window.NexusNovaAds;
    if (!ads?.maybeInterstitial || !ads?.isEligibleFeature?.(feature)) return false;

    const result = ads.maybeInterstitial(PLACEMENT, { feature });
    if (!result?.shown || !result?.pending) return false;

    inFlight = {
      feature,
      requestedAt:Date.now(),
      timer:setTimeout(() => finish('failsafe-timeout'), OPEN_FAILSAFE_MS)
    };
    return true;
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#moreMenu .more-item');
    if (!button) return;
    const feature = targetFrom(button);
    const ads = window.NexusNovaAds;

    // Never interfere with protected or unknown destinations.
    if (!feature || !ads?.isEligibleFeature?.(feature)) return;

    // Own this eligible click so there can never be a double open. If the ad
    // policy says "not now", navigation is resumed immediately below.
    event.preventDefault();
    event.stopImmediatePropagation();

    if (inFlight) return;
    if (!startGate(feature)) openFeature(feature);
  }, true);

  window.addEventListener('nexusnova:native-ad-event', event => {
    if (!inFlight) return;
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    const type = String(detail.event || '');
    if (!type.startsWith('interstitial-')) return;

    const placement = String(detail.placement || '');
    const feature = String(detail.feature || '');
    if (placement && placement !== PLACEMENT) return;
    if (feature && feature !== inFlight.feature) return;

    if (type === 'interstitial-dismissed') {
      finish('dismissed');
      return;
    }
    if (
      type === 'interstitial-unavailable' ||
      type === 'interstitial-failed' ||
      type === 'interstitial-load-failed' ||
      type === 'interstitial-skipped'
    ) {
      finish(type);
    }
  });

  window.NexusNovaHubAdGate = Object.freeze({
    placement:PLACEMENT,
    status:() => Object.freeze({
      inFlight:Boolean(inFlight),
      feature:inFlight?.feature || '',
      requestedAt:inFlight?.requestedAt || 0
    })
  });
})();
