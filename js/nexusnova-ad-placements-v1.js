/* NexusNova Ad Placements v1
   One policy-aware web controller for all Android ad placements.

   Rules:
   - Rewarded ads stay opt-in and purpose-owned by their feature.
   - Interstitials only run at natural breaks, never on protected/sensitive screens.
   - Strong session/time frequency caps prevent ad spam.
   - This file never mints NVX or changes mining value.
*/
(() => {
  'use strict';
  if (window.__nxAdPlacementsV1) return;
  window.__nxAdPlacementsV1 = true;

  const SESSION_KEY = 'nx_ad_placements_session_v1';
  const INTERSTITIAL_MIN_GAP_MS = 180_000;
  const INTERSTITIAL_SESSION_MAX = 4;
  const ELIGIBLE_BREAKS_BEFORE_FIRST = 3;

  const MONETIZABLE_FEATURES = new Set([
    'tools','finance','news','learn','travel','smart','entertainment','browser',
    'mega-tools','mega-finance','mega-calendar','mega-reminders','mega-weather',
    'mega-learning','mega-pakistan','mega-shopping','mega-marketplace','mega-orders',
    'mega-teacher','marketplace','shopping'
  ]);

  const PROTECTED_FEATURES = new Set([
    'home','wallet','profile','tasks','emergency','health','location','caller-id',
    'qibla','mega-islamic','islamic','quran','bukhari','bible','mega-security',
    'mega-file-vault','security','file-vault','contacts','mega-contacts','about'
  ]);

  let nativeTestMode = true;
  let interstitialReady = false;
  let lastInterstitialAt = 0;
  let eligibleBreakCount = 0;
  let sessionInterstitialCount = 0;
  let sessionId = '';

  function readSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      sessionId = String(raw.sessionId || '') || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      lastInterstitialAt = Number(raw.lastInterstitialAt || 0) || 0;
      eligibleBreakCount = Number(raw.eligibleBreakCount || 0) || 0;
      sessionInterstitialCount = Number(raw.sessionInterstitialCount || 0) || 0;
      persist();
    } catch (_) {
      sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    }
  }

  function persist() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId,lastInterstitialAt,eligibleBreakCount,sessionInterstitialCount
      }));
    } catch (_) {}
  }

  function postNative(action, payload = {}) {
    try {
      if (typeof window.nexusPostNativeAction === 'function') {
        return window.nexusPostNativeAction(action, payload) !== false;
      }
      if (typeof window.NexusAndroid?.postMessage !== 'function') return false;
      window.NexusAndroid.postMessage(JSON.stringify({ action, ...payload }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function normalizeFeature(value) {
    return String(value || '').trim().toLowerCase().replace(/^tab-/,'');
  }

  function isProtected(feature) {
    const name = normalizeFeature(feature);
    if (!name) return true;
    if (PROTECTED_FEATURES.has(name)) return true;
    return /(?:wallet|payment|checkout|security|password|emergency|health|quran|bukhari|bible|islamic|caller|profile|login|auth|file-vault)/i.test(name);
  }

  function isEligibleFeature(feature) {
    const name = normalizeFeature(feature);
    return !isProtected(name) && MONETIZABLE_FEATURES.has(name);
  }

  function canShowInterstitial(feature) {
    if (!isEligibleFeature(feature)) return false;
    if (sessionInterstitialCount >= INTERSTITIAL_SESSION_MAX) return false;
    if (Date.now() - lastInterstitialAt < INTERSTITIAL_MIN_GAP_MS) return false;
    if (!interstitialReady) return false;
    return true;
  }

  function maybeInterstitial(placement, context = {}) {
    const feature = normalizeFeature(context.feature || context.from || '');
    if (!isEligibleFeature(feature)) {
      return { shown:false, reason:'protected-or-ineligible', placement, feature };
    }

    eligibleBreakCount += 1;
    persist();

    if (eligibleBreakCount < ELIGIBLE_BREAKS_BEFORE_FIRST) {
      return { shown:false, reason:'warmup', placement, feature, eligibleBreakCount };
    }
    if (!canShowInterstitial(feature)) {
      return { shown:false, reason:'frequency-or-not-ready', placement, feature };
    }

    const posted = postNative('showInterstitialAd', {
      placement:String(placement || 'natural-break').slice(0,80),
      feature,
      testOnly:nativeTestMode
    });
    if (!posted) return { shown:false, reason:'native-unavailable', placement, feature };

    lastInterstitialAt = Date.now();
    sessionInterstitialCount += 1;
    eligibleBreakCount = 0;
    interstitialReady = false;
    persist();
    return { shown:true, placement, feature, testOnly:nativeTestMode };
  }

  function requestRewarded(rewardPurpose, extra = {}) {
    const purpose = String(rewardPurpose || '').trim().slice(0,80);
    if (!purpose) return { shown:false, reason:'missing-purpose' };
    const posted = postNative('showRewardedAd', {
      rewardPurpose:purpose,
      testOnly:nativeTestMode,
      ...extra
    });
    return { shown:Boolean(posted), rewardPurpose:purpose, testOnly:nativeTestMode };
  }

  function status() {
    return Object.freeze({
      nativeTestMode,interstitialReady,lastInterstitialAt,eligibleBreakCount,
      sessionInterstitialCount,sessionMax:INTERSTITIAL_SESSION_MAX,
      minGapMs:INTERSTITIAL_MIN_GAP_MS
    });
  }

  window.addEventListener('nexusnova:native-ad-event', event => {
    const detail = event?.detail || {};
    if (String(detail.provider || '') !== 'admob') return;
    if (typeof detail.testMode === 'boolean') nativeTestMode = detail.testMode;
    const type = String(detail.event || '');
    if (type === 'status') interstitialReady = Boolean(detail.interstitialReady);
    if (type === 'interstitial-ready') interstitialReady = true;
    if (type === 'interstitial-showing' || type === 'interstitial-unavailable' || type === 'interstitial-failed') interstitialReady = false;
  });

  // All Apps back/return is a natural break. Capture the feature on pointer-up
  // before legacy click handlers hide it, then let the normal navigation finish.
  // Only the safe allow-list above can ever trigger an interstitial.
  document.addEventListener('pointerup', event => {
    const back = event.target?.closest?.('.nx-allapps-back button,.tools-main-back');
    if (!back) return;
    const feature = normalizeFeature(document.querySelector('.tab.active')?.id || '');
    if (!isEligibleFeature(feature)) return;
    setTimeout(() => maybeInterstitial('allapps-return', { feature }), 450);
  }, true);

  readSession();
  window.NexusNovaAds = Object.freeze({
    maybeInterstitial,
    requestRewarded,
    isProtected,
    isEligibleFeature,
    status
  });

  // Ask native owner for its current preload/readiness state once the bridge exists.
  [700,1800,3500].forEach(ms => setTimeout(() => postNative('adStatus'), ms));
})();
