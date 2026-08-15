/* NexusNova Ad Placements v1
   One policy-aware web controller for all Android ad placements.

   Rules:
   - Rewarded ads stay opt-in and purpose-owned by their feature.
   - Interstitials only run at natural breaks, never on protected/sensitive screens.
   - Strong session/time frequency caps prevent ad spam.
   - Content opens can warm eligibility but NEVER show an ad immediately.
   - Returning from outbound News/Entertainment/Browser content is a natural break.
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
  const ENGAGEMENT_MIN_GAP_MS = 12_000;
  const CONTENT_RETURN_MAX_MS = 10 * 60_000;

  const MONETIZABLE_FEATURES = new Set([
    'tools','finance','money','news','learn','travel','smart','ai','entertainment','browser',
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
  let lastEngagementAt = 0;
  let lastEngagementKey = '';
  let pendingReturnFeature = '';
  let pendingReturnAt = 0;
  let pendingReturnSawHidden = false;
  let sessionId = '';

  function readSession() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      sessionId = String(raw.sessionId || '') || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      lastInterstitialAt = Number(raw.lastInterstitialAt || 0) || 0;
      eligibleBreakCount = Number(raw.eligibleBreakCount || 0) || 0;
      sessionInterstitialCount = Number(raw.sessionInterstitialCount || 0) || 0;
      lastEngagementAt = Number(raw.lastEngagementAt || 0) || 0;
      lastEngagementKey = String(raw.lastEngagementKey || '');
      persist();
    } catch (_) {
      sessionId = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    }
  }

  function persist() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        sessionId,lastInterstitialAt,eligibleBreakCount,sessionInterstitialCount,
        lastEngagementAt,lastEngagementKey
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

  function noteEngagement(feature, placement = 'content-use') {
    const name = normalizeFeature(feature);
    if (!isEligibleFeature(name)) return { counted:false, reason:'protected-or-ineligible', feature:name };

    const key = `${name}:${String(placement || '').slice(0,64)}`;
    const now = Date.now();
    if (key === lastEngagementKey && now - lastEngagementAt < ENGAGEMENT_MIN_GAP_MS) {
      return { counted:false, reason:'debounced', feature:name };
    }

    lastEngagementAt = now;
    lastEngagementKey = key;
    eligibleBreakCount = Math.min(ELIGIBLE_BREAKS_BEFORE_FIRST, eligibleBreakCount + 1);
    persist();
    return { counted:true, feature:name, eligibleBreakCount };
  }

  function armContentReturn(feature) {
    const name = normalizeFeature(feature);
    if (!isEligibleFeature(name)) return;
    pendingReturnFeature = name;
    pendingReturnAt = Date.now();
    pendingReturnSawHidden = false;
  }

  function clearContentReturn() {
    pendingReturnFeature = '';
    pendingReturnAt = 0;
    pendingReturnSawHidden = false;
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

    eligibleBreakCount = Math.min(ELIGIBLE_BREAKS_BEFORE_FIRST, eligibleBreakCount + 1);
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
    if (type === 'interstitial-showing' || type === 'interstitial-unavailable' || type === 'interstitial-failed' || type === 'interstitial-load-failed') interstitialReady = false;
  });

  document.addEventListener('click', event => {
    const target = event.target;
    if (!target?.closest) return;
    if (target.closest('#nxNewsRoot [data-v9-i]')) {
      const result = noteEngagement('news','article-open');
      if (result.counted) armContentReturn('news');
      return;
    }
    if (target.closest('#nxEntertainmentSearchBtn,.nx-ent-chip')) {
      const result = noteEngagement('entertainment','provider-open');
      if (result.counted) armContentReturn('entertainment');
      return;
    }
    if (target.closest('#tab-browser [data-nx-browser-go],#tab-browser .nx-speed,#tab-browser [data-nx-explicit-external]')) {
      const result = noteEngagement('browser','site-open');
      if (result.counted) armContentReturn('browser');
      return;
    }

    const action = target.closest('button,[role="button"],input[type="submit"]');
    const tab = action?.closest?.('.tab[id^="tab-"]');
    if (!action || !tab) return;
    if (action.closest('.nx-allapps-back,.tools-main-back')) return;
    const feature = normalizeFeature(tab.id || '');
    if (isEligibleFeature(feature)) noteEngagement(feature,'utility-action');
  }, true);

  document.addEventListener('submit', event => {
    if (event.target?.closest?.('#tab-browser [data-nx-home-search]')) {
      const result = noteEngagement('browser','search-open');
      if (result.counted) armContentReturn('browser');
    }
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (!pendingReturnFeature || !pendingReturnAt) return;
    const age = Date.now() - pendingReturnAt;
    if (age > CONTENT_RETURN_MAX_MS) {
      clearContentReturn();
      return;
    }
    if (document.hidden) {
      pendingReturnSawHidden = true;
      return;
    }
    if (!pendingReturnSawHidden || age < 700) return;
    const feature = pendingReturnFeature;
    clearContentReturn();
    setTimeout(() => maybeInterstitial('content-return', { feature }), 500);
  });

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
    noteEngagement,
    isProtected,
    isEligibleFeature,
    status
  });

  [700,1800,3500].forEach(ms => setTimeout(() => postNative('adStatus'), ms));
})();
