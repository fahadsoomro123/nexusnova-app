import { nativeAds } from './native-ads.js';

const SESSION_KEY = 'nx_fresh_ad_policy_session_v1';
const HUB_PLACEMENT = 'hub-app-open';
const MINING_PLACEMENT = 'mining-start';
const MINING_ACTION_PLACEMENT = 'mining-action';
const REQUEST_ACK_TIMEOUT_MS = 2_500;
const DISMISS_FAILSAFE_MS = 90_000;

// Production remains frequency-capped. TEST/debug deliberately uses a short
// cooldown so ad coverage can be verified across several apps on a real phone.
const PRODUCTION_INTERSTITIAL_MIN_GAP_MS = 180_000;
const TEST_INTERSTITIAL_MIN_GAP_MS = 5_000;
const PRODUCTION_INTERSTITIAL_SESSION_MAX = 4;
const TEST_INTERSTITIAL_SESSION_MAX = 50;
const PRODUCTION_ELIGIBLE_BREAKS_BEFORE_FIRST = 2;
const TEST_ELIGIBLE_BREAKS_BEFORE_FIRST = 1;

// User-approved forced-interstitial exclusions. Bible/Bukhari/About are kept
// here even if a direct fresh tile is not currently registered, so future
// additions inherit the same protection automatically.
const PROTECTED_APPS = new Set([
  'quran', 'hadith', 'bukhari', 'bible', 'qibla', 'security', 'emergency',
  'health', 'contacts', 'about', 'nova-vpn'
]);

// Every current non-protected Nova Hub app maps to a native allowlisted feature
// family. This prevents silent "ineligible" gaps such as News/Habits/etc.
const FEATURE_ALIAS = Object.freeze({
  wallet:'finance',
  tasks:'tools',
  market:'finance',
  profile:'tools',
  notes:'tools',
  todo:'tools',
  calculator:'tools',
  'unit-converter':'tools',
  expenses:'tools',
  pomodoro:'tools',
  bmi:'tools',
  tip:'tools',
  'world-clock':'tools',
  qr:'tools',
  weather:'mega-weather',
  qibla:'tools',
  'prayer-times':'tools',
  'nova-internet-speed':'tools',
  pakistan:'mega-pakistan',
  news:'news',
  articles:'news',
  location:'travel',
  'nova-drive':'travel',
  'nova-track':'travel',
  ai:'ai',
  smart:'smart',
  chat:'tools',
  browser:'browser',
  travel:'travel',
  learning:'learn',
  teacher:'mega-teacher',
  documents:'tools',
  entertainment:'entertainment',
  islamic:'tools',
  quran:'tools',
  hadith:'tools',
  'urdu-library':'learn',
  health:'tools',
  calendar:'mega-calendar',
  reminders:'mega-reminders',
  habits:'tools',
  savings:'money',
  contacts:'tools',
  family:'tools',
  emergency:'tools',
  finance:'finance',
  budget:'money',
  bills:'money',
  shopping:'shopping',
  marketplace:'marketplace',
  orders:'mega-orders',
  growth:'finance',
  'nova-vault':'tools',
  'nova-vpn':'tools',
  'file-vault':'tools',
  security:'tools',
  notifications:'tools',
  settings:'tools'
});

let lastInterstitialAt = 0;
let sessionInterstitialCount = 0;
let eligibleBreakCount = 0;
let inFlight = null;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function nativeTestMode() {
  return nativeAds.status().testMode !== false;
}

function interstitialMinGapMs() {
  return nativeTestMode() ? TEST_INTERSTITIAL_MIN_GAP_MS : PRODUCTION_INTERSTITIAL_MIN_GAP_MS;
}

function interstitialSessionMax() {
  return nativeTestMode() ? TEST_INTERSTITIAL_SESSION_MAX : PRODUCTION_INTERSTITIAL_SESSION_MAX;
}

function eligibleBreaksBeforeFirst() {
  return nativeTestMode()
    ? TEST_ELIGIBLE_BREAKS_BEFORE_FIRST
    : PRODUCTION_ELIGIBLE_BREAKS_BEFORE_FIRST;
}

