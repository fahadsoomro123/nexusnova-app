/* NexusNova Nova Hub Ad Gate v2
   Minimal monetization wrapper around the existing Nova Hub app cards.

   It deliberately does NOT redesign Nova Hub or change feature logic.
   Protected/sensitive destinations always open immediately with no ad.
   Eligible destinations use the existing NexusNovaAds policy controller.

   Extra v2 safety:
   - Nova Drive, Nova Track and Speed Test are ad-enabled at app open.
   - Their native ad categories reuse the already-approved tools/travel allowlist.
   - The exact requested app still opens after dismissal/no-fill/failure.
   - If native never confirms that an interstitial actually started, navigation
     is released quickly instead of holding the WebView in a dead-touch state.
*/
(() => {
  'use strict';
  if (window.__nxNovaHubAdGateV2) return;
  window.__nxNovaHubAdGateV2 = true;
  window.nexusNovaHubAdGateVersion = 'nova-hub-ad-gate-v2-safe-open';

  const PLACEMENT = 'hub-app-open';
  const REQUEST_ACK_TIMEOUT_MS = 2_500;
  const DISMISS_FAILSAFE_MS = 90_000;
  const AD_FEATURE_ALIAS = Object.freeze({
    'speed-test':'tools',
    'nova-drive':'travel',
    'nova-track':'travel'
  });

  let inFlight = null;

  function targetFrom(button) {
    if (!button) return '';
    const explicit = String(button.dataset?.nxNovaHubTarget || '').trim().toLowerCase();
    if (explicit) return explicit;
    const code = String(button.getAttribute('onclick') || '');
    return code.match(/openMoreTab\(\s*['"]([^'"]+)['"]/)?.[1]?.toLowerCase() ||
      code.match(/switchTab\(\s*['"]([^'"]+)['"]/)?.[1]?.toLowerCase() || '';
  }

  function adFeatureFor(feature) {
    const name = String(feature || '').trim().toLowerCase();
    return AD_FEATURE_ALIAS[name] || name;
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

  function clearTimers(active) {
    if (!active) return;
    clearTimeout(active.ackTimer);
    clearTimeout(active.dismissTimer);
  }

  function finish(reason = 'complete') {
    const active = inFlight;
    if (!active) return;
    clearTimers(active);
    inFlight = null;
    console.info('NexusNova Hub ad gate:', reason, active.feature, active.adFeature);
    setTimeout(() => openFeature(active.feature), 0);
  }

  function markAdStarted() {
    const active = inFlight;
    if (!active || active.adStarted) return;
    active.adStarted = true;
    clearTimeout(active.ackTimer);
    active.ackTimer = null;
    active.dismissTimer = setTimeout(() => finish('dismiss-failsafe-timeout'), DISMISS_FAILSAFE_MS);
  }

  function startGate(feature) {
    if (inFlight) return false;
    const ads = window.NexusNovaAds;
    const adFeature = adFeatureFor(feature);
    if (!ads?.maybeInterstitial || !ads?.isEligibleFeature?.(adFeature)) return false;

    const result = ads.maybeInterstitial(PLACEMENT, { feature:adFeature, requestedFeature:feature });
    if (!result?.shown || !result?.pending) return false;

    inFlight = {
      feature,
      adFeature,
      requestedAt:Date.now(),
      adStarted:false,
      ackTimer:null,
      dismissTimer:null
    };
    inFlight.ackTimer = setTimeout(() => {
      if (!inFlight || inFlight.adStarted) return;
      finish('request-ack-timeout');
    }, REQUEST_ACK_TIMEOUT_MS);
    return true;
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#moreMenu .more-item');
    if (!button) return;
    const feature = targetFrom(button);
    const ads = window.NexusNovaAds;
    const adFeature = adFeatureFor(feature);

    // Never interfere with protected or unknown destinations. Nova Drive,
    // Nova Track and Speed Test map to already-approved native ad categories.
    if (!feature || !ads?.isEligibleFeature?.(adFeature)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    // A previous ad transition is already bounded. Ignore accidental double tap
    // rather than stacking multiple feature opens behind one full-screen ad.
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
    const nativeFeature = String(detail.feature || '').trim().toLowerCase();
    if (placement && placement !== PLACEMENT) return;
    if (nativeFeature && nativeFeature !== inFlight.adFeature) return;

    if (type === 'interstitial-showing' || type === 'interstitial-opened') {
      markAdStarted();
      return;
    }

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
    version:'2-safe-open',
    adFeatureFor,
    status:() => Object.freeze({
      inFlight:Boolean(inFlight),
      feature:inFlight?.feature || '',
      adFeature:inFlight?.adFeature || '',
      adStarted:Boolean(inFlight?.adStarted),
      requestedAt:inFlight?.requestedAt || 0
    })
  });
})();