function readSession() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
    lastInterstitialAt = Math.max(0, Number(raw.lastInterstitialAt) || 0);
    sessionInterstitialCount = Math.max(0, Number(raw.sessionInterstitialCount) || 0);
    eligibleBreakCount = Math.max(0, Number(raw.eligibleBreakCount) || 0);
  } catch (_) {}
}

function persist() {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      lastInterstitialAt,
      sessionInterstitialCount,
      eligibleBreakCount
    }));
  } catch (_) {}
}

function adFeatureFor(appId) {
  const id = normalize(appId);
  return FEATURE_ALIAS[id] || '';
}

function isProtected(appId) {
  const id = normalize(appId);
  if (!id) return true;
  if (PROTECTED_APPS.has(id)) return true;
  return /(?:^|[-_])(quran|hadith|bukhari|bible|qibla|security|emergency|health|contacts|about)(?:$|[-_])/i.test(id);
}

function isEligibleHubApp(appId) {
  const id = normalize(appId);
  return !isProtected(id) && Boolean(adFeatureFor(id));
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
  try { active.resolve({ shown: active.adStarted, reason }); } catch (_) {}
  if (typeof active.continue === 'function') {
    setTimeout(() => {
      try { active.continue(); } catch (error) { console.error('[NexusNova Fresh] ad continuation:', error); }
    }, 0);
  }
}

function cancelPendingHubNavigation() {
  if (!inFlight || inFlight.placement !== HUB_PLACEMENT) return false;
  // The native ad itself may already be opening and cannot be force-dismissed
  // safely from web code. Drop only the stale route continuation; keep native
  // ad lifecycle accounting intact until its normal terminal event arrives.
  inFlight.continue = null;
  inFlight.requestedFeature = '';
  return true;
}

function markAdStarted() {
  const active = inFlight;
  if (!active || active.adStarted) return;
  active.adStarted = true;
  clearTimeout(active.ackTimer);
  active.ackTimer = null;
  lastInterstitialAt = Date.now();
  sessionInterstitialCount = Math.min(interstitialSessionMax(), sessionInterstitialCount + 1);
  eligibleBreakCount = 0;
  persist();
  active.dismissTimer = setTimeout(() => finish('dismiss-failsafe-timeout'), DISMISS_FAILSAFE_MS);
}

function readyForHubInterstitial() {
  if (inFlight) return false;
  if (sessionInterstitialCount >= interstitialSessionMax()) return false;
  if (Date.now() - lastInterstitialAt < interstitialMinGapMs()) return false;
  return nativeAds.status().interstitialReady === true;
}

function startGate({ placement, feature = '', requestedFeature = '', continue: continuation, requireWarmup = false } = {}) {
  if (inFlight) return Promise.resolve({ shown:false, reason:'transition-pending' });

  if (requireWarmup) {
    const warmupTarget = eligibleBreaksBeforeFirst();
    eligibleBreakCount = Math.min(warmupTarget, eligibleBreakCount + 1);
    persist();
    if (eligibleBreakCount < warmupTarget) {
      continuation?.();
      return Promise.resolve({ shown:false, reason:'warmup' });
    }
    if (!readyForHubInterstitial()) {
      nativeAds.requestStatus();
      continuation?.();
      return Promise.resolve({ shown:false, reason:'frequency-or-not-ready' });
    }
  } else if (nativeAds.status().interstitialReady !== true) {
    nativeAds.requestStatus();
    continuation?.();
    return Promise.resolve({ shown:false, reason:'not-ready' });
  }

  const posted = nativeAds.showInterstitial({ placement, feature });
  if (!posted) {
    continuation?.();
    return Promise.resolve({ shown:false, reason:'native-unavailable' });
  }

  return new Promise(resolve => {
    inFlight = {
      placement,
      feature:normalize(feature),
      requestedFeature:normalize(requestedFeature),
      continue:continuation,
      resolve,
      adStarted:false,
      requestedAt:Date.now(),
      ackTimer:null,
      dismissTimer:null
    };
    inFlight.ackTimer = setTimeout(() => {
      if (!inFlight || inFlight.adStarted) return;
      finish('request-ack-timeout');
    }, REQUEST_ACK_TIMEOUT_MS);
  });
}

function gateHubApp(appId, open) {
  const id = normalize(appId);
  if (!isEligibleHubApp(id)) {
    open?.();
    return Promise.resolve({ shown:false, reason:'protected-or-ineligible' });
  }
  if (inFlight) return Promise.resolve({ shown:false, reason:'transition-pending' });
  return startGate({
    placement:HUB_PLACEMENT,
    feature:adFeatureFor(id),
    requestedFeature:id,
    continue:open,
    requireWarmup:true
  });
}

async function gateMiningRenewal(continueMining) {
  if (inFlight) {
    continueMining?.();
    return { shown:false, reason:'transition-pending' };
  }

  if (nativeAds.status().interstitialReady !== true) {
    try {
      await nativeAds.waitForInterstitialReady(8_000);
    } catch (error) {
      console.warn('[NexusNova Fresh] mining interstitial readiness:', error);
    }
  }

  return startGate({
    placement:MINING_PLACEMENT,
    feature:'',
    requestedFeature:'mine',
    continue:continueMining,
    requireWarmup:false
  });
}

// Mining monetization placement: the mining/Vault action is already complete
// before this is called. The ad is therefore a natural post-action transition,
// never a condition for NVX, Vault, Booster, Rain or Time Warp value.
async function showMiningActionAd(action = 'mining-action') {
  const requested = normalize(action) || 'mining-action';
  if (inFlight) return { shown:false, reason:'transition-pending' };
  if (sessionInterstitialCount >= interstitialSessionMax()) return { shown:false, reason:'session-cap' };
  if (Date.now() - lastInterstitialAt < interstitialMinGapMs()) return { shown:false, reason:'frequency-cap' };

  if (nativeAds.status().interstitialReady !== true) {
    nativeAds.requestStatus();
    if (nativeTestMode()) {
      try {
        await nativeAds.waitForInterstitialReady(4_000);
      } catch (error) {
        console.warn('[NexusNova Fresh] mining action interstitial readiness:', error);
      }
    }
  }

  if (!readyForHubInterstitial()) return { shown:false, reason:'not-ready-or-capped' };

  return startGate({
    placement:MINING_ACTION_PLACEMENT,
    feature:'tools',
    requestedFeature:requested,
    continue:null,
    requireWarmup:false
  });
}

nativeAds.subscribe(detail => {
  if (!inFlight) return;
  if (String(detail?.provider || '') !== 'admob') return;
  const type = String(detail?.event || '');
  if (!type.startsWith('interstitial-')) return;

  const placement = String(detail?.placement || '');
  const feature = normalize(detail?.feature || '');
  if (placement && placement !== inFlight.placement) return;
  if (feature && inFlight.feature && feature !== inFlight.feature) return;

  if (type === 'interstitial-showing' || type === 'interstitial-opened') {
    markAdStarted();
    return;
  }
  if (type === 'interstitial-dismissed') {
    finish('dismissed');
    return;
  }
  if ([
    'interstitial-unavailable',
    'interstitial-failed',
    'interstitial-load-failed',
    'interstitial-skipped'
  ].includes(type)) finish(type);
});

readSession();

export const adPolicy = Object.freeze({
  gateHubApp,
  gateMiningRenewal,
  showMiningActionAd,
  cancelPendingHubNavigation,
  isProtected,
  isEligibleHubApp,
  adFeatureFor,
  status() {
    return Object.freeze({
      inFlight:Boolean(inFlight),
      lastInterstitialAt,
      sessionInterstitialCount,
      sessionMax:interstitialSessionMax(),
      minGapMs:interstitialMinGapMs(),
      eligibleBreakCount,
      warmupTarget:eligibleBreaksBeforeFirst(),
      testMode:nativeTestMode(),
      native:nativeAds.status()
    });
  }
});
